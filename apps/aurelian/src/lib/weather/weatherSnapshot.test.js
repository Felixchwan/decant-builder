import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";
import {
  WEATHER_ENTRY_TTL_SECONDS,
  WEATHER_MAX_STALE_MS,
  WEATHER_MIN_REFRESH_MS,
  computeRefreshAfter,
  createWeatherService,
} from "./weatherSnapshot.js";

const MIN = 60 * 1000;
const HOUR = 60 * MIN;
const utc = (hour, minute = 0, day = 4) => Date.UTC(2026, 10, day, hour, minute);

// The shared store, as the service sees it: get / set only, values copied through JSON the way a real remote cache copies them,
// owned by the TEST (not by any service instance), so two services built from it share exactly what a real regional cache would.
function createSharedStore({ failGet = false, failSet = false } = {}) {
  const entries = new Map();

  return {
    entries,
    failGet,
    failSet,
    get: vi.fn(async function get(key) {
      if (this.failGet) throw new Error("cache unavailable");
      return entries.has(key) ? JSON.parse(entries.get(key).value) : undefined;
    }),
    set: vi.fn(async function set(key, value, options) {
      if (this.failSet) throw new Error("cache unavailable");
      entries.set(key, { value: JSON.stringify(value), ttl: options?.ttl });
    }),
  };
}

// Binding: the service calls cache.get(...) as a method, so `this` is the store.
const bind = (store) => ({ get: (key) => store.get(key), set: (key, value, options) => store.set(key, value, options) });

const POINTS = Array.from({ length: 24 }, (_, index) => ({
  time: new Date(utc(7) + index * HOUR).toISOString(),
  temperatureC: 20 + (index % 6),
  precipitationMm: index === 2 ? 0.4 : 0,
  condition: index === 2 ? "rain" : "clear",
}));

const okResult = ({ expires = null, lastModified = "Wed, 04 Nov 2026 07:45:18 GMT", points = POINTS } = {}) => ({ kind: "ok", status: 200, points, expires, lastModified });
const notModified = ({ expires = null, lastModified = "Wed, 04 Nov 2026 07:45:18 GMT" } = {}) => ({ kind: "not_modified", status: 304, expires, lastModified });
const failure = (reason, status = 500, retryAfterMs = null) => ({ kind: "error", status, reason, retryAfterMs });

function setup({ store = createSharedStore(), at = utc(8, 23), responses = [] } = {}) {
  const clock = { now: at };
  const queue = [...responses];
  const requestForecast = vi.fn(async () => {
    if (queue.length === 0) throw new Error("unexpected provider call");
    return queue.shift();
  });
  const make = () => createWeatherService({ cache: bind(store), requestForecast, now: () => clock.now });

  return { store, clock, requestForecast, make, service: make(), queue };
}

describe("computeRefreshAfter: max(fetched + 60 minutes, provider Expires), never rounded to a clock hour", () => {
  it("the application minimum when the provider's Expires is sooner (fetch 14:23, Expires 14:50 -> 15:23)", () => {
    expect(computeRefreshAfter({ fetchedAt: utc(14, 23), providerExpires: utc(14, 50) })).toBe(utc(15, 23));
  });

  it("the provider's Expires when it is later (fetch 14:23, Expires 16:00 -> 16:00)", () => {
    expect(computeRefreshAfter({ fetchedAt: utc(14, 23), providerExpires: utc(16, 0) })).toBe(utc(16, 0));
  });

  it("the minimum when there is no Expires", () => {
    expect(computeRefreshAfter({ fetchedAt: utc(14, 23), providerExpires: null })).toBe(utc(15, 23));
  });

  it("is exactly an hour, with no rounding", () => {
    expect(WEATHER_MIN_REFRESH_MS).toBe(HOUR);
    expect(computeRefreshAfter({ fetchedAt: utc(14, 23, 4) + 17000, providerExpires: null }) - (utc(14, 23) + 17000)).toBe(HOUR);
  });
});

