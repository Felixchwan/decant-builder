import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { fragrances } from "@discovery-box/catalog";
import { buildTodayRecommendations, scoreTodayCandidates } from "./buildTodayRecommendations.js";
import {
  NIGHT_CLUB_MARGIN,
  ROLE_MIN_NORMALIZED_SCORE,
  ROLE_MEMBERSHIP_BONUS,
  TODAY_FIXED_ROLES,
  WEEKEND_VACATION_MARGIN,
  buildTodayRoleRecommendations,
  resolveDynamicRole,
  roleMembershipBonus,
} from "./buildTodayRoleRecommendations.js";
import { deriveTodayContext } from "./todayContext.js";

const source = readFileSync(new URL("./buildTodayRoleRecommendations.js", import.meta.url), "utf8");

let nextId = 1;
const perfume = (overrides = {}) => ({
  id: nextId++,
  name: `Fragrance ${nextId}`,
  brand: `House ${nextId}`,
  points: 1,
  seasons: ["fall"],
  seasonWeights: { spring: 8, summer: 8, fall: 8, winter: 8 },
  occasions: [],
  vibes: [],
  accords: [],
  ...overrides,
});

// weekday: Sunday = 0. Season "fall" is a neutral choice: every synthetic fragrance weighs fall 8.
const at = (weekday, hour, extra = {}) => ({ season: "fall", weekday, hour, ...extra });
const TUE_11 = at(2, 11);
const WED_21 = at(3, 21);
const FRI_22 = at(5, 22);
const SAT_13 = at(6, 13);
const SUN_10 = at(0, 10);
const run = (perfumes, context, extra = {}) => buildTodayRoleRecommendations({ perfumes, context, ...extra });
const ids = (result) => result.recommendations.map(({ perfume: item }) => item.id);
const roles = (result) => result.recommendations.map(({ role }) => role.key);

// a catalog with every role well served, so selection (not fallback) is what is being tested
const wellServed = () => [
  perfume({ occasions: ["daily", "office", "casual"], vibes: ["fresh", "elegant"] }),
  perfume({ occasions: ["daily", "casual"], vibes: ["easy", "elegant"] }),
  perfume({ occasions: ["date", "night"], vibes: ["seductive", "elegant"] }),
  perfume({ occasions: ["date", "night", "club"], vibes: ["bold", "seductive"] }),
  perfume({ occasions: ["office", "daily"], vibes: ["clean", "elegant"] }),
  perfume({ occasions: ["casual", "vacation"], vibes: ["fresh", "easy"] }),
  perfume({ occasions: ["night", "club"], vibes: ["bold", "dark"] }),
];

