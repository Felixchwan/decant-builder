// Aurelian's translation of a weather answer into what the Builder understands, and into the one line the drawer shows.
//
// The shared Builder knows a generic vocabulary (a temperature bucket and a weather condition) and nothing about where either came
// from; this host-owned file does the converting. The bucket edges are the Builder's published ones (hot >= 32 C, warm 26-31.9,
// mild 19-25.9, cool 12-18.9, cold < 12); a test keeps the two in step.

export const WEATHER_ATTRIBUTION = Object.freeze({
  // The provider's licence asks for credit to MET Norway as the source of the data; this line says the context is built from it
  // (the temperature, rain and the buckets are derived, not the provider's own forecast text).
  text: "Clima: basado en datos de MET Norway",
  href: "https://api.met.no/",
});

export function bucketTemperatureC(celsius) {
  if (typeof celsius !== "number" || !Number.isFinite(celsius)) return null;
  if (celsius >= 32) return "hot";
  if (celsius >= 26) return "warm";
  if (celsius >= 19) return "mild";
  if (celsius >= 12) return "cool";
  return "cold";
}

// The generic context fields a usable weather answer supplies. "other" (fog, snow, sleet...) is not a condition the Builder scores,
// so it is left out rather than passed on.
export function weatherToContextFields(weather) {
  if (!weather?.available) return {};

  const temperatureBucket = bucketTemperatureC(weather.temperatureC);

  return {
    ...(temperatureBucket ? { temperatureBucket } : {}),
    ...(["clear", "cloudy", "rain"].includes(weather.condition) ? { weatherCondition: weather.condition } : {}),
  };
}

// "Noche fresca", "Día caluroso": the part of the day with the temperature's adjective, agreeing in gender (Día is masculine).
const ADJECTIVES = Object.freeze({
  hot: { feminine: "calurosa", masculine: "caluroso" },
  warm: { feminine: "cálida", masculine: "cálido" },
  mild: { feminine: "templada", masculine: "templado" },
  cool: { feminine: "fresca", masculine: "fresco" },
  cold: { feminine: "fría", masculine: "frío" },
});

export function describePartOfDay({ partLabel, temperatureBucket }) {
  const adjective = ADJECTIVES[temperatureBucket];

  if (!adjective) return partLabel;

  return `${partLabel} ${partLabel === "Día" ? adjective.masculine : adjective.feminine}`;
}
