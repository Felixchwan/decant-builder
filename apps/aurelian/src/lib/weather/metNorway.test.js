import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";
import {
  MAX_KEPT_POINTS,
  MET_FORECAST_URL,
  buildMetForecastUrl,
  buildMetHeaders,
  formatCoordinate,
  parseMetForecast,
  requestMetForecast,
  selectCurrentPoint,
  symbolToCondition,
} from "./metNorway.js";
import { AURELIAN_SITE_ORIGIN, MET_USER_AGENT, MONTERREY_COORDINATES } from "./monterreyLocation.js";

// A response shaped like the real compact product (see the audit of api.met.no): hourly points, each with an instant block and
// next_1_hours (symbol + precipitation) / next_6_hours / next_12_hours blocks.
function pointAt(isoTime, { temperature = 21, symbol = "clearsky_night", precipitation = 0, noNextHour = false } = {}) {
  return {
    time: isoTime,
    data: {
      instant: { details: { air_pressure_at_sea_level: 1015.9, air_temperature: temperature, cloud_area_fraction: 43.7, relative_humidity: 58.9, wind_from_direction: 185.1, wind_speed: 1.3 } },
      next_12_hours: { summary: { symbol_code: "clearsky_day" }, details: {} },
      ...(noNextHour ? {} : { next_1_hours: { summary: { symbol_code: symbol }, details: { precipitation_amount: precipitation } } }),
      next_6_hours: { summary: { symbol_code: "fair_night" }, details: { precipitation_amount: 0 } },
    },
  };
}

function forecast(points) {
  return {
    type: "Feature",
    geometry: { type: "Point", coordinates: [-100.3161, 25.6866, 538] },
    properties: { meta: { updated_at: "2026-11-04T07:17:45Z", units: { air_temperature: "celsius" } }, timeseries: points },
  };
}

const hourly = (startIso, count, make = () => ({})) =>
  Array.from({ length: count }, (_, index) => pointAt(new Date(Date.parse(startIso) + index * 3600000).toISOString().replace(".000Z", "Z"), make(index)));

const respond = (status, body, headers = {}) =>
  new Response(status === 304 ? null : typeof body === "string" ? body : JSON.stringify(body ?? {}), { status, headers });

describe("the request: fixed Monterrey, four decimals, over HTTPS, compact only", () => {
  it("asks for the compact Locationforecast 2.0 product over HTTPS", () => {
    expect(MET_FORECAST_URL).toBe("https://api.met.no/weatherapi/locationforecast/2.0/compact");
    expect(MET_FORECAST_URL.startsWith("https://")).toBe(true);
    expect(MET_FORECAST_URL).toContain("/compact");
    expect(MET_FORECAST_URL).not.toMatch(/complete|classic/);
  });

  it("uses one canonical Monterrey coordinate with at most four decimals", () => {
    expect(MONTERREY_COORDINATES).toEqual({ latitude: 25.6866, longitude: -100.3161 });

    for (const value of Object.values(MONTERREY_COORDINATES)) {
      expect(String(value).split(".")[1].length).toBeLessThanOrEqual(4);
    }
  });

  it("builds exactly that URL, and refuses a coordinate with more than four decimals", () => {
    expect(buildMetForecastUrl()).toBe("https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=25.6866&lon=-100.3161");
    expect(formatCoordinate(25.6)).toBe("25.6");
    expect(formatCoordinate(-100.3161)).toBe("-100.3161");
    expect(() => formatCoordinate(25.68661)).toThrow(/four decimals/);
    expect(() => buildMetForecastUrl({ latitude: 25.123456, longitude: -100.1 })).toThrow();
  });

  it("identifies itself with Aurelian's domain, a version and a link to the site's contact page, never a generic agent or an invented address", () => {
    expect(MET_USER_AGENT).toBe("aurelianperfumes.com/1.0 https://aurelianperfumes.com/contacto");
    expect(MET_USER_AGENT).toContain("aurelianperfumes.com");
    expect(MET_USER_AGENT).toContain(`${AURELIAN_SITE_ORIGIN}/contacto`);
    expect(MET_USER_AGENT).not.toMatch(/@|node|undici|fetch|axios|curl|mozilla/i);
    expect(buildMetHeaders()["User-Agent"]).toBe(MET_USER_AGENT);
  });

  it("keeps the site origin in step with the root layout's metadataBase, and the contact page it links to exists", () => {
    const layout = readFileSync(fileURLToPath(new URL("../../app/layout.jsx", import.meta.url)), "utf8");
    const contact = readFileSync(fileURLToPath(new URL("../../app/contacto/page.jsx", import.meta.url)), "utf8");

    expect(layout).toContain(`metadataBase: new URL("${AURELIAN_SITE_ORIGIN}")`);
    expect(contact.length).toBeGreaterThan(0);
  });

  it("sends If-Modified-Since only when there is a previous Last-Modified, and EXACTLY as the provider sent it", () => {
    const exact = "Wed, 04 Nov 2026 07:45:18 GMT";

    expect(buildMetHeaders()).not.toHaveProperty("If-Modified-Since");
    expect(buildMetHeaders({ ifModifiedSince: null })).not.toHaveProperty("If-Modified-Since");
    expect(buildMetHeaders({ ifModifiedSince: exact })["If-Modified-Since"]).toBe(exact);
  });

  it("sends nothing about the visitor: only the agent, an Accept and (maybe) If-Modified-Since", () => {
    expect(Object.keys(buildMetHeaders({ ifModifiedSince: "x" })).sort()).toEqual(["Accept", "If-Modified-Since", "User-Agent"]);
  });
});