describe("the role set: one Daily, one Date, one pick for the moment", () => {
  it("returns three picks in a fixed order, each with a merchant-neutral role", () => {
    const result = run(wellServed(), WED_21);

    expect(TODAY_FIXED_ROLES).toEqual(["daily", "date"]);
    expect(result.recommendations).toHaveLength(3);
    expect(roles(result)).toEqual(["daily", "date", "night"]);
    expect(result.recommendations.map(({ role }) => role.source)).toEqual(["fixed", "fixed", "contextual"]);
    result.recommendations.forEach(({ role }) => {
      expect(Object.keys(role).sort()).toEqual(["fallback", "key", "source"]);
      expect(role.fallback).toBe(false);
    });
  });

  it("exposes the selected third-role key explicitly, and it is the third pick's role", () => {
    const result = run(wellServed(), TUE_11);

    expect(result.dynamicRole).toBe("office");
    expect(result.recommendations[2].role.key).toBe(result.dynamicRole);
  });

  it("keeps the base result fields on every pick, with the role beside them", () => {
    const [first] = run(wellServed(), WED_21).recommendations;

    expect(Object.keys(first)).toEqual(expect.arrayContaining(["perfume", "score", "reasons", "confidence", "factors", "role"]));
    expect(first.reasons.length).toBeLessThanOrEqual(5);
  });

  it("is deterministic: the same input gives the same set, however the catalog is ordered, and nothing is mutated", () => {
    const pool = wellServed();
    const copy = JSON.parse(JSON.stringify(pool));
    const first = run(pool, FRI_22);

    expect(run(pool, FRI_22)).toEqual(first);
    expect(ids(run([...pool].reverse(), FRI_22))).toEqual(ids(first));
    expect(pool).toEqual(copy);
  });

  it("honours a smaller limit by keeping the roles in order, and never returns more than three", () => {
    const pool = wellServed();

    expect(roles(run(pool, WED_21, { limit: 1 }))).toEqual(["daily"]);
    expect(roles(run(pool, WED_21, { limit: 2 }))).toEqual(["daily", "date"]);
    expect(run(pool, WED_21, { limit: 10 }).recommendations).toHaveLength(3);
    expect(run(pool, WED_21, { limit: 0 }).recommendations).toEqual([]);
  });

  it("is empty, never throwing, for an unusable context or catalog", () => {
    expect(run(wellServed(), null).recommendations).toEqual([]);
    expect(run(wellServed(), { season: "fall" }).dynamicRole).toBeNull();
    expect(run(null, WED_21).recommendations).toEqual([]);
    expect(run([null, {}, { id: "x" }], WED_21)).toMatchObject({ recommendations: [], dynamicRole: null });
    expect(buildTodayRoleRecommendations().recommendations).toEqual([]);
  });

  it("the set is as sure as its weakest pick", () => {
    expect(run(wellServed(), WED_21).confidence).toBe("moderate"); // a weekday evening has no day context
    expect(run(wellServed(), SAT_13).confidence).toMatch(/^(high|moderate)$/);
  });
});