describe("lazy refresh: the timelines", () => {
  it("nobody asks -> the provider is never called (there is no schedule to call it)", () => {
    const { requestForecast, store } = setup();

    expect(requestForecast).not.toHaveBeenCalled();
    expect(store.get).not.toHaveBeenCalled();
    expect(store.set).not.toHaveBeenCalled();
  });

  it("a cold cache: the first request refreshes once, stores the snapshot, and answers", async () => {
    const { service, requestForecast, store, clock } = setup({ responses: [okResult({ expires: utc(8, 50) })] });

    const weather = await service.getWeather();

    expect(requestForecast).toHaveBeenCalledTimes(1);
    expect(requestForecast).toHaveBeenCalledWith({ ifModifiedSince: null }); // nothing to compare with yet
    expect(store.set).toHaveBeenCalledTimes(1);
    expect(weather).toMatchObject({ available: true, stale: false, fetchedAt: new Date(clock.now).toISOString() });
    expect(JSON.parse(store.entries.get("monterrey:v1").value)).toMatchObject({
      version: 1,
      fetchedAt: utc(8, 23),
      providerExpires: utc(8, 50),
      lastModified: "Wed, 04 Nov 2026 07:45:18 GMT",
      refreshAfter: utc(9, 23),
      retryAfter: null,
    });
  });

  it("repeated visitors inside the window reuse the snapshot: zero provider calls", async () => {
    const { service, requestForecast, clock } = setup({ responses: [okResult()] });

    await service.getWeather();
    for (const minutes of [1, 5, 20, 40, 59]) {
      clock.now = utc(8, 23) + minutes * MIN;
      expect(await service.getWeather()).toMatchObject({ available: true, stale: false });
    }

    expect(requestForecast).toHaveBeenCalledTimes(1);
  });

  it("not even at 59 minutes 59 seconds; at exactly 60 minutes the snapshot is due", async () => {
    const { service, requestForecast, clock } = setup({ responses: [okResult(), notModified()] });

    await service.getWeather();
    clock.now = utc(8, 23) + HOUR - 1000;
    await service.getWeather();
    expect(requestForecast).toHaveBeenCalledTimes(1);

    clock.now = utc(8, 23) + HOUR;
    await service.getWeather();
    expect(requestForecast).toHaveBeenCalledTimes(2);
  });

  it("a provider Expires later than an hour keeps the snapshot for longer (Expires 16:00, fetched 14:23)", async () => {
    const { service, requestForecast, clock } = setup({ at: utc(14, 23), responses: [okResult({ expires: utc(16, 0) }), notModified({ expires: utc(17, 0) })] });

    await service.getWeather();
    for (const [hour, minute] of [[15, 23], [15, 59], [15, 59]]) {
      clock.now = utc(hour, minute);
      await service.getWeather();
    }
    expect(requestForecast).toHaveBeenCalledTimes(1); // past 15:23, but the provider said not before 16:00

    clock.now = utc(16, 0);
    await service.getWeather();
    expect(requestForecast).toHaveBeenCalledTimes(2);
  });

  it("an Expires that is sooner than the application minimum does not shorten it (Expires 14:50, fetched 14:23)", async () => {
    const { service, requestForecast, clock } = setup({ at: utc(14, 23), responses: [okResult({ expires: utc(14, 50) }), notModified()] });

    await service.getWeather();
    clock.now = utc(14, 51);
    await service.getWeather();
    clock.now = utc(15, 22);
    await service.getWeather();
    expect(requestForecast).toHaveBeenCalledTimes(1);

    clock.now = utc(15, 23);
    await service.getWeather();
    expect(requestForecast).toHaveBeenCalledTimes(2);
  });

  it("a day with no Suggestions usage costs nothing: one visit after it makes exactly one request", async () => {
    const tomorrow = POINTS.map((point) => ({ ...point, time: new Date(Date.parse(point.time) + 24 * HOUR).toISOString() }));
    const { service, requestForecast, clock } = setup({ responses: [okResult(), okResult({ points: tomorrow })] });

    await service.getWeather();
    clock.now = utc(8, 23) + 24 * HOUR;

    const weather = await service.getWeather();

    expect(requestForecast).toHaveBeenCalledTimes(2); // the first visit, and the first visit a day later
    expect(weather.available).toBe(true);
  });
});

