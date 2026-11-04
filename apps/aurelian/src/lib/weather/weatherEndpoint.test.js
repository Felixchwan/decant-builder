import { getCache } from "@vercel/functions";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// The endpoint end to end, through the real route handler and the real Vercel SDK's cache (which, outside Vercel, is the SDK's own
// store): only the provider's HTTP is faked, and time is controlled. Modules are reloaded per test so no state leaks between them.
const T0 = Date.UTC(2026, 10, 4, 7, 47);
const HOUR = 3600000;

const forecastBody = (startMs, { temperature = 21, symbol = "clearsky_night" } = {}) => ({
  type: "Feature",
  geometry: { type: "Point", coordinates: [-100.3161, 25.6866, 538] },
  properties: {
    meta: { updated_at: "2026-11-04T07:17:45Z", units: { air_temperature: "celsius" } },
    timeseries: Array.from({ length: 30 }, (_, index) => ({
      time: new Date(startMs + index * HOUR).toISOString(),
      data: {
        instant: { details: { air_temperature: temperature, relative_humidity: 59, wind_speed: 1.3, air_pressure_at_sea_level: 1015 } },
        next_1_hours: { summary: { symbol_code: symbol }, details: { precipitation_amount: 0 } },
      },
    })),
  },
});

const metResponse = (status, body, headers = {}) =>
  new Response(status === 304 ? null : JSON.stringify(body ?? {}), { status, headers });

async function loadRoute() {
  vi.resetModules();

  return import("../../app/api/context/weather/route.js");
}

