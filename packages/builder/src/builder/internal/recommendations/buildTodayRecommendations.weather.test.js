import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { fragrances } from "@discovery-box/catalog";
import { createTranslator } from "../../../i18n/createTranslator.js";
import { getTodayLeadLabel, getTodayReasonLabels } from "../../presentation/todayRecommendationLabels.js";
import {
  TODAY_FACTOR_MAX,
  TODAY_FULL_MAX,
  TODAY_LIVE_FACTOR_MAX,
  buildTodayRecommendations,
} from "./buildTodayRecommendations.js";

const source = readFileSync(new URL("./buildTodayRecommendations.js", import.meta.url), "utf8");
const es = createTranslator("es-MX");

let nextId = 1000;
const perfume = (overrides = {}) => ({
  id: nextId++,
  name: `Fragrance ${nextId}`,
  brand: `House ${nextId}`,
  points: 1,
  seasons: ["fall"],
  seasonWeights: { spring: 5, summer: 5, fall: 5, winter: 5 },
  occasions: [],
  vibes: [],
  accords: [],
  ...overrides,
});

const WED_NIGHT = { season: "fall", hour: 0, weekday: 3 };
const TUE_NOON = { season: "summer", hour: 11, weekday: 2 };
const SAT_NIGHT = { season: "fall", hour: 21, weekday: 6 };
const factorOf = (recommendation, code) => recommendation.factors.find((factor) => factor.code === code);
const only = (item, context) => buildTodayRecommendations({ perfumes: [item], context }).recommendations[0];

describe("NO-WEATHER EQUIVALENCE: with no live input the engine is exactly the one already approved", () => {
  // Every pick, score, factor, reason and confidence for all 672 season / weekday / hour moments on the real catalog, hashed. The hash
  // was taken from the committed Phase 1 engine BEFORE the weather factors were added; any change to the no-weather path changes it.
  const PHASE_1_HASH = "e0e40a50f1a6dd96d9b4e173ee3b78376c5ef7b3c8b24e2eae4345240915a40a";

  it("produces byte-identical results to Phase 1 for every moment", () => {
    const out = [];

    for (const season of ["spring", "summer", "fall", "winter"]) {
      for (let weekday = 0; weekday < 7; weekday++) {
        for (let hour = 0; hour < 24; hour++) {
          const result = buildTodayRecommendations({ perfumes: fragrances, context: { season, hour, weekday } });

          out.push([season, weekday, hour, result.confidence, result.recommendations.map((x) => [x.perfume.id, x.score, x.maxScore, x.normalizedScore, x.coverage, x.confidence, x.factors, x.reasons])]);
        }
      }
    }

    expect(createHash("sha256").update(JSON.stringify(out)).digest("hex")).toBe(PHASE_1_HASH);
  });

  it("scores exactly the three base factors, with the base maximum", () => {
    const pick = only(perfume({ occasions: ["night"] }), SAT_NIGHT);

    expect(pick.factors.map(({ code }) => code)).toEqual(["season", "timeOfDay", "dayContext"]);
    expect(pick.maxScore).toBe(100);
    expect(TODAY_FULL_MAX).toBe(100);
    expect(Object.values(TODAY_FACTOR_MAX).reduce((a, b) => a + b, 0)).toBe(100);
  });

  it("garbage or unknown live fields change nothing: they are dropped before scoring", () => {
    const clean = buildTodayRecommendations({ perfumes: fragrances, context: TUE_NOON });
    const noisy = buildTodayRecommendations({ perfumes: fragrances, context: { ...TUE_NOON, temperatureBucket: "scorching", weatherCondition: "tornado" } });

    expect(noisy.recommendations).toEqual(clean.recommendations);
  });

  it("'cloudy' alone, with no temperature, scores nothing extra", () => {
    const clean = buildTodayRecommendations({ perfumes: fragrances, context: TUE_NOON });
    const cloudy = buildTodayRecommendations({ perfumes: fragrances, context: { ...TUE_NOON, weatherCondition: "cloudy" } });

    expect(cloudy.recommendations).toEqual(clean.recommendations);
  });
});

