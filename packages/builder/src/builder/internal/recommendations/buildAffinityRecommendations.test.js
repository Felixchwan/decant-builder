import { describe, expect, it } from "vitest";
import { fragrances } from "@discovery-box/catalog";
import { createBuilderConfig } from "../../config/createBuilderConfig.js";
import { createTranslator } from "../../../i18n/createTranslator.js";
import { getRecommendationDisplayReasons } from "../../presentation/recommendationExplanationLabels.js";
import {
  AFFINITY_NEIGHBOUR_WEIGHTS,
  AFFINITY_SIGNAL_WEIGHTS,
  aggregateBoxAffinity,
  buildAffinityRecommendations,
  computePerfumeSimilarity,
} from "./buildAffinityRecommendations.js";
import { buildComposerRecommendations } from "./buildComposerRecommendations.js";

// ---- Fixtures: small, explicit catalogs so each semantic claim is checkable by eye ----------------

function perfume(id, overrides = {}) {
  return {
    id,
    name: `Perfume ${id}`,
    shortName: `P${id}`,
    brand: "Test House",
    points: 1,
    image: `/images/${id}.png`,
    seasons: ["spring", "summer"],
    occasions: ["daily", "office"],
    vibes: ["fresh", "clean"],
    accords: ["citrus", "marine", "aromatic"],
    topNotes: ["bergamot"],
    middleNotes: ["seaNotes"],
    baseNotes: ["cedar"],
    seasonWeights: { spring: 8, summer: 10, fall: 2, winter: 0 },
    noteProminence: { bergamot: 8, seaNotes: 9, cedar: 3 },
    ...overrides,
  };
}

const freshA = perfume(1, { accords: ["citrus", "marine", "aromatic"] });
const freshB = perfume(2, {
  accords: ["aquatic", "citrus", "fresh"],
  noteProminence: { bergamot: 7, seaNotes: 8, lemon: 6 },
  occasions: ["daily", "casual"],
});
const freshC = perfume(3, {
  accords: ["citrus", "green", "aromatic"],
  noteProminence: { bergamot: 9, mint: 6, cedar: 2 },
});
// genuinely similar to the fresh picks
const freshTwin = perfume(10, {
  accords: ["citrus", "marine", "fresh"],
  noteProminence: { bergamot: 8, seaNotes: 8, lemon: 5 },
});
const freshCousin = perfume(11, {
  accords: ["citrus", "aromatic", "woody"],
  vibes: ["fresh", "confident"],
  occasions: ["office", "casual"],
  noteProminence: { bergamot: 7, cedar: 5, lavender: 4 },
});
// the dark winter fragrance a "balance" pass would reach for: nothing in common with a fresh box
const darkWinter = perfume(20, {
  seasons: ["fall", "winter"],
  occasions: ["night", "date"],
  vibes: ["dark", "seductive"],
  accords: ["amber", "warm spicy", "vanilla"],
  topNotes: ["cinnamon"],
  middleNotes: ["vanilla"],
  baseNotes: ["amber"],
  seasonWeights: { spring: 1, summer: 0, fall: 9, winter: 10 },
  noteProminence: { cinnamon: 8, vanilla: 9, amber: 9 },
});
const darkA = perfume(30, {
  seasons: ["fall", "winter"],
  occasions: ["night", "date"],
  vibes: ["dark", "seductive"],
  accords: ["amber", "warm spicy", "vanilla"],
  seasonWeights: { spring: 1, summer: 0, fall: 9, winter: 10 },
  noteProminence: { cinnamon: 8, vanilla: 9, amber: 9 },
});
const darkB = perfume(31, {
  seasons: ["fall", "winter"],
  occasions: ["night", "club"],
  vibes: ["dark", "bold"],
  accords: ["warm spicy", "tobacco", "amber"],
  seasonWeights: { spring: 0, summer: 0, fall: 8, winter: 9 },
  noteProminence: { cinnamon: 7, tobacco: 8, amber: 8 },
});
const darkTwin = perfume(40, {
  seasons: ["fall", "winter"],
  occasions: ["night", "date"],
  vibes: ["dark", "seductive"],
  accords: ["warm spicy", "amber", "vanilla"],
  seasonWeights: { spring: 1, summer: 0, fall: 9, winter: 9 },
  noteProminence: { cinnamon: 8, vanilla: 8, amber: 9 },
});
const freshComplement = perfume(41, {
  // bright and summery: the "contrast" pick for a dark box
  accords: ["citrus", "marine", "aromatic"],
  noteProminence: { bergamot: 8, seaNotes: 9 },
});

const ids = (recommendations) => recommendations.map(({ perfume: item }) => item.id);