describe("GET /api/context/weather", () => {
  let fetchMock;

  beforeEach(async () => {
    vi.useFakeTimers();
    vi.setSystemTime(T0);
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    // Outside Vercel the SDK keeps its fallback store inside the (externalised, so never reloaded) SDK module: start every test
    // from an empty one. (On Vercel the store is the regional Runtime Cache, which is exactly what this stands in for.)
    await getCache({ namespace: "aurelian-weather" }).delete("monterrey:v1");
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("exports only GET (and the dynamic flag): no other method, no helper the framework would reject", async () => {
    const route = await loadRoute();

    expect(Object.keys(route).sort()).toEqual(["GET", "dynamic"]);
    expect(route.dynamic).toBe("force-dynamic");
  });

  it("returns a small normalised object and nothing of the provider's response", async () => {
    fetchMock.mockResolvedValue(metResponse(200, forecastBody(Date.UTC(2026, 10, 4, 7), { temperature: 21, symbol: "lightrain" }), { Expires: "Wed, 04 Nov 2026 08:15:46 GMT", "Last-Modified": "Wed, 04 Nov 2026 07:45:18 GMT" }));
    const { GET } = await loadRoute();
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      available: true,
      temperatureC: 21,
      precipitationMm: 0,
      condition: "rain",
      validAt: "2026-11-04T07:00:00.000Z",
      fetchedAt: new Date(T0).toISOString(),
      stale: false,
    });
    expect(JSON.stringify(body)).not.toMatch(/properties|timeseries|geometry|coordinates|humidity|wind|pressure|instant|symbol_code|apparent|met\.no/i);
  });

  it("sets only a content type and no-store: no cookies, no CORS, no provider headers, no secrets", async () => {
    fetchMock.mockResolvedValue(metResponse(200, forecastBody(Date.UTC(2026, 10, 4, 7)), { Expires: "Wed, 04 Nov 2026 08:15:46 GMT", "Set-Cookie": "x=1", "Last-Modified": "Wed, 04 Nov 2026 07:45:18 GMT" }));
    const { GET } = await loadRoute();
    const response = await GET();
    const names = [...response.headers.keys()].sort();

    expect(names).toEqual(["cache-control", "content-type"]);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("content-type")).toContain("application/json");
  });

  it("asks the provider from the SERVER only, for Monterrey's fixed coordinate, identified, with nothing of the visitor", async () => {
    fetchMock.mockResolvedValue(metResponse(200, forecastBody(Date.UTC(2026, 10, 4, 7)), { "Last-Modified": "Wed, 04 Nov 2026 07:45:18 GMT" }));
    const { GET } = await loadRoute();

    await GET(new Request("https://aurelianperfumes.com/api/context/weather", { headers: { cookie: "session=abc", "x-forwarded-for": "203.0.113.9", "user-agent": "Mozilla/5.0 visitor" } }));

    const [url, init] = fetchMock.mock.calls[0];

    expect(url).toBe("https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=25.6866&lon=-100.3161");
    expect(init.headers["User-Agent"]).toBe("aurelianperfumes.com/1.0 https://aurelianperfumes.com/contacto");
    expect(JSON.stringify(init)).not.toMatch(/session|203\.0\.113|Mozilla|cookie/i);
  });

  it("serves the shared snapshot to later requests with NO further provider call, across route reloads (separate 'instances') in the same store", async () => {
    fetchMock.mockResolvedValue(metResponse(200, forecastBody(Date.UTC(2026, 10, 4, 7)), { Expires: "Wed, 04 Nov 2026 08:15:46 GMT", "Last-Modified": "Wed, 04 Nov 2026 07:45:18 GMT" }));
    const { GET } = await loadRoute();

    await GET();
    await GET();

    const otherInstance = await loadRoute(); // a fresh module graph: a new service with no memory of the first

    await otherInstance.GET();
    await otherInstance.GET();

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("refreshes once the snapshot is due (60 minutes), conditionally, and a 304 keeps serving the stored points", async () => {
    fetchMock.mockResolvedValueOnce(metResponse(200, forecastBody(Date.UTC(2026, 10, 4, 7), { temperature: 21 }), { Expires: "Wed, 04 Nov 2026 08:15:46 GMT", "Last-Modified": "Wed, 04 Nov 2026 07:45:18 GMT" }));
    fetchMock.mockResolvedValueOnce(metResponse(304, null, { Expires: "Wed, 04 Nov 2026 10:00:00 GMT", "Last-Modified": "Wed, 04 Nov 2026 07:45:18 GMT" }));
    const { GET } = await loadRoute();

    await GET();
    vi.setSystemTime(T0 + HOUR + 60000);
    const body = await (await GET()).json();

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1][1].headers["If-Modified-Since"]).toBe("Wed, 04 Nov 2026 07:45:18 GMT");
    expect(body).toMatchObject({ available: true, stale: false, temperatureC: 21 });
  });

  it("serves the old snapshot as stale when a due refresh fails", async () => {
    fetchMock.mockResolvedValueOnce(metResponse(200, forecastBody(Date.UTC(2026, 10, 4, 7)), { "Last-Modified": "Wed, 04 Nov 2026 07:45:18 GMT" }));
    fetchMock.mockResolvedValueOnce(metResponse(503, {}));
    const { GET } = await loadRoute();

    await GET();
    vi.setSystemTime(T0 + HOUR + 60000);
    const body = await (await GET()).json();

    expect(body).toMatchObject({ available: true, stale: true });
  });

  it("answers { available: false } with status 200, never an error, when there is no snapshot and the provider fails", async () => {
    fetchMock.mockResolvedValue(metResponse(403, {}));
    const { GET } = await loadRoute();
    const response = await GET();

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ available: false });
  });

  it("answers { available: false } even if the provider call throws", async () => {
    fetchMock.mockRejectedValue(new TypeError("fetch failed"));
    const { GET } = await loadRoute();

    expect(await (await GET()).json()).toEqual({ available: false });
  });

  it("treats a snapshot older than six hours as unavailable when the refresh also fails", async () => {
    fetchMock.mockResolvedValueOnce(metResponse(200, forecastBody(Date.UTC(2026, 10, 4, 7)), { "Last-Modified": "Wed, 04 Nov 2026 07:45:18 GMT" }));
    fetchMock.mockResolvedValue(metResponse(500, {}));
    const { GET } = await loadRoute();

    await GET();
    vi.setSystemTime(T0 + 6 * HOUR + 60000);

    expect(await (await GET()).json()).toEqual({ available: false });
  });
});