describe("conditional refresh", () => {
  it("sends the EXACT previous Last-Modified as If-Modified-Since on a due refresh", async () => {
    const lastModified = "Wed, 04 Nov 2026 07:45:18 GMT";
    const { service, requestForecast, clock } = setup({ responses: [okResult({ lastModified }), notModified({ lastModified })] });

    await service.getWeather();
    clock.now += HOUR;
    await service.getWeather();

    expect(requestForecast.mock.calls[0][0]).toEqual({ ifModifiedSince: null });
    expect(requestForecast.mock.calls[1][0]).toEqual({ ifModifiedSince: lastModified });
  });

  it("sends no If-Modified-Since when the provider never gave a Last-Modified", async () => {
    const { service, requestForecast, clock } = setup({ responses: [okResult({ lastModified: null }), okResult({ lastModified: null })] });

    await service.getWeather();
    clock.now += HOUR;
    await service.getWeather();

    expect(requestForecast.mock.calls[1][0]).toEqual({ ifModifiedSince: null });
  });

  it("200 replaces the stored points and every timing field", async () => {
    const second = POINTS.map((point) => ({ ...point, temperatureC: 5 }));
    const { service, store, clock } = setup({ responses: [okResult(), okResult({ points: second, expires: utc(11, 0), lastModified: "Wed, 04 Nov 2026 09:00:00 GMT" })] });

    await service.getWeather();
    clock.now = utc(9, 24);
    const weather = await service.getWeather();
    const stored = JSON.parse(store.entries.get("monterrey:v1").value);

    expect(weather.temperatureC).toBe(5);
    expect(stored.points).toEqual(second);
    expect(stored).toMatchObject({ fetchedAt: utc(9, 24), providerExpires: utc(11, 0), refreshAfter: utc(11, 0), lastModified: "Wed, 04 Nov 2026 09:00:00 GMT" });
  });

  it("304 is NOT a failure: it keeps the stored points and moves the timing from the response's own headers", async () => {
    const { service, store, clock } = setup({ responses: [okResult(), notModified({ expires: utc(10, 40), lastModified: "Wed, 04 Nov 2026 07:45:18 GMT" })] });

    await service.getWeather();
    const before = JSON.parse(store.entries.get("monterrey:v1").value);
    clock.now = utc(9, 30);
    const weather = await service.getWeather();
    const after = JSON.parse(store.entries.get("monterrey:v1").value);

    expect(weather).toMatchObject({ available: true, stale: false });
    expect(after.points).toEqual(before.points);
    expect(after).toMatchObject({ fetchedAt: utc(9, 30), providerExpires: utc(10, 40), refreshAfter: utc(10, 40), retryAfter: null });
  });

  it("304 without an Expires falls back to the application minimum", async () => {
    const { service, store, clock } = setup({ responses: [okResult(), notModified({ expires: null })] });

    await service.getWeather();
    clock.now = utc(9, 30);
    await service.getWeather();

    expect(JSON.parse(store.entries.get("monterrey:v1").value).refreshAfter).toBe(utc(10, 30));
  });
});

