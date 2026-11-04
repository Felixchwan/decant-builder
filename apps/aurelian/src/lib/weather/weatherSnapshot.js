import { selectCurrentPoint } from "./metNorway.js";

// Aurelian's Monterrey weather snapshot: a LAZY, SHARED cache over the provider adapter. Nothing here runs on a schedule and
// nothing here polls; a snapshot is refreshed only when somebody asks for the weather and the stored one is due.
//
// THE CACHE IS NOT THIS PROCESS. `cache` is whatever shared key-value store the host passes in (in production, Vercel's Runtime
// Cache: one store per region, shared by every Function instance of the project). The only memory this module keeps itself is
// (a) one in-flight refresh Promise, so concurrent requests inside ONE instance share one upstream call, and (b) the last snapshot
// it saw, used only if the shared cache THROWS. Neither is authoritative: after a cold start, or on another instance, both are empty
// and the shared cache decides.
//
// What is stored, under one key:
//   {
//     version, points,            the hourly points kept from the last good response (normalised; see metNorway.js)
//     fetchedAt,                  when the last SUCCESSFUL provider response was received (200 or 304), ms
//     providerExpires,            the provider's Expires for that response, ms | null
//     lastModified,               the provider's Last-Modified, verbatim | null (sent back unchanged as If-Modified-Since)
//     refreshAfter,               max(fetchedAt + 60 minutes, providerExpires): the earliest the provider may be asked again
//     retryAfter,                 ms | null: set after a FAILED refresh, so an outage is not hammered
//   }
// Keeping the hourly points (not one reading) lets every request pick the hour it is actually in, even from an older snapshot.
//
// Rules:
//   - Never ask the provider before `refreshAfter`; never ask it more than once an hour; refreshes are not rounded to clock hours.
//   - A refresh with a stored Last-Modified is conditional. 200 replaces the points; 304 keeps them and only moves the timing.
//   - A refresh that fails (403, 429, 5xx, timeout, bad body) keeps the old points, sets `retryAfter`, and serves the snapshot as
//     STALE for up to six hours after it was fetched; past that, or with nothing stored, the weather is simply unavailable.
//
// CONCURRENCY. The shared cache has no compare-and-set and no request coalescing, so this is NOT single-flight across instances:
// when a snapshot expires and N requests arrive together, requests landing on the same instance share one provider call, and
// instances that read the expired snapshot before the first write is visible each make their own. The practical worst case is
// one provider call per concurrently-warm instance per expiry, not one per request, and never more than once per instance per
// expiry. Strict single-flight would need a distributed lock, which is deliberately not added for this.

export const WEATHER_SNAPSHOT_VERSION = 1;
export const WEATHER_MIN_REFRESH_MS = 60 * 60 * 1000;
export const WEATHER_MAX_STALE_MS = 6 * 60 * 60 * 1000;
export const WEATHER_RETRY_BACKOFF_MS = Object.freeze({
  default: 5 * 60 * 1000,
  rate_limited: 15 * 60 * 1000,
  forbidden: 60 * 60 * 1000,
});
// A stored entry outlives the six hours it may be served for by an hour, then the store may drop it.
export const WEATHER_ENTRY_TTL_SECONDS = Math.ceil((WEATHER_MAX_STALE_MS + WEATHER_MIN_REFRESH_MS) / 1000);

export function computeRefreshAfter({ fetchedAt, providerExpires }) {
  return Math.max(fetchedAt + WEATHER_MIN_REFRESH_MS, providerExpires ?? 0);
}

function isTimestamp(value) {
  return typeof value === "number" && Number.isFinite(value);
}

function readSnapshot(value) {
  if (!value || typeof value !== "object" || value.version !== WEATHER_SNAPSHOT_VERSION) return null;

  const hasPoints = Array.isArray(value.points) && value.points.length > 0;

  if (!isTimestamp(value.fetchedAt) || !isTimestamp(value.refreshAfter)) return null;
  if (value.retryAfter !== null && value.retryAfter !== undefined && !isTimestamp(value.retryAfter)) return null;

  return {
    version: WEATHER_SNAPSHOT_VERSION,
    points: hasPoints ? value.points : null,
    fetchedAt: value.fetchedAt,
    providerExpires: isTimestamp(value.providerExpires) ? value.providerExpires : null,
    lastModified: typeof value.lastModified === "string" && value.lastModified ? value.lastModified : null,
    refreshAfter: value.refreshAfter,
    retryAfter: isTimestamp(value.retryAfter) ? value.retryAfter : null,
  };
}