describe("which factors join, and when", () => {
  it("a temperature bucket adds the temperature factor (20); hot/warm/cool/cold also add the weather-profile factor (10)", () => {
    const item = perfume();
    const names = (context) => only(item, context).factors.map(({ code }) => code);

    expect(names({ ...TUE_NOON, temperatureBucket: "hot" })).toEqual(["season", "timeOfDay", "dayContext", "temperature", "weather"]);
    expect(names({ ...TUE_NOON, temperatureBucket: "warm" })).toEqual(["season", "timeOfDay", "dayContext", "temperature", "weather"]);
    expect(names({ ...TUE_NOON, temperatureBucket: "cool" })).toEqual(["season", "timeOfDay", "dayContext", "temperature", "weather"]);
    expect(names({ ...TUE_NOON, temperatureBucket: "cold" })).toEqual(["season", "timeOfDay", "dayContext", "temperature", "weather"]);
    expect(TODAY_LIVE_FACTOR_MAX).toEqual({ temperature: 20, weather: 10 });
  });

  it("a mild, dry day has a temperature factor but NO weather profile to match", () => {
    const item = perfume();

    expect(only(item, { ...TUE_NOON, temperatureBucket: "mild" }).factors.map(({ code }) => code)).toEqual(["season", "timeOfDay", "dayContext", "temperature"]);
    expect(only(item, { ...TUE_NOON, temperatureBucket: "mild", weatherCondition: "clear" }).factors.map(({ code }) => code)).not.toContain("weather");
    expect(only(item, { ...TUE_NOON, temperatureBucket: "mild", weatherCondition: "cloudy" }).factors.map(({ code }) => code)).not.toContain("weather");
  });

  it("rain adds the weather profile even on a mild day, and with no temperature at all", () => {
    expect(only(perfume(), { ...TUE_NOON, temperatureBucket: "mild", weatherCondition: "rain" }).factors.map(({ code }) => code)).toContain("weather");
    expect(only(perfume(), { ...TUE_NOON, weatherCondition: "rain" }).factors.map(({ code }) => code)).toEqual(["season", "timeOfDay", "dayContext", "weather"]);
  });

  it("availability depends on the context only, never on the fragrance: everyone is scored over the same factors", () => {
    const context = { ...WED_NIGHT, temperatureBucket: "cool", weatherCondition: "clear" };
    const result = buildTodayRecommendations({ perfumes: fragrances, context, limit: 3 });
    const shapes = new Set(result.recommendations.map(({ factors }) => factors.map(({ code }) => code).join(",")));

    expect(shapes.size).toBe(1);
  });

  it("the live factors are at most 30 of 130 points (23%): context, not a takeover", () => {
    expect(TODAY_LIVE_FACTOR_MAX.temperature + TODAY_LIVE_FACTOR_MAX.weather).toBe(30);
    expect(30 / (TODAY_FULL_MAX + 30)).toBeLessThan(0.25);
  });
});

describe("the temperature factor: season weights blended for the temperature", () => {
  const weights = { spring: 4, summer: 10, fall: 2, winter: 0 };
  const item = perfume({ seasonWeights: weights });
  const points = (bucket) => factorOf(only(item, { ...TUE_NOON, temperatureBucket: bucket }), "temperature");

  it("hot reads summer, warm 0.6 summer + 0.4 spring, mild half spring half fall, cool 0.6 fall + 0.4 winter, cold winter", () => {
    expect(points("hot")).toMatchObject({ points: 20, evidence: { temperatureBucket: "hot", weight: 10 } });
    expect(points("warm")).toMatchObject({ points: 15.2, evidence: { weight: 7.6 } });
    expect(points("mild")).toMatchObject({ points: 6, evidence: { weight: 3 } });
    expect(points("cool")).toMatchObject({ points: 2.4, evidence: { weight: 1.2 } });
    expect(points("cold")).toMatchObject({ points: 0, evidence: { weight: 0 } });
  });

  it("tolerates missing season weights, like the rest of the engine", () => {
    expect(factorOf(only(perfume({ seasonWeights: undefined, seasons: ["summer"] }), { ...TUE_NOON, temperatureBucket: "hot" }), "temperature").points).toBe(12);
    expect(factorOf(only(perfume({ seasonWeights: null, seasons: null }), { ...TUE_NOON, temperatureBucket: "hot" }), "temperature").points).toBe(0);
  });
});