describe("failure: weather is an enhancement, never a dependency", () => {
  const stored = async (responses, failWith) => {
    const ctx = setup({ responses: [okResult(), failWith, ...responses] });

    await ctx.service.getWeather();

    return ctx;
  };

  it.each([
    ["403", failure("forbidden", 403)],
    ["429", failure("rate_limited", 429)],
    ["500", failure("server_error", 500)],
    ["503", failure("server_error", 503)],
    ["a timeout", failure("network", null)],
    ["a bad body", failure("invalid_body", 200)],
  ])("%s on a due refresh serves the old snapshot as STALE, with no throw", async (_label, result) => {
    const { service, clock } = await stored([], result);

    clock.now = utc(9, 30);

    expect(await service.getWeather()).toMatchObject({ available: true, stale: true, temperatureC: expect.any(Number) });
  });

  it("serves a snapshot up to six hours after it was fetched, and no longer", async () => {
    const ctx = setup({ responses: [okResult({ points: POINTS }), failure("server_error"), failure("server_error"), failure("server_error")] });

    await ctx.service.getWeather(); // fetched 08:23

    ctx.clock.now = utc(8, 23) + WEATHER_MAX_STALE_MS;
    expect(await ctx.service.getWeather()).toMatchObject({ available: true, stale: true });

    ctx.clock.now = utc(8, 23) + WEATHER_MAX_STALE_MS + 1;
    expect(await ctx.service.getWeather()).toEqual({ available: false });
  });

  it("with nothing stored, a failed first refresh is simply 'unavailable' (and Today falls back to season + time + day)", async () => {
    const { service } = setup({ responses: [failure("server_error")] });

    expect(await service.getWeather()).toEqual({ available: false });
  });

  it("backs off after a failure, so an outage is not hammered: no provider call until retryAfter", async () => {
    const { service, requestForecast, clock } = await stored([notModified()], failure("server_error"));

    clock.now = utc(9, 30); // due; the refresh fails and sets a five-minute back-off
    await service.getWeather();
    expect(requestForecast).toHaveBeenCalledTimes(2);

    for (const minutes of [1, 2, 4]) {
      clock.now = utc(9, 30) + minutes * MIN;
      expect(await service.getWeather()).toMatchObject({ stale: true });
    }
    expect(requestForecast).toHaveBeenCalledTimes(2);

    clock.now = utc(9, 30) + 5 * MIN;
    await service.getWeather();
    expect(requestForecast).toHaveBeenCalledTimes(3);
  });

  it("backs off longer for 429 (at least fifteen minutes, or the provider's Retry-After) and for 403 (an hour)", async () => {
    const rateLimited = await stored([], failure("rate_limited", 429));

    rateLimited.clock.now = utc(9, 30);
    await rateLimited.service.getWeather();
    expect(JSON.parse(rateLimited.store.entries.get("monterrey:v1").value).retryAfter).toBe(utc(9, 30) + 15 * MIN);

    const slowDown = await stored([], failure("rate_limited", 429, 40 * MIN));

    slowDown.clock.now = utc(9, 30);
    await slowDown.service.getWeather();
    expect(JSON.parse(slowDown.store.entries.get("monterrey:v1").value).retryAfter).toBe(utc(9, 30) + 40 * MIN);

    const forbidden = await stored([], failure("forbidden", 403));

    forbidden.clock.now = utc(9, 30);
    await forbidden.service.getWeather();
    expect(JSON.parse(forbidden.store.entries.get("monterrey:v1").value).retryAfter).toBe(utc(9, 30) + HOUR);
  });

  it("an outage with nothing stored is also backed off (visitors do not each re-call a failing provider)", async () => {
    const { service, requestForecast, clock } = setup({ responses: [failure("server_error"), okResult()] });

    await service.getWeather();
    clock.now += MIN;
    await service.getWeather();
    clock.now += MIN;
    await service.getWeather();
    expect(requestForecast).toHaveBeenCalledTimes(1);

    clock.now += 5 * MIN;
    expect(await service.getWeather()).toMatchObject({ available: true, stale: false });
    expect(requestForecast).toHaveBeenCalledTimes(2);
  });

  it("a failed refresh keeps the old points and the old Last-Modified, and does not move refreshAfter", async () => {
    const { service, store, clock } = await stored([], failure("server_error"));
    const before = JSON.parse(store.entries.get("monterrey:v1").value);

    clock.now = utc(9, 30);
    await service.getWeather();
    const after = JSON.parse(store.entries.get("monterrey:v1").value);

    expect(after.points).toEqual(before.points);
    expect(after.lastModified).toBe(before.lastModified);
    expect(after.refreshAfter).toBe(before.refreshAfter);
    expect(after.fetchedAt).toBe(before.fetchedAt);
    expect(after.retryAfter).toBe(utc(9, 35));
  });

  it("recovers: the next allowed refresh after a failure replaces the stale snapshot", async () => {
    const { service, clock } = await stored([okResult({ points: POINTS.map((p) => ({ ...p, temperatureC: 9 })) })], failure("server_error"));

    clock.now = utc(9, 30);
    await service.getWeather();
    clock.now = utc(9, 36);

    expect(await service.getWeather()).toMatchObject({ stale: false, temperatureC: 9 });
  });

  it("an unreadable stored value is treated as an empty cache, not an error", async () => {
    const store = createSharedStore();

    store.entries.set("monterrey:v1", { value: JSON.stringify({ version: 99, junk: true }) });

    const { service, requestForecast } = setup({ store, responses: [okResult()] });

    expect(await service.getWeather()).toMatchObject({ available: true });
    expect(requestForecast).toHaveBeenCalledTimes(1);
  });
});