describe("buildAffinityRecommendations: pure similarity to what is already in the box", () => {
  it("A. a fresh / citrus / aquatic box prefers genuinely similar candidates over a dark winter one", () => {
    const result = buildAffinityRecommendations({
      perfumes: [darkWinter, freshTwin, freshCousin, freshA, freshB, freshC],
      selectedPerfumes: [freshA, freshB, freshC],
      limit: 3,
    });

    expect(ids(result).slice(0, 2).sort()).toEqual([freshTwin.id, freshCousin.id]);
    expect(ids(result).indexOf(darkWinter.id)).toBe(2);
    expect(result[0].affinity.value).toBeGreaterThan(result[2].affinity.value);
  });

  it("B. a dark / evening / spicy box ranks similar evening / spicy candidates highly", () => {
    const result = buildAffinityRecommendations({
      perfumes: [freshComplement, darkTwin, freshTwin, darkA, darkB],
      selectedPerfumes: [darkA, darkB],
      limit: 3,
    });

    expect(ids(result)[0]).toBe(darkTwin.id);
    expect(ids(result).indexOf(freshComplement.id)).toBeGreaterThan(0);
    expect(result[0].explanations.map(({ code }) => code)).toContain("affinity_shared_occasions");
  });

  it("C. a candidate that fills a missing season but has weak affinity never outranks a highly similar one", () => {
    // the box has no winter at all, so darkWinter is exactly the "range" pick the Composer likes
    const selected = [freshA, freshB, freshC];
    const result = buildAffinityRecommendations({
      perfumes: [darkWinter, freshTwin, freshCousin],
      selectedPerfumes: selected,
      limit: 3,
    });
    const fresh = result.filter(({ perfume: item }) => item.id !== darkWinter.id);
    const winter = result.find(({ perfume: item }) => item.id === darkWinter.id);

    expect(fresh).toHaveLength(2);
    fresh.forEach((recommendation) =>
      expect(recommendation.affinity.value).toBeGreaterThan(winter.affinity.value)
    );
    expect(ids(result)[ids(result).length - 1]).toBe(darkWinter.id);
  });

  it("D. the opportunity lane may still prefer the gap-filling candidate: the two lanes optimise different objectives", () => {
    const catalog = [freshA, freshB, freshTwin, freshCousin, darkWinter, darkTwin];
    const config = createBuilderConfig({
      brand: {
        businessName: "Test",
        displayName: "Test",
        shortName: "Test",
        heading: "Test",
      },
      box: { minSelectableSlots: 3, maxSelectableSlots: 4, defaultTargetSlots: 4 },
      commerce: { pointValue: 100, currency: "USD" },
      collectionCard: { brandHeading: "Test" },
      finalization: { whatsappNumber: "528129800010" },
    });
    const result = buildComposerRecommendations({
      perfumes: catalog,
      selectedPerfumes: [freshA, freshB],
      notes: {},
      config,
    });
    const balanceIds = ids(result.toBalanceYourBox);
    const affinityIds = ids(result.basedOnYourPicks);

    // the balance lane reaches for the complementary (cold-weather, evening) fragrance...
    expect(balanceIds.some((id) => [darkWinter.id, darkTwin.id].includes(id))).toBe(true);
    // ...while "based on your picks" is led by what is most like the fresh box
    expect([freshTwin.id, freshCousin.id]).toContain(affinityIds[0]);
    // and the two adjacent surfaces never show the same perfume
    expect(affinityIds.filter((id) => balanceIds.includes(id))).toEqual([]);
  });

  describe("aggregation across the box", () => {
    it("one unrelated fragrance in the box does not pull an otherwise strong match down", () => {
      const withoutOutlier = buildAffinityRecommendations({
        perfumes: [freshTwin],
        selectedPerfumes: [freshA, freshB, freshC],
      })[0];
      const withOutlier = buildAffinityRecommendations({
        perfumes: [freshTwin],
        selectedPerfumes: [freshA, freshB, freshC, darkWinter],
      })[0];

      expect(withOutlier.affinity.value).toBeCloseTo(withoutOutlier.affinity.value, 10);
      expect(withOutlier.affinity.nearestPickIds).not.toContain(darkWinter.id);
    });

    it("rewards closeness to several picks over closeness to a single one, without needing to resemble all", () => {
      const similarities = [0.5, 0.5, 0.5, 0.05, 0.05];
      expect(aggregateBoxAffinity(similarities)).toBeCloseTo(0.5, 10);
      expect(aggregateBoxAffinity([0.5, 0.1, 0.1, 0.05])).toBeLessThan(aggregateBoxAffinity(similarities));
      // a one-pick box is just that pick's similarity
      expect(aggregateBoxAffinity([0.42])).toBeCloseTo(0.42, 10);
      expect(AFFINITY_NEIGHBOUR_WEIGHTS.reduce((sum, weight) => sum + weight, 0)).toBeCloseTo(1, 10);
    });

    it("surfaces matches for each direction of a mixed box", () => {
      const result = buildAffinityRecommendations({
        perfumes: [freshTwin, darkTwin, freshComplement],
        selectedPerfumes: [freshA, freshB, darkA],
        limit: 3,
      });

      expect(ids(result)).toContain(freshTwin.id);
      expect(ids(result)).toContain(darkTwin.id);
    });
  });

  describe("signals", () => {
    it("uses only similarity signals; the weights sum to 1 and none of them is price, tier or coverage", () => {
      expect(Object.keys(AFFINITY_SIGNAL_WEIGHTS).sort()).toEqual(
        ["accords", "notes", "occasions", "seasons", "vibes"]
      );
      expect(Object.values(AFFINITY_SIGNAL_WEIGHTS).reduce((sum, weight) => sum + weight, 0)).toBeCloseTo(1, 10);
    });

    it("is 1 for an identical profile and 0 for nothing in common", () => {
      expect(computePerfumeSimilarity(freshA, { ...freshA, id: 99 }).similarity).toBeCloseTo(1, 10);
      expect(
        computePerfumeSimilarity(freshA, darkWinter).parts
      ).toMatchObject({ notes: 0, accords: 0, vibes: 0, occasions: 0 });
    });

    it("never lets price / points influence the score or the order", () => {
      const cheap = { ...freshTwin, id: 50, points: 1 };
      const pricey = { ...freshTwin, id: 51, points: 5 };
      const forward = buildAffinityRecommendations({
        perfumes: [pricey, cheap],
        selectedPerfumes: [freshA, freshB],
      });

      expect(forward[0].affinity.value).toBeCloseTo(forward[1].affinity.value, 10);
      expect(ids(forward)).toEqual([50, 51]);
    });
  });

  describe("safety", () => {
    it("excludes selected perfumes and any excluded ids, and returns nothing for an empty box", () => {
      const result = buildAffinityRecommendations({
        perfumes: [freshA, freshB, freshTwin, freshCousin],
        selectedPerfumes: [freshA],
        excludedPerfumeIds: [freshTwin.id],
        limit: 10,
      });

      expect(ids(result)).toEqual([freshB.id, freshCousin.id].sort((a, b) => ids(result).indexOf(a) - ids(result).indexOf(b)));
      expect(ids(result)).not.toContain(freshA.id);
      expect(ids(result)).not.toContain(freshTwin.id);
      expect(buildAffinityRecommendations({ perfumes: [freshA], selectedPerfumes: [] })).toEqual([]);
    });

    it("ignores invalid entries, honours the limit, and is deterministic and catalog-order independent", () => {
      const catalog = [freshTwin, null, undefined, { name: "no id" }, freshCousin, darkWinter];
      const first = buildAffinityRecommendations({ perfumes: catalog, selectedPerfumes: [freshA, freshB], limit: 2 });
      const second = buildAffinityRecommendations({
        perfumes: [...catalog].reverse(),
        selectedPerfumes: [freshA, freshB],
        limit: 2,
      });

      expect(first).toHaveLength(2);
      expect(first).toEqual(second);
    });

    it("does not mutate frozen input", () => {
      const frozen = Object.freeze([freshTwin, freshCousin].map((item) => Object.freeze({ ...item })));

      expect(() =>
        buildAffinityRecommendations({ perfumes: frozen, selectedPerfumes: Object.freeze([freshA]) })
      ).not.toThrow();
    });
  });
});