describe("the third role: derived from the moment, deterministically, from existing occasion keys", () => {
  const dynamic = (context, perfumes = wellServed()) => run(perfumes, context).dynamicRole;

  it("workday daytime -> office", () => {
    expect(dynamic(at(1, 8))).toBe("office"); // Monday morning
    expect(dynamic(TUE_11)).toBe("office");
    expect(dynamic(at(5, 16))).toBe("office"); // Friday afternoon, before the social night
  });

  it("weekend daytime -> casual", () => {
    expect(dynamic(SAT_13)).toBe("casual");
    expect(dynamic(SUN_10)).toBe("casual");
    expect(dynamic(at(0, 19))).toBe("casual"); // a Sunday early evening is still weekend daytime
  });

  it("weekend daytime -> vacation only when the moment supports it AND a vacation fragrance clearly outscores casual's", () => {
    const summer = at(6, 13, { season: "summer" });
    const casualDaily = perfume({ occasions: ["casual", "daily"], seasonWeights: { spring: 5, summer: 5, fall: 5, winter: 5 } });
    const weakCasual = perfume({ occasions: ["casual"], seasonWeights: { spring: 5, summer: 5, fall: 5, winter: 5 } });
    const similarVacation = perfume({ occasions: ["vacation", "casual"], seasonWeights: { spring: 5, summer: 5, fall: 5, winter: 5 } });
    const strongVacation = perfume({ occasions: ["vacation", "casual", "daily"], vibes: ["fresh", "bright"] });

    expect(dynamic(summer, [casualDaily, weakCasual])).toBe("casual");
    expect(dynamic(summer, [casualDaily, similarVacation])).toBe("casual"); // not a clear margin
    expect(dynamic(summer, [weakCasual, strongVacation])).toBe("vacation");
    // the moment must support it: a fall weekend is casual however good the vacation fragrance, a warm reading supports it
    expect(dynamic(at(6, 13), [weakCasual, strongVacation])).toBe("casual");
    expect(dynamic(at(6, 13, { temperatureBucket: "warm" }), [weakCasual, strongVacation])).toBe("vacation");
    expect(dynamic(at(6, 13, { temperatureBucket: "cold" }), [weakCasual, strongVacation])).toBe("casual");
    expect(WEEKEND_VACATION_MARGIN).toBeGreaterThan(0);
  });

  it("Friday / Saturday evening or night -> night", () => {
    expect(dynamic(at(5, 18))).toBe("night"); // Friday 18:00 is the start of the social night
    expect(dynamic(FRI_22)).toBe("night");
    expect(dynamic(at(6, 20))).toBe("night");
    expect(dynamic(at(6, 3))).toBe("night"); // Saturday's small hours belong to Friday night
  });

  it("club wins a social NIGHT only with strong metadata support (a club AND night fragrance that clearly outscores the night pick)", () => {
    const plainNight = perfume({ occasions: ["night"] });
    const nightOnly = [plainNight, perfume({ occasions: ["night", "date"], vibes: ["seductive"] })];
    const strongClub = perfume({ occasions: ["club", "night"], vibes: ["bold", "seductive", "dark"], seasonWeights: { spring: 8, summer: 8, fall: 10, winter: 8 } });
    const clubWithoutNight = perfume({ occasions: ["club"], vibes: ["bold", "seductive", "dark"], seasonWeights: { spring: 8, summer: 8, fall: 10, winter: 8 } });
    const similarClub = perfume({ occasions: ["club", "night"] });

    expect(dynamic(FRI_22, nightOnly)).toBe("night");
    expect(dynamic(FRI_22, [plainNight, strongClub])).toBe("club");
    expect(dynamic(at(6, 23), [plainNight, strongClub])).toBe("club");
    expect(dynamic(FRI_22, [plainNight, clubWithoutNight])).toBe("night"); // a club tag without a night tag is not strong support
    expect(dynamic(FRI_22, [plainNight, similarClub])).toBe("night"); // no clear margin
    expect(dynamic(at(5, 19), [plainNight, strongClub])).toBe("night"); // evening is not night-time
    expect(dynamic(WED_21, [plainNight, strongClub])).toBe("night"); // an ordinary weeknight is never club
    expect(NIGHT_CLUB_MARGIN).toBeGreaterThan(0);
  });

  it("an ordinary weekday evening or night -> night", () => {
    expect(dynamic(at(3, 17))).toBe("night");
    expect(dynamic(WED_21)).toBe("night");
    expect(dynamic(at(2, 23))).toBe("night");
    expect(dynamic(at(1, 3))).toBe("night"); // the small hours of a Monday
  });

  it("Sunday day / night boundaries: 04:00 is still Saturday's social night, 05:00 is daytime, 21:00 an ordinary night", () => {
    expect(deriveTodayContext(at(0, 4)).dayContext).toBe("social_night");
    expect(dynamic(at(0, 4))).toBe("night");
    expect(dynamic(at(0, 5))).toBe("casual");
    expect(dynamic(SUN_10)).toBe("casual");
    expect(dynamic(at(0, 20))).toBe("casual");
    expect(deriveTodayContext(at(0, 21)).dayContext).toBeNull();
    expect(dynamic(at(0, 21))).toBe("night");
  });

  it("falls back to casual when the moment is none of the above", () => {
    expect(resolveDynamicRole({ dayContext: null, time: "daytime" }, [])).toBe("casual");
    expect(resolveDynamicRole({ dayContext: null, time: "morning" }, [])).toBe("casual");
  });

  it("weather alone can never produce date or club (or anything outside office / casual / vacation / night / club)", () => {
    const pool = wellServed().map((item) => ({ ...item, occasions: item.occasions.filter((key) => key !== "club" && key !== "vacation") }));

    for (const temperatureBucket of [undefined, "hot", "warm", "mild", "cool", "cold"]) {
      for (const weatherCondition of [undefined, "clear", "cloudy", "rain"]) {
        for (const base of [TUE_11, WED_21, FRI_22, SAT_13, SUN_10]) {
          const result = run(pool, { ...base, temperatureBucket, weatherCondition });

          expect(["office", "casual", "night"]).toContain(result.dynamicRole);
          expect(result.dynamicRole).toBe(run(pool, base).dynamicRole); // the role is the moment's, not the weather's
        }
      }
    }
  });

  it("only ever picks an existing occasion key", () => {
    const keys = new Set(fragrances.flatMap(({ occasions }) => occasions));

    for (const base of [TUE_11, WED_21, FRI_22, SAT_13, SUN_10]) {
      expect(keys.has(run(fragrances, base).dynamicRole)).toBe(true);
    }
  });
});

