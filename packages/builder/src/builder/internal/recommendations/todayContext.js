// The context "Para hoy" ranks against, derived from values a host has already worked out. Merchant-neutral: it knows no
// city, time zone, language or data provider. A host decides WHERE and WHEN (its own local hour and weekday, its own
// calendar-to-season mapping); this module only turns those into the buckets the scoring uses.
//
//   season    "spring" | "summer" | "fall" | "winter"   -- the catalog's own season keys
//   hour      0..23, the host's local hour
//   weekday   0..6, Sunday = 0 (the host's local weekday)
//
// Two optional, forward-looking fields are accepted and validated but NOT scored today:
//
//   temperatureBucket   "hot" | "warm" | "mild" | "cool" | "cold"
//   weatherCondition    "clear" | "cloudy" | "rain"
//
// They exist so live conditions can be added later by a host without reshaping this contract or the scoring: a factor
// is only ever scored when the input it needs is present, and until a host supplies these there is nothing to score.
// Nothing here estimates, defaults or infers either one.

export const TODAY_SEASONS = Object.freeze(["spring", "summer", "fall", "winter"]);
export const TODAY_TIME_BUCKETS = Object.freeze(["morning", "daytime", "evening", "night"]);
export const TODAY_DAY_CONTEXTS = Object.freeze(["social_night", "workday_daytime", "weekend_daytime"]);
export const TEMPERATURE_BUCKETS = Object.freeze(["hot", "warm", "mild", "cool", "cold"]);
export const WEATHER_CONDITIONS = Object.freeze(["clear", "cloudy", "rain"]);

// morning 05-10, daytime 11-16, evening 17-20, night 21-04.
export function bucketHour(hour) {
  if (hour >= 5 && hour < 11) return "morning";
  if (hour >= 11 && hour < 17) return "daytime";
  if (hour >= 17 && hour < 21) return "evening";
  return "night";
}

// Degrees Celsius to a bucket: hot >= 32, warm 26-31.9, mild 19-25.9, cool 12-18.9, cold < 12. Returns null for anything
// that is not a finite number, so a missing reading can never become a bucket.
export function bucketTemperature(celsius) {
  if (typeof celsius !== "number" || !Number.isFinite(celsius)) return null;
  if (celsius >= 32) return "hot";
  if (celsius >= 26) return "warm";
  if (celsius >= 19) return "mild";
  if (celsius >= 12) return "cool";
  return "cold";
}

// What kind of day-part this is, when it is a distinctive one; null when it is just an ordinary stretch of time, in which
// case "day context" is simply not available and nothing may be said about it.
//
//   social_night      Friday or Saturday from 18:00, and Saturday or Sunday before 05:00 (the same two nights)
//   workday_daytime   Monday to Friday, morning or daytime
//   weekend_daytime   Saturday or Sunday outside a social night and before 21:00
//
// A weekday evening or night, the small hours of a Monday to Friday, and a Sunday night are ordinary: null.
export function deriveDayContext({ weekday, hour }) {
  const isSocialNight = ((weekday === 5 || weekday === 6) && hour >= 18) || ((weekday === 6 || weekday === 0) && hour < 5);

  if (isSocialNight) return "social_night";

  const time = bucketHour(hour);

  if (weekday >= 1 && weekday <= 5 && (time === "morning" || time === "daytime")) return "workday_daytime";
  if ((weekday === 6 || weekday === 0) && time !== "night") return "weekend_daytime";

  return null;
}

// null when the host's values are not usable, so scoring never runs on a guess.
export function deriveTodayContext(input) {
  const { season, hour, weekday, temperatureBucket, weatherCondition } = input ?? {};

  if (
    !TODAY_SEASONS.includes(season) ||
    !Number.isInteger(hour) ||
    hour < 0 ||
    hour > 23 ||
    !Number.isInteger(weekday) ||
    weekday < 0 ||
    weekday > 6
  ) {
    return null;
  }

  return Object.freeze({
    season,
    hour,
    weekday,
    time: bucketHour(hour),
    dayContext: deriveDayContext({ weekday, hour }),
    ...(TEMPERATURE_BUCKETS.includes(temperatureBucket) ? { temperatureBucket } : {}),
    ...(WEATHER_CONDITIONS.includes(weatherCondition) ? { weatherCondition } : {}),
  });
}
