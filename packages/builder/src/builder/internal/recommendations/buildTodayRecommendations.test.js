import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { fragrances } from "@discovery-box/catalog";
import {
  TODAY_FACTOR_MAX,
  TODAY_FULL_MAX,
  TODAY_HIGH_CONFIDENCE_THRESHOLD,
  TODAY_MAX_RECOMMENDATIONS,
  TODAY_REASON_MIN_RATIO,
  buildTodayRecommendations,
} from "./buildTodayRecommendations.js";

const source = readFileSync(new URL("./buildTodayRecommendations.js", import.meta.url), "utf8");

let nextId = 1;
const perfume = (overrides = {}) => ({
  id: nextId++,
  name: `Fragrance ${nextId}`,
  brand: `House ${nextId}`,
  points: 1,
  seasons: ["fall"],
  seasonWeights: { spring: 0, summer: 0, fall: 5, winter: 0 },
  occasions: [],
  vibes: [],
  ...overrides,
});

const SAT_NIGHT = { season: "fall", hour: 21, weekday: 6 };
const WED_NIGHT = { season: "fall", hour: 0, weekday: 3 };
const TUE_NOON = { season: "summer", hour: 11, weekday: 2 };
const SUN_MORNING = { season: "spring", hour: 10, weekday: 0 };

const sumPoints = (recommendation) => Math.round(recommendation.factors.reduce((sum, factor) => sum + factor.points, 0) * 100) / 100;

describe("buildTodayRecommendations: shape and determinism", () => {
  const pool = [
    perfume({ occasions: ["night", "date"], vibes: ["seductive", "bold"], seasonWeights: { fall: 9 } }),
    perfume({ occasions: ["daily", "office"], vibes: ["fresh", "clean"], seasonWeights: { fall: 4 } }),
    perfume({ occasions: ["club"], vibes: ["bold"], seasonWeights: { fall: 7 } }),
    perfume({ occasions: [], vibes: [], seasonWeights: { fall: 2 } }),
  ];

  it("returns the same result for the same input, however the catalog is ordered", () => {
    const first = buildTodayRecommendations({ perfumes: pool, context: SAT_NIGHT });
    const again = buildTodayRecommendations({ perfumes: pool, context: SAT_NIGHT });
    const reversed = buildTodayRecommendations({ perfumes: [...pool].reverse(), context: SAT_NIGHT });

    expect(again).toEqual(first);
    expect(reversed.recommendations.map(({ perfume: item }) => item.id)).toEqual(first.recommendations.map(({ perfume: item }) => item.id));
  });

  it("does not mutate the catalog", () => {
    const copy = JSON.parse(JSON.stringify(pool));

    buildTodayRecommendations({ perfumes: pool, context: SAT_NIGHT });

    expect(pool).toEqual(copy);
  });

  it("returns at most three picks, whatever limit is asked for", () => {
    const many = Array.from({ length: 12 }, () => perfume({ occasions: ["night"], vibes: ["bold"] }));

    expect(TODAY_MAX_RECOMMENDATIONS).toBe(3);
    expect(buildTodayRecommendations({ perfumes: many, context: SAT_NIGHT }).recommendations).toHaveLength(3);
    expect(buildTodayRecommendations({ perfumes: many, context: SAT_NIGHT, limit: 10 }).recommendations).toHaveLength(3);
    expect(buildTodayRecommendations({ perfumes: many, context: SAT_NIGHT, limit: 1 }).recommendations).toHaveLength(1);
    expect(buildTodayRecommendations({ perfumes: many, context: SAT_NIGHT, limit: 0 }).recommendations).toEqual([]);
  });

  it("is empty, never throwing, for an unusable context or catalog", () => {
    expect(buildTodayRecommendations({ perfumes: pool, context: null }).recommendations).toEqual([]);
    expect(buildTodayRecommendations({ perfumes: pool, context: { season: "fall" } }).recommendations).toEqual([]);
    expect(buildTodayRecommendations({ perfumes: null, context: SAT_NIGHT }).recommendations).toEqual([]);
    expect(buildTodayRecommendations({ perfumes: [null, {}, { id: "x" }], context: SAT_NIGHT }).recommendations).toEqual([]);
    expect(buildTodayRecommendations().recommendations).toEqual([]);
    expect(buildTodayRecommendations({ perfumes: pool, context: SAT_NIGHT }).context.dayContext).toBe("social_night");
  });

  it("breaks exact ties by perfume id, ascending", () => {
    const twins = [perfume({ id: 90 }), perfume({ id: 30 }), perfume({ id: 60 })];

    expect(buildTodayRecommendations({ perfumes: twins, context: SAT_NIGHT }).recommendations.map(({ perfume: item }) => item.id)).toEqual([30, 60, 90]);
  });
});

