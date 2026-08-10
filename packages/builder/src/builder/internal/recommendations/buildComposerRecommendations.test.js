import { describe, expect, it } from "vitest";
import { createBuilderConfig } from "../../config/createBuilderConfig.js";
import {
  buildComposerRecommendations,
  buildComposerRequestFromBuilderState,
  buildIntentRecommendations,
} from "./buildComposerRecommendations.js";

const config = createBuilderConfig({
  brand: {
    businessName: "Discovery Decants",
    displayName: "Discovery Decants",
    shortName: "Discovery",
    heading: "Discovery Decants",
  },
  box: {
    minSelectableSlots: 3,
    maxSelectableSlots: 4,
    defaultTargetSlots: 4,
  },
  commerce: {
    pointValue: 100,
    currency: "USD",
  },
  collectionCard: {
    brandHeading: "Discovery Decants",
  },
  finalization: {
    whatsappNumber: "528129800010",
  },
});

function perfume(id, overrides = {}) {
  return {
    id,
    name: `Perfume ${id}`,
    shortName: `P${id}`,
    brand: "Test House",
    points: 1,
    tier: "bronze",
    image: `/images/${id}.png`,
    seasons: ["spring"],
    occasions: ["day"],
    vibes: ["fresh"],
    accords: ["citrus", "aromatic"],
    topNotes: ["bergamot"],
    middleNotes: ["lavender"],
    baseNotes: ["cedar"],
    seasonWeights: { spring: 8, summer: 8, fall: 2, winter: 0 },
    ...overrides,
  };
}

const fresh = perfume(1, {
  seasons: ["spring", "summer"],
  occasions: ["day", "office", "casual"],
  vibes: ["fresh", "clean"],
  accords: ["citrus", "aromatic", "green"],
  seasonWeights: { spring: 8, summer: 10, fall: 2, winter: 0 },
});

const green = perfume(2, {
  seasons: ["spring", "fall"],
  occasions: ["office", "casual"],
  vibes: ["green", "clean"],
  accords: ["green", "woody", "aromatic"],
  seasonWeights: { spring: 8, summer: 5, fall: 6, winter: 2 },
});

const amber = perfume(3, {
  seasons: ["fall", "winter"],
  occasions: ["date", "night", "formal"],
  vibes: ["warm", "dark"],
  accords: ["amber", "woody", "spicy"],
  points: 1.5,
  tier: "silver",
  seasonWeights: { spring: 2, summer: 0, fall: 9, winter: 10 },
});

const formal = perfume(4, {
  seasons: ["spring", "fall", "winter"],
  occasions: ["office", "formal"],
  vibes: ["elegant", "woody"],
  accords: ["woody", "powdery", "iris"],
  points: 2,
  tier: "gold",
  seasonWeights: { spring: 6, summer: 2, fall: 8, winter: 7 },
});

const smoky = perfume(5, {
  seasons: ["fall", "winter"],
  occasions: ["date", "night"],
  vibes: ["warm", "cozy", "dark"],
  accords: ["smoky", "amber", "woody"],
  points: 2.5,
  tier: "platinum",
  seasonWeights: { spring: 0, summer: 0, fall: 8, winter: 9 },
});

const sweet = perfume(6, {
  seasons: ["fall", "winter"],
  occasions: ["date", "special"],
  vibes: ["sweet", "seductive"],
  accords: ["vanilla", "amber", "sweet"],
  points: 3,
  tier: "diamond",
  seasonWeights: { spring: 1, summer: 0, fall: 7, winter: 8 },
});

const catalog = [fresh, green, amber, formal, smoky, sweet];

function build(options = {}) {
  return buildComposerRecommendations({
    perfumes: catalog,
    selectedPerfumes: [fresh, green],
    notes: {},
    config,
    ...options,
  });
}