describe("role-aware selection: membership, quality, one role per perfume", () => {
  it("requires the occasion: a fixed role is never filled by a fragrance without it", () => {
    const result = run(wellServed(), WED_21);

    result.recommendations.forEach(({ perfume: item, role }) => expect(item.occasions).toContain(role.key));
  });

  it("a fragrance fills one role only, and Daily and Date never collapse onto one fragrance", () => {
    const both = perfume({ occasions: ["daily", "date", "night"], vibes: ["elegant", "seductive", "fresh"] });
    const others = [
      perfume({ occasions: ["daily", "night"], vibes: ["elegant"] }),
      perfume({ occasions: ["date", "night"], vibes: ["seductive"] }),
      perfume({ occasions: ["night"], vibes: ["bold"] }),
    ];
    const result = run([both, ...others], WED_21);

    expect(new Set(ids(result)).size).toBe(3);
    expect(result.recommendations.filter(({ perfume: item }) => item.id === both.id).length).toBeLessThanOrEqual(1);
  });

  it("the third pick never reuses a fixed pick", () => {
    const pool = [
      perfume({ occasions: ["daily", "office", "date"], vibes: ["clean"] }),
      perfume({ occasions: ["date", "office"], vibes: ["elegant"] }),
      perfume({ occasions: ["office"], vibes: ["clean"] }),
    ];
    const result = run(pool, TUE_11);

    expect(new Set(ids(result)).size).toBe(result.recommendations.length);
  });

  it("at most one fragrance per house when valid alternatives exist", () => {
    const sameHouse = [
      perfume({ brand: "Casa", occasions: ["daily", "office"], vibes: ["fresh", "clean"] }),
      perfume({ brand: "Casa", occasions: ["date", "night"], vibes: ["seductive", "elegant"] }),
      perfume({ brand: "Otra", occasions: ["date", "night"], vibes: ["seductive"] }),
      perfume({ brand: "Tercera", occasions: ["night"], vibes: ["bold"] }),
      perfume({ brand: "Cuarta", occasions: ["night", "daily"], vibes: ["bold"] }),
    ];
    const houses = run(sameHouse, WED_21).recommendations.map(({ perfume: item }) => item.brand);

    expect(new Set(houses).size).toBe(houses.length);
  });

  it("a house is shared only when no alternative exists, and the set is still filled", () => {
    const onlyCasa = [
      perfume({ brand: "Casa", occasions: ["daily", "night"], vibes: ["elegant"] }),
      perfume({ brand: "Casa", occasions: ["date", "night"], vibes: ["seductive"] }),
      perfume({ brand: "Casa", occasions: ["night"], vibes: ["bold"] }),
    ];
    const result = run(onlyCasa, WED_21);

    expect(result.recommendations).toHaveLength(3);
    expect(result.recommendations.every(({ role }) => !role.fallback)).toBe(true);
  });

  it("chooses the three TOGETHER: the best Daily is not taken if it is the only Date", () => {
    const shared = perfume({ occasions: ["daily", "date", "night"], vibes: ["elegant", "seductive"], seasonWeights: { spring: 10, summer: 10, fall: 10, winter: 10 } });
    const dailyOnly = perfume({ occasions: ["daily", "night"], vibes: ["elegant"], seasonWeights: { spring: 6, summer: 6, fall: 6, winter: 6 } });
    const filler = perfume({ occasions: ["night"], vibes: ["bold"] });
    const result = run([shared, dailyOnly, filler], WED_21);

    // Greedy (Daily first) would give the Daily to `shared` and leave the Date with nothing real.
    expect(result.recommendations.find(({ role }) => role.key === "date").perfume.id).toBe(shared.id);
    expect(result.recommendations.find(({ role }) => role.key === "daily").perfume.id).toBe(dailyOnly.id);
    expect(result.recommendations.some(({ role }) => role.fallback)).toBe(false);
  });

  it("the role bonus is one constant for membership and 0 without it: occasion order carries no meaning", () => {
    const first = perfume({ occasions: ["date", "night"] });
    const third = perfume({ occasions: ["night", "daily", "date"] });
    const last = perfume({ occasions: ["a", "b", "c", "d", "e", "date"] });
    const none = perfume({ occasions: ["night"] });

    expect(ROLE_MEMBERSHIP_BONUS).toBe(10);
    [first, third, last].forEach((item) => expect(roleMembershipBonus(item, "date")).toBe(ROLE_MEMBERSHIP_BONUS));
    expect(roleMembershipBonus(none, "date")).toBe(0);
    expect(roleMembershipBonus({}, "date")).toBe(0);
  });

  it("reordering a fragrance's occasions never changes the result (they are tags, not ranked weights)", () => {
    const shuffle = (item) => ({ ...item, occasions: [...item.occasions].reverse() });

    for (const moment of [TUE_11, WED_21, FRI_22, SAT_13, SUN_10]) {
      const plain = run(fragrances, moment);
      const reordered = run(fragrances.map(shuffle), moment);

      expect(ids(reordered)).toEqual(ids(plain));
      expect(reordered.dynamicRole).toBe(plain.dynamicRole);
      expect(roles(reordered)).toEqual(roles(plain));
    }
  });

  it("within a role the contextual score decides: equal tags, better moment fit wins", () => {
    const worse = perfume({ occasions: ["date", "night"], vibes: [], seasonWeights: { spring: 6, summer: 6, fall: 6, winter: 6 } });
    const better = perfume({ occasions: ["night", "date"], vibes: ["seductive", "elegant"], seasonWeights: { spring: 9, summer: 9, fall: 9, winter: 9 } });
    const date = run([worse, better, perfume({ occasions: ["daily", "night"], vibes: ["elegant"] })], WED_21, { limit: 2 }).recommendations.find(({ role }) => role.key === "date");

    expect(date.perfume.id).toBe(better.id);
  });

  it("when interchangeable fragrances tie on the combined score, the earlier role gets the stronger contextual pick (never decided by id)", () => {
    const weights = (value) => ({ spring: value, summer: value, fall: value, winter: value });
    const weakest = perfume({ occasions: ["daily", "date", "casual"], vibes: ["fresh"], seasonWeights: weights(6) });
    const middle = perfume({ occasions: ["daily", "date", "casual"], vibes: ["fresh"], seasonWeights: weights(8) });
    const strongest = perfume({ occasions: ["daily", "date", "casual"], vibes: ["fresh"], seasonWeights: weights(10) });
    const result = run([weakest, middle, strongest], SAT_13); // the lowest id is the weakest fit

    expect(ids(result)).toEqual([strongest.id, middle.id, weakest.id]);
    expect(roles(result)).toEqual(["daily", "date", "casual"]);
  });

  it("a role tag cannot carry a seasonally wrong fragrance: it must show contextual quality", () => {
    const winterDate = perfume({ occasions: ["date", "night"], vibes: ["seductive"], seasonWeights: { spring: 0, summer: 0, fall: 0, winter: 10 } });
    const summerDate = perfume({ occasions: ["date", "night"], vibes: ["seductive"], seasonWeights: { spring: 8, summer: 10, fall: 5, winter: 0 } });
    const filler = [perfume({ occasions: ["daily"], vibes: ["fresh"] }), perfume({ occasions: ["night"], vibes: ["bold"] })];
    const result = run([winterDate, summerDate, ...filler], at(5, 22, { season: "summer", temperatureBucket: "hot" }));
    const date = result.recommendations.find(({ role }) => role.key === "date");

    expect(date.perfume.id).toBe(summerDate.id);
    // the winter fragrance may only ever appear as a flagged fallback, never as a pick chosen for a role it merely carries a tag for
    expect(result.recommendations.filter(({ role }) => !role.fallback).map(({ perfume: item }) => item.id)).not.toContain(winterDate.id);
    expect(ROLE_MIN_NORMALIZED_SCORE).toBeGreaterThan(0);
  });
});