describe("scoring: the factors", () => {
  it("season: 30 points scaled by the season's own weight, 0-10", () => {
    const [top] = buildTodayRecommendations({ perfumes: [perfume({ seasonWeights: { fall: 10 } })], context: WED_NIGHT }).recommendations;
    const [mid] = buildTodayRecommendations({ perfumes: [perfume({ seasonWeights: { fall: 5 } })], context: WED_NIGHT }).recommendations;
    const [none] = buildTodayRecommendations({ perfumes: [perfume({ seasonWeights: { fall: 0 } })], context: WED_NIGHT }).recommendations;
    const factor = (recommendation) => recommendation.factors.find(({ code }) => code === "season");

    expect(factor(top)).toMatchObject({ points: 30, max: 30, evidence: { season: "fall", weight: 10 } });
    expect(factor(mid).points).toBe(15);
    expect(factor(none).points).toBe(0);
  });

  it("season: a weight outside 0-10 is clamped, and a MISSING weight degrades to the Composer's convention instead of crashing", () => {
    const factor = (item, context) =>
      buildTodayRecommendations({ perfumes: [item], context }).recommendations[0].factors.find(({ code }) => code === "season");

    expect(factor(perfume({ seasonWeights: { fall: 99 } }), WED_NIGHT).points).toBe(30);
    expect(factor(perfume({ seasonWeights: { fall: -4 } }), WED_NIGHT).points).toBe(0);
    // no weights at all: a declared season counts as 6, an undeclared one as 0
    expect(factor(perfume({ seasonWeights: undefined, seasons: ["fall"] }), WED_NIGHT).points).toBe(18);
    expect(factor(perfume({ seasonWeights: undefined, seasons: ["spring"] }), WED_NIGHT).points).toBe(0);
    expect(factor(perfume({ seasonWeights: { fall: "high" }, seasons: undefined }), WED_NIGHT).points).toBe(0);
    expect(factor(perfume({ seasonWeights: null, seasons: null }), WED_NIGHT).points).toBe(0);
  });

  it("time of day, evening and night: night-ish occasions (24) and vibes (16) score; day occasions do not", () => {
    const factor = (item, context = SAT_NIGHT) =>
      buildTodayRecommendations({ perfumes: [item], context }).recommendations[0].factors.find(({ code }) => code === "timeOfDay");

    expect(factor(perfume({ occasions: ["night", "date", "club"], vibes: ["seductive", "bold"] })).points).toBe(40);
    expect(factor(perfume({ occasions: ["night"], vibes: [] })).points).toBe(14.4);
    expect(factor(perfume({ occasions: ["night", "date"], vibes: ["bold"] })).points).toBe(29.2);
    expect(factor(perfume({ occasions: [], vibes: ["seductive", "dark"] })).points).toBe(16);
    expect(factor(perfume({ occasions: ["daily", "office", "casual"], vibes: ["fresh", "clean"] })).points).toBe(0);
    expect(factor(perfume({ occasions: ["night"] }), { season: "fall", hour: 19, weekday: 3 }).evidence.time).toBe("evening");
  });

  it("time of day, morning and daytime: day occasions and vibes score; night ones do not", () => {
    const factor = (item, context = TUE_NOON) =>
      buildTodayRecommendations({ perfumes: [item], context }).recommendations[0].factors.find(({ code }) => code === "timeOfDay");

    expect(factor(perfume({ occasions: ["daily", "office", "casual"], vibes: ["fresh", "clean"] })).points).toBe(40);
    expect(factor(perfume({ occasions: ["night", "date", "club"], vibes: ["seductive", "bold"] })).points).toBe(0);
    expect(factor(perfume({ occasions: ["office"], vibes: ["fresh"] }), SUN_MORNING).evidence.time).toBe("morning");
  });

  it("day context: a social night scores date and going-out occasions, 18 each, capped at 30", () => {
    const factor = (item) => buildTodayRecommendations({ perfumes: [item], context: SAT_NIGHT }).recommendations[0].factors.find(({ code }) => code === "dayContext");

    expect(factor(perfume({ occasions: ["date", "night"] })).points).toBe(30);
    expect(factor(perfume({ occasions: ["date"] })).points).toBe(18);
    expect(factor(perfume({ occasions: ["club"] })).points).toBe(18);
    expect(factor(perfume({ occasions: ["office", "daily"] })).points).toBe(0);
    expect(factor(perfume({ occasions: ["date", "night"] })).evidence).toEqual({ dayContext: "social_night", occasions: ["date", "night"] });
  });

  it("day context: a workday daytime scores office (30) over daily (18); a weekend daytime scores casual / daily / vacation", () => {
    const factor = (item, context) => buildTodayRecommendations({ perfumes: [item], context }).recommendations[0].factors.find(({ code }) => code === "dayContext");

    expect(factor(perfume({ occasions: ["office", "daily"] }), TUE_NOON).points).toBe(30);
    expect(factor(perfume({ occasions: ["daily"] }), TUE_NOON).points).toBe(18);
    expect(factor(perfume({ occasions: ["date"] }), TUE_NOON).points).toBe(0);
    expect(factor(perfume({ occasions: ["casual", "daily"] }), SUN_MORNING).points).toBe(30);
    expect(factor(perfume({ occasions: ["vacation"] }), SUN_MORNING).points).toBe(18);
    expect(factor(perfume({ occasions: ["office"] }), SUN_MORNING).points).toBe(0);
  });

  it("an ordinary weekday evening or night has NO day-context factor at all: it is not scored, not scored as zero", () => {
    const [pick] = buildTodayRecommendations({ perfumes: [perfume({ occasions: ["date", "night", "club"] })], context: WED_NIGHT }).recommendations;

    expect(pick.factors.map(({ code }) => code)).toEqual(["season", "timeOfDay"]);
    expect(pick.maxScore).toBe(70);
    expect(pick.coverage).toBe(0.7);
  });

  it("the available maximum is renormalised, so a missing factor is not padded with points nobody could earn", () => {
    const perfect = perfume({ seasonWeights: { fall: 10 }, occasions: ["night", "date", "club"], vibes: ["seductive", "bold"] });
    const [weeknight] = buildTodayRecommendations({ perfumes: [perfect], context: WED_NIGHT }).recommendations;
    const [social] = buildTodayRecommendations({ perfumes: [perfect], context: SAT_NIGHT }).recommendations;

    expect(weeknight.score).toBe(70);
    expect(weeknight.normalizedScore).toBe(1);
    expect(social.score).toBe(100);
    expect(social.normalizedScore).toBe(1);
    expect(TODAY_FULL_MAX).toBe(100);
    expect(Object.values(TODAY_FACTOR_MAX).reduce((sum, max) => sum + max, 0)).toBe(100);
  });

  it("score is exactly the sum of the factors that scored, for every pick", () => {
    for (const context of [SAT_NIGHT, WED_NIGHT, TUE_NOON, SUN_MORNING]) {
      for (const recommendation of buildTodayRecommendations({ perfumes: fragrances, context }).recommendations) {
        expect(recommendation.score).toBe(sumPoints(recommendation));
        expect(recommendation.maxScore).toBe(recommendation.factors.reduce((sum, factor) => sum + factor.max, 0));
        recommendation.factors.forEach((factor) => {
          expect(Object.keys(factor).sort()).toEqual(["code", "evidence", "max", "points"]);
          expect(factor.points).toBeGreaterThanOrEqual(0);
          expect(factor.points).toBeLessThanOrEqual(factor.max);
        });
      }
    }
  });
});