describe("the weather-profile factor", () => {
  const fresh = perfume({ accords: ["citrus", "aquatic", "woody"], vibes: ["fresh"] });
  const warm = perfume({ accords: ["amber", "vanilla"], vibes: ["cozy"] });
  const neutral = perfume({ accords: ["woody", "aromatic"], vibes: ["elegant"] });
  const profile = (item, context) => factorOf(only(item, { ...TUE_NOON, ...context }), "weather");

  it("heat (hot or warm): fresh accords (6) and fresh vibes (4)", () => {
    expect(profile(fresh, { temperatureBucket: "hot" })).toMatchObject({ points: 10, evidence: { profile: "heat", temperatureBucket: "hot", accords: ["citrus", "aquatic"], vibes: ["fresh"] } });
    expect(profile(warm, { temperatureBucket: "warm" }).points).toBe(0);
    expect(profile(perfume({ accords: ["citrus"], vibes: [] }), { temperatureBucket: "hot" }).points).toBe(3);
  });

  it("cool or cold: warm accords (6) and cozy vibes (4)", () => {
    expect(profile(warm, { temperatureBucket: "cool" })).toMatchObject({ points: 10, evidence: { profile: "cool", accords: ["amber", "vanilla"], vibes: ["cozy"] } });
    expect(profile(warm, { temperatureBucket: "cold" }).points).toBe(10);
    expect(profile(fresh, { temperatureBucket: "cold" }).points).toBe(0);
  });

  it("rain: the same warm, cozy profile, and the evidence says it was rain", () => {
    expect(profile(warm, { temperatureBucket: "mild", weatherCondition: "rain" })).toMatchObject({ points: 10, evidence: { profile: "rain", weatherCondition: "rain" } });
  });

  it("heat wins over rain (a hot rainy day still wants fresh), and rain wins over a cool dry day's label", () => {
    expect(profile(fresh, { temperatureBucket: "hot", weatherCondition: "rain" }).evidence.profile).toBe("heat");
    expect(profile(warm, { temperatureBucket: "cool", weatherCondition: "rain" }).evidence.profile).toBe("rain");
  });

  it("a fragrance that matches nothing earns 0 there, without being excluded", () => {
    expect(profile(neutral, { temperatureBucket: "cold" }).points).toBe(0);
  });
});

describe("ranking sanity on the real catalog", () => {
  const picksFor = (context) => buildTodayRecommendations({ perfumes: fragrances, context }).recommendations;

  it("a hot day picks warm-weather fragrances, a cold night picks winter ones", () => {
    for (const { perfume: item } of picksFor({ ...TUE_NOON, temperatureBucket: "hot", weatherCondition: "clear" })) expect(item.seasonWeights.summer).toBeGreaterThanOrEqual(8);
    for (const { perfume: item } of picksFor({ ...SAT_NIGHT, season: "winter", temperatureBucket: "cold", weatherCondition: "clear" })) expect(item.seasonWeights.winter).toBeGreaterThanOrEqual(8);
  });

  it("a heatwave in winter still favours the heat over the calendar: the live factors move the pick, without taking over", () => {
    const calendar = picksFor({ season: "winter", hour: 11, weekday: 2 }).map(({ perfume: item }) => item.id);
    const heatwave = picksFor({ season: "winter", hour: 11, weekday: 2, temperatureBucket: "hot", weatherCondition: "clear" });

    expect(heatwave.map(({ perfume: item }) => item.id)).not.toEqual(calendar);
    for (const { perfume: item, factors } of heatwave) {
      expect(item.seasonWeights.summer).toBeGreaterThanOrEqual(6);
      expect(factors.find(({ code }) => code === "timeOfDay").points).toBeGreaterThanOrEqual(30); // time and day still count
    }
  });

  it("time and day still lead: a social Saturday night stays a date / night-out set whatever the weather", () => {
    for (const context of [{ temperatureBucket: "cool", weatherCondition: "clear" }, { temperatureBucket: "cold", weatherCondition: "rain" }, { temperatureBucket: "mild" }]) {
      for (const { perfume: item } of picksFor({ ...SAT_NIGHT, ...context })) {
        expect(item.occasions).toContain("date");
        expect(item.occasions.some((occasion) => occasion === "night" || occasion === "club")).toBe(true);
      }
    }
  });

  it("is deterministic, one fragrance per brand, three picks, over every temperature and condition", () => {
    for (const temperatureBucket of ["hot", "warm", "mild", "cool", "cold"]) {
      for (const weatherCondition of ["clear", "cloudy", "rain"]) {
        const context = { ...WED_NIGHT, temperatureBucket, weatherCondition };
        const first = picksFor(context);
        const again = picksFor(context);
        const brands = first.map(({ perfume: item }) => item.brand);

        expect(again).toEqual(first);
        expect(first).toHaveLength(3);
        expect(new Set(brands).size).toBe(3);
      }
    }
  });

  it("score is exactly the sum of the factors that scored, normalised over those that were available", () => {
    for (const context of [{ ...WED_NIGHT, temperatureBucket: "mild" }, { ...SAT_NIGHT, temperatureBucket: "cold", weatherCondition: "rain" }, { ...TUE_NOON, weatherCondition: "rain" }]) {
      for (const pick of picksFor(context)) {
        expect(pick.score).toBe(Math.round(pick.factors.reduce((sum, factor) => sum + factor.points, 0) * 100) / 100);
        expect(pick.maxScore).toBe(pick.factors.reduce((sum, factor) => sum + factor.max, 0));
        expect(pick.normalizedScore).toBe(Math.round((pick.score / pick.maxScore) * 1000) / 1000);
      }
    }
  });

  it("price, tier and market segment never move a pick, weather or not", () => {
    const code = source.replace(/\/\/.*$/gm, "");
    const a = perfume({ points: 0.5, brand: "Armaf", accords: ["citrus"], vibes: ["fresh"] });
    const b = perfume({ points: 40, brand: "Creed", accords: ["citrus"], vibes: ["fresh"] });
    const context = { ...TUE_NOON, temperatureBucket: "hot", weatherCondition: "clear" };

    expect(only(a, context).score).toBe(only(b, context).score);
    expect(code).not.toMatch(/perfume\.points\b|\btier\b|segment/i);
  });
});