const NOTHING_STORED = Object.freeze({
  version: WEATHER_SNAPSHOT_VERSION,
  points: null,
  fetchedAt: 0,
  providerExpires: null,
  lastModified: null,
  refreshAfter: 0,
  retryAfter: null,
});

export function createWeatherService({ cache, requestForecast, now = Date.now, cacheKey = "monterrey:v1" }) {
  let inFlight = null;
  let lastSeen = null;

  async function load() {
    try {
      const snapshot = readSnapshot(await cache.get(cacheKey));

      lastSeen = snapshot;

      return snapshot;
    } catch {
      // the shared cache is unreachable: the last snapshot this instance saw beats asking the provider on every request
      return lastSeen;
    }
  }

  async function save(snapshot, ttlSeconds) {
    lastSeen = snapshot;

    try {
      await cache.set(cacheKey, snapshot, { ttl: ttlSeconds, name: "aurelian-weather-monterrey" });
    } catch {
      // a cache that cannot be written only costs a later refresh
    }
  }

  function present(snapshot, stale, atMs) {
    if (!snapshot?.points || atMs - snapshot.fetchedAt > WEATHER_MAX_STALE_MS) {
      return { available: false };
    }

    const point = selectCurrentPoint(snapshot.points, atMs);

    if (!point) {
      return { available: false };
    }

    return {
      available: true,
      temperatureC: point.temperatureC,
      ...(point.precipitationMm === null ? {} : { precipitationMm: point.precipitationMm }),
      condition: point.condition,
      validAt: point.time,
      fetchedAt: new Date(snapshot.fetchedAt).toISOString(),
      stale,
    };
  }

  async function refresh(previous) {
    const result = await requestForecast({ ifModifiedSince: previous?.points ? previous.lastModified : null });
    const at = now();

    if (result.kind === "ok") {
      const next = {
        version: WEATHER_SNAPSHOT_VERSION,
        points: result.points,
        fetchedAt: at,
        providerExpires: result.expires,
        lastModified: result.lastModified,
        refreshAfter: computeRefreshAfter({ fetchedAt: at, providerExpires: result.expires }),
        retryAfter: null,
      };

      await save(next, WEATHER_ENTRY_TTL_SECONDS);

      return next;
    }

    if (result.kind === "not_modified" && previous?.points) {
      // Not a failure: the stored points are still the provider's answer. Only the timing moves, from THIS response's headers.
      const next = {
        ...previous,
        fetchedAt: at,
        providerExpires: result.expires,
        lastModified: result.lastModified ?? previous.lastModified,
        refreshAfter: computeRefreshAfter({ fetchedAt: at, providerExpires: result.expires }),
        retryAfter: null,
      };

      await save(next, WEATHER_ENTRY_TTL_SECONDS);

      return next;
    }

    const reason = result.kind === "error" ? result.reason : "unexpected_status";
    const backoff = Math.max(WEATHER_RETRY_BACKOFF_MS[reason] ?? WEATHER_RETRY_BACKOFF_MS.default, result.retryAfterMs ?? 0);
    const kept = previous ?? NOTHING_STORED;
    const remaining = previous?.points
      ? Math.ceil((previous.fetchedAt + WEATHER_MAX_STALE_MS + WEATHER_MIN_REFRESH_MS - at) / 1000)
      : Math.ceil(backoff / 1000);

    await save({ ...kept, retryAfter: at + backoff }, Math.max(60, remaining));

    return null;
  }

  // Concurrent callers on THIS instance share one refresh. (Not a lock across instances: see the header.)
  function refreshOnce(previous) {
    if (!inFlight) {
      inFlight = refresh(previous).finally(() => {
        inFlight = null;
      });
    }

    return inFlight;
  }

  // { available: false } | { available: true, temperatureC, precipitationMm?, condition, validAt, fetchedAt, stale }
  async function getWeather() {
    const snapshot = await load();
    const at = now();
    const isOverlyOld = snapshot?.points ? at - snapshot.fetchedAt > WEATHER_MAX_STALE_MS : false;
    const isDue = !snapshot?.points || isOverlyOld || at >= snapshot.refreshAfter;

    if (!isDue) {
      return present(snapshot, false, at);
    }

    const mayAsk = !snapshot?.retryAfter || at >= snapshot.retryAfter;

    if (!mayAsk) {
      return present(snapshot, true, at);
    }

    const refreshed = await refreshOnce(snapshot);

    return refreshed ? present(refreshed, false, now()) : present(snapshot, true, now());
  }

  return Object.freeze({ getWeather });
}
