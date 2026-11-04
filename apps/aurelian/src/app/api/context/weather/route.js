import { getAurelianWeatherService, toPublicWeather } from "../../../../lib/weather/weatherService.js";

// Aurelian's weather context: Monterrey's current conditions as a small normalised object, from a shared snapshot that is refreshed
// lazily (see lib/weather/weatherSnapshot.js). It is read on demand and never cached by the framework or the CDN: the shared snapshot
// is the one cache, so this must run per request.
export const dynamic = "force-dynamic";

export async function GET() {
  let weather;

  try {
    weather = await getAurelianWeatherService().getWeather();
  } catch {
    // weather is an enhancement: whatever went wrong, the answer is "not available", never an error
    weather = { available: false };
  }

  return Response.json(toPublicWeather(weather), { headers: { "Cache-Control": "no-store" } });
}
