import { describe, expect, it } from "vitest";

import {
  GREEDY_COMPOSER_STATUSES,
  GREEDY_TERMINATION_REASONS,
  composeCollectionGreedy,
} from "./composeCollectionGreedy.js";
import { evaluateComposerConstraints } from "./evaluateComposerConstraints.js";

const testConfig = {
  commerce: {
    currency: "USD",
    pointValue: 100,
  },
  box: {
    minSelectableSlots: 2,
    maxSelectableSlots: 5,
    defaultTargetSlots: 4,
  },
};
const largeBoxConfig = {
  commerce: {
    currency: "USD",
    pointValue: 100,
  },
  box: {
    minSelectableSlots: 6,
    maxSelectableSlots: 14,
    defaultTargetSlots: 14,
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
const tieLowId = perfume(10, {
  points: 1,
  accords: ["fresh"],
  seasons: ["summer"],
  seasonWeights: { spring: 0, summer: 10, fall: 0, winter: 0 },
  occasions: ["daily"],
  vibes: ["fresh"],
});
const tieHighId = perfume(20, {
  ...tieLowId,
  id: 20,
  name: "Tie High Id",
});
const lowerPointsTie = perfume(30, {
  points: 1,
  accords: ["aquatic"],
  seasons: ["summer"],
  seasonWeights: { spring: 2, summer: 9, fall: 0, winter: 0 },
  occasions: ["daily"],
  vibes: ["clean"],
});
const higherPointsTie = perfume(31, {
  ...lowerPointsTie,
  id: 31,
  name: "Higher Points Tie",
  points: 2,
});
const zeroContribution = perfume(40, {
  points: 0,
  seasonWeights: { spring: 0, summer: 0, fall: 0, winter: 0 },
});
const zeroContributionTwo = perfume(41, {
  ...zeroContribution,
  id: 41,
  name: "Zero Contribution Two",
});
const zeroContributionThree = perfume(42, {
  ...zeroContribution,
  id: 42,
  name: "Zero Contribution Three",
});
const zeroContributionFour = perfume(43, {
  ...zeroContribution,
  id: 43,
  name: "Zero Contribution Four",
});
const zeroContributionFive = perfume(44, {
  ...zeroContribution,
  id: 44,
  name: "Zero Contribution Five",
});
const zeroContributionSix = perfume(45, {
  ...zeroContribution,
  id: 45,
  name: "Zero Contribution Six",
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

function compose(input = {}, sourceCatalog = catalog) {
  return composeCollectionGreedy({
    request: input,
    catalog: sourceCatalog,
    config: testConfig,
  });
}

function composeLarge(input = {}, sourceCatalog = catalog) {
  return composeCollectionGreedy({
    request: input,
    catalog: sourceCatalog,
    config: largeBoxConfig,
  });
}

function deepFreeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    Object.values(value).forEach(deepFreeze);
  }

  return value;
}

describe("composeCollectionGreedy", () => {
  it("returns identical golden compositions for the same request", () => {
    const request = {
      budget: 1200,
      minSlots: 3,
      targetSlots: 4,
      strategy: "balanced",
      preferredSeasons: ["summer", "winter"],
      preferredOccasions: ["office"],
      preferredVibes: ["fresh"],
    };
    const first = compose(request);
    const second = compose(request);

    expect(first).toEqual(second);
    expect(first.status).toBe(GREEDY_COMPOSER_STATUSES.COMPLETED);
    expect(first.terminationReason).toBe(GREEDY_TERMINATION_REASONS.TARGET_SLOTS_REACHED);
    expect(first.selectedPerfumeIds).toEqual([1, 2, 4, 5]);
    expect(first.moveHistory.map((move) => move.type)).toEqual([
      "ADD_PERFUME",
      "ADD_PERFUME",
      "ADD_PERFUME",
      "ADD_PERFUME",
    ]);
  });

  it("is independent of catalog ordering", () => {
    const request = {
      budget: 800,
      minSlots: 3,
      targetSlots: 4,
      strategy: "explorer",
    };
    const normal = compose(request, catalog);
    const reversed = compose(request, [...catalog].reverse());

    expect(reversed.selectedPerfumeIds).toEqual(normal.selectedPerfumeIds);
    expect(reversed.moveHistory).toEqual(normal.moveHistory);
  });

  it("respects budget, locked perfumes, and excluded perfumes", () => {
    const result = compose({
      budget: 450,
      minSlots: 2,
      targetSlots: 3,
      lockedPerfumeIds: [1],
      excludedPerfumeIds: [3, 5, 6],
      strategy: "versatile",
    });

    expect(result.selectedPerfumeIds).toContain(1);
    expect(result.selectedPerfumeIds).not.toContain(3);
    expect(result.selectedPerfumeIds).not.toContain(5);
    expect(result.finalConstraintResult.valid).toBe(true);
    expect(result.finalConstraintResult.metrics.estimatedValue).toBeLessThanOrEqual(450);
  });

  it("supports unlimited budget", () => {
    const result = compose({
      minSlots: 2,
      targetSlots: 4,
      strategy: "signature",
    });

    expect(result.finalConstraintResult.metrics.remainingBudget).toBe(Infinity);
    expect(result.finalConstraintResult.valid).toBe(true);
    expect(result.selectedPerfumeIds.length).toBe(4);
  });

  it("respects minimum and maximum slot settings", () => {
    const result = compose({
      budget: 1000,
      minSlots: 2,
      maxSlots: 3,
      targetSlots: 5,
      strategy: "balanced",
    });

    expect(result.selectedPerfumeIds.length).toBeLessThanOrEqual(3);
    expect(result.finalConstraintResult.valid).toBe(true);
  });

  it("returns impossible for infeasible requests", () => {
    const result = compose({
      budget: 100,
      minSlots: 3,
      lockedPerfumeIds: [5],
    });

    expect(result.status).toBe(GREEDY_COMPOSER_STATUSES.IMPOSSIBLE);
    expect(result.terminationReason).toBe(GREEDY_TERMINATION_REASONS.REQUEST_INFEASIBLE);
    expect(result.qualityResult.evaluable).toBe(false);
  });

  it("returns partial when legal moves run out before target slots but the minimum is valid", () => {
    const result = compose(
      {
        budget: 250,
        minSlots: 2,
        targetSlots: 4,
        strategy: "balanced",
      },
      [fresh, green]
    );

    expect(result.status).toBe(GREEDY_COMPOSER_STATUSES.PARTIAL);
    expect(result.terminationReason).toBe(GREEDY_TERMINATION_REASONS.NO_LEGAL_MOVE);
    expect(result.finalConstraintResult.valid).toBe(true);
    expect(result.selectedPerfumeIds).toEqual([1, 2]);
  });

  it("returns no-improving-move when the best legal move does not improve measured quality", () => {
    const result = compose(
      {
        budget: null,
        minSlots: 0,
        targetSlots: 1,
        strategy: "balanced",
      },
      [zeroContribution]
    );

    expect(result.status).toBe(GREEDY_COMPOSER_STATUSES.NO_IMPROVING_MOVE);
    expect(result.terminationReason).toBe(GREEDY_TERMINATION_REASONS.NO_IMPROVING_MOVE);
    expect(result.selectedPerfumeIds).toEqual([]);
  });

  it("continues from an empty start until minSlots 6 when the minimum is feasible", () => {
    const result = composeLarge(
      {
        budget: null,
        minSlots: 6,
        targetSlots: 6,
        strategy: "balanced",
      },
      [
        zeroContribution,
        zeroContributionTwo,
        zeroContributionThree,
        zeroContributionFour,
        zeroContributionFive,
        zeroContributionSix,
      ]
    );

    expect(result.status).toBe(GREEDY_COMPOSER_STATUSES.COMPLETED);
    expect(result.selectedPerfumeIds).toEqual([40, 41, 42, 43, 44, 45]);
    expect(result.finalConstraintResult.valid).toBe(true);
  });

  it("continues through temporary quality decreases before minSlots", () => {
    const result = composeLarge(
      {
        budget: null,
        minSlots: 6,
        targetSlots: 6,
        strategy: "balanced",
      },
      [
        fresh,
        green,
        amber,
        zeroContribution,
        zeroContributionTwo,
        zeroContributionThree,
      ]
    );
    const qualityScores = result.moveHistory.map((move) => move.qualityScore);

    expect(result.selectedPerfumeIds.length).toBe(6);
    expect(result.finalConstraintResult.valid).toBe(true);
    expect(
      qualityScores.some((score, index) => index > 0 && score < qualityScores[index - 1])
    ).toBe(true);
  });

  it("does not terminate no-improving-move at slot 4 when minSlots is 6", () => {
    const result = composeLarge(
      {
        budget: null,
        minSlots: 6,
        targetSlots: 6,
        lockedPerfumeIds: [1, 2, 3, 4],
        strategy: "balanced",
      },
      [fresh, green, amber, formal, zeroContribution, zeroContributionTwo]
    );

    expect(result.selectedPerfumeIds).toEqual([1, 2, 3, 4, 40, 41]);
    expect(result.terminationReason).toBe(GREEDY_TERMINATION_REASONS.TARGET_SLOTS_REACHED);
    expect(result.finalConstraintResult.valid).toBe(true);
  });

  it("allows no-improving-move termination at slot 8 when minSlots is 6 and targetSlots is 14", () => {
    const result = composeLarge(
      {
        budget: null,
        minSlots: 6,
        targetSlots: 14,
        lockedPerfumeIds: [1, 2, 3, 4, 40, 41, 42, 43],
        strategy: "balanced",
      },
      [
        fresh,
        green,
        amber,
        formal,
        zeroContribution,
        zeroContributionTwo,
        zeroContributionThree,
        zeroContributionFour,
        zeroContributionFive,
      ]
    );

    expect(result.status).toBe(GREEDY_COMPOSER_STATUSES.NO_IMPROVING_MOVE);
    expect(result.terminationReason).toBe(GREEDY_TERMINATION_REASONS.NO_IMPROVING_MOVE);
    expect(result.selectedPerfumeIds).toEqual([1, 2, 3, 4, 40, 41, 42, 43]);
    expect(result.finalConstraintResult.valid).toBe(true);
  });

  it("returns below-minimum partial only when the minimum is unreachable", () => {
    const result = composeLarge(
      {
        budget: 50,
        minSlots: 6,
        targetSlots: 6,
        strategy: "balanced",
      },
      [
        zeroContribution,
        zeroContributionTwo,
        zeroContributionThree,
        zeroContributionFour,
        zeroContributionFive,
        fresh,
      ]
    );

    expect(result.status).toBe(GREEDY_COMPOSER_STATUSES.PARTIAL);
    expect(result.terminationReason).toBe(GREEDY_TERMINATION_REASONS.NO_LEGAL_MOVE);
    expect(result.selectedPerfumeIds).toEqual([40, 41, 42, 43, 44]);
    expect(result.finalConstraintResult.valid).toBe(false);
    expect(result.finalConstraintResult.violations).toEqual([
      {
        code: "MIN_SLOTS_NOT_MET",
        actualSlots: 5,
        minSlots: 6,
      },
    ]);
  });

  it("completed results satisfy evaluateComposerConstraints with the original normalized request", () => {
    const result = composeLarge(
      {
        budget: null,
        minSlots: 6,
        targetSlots: 6,
        strategy: "balanced",
      },
      [
        zeroContribution,
        zeroContributionTwo,
        zeroContributionThree,
        zeroContributionFour,
        zeroContributionFive,
        zeroContributionSix,
      ]
    );
    const originalConstraintResult = evaluateComposerConstraints({
      request: result.request,
      candidatePerfumes: result.selectedPerfumes,
      catalog: [
        zeroContribution,
        zeroContributionTwo,
        zeroContributionThree,
        zeroContributionFour,
        zeroContributionFive,
        zeroContributionSix,
      ],
      config: largeBoxConfig,
    });

    expect(result.status).toBe(GREEDY_COMPOSER_STATUSES.COMPLETED);
    expect(originalConstraintResult.valid).toBe(true);
    expect(result.finalConstraintResult).toEqual(originalConstraintResult);
  });

  it("uses lower points as a deterministic tie-breaker after quality and preference fit", () => {
    const result = compose(
      {
        budget: null,
        minSlots: 1,
        targetSlots: 1,
        strategy: "versatile",
      },
      [higherPointsTie, lowerPointsTie]
    );

    expect(result.selectedPerfumeIds).toEqual([30]);
  });

  it("uses lower perfume ID as the final deterministic tie-breaker", () => {
    const result = compose(
      {
        budget: null,
        minSlots: 1,
        targetSlots: 1,
        strategy: "versatile",
      },
      [tieHighId, tieLowId]
    );

    expect(result.selectedPerfumeIds).toEqual([10]);
  });

  it("does not mutate frozen inputs", () => {
    const frozenRequest = deepFreeze({
      budget: 800,
      minSlots: 3,
      targetSlots: 4,
      strategy: "balanced",
    });
    const frozenCatalog = deepFreeze([...catalog]);

    composeCollectionGreedy({
      request: frozenRequest,
      catalog: frozenCatalog,
      config: testConfig,
    });

    expect(frozenRequest).toEqual({
      budget: 800,
      minSlots: 3,
      targetSlots: 4,
      strategy: "balanced",
    });
    expect(frozenCatalog.map((perfume) => perfume.id)).toEqual([1, 2, 3, 4, 5, 6]);
  });
});
