import { describe, expect, it } from "vitest";

import { normalizeComposerRequest } from "./normalizeComposerRequest.js";
import {
  COMPOSER_QUALITY_DIMENSION_IDS,
  COMPOSER_QUALITY_PENALTY_IDS,
  evaluateComposerQualityDimensions,
} from "./composerQualityDimensions.js";

const testConfig = {
  commerce: {
    currency: "USD",
    pointValue: 100,
  },
  box: {
    minSelectableSlots: 2,
    maxSelectableSlots: 6,
    defaultTargetSlots: 4,
  },
};

const notes = {
  bergamot: { name: "Bergamot" },
  lemon: { name: "Lemon" },
  lavender: { name: "Lavender" },
  cedar: { name: "Cedar" },
  vanilla: { name: "Vanilla" },
  amber: { name: "Amber" },
  tobacco: { name: "Tobacco" },
  iris: { name: "Iris" },
  musk: { name: "Musk" },
  vetiver: { name: "Vetiver" },
};

const fresh = perfume(1, {
  points: 1,
  accords: ["citrus", "fresh", "aromatic"],
  seasons: ["spring", "summer"],
  seasonWeights: { spring: 8, summer: 10, fall: 2, winter: 0 },
  occasions: ["daily", "office"],
  vibes: ["fresh", "clean"],
  topNotes: ["bergamot", "lemon"],
  middleNotes: ["lavender"],
  baseNotes: ["cedar"],
});
const green = perfume(101, {
  points: 1.5,
  accords: ["green", "aromatic", "woody"],
  seasons: ["spring", "fall"],
  seasonWeights: { spring: 8, summer: 5, fall: 6, winter: 2 },
  occasions: ["office", "casual"],
  vibes: ["fresh", "green"],
  topNotes: ["bergamot"],
  middleNotes: ["lavender"],
  baseNotes: ["vetiver"],
});
const amber = perfume(201, {
  points: 2,
  accords: ["amber", "vanilla", "warm spicy"],
  seasons: ["fall", "winter"],
  seasonWeights: { spring: 2, summer: 0, fall: 9, winter: 10 },
  occasions: ["date", "night"],
  vibes: ["warm", "seductive"],
  topNotes: ["amber"],
  middleNotes: ["vanilla"],
  baseNotes: ["tobacco"],
});
const formal = perfume(301, {
  points: 2.5,
  accords: ["woody", "iris", "powdery"],
  seasons: ["spring", "fall", "winter"],
  seasonWeights: { spring: 6, summer: 2, fall: 8, winter: 7 },
  occasions: ["formal", "office"],
  vibes: ["elegant", "sophisticated"],
  topNotes: ["iris"],
  middleNotes: ["cedar"],
  baseNotes: ["musk"],
});
const niche = perfume(401, {
  points: 4,
  accords: ["smoky", "leather", "woody"],
  seasons: ["fall", "winter"],
  seasonWeights: { spring: 0, summer: 0, fall: 8, winter: 9 },
  occasions: ["evening", "special"],
  vibes: ["dark", "bold"],
  topNotes: ["tobacco"],
  middleNotes: ["amber"],
  baseNotes: ["cedar"],
});
const sweet = perfume(501, {
  points: 5,
  accords: ["sweet", "vanilla", "amber"],
  seasons: ["fall", "winter"],
  seasonWeights: { spring: 1, summer: 0, fall: 7, winter: 8 },
  occasions: ["date", "night"],
  vibes: ["warm", "cozy"],
  topNotes: ["vanilla"],
  middleNotes: ["amber"],
  baseNotes: ["musk"],
});

const catalog = [fresh, green, amber, formal, niche, sweet];

function perfume(id, overrides) {
  return {
    id,
    name: `Perfume ${id}`,
    shortName: `P${id}`,
    brand: "Test",
    points: 1,
    image: "/test.png",
    accords: [],
    seasons: [],
    occasions: [],
    vibes: [],
    ...overrides,
  };
}

function request(input = {}) {
  return normalizeComposerRequest(input, { config: testConfig });
}

function evaluate(candidatePerfumes, input = {}) {
  return evaluateComposerQualityDimensions({
    request: request(input),
    candidatePerfumes,
    catalog,
    notes,
  });
}

function deepFreeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    Object.values(value).forEach(deepFreeze);
  }

  return value;
}