describe("buildComposerRecommendations", () => {
  it("returns the existing two-lane recommendation shape from Composer output", () => {
    const result = build();

    expect(Object.keys(result)).toEqual(["basedOnYourPicks", "toBalanceYourBox"]);
    expect(result.basedOnYourPicks.length).toBeGreaterThan(0);
    expect(result.toBalanceYourBox.length).toBeGreaterThan(0);

    [...result.basedOnYourPicks, ...result.toBalanceYourBox].forEach((recommendation) => {
      expect(recommendation).toMatchObject({
        perfume: {
          id: expect.any(Number),
          name: expect.any(String),
        },
        score: expect.any(Number),
        baseScore: expect.any(Number),
        finalScore: expect.any(Number),
        reasons: [],
        explanations: expect.any(Array),
        scoreBreakdown: expect.any(Object),
        composer: {
          source: "composer",
          qualityScore: expect.any(Number),
          compositionStatus: expect.any(String),
          recommendationCodes: expect.any(Array),
        },
      });
      expect(recommendation.explanations[0]).toMatchObject({
        code: expect.any(String),
        severity: expect.any(String),
        evidence: expect.any(Object),
      });
    });
  });

  it("excludes already selected perfumes and avoids duplicates between lanes", () => {
    const result = build();
    const selectedIds = new Set([fresh.id, green.id]);
    const basedIds = result.basedOnYourPicks.map((recommendation) => recommendation.perfume.id);
    const balanceIds = result.toBalanceYourBox.map((recommendation) => recommendation.perfume.id);

    expect(basedIds.some((id) => selectedIds.has(id))).toBe(false);
    expect(balanceIds.some((id) => selectedIds.has(id))).toBe(false);
    expect(balanceIds.some((id) => basedIds.includes(id))).toBe(false);
  });

  it("returns no affinity lane for an empty box while preserving balance fallback behavior", () => {
    const result = build({ selectedPerfumes: [] });

    expect(result.basedOnYourPicks).toEqual([]);
    expect(result.toBalanceYourBox).toEqual(expect.any(Array));
  });

  it("maps Builder state into a canonical Composer request", () => {
    const request = buildComposerRequestFromBuilderState({
      selectedPerfumes: [green, fresh, fresh],
      config,
      limit: 2,
      budget: 5,
      strategy: "signature",
      preferences: {
        preferredSeasons: ["summer", "spring"],
        preferredOccasions: ["office"],
        preferredVibes: ["fresh"],
      },
      excludedPerfumeIds: [6, 4, 6],
    });

    expect(request).toEqual({
      budget: 5,
      minSlots: 3,
      maxSlots: 4,
      targetSlots: 4,
      lockedPerfumeIds: [1, 2],
      excludedPerfumeIds: [4, 6],
      preferredSeasons: ["summer", "spring"],
      preferredOccasions: ["office"],
      preferredVibes: ["fresh"],
      strategy: "signature",
      collectionStyle: "balanced_mix",
      minimumPoints: null,
    });
  });

  it("uses selected perfumes as locked Composer inputs without mutating frozen data", () => {
    const frozenCatalog = Object.freeze(catalog.map((item) => Object.freeze({ ...item })));
    const frozenSelected = Object.freeze([Object.freeze({ ...fresh }), Object.freeze({ ...green })]);

    expect(() =>
      build({
        perfumes: frozenCatalog,
        selectedPerfumes: frozenSelected,
      })
    ).not.toThrow();
  });

  it("returns empty lanes when Composer cannot produce a sellable composition", () => {
    const result = build({
      perfumes: [fresh],
      selectedPerfumes: [],
    });

    expect(result).toEqual({
      basedOnYourPicks: [],
      toBalanceYourBox: [],
    });
  });

  it("is deterministic and catalog-order independent", () => {
    const first = build();
    const second = build({ perfumes: [...catalog].reverse() });

    expect(first).toEqual(second);
  });
});

describe("buildIntentRecommendations", () => {
  it("composes cold, from preferences and strategy alone, with no prior selection required", () => {
    const results = buildIntentRecommendations({
      perfumes: catalog,
      notes: {},
      config,
      strategy: "balanced",
      preferredOccasions: ["office"],
      preferredVibes: ["clean"],
      limit: 10,
    });

    expect(results.length).toBeGreaterThan(0);
    results.forEach((recommendation) => {
      expect(recommendation).toMatchObject({
        perfume: { id: expect.any(Number) },
        score: expect.any(Number),
        explanations: expect.any(Array),
      });
    });
  });

  it("never returns a fragrance listed in excludedPerfumeIds, regardless of how well it would otherwise score", () => {
    const results = buildIntentRecommendations({
      perfumes: catalog,
      notes: {},
      config,
      strategy: "versatile",
      preferredOccasions: ["office"],
      excludedPerfumeIds: [formal.id, smoky.id],
      limit: 10,
    });

    expect(results.length).toBeGreaterThan(0);
    expect(results.some((r) => r.perfume.id === formal.id)).toBe(false);
    expect(results.some((r) => r.perfume.id === smoky.id)).toBe(false);
  });

  it("excludes fragrances already in the current selection, same as the existing lanes", () => {
    const results = buildIntentRecommendations({
      perfumes: catalog,
      selectedPerfumes: [fresh, green],
      notes: {},
      config,
      strategy: "balanced",
      limit: 10,
    });

    expect(results.some((r) => r.perfume.id === fresh.id)).toBe(false);
    expect(results.some((r) => r.perfume.id === green.id)).toBe(false);
  });

  it("returns an empty array once the selection already fills the box, and never throws on an empty catalog", () => {
    expect(
      buildIntentRecommendations({ perfumes: [], config, strategy: "balanced" })
    ).toEqual([]);
    expect(
      buildIntentRecommendations({
        perfumes: catalog,
        selectedPerfumes: catalog.slice(0, config.box.maxSelectableSlots),
        config,
        strategy: "balanced",
      })
    ).toEqual([]);
  });

  it("returns at most `limit`, never padding to reach it when Composer produces fewer explainable results", () => {
    const results = buildIntentRecommendations({
      perfumes: catalog,
      notes: {},
      config,
      strategy: "balanced",
      limit: 1,
    });

    expect(results.length).toBeLessThanOrEqual(1);
  });
});
