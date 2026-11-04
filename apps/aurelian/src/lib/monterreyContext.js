// Aurelian's "now", for the Suggestions drawer's "Para hoy": Monterrey's own clock and calendar, never the visitor's device.
//
// Host-owned on purpose. The shared Builder scores a context it is handed (a season, an hour, a weekday) and knows no city,
// time zone or language; deciding WHERE the moment is read, how months map to seasons and how the moment is worded in
// Spanish are this storefront's choices. Read when the drawer opens, never on a timer, and no request is made: the time
// zone comes from the browser's built-in Intl data.
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

// What the Builder's `getTodayContext` expects: the moment (season, hour, weekday) plus the line the drawer shows under its
// title, for example "Monterrey · Noche de otoño". No degrees and no weather: none is known.
export function getMonterreyTodayContext(date = new Date()) {
  const { month, hour, weekday } = getMonterreyClock(date);
  const season = SEASON_BY_MONTH[month];

  return {
    season,
    hour,
    weekday,
    label: `Monterrey · ${PART_OF_DAY_LABELS[getPartOfDay(hour)]} de ${SEASON_LABELS[season]}`,
  };
}
