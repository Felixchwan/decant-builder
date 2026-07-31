import { describe, expect, it } from "vitest";

import { composeCollectionGreedy } from "./composeCollectionGreedy.js";
import { evaluateCompositionQuality } from "./evaluateCompositionQuality.js";
import { generateRefinementMoves } from "./generateRefinementMoves.js";
import {
  REFINEMENT_STATUSES,
  REFINEMENT_TERMINATION_REASONS,
  refineCollection,
} from "./refineCollection.js";

const testConfig = {
  commerce: {
    currency: "USD",
    pointValue: 100,
  },
  box: {
    minSelectableSlots: 3,
    maxSelectableSlots: 4,
    defaultTargetSlots: 4,
  },
};

const fresh = perfume(1, {
  points: 1,
  accords: ["citrus", "fresh", "aromatic"],
  seasons: ["spring", "summer"],
  seasonWeights: { spring: 8, summer: 10, fall: 2, winter: 0 },
  occasions: ["daily", "office"],
  vibes: ["fresh", "clean"],
});
const green = perfume(2, {
  points: 1.5,
  accords: ["green", "aromatic", "woody"],
  seasons: ["spring", "fall"],
  seasonWeights: { spring: 8, summer: 5, fall: 6, winter: 2 },
  occasions: ["office", "casual"],
  vibes: ["fresh", "green"],
});
const amber = perfume(3, {
  points: 2,
  accords: ["amber", "vanilla", "warm spicy"],
  seasons: ["fall", "winter"],
  seasonWeights: { spring: 2, summer: 0, fall: 9, winter: 10 },
  occasions: ["date", "night"],
  vibes: ["warm", "seductive"],
});
const formal = perfume(4, {
  points: 2.5,
  accords: ["woody", "iris", "powdery"],
  seasons: ["spring", "fall", "winter"],
  seasonWeights: { spring: 6, summer: 2, fall: 8, winter: 7 },
  occasions: ["formal", "office"],
  vibes: ["elegant", "sophisticated"],
});
const smoky = perfume(5, {
  points: 4,
  accords: ["smoky", "leather", "woody"],
  seasons: ["fall", "winter"],
  seasonWeights: { spring: 0, summer: 0, fall: 8, winter: 9 },
  occasions: ["evening", "special"],
  vibes: ["dark", "bold"],
});
const sweet = perfume(6, {
  points: 5,
  accords: ["sweet", "vanilla", "amber"],
  seasons: ["fall", "winter"],
  seasonWeights: { spring: 1, summer: 0, fall: 7, winter: 8 },
  occasions: ["date", "night"],
  vibes: ["warm", "cozy"],
});
const zeroA = perfume(20, { points: 0, seasonWeights: { spring: 0, summer: 0, fall: 0, winter: 0 } });
const zeroB = perfume(21, { ...zeroA, id: 21, name: "Zero B" });
const lowerIdTie = perfume(30, {
  points: 1,
  accords: ["fresh"],
  seasons: ["summer"],
  seasonWeights: { spring: 0, summer: 10, fall: 0, winter: 0 },
  occasions: ["daily"],
  vibes: ["fresh"],
});
const higherIdTie = perfume(31, {
  ...lowerIdTie,
  id: 31,
  name: "Higher Id Tie",
});
const lowerPointsTie = perfume(32, {
  points: 1,
  accords: ["aquatic"],
  seasons: ["summer"],
  seasonWeights: { spring: 2, summer: 9, fall: 0, winter: 0 },
  occasions: ["daily"],
  vibes: ["clean"],
});
const higherPointsTie = perfume(33, {
  ...lowerPointsTie,
  id: 33,
  name: "Higher Points Tie",
  points: 2,
});

const catalog = [fresh, green, amber, formal, smoky, sweet];

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
    topNotes: [],
    middleNotes: [],
    baseNotes: [],
    ...overrides,
  };
}