describe("fallback: never a forced weak pick, never fabricated evidence", () => {
  it("a role with no sensible candidate takes the best unused pick of the plain Today ranking and says so", () => {
    const noDate = [
      perfume({ occasions: ["daily", "night"], vibes: ["elegant", "fresh"] }),
      perfume({ occasions: ["night"], vibes: ["bold", "dark"] }),
      perfume({ occasions: ["night", "club"], vibes: ["bold"] }),
      perfume({ occasions: ["office"], vibes: ["clean"] }),
    ];
    const result = run(noDate, WED_21);
    const date = result.recommendations.find(({ role }) => role.key === "date");

    expect(result.recommendations).toHaveLength(3);
    expect(date.role).toEqual({ key: "date", source: "fixed", fallback: true });
    expect(date.perfume.occasions).not.toContain("date"); // no occasion evidence was invented
    expect(date.roleScore).toBeNull();
    expect(new Set(ids(result)).size).toBe(3);
  });

  it("a tagged but contextually unsuitable fragrance is not forced into the role", () => {
    const winterOnlyDate = perfume({ occasions: ["date", "night"], vibes: ["seductive"], seasonWeights: { spring: 0, summer: 0, fall: 0, winter: 10 } });
    const rest = [perfume({ occasions: ["daily"], vibes: ["fresh"] }), perfume({ occasions: ["night"], vibes: ["bold"] }), perfume({ occasions: ["office"], vibes: ["clean"] })];
    const result = run([winterOnlyDate, ...rest], at(5, 22, { season: "summer", temperatureBucket: "hot" }));

    expect(result.recommendations.find(({ role }) => role.key === "date").role.fallback).toBe(true);
  });

  it("a catalog too small to fill every role returns the picks it can, once each", () => {
    const result = run([perfume({ occasions: ["daily", "date", "night"], vibes: ["fresh"] })], WED_21);

    expect(result.recommendations).toHaveLength(1);
    expect(result.recommendations[0].role.fallback).toBe(false);
  });

  it("an empty catalog returns no picks and a null confidence", () => {
    expect(run([], WED_21)).toMatchObject({ recommendations: [], confidence: null, dynamicRole: null });
  });
});