describe("composerQualityDimensions", () => {
  it("exposes stable dimension and penalty IDs", () => {
    expect(COMPOSER_QUALITY_DIMENSION_IDS).toEqual([
      "preferenceFit",
      "coverage",
      "diversity",
      "versatility",
      "coherence",
      "budgetEfficiency",
      "signatureFocus",
    ]);
    expect(COMPOSER_QUALITY_PENALTY_IDS).toEqual(["redundancyPenalty"]);
  });

  it("returns bounded finite scores and magnitudes", () => {
    const result = evaluate([fresh, green, amber, formal], {
      budget: 800,
      preferredSeasons: ["summer"],
    });

    Object.values(result.dimensions).forEach((dimension) => {
      expect(Number.isFinite(dimension.score)).toBe(true);
      expect(dimension.score).toBeGreaterThanOrEqual(0);
      expect(dimension.score).toBeLessThanOrEqual(100);
    });
    Object.values(result.penalties).forEach((penalty) => {
      expect(Number.isFinite(penalty.magnitude)).toBe(true);
      expect(penalty.magnitude).toBeGreaterThanOrEqual(0);
      expect(penalty.magnitude).toBeLessThanOrEqual(100);
    });
  });

  it("treats no preferences neutrally and one preference domain independently", () => {
    const noPreference = evaluate([fresh, green]);
    const oneDomain = evaluate([fresh, green], {
      preferredSeasons: ["summer", "winter"],
    });

    expect(noPreference.dimensions.preferenceFit.score).toBe(100);
    expect(noPreference.dimensions.preferenceFit.diagnostics.omittedDomains).toEqual([
      "seasons",
      "occasions",
      "vibes",
    ]);
    expect(oneDomain.dimensions.preferenceFit.components).toEqual({ seasons: 50 });
    expect(oneDomain.dimensions.preferenceFit.score).toBe(50);
  });

  it("matches, misses, deduplicates, and preserves unknown preference labels deterministically", () => {
    const result = evaluate([fresh, amber], {
      preferredSeasons: ["Summer", "summer", "Winter", "unknown season"],
      preferredOccasions: ["date", "office"],
      preferredVibes: ["Fresh", "noir"],
    });

    expect(result.dimensions.preferenceFit.components).toEqual({
      seasons: 66.67,
      occasions: 100,
      vibes: 50,
    });
    expect(result.dimensions.preferenceFit.diagnostics.missing.seasons).toEqual([
      "unknown season",
    ]);
    expect(result.dimensions.preferenceFit.diagnostics.missing.vibes).toEqual(["noir"]);
  });

  it("scores broader coverage and diversity above a concentrated collection", () => {
    const broad = evaluate([fresh, green, amber, formal]);
    const concentrated = evaluate([
      fresh,
      perfume(2, { ...fresh, id: 2, name: "Fresh Twin" }),
      perfume(3, { ...fresh, id: 3, name: "Fresh Triplet" }),
      perfume(4, { ...fresh, id: 4, name: "Fresh Fourth" }),
    ]);

    expect(broad.dimensions.coverage.score).toBeGreaterThan(concentrated.dimensions.coverage.score);
    expect(broad.dimensions.diversity.score).toBeGreaterThan(concentrated.dimensions.diversity.score);
    expect(concentrated.penalties.redundancyPenalty.magnitude).toBeGreaterThan(
      broad.penalties.redundancyPenalty.magnitude
    );
  });

  it("characterizes min-size and max-size collections without raw size dominance", () => {
    const minSize = evaluate([fresh, amber]);
    const maxSize = evaluate([fresh, green, amber, formal, niche, sweet]);

    expect(minSize.dimensions.coverage.score).toBeGreaterThan(30);
    expect(maxSize.dimensions.coverage.score).toBeGreaterThan(minSize.dimensions.coverage.score);
    expect(maxSize.dimensions.coverage.score - minSize.dimensions.coverage.score).toBeLessThan(45);
  });

  it("distinguishes coherent similarity from genuine redundancy", () => {
    const coherentSimilar = evaluate([fresh, green, formal]);
    const redundant = evaluate([
      fresh,
      perfume(2, { ...fresh, id: 2 }),
      perfume(3, { ...fresh, id: 3 }),
    ]);

    expect(coherentSimilar.dimensions.coherence.score).toBeGreaterThan(
      redundant.dimensions.coherence.score
    );
    expect(redundant.penalties.redundancyPenalty.magnitude).toBeGreaterThan(20);
  });

  it("uses a gentle budget curve with an excellent plateau from 80 to 100 percent", () => {
    expect(evaluate([fresh], { budget: 100 }).dimensions.budgetEfficiency.score).toBe(100);
    expect(evaluate([fresh], { budget: 125 }).dimensions.budgetEfficiency.score).toBe(100);
    expect(evaluate([fresh], { budget: 166.6667 }).dimensions.budgetEfficiency.score).toBe(70);
    expect(evaluate([fresh], { budget: 200 }).dimensions.budgetEfficiency.score).toBe(58.33);
    expect(evaluate([fresh], { budget: null }).dimensions.budgetEfficiency.score).toBe(100);
    expect(evaluate([], { budget: 0 }).dimensions.budgetEfficiency.score).toBe(100);
  });

  it("keeps 85 percent and 95 percent utilization on the same plateau", () => {
    expect(evaluate([fresh], { budget: 117.6471 }).dimensions.budgetEfficiency.score).toBe(100);
    expect(evaluate([fresh], { budget: 105.2632 }).dimensions.budgetEfficiency.score).toBe(100);
  });

  it("is order-independent, deterministic, and does not mutate frozen inputs", () => {
    const frozenRequest = deepFreeze(request({
      budget: 900,
      preferredSeasons: ["winter", "summer"],
      preferredOccasions: ["office"],
      preferredVibes: ["fresh"],
    }));
    const frozenCandidate = deepFreeze([formal, fresh, amber, green]);
    const frozenCatalog = deepFreeze([...catalog]);
    const first = evaluateComposerQualityDimensions({
      request: frozenRequest,
      candidatePerfumes: frozenCandidate,
      catalog: frozenCatalog,
      notes,
    });
    const second = evaluateComposerQualityDimensions({
      request: frozenRequest,
      candidatePerfumes: [green, amber, fresh, formal],
      catalog: frozenCatalog,
      notes,
    });

    expect(first).toEqual(second);
    expect(frozenCandidate[0].id).toBe(301);
    expect(frozenRequest.preferredSeasons).toEqual(["winter", "summer"]);
  });

  it("handles malformed non-array candidates deterministically", () => {
    const result = evaluateComposerQualityDimensions({
      request: request(),
      candidatePerfumes: null,
      catalog,
      notes,
    });

    expect(result.dimensions.preferenceFit.score).toBe(100);
    expect(result.dimensions.coverage.score).toBe(0);
    expect(result.penalties.redundancyPenalty.magnitude).toBe(0);
  });
});
