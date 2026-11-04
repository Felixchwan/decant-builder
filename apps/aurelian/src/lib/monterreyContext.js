// Aurelian's "now", for the Suggestions drawer's "Para hoy": Monterrey's own clock and calendar, never the visitor's device.
//
// Host-owned on purpose. The shared Builder scores a context it is handed (a season, an hour, a weekday) and knows no city,
// time zone or language; deciding WHERE the moment is read, how months map to seasons and how the moment is worded in
// Spanish are this storefront's choices. Read when the drawer opens, never on a timer, and no request is made: the time
// zone comes from the browser's built-in Intl data.
import { loadWeatherContext } from "./weather/weatherContextClient.js";
import { WEATHER_ATTRIBUTION, describePartOfDay, weatherToContextFields } from "./weather/weatherContext.js";

export const MONTERREY_TIME_ZONE = "America/Monterrey";

// December-February winter, March-May spring, June-September summer, October-November fall.
export const SEASON_BY_MONTH = Object.freeze({
  1: "winter",
  2: "winter",
  3: "spring",
  4: "spring",
  5: "spring",
  6: "summer",
  7: "summer",
  8: "summer",
  9: "summer",
  10: "fall",
  11: "fall",
  12: "winter",
});

const WEEKDAYS = Object.freeze({ Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 });
const SEASON_LABELS = Object.freeze({ spring: "primavera", summer: "verano", fall: "otoño", winter: "invierno" });
// The same day-parts the Builder buckets by (morning 05-10, daytime 11-16, evening 17-20, night 21-04); a test keeps the two in step.
const PART_OF_DAY_LABELS = Object.freeze({ morning: "Mañana", daytime: "Día", evening: "Tarde", night: "Noche" });

const clockFormat = new Intl.DateTimeFormat("en-US", {
  timeZone: MONTERREY_TIME_ZONE,
  weekday: "short",
  month: "numeric",
  hour: "numeric",
  hourCycle: "h23",
});

// { month 1-12, hour 0-23, weekday 0-6 (Sunday = 0) } as read on a Monterrey wall clock.
export function getMonterreyClock(date = new Date()) {
  const parts = Object.fromEntries(clockFormat.formatToParts(date).map(({ type, value }) => [type, value]));

  return {
    month: Number(parts.month),
    hour: Number(parts.hour) % 24,
    weekday: WEEKDAYS[parts.weekday],
  };
}

export function getPartOfDay(hour) {
  if (hour >= 5 && hour < 11) return "morning";
  if (hour >= 11 && hour < 17) return "daytime";
  if (hour >= 17 && hour < 21) return "evening";
  return "night";
}

// What the Builder's context callbacks expect: the moment (season, hour, weekday) plus the line the drawer shows under its title.
//
//   without weather   "Monterrey · Noche de otoño"        (the moment alone: no degrees, nothing about the sky)
//   with weather      "Monterrey · 18 °C · Noche fresca"  (plus the generic temperatureBucket / weatherCondition the Builder scores,
//                                                          and the credit line the data's licence asks for)
//   with a STALE one  "Monterrey · Noche fresca"          (the bucket still describes the day, but an hours-old number is not shown)
//
// `weather` is an answer from loadWeatherContext (or null / unavailable).
export function getMonterreyTodayContext(date = new Date(), weather = null) {
  const { month, hour, weekday } = getMonterreyClock(date);
  const season = SEASON_BY_MONTH[month];
  const partLabel = PART_OF_DAY_LABELS[getPartOfDay(hour)];
  const live = weatherToContextFields(weather);

  if (!live.temperatureBucket && !live.weatherCondition) {
    return {
      season,
      hour,
      weekday,
      label: `Monterrey · ${partLabel} de ${SEASON_LABELS[season]}`,
    };
  }

  const described = describePartOfDay({ partLabel, temperatureBucket: live.temperatureBucket });
  const degrees = weather.stale || !live.temperatureBucket ? "" : ` · ${Math.round(weather.temperatureC)} °C`;

  return {
    season,
    hour,
    weekday,
    ...live,
    label: `Monterrey${degrees} · ${described}`,
    attribution: WEATHER_ATTRIBUTION,
  };
}

// The context WITH weather, for the drawer's background request: Monterrey's moment read now, plus the shared weather snapshot
// through Aurelian's own endpoint. Null when there is no weather (the drawer then keeps the moment-only context it already has).
export async function resolveMonterreyTodayContext() {
  const weather = await loadWeatherContext();

  return weather?.available ? getMonterreyTodayContext(new Date(), weather) : null;
}
