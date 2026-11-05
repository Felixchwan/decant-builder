import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { fragrances } from "@discovery-box/catalog";
import { aurelianTaxonomyLabels } from "../../../../../../apps/aurelian/src/merchant/taxonomyLabels.js";
import { createTranslator } from "../../../i18n/createTranslator.js";
import { getTodayReasonLabels } from "../../presentation/todayRecommendationLabels.js";
import { buildTodayRecommendations } from "./buildTodayRecommendations.js";
import { buildTodayRoleRecommendations } from "./buildTodayRoleRecommendations.js";
import { MAX_TODAY_EXPLANATION_LINES, deriveTodayExplanation, deriveTodayExplanations } from "./deriveTodayExplanation.js";

// the host supplies the accord names (Aurelian's editorial Spanish); the Builder only looks them up
const es = createTranslator("es-MX", aurelianTaxonomyLabels);
const en = createTranslator("en-US");
const source = readFileSync(new URL("./deriveTodayExplanation.js", import.meta.url), "utf8");

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

const at = (weekday, hour, extra = {}) => ({ season: "fall", weekday, hour, ...extra });
const run = (perfumes, context, extra = {}) => buildTodayRoleRecommendations({ perfumes, context, ...extra });
const codes = (pick) => pick.explanation.map(({ code }) => code);
const lines = (pick, translator = es) => getTodayReasonLabels(pick, translator);

// A translator that records which catalog words a line was built from, so every descriptor can be traced to the fragrance.
function recordingTranslator(base = es) {
  const used = { descriptors: [], accords: [] };

  return {
    used,
    translator: {
      ...base,
      t: (key, values) => {
        const match = /^suggestions\.today\.descriptor\.(.+)$/.exec(key);

        if (match && base.t(key, values) !== key) used.descriptors.push(match[1]);

        return base.t(key, values);
      },
      label: (type, value, fallback) => {
        if (type === "accords") used.accords.push(value);

        return base.label(type, value, fallback);
      },
    },
  };
}

describe("a profile line pairs the moment with the fragrance's own accords and vibes", () => {
  const hot = { season: "summer", weekday: 2, hour: 11, temperatureBucket: "hot" };
  const freshPick = () =>
    run([perfume({ occasions: ["daily", "office", "casual", "date"], vibes: ["fresh", "clean"], accords: ["citrus", "marine", "woody"] })], hot, { limit: 1 }).recommendations[0];

  it("weather + accords/vibes: a fresh profile in the heat names the fragrance's own fresh accords and vibes", () => {
    const pick = freshPick();

    expect(codes(pick)[0]).toBe("profileWeather");
    expect(pick.explanation[0].evidence).toMatchObject({ profile: "heat", temperatureBucket: "hot", accords: ["citrus", "marine"], vibes: ["fresh", "clean"] });
    expect(lines(pick)[0]).toBe("Su perfil cítrico, marino y fresco funciona especialmente bien con el calor");
  });

  it("cool or cold weather: a warm profile names warm accords as notes and cozy vibes as qualities", () => {
    const cold = run(
      [perfume({ occasions: ["daily", "night"], vibes: ["cozy", "warm"], accords: ["warm spicy", "vanilla", "tobacco", "citrus"] })],
      at(3, 21, { temperatureBucket: "cool" }),
      { limit: 1 }
    ).recommendations[0];

    expect(codes(cold)[0]).toBe("profileWeather");
    expect(lines(cold)[0]).toBe("Su perfil especiado, acogedor y cálido, con vainilla y tabaco, encaja especialmente bien con el clima fresco");
  });

  it("rain: a warm profile, said only when it is raining", () => {
    const rainy = run([perfume({ occasions: ["daily", "night"], vibes: ["cozy"], accords: ["amber"] })], at(3, 21, { weatherCondition: "rain" }), { limit: 1 }).recommendations[0];

    expect(lines(rainy)[0]).toBe("Su perfil acogedor, con ámbar, encaja bien con un día lluvioso");
  });

  it("time + vibes: a day or night character from the vibes the time-of-day factor itself matched", () => {
    const day = run([perfume({ occasions: ["daily", "office"], vibes: ["fresh", "clean", "bold"] })], at(2, 11), { limit: 1 }).recommendations[0];
    const night = run([perfume({ occasions: ["daily", "night"], vibes: ["seductive", "bold", "fresh"] })], at(3, 21), { limit: 1 }).recommendations[0];

    expect(codes(day)).toContain("profileTime");
    expect(lines(day).join(" | ")).toContain("Su carácter fresco y limpio va bien con el día");
    expect(lines(day).join(" | ")).not.toMatch(/audaz/); // a night vibe, not a day one
    expect(lines(night)[0]).toBe("Su carácter seductor y audaz va bien con la noche");
    expect(lines(night)[0]).not.toMatch(/fresco/); // a day vibe, not a night one
  });

  it("role: says what the profile adds, from the fragrance's own vibes, and only for a role it really fills", () => {
    const pool = [
      perfume({ occasions: ["daily", "night"], vibes: ["versatile", "bold"] }),
      perfume({ occasions: ["date", "night"], vibes: ["seductive", "bold"] }),
      perfume({ occasions: ["night"], vibes: ["bold"] }),
    ];
    const result = run(pool, at(3, 21));
    const dailyPick = result.recommendations.find(({ role }) => role.key === "daily");

    expect(dailyPick.role.fallback).toBe(false);
    expect(deriveTodayExplanation({ ...dailyPick, explanation: undefined }).some(({ code }) => code === "profileRole")).toBe(true);
    // a fallback pick is not chosen for the role, so it never gets a role line
    expect(deriveTodayExplanation({ ...dailyPick, role: { key: "daily", source: "fixed", fallback: true } }).some(({ code }) => code === "profileRole")).toBe(false);
  });

  it("speaks English from the en-US dictionary too", () => {
    expect(lines(freshPick(), en)[0]).toBe("Its citrusy, marine and fresh profile works especially well in the heat");
  });
});