describe("the base TodayScore is unchanged: only the selection layer is new", () => {
  const MOMENTS = [
    TUE_11,
    WED_21,
    FRI_22,
    SAT_13,
    SUN_10,
    { season: "summer", weekday: 2, hour: 11, temperatureBucket: "hot", weatherCondition: "clear" },
    { season: "winter", weekday: 5, hour: 22, temperatureBucket: "cold", weatherCondition: "rain" },
    { season: "spring", weekday: 6, hour: 13, temperatureBucket: "mild" },
  ];
  const stripRole = (pick) => {
    const base = { ...pick };

    delete base.role;
    delete base.roleScore;

    return base;
  };

  it("every picked fragrance carries exactly the base engine's score, factors, reasons and confidence for that moment", () => {
    for (const moment of MOMENTS) {
      const base = new Map(scoreTodayCandidates(fragrances, deriveTodayContext(moment)).map((candidate) => [candidate.perfume.id, candidate]));
      const result = run(fragrances, moment);

      expect(result.recommendations.length).toBe(3);
      result.recommendations.forEach((pick) => expect(stripRole(pick)).toEqual(base.get(pick.perfume.id)));
    }
  });

  it("the plain ranker is untouched by the role layer: it returns the same top three as before", () => {
    for (const moment of MOMENTS) {
      const direct = buildTodayRecommendations({ perfumes: fragrances, context: moment });
      const viaScoring = scoreTodayCandidates(fragrances, deriveTodayContext(moment));

      expect(direct.recommendations.map(({ perfume: item }) => item.id)).toEqual(
        // one per house, best first: recomputed independently from the scored list
        (() => {
          const houses = new Set();

          return viaScoring.filter(({ perfume: item }) => (houses.has(item.brand) ? false : houses.add(item.brand))).slice(0, 3).map(({ perfume: item }) => item.id);
        })()
      );
    }
  });

  it("RoleScore = TodayScore + the constant membership bonus, and the TodayScore on the pick stays the base one", () => {
    const result = run(fragrances, FRI_22);

    result.recommendations
      .filter(({ role }) => !role.fallback)
      .forEach((pick) => expect(pick.roleScore).toBeCloseTo(pick.score + ROLE_MEMBERSHIP_BONUS, 2));
  });

  it("the role layer changes WHICH three are returned, not how any fragrance scores", () => {
    const moment = SAT_13;
    const plain = buildTodayRecommendations({ perfumes: fragrances, context: moment }).recommendations.map(({ perfume: item }) => item.id);
    const roleIds = ids(run(fragrances, moment));

    // different selection rule; the scores of anything in both sets are identical
    const roleSet = run(fragrances, moment).recommendations;
    const plainSet = buildTodayRecommendations({ perfumes: fragrances, context: moment }).recommendations;

    expect(plain.length).toBe(3);
    expect(roleIds.length).toBe(3);
    roleSet.forEach((pick) => {
      const same = plainSet.find(({ perfume: item }) => item.id === pick.perfume.id);

      if (same) expect(same.score).toBe(pick.score);
    });
  });
});