describe("confidence with weather", () => {
  const strong = (extra = {}) =>
    perfume({ seasonWeights: { spring: 10, summer: 10, fall: 10, winter: 10 }, occasions: ["night", "date", "club"], vibes: ["seductive", "bold", "cozy"], accords: ["amber", "vanilla"], ...extra });

  it("a known temperature never LOWERS confidence: a full-evidence moment stays 'high'", () => {
    expect(only(strong(), SAT_NIGHT).confidence).toBe("high");
    expect(only(strong(), { ...SAT_NIGHT, temperatureBucket: "cool", weatherCondition: "clear" }).confidence).toBe("high");
    expect(only(strong(), { ...SAT_NIGHT, temperatureBucket: "mild" }).confidence).toBe("high"); // no profile: still full coverage
  });

  it("a thin moment stays 'moderate' with weather too (a weeknight has no day context)", () => {
    const pick = only(strong(), { ...WED_NIGHT, temperatureBucket: "cool", weatherCondition: "clear" });

    expect(pick.coverage).toBeLessThan(1);
    expect(pick.confidence).toBe("moderate");
  });

  it("coverage is never above 1", () => {
    for (const pick of buildTodayRecommendations({ perfumes: fragrances, context: { ...SAT_NIGHT, temperatureBucket: "cold", weatherCondition: "rain" } }).recommendations) {
      expect(pick.coverage).toBeLessThanOrEqual(1);
    }
  });
});