describe("no line without its evidence", () => {
  it("no weather line without weather: no temperature and no rain -> no profileWeather, ever, on the real catalog", () => {
    for (const season of ["spring", "summer", "fall", "winter"]) {
      for (let weekday = 0; weekday < 7; weekday++) {
        for (let hour = 0; hour < 24; hour++) {
          for (const pick of run(fragrances, { season, weekday, hour }).recommendations) expect(codes(pick)).not.toContain("profileWeather");
        }
      }
    }
  }, 60000);

  it("'cloudy' alone adds no weather line either", () => {
    for (const pick of run(fragrances, at(3, 21, { weatherCondition: "cloudy" })).recommendations) expect(codes(pick)).not.toContain("profileWeather");
  });

  it("a mild, dry day has no weather profile to match, so no weather line", () => {
    for (const pick of run(fragrances, at(6, 13, { temperatureBucket: "mild", weatherCondition: "clear" })).recommendations) expect(codes(pick)).not.toContain("profileWeather");
  });

  it("no night wording without night evidence: a night line exists only when the context's time is evening or night", () => {
    for (const season of ["spring", "fall"]) {
      for (let weekday = 0; weekday < 7; weekday++) {
        for (let hour = 0; hour < 24; hour++) {
          const result = run(fragrances, { season, weekday, hour });

          for (const pick of result.recommendations) {
            const text = lines(pick).join(" | ");
            const isEvening = hour >= 17 || hour < 5;

            if (/con la noche|con la tarde/.test(text)) expect(isEvening, `${weekday} ${hour}`).toBe(true);
            if (/con el día|con la mañana/.test(text)) expect(isEvening && hour >= 21, `${weekday} ${hour}`).toBe(false);
          }
        }
      }
    }
  });

  it("no occasion claim without the occasion in the metadata (a cita needs date, a salida de noche needs night, the office needs office)", () => {
    const moments = [at(3, 21), at(5, 22), at(2, 11), at(6, 13), at(0, 10), at(1, 8, { temperatureBucket: "hot" }), at(6, 23, { temperatureBucket: "cold", weatherCondition: "rain" })];

    for (const moment of moments) {
      for (const pick of run(fragrances, moment).recommendations) {
        const text = lines(pick).join(" | ");

        if (/encaja con una cita|Para una cita|Buena para una cita/.test(text)) expect(pick.perfume.occasions).toContain("date");
        if (/salida de noche/.test(text)) expect(pick.perfume.occasions.some((key) => key === "night" || key === "club")).toBe(true);
        if (/con la oficina|Funciona bien para la oficina/.test(text)) expect(pick.perfume.occasions).toContain("office");
        if (/uso diario/.test(text)) expect(pick.perfume.occasions).toContain("daily");
        if (/plan casual/.test(text)) expect(pick.perfume.occasions).toContain("casual");
      }
    }
  });

  it("a role line needs the occasion, a real (non-fallback) role, and a vibe the role's profile names", () => {
    const base = { factors: [], reasons: [], perfume: perfume({ occasions: ["daily"], vibes: ["versatile"] }) };
    const roleLines = (overrides) => deriveTodayExplanation({ ...base, ...overrides }).filter(({ code }) => code === "profileRole");

    expect(roleLines({ role: { key: "daily", source: "fixed", fallback: false } })).toHaveLength(1);
    expect(roleLines({ role: { key: "daily", source: "fixed", fallback: true } })).toHaveLength(0);
    expect(roleLines({ role: { key: "date", source: "fixed", fallback: false } })).toHaveLength(0); // the fragrance has no date occasion
    expect(roleLines({ role: { key: "daily", source: "fixed", fallback: false }, perfume: perfume({ occasions: ["daily"], vibes: ["bold"] }) })).toHaveLength(0);
    expect(roleLines({ role: undefined })).toHaveLength(0);
  });

  it("a weather or time factor below 60% of its maximum, or with no matched descriptor, explains nothing", () => {
    const weak = { code: "weather", points: 4, max: 10, evidence: { profile: "heat", temperatureBucket: "hot", accords: ["citrus"], vibes: [] } };
    const empty = { code: "weather", points: 10, max: 10, evidence: { profile: "heat", temperatureBucket: "hot", accords: [], vibes: [] } };
    const noVibes = { code: "timeOfDay", points: 40, max: 40, evidence: { time: "night", occasions: ["night"], vibes: [] } };

    for (const factor of [weak, empty, noVibes]) expect(deriveTodayExplanation({ factors: [factor], reasons: [], perfume: perfume() })).toEqual([]);
  });
});