describe("on the real catalog (94 fragrances), over every season / weekday / hour and a spread of weather", () => {
  const WEATHER = [{}, { temperatureBucket: "hot" }, { temperatureBucket: "cold", weatherCondition: "rain" }, { temperatureBucket: "mild", weatherCondition: "cloudy" }];
  const sweep = [];

  for (const season of ["spring", "summer", "fall", "winter"]) {
    for (let weekday = 0; weekday < 7; weekday++) {
      for (let hour = 0; hour < 24; hour += 1) {
        for (const weather of WEATHER) sweep.push({ season, weekday, hour, ...weather });
      }
    }
  }

  const results = sweep.map((context) => ({ context, result: run(fragrances, context) }));

  it("always finds three picks: Daily, Date and the moment's occasion, in that order", () => {
    results.forEach(({ result }) => {
      expect(result.recommendations).toHaveLength(3);
      expect(result.recommendations.slice(0, 2).map(({ role }) => role.key)).toEqual(["daily", "date"]);
      expect(result.recommendations[2].role.key).toBe(result.dynamicRole);
    });
  });

  it("never repeats a fragrance or a house", () => {
    results.forEach(({ result }) => {
      expect(new Set(ids(result)).size).toBe(3);
      expect(new Set(result.recommendations.map(({ perfume: item }) => item.brand)).size).toBe(3);
    });
  });

  it("every pick really carries the occasion of its role", () => {
    results.forEach(({ result }) => {
      result.recommendations.forEach(({ perfume: item, role }) => {
        expect(role.fallback).toBe(false);
        expect(item.occasions).toContain(role.key);
      });
    });
  });

  it("the third role is only ever office, casual, vacation, night or club, and matches the documented rule", () => {
    results.forEach(({ result, context }) => {
      const { dayContext, time } = deriveTodayContext(context);

      if (dayContext === "workday_daytime") expect(result.dynamicRole).toBe("office");
      else if (dayContext === "weekend_daytime") expect(["casual", "vacation"]).toContain(result.dynamicRole);
      else if (dayContext === "social_night") expect(["night", "club"]).toContain(result.dynamicRole);
      else expect(time === "evening" || time === "night" ? result.dynamicRole === "night" : result.dynamicRole === "casual").toBe(true);

      if (result.dynamicRole === "club") expect(dayContext === "social_night" && time === "night").toBe(true);
    });
  });

  it("the real catalog never needs a fallback", () => {
    expect(results.filter(({ result }) => result.recommendations.some(({ role }) => role.fallback))).toEqual([]);
  });
});

describe("the role layer's own source", () => {
  it("never reads price, tier, market segment or the box, and holds no Spanish or analytics", () => {
    const code = source.replace(/^\s*\/\/.*$/gm, "");

    expect(code).not.toMatch(/\.points\b|\.tier\b|segment|selectedPerfume|boxSummary|analytics/i);
    expect(code).not.toMatch(/Diario|Citas|Oficina|Noche|Vacaciones|Fiesta|Casual\b/);
  });

  it("does not touch the weather integration or the scoring weights", () => {
    expect(source).not.toMatch(/metNorway|fetch\(|TODAY_FACTOR_MAX\s*=|TODAY_LIVE_FACTOR_MAX\s*=/);
    expect(source).toContain('from "./buildTodayRecommendations.js"');
  });
});