describe("symbolToCondition: a small, deterministic mapping from the provider's symbols", () => {
  it.each([
    ["clearsky_day", "clear"],
    ["clearsky_night", "clear"],
    ["fair_day", "clear"],
    ["fair_polartwilight", "clear"],
    ["partlycloudy_night", "cloudy"],
    ["cloudy", "cloudy"],
    ["lightrain", "rain"],
    ["rain", "rain"],
    ["heavyrain", "rain"],
    ["lightrainshowers_night", "rain"],
    ["rainshowers_day", "rain"],
    ["heavyrainandthunder", "rain"],
    ["lightrainandthunder_night", "rain"],
    ["fog", "other"],
    ["snow", "other"],
    ["lightsleet", "other"],
    ["heavysnowshowers_day", "other"],
    ["", "other"],
    [undefined, "other"],
    [null, "other"],
    [42, "other"],
  ])("%s is %s", (symbol, condition) => {
    expect(symbolToCondition(symbol)).toBe(condition);
  });

  it("is the only place a provider symbol is interpreted: the shared Builder never sees one", () => {
    const shared = readFileSync(fileURLToPath(new URL("../../../../../packages/builder/src/builder/internal/recommendations/buildTodayRecommendations.js", import.meta.url)), "utf8");

    expect(shared).not.toMatch(/clearsky|partlycloudy|symbol_code/);
  });
});

