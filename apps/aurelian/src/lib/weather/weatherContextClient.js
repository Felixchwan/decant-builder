// The browser's side of Aurelian's weather context: ask Aurelian's OWN endpoint, once per drawer opening, and remember the answer for
// a while so reopening the drawer does not ask again. The browser never contacts the weather provider, and sends nothing but a plain
// GET to this site (no coordinates, no box, no identity).
//
// The server's shared snapshot is the authority; this memory is only an optimisation inside one page's life (it is gone on reload).
// No timer, no polling, no request on render or on scroll.
export const WEATHER_ENDPOINT = "/api/context/weather";
export const WEATHER_REUSE_MS = 10 * 60 * 1000;
export const UNAVAILABLE_REUSE_MS = 2 * 60 * 1000;
export const WEATHER_REQUEST_TIMEOUT_MS = 3500;

const CONDITIONS = ["clear", "cloudy", "rain", "other"];

let remembered = null; // { at, weather | null }
let inFlight = null;

// A usable answer, rebuilt field by field, or null. Anything the server could ever add is dropped here.
export function readWeatherResponse(body) {
  if (!body || body.available !== true) return null;

  const { temperatureC, precipitationMm, condition, validAt, fetchedAt, stale } = body;

  if (typeof temperatureC !== "number" || !Number.isFinite(temperatureC) || !CONDITIONS.includes(condition)) return null;
  if (typeof validAt !== "string" || typeof fetchedAt !== "string") return null;

  return {
    available: true,
    temperatureC,
    ...(typeof precipitationMm === "number" && Number.isFinite(precipitationMm) ? { precipitationMm } : {}),
    condition,
    validAt,
    fetchedAt,
    stale: stale === true,
  };
}

async function requestWeather(fetchImpl) {
  try {
    const response = await fetchImpl(WEATHER_ENDPOINT, {
      method: "GET",
      headers: { Accept: "application/json" },
      credentials: "omit",
      cache: "no-store",
      signal: AbortSignal.timeout(WEATHER_REQUEST_TIMEOUT_MS),
    });

    return response.ok ? readWeatherResponse(await response.json()) : null;
  } catch {
    return null;
  }
}

// The weather for the drawer, or null when there is none (never throws). Reused for ten minutes, a failure for two, and concurrent
// callers share one request.
export async function loadWeatherContext({ fetchImpl = globalThis.fetch, now = Date.now } = {}) {
  if (remembered && now() - remembered.at < (remembered.weather ? WEATHER_REUSE_MS : UNAVAILABLE_REUSE_MS)) {
    return remembered.weather;
  }

  if (!inFlight) {
    inFlight = requestWeather(fetchImpl)
      .then((weather) => {
        remembered = { at: now(), weather };

        return weather;
      })
      .finally(() => {
        inFlight = null;
      });
  }

  return inFlight;
}

// Test hook: forget what this page remembered.
export function resetWeatherContextMemory() {
  remembered = null;
  inFlight = null;
}