describe("every displayed descriptor is traceable to the fragrance and to a scored factor", () => {
  const moments = [];

  for (const season of ["spring", "summer", "fall", "winter"]) {
    for (const weekday of [0, 2, 3, 5, 6]) {
      for (const hour of [8, 11, 14, 19, 21, 23]) {
        for (const weather of [{}, { temperatureBucket: "hot" }, { temperatureBucket: "cold", weatherCondition: "rain" }, { temperatureBucket: "cool" }]) {
          moments.push({ season, weekday, hour, ...weather });
        }
      }
    }
  }

  const results = moments.map((context) => ({ context, result: run(fragrances, context) }));

  it("every explanation entry comes from a non-zero scored factor, a real role or a base reason, with its own evidence", () => {
    results.forEach(({ result }) => {
      result.recommendations.forEach((pick) => {
        pick.explanation.forEach((entry) => {
          if (entry.code === "profileWeather") {
            const factor = pick.factors.find(({ code }) => code === "weather");

            expect(factor.points).toBeGreaterThan(0);
            expect(entry.evidence.accords).toEqual(factor.evidence.accords);
            expect(entry.evidence.vibes).toEqual(factor.evidence.vibes);
            entry.evidence.accords.forEach((key) => expect(pick.perfume.accords).toContain(key));
            entry.evidence.vibes.forEach((key) => expect(pick.perfume.vibes).toContain(key));
          } else if (entry.code === "profileTime") {
            const factor = pick.factors.find(({ code }) => code === "timeOfDay");

            expect(factor.points).toBeGreaterThan(0);
            expect(entry.evidence.time).toBe(result.context.time);
            expect(entry.evidence.vibes).toEqual(factor.evidence.vibes);
            entry.evidence.vibes.forEach((key) => expect(pick.perfume.vibes).toContain(key));
          } else if (entry.code === "profileRole") {
            expect(pick.role.fallback).toBe(false);
            expect(entry.evidence.role).toBe(pick.role.key);
            expect(pick.perfume.occasions).toContain(pick.role.key);
            entry.evidence.vibes.forEach((key) => expect(pick.perfume.vibes).toContain(key));
          } else {
            expect(pick.reasons).toContainEqual(entry); // a base reason, untouched
          }
        });
      });
    });
  });

  it("every word a line is built from is an accord or vibe the fragrance actually carries", () => {
    results.forEach(({ result }) => {
      result.recommendations.forEach((pick) => {
        const { used, translator } = recordingTranslator();

        getTodayReasonLabels(pick, translator);
        used.descriptors.forEach((key) => expect([...pick.perfume.accords, ...pick.perfume.vibes], key).toContain(key));
        used.accords.forEach((key) => expect(pick.perfume.accords, key).toContain(key));
      });
    });
  });

  it("no line makes a claim the catalog has no field for", () => {
    const unsupported = /proyecci|estela|duraci|longevidad|sillage|proyect|proyecta|intimid|íntim|sensual|romántic|romantic|de lujo|potencia|rendimiento|proyección/i;

    results.forEach(({ result }) => result.recommendations.forEach((pick) => expect(lines(pick).join(" | ")).not.toMatch(unsupported)));
  });

  it("at most two lines, never empty, and every explanation entry renders", () => {
    results.forEach(({ result }) => {
      result.recommendations.forEach((pick) => {
        expect(pick.explanation.length).toBeLessThanOrEqual(MAX_TODAY_EXPLANATION_LINES);
        expect(lines(pick).length).toBeGreaterThan(0);
        expect(lines(pick).length).toBeLessThanOrEqual(2);
        lines(pick).forEach((line) => expect(line).not.toMatch(/suggestions\.today|undefined|\{[a-z]+\}/));
        // each entry that is a profile line renders to its own non-empty sentence
        pick.explanation.filter(({ code }) => code.startsWith("profile")).forEach((entry) => expect(getTodayReasonLabels({ explanation: [entry] }, es)[0]).not.toBe("Una opción razonable para este momento"));
      });
    });
  });

  it("the moment's own reasons are not repeated beside the profile line that covers them", () => {
    results.forEach(({ result }) => {
      result.recommendations.forEach((pick) => {
        const entryCodes = codes(pick);

        if (entryCodes.includes("profileWeather")) expect(entryCodes).not.toContain("weather");
        if (entryCodes.includes("profileWeather")) expect(entryCodes).not.toContain("temperature");
        if (entryCodes.includes("profileTime")) expect(entryCodes).not.toContain("timeOfDay");
      });
    });
  });
});