describe("parseMetForecast: the fields consumed", () => {
  it("reads the instant air temperature, the next hour's precipitation and symbol, and the time", () => {
    const [point] = parseMetForecast(forecast([pointAt("2026-11-04T07:00:00Z", { temperature: 21.4, symbol: "lightrain", precipitation: 0.6 })]));

    expect(point).toEqual({ time: "2026-11-04T07:00:00.000Z", temperatureC: 21.4, precipitationMm: 0.6, condition: "rain" });
  });

  it("keeps only those four fields: no humidity, wind, pressure or cloud cover, no raw payload", () => {
    const [point] = parseMetForecast(forecast([pointAt("2026-11-04T07:00:00Z")]));

    expect(Object.keys(point).sort()).toEqual(["condition", "precipitationMm", "temperatureC", "time"]);
    expect(JSON.stringify(point)).not.toMatch(/humidity|wind|pressure|cloud|geometry|properties/);
  });

  it("has no apparent ('feels like') temperature to read, and invents none", () => {
    expect(JSON.stringify(forecast([pointAt("2026-11-04T07:00:00Z")]))).not.toMatch(/apparent|feels/i);
    expect(parseMetForecast(forecast([pointAt("2026-11-04T07:00:00Z")]))[0]).not.toHaveProperty("apparentTemperatureC");
  });

  it("falls back to the six-hour symbol, and to a null precipitation, when there is no next hour", () => {
    const [point] = parseMetForecast(forecast([pointAt("2026-11-04T07:00:00Z", { noNextHour: true })]));

    expect(point.precipitationMm).toBeNull();
    expect(point.condition).toBe("clear"); // fair_night, from next_6_hours
  });

  it("keeps at most a day of points", () => {
    expect(MAX_KEPT_POINTS).toBe(24);
    expect(parseMetForecast(forecast(hourly("2026-11-04T07:00:00Z", 90)))).toHaveLength(24);
  });

  it("drops points without a usable time or temperature, and is null when nothing is usable", () => {
    const good = pointAt("2026-11-04T07:00:00Z");
    const noTemperature = { time: "2026-11-04T08:00:00Z", data: { instant: { details: {} } } };
    const badTime = { ...pointAt("x"), time: "not a time" };

    expect(parseMetForecast(forecast([noTemperature, good, badTime]))).toHaveLength(1);
    expect(parseMetForecast(forecast([noTemperature, badTime]))).toBeNull();
    expect(parseMetForecast(forecast([]))).toBeNull();
    expect(parseMetForecast({})).toBeNull();
    expect(parseMetForecast(null)).toBeNull();
    expect(parseMetForecast("<html>")).toBeNull();
  });
});

describe("selectCurrentPoint: the hour in progress, in Monterrey's real moment (UTC instants)", () => {
  const points = parseMetForecast(forecast(hourly("2026-11-04T07:00:00Z", 6, (index) => ({ temperature: 20 + index }))));
  const at = (iso) => Date.parse(iso);

  it("picks the latest point that is not in the future", () => {
    expect(selectCurrentPoint(points, at("2026-11-04T07:00:00Z")).temperatureC).toBe(20);
    expect(selectCurrentPoint(points, at("2026-11-04T07:47:00Z")).temperatureC).toBe(20);
    expect(selectCurrentPoint(points, at("2026-11-04T07:59:59Z")).temperatureC).toBe(20);
    expect(selectCurrentPoint(points, at("2026-11-04T08:00:00Z")).temperatureC).toBe(21);
    expect(selectCurrentPoint(points, at("2026-11-04T12:30:00Z")).temperatureC).toBe(25);
  });

  it("is null before the series starts and once its last hour is over", () => {
    expect(selectCurrentPoint(points, at("2026-11-04T06:59:59Z"))).toBeNull();
    expect(selectCurrentPoint(points, at("2026-11-04T12:59:59Z"))).not.toBeNull();
    expect(selectCurrentPoint(points, at("2026-11-04T13:00:00Z"))).toBeNull();
    expect(selectCurrentPoint([], at("2026-11-04T07:00:00Z"))).toBeNull();
    expect(selectCurrentPoint(null, at("2026-11-04T07:00:00Z"))).toBeNull();
  });
});