function refine(input = {}, initialPerfumes = [fresh, green, amber], sourceCatalog = catalog) {
  return refineCollection({
    request: input,
    initialPerfumes,
    catalog: sourceCatalog,
    config: testConfig,
  });
}

function score(initialPerfumes, input = {}, sourceCatalog = catalog) {
  return evaluateCompositionQuality({
    request: input,
    candidatePerfumes: initialPerfumes,
    catalog: sourceCatalog,
    config: testConfig,
  }).overallScore;
}

function deepFreeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    Object.values(value).forEach(deepFreeze);
  }

  return value;
}

describe("refineCollection", () => {
  it("returns invalid_initial for an invalid initial composition", () => {
    const result = refine({ budget: 300, minSlots: 3 }, [fresh, green]);

    expect(result.status).toBe(REFINEMENT_STATUSES.INVALID_INITIAL);
    expect(result.terminationReason).toBe(REFINEMENT_TERMINATION_REASONS.INVALID_INITIAL);
    expect(result.qualityResult.evaluable).toBe(false);
    expect(result.appliedMoves).toEqual([]);
    expect(result.finalConstraintResult.violations).toEqual([
      {
        code: "MIN_SLOTS_NOT_MET",
        actualSlots: 2,
        minSlots: 3,
      },
    ]);
  });

  it("leaves an already locally optimal composition unchanged", () => {
    const greedy = composeCollectionGreedy({
      request: { budget: 1200, minSlots: 3, targetSlots: 4, strategy: "balanced" },
      catalog,
      config: testConfig,
    });
    const result = refine(
      { budget: 1200, minSlots: 3, targetSlots: 4, strategy: "balanced" },
      greedy.selectedPerfumes
    );

    expect(result.status).toBe(REFINEMENT_STATUSES.UNCHANGED);
    expect(result.terminationReason).toBe(REFINEMENT_TERMINATION_REASONS.NO_IMPROVING_SWAP);
    expect(result.appliedMoves).toEqual([]);
    expect(result.qualityResult.overallScore).toBe(result.initialQuality.overallScore);
  });

  it("applies one improving swap and preserves hard constraints", () => {
    const result = refine(
      { budget: 1000, minSlots: 3, strategy: "balanced" },
      [fresh, green, zeroA],
      [fresh, green, zeroA, formal]
    );

    expect(result.status).toBe(REFINEMENT_STATUSES.REFINED);
    expect(result.appliedMoves).toHaveLength(1);
    expect(result.appliedMoves[0]).toMatchObject({
      type: "SWAP_PERFUME",
      removePerfumeId: 20,
      addPerfumeId: 4,
    });
    expect(result.qualityResult.overallScore).toBeGreaterThan(result.initialQuality.overallScore);
    expect(result.finalConstraintResult.valid).toBe(true);
  });

  it("can apply multiple sequential improving swaps", () => {
    const result = refine(
      { budget: 1000, minSlots: 3, strategy: "balanced" },
      [fresh, zeroA, zeroB],
      [fresh, zeroA, zeroB, green, formal]
    );

    expect(result.status).toBe(REFINEMENT_STATUSES.REFINED);
    expect(result.appliedMoves.length).toBeGreaterThanOrEqual(2);
    result.appliedMoves.forEach((move) => {
      expect(move.afterScore).toBeGreaterThan(move.beforeScore);
    });
  });

  it("selects the best move rather than the first generated move", () => {
    const result = refine(
      { budget: 1000, minSlots: 3, strategy: "balanced" },
      [fresh, green, zeroA],
      [fresh, green, zeroA, amber, formal, smoky]
    );

    expect(result.appliedMoves[0].addPerfumeId).toBe(5);
    expect(result.appliedMoves[0].afterScore).toBeGreaterThan(
      score([fresh, green, amber], { budget: 1000, minSlots: 3, strategy: "balanced" }, [
        fresh,
        green,
        zeroA,
        amber,
        formal,
        smoky,
      ])
    );
  });

  it("rejects equal-score swaps and uses deterministic tie-breaking for improving swaps", () => {
    const equalResult = refine(
      { budget: null, minSlots: 3, strategy: "balanced" },
      [fresh, green, lowerIdTie],
      [fresh, green, lowerIdTie, higherIdTie]
    );
    const tieResult = refine(
      { budget: null, minSlots: 3, strategy: "versatile" },
      [fresh, green, zeroA],
      [fresh, green, zeroA, higherPointsTie, lowerPointsTie]
    );

    expect(equalResult.status).toBe(REFINEMENT_STATUSES.UNCHANGED);
    expect(tieResult.appliedMoves[0].addPerfumeId).toBe(32);
  });

  it("preserves locked perfumes even when removing one could improve quality", () => {
    const result = refine(
      {
        budget: 1000,
        minSlots: 3,
        lockedPerfumeIds: [20],
        strategy: "balanced",
      },
      [fresh, green, zeroA],
      [fresh, green, zeroA, formal]
    );

    expect(result.finalPerfumeIds).toContain(20);
    expect(result.appliedMoves.some((move) => move.removePerfumeId === 20)).toBe(false);
  });

  it("preserves exclusions, budget, slot count, and original hard constraints", () => {
    const result = refine(
      {
        budget: 450,
        minSlots: 3,
        excludedPerfumeIds: [4],
        strategy: "balanced",
      },
      [fresh, green, zeroA],
      [fresh, green, zeroA, formal, amber]
    );

    expect(result.finalPerfumeIds).not.toContain(4);
    expect(result.collection).toHaveLength(3);
    expect(result.finalConstraintResult.valid).toBe(true);
    expect(result.finalConstraintResult.metrics.estimatedValue).toBeLessThanOrEqual(450);
  });

  it("can produce strategy-specific refinement differences", () => {
    const initial = [fresh, green, zeroA];
    const sourceCatalog = [fresh, green, zeroA, amber, formal, smoky];
    const balanced = refine(
      { budget: 1000, minSlots: 3, strategy: "balanced" },
      initial,
      sourceCatalog
    );
    const explorer = refine(
      { budget: 1000, minSlots: 3, strategy: "explorer" },
      initial,
      sourceCatalog
    );
    const versatile = refine(
      { budget: 1000, minSlots: 3, strategy: "versatile" },
      initial,
      sourceCatalog
    );
    const signature = refine(
      { budget: 1000, minSlots: 3, strategy: "signature" },
      initial,
      sourceCatalog
    );

    expect(new Set([
      balanced.finalPerfumeIds.join(","),
      explorer.finalPerfumeIds.join(","),
      versatile.finalPerfumeIds.join(","),
      signature.finalPerfumeIds.join(","),
    ]).size).toBeGreaterThan(1);
  });

  it("is independent of catalog and initial collection ordering", () => {
    const request = { budget: 1000, minSlots: 3, strategy: "balanced" };
    const first = refine(request, [zeroA, fresh, green], [fresh, green, zeroA, amber, formal]);
    const second = refine(
      request,
      [green, zeroA, fresh],
      [formal, amber, zeroA, green, fresh]
    );

    expect(second).toEqual(first);
  });

  it("confirms final local optimum by independently checking every final neighbor", () => {
    const result = refine(
      { budget: 1000, minSlots: 3, strategy: "balanced" },
      [fresh, green, zeroA],
      [fresh, green, zeroA, amber, formal, smoky]
    );
    const finalMoves = generateRefinementMoves({
      request: result.request,
      selectedPerfumes: result.collection,
      catalog: [fresh, green, zeroA, amber, formal, smoky],
      config: testConfig,
    });
    const finalNeighborScores = finalMoves.map((move) =>
      evaluateCompositionQuality({
        request: result.request,
        candidatePerfumes: move.candidatePerfumes,
        catalog: [fresh, green, zeroA, amber, formal, smoky],
        config: testConfig,
        constraintResult: move.constraintResult,
      }).overallScore
    );

    expect(result.diagnostics.finalLocalOptimum).toBe(true);
    finalNeighborScores.forEach((neighborScore) => {
      expect(neighborScore).toBeLessThanOrEqual(result.qualityResult.overallScore);
    });
  });

  it("supports iteration limits, including zero and invalid limits", () => {
    const zeroLimit = refineCollection({
      request: { budget: 1000, minSlots: 3, strategy: "balanced" },
      initialPerfumes: [fresh, zeroA, zeroB],
      catalog: [fresh, zeroA, zeroB, green, formal],
      config: testConfig,
      maxIterations: 0,
    });
    const invalidLimit = refineCollection({
      request: { budget: 1000, minSlots: 3, strategy: "balanced" },
      initialPerfumes: [fresh, zeroA, zeroB],
      catalog: [fresh, zeroA, zeroB, green, formal],
      config: testConfig,
      maxIterations: Number.NaN,
    });

    expect(zeroLimit.status).toBe(REFINEMENT_STATUSES.ITERATION_LIMIT);
    expect(zeroLimit.appliedMoves).toEqual([]);
    expect(invalidLimit.status).toBe(REFINEMENT_STATUSES.ITERATION_LIMIT);
  });

  it("has deterministic serializable diagnostics without NaN in normal results", () => {
    const result = refine(
      { budget: 1000, minSlots: 3, strategy: "balanced" },
      [fresh, green, zeroA],
      [fresh, green, zeroA, formal]
    );

    expect(JSON.stringify(result)).not.toMatch(/NaN/);
    expect(result.diagnostics).toMatchObject({
      strategyId: "balanced",
      initialPerfumeIds: [1, 2, 20],
      finalPerfumeIds: result.finalPerfumeIds,
      iterations: result.appliedMoves.length,
      terminationReason: result.terminationReason,
      finalConstraintValidity: true,
      visitedCollectionKeys: expect.any(Array),
    });
  });

  it("does not mutate frozen inputs and returns deeply equal repeated results", () => {
    const frozenRequest = deepFreeze({ budget: 1000, minSlots: 3, strategy: "balanced" });
    const frozenInitial = deepFreeze([fresh, green, zeroA]);
    const frozenCatalog = deepFreeze([fresh, green, zeroA, formal]);
    const first = refineCollection({
      request: frozenRequest,
      initialPerfumes: frozenInitial,
      catalog: frozenCatalog,
      config: testConfig,
    });
    const second = refineCollection({
      request: frozenRequest,
      initialPerfumes: frozenInitial,
      catalog: frozenCatalog,
      config: testConfig,
    });

    expect(second).toEqual(first);
    expect(frozenInitial.map((perfume) => perfume.id)).toEqual([1, 2, 20]);
  });

  it("covers golden unchanged, refined, and invalid results", () => {
    expect(refine({ budget: 1200, minSlots: 3, strategy: "balanced" }, [fresh, green, formal]))
      .toMatchObject({
        status: expect.any(String),
        terminationReason: expect.any(String),
        finalConstraintResult: {
          valid: true,
        },
      });
    expect(refine(
      { budget: 1000, minSlots: 3, strategy: "balanced" },
      [fresh, green, zeroA],
      [fresh, green, zeroA, formal]
    )).toMatchObject({
      status: REFINEMENT_STATUSES.REFINED,
      appliedMoves: [
        {
          type: "SWAP_PERFUME",
          removePerfumeId: 20,
          addPerfumeId: 4,
        },
      ],
    });
    expect(refine({ budget: 100, minSlots: 3 }, [fresh, green, amber])).toMatchObject({
      status: REFINEMENT_STATUSES.INVALID_INITIAL,
      qualityResult: {
        evaluable: false,
        overallScore: null,
      },
    });
  });
});