describe("variety within a set, without inventing it", () => {
  const picks = (...specs) =>
    specs.map((spec) => ({
      perfume: perfume({ occasions: ["night", "date"], vibes: ["seductive", "bold"] }),
      factors: [{ code: "timeOfDay", points: 40, max: 40, evidence: { time: "night", occasions: ["night"], vibes: ["seductive", "bold"] } }],
      reasons: [],
      role: { key: "date", source: "fixed", fallback: false },
      ...spec,
    }));

  it("a profile line an earlier card already shows verbatim is swapped for another profile line of that fragrance, when it has one", () => {
    const [first, second] = deriveTodayExplanations(picks({}, {}));

    expect(first.map(({ code }) => code)).toEqual(["profileTime", "profileRole"]);
    // the second has the same two lines: nothing else to offer, so the shared evidence keeps its wording
    expect(second).toEqual(first);

    const withAlternative = deriveTodayExplanations(
      picks(
        {},
        {
          perfume: perfume({ occasions: ["night", "date"], vibes: ["seductive", "bold", "elegant"] }),
          factors: [
            { code: "weather", points: 10, max: 10, evidence: { profile: "cool", temperatureBucket: "cool", accords: ["amber"], vibes: [] } },
            { code: "timeOfDay", points: 40, max: 40, evidence: { time: "night", occasions: ["night"], vibes: ["seductive", "bold"] } },
          ],
        }
      )
    );

    expect(withAlternative[1].map(({ code }) => code)).toEqual(["profileWeather", "profileRole"]); // the repeated time line gave way
  });

  it("a repeated profile line is never swapped for a plainer, generic one", () => {
    const [, second] = deriveTodayExplanations(picks({}, { reasons: [{ code: "season", evidence: { season: "fall", weight: 9 } }] }));

    expect(second.map(({ code }) => code)).toEqual(["profileTime", "profileRole"]);
    expect(second.some(({ code }) => code === "season")).toBe(false);
  });

  it("is deterministic and does not mutate its input", () => {
    const set = picks({}, {});
    const copy = JSON.parse(JSON.stringify(set));

    expect(deriveTodayExplanations(set)).toEqual(deriveTodayExplanations(set));
    expect(JSON.parse(JSON.stringify(set))).toEqual(copy);
  });

  it("on the real catalog, picks with different metadata read differently (Sauvage EDP vs Spicebomb Extreme)", () => {
    const result = run(fragrances, { season: "fall", weekday: 3, hour: 21, temperatureBucket: "cool" });
    const byName = Object.fromEntries(result.recommendations.map((pick) => [pick.perfume.name, lines(pick)]));

    expect(byName["Sauvage EDP"][0]).toBe("Su perfil de ámbar y vainilla encaja especialmente bien con el clima fresco");
    expect(byName["Spicebomb Extreme"][0]).toBe("Su perfil especiado, acogedor y cálido, con vainilla y tabaco, encaja especialmente bien con el clima fresco");
    expect(byName["Sauvage EDP"][0]).not.toBe(byName["Spicebomb Extreme"][0]);
  });

  it("a hot weekday reads fresh, citrus and marine from each fragrance's own accords", () => {
    const result = run(fragrances, { season: "summer", weekday: 2, hour: 11, temperatureBucket: "hot" });
    const first = result.recommendations[0];

    expect(first.perfume.name).toBe("Acqua di Gio EDT");
    expect(lines(first)[0]).toBe("Su perfil cítrico, marino y fresco funciona especialmente bien con el calor");
  });
});