describe("the shared cache is the cache, not this process", () => {
  it("separate service instances (separate 'Function instances') share one snapshot through the store: the second makes NO provider call", async () => {
    const store = createSharedStore();
    const first = setup({ store, responses: [okResult()] });

    await first.service.getWeather();

    const second = setup({ store, responses: [] }); // a fresh instance: no memory of the first, a queue that rejects any provider call

    expect(await second.service.getWeather()).toMatchObject({ available: true, stale: false });
    expect(second.requestForecast).not.toHaveBeenCalled();
  });

  it("an instance never trusts its own memory over the store: when the store has lost the entry it refreshes", async () => {
    const { service, store, requestForecast } = setup({ responses: [okResult(), okResult()] });

    await service.getWeather();
    store.entries.clear(); // evicted
    await service.getWeather();

    expect(requestForecast).toHaveBeenCalledTimes(2);
  });

  it("another instance's refresh is seen immediately: instance B reads what instance A wrote", async () => {
    const store = createSharedStore();
    const a = setup({ store, at: utc(8, 23), responses: [okResult()] });
    const b = setup({ store, at: utc(10, 0), responses: [okResult({ points: POINTS.map((p) => ({ ...p, temperatureC: 3 })) })] });

    await a.service.getWeather(); // A: 08:23
    expect((await b.service.getWeather()).temperatureC).toBe(3); // B: 10:00, due, refreshes and writes

    const c = setup({ store, at: utc(10, 5), responses: [] });

    expect((await c.service.getWeather()).temperatureC).toBe(3); // C reuses B's write
    expect(c.requestForecast).not.toHaveBeenCalled();
  });

  it("uses its own last-seen snapshot ONLY when the shared cache throws, rather than calling the provider on every request", async () => {
    const { service, store, requestForecast, clock } = setup({ responses: [okResult()] });

    await service.getWeather();
    store.failGet = true;
    clock.now += 5 * MIN;

    expect(await service.getWeather()).toMatchObject({ available: true, stale: false });
    expect(requestForecast).toHaveBeenCalledTimes(1);
  });

  it("a cache that cannot be written does not break the answer", async () => {
    const store = createSharedStore({ failSet: true });
    const { service } = setup({ store, responses: [okResult()] });

    expect(await service.getWeather()).toMatchObject({ available: true });
  });

  it("stores the entry with a TTL of seven hours (six it may be served, plus one), and a failure-only record with just its back-off", async () => {
    expect(WEATHER_ENTRY_TTL_SECONDS).toBe(7 * 3600);

    const ok = setup({ responses: [okResult()] });

    await ok.service.getWeather();
    expect(ok.store.set.mock.calls[0][2].ttl).toBe(WEATHER_ENTRY_TTL_SECONDS);

    const down = setup({ responses: [failure("server_error")] });

    await down.service.getWeather();
    expect(down.store.set.mock.calls[0][2].ttl).toBe(300);
  });

  it("keeps no module-level cache: the module has no top-level mutable state, only per-service closures", () => {
    const source = readFileSync(fileURLToPath(new URL("./weatherSnapshot.js", import.meta.url)), "utf8").replace(/^\s*\/\/.*$/gm, "");
    const topLevel = source.split("\nexport function createWeatherService")[0];

    expect(topLevel).not.toMatch(/\blet\s+\w+\s*=|new Map|new Set|\{\s*\}\s*;?\s*$/m);
  });
});