describe("TRUTHFUL weather reasons: only from a factor that scored, with the evidence behind it", () => {
  const linesFor = (context, limit = 3) =>
    buildTodayRecommendations({ perfumes: fragrances, context, limit }).recommendations.map((recommendation) => ({ recommendation, lines: getTodayReasonLabels(recommendation, es) }));

  const everyMoment = [];

  for (const season of ["spring", "summer", "fall", "winter"]) {
    for (const hour of [0, 6, 11, 15, 19, 22]) {
      for (const weekday of [0, 2, 5, 6]) {
        for (const temperatureBucket of [undefined, "hot", "warm", "mild", "cool", "cold"]) {
          for (const weatherCondition of [undefined, "clear", "cloudy", "rain"]) {
            everyMoment.push({ season, hour, weekday, ...(temperatureBucket ? { temperatureBucket } : {}), ...(weatherCondition ? { weatherCondition } : {}) });
          }
        }
      }
    }
  }

  it("every reason maps to a non-zero scored factor and carries exactly that factor's evidence", () => {
    for (const context of everyMoment) {
      for (const { recommendation } of linesFor(context)) {
        for (const reason of recommendation.reasons) {
          const factor = factorOf(recommendation, reason.code);

          expect(factor, `${JSON.stringify(context)} ${reason.code}`).toBeDefined();
          expect(factor.points).toBeGreaterThan(0);
          expect(factor.points / factor.max).toBeGreaterThanOrEqual(0.6);
          expect(reason.evidence).toEqual(factor.evidence);
        }
      }
    }
  });

  it("weather and temperature reasons exist ONLY when the host supplied weather", () => {
    for (const context of everyMoment) {
      const supplied = Boolean(context.temperatureBucket || context.weatherCondition);

      for (const { recommendation } of linesFor(context)) {
        const codes = recommendation.reasons.map(({ code }) => code);

        if (!supplied) {
          expect(codes).not.toContain("weather");
          expect(codes).not.toContain("temperature");
        }
      }
    }
  });

  it("heat wording only on a hot or warm bucket; fresh-profile wording needs fresh accords; cool wording only on cool/cold with warm accords", () => {
    for (const context of everyMoment) {
      for (const { recommendation, lines } of linesFor(context)) {
        const text = lines.join(" | ");
        const evidence = recommendation.reasons.find(({ code }) => code === "weather")?.evidence;

        if (/Su perfil fresco funciona especialmente bien con el calor/.test(text)) {
          expect(["hot", "warm"]).toContain(context.temperatureBucket);
          expect(evidence.profile).toBe("heat");
          expect(evidence.accords.length + evidence.vibes.length).toBeGreaterThan(0);
          expect(recommendation.perfume.accords.some((accord) => ["citrus", "aquatic", "marine", "fresh", "green", "mineral"].includes(accord)) || recommendation.perfume.vibes.some((vibe) => ["fresh", "bright", "clean", "energetic", "easy"].includes(vibe))).toBe(true);
        }

        if (/clima fresco especialmente|Encaja especialmente bien con el (clima fresco|frío)/.test(text)) {
          expect(["cool", "cold"]).toContain(context.temperatureBucket);
          expect(evidence.profile === "cool" || evidence.profile === "rain").toBe(true);
        }
      }
    }
  });

  it("rain wording only when it is raining AND the rain profile scored", () => {
    for (const context of everyMoment) {
      for (const { recommendation, lines } of linesFor(context)) {
        if (/lluvioso/.test(lines.join(" | "))) {
          expect(context.weatherCondition).toBe("rain");
          expect(recommendation.reasons.find(({ code }) => code === "weather").evidence).toMatchObject({ profile: "rain", weatherCondition: "rain" });
        }
      }
    }
  });

  it("'cold' wording only below 12 C, 'calor' wording only from 26 C, and 'templado' only on a mild bucket", () => {
    for (const context of everyMoment) {
      for (const { lines } of linesFor(context)) {
        const text = lines.join(" | ");

        if (/frío/.test(text)) expect(context.temperatureBucket).toBe("cold");
        if (/calor/.test(text)) expect(["hot", "warm"]).toContain(context.temperatureBucket);
        if (/templado/.test(text)) expect(context.temperatureBucket).toBe("mild");
      }
    }
  });

  it("weekend wording still appears only when the day-context factor fired", () => {
    for (const context of everyMoment) {
      for (const { recommendation, lines } of linesFor(context)) {
        if (/fin de semana/.test(lines.join(" | "))) {
          expect(["social_night", "weekend_daytime"]).toContain(factorOf(recommendation, "dayContext")?.evidence.dayContext);
        }
      }
    }
  });

  it("the weather reason, when there is one, leads the lines", () => {
    const sample = linesFor({ ...TUE_NOON, temperatureBucket: "hot", weatherCondition: "clear" }, 3);

    for (const { recommendation, lines } of sample) {
      if (recommendation.reasons.some(({ code }) => code === "weather")) {
        expect(recommendation.reasons[0].code).toBe("weather");
        expect(lines[0]).toBe("Su perfil fresco funciona especialmente bien con el calor");
      }
    }
  });

  it("the lead line is about the time of day and says nothing about weather", () => {
    const result = buildTodayRecommendations({ perfumes: fragrances, context: { ...SAT_NIGHT, temperatureBucket: "cold", weatherCondition: "rain" } });

    expect(getTodayLeadLabel(result, es)).toBe("Pensadas para esta noche");
  });
});
