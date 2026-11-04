import { MET_USER_AGENT, MONTERREY_COORDINATES } from "./monterreyLocation.js";

// The MET Norway Locationforecast 2.0 "compact" adapter: the ONLY file that knows the provider's URL, headers, status codes and
// payload shape. It turns a response into a small normalised result and nothing else leaves it.
//
//   200   a forecast: hourly points, of which a few are kept (time, temperature, precipitation, condition)
//   304   "not modified": the previous payload is still right (sent only with a verbatim If-Modified-Since)
//   403   refused (usually a missing or generic User-Agent)
//   429   asked too often
//   5xx   the provider is struggling
//
// The compact product carries, per hourly point: instant air temperature (Celsius), cloud cover, humidity, wind and pressure, plus
// next_1_hours (a symbol code and a precipitation amount in mm). It has NO apparent ("feels like") temperature, so none is
// reported; only temperature, precipitation and the symbol-derived condition are read.

export const MET_FORECAST_URL = "https://api.met.no/weatherapi/locationforecast/2.0/compact";
export const DEFAULT_REQUEST_TIMEOUT_MS = 2500;
// A day of hourly points is far more than the six hours a snapshot may be served for.
export const MAX_KEPT_POINTS = 24;

// Coordinates to at most four decimals, as the provider requires.
export function formatCoordinate(value) {
  const rounded = Number(value.toFixed(4));

  if (!Number.isFinite(rounded) || rounded !== value) {
    throw new Error(`Coordinate ${value} has more than four decimals`);
  }

  return String(rounded);
}

export function buildMetForecastUrl({ latitude, longitude } = MONTERREY_COORDINATES) {
  return `${MET_FORECAST_URL}?lat=${formatCoordinate(latitude)}&lon=${formatCoordinate(longitude)}`;
}

// Only what the provider needs: who is asking, and (when there is something to compare with) the EXACT Last-Modified it sent
// last time. No cookies, no visitor data, no referrer.
export function buildMetHeaders({ ifModifiedSince = null } = {}) {
  return {
    "User-Agent": MET_USER_AGENT,
    Accept: "application/json",
    ...(ifModifiedSince ? { "If-Modified-Since": ifModifiedSince } : {}),
  };
}

// A MET symbol code ("partlycloudy_day", "lightrainshowers_night", "rainandthunder") to the three conditions the Builder knows,
// or "other". Deliberately small: clear and cloudy are told apart because the scoring may care, rain because it changes what
// suits the day, everything else (fog, snow, sleet) is "other" and is never passed on as a guess.
export function symbolToCondition(symbolCode) {
  if (typeof symbolCode !== "string" || symbolCode === "") return "other";

  const base = symbolCode.replace(/_(day|night|polartwilight)$/, "");

  if (base === "clearsky" || base === "fair") return "clear";
  if (base === "partlycloudy" || base === "cloudy") return "cloudy";
  if (/rain|drizzle/.test(base)) return "rain";

  return "other";
}

// The hourly points worth keeping, normalised: { time (ISO), temperatureC, precipitationMm | null, condition }. Points without a
// usable time or temperature are dropped; null when there is nothing usable at all.
export function parseMetForecast(body) {
  const series = body?.properties?.timeseries;

  if (!Array.isArray(series)) return null;

  const points = [];

  for (const entry of series) {
    const time = typeof entry?.time === "string" ? Date.parse(entry.time) : Number.NaN;
    const temperature = entry?.data?.instant?.details?.air_temperature;

    if (!Number.isFinite(time) || typeof temperature !== "number" || !Number.isFinite(temperature)) continue;

    const nextHour = entry.data.next_1_hours;
    const precipitation = nextHour?.details?.precipitation_amount;
    const symbol = nextHour?.summary?.symbol_code ?? entry.data.next_6_hours?.summary?.symbol_code;

    points.push({
      time: new Date(time).toISOString(),
      temperatureC: temperature,
      precipitationMm: typeof precipitation === "number" && Number.isFinite(precipitation) ? precipitation : null,
      condition: symbolToCondition(symbol),
    });

    if (points.length === MAX_KEPT_POINTS) break;
  }

  return points.length > 0 ? points : null;
}

// The hour in progress: the latest point that is not in the future. The series is hourly, and a point's precipitation and symbol
// describe the hour that STARTS at it, so this is the one point whose temperature, rain and symbol all belong to "now". Null when
// the series has not started yet, or has run out (its last hour is over).
export function selectCurrentPoint(points, nowMs) {
  if (!Array.isArray(points) || points.length === 0) return null;

  let current = null;

  for (const point of points) {
    if (Date.parse(point.time) <= nowMs) current = point;
    else break;
  }

  if (!current) return null;

  return nowMs - Date.parse(current.time) < 60 * 60 * 1000 ? current : null;
}

function parseHttpDate(value) {
  if (typeof value !== "string") return null;

  const parsed = Date.parse(value);

  return Number.isFinite(parsed) ? parsed : null;
}

function parseRetryAfterMs(value, nowMs) {
  if (typeof value !== "string" || value === "") return null;

  const seconds = Number(value);

  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);

  const date = Date.parse(value);

  return Number.isFinite(date) ? Math.max(0, date - nowMs) : null;
}

async function readPoints(response) {
  try {
    return parseMetForecast(await response.json());
  } catch {
    return null;
  }
}

// One request, never thrown from: every outcome is a plain result.
//
//   { kind: "ok", status, points, expires (ms | null), lastModified (the exact header text | null) }
//   { kind: "not_modified", status: 304, expires, lastModified }
//   { kind: "error", status | null, reason: "forbidden" | "rate_limited" | "server_error" | "unexpected_status" | "invalid_body" | "network", retryAfterMs }
export async function requestMetForecast({
  fetchImpl = globalThis.fetch,
  coordinates = MONTERREY_COORDINATES,
  ifModifiedSince = null,
  timeoutMs = DEFAULT_REQUEST_TIMEOUT_MS,
  now = Date.now,
} = {}) {
  let response;

  try {
    response = await fetchImpl(buildMetForecastUrl(coordinates), {
      method: "GET",
      headers: buildMetHeaders({ ifModifiedSince }),
      // The server's own cache is the shared snapshot (weatherSnapshot.js); the framework must not add a second one here.
      cache: "no-store",
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch {
    return { kind: "error", status: null, reason: "network", retryAfterMs: null };
  }

  const status = response.status;
  const expires = parseHttpDate(response.headers.get("expires"));
  const lastModified = response.headers.get("last-modified");

  if (status === 304) {
    return { kind: "not_modified", status, expires, lastModified: lastModified || null };
  }

  if (status === 200 || status === 203) {
    const points = await readPoints(response);

    return points
      ? { kind: "ok", status, points, expires, lastModified: lastModified || null }
      : { kind: "error", status, reason: "invalid_body", retryAfterMs: null };
  }

  const retryAfterMs = parseRetryAfterMs(response.headers.get("retry-after"), now());

  if (status === 403) return { kind: "error", status, reason: "forbidden", retryAfterMs };
  if (status === 429) return { kind: "error", status, reason: "rate_limited", retryAfterMs };
  if (status >= 500) return { kind: "error", status, reason: "server_error", retryAfterMs };

  return { kind: "error", status, reason: "unexpected_status", retryAfterMs };
}
