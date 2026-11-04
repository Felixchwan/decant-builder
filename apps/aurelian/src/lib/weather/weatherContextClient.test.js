import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  UNAVAILABLE_REUSE_MS,
  WEATHER_ENDPOINT,
  WEATHER_REUSE_MS,
  loadWeatherContext,
  readWeatherResponse,
  resetWeatherContextMemory,
} from "./weatherContextClient.js";

const GOOD = { available: true, temperatureC: 18.2, precipitationMm: 0, condition: "clear", validAt: "2026-11-04T07:00:00.000Z", fetchedAt: "2026-11-04T07:47:00.000Z", stale: false };
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

beforeEach(() => resetWeatherContextMemory());

describe("loadWeatherContext: one cheap request to Aurelian's own endpoint, per opening", () => {
  it("asks Aurelian's own origin (a relative URL), once, with a plain GET: no credentials, no body, no coordinates", async () => {
    const fetchImpl = vi.fn(async () => json(GOOD));

    await loadWeatherContext({ fetchImpl });

    const [url, init] = fetchImpl.mock.calls[0];

    expect(WEATHER_ENDPOINT).toBe("/api/context/weather");
    expect(url).toBe("/api/context/weather");
    expect(url).not.toMatch(/^https?:|met\.no|lat=|lon=/);
    expect(init.method).toBe("GET");
    expect(init.credentials).toBe("omit");
    expect(init.body).toBeUndefined();
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it("returns the normalised weather", async () => {
    expect(await loadWeatherContext({ fetchImpl: async () => json(GOOD) })).toEqual(GOOD);
  });

  it("reuses a good answer for ten minutes (reopening the drawer asks nothing), then asks again", async () => {
    const fetchImpl = vi.fn(async () => json(GOOD));
    const clock = { now: 1_000_000 };

    await loadWeatherContext({ fetchImpl, now: () => clock.now });
    clock.now += WEATHER_REUSE_MS - 1;
    await loadWeatherContext({ fetchImpl, now: () => clock.now });
    await loadWeatherContext({ fetchImpl, now: () => clock.now });
    expect(fetchImpl).toHaveBeenCalledTimes(1);

    clock.now += 1;
    await loadWeatherContext({ fetchImpl, now: () => clock.now });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("remembers a failure for only two minutes", async () => {
    const fetchImpl = vi.fn(async () => json({ available: false }));
    const clock = { now: 1_000_000 };

    expect(await loadWeatherContext({ fetchImpl, now: () => clock.now })).toBeNull();
    clock.now += UNAVAILABLE_REUSE_MS - 1;
    await loadWeatherContext({ fetchImpl, now: () => clock.now });
    expect(fetchImpl).toHaveBeenCalledTimes(1);

    clock.now += 1;
    await loadWeatherContext({ fetchImpl, now: () => clock.now });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("concurrent callers share one request", async () => {
    const fetchImpl = vi.fn(async () => json(GOOD));

    const answers = await Promise.all([loadWeatherContext({ fetchImpl }), loadWeatherContext({ fetchImpl }), loadWeatherContext({ fetchImpl })]);

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(answers.every((answer) => answer?.temperatureC === 18.2)).toBe(true);
  });

  it.each([
    ["an HTTP error", async () => json({}, 500)],
    ["a network failure", async () => { throw new TypeError("fetch failed"); }],
    ["a timeout", async () => { throw new DOMException("timed out", "TimeoutError"); }],
    ["not JSON", async () => new Response("<html>", { status: 200 })],
    ["'unavailable'", async () => json({ available: false })],
  ])("%s is null, never a throw", async (_label, fetchImpl) => {
    expect(await loadWeatherContext({ fetchImpl })).toBeNull();
  });
});

describe("readWeatherResponse: only what is expected gets through", () => {
  it("rebuilds the answer field by field and drops anything extra", () => {
    expect(readWeatherResponse({ ...GOOD, raw: { properties: {} }, secret: "x", apparentTemperatureC: 3 })).toEqual(GOOD);
  });

  it("omits an unknown precipitation and reads stale", () => {
    const { precipitationMm, ...withoutRain } = GOOD;

    expect(precipitationMm).toBe(0);
    expect(readWeatherResponse(withoutRain)).not.toHaveProperty("precipitationMm");
    expect(readWeatherResponse({ ...GOOD, stale: true }).stale).toBe(true);
    expect(readWeatherResponse({ ...GOOD, stale: "yes" }).stale).toBe(false);
  });

  it.each([
    [null],
    [undefined],
    ["text"],
    [{ available: false }],
    [{ ...GOOD, temperatureC: "18" }],
    [{ ...GOOD, temperatureC: NaN }],
    [{ ...GOOD, condition: "tornado" }],
    [{ ...GOOD, validAt: 5 }],
    [{ ...GOOD, fetchedAt: undefined }],
  ])("rejects %j", (body) => {
    expect(readWeatherResponse(body)).toBeNull();
  });
});

describe("the client never polls or fires on its own", () => {
  const code = readFileSync(fileURLToPath(new URL("./weatherContextClient.js", import.meta.url)), "utf8").replace(/^\s*\/\/.*$/gm, "");

  it("has no timer, interval, scroll or render hook, and no storage", () => {
    expect(code).not.toMatch(/setInterval|setTimeout|addEventListener|useEffect|useState|requestAnimationFrame|localStorage|sessionStorage|navigator\.geolocation/);
  });

  it("never names the weather provider", () => {
    expect(code).not.toMatch(/met\.no|api\.met/i);
  });
});