describe("the ranking ignores everything except the moment", () => {
  const base = { seasonWeights: { fall: 8 }, occasions: ["night", "date"], vibes: ["seductive"] };

  it("price (points) and tier never move a pick", () => {
    const cheap = perfume({ ...base, points: 0.5 });
    const dear = perfume({ ...base, points: 40 });
    const ranked = (items) => buildTodayRecommendations({ perfumes: items, context: SAT_NIGHT }).recommendations.map(({ perfume: item }) => item.id);

    expect(ranked([dear, cheap])).toEqual(ranked([cheap, dear]));
    expect(buildTodayRecommendations({ perfumes: [cheap], context: SAT_NIGHT }).recommendations[0].score).toBe(
      buildTodayRecommendations({ perfumes: [dear], context: SAT_NIGHT }).recommendations[0].score
    );
  });

  it("market segment never moves a pick", () => {
    const arabic = perfume({ ...base, brand: "Armaf" });
    const designer = perfume({ ...base, brand: "Dior" });
    const niche = perfume({ ...base, brand: "Creed" });
    const scores = [arabic, designer, niche].map((item) => buildTodayRecommendations({ perfumes: [item], context: SAT_NIGHT }).recommendations[0].score);

    expect(new Set(scores).size).toBe(1);
  });

  it("the source never reads price, tier, brand segment or the box", () => {
    const code = source.replace(/\/\/.*$/gm, ""); // the comments say what is NOT an input; the code must not read one

    expect(code).not.toMatch(/perfume\.points\b/);
    expect(code).not.toMatch(/\btier\b/i);
    expect(code).not.toMatch(/segment/i);
    expect(code).not.toMatch(/selectedPerfumes|boxSummary/);
    expect(code).not.toMatch(/Math\.random|Date\.now|new Date|fetch\(|localStorage/);
  });

  it("fragrances already in a box are not an input: the same call cannot depend on them", () => {
    expect(buildTodayRecommendations.length).toBeLessThanOrEqual(1);
    expect(Object.keys(buildTodayRecommendations({ perfumes: [perfume(base)], context: SAT_NIGHT })).sort()).toEqual(["confidence", "context", "recommendations"]);
  });
});

describe("diversity: at most one fragrance per house, and no segment quotas", () => {
  it("keeps the best-scoring fragrance of each house", () => {
    const strong = perfume({ brand: "Same House", seasonWeights: { fall: 10 }, occasions: ["night", "date", "club"], vibes: ["seductive", "bold"] });
    const weaker = perfume({ brand: "Same House", seasonWeights: { fall: 6 }, occasions: ["night"], vibes: [] });
    const other = perfume({ brand: "Other House", seasonWeights: { fall: 3 }, occasions: [], vibes: [] });
    const picks = buildTodayRecommendations({ perfumes: [weaker, strong, other], context: SAT_NIGHT }).recommendations;

    expect(picks.map(({ perfume: item }) => item.id)).toEqual([strong.id, other.id]);
  });

  it("never returns two picks from one house, on the real catalog, in any moment", () => {
    for (const season of ["spring", "summer", "fall", "winter"]) {
      for (let weekday = 0; weekday < 7; weekday++) {
        for (let hour = 0; hour < 24; hour++) {
          const picks = buildTodayRecommendations({ perfumes: fragrances, context: { season, hour, weekday } }).recommendations;
          const brands = picks.map(({ perfume: item }) => item.brand);

          expect(picks.length).toBeGreaterThan(0);
          expect(new Set(brands).size).toBe(brands.length);
        }
      }
    }
  });

  it("a fragrance with no brand counts as its own house", () => {
    const picks = buildTodayRecommendations({ perfumes: [perfume({ brand: undefined }), perfume({ brand: "" }), perfume({ brand: null })], context: SAT_NIGHT }).recommendations;

    expect(picks).toHaveLength(3);
  });
});

describe("reasons come only from factors that scored, with the evidence that earned them", () => {
  it("a factor explains a pick only at 60% of its own maximum", () => {
    expect(TODAY_REASON_MIN_RATIO).toBe(0.6);

    const [pick] = buildTodayRecommendations({
      perfumes: [perfume({ seasonWeights: { fall: 5 }, occasions: ["night"], vibes: [] })],
      context: SAT_NIGHT,
    }).recommendations;

    // season 15/30 (0.5), time 14.4/40 (0.36), day 18/30 (0.6): only the day context explains this pick
    expect(pick.reasons.map(({ code }) => code)).toEqual(["dayContext"]);
  });

  it("reason evidence is exactly the evidence of the factor behind it", () => {
    for (const context of [SAT_NIGHT, WED_NIGHT, TUE_NOON, SUN_MORNING]) {
      for (const recommendation of buildTodayRecommendations({ perfumes: fragrances, context }).recommendations) {
        for (const reason of recommendation.reasons) {
          const factor = recommendation.factors.find(({ code }) => code === reason.code);

          expect(factor, reason.code).toBeDefined();
          expect(factor.points).toBeGreaterThan(0);
          expect(factor.points / factor.max).toBeGreaterThanOrEqual(TODAY_REASON_MIN_RATIO);
          expect(reason.evidence).toEqual(factor.evidence);
        }
      }
    }
  });

  it("a weekday night can never carry a day-context reason (so no weekend or date-night claim is available)", () => {
    for (const weekday of [1, 2, 3, 4]) {
      for (const hour of [17, 18, 19, 20, 21, 22, 23, 0, 1, 2, 3, 4]) {
        const result = buildTodayRecommendations({ perfumes: fragrances, context: { season: "fall", hour, weekday } });

        expect(result.context.dayContext, `${weekday}:${hour}`).toBeNull();
        result.recommendations.forEach((recommendation) => {
          expect(recommendation.factors.map(({ code }) => code)).not.toContain("dayContext");
          expect(recommendation.reasons.map(({ code }) => code)).not.toContain("dayContext");
        });
      }
    }
  });

  it("a social-night reason carries the occasions it found: 'date' only when the fragrance is a date fragrance", () => {
    const noDate = perfume({ seasonWeights: { fall: 9 }, occasions: ["night", "club"], vibes: ["bold", "dark"] });
    const [pick] = buildTodayRecommendations({ perfumes: [noDate], context: SAT_NIGHT }).recommendations;
    const dayReason = pick.reasons.find(({ code }) => code === "dayContext");

    expect(dayReason.evidence.occasions).not.toContain("date");
    expect(dayReason.evidence.occasions).toEqual(["night", "club"]);
  });

  it("never emits any weather or temperature reason or factor (none is available in Phase 1)", () => {
    for (const recommendation of buildTodayRecommendations({ perfumes: fragrances, context: SAT_NIGHT }).recommendations) {
      expect([...recommendation.factors, ...recommendation.reasons].map(({ code }) => code).filter((code) => /weather|temperature|rain|hot|cold/i.test(code))).toEqual([]);
    }
  });

  it("accepts a temperature bucket and weather condition without scoring them", () => {
    const withLive = buildTodayRecommendations({ perfumes: fragrances, context: { ...TUE_NOON, temperatureBucket: "hot", weatherCondition: "rain" } });
    const without = buildTodayRecommendations({ perfumes: fragrances, context: TUE_NOON });

    expect(withLive.recommendations.map(({ perfume: item, score }) => [item.id, score])).toEqual(
      without.recommendations.map(({ perfume: item, score }) => [item.id, score])
    );
  });
});

describe("confidence", () => {
  const perfect = { seasonWeights: { fall: 10 }, occasions: ["night", "date", "club"], vibes: ["seductive", "bold"] };

  it("is 'high' only with full coverage AND at least 75% of the available points", () => {
    expect(TODAY_HIGH_CONFIDENCE_THRESHOLD).toBe(0.75);

    const [strong] = buildTodayRecommendations({ perfumes: [perfume(perfect)], context: SAT_NIGHT }).recommendations;
    const [justUnder] = buildTodayRecommendations({
      // 15 + 14.4 + 18 = 47.4 / 100
      perfumes: [perfume({ seasonWeights: { fall: 5 }, occasions: ["night"], vibes: [] })],
      context: SAT_NIGHT,
    }).recommendations;

    expect(strong).toMatchObject({ confidence: "high", coverage: 1, normalizedScore: 1 });
    expect(justUnder.confidence).toBe("moderate");
  });

  it("is 'moderate' on a moment with less context, however well the pick fits what is known", () => {
    const [pick] = buildTodayRecommendations({ perfumes: [perfume(perfect)], context: WED_NIGHT }).recommendations;

    expect(pick.normalizedScore).toBe(1);
    expect(pick.coverage).toBe(0.7);
    expect(pick.confidence).toBe("moderate");
  });

  it("the set is as sure as its weakest pick", () => {
    const strong = perfume({ ...perfect, brand: "A" });
    const weak = perfume({ seasonWeights: { fall: 2 }, occasions: [], vibes: [], brand: "B" });

    expect(buildTodayRecommendations({ perfumes: [strong], context: SAT_NIGHT }).confidence).toBe("high");
    expect(buildTodayRecommendations({ perfumes: [strong, weak], context: SAT_NIGHT }).confidence).toBe("moderate");
    expect(buildTodayRecommendations({ perfumes: [], context: SAT_NIGHT }).confidence).toBeNull();
  });

  it("does not hide Para hoy for modest scores: it always returns picks when the catalog has candidates", () => {
    const weak = [perfume({ seasonWeights: { fall: 1 }, occasions: [], vibes: [], brand: "A" })];
    const result = buildTodayRecommendations({ perfumes: weak, context: SAT_NIGHT });

    expect(result.recommendations).toHaveLength(1);
    expect(result.confidence).toBe("moderate");
  });
});

describe("on the real catalog (94 fragrances), over every season / weekday / hour", () => {
  it("always finds three picks, one per house", () => {
    for (const season of ["spring", "summer", "fall", "winter"]) {
      for (let weekday = 0; weekday < 7; weekday++) {
        for (let hour = 0; hour < 24; hour++) {
          expect(buildTodayRecommendations({ perfumes: fragrances, context: { season, hour, weekday } }).recommendations).toHaveLength(3);
        }
      }
    }
  });

  it("is 'high' on a social night, a workday daytime and a weekend daytime, and 'moderate' on an ordinary weekday evening", () => {
    const confidence = (context) => buildTodayRecommendations({ perfumes: fragrances, context }).confidence;

    expect(confidence({ season: "fall", hour: 21, weekday: 6 })).toBe("high");
    expect(confidence({ season: "summer", hour: 11, weekday: 2 })).toBe("high");
    expect(confidence({ season: "spring", hour: 10, weekday: 0 })).toBe("high");
    expect(confidence({ season: "fall", hour: 0, weekday: 3 })).toBe("moderate");
    expect(confidence({ season: "winter", hour: 19, weekday: 3 })).toBe("moderate");
  });

  it("a hot-season workday daytime picks warm-weather, office-ready fragrances, not winter ones", () => {
    const picks = buildTodayRecommendations({ perfumes: fragrances, context: TUE_NOON }).recommendations;

    picks.forEach(({ perfume: item }) => {
      expect(item.seasonWeights.summer).toBeGreaterThanOrEqual(8);
      expect(item.occasions).toContain("office");
    });
  });

  it("a social Saturday night picks fragrances that carry both date and night/club occasions", () => {
    const picks = buildTodayRecommendations({ perfumes: fragrances, context: SAT_NIGHT }).recommendations;

    picks.forEach(({ perfume: item }) => {
      expect(item.occasions).toContain("date");
      expect(item.occasions.some((occasion) => occasion === "night" || occasion === "club")).toBe(true);
    });
  });
});
