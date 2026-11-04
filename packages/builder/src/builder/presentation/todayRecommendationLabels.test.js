import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { fragrances } from "@discovery-box/catalog";
import { createTranslator } from "../../i18n/createTranslator.js";
import { enUS } from "../../i18n/locales/en-US.js";
import { esMX } from "../../i18n/locales/es-MX.js";
import { buildTodayRecommendations } from "../internal/recommendations/buildTodayRecommendations.js";
import { getTodayLeadLabel, getTodayReasonLabels } from "./todayRecommendationLabels.js";

const es = createTranslator("es-MX");
const en = createTranslator("en-US");
const labelsSource = readFileSync(new URL("./todayRecommendationLabels.js", import.meta.url), "utf8");

const reasonOf = (code, evidence) => ({ reasons: [{ code, evidence }] });

describe("lead line: restrained unless the evidence is full", () => {
  it.each([
    ["high", "morning", "Pensadas para esta mañana"],
    ["high", "daytime", "Pensadas para el día de hoy"],
    ["high", "evening", "Pensadas para esta tarde"],
    ["high", "night", "Pensadas para esta noche"],
    ["moderate", "morning", "Buenas opciones para esta mañana"],
    ["moderate", "daytime", "Buenas opciones para el día de hoy"],
    ["moderate", "evening", "Buenas opciones para esta tarde"],
    ["moderate", "night", "Buenas opciones para esta noche"],
  ])("%s confidence, %s -> %s", (confidence, time, text) => {
    expect(getTodayLeadLabel({ confidence, context: { time } }, es)).toBe(text);
  });

  it("anything that is not 'high' is framed as 'moderate', and a missing time yields no line", () => {
    expect(getTodayLeadLabel({ confidence: null, context: { time: "night" } }, es)).toBe("Buenas opciones para esta noche");
    expect(getTodayLeadLabel({ confidence: "high", context: {} }, es)).toBe("");
    expect(getTodayLeadLabel({}, es)).toBe("");
    expect(getTodayLeadLabel(undefined, es)).toBe("");
  });

  it("speaks English from the en-US dictionary", () => {
    expect(getTodayLeadLabel({ confidence: "high", context: { time: "night" } }, en)).toBe("Made for tonight");
    expect(getTodayLeadLabel({ confidence: "moderate", context: { time: "night" } }, en)).toBe("Good options for tonight");
  });
});

describe("reason lines say only what their evidence supports", () => {
  it("season: names the season the evidence names", () => {
    expect(getTodayReasonLabels(reasonOf("season", { season: "fall", weight: 9 }), es)).toEqual(["Encaja con el otoño"]);
    expect(getTodayReasonLabels(reasonOf("season", { season: "summer", weight: 10 }), es)).toEqual(["Encaja con el verano"]);
  });

  it("time of day: names the part of the day the evidence names", () => {
    expect(getTodayReasonLabels(reasonOf("timeOfDay", { time: "night" }), es)).toEqual(["Buena opción para la noche"]);
    expect(getTodayReasonLabels(reasonOf("timeOfDay", { time: "morning" }), es)).toEqual(["Cómoda para la mañana"]);
  });

  it("social night: 'date' only when the evidence has a date occasion, 'night out' only when it has night or club", () => {
    const social = (occasions) => getTodayReasonLabels(reasonOf("dayContext", { dayContext: "social_night", occasions }), es)[0];

    expect(social(["date", "night"])).toBe("Para una cita o una salida de noche de fin de semana");
    expect(social(["date", "club"])).toBe("Para una cita o una salida de noche de fin de semana");
    expect(social(["date"])).toBe("Buena para una cita de fin de semana");
    expect(social(["night"])).toBe("Buena para una salida de noche de fin de semana");
    expect(social(["club"])).toBe("Buena para una salida de noche de fin de semana");
    expect(social(["date"])).not.toMatch(/noche/);
    expect(social(["night"])).not.toMatch(/cita/);
  });

  it("workday and weekend lines are tied to their own evidence", () => {
    expect(getTodayReasonLabels(reasonOf("dayContext", { dayContext: "workday_daytime", occasions: ["office", "daily"] }), es)).toEqual(["Funciona bien para la oficina"]);
    expect(getTodayReasonLabels(reasonOf("dayContext", { dayContext: "workday_daytime", occasions: ["daily"] }), es)).toEqual(["Fácil de llevar entre semana"]);
    expect(getTodayReasonLabels(reasonOf("dayContext", { dayContext: "weekend_daytime", occasions: ["casual"] }), es)).toEqual(["Cómoda para un día de fin de semana"]);
  });

  it("a day-context reason whose evidence names nothing produces no line (never a guess)", () => {
    expect(getTodayReasonLabels(reasonOf("dayContext", { dayContext: "social_night", occasions: [] }), es)).toEqual(["Una opción razonable para este momento"]);
    expect(getTodayReasonLabels(reasonOf("dayContext", { dayContext: "weekend_daytime", occasions: [] }), es)).toEqual(["Una opción razonable para este momento"]);
    expect(getTodayReasonLabels(reasonOf("dayContext", { dayContext: "unknown", occasions: ["date"] }), es)).toEqual(["Una opción razonable para este momento"]);
  });

  it("shows at most two lines, in the order the scoring gave them", () => {
    const labels = getTodayReasonLabels(
      {
        reasons: [
          { code: "timeOfDay", evidence: { time: "night" } },
          { code: "dayContext", evidence: { dayContext: "social_night", occasions: ["date"] } },
          { code: "season", evidence: { season: "fall", weight: 9 } },
        ],
      },
      es
    );

    expect(labels).toEqual(["Buena opción para la noche", "Buena para una cita de fin de semana"]);
  });

  it("a pick with no reasons gets one plain, non-specific line rather than a claim", () => {
    expect(getTodayReasonLabels({ reasons: [] }, es)).toEqual(["Una opción razonable para este momento"]);
    expect(getTodayReasonLabels({}, es)).toEqual(["Una opción razonable para este momento"]);
    expect(getTodayReasonLabels({ reasons: [] }, en)).toEqual(["A reasonable pick for the moment"]);
  });

  it("without a translator there is nothing to say", () => {
    expect(getTodayReasonLabels(reasonOf("season", { season: "fall" }), undefined)).toEqual([]);
  });
});