describe("the ranking is untouched: only the explanation lines are new", () => {
  // Pick ids, roles, scores, role scores and base reasons for all 8,064 season / weekday / hour / weather contexts, hashed. The hash was
  // taken from the committed role engine BEFORE the explanation lines were added.
  const RANKING_HASH = "21a73f9b1e84cdced85b9df28db4cebdd800539802a163f7e49b544ac7c10c56";

  it("produces the same picks, roles, scores and base reasons as before, in every context", () => {
    const out = [];

    for (const season of ["spring", "summer", "fall", "winter"]) {
      for (let weekday = 0; weekday < 7; weekday++) {
        for (let hour = 0; hour < 24; hour++) {
          for (const temperatureBucket of [undefined, "hot", "warm", "mild", "cool", "cold"]) {
            for (const weatherCondition of [undefined, "rain"]) {
              const result = run(fragrances, { season, weekday, hour, temperatureBucket, weatherCondition });

              out.push([result.dynamicRole, result.confidence, result.recommendations.map((x) => [x.perfume.id, x.role, x.score, x.roleScore, x.reasons])]);
            }
          }
        }
      }
    }

    expect(createHash("sha256").update(JSON.stringify(out)).digest("hex")).toBe(RANKING_HASH);
  }, 60000);

  it("the plain Today ranker is not involved at all", () => {
    const direct = buildTodayRecommendations({ perfumes: fragrances, context: at(3, 21) });

    direct.recommendations.forEach((pick) => expect(pick).not.toHaveProperty("explanation"));
  });

  it("the explanation module does not touch scoring, weights, weather, price, tier, segment or the box", () => {
    const code = source.replace(/^\s*\/\/.*$/gm, "");

    expect(code).not.toMatch(/TODAY_FACTOR_MAX\s*=|TODAY_LIVE_FACTOR_MAX\s*=|fetch\(|metNorway|\.points\b\s*[*+]|segment|selectedPerfume|analytics/i);
    expect(code).not.toMatch(/Su perfil|Su carácter|encaja|funciona/); // no words: presentation owns them
  });
});
