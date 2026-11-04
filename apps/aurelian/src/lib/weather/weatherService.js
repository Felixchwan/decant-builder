import { getCache } from "@vercel/functions";
import { requestMetForecast } from "./metNorway.js";
import { MONTERREY_COORDINATES } from "./monterreyLocation.js";
import { createWeatherService } from "./weatherSnapshot.js";

// The production wiring of Aurelian's weather: the provider adapter and the snapshot service over Vercel's Runtime Cache.
//
// Runtime Cache is a per-region key-value store shared by every Function instance of this project (and scoped to the deployment
// environment, so preview and production never share an entry). On Vercel `getCache()` resolves the real store from the request
// context at call time; anywhere else (local development, `next start` elsewhere) the SDK falls back to a store inside the
// running process, which is correct for development and is NOT a shared cache. The service holds the wrapper, not any data.
let service = null;

export function getAurelianWeatherService() {
  service ??= createWeatherService({
    cache: getCache({ namespace: "aurelian-weather" }),
    requestForecast: ({ ifModifiedSince }) => requestMetForecast({ coordinates: MONTERREY_COORDINATES, ifModifiedSince }),
  });

  return service;
}

// The ONLY fields that ever leave the server: no provider payload, no timestamps of the cache, nothing else. Feels-like
// temperature is not here because the provider does not supply one.
export function toPublicWeather(weather) {
  if (!weather?.available) {
    return { available: false };
  }

  return {
    available: true,
    temperatureC: weather.temperatureC,
    ...(typeof weather.precipitationMm === "number" ? { precipitationMm: weather.precipitationMm } : {}),
    condition: weather.condition,
    validAt: weather.validAt,
    fetchedAt: weather.fetchedAt,
    stale: weather.stale === true,
  };
}