// ---- Real catalog: grounded, similarity-only reasons ---------------------------------------------

const byShortName = (...names) => names.map((name) => fragrances.find((item) => item.shortName === name));
const REAL_BOXES = {
  fresh: byShortName("ADG EDT", "Light Blue", "VPH", "Fierce"),
  dark: byShortName("The Scent", "Most Wanted", "The One EDP", "Uomo Signature"),
  mixed: byShortName("ADG EDT", "Light Blue", "The Scent"),
  single: byShortName("ADG EDT"),
};

const FORBIDDEN_ES = /\b(rango|amplía|amplia|paleta|cobertura|equilibr\w*|firma|agrega|añade|variedad|contraste|diversific\w*|brecha\w*|faltante)\b/i;
const FORBIDDEN_EN = /\b(range|broaden\w*|expand\w*|palette|coverage|balanc\w*|signature|adds|variety|contrast|diversif\w*|gap\w*|missing)\b/i;

function realRecommendations(box) {
  return buildAffinityRecommendations({ perfumes: fragrances, selectedPerfumes: box, limit: 6 });
}

describe("buildAffinityRecommendations on the real catalog", () => {
  it("real boxes resolve to real catalog entries", () => {
    Object.values(REAL_BOXES).flat().forEach((item) => expect(item, "catalog lookup").toBeTruthy());
  });

  it("a fresh box is answered with fresh/citrus/aquatic perfumes, a dark box with warm/spicy evening ones", () => {
    const freshTop = realRecommendations(REAL_BOXES.fresh).slice(0, 3);
    const darkTop = realRecommendations(REAL_BOXES.dark).slice(0, 3);
    const freshish = (item) =>
      item.accords.slice(0, 3).some((accord) => ["citrus", "marine", "aquatic", "fresh", "fresh spicy"].includes(accord)) &&
      item.seasonWeights.summer >= 7;
    const darkish = (item) =>
      item.accords.slice(0, 3).some((accord) => ["warm spicy", "amber", "vanilla", "leather", "tobacco"].includes(accord)) &&
      item.seasonWeights.winter >= 7;

    freshTop.forEach(({ perfume: item }) => expect(freshish(item), item.name).toBe(true));
    darkTop.forEach(({ perfume: item }) => expect(darkish(item), item.name).toBe(true));
  });

  it("every stated reason is grounded in catalog data shared with the box", () => {
    Object.values(REAL_BOXES).forEach((box) => {
      realRecommendations(box).forEach(({ perfume: candidate, explanations }) => {
        const pickIds = new Set(box.map((item) => item.id));
        const noteKeys = (item) => Object.keys(item.noteProminence || {});

        explanations.forEach(({ code, evidence }) => {
          if (code === "affinity_closest_pick") {
            expect(pickIds.has(evidence.pickId)).toBe(true);
            expect(box.find((item) => item.id === evidence.pickId).name).toBe(evidence.pickName);
          }
          if (code === "affinity_shared_notes") {
            evidence.notes.forEach((note) => {
              expect(noteKeys(candidate)).toContain(note);
              expect(box.some((item) => noteKeys(item).includes(note))).toBe(true);
            });
          }
          if (code === "affinity_shared_accords" || code === "affinity_repeated_accords") {
            evidence.accords.forEach((accord) => {
              expect(candidate.accords).toContain(accord);
              const holders = box.filter((item) => item.accords.includes(accord)).length;
              expect(holders).toBeGreaterThanOrEqual(code === "affinity_repeated_accords" ? 2 : 1);
            });
          }
          if (code === "affinity_shared_occasions") {
            evidence.occasions.forEach((value) => {
              expect(candidate.occasions).toContain(value);
              expect(box.some((item) => item.occasions.includes(value))).toBe(true);
            });
          }
          if (code === "affinity_shared_vibes") {
            evidence.vibes.forEach((value) => {
              expect(candidate.vibes).toContain(value);
              expect(box.some((item) => item.vibes.includes(value))).toBe(true);
            });
          }
          if (code === "affinity_shared_seasons") {
            evidence.seasons.forEach((season) => {
              expect(candidate.seasonWeights[season]).toBeGreaterThanOrEqual(7);
              expect(box.some((item) => item.seasonWeights[season] >= 7)).toBe(true);
            });
          }
        });
      });
    });
  });

  it("explains similarity only: no coverage, range, balance, palette or signature wording, in either locale", () => {
    const locales = [
      { translator: createTranslator("es-MX"), forbidden: FORBIDDEN_ES },
      { translator: createTranslator("en-US"), forbidden: FORBIDDEN_EN },
    ];

    Object.values(REAL_BOXES).forEach((box) => {
      realRecommendations(box).forEach((recommendation) => {
        locales.forEach(({ translator, forbidden }) => {
          const reasons = getRecommendationDisplayReasons({ recommendation, translator });

          expect(reasons.length).toBeGreaterThan(0);
          expect(reasons.length).toBeLessThanOrEqual(3);
          reasons.forEach((reason) => expect(reason, reason).not.toMatch(forbidden));
        });
      });
    });
  });

  it("the reasons read as similarity (es-MX example)", () => {
    const translator = createTranslator("es-MX");
    const [top] = realRecommendations(REAL_BOXES.fresh);
    const reasons = getRecommendationDisplayReasons({ recommendation: top, translator });

    expect(reasons[0]).toMatch(/^Muy cercana a /);
    expect(reasons.join(" ")).toMatch(/Comparte|Sigue el perfil|Encaja en las mismas|Luce en las mismas/);
  });

  it("does not claim a repeated profile for a single pick", () => {
    const codes = realRecommendations(REAL_BOXES.single).flatMap(({ explanations }) =>
      explanations.map(({ code }) => code)
    );

    expect(codes).not.toContain("affinity_repeated_accords");
  });
});
