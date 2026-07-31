import { describe, expect, it } from "vitest";

import { evaluateComposerConstraints } from "./evaluateComposerConstraints.js";
import { evaluateCompositionQuality } from "./evaluateCompositionQuality.js";
import { normalizeComposerRequest } from "./normalizeComposerRequest.js";

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

const freshPerfume = perfume(1, {
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
const greenPerfume = perfume(101, {
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
const amberPerfume = perfume(201, {
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
const formalPerfume = perfume(301, {
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
const nichePerfume = perfume(401, {
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
const sweetPerfume = perfume(501, {
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
const catalog = [
  freshPerfume,
  greenPerfume,
  amberPerfume,
  formalPerfume,
  nichePerfume,
  sweetPerfume,
  perfume(2, { ...freshPerfume, id: 2, name: "Fresh Twin" }),
  perfume(3, { ...freshPerfume, id: 3, name: "Fresh Triplet" }),
  perfume(4, { ...freshPerfume, id: 4, name: "Fresh Fourth" }),
  perfume(202, { ...amberPerfume, id: 202, name: "Amber Twin" }),
  perfume(203, { ...amberPerfume, id: 203, name: "Amber Triplet" }),
  perfume(204, { ...amberPerfume, id: 204, name: "Amber Fourth" }),
];

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
  return evaluateCompositionQuality({
    request: request(input),
    candidatePerfumes,
    catalog,
    config: testConfig,
  });
}

function deepFreeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    Object.values(value).forEach(deepFreeze);
  }

  return value;
}

describe("evaluateCompositionQuality", () => {
  it("returns complete quality for valid balanced, versatile, explorer, and signature compositions", () => {
    ["balanced", "versatile", "explorer", "signature"].forEach((strategy) => {
      const result = evaluate([catalog[0], catalog[1], catalog[2], catalog[3]], {
        budget: 900,
        strategy,
      });

      expect(result.evaluable).toBe(true);
      expect(result.overallScore).toBeGreaterThan(0);
      expect(result.overallScore).toBeLessThanOrEqual(100);
      expect(result.diagnostics.strategyId).toBe(strategy);
      expect(Object.keys(result.weightedDimensions)).toEqual([
        "preferenceFit",
        "coverage",
        "diversity",
        "versatility",
        "coherence",
        "budgetEfficiency",
        "signatureFocus",
      ]);
    });
  });

  it("lets the same collection score differently under different strategies", () => {
    const candidate = [catalog[0], catalog[1], catalog[2], catalog[3]];
    const balanced = evaluate(candidate, { budget: 900, strategy: "balanced" });
    const explorer = evaluate(candidate, { budget: 900, strategy: "explorer" });
    const signature = evaluate(candidate, { budget: 900, strategy: "signature" });

    expect(new Set([balanced.overallScore, explorer.overallScore, signature.overallScore]).size)
      .toBeGreaterThan(1);
  });

  it("preserves invalid candidates as non-evaluable without fabricating quality", () => {
    const result = evaluate([catalog[0]], { budget: 900, minSlots: 2 });

    expect(result).toMatchObject({
      evaluable: false,
      overallScore: null,
      dimensions: {},
      penalties: {},
      diagnostics: {
        reason: "invalid-candidate",
        violations: [{ code: "MIN_SLOTS_NOT_MET", actualSlots: 1, minSlots: 2 }],
      },
    });
  });

  it("distinguishes infeasible requests from invalid candidates", () => {
    const result = evaluate([catalog[0], catalog[1]], {
      budget: -1,
      minSlots: 2,
    });

    expect(result.evaluable).toBe(false);
    expect(result.overallScore).toBeNull();
    expect(result.diagnostics.reason).toBe("infeasible-request");
    expect(result.diagnostics.violations.map((violation) => violation.code)).toContain(
      "INVALID_BUDGET"
    );
  });

  it("derives constraints internally when no constraint result is supplied and respects supplied constraints", () => {
    const candidate = [catalog[0], catalog[1]];
    const normalizedRequest = request({ budget: 300, minSlots: 2 });
    const suppliedConstraints = evaluateComposerConstraints({
      request: normalizedRequest,
      candidatePerfumes: candidate,
      catalog,
      config: testConfig,
    });
    const internal = evaluateCompositionQuality({
      request: normalizedRequest,
      candidatePerfumes: candidate,
      catalog,
      config: testConfig,
    });
    const supplied = evaluateCompositionQuality({
      request: normalizedRequest,
      candidatePerfumes: candidate,
      catalog,
      config: testConfig,
      constraintResult: suppliedConstraints,
    });

    expect(internal).toEqual(supplied);
  });

  it("calculates weighted subtotals and penalty subtraction exactly from public weights", () => {
    const result = evaluate([catalog[0], catalog[1], catalog[2], catalog[3]], {
      budget: 900,
      strategy: "balanced",
    });
    const positiveSubtotal = Object.values(result.weightedDimensions).reduce(
      (sum, contribution) => sum + contribution.weightedScore,
      0
    );
    const penaltySubtotal = Object.values(result.weightedPenalties).reduce(
      (sum, penalty) => sum + penalty.weightedEffect,
      0
    );

    expect(result.positiveSubtotal).toBe(Math.round(positiveSubtotal * 100) / 100);
    expect(result.penaltySubtotal).toBe(Math.round(penaltySubtotal * 100) / 100);
    expect(result.overallScore).toBe(
      Math.max(0, Math.min(100, Math.round((positiveSubtotal - penaltySubtotal) * 100) / 100))
    );
  });

  it("bounds scores and never emits NaN or Infinity in an evaluable result", () => {
    const result = evaluate([catalog[0], catalog[1]], {
      budget: null,
      minSlots: 2,
    });

    expect(result.overallScore).toBeGreaterThanOrEqual(0);
    expect(result.overallScore).toBeLessThanOrEqual(100);
    expect(JSON.stringify(result)).not.toMatch(/NaN|Infinity/);
  });

  it("is candidate order-independent and deterministic with frozen inputs", () => {
    const normalizedRequest = deepFreeze(request({
      budget: 900,
      minSlots: 4,
      strategy: "explorer",
      preferredSeasons: ["winter", "summer"],
    }));
    const frozenCandidate = deepFreeze([catalog[3], catalog[0], catalog[2], catalog[1]]);
    const frozenCatalog = deepFreeze([...catalog]);
    const first = evaluateCompositionQuality({
      request: normalizedRequest,
      candidatePerfumes: frozenCandidate,
      catalog: frozenCatalog,
      config: testConfig,
    });
    const second = evaluateCompositionQuality({
      request: normalizedRequest,
      candidatePerfumes: [catalog[1], catalog[2], catalog[0], catalog[3]],
      catalog: frozenCatalog,
      config: testConfig,
    });

    expect(first).toEqual(second);
    expect(frozenCandidate[0].id).toBe(301);
  });

  it("uses neutral preference behavior for absent preferences and partial preferences", () => {
    const noPreferences = evaluate([catalog[0], catalog[1]], {
      budget: 300,
      minSlots: 2,
    });
    const partialPreferences = evaluate([catalog[0], catalog[1]], {
      budget: 300,
      minSlots: 2,
      preferredVibes: ["fresh", "dark"],
    });

    expect(noPreferences.dimensions.preferenceFit.score).toBe(100);
    expect(partialPreferences.dimensions.preferenceFit.score).toBe(50);
    expect(partialPreferences.dimensions.preferenceFit.components).toEqual({ vibes: 50 });
  });

  it("falls back to balanced for unknown strategies", () => {
    const fallback = evaluate([catalog[0], catalog[1]], {
      budget: 300,
      minSlots: 2,
      strategy: "unknown",
    });
    const balanced = evaluate([catalog[0], catalog[1]], {
      budget: 300,
      minSlots: 2,
      strategy: "balanced",
    });

    expect(fallback).toEqual(balanced);
  });

  it("scores broader balanced collections above narrowly repetitive collections", () => {
    const broader = evaluate([catalog[0], catalog[1], catalog[2], catalog[3]], {
      budget: 900,
      minSlots: 4,
      strategy: "balanced",
    });
    const repetitive = evaluate([
      catalog[0],
      perfume(2, { ...catalog[0], id: 2 }),
      perfume(3, { ...catalog[0], id: 3 }),
      perfume(4, { ...catalog[0], id: 4 }),
    ], {
      budget: 900,
      minSlots: 4,
      strategy: "balanced",
    });

    expect(broader.overallScore).toBeGreaterThan(repetitive.overallScore);
  });

  it("scores varied contrast above homogeneous collections for explorer strategy", () => {
    const varied = evaluate([catalog[0], catalog[2], catalog[3], catalog[4]], {
      budget: 1200,
      minSlots: 4,
      strategy: "explorer",
    });
    const homogeneous = evaluate([
      catalog[2],
      perfume(202, { ...catalog[2], id: 202 }),
      perfume(203, { ...catalog[2], id: 203 }),
      perfume(204, { ...catalog[2], id: 204 }),
    ], {
      budget: 1200,
      minSlots: 4,
      strategy: "explorer",
    });

    expect(varied.overallScore).toBeGreaterThan(homogeneous.overallScore);
  });

  it("scores practical multi-context collections above niche collections for versatile strategy", () => {
    const practical = evaluate([catalog[0], catalog[1], catalog[2], catalog[3]], {
      budget: 900,
      minSlots: 4,
      strategy: "versatile",
    });
    const nicheOnly = evaluate([catalog[2], catalog[4]], {
      budget: 900,
      minSlots: 2,
      strategy: "versatile",
    });

    expect(practical.overallScore).toBeGreaterThan(nicheOnly.overallScore);
  });

  it("scores coherent focal collections above scattered collections for signature strategy", () => {
    const focal = evaluate([catalog[3], catalog[4], catalog[2]], {
      budget: 1200,
      minSlots: 3,
      strategy: "signature",
    });
    const scattered = evaluate([catalog[0], catalog[2], catalog[5]], {
      budget: 1200,
      minSlots: 3,
      strategy: "signature",
    });

    expect(focal.overallScore).toBeGreaterThan(scattered.overallScore);
  });

  it("allows a lower-cost high-quality collection to beat a weaker higher-cost collection", () => {
    const highQuality = evaluate([catalog[0], catalog[1], catalog[2], catalog[3]], {
      budget: 1500,
      minSlots: 4,
      strategy: "balanced",
    });
    const expensiveWeak = evaluate([catalog[4], catalog[5]], {
      budget: 1500,
      minSlots: 2,
      strategy: "balanced",
    });

    expect(highQuality.diagnostics.constraintResult.metrics.estimatedValue).toBe(700);
    expect(expensiveWeak.diagnostics.constraintResult.metrics.estimatedValue).toBe(900);
    expect(highQuality.overallScore).toBeGreaterThan(expensiveWeak.overallScore);
  });

  it("uses budget efficiency only as a small tie-breaker for otherwise comparable collections", () => {
    const lessUtilized = evaluate([catalog[0], catalog[1]], {
      budget: 500,
      minSlots: 2,
      strategy: "balanced",
    });
    const betterUtilized = evaluate([catalog[0], catalog[1]], {
      budget: 300,
      minSlots: 2,
      strategy: "balanced",
    });

    expect(betterUtilized.overallScore - lessUtilized.overallScore).toBeLessThanOrEqual(2);
    expect(betterUtilized.overallScore).toBeGreaterThan(lessUtilized.overallScore);
  });

  it("covers full-object golden balanced, explorer, and invalid evaluations", () => {
    expect(evaluate([catalog[0], catalog[1]], {
      budget: 300,
      minSlots: 2,
      strategy: "balanced",
      preferredSeasons: ["summer"],
      preferredOccasions: ["office"],
      preferredVibes: ["fresh"],
    })).toMatchObject({
      evaluable: true,
      overallScore: expect.any(Number),
      positiveSubtotal: expect.any(Number),
      penaltySubtotal: expect.any(Number),
      diagnostics: {
        reason: "evaluable",
        strategyId: "balanced",
        evaluatedPerfumeIds: [1, 101],
      },
    });
    expect(evaluate([catalog[0], catalog[2], catalog[3], catalog[4]], {
      budget: 1200,
      minSlots: 4,
      strategy: "explorer",
    })).toMatchObject({
      evaluable: true,
      diagnostics: {
        reason: "evaluable",
        strategyId: "explorer",
      },
    });
    expect(evaluate([catalog[0]], {
      budget: 100,
      minSlots: 2,
      strategy: "balanced",
    })).toEqual({
      evaluable: false,
      overallScore: null,
      dimensions: {},
      penalties: {},
      diagnostics: {
        strategyId: "balanced",
        evaluatedPerfumeIds: [1],
        collectionSize: 1,
        constraintResult: {
          valid: false,
          violations: [
            {
              code: "MIN_SLOTS_NOT_MET",
              actualSlots: 1,
              minSlots: 2,
            },
          ],
          metrics: {
            selectedSlots: 1,
            totalPoints: 1,
            estimatedValue: 100,
            remainingPoints: 0,
            remainingBudget: 0,
            budgetUtilization: 1,
            lockedCount: 0,
            excludedCount: 0,
          },
        },
        fallbackStrategyUsed: false,
        reason: "invalid-candidate",
        violations: [
          {
            code: "MIN_SLOTS_NOT_MET",
            actualSlots: 1,
            minSlots: 2,
          },
        ],
      },
    });
  });
});