describe("concurrency: what is and is NOT guaranteed", () => {
  it("20 simultaneous requests on ONE instance share one provider call (a per-instance optimisation)", async () => {
    let release;
    const gate = new Promise((resolve) => {
      release = resolve;
    });
    const store = createSharedStore();
    const requestForecast = vi.fn(async () => {
      await gate;
      return okResult();
    });
    const service = createWeatherService({ cache: bind(store), requestForecast, now: () => utc(8, 23) });
    const calls = Array.from({ length: 20 }, () => service.getWeather());

    await Promise.resolve();
    release();
    const answers = await Promise.all(calls);

    expect(requestForecast).toHaveBeenCalledTimes(1);
    expect(answers.every((answer) => answer.available)).toBe(true);
  });

  it("separate instances racing on an expired snapshot each refresh: there is NO global single-flight, and the worst case is one call per concurrently warm instance", async () => {
    let release;
    const gate = new Promise((resolve) => {
      release = resolve;
    });
    const store = createSharedStore();
    const requestForecast = vi.fn(async () => {
      await gate;
      return okResult();
    });
    const instances = Array.from({ length: 3 }, () => createWeatherService({ cache: bind(store), requestForecast, now: () => utc(8, 23) }));
    const calls = instances.flatMap((instance) => Array.from({ length: 7 }, () => instance.getWeather())); // 21 requests over 3 instances

    await new Promise((resolve) => setTimeout(resolve, 0));
    release();
    await Promise.all(calls);

    expect(requestForecast).toHaveBeenCalledTimes(3); // not 21, and honestly not 1
  });

  it("once any instance has written, later requests on any instance make no call", async () => {
    const store = createSharedStore();
    const first = setup({ store, responses: [okResult()] });

    await first.service.getWeather();

    for (let index = 0; index < 5; index++) {
      const later = setup({ store, responses: [] });

      await later.service.getWeather();
      expect(later.requestForecast).not.toHaveBeenCalled();
    }
  });
});

describe("what a request reads from the snapshot", () => {
  it("picks the hour it is actually in, from the same stored points", async () => {
    const { service, clock } = setup({ at: utc(7, 10), responses: [okResult({ expires: utc(15, 0) })] });

    expect((await service.getWeather()).temperatureC).toBe(20); // 07:00
    clock.now = utc(8, 30);
    expect((await service.getWeather()).temperatureC).toBe(21); // 08:00
    clock.now = utc(9, 59);
    expect(await service.getWeather()).toMatchObject({ temperatureC: 22, condition: "rain", precipitationMm: 0.4 }); // 09:00
  });

  it("answers with only the normalised fields, and omits a precipitation that is unknown", async () => {
    const points = POINTS.map((point) => ({ ...point, precipitationMm: null }));
    const { service } = setup({ at: utc(7, 10), responses: [okResult({ points })] });
    const weather = await service.getWeather();

    expect(Object.keys(weather).sort()).toEqual(["available", "condition", "fetchedAt", "stale", "temperatureC", "validAt"]);
    expect(weather).not.toHaveProperty("apparentTemperatureC");
    expect(weather.validAt).toBe("2026-11-04T07:00:00.000Z");
  });

  it("reports unavailable when the stored series has run out", async () => {
    const short = POINTS.slice(0, 2);
    const { service, clock } = setup({ at: utc(7, 10), responses: [okResult({ points: short, expires: utc(20, 0) })] });

    await service.getWeather();
    clock.now = utc(9, 30);

    expect(await service.getWeather()).toEqual({ available: false });
  });
});