describe("truthfulness over the whole catalog: what is said is what scored", () => {
  const moments = [];

  for (const season of ["spring", "summer", "fall", "winter"]) {
    for (let weekday = 0; weekday < 7; weekday++) {
      for (let hour = 0; hour < 24; hour++) moments.push({ season, hour, weekday });
    }
  }

  it("weekend wording appears ONLY on a Friday/Saturday night or a Saturday/Sunday daytime", () => {
    for (const context of moments) {
      const result = buildTodayRecommendations({ perfumes: fragrances, context });

      for (const recommendation of result.recommendations) {
        const text = getTodayReasonLabels(recommendation, es).join(" | ");

        if (/fin de semana/.test(text)) {
          const isFriSatNight = (context.weekday === 5 || context.weekday === 6) && context.hour >= 18;
          const isSatSunSmallHours = (context.weekday === 6 || context.weekday === 0) && context.hour < 5;
          const isWeekendDay = (context.weekday === 6 || context.weekday === 0) && context.hour >= 5 && context.hour < 21;

          expect(isFriSatNight || isSatSunSmallHours || isWeekendDay, JSON.stringify(context)).toBe(true);
        }
      }
    }
  });

  it("date or night-out wording appears only on a social night, and only for a fragrance that has the matching occasion", () => {
    for (const context of moments) {
      for (const recommendation of buildTodayRecommendations({ perfumes: fragrances, context }).recommendations) {
        const text = getTodayReasonLabels(recommendation, es).join(" | ");

        if (/cita|salida de noche/.test(text)) {
          expect(recommendation.factors.find(({ code }) => code === "dayContext")?.evidence.dayContext, JSON.stringify(context)).toBe("social_night");
          if (/cita/.test(text)) expect(recommendation.perfume.occasions).toContain("date");
          if (/salida de noche/.test(text)) expect(recommendation.perfume.occasions.some((o) => o === "night" || o === "club")).toBe(true);
        }
      }
    }
  });

  it("office wording appears only on a workday daytime, for a fragrance with the office occasion", () => {
    for (const context of moments) {
      for (const recommendation of buildTodayRecommendations({ perfumes: fragrances, context }).recommendations) {
        if (/oficina/.test(getTodayReasonLabels(recommendation, es).join(" | "))) {
          expect(recommendation.factors.find(({ code }) => code === "dayContext")?.evidence.dayContext).toBe("workday_daytime");
          expect(recommendation.perfume.occasions).toContain("office");
        }
      }
    }
  });

  it("no line anywhere mentions weather, temperature or degrees (none is known)", () => {
    for (const context of moments) {
      for (const recommendation of buildTodayRecommendations({ perfumes: fragrances, context }).recommendations) {
        expect(getTodayReasonLabels(recommendation, es).join(" | ")).not.toMatch(/clima|lluvi|calor|frío|frio|fresc|temperatura|grados|°|soleado|despejado|nublado/i);
        expect(getTodayLeadLabel(buildTodayRecommendations({ perfumes: fragrances, context }), es)).not.toMatch(/clima|lluvi|calor|frío|temperatura|grados|°/i);
      }
    }
  });

  it("the labels module reads only a reason's code and evidence, never the fragrance or the clock", () => {
    const code = labelsSource.replace(/\/\/.*$/gm, "");

    expect(code).not.toMatch(/\.perfume\b|perfume\./);
    expect(code).not.toMatch(/new Date|Date\.now|fetch\(|Intl\./);
  });
});

describe("weather and temperature reason lines say only what their evidence supports", () => {
  const weather = (evidence) => getTodayReasonLabels({ reasons: [{ code: "weather", evidence }] }, es);
  const temperature = (temperatureBucket) => getTodayReasonLabels({ reasons: [{ code: "temperature", evidence: { temperatureBucket, weight: 8 } }] }, es);

  it("heat: the fresh-profile sentence, only for a hot or warm bucket", () => {
    expect(weather({ profile: "heat", temperatureBucket: "hot", accords: ["citrus"], vibes: [] })).toEqual(["Su perfil fresco funciona especialmente bien con el calor"]);
    expect(weather({ profile: "heat", temperatureBucket: "warm", accords: ["citrus"], vibes: [] })).toEqual(["Su perfil fresco funciona especialmente bien con el calor"]);
    expect(weather({ profile: "heat", temperatureBucket: "cool", accords: ["citrus"], vibes: [] })).toEqual(["Una opción razonable para este momento"]);
    expect(weather({ profile: "heat", temperatureBucket: "mild" })).toEqual(["Una opción razonable para este momento"]);
  });

  it("rain: the cozy sentence, only when the evidence says it rained", () => {
    expect(weather({ profile: "rain", weatherCondition: "rain", temperatureBucket: "mild", accords: ["amber"], vibes: [] })).toEqual(["Una opción acogedora para un día lluvioso"]);
    expect(weather({ profile: "rain", weatherCondition: "clear", accords: ["amber"], vibes: [] })).toEqual(["Una opción razonable para este momento"]);
    expect(weather({ profile: "rain", accords: ["amber"], vibes: [] })).toEqual(["Una opción razonable para este momento"]);
  });

  it("cool and cold: the matching sentence, only for a cool or cold bucket", () => {
    expect(weather({ profile: "cool", temperatureBucket: "cool", accords: ["amber"], vibes: [] })).toEqual(["Encaja especialmente bien con el clima fresco"]);
    expect(weather({ profile: "cool", temperatureBucket: "cold", accords: ["amber"], vibes: [] })).toEqual(["Encaja especialmente bien con el frío"]);
    expect(weather({ profile: "cool", temperatureBucket: "hot", accords: ["amber"], vibes: [] })).toEqual(["Una opción razonable para este momento"]);
  });

  it("temperature: the bucket's own sentence", () => {
    expect(temperature("hot")).toEqual(["Va bien con el calor"]);
    expect(temperature("warm")).toEqual(["Va bien con el calor"]);
    expect(temperature("mild")).toEqual(["Va bien con un clima templado"]);
    expect(temperature("cool")).toEqual(["Va bien con el clima fresco"]);
    expect(temperature("cold")).toEqual(["Va bien con el frío"]);
    expect(temperature("scorching")).toEqual(["Una opción razonable para este momento"]);
    expect(temperature(undefined)).toEqual(["Una opción razonable para este momento"]);
  });

  it("speaks English from the en-US dictionary too", () => {
    expect(getTodayReasonLabels({ reasons: [{ code: "weather", evidence: { profile: "rain", weatherCondition: "rain" } }] }, en)).toEqual(["A cozy pick for a rainy day"]);
    expect(getTodayReasonLabels({ reasons: [{ code: "temperature", evidence: { temperatureBucket: "cold" } }] }, en)).toEqual(["Works with the cold"]);
  });

  it("shows two lines at most, with the weather sentence first when there is one", () => {
    const labels = getTodayReasonLabels(
      {
        reasons: [
          { code: "weather", evidence: { profile: "heat", temperatureBucket: "hot", accords: ["citrus"], vibes: [] } },
          { code: "timeOfDay", evidence: { time: "daytime" } },
          { code: "season", evidence: { season: "summer", weight: 10 } },
        ],
      },
      es
    );

    expect(labels).toEqual(["Su perfil fresco funciona especialmente bien con el calor", "Cómoda para el día"]);
  });
});

describe("copy: es-MX and en-US stay in step", () => {
  const keys = (dictionary) => Object.keys(dictionary).filter((key) => key.startsWith("suggestions.") || key === "app.suggestionsTab");

  it("defines the same keys in both locales, each non-empty, with the same placeholders", () => {
    expect(keys(esMX).sort()).toEqual(keys(enUS).sort());
    expect(keys(esMX).length).toBeGreaterThan(20);

    const placeholders = (text) => [...text.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort();

    keys(esMX).forEach((key) => {
      expect(esMX[key], key).toBeTruthy();
      expect(enUS[key], key).toBeTruthy();
      expect(placeholders(enUS[key]), key).toEqual(placeholders(esMX[key]));
    });
  });

  it("has a lead line for every confidence and time, and a season name for every season", () => {
    for (const dictionary of [esMX, enUS]) {
      for (const level of ["high", "moderate"]) {
        for (const time of ["morning", "daytime", "evening", "night"]) expect(dictionary[`suggestions.today.lead.${level}.${time}`]).toBeTruthy();
      }
      for (const season of ["spring", "summer", "fall", "winter"]) expect(dictionary[`suggestions.today.season.${season}`]).toBeTruthy();
    }
  });

  it("uses the approved Spanish names", () => {
    expect(esMX["app.suggestionsTab"]).toBe("Sugerencias");
    expect(esMX["suggestions.title"]).toBe("Sugerencias");
    expect(esMX["suggestions.today.title"]).toBe("Para hoy");
    expect(esMX["suggestions.affinity.empty"]).toBe("Agrega algunas fragancias y aquí aparecerán sugerencias basadas en tus elecciones.");
  });
});