describe("requestMetForecast: every outcome is a plain result, never a throw", () => {
  const body = forecast(hourly("2026-11-04T07:00:00Z", 4));
  const NOW = Date.UTC(2026, 10, 4, 7, 47);

  it("200: parses the points and returns Expires (ms) and Last-Modified (verbatim)", async () => {
    const fetchImpl = vi.fn(async () =>
      respond(200, body, { Expires: "Wed, 04 Nov 2026 08:15:46 GMT", "Last-Modified": "Wed, 04 Nov 2026 07:45:18 GMT" })
    );
    const result = await requestMetForecast({ fetchImpl, now: () => NOW });

    expect(result).toMatchObject({ kind: "ok", status: 200, expires: Date.UTC(2026, 10, 4, 8, 15, 46), lastModified: "Wed, 04 Nov 2026 07:45:18 GMT" });
    expect(result.points).toHaveLength(4);
  });

  it("sends a GET to the exact URL with the identifying headers, no cookies or credentials, no body, and never lets the framework cache it", async () => {
    const fetchImpl = vi.fn(async () => respond(200, body));

    await requestMetForecast({ fetchImpl, ifModifiedSince: "Wed, 04 Nov 2026 07:45:18 GMT" });

    const [url, init] = fetchImpl.mock.calls[0];

    expect(url).toBe("https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=25.6866&lon=-100.3161");
    expect(init.method).toBe("GET");
    expect(init.headers).toEqual({ "User-Agent": MET_USER_AGENT, Accept: "application/json", "If-Modified-Since": "Wed, 04 Nov 2026 07:45:18 GMT" });
    expect(init.cache).toBe("no-store");
    expect(init.body).toBeUndefined();
    expect(init.credentials).toBeUndefined();
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it("treats a 203 (a deprecated product version) as a good answer", async () => {
    expect((await requestMetForecast({ fetchImpl: async () => respond(203, body) })).kind).toBe("ok");
  });

  it("304: not modified, carrying THIS response's Expires and Last-Modified, and no points", async () => {
    const result = await requestMetForecast({
      fetchImpl: async () => respond(304, null, { Expires: "Wed, 04 Nov 2026 08:15:46 GMT", "Last-Modified": "Wed, 04 Nov 2026 07:45:18 GMT" }),
      ifModifiedSince: "Wed, 04 Nov 2026 07:45:18 GMT",
    });

    expect(result).toEqual({ kind: "not_modified", status: 304, expires: Date.UTC(2026, 10, 4, 8, 15, 46), lastModified: "Wed, 04 Nov 2026 07:45:18 GMT" });
  });

  it("a missing or unreadable Expires is null, never NaN", async () => {
    expect((await requestMetForecast({ fetchImpl: async () => respond(200, body) })).expires).toBeNull();
    expect((await requestMetForecast({ fetchImpl: async () => respond(200, body, { Expires: "soon" }) })).expires).toBeNull();
  });

  it.each([
    [403, "forbidden"],
    [429, "rate_limited"],
    [500, "server_error"],
    [502, "server_error"],
    [503, "server_error"],
    [404, "unexpected_status"],
    [418, "unexpected_status"],
  ])("%i is an error (%s), not a throw", async (status, reason) => {
    const result = await requestMetForecast({ fetchImpl: async () => respond(status, "nope") });

    expect(result).toMatchObject({ kind: "error", status, reason });
  });

  it("reads Retry-After, in seconds or as a date", async () => {
    const seconds = await requestMetForecast({ fetchImpl: async () => respond(429, "", { "Retry-After": "120" }), now: () => NOW });
    const date = await requestMetForecast({ fetchImpl: async () => respond(429, "", { "Retry-After": "Wed, 04 Nov 2026 07:57:47 GMT" }), now: () => NOW });
    const none = await requestMetForecast({ fetchImpl: async () => respond(429, ""), now: () => NOW });

    expect(seconds.retryAfterMs).toBe(120000);
    expect(date.retryAfterMs).toBe(647000); // 07:57:47 - 07:47:00
    expect(none.retryAfterMs).toBeNull();
  });

  it("a 200 whose body is not a forecast is an error, not a snapshot", async () => {
    expect(await requestMetForecast({ fetchImpl: async () => respond(200, "<html>not json</html>") })).toMatchObject({ kind: "error", reason: "invalid_body" });
    expect(await requestMetForecast({ fetchImpl: async () => respond(200, { properties: { timeseries: [] } }) })).toMatchObject({ kind: "error", reason: "invalid_body" });
  });

  it("a network failure or a timeout is an error result", async () => {
    expect(await requestMetForecast({ fetchImpl: async () => { throw new TypeError("fetch failed"); } })).toEqual({ kind: "error", status: null, reason: "network", retryAfterMs: null });
    expect(await requestMetForecast({ fetchImpl: async () => { throw new DOMException("timed out", "TimeoutError"); } })).toMatchObject({ reason: "network" });
  });
});
