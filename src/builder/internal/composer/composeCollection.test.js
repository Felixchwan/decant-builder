import { describe, expect, it } from "vitest";

import {
  COMPOSER_STATUSES,
  COMPOSER_TERMINATION_REASONS,
  composeCollection,
} from "./composeCollection.js";
import { COMPOSER_MODES, DEFAULT_COMPOSER_MODE, normalizeComposerMode } from "./composerModes.js";
import { evaluateCompositionQuality } from "./evaluateCompositionQuality.js";
import { fragrances as realCatalog, notes as realNotes } from "@discovery-box/catalog";
import { discoveryDecantsConfig } from "../../config/discoveryDecantsConfig.js";

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
const zeroA = perfume(20, {
  points: 0,
  seasonWeights: { spring: 0, summer: 0, fall: 0, winter: 0 },
});
const zeroB = perfume(21, {
  ...zeroA,
  id: 21,
  name: "Zero B",
});
const zeroC = perfume(22, {
  ...zeroA,
  id: 22,
  name: "Zero C",
});

const catalog = [fresh, green, amber, formal, smoky, sweet];
const refinementCatalog = [fresh, green, zeroA, amber, formal, smoky];

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

function compose(input = {}, sourceCatalog = catalog, mode) {
  return composeCollection({
    request: input,
    catalog: sourceCatalog,
    mode,
    config: testConfig,
  });
}

function composeRealCatalog(input = {}, mode = "best") {
  return composeCollection({
    request: {
      minSlots: discoveryDecantsConfig.box.minSelectableSlots,
      maxSlots: discoveryDecantsConfig.box.maxSelectableSlots,
      targetSlots: discoveryDecantsConfig.box.defaultTargetSlots,
      strategy: "balanced",
      ...input,
    },
    catalog: realCatalog,
    notes: realNotes,
    mode,
    config: discoveryDecantsConfig,
  });
}

function summarizeComposition(result) {
  const totalPoints = result.constraintResult.metrics.totalPoints;

  return {
    ids: result.collectionIds,
    count: result.collection.length,
    totalPoints,
    averagePoints: roundNumber(totalPoints / Math.max(1, result.collection.length)),
    preferenceFit: result.qualityResult.dimensions.preferenceFit?.score || 0,
    valid: result.constraintResult.valid,
    duplicateFree: new Set(result.collectionIds).size === result.collectionIds.length,
  };
}

function deepFreeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    Object.values(value).forEach(deepFreeze);
  }

  return value;
}

describe("composerModes", () => {
  it("normalizes supported, omitted, and invalid modes deterministically", () => {
    expect(DEFAULT_COMPOSER_MODE).toBe(COMPOSER_MODES.BEST);
    expect(normalizeComposerMode("fast")).toEqual({ mode: "fast", inputIssue: null });
    expect(normalizeComposerMode("best")).toEqual({ mode: "best", inputIssue: null });
    expect(normalizeComposerMode()).toEqual({ mode: "best", inputIssue: null });
    expect(normalizeComposerMode("slow")).toEqual({
      mode: "best",
      inputIssue: {
        code: "UNKNOWN_COMPOSER_MODE",
        mode: "slow",
        defaultMode: "best",
      },
    });
  });
});

describe("composeCollection", () => {
  it("returns the exact stable top-level shape and serializable output", () => {
    const result = compose({ budget: 1200, minSlots: 3, targetSlots: 4 }, catalog, "fast");

    expect(Object.keys(result)).toEqual([
      "composed",
      "mode",
      "status",
      "terminationReason",
      "normalizedRequest",
      "collection",
      "collectionIds",
      "constraintResult",
      "qualityResult",
      "greedyResult",
      "refinementResult",
      "diagnostics",
    ]);
    expect(result.refinementResult).toBeNull();
    expect(JSON.stringify(result)).not.toMatch(/undefined|NaN/);
  });

  it("defaults to best mode and records invalid mode diagnostics without throwing", () => {
    const defaultResult = compose({ budget: 1200, minSlots: 3, targetSlots: 4 });
    const invalidModeResult = compose({ budget: 1200, minSlots: 3, targetSlots: 4 }, catalog, "slow");

    expect(defaultResult.mode).toBe("best");
    expect(invalidModeResult.mode).toBe("best");
    expect(invalidModeResult.diagnostics.modeInputIssue).toEqual({
      code: "UNKNOWN_COMPOSER_MODE",
      mode: "slow",
      defaultMode: "best",
    });
  });

  it("fast mode invokes Greedy only and independently re-evaluates final quality", () => {
    const result = compose(
      { budget: 1200, minSlots: 3, targetSlots: 4, strategy: "balanced" },
      catalog,
      "fast"
    );
    const independentQuality = evaluateCompositionQuality({
      request: result.normalizedRequest,
      candidatePerfumes: result.collection,
      catalog,
      config: testConfig,
      constraintResult: result.constraintResult,
    });

    expect(result.mode).toBe("fast");
    expect(result.refinementResult).toBeNull();
    expect(result.diagnostics.refinementInvoked).toBe(false);
    expect(result.diagnostics.refinementSkippedReason).toBe(
      COMPOSER_TERMINATION_REASONS.REFINEMENT_SKIPPED_FAST_MODE
    );
    expect(result.diagnostics.finalSource).toBe("greedy");
    expect(result.collectionIds).toEqual(result.greedyResult.selectedPerfumeIds);
    expect(result.qualityResult).toEqual(independentQuality);
  });

  it("best mode selects a valid refined collection when an improving swap exists", () => {
    const fast = compose(
      {
        budget: 350,
        minSlots: 3,
        targetSlots: 3,
        strategy: "balanced",
      },
      refinementCatalog,
      "fast"
    );
    const best = compose(
      {
        budget: 350,
        minSlots: 3,
        targetSlots: 3,
        strategy: "balanced",
      },
      refinementCatalog,
      "best"
    );

    expect(best.refinementResult.status).toBe("refined");
    expect(best.diagnostics.finalSource).toBe("refinement");
    expect(best.qualityResult.overallScore).toBeGreaterThanOrEqual(
      fast.qualityResult.overallScore
    );
    expect(best.composed).toBe(true);
    expect(best.constraintResult.valid).toBe(true);
  });

  it("best mode preserves a locally optimal Greedy collection unchanged", () => {
    const result = compose(
      { budget: 1200, minSlots: 3, targetSlots: 4, strategy: "balanced" },
      catalog,
      "best"
    );

    expect(result.refinementResult.status).toBe("unchanged");
    expect(result.diagnostics.finalSource).toBe("greedy");
    expect(result.collectionIds).toEqual(result.greedyResult.selectedPerfumeIds);
  });

  it("handles valid partial Greedy results as composed and eligible for refinement", () => {
    const result = compose(
      {
        budget: 250,
        minSlots: 3,
        targetSlots: 4,
        strategy: "balanced",
        collectionStyle: "premium_focus",
      },
      [zeroA, zeroB, zeroC, fresh],
      "best"
    );

    expect(result.status).toBe(COMPOSER_STATUSES.PARTIAL);
    expect(result.composed).toBe(true);
    expect(result.diagnostics.minimumSlotsReached).toBe(true);
    expect(result.diagnostics.targetSlotsReached).toBe(false);
    expect(result.diagnostics.refinementEligible).toBe(true);
  });

  it("distinguishes below-minimum partial results from sellable partial results", () => {
    const result = compose(
      { budget: 50, minSlots: 3, targetSlots: 4, strategy: "balanced" },
      [zeroA, zeroB, fresh],
      "best"
    );

    expect(result.status).toBe(COMPOSER_STATUSES.IMPOSSIBLE);
    expect(result.composed).toBe(false);
    expect(result.diagnostics.refinementInvoked).toBe(false);
    expect(result.qualityResult.evaluable).toBe(false);
  });

  it("preserves impossible request behavior without fabricating quality", () => {
    const result = compose(
      { budget: 100, minSlots: 3, lockedPerfumeIds: [5], strategy: "balanced" },
      catalog,
      "best"
    );

    expect(result.status).toBe(COMPOSER_STATUSES.IMPOSSIBLE);
    expect(result.composed).toBe(false);
    expect(result.diagnostics.refinementInvoked).toBe(false);
    expect(result.qualityResult.evaluable).toBe(false);
    expect(result.qualityResult.overallScore).toBeNull();
  });

  it("preserves locked anchors, exclusions, and budget through the complete pipeline", () => {
    const result = compose(
      {
        budget: 600,
        minSlots: 3,
        targetSlots: 3,
        lockedPerfumeIds: [1],
        excludedPerfumeIds: [3, 5, 6],
        strategy: "versatile",
      },
      catalog,
      "best"
    );

    expect(result.collectionIds).toContain(1);
    expect(result.collectionIds).not.toContain(3);
    expect(result.collectionIds).not.toContain(5);
    expect(result.constraintResult.valid).toBe(true);
    expect(result.constraintResult.metrics.estimatedValue).toBeLessThanOrEqual(600);
    expect(result.diagnostics.lockedIdsPreserved).toBe(true);
    expect(result.diagnostics.excludedIdsAbsent).toBe(true);
  });

  it("supports iteration-limit refinement when valid and non-worse", () => {
    const result = composeCollection({
      request: {
        budget: 350,
        minSlots: 3,
        targetSlots: 3,
        strategy: "balanced",
      },
      catalog: refinementCatalog,
      mode: "best",
      config: testConfig,
      refinementMaxIterations: 0,
    });

    expect(result.refinementResult.status).toBe("iteration_limit");
    expect(result.diagnostics.finalSource).toBe("refinement");
    expect(result.qualityResult.overallScore).toBeGreaterThanOrEqual(
      result.greedyResult.qualityResult.overallScore
    );
  });

  it("is deterministic and independent of catalog, locked, excluded, and preference ordering", () => {
    const request = {
      budget: 1200,
      minSlots: 3,
      targetSlots: 4,
      lockedPerfumeIds: [2, 1],
      excludedPerfumeIds: [6, 5],
      preferredSeasons: ["winter", "summer"],
      preferredOccasions: ["office", "date"],
      preferredVibes: ["fresh", "warm"],
      strategy: "explorer",
    };
    const reorderedRequest = {
      ...request,
      lockedPerfumeIds: [1, 2],
      excludedPerfumeIds: [5, 6],
      preferredSeasons: ["summer", "winter"],
      preferredOccasions: ["date", "office"],
      preferredVibes: ["warm", "fresh"],
    };
    const first = compose(request, catalog, "best");
    const second = compose(reorderedRequest, [...catalog].reverse(), "best");

    expect(second).toEqual(first);
  });

  it("does not mutate frozen inputs", () => {
    const frozenRequest = deepFreeze({
      budget: 1200,
      minSlots: 3,
      targetSlots: 4,
      strategy: "signature",
    });
    const frozenCatalog = deepFreeze([...catalog]);
    const first = composeCollection({
      request: frozenRequest,
      catalog: frozenCatalog,
      mode: "best",
      config: testConfig,
    });
    const second = composeCollection({
      request: frozenRequest,
      catalog: frozenCatalog,
      mode: "best",
      config: testConfig,
    });

    expect(second).toEqual(first);
    expect(frozenRequest.strategy).toBe("signature");
    expect(frozenCatalog.map((perfume) => perfume.id)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it("preserves strategy across balanced, versatile, explorer, and signature orchestration", () => {
    ["balanced", "versatile", "explorer", "signature"].forEach((strategy) => {
      const result = compose(
        { budget: 1200, minSlots: 3, targetSlots: 4, strategy },
        catalog,
        "best"
      );

      expect(result.normalizedRequest.strategy.id).toBe(strategy);
      expect(result.diagnostics.normalizedStrategyId).toBe(strategy);
      expect(result.greedyResult.request.strategy.id).toBe(strategy);
      expect(result.refinementResult?.request?.strategy.id || strategy).toBe(strategy);
      expect(result.qualityResult.diagnostics.strategyId).toBe(strategy);
    });
  });

  it("covers golden fast, best refined, best unchanged, valid partial, and impossible outputs", () => {
    expect(compose(
      { budget: 1200, minSlots: 3, targetSlots: 4, strategy: "balanced" },
      catalog,
      "fast"
    )).toMatchObject({
      composed: true,
      mode: "fast",
      status: "completed",
      terminationReason: "greedy-target-reached",
      refinementResult: null,
    });
    expect(compose(
      {
        budget: 350,
        minSlots: 3,
        targetSlots: 3,
        strategy: "balanced",
      },
      refinementCatalog,
      "best"
    )).toMatchObject({
      composed: true,
      mode: "best",
      diagnostics: {
        finalSource: "refinement",
      },
    });
    expect(compose(
      { budget: 1200, minSlots: 3, targetSlots: 4, strategy: "balanced" },
      catalog,
      "best"
    )).toMatchObject({
      composed: true,
      diagnostics: {
        finalSource: "greedy",
      },
    });
    expect(compose(
      {
        budget: 250,
        minSlots: 3,
        targetSlots: 4,
        strategy: "balanced",
        collectionStyle: "premium_focus",
      },
      [zeroA, zeroB, zeroC, fresh],
      "fast"
    )).toMatchObject({
      composed: true,
      status: "partial",
      terminationReason: "greedy-valid-partial",
    });
    expect(compose(
      { budget: 100, minSlots: 3, lockedPerfumeIds: [5], strategy: "balanced" },
      catalog,
      "best"
    )).toMatchObject({
      composed: false,
      status: "impossible",
      qualityResult: {
        evaluable: false,
        overallScore: null,
      },
    });
  });

  it("keeps Balanced Mix between Premium Focus and More Variety for the real 17-point proposal", () => {
    const baseRequest = {
      budget: 1700,
      preferredSeasons: ["spring", "summer", "fall", "winter"],
      preferredOccasions: ["daily", "office", "date", "night", "formal"],
      preferredVibes: ["fresh", "clean", "warm", "elegant"],
    };
    const premium = composeRealCatalog(
      { ...baseRequest, collectionStyle: "premium_focus" },
      "best"
    );
    const balanced = composeRealCatalog(
      { ...baseRequest, collectionStyle: "balanced_mix" },
      "best"
    );
    const variety = composeRealCatalog(
      { ...baseRequest, collectionStyle: "more_variety" },
      "best"
    );
    const premiumSummary = summarizeComposition(premium);
    const balancedSummary = summarizeComposition(balanced);
    const varietySummary = summarizeComposition(variety);
    const outputMidpoint = Math.round((premiumSummary.count + varietySummary.count) / 2);

    [premiumSummary, balancedSummary, varietySummary].forEach((summary) => {
      expect(summary.valid).toBe(true);
      expect(summary.duplicateFree).toBe(true);
      expect(summary.totalPoints).toBeLessThanOrEqual(17);
      expect(summary.preferenceFit).toBeGreaterThanOrEqual(90);
    });
    expect(premiumSummary.count).toBeLessThanOrEqual(balancedSummary.count);
    expect(balancedSummary.count).toBeLessThanOrEqual(varietySummary.count);
    expect(balancedSummary.count).toBeGreaterThan(premiumSummary.count);
    expect(Math.abs(balancedSummary.count - outputMidpoint)).toBeLessThanOrEqual(1);
    expect(premiumSummary.averagePoints).toBeGreaterThanOrEqual(
      balancedSummary.averagePoints
    );
    expect(balancedSummary.averagePoints).toBeGreaterThanOrEqual(
      varietySummary.averagePoints
    );
    expect(balanced.greedyResult.diagnostics).toMatchObject({
      balancedPremiumFloorSlots: discoveryDecantsConfig.box.minSelectableSlots,
      balancedVarietyCeilingSlots: discoveryDecantsConfig.box.defaultTargetSlots,
      balancedTargetSlots: 10,
      searchTargetSlots: 10,
    });
    expect(balanced.greedyResult.terminationReason).toBe(
      "collection-style-target-reached"
    );
  }, 20000);

  it("preserves Premium Focus and More Variety established 17-point outputs", () => {
    const baseRequest = {
      budget: 1700,
      preferredSeasons: ["spring", "summer", "fall", "winter"],
      preferredOccasions: ["daily", "office", "date", "night", "formal"],
      preferredVibes: ["fresh", "clean", "warm", "elegant"],
    };

    expect(
      composeRealCatalog({ ...baseRequest, collectionStyle: "premium_focus" }, "best")
        .collectionIds
    ).toEqual([23, 111, 204, 208, 302, 407, 409]);
    expect(
      composeRealCatalog({ ...baseRequest, collectionStyle: "more_variety" }, "best")
        .collectionIds
    ).toEqual([1, 8, 10, 11, 15, 16, 18, 19, 23, 30, 33, 118, 207, 302]);
  }, 20000);

  it("keeps collection-style counts ordered across a compact real-catalog matrix", () => {
    const scenarios = [
      {
        name: "lower budget broad",
        request: {
          budget: 1200,
          preferredSeasons: ["spring", "summer", "fall", "winter"],
          preferredOccasions: ["daily", "office", "date"],
          preferredVibes: ["fresh", "clean", "warm"],
        },
      },
      {
        name: "premium compatible",
        request: {
          budget: 1700,
          strategy: "signature",
          preferredSeasons: ["fall", "winter"],
          preferredOccasions: ["date", "night", "formal", "evening"],
          preferredVibes: ["warm", "dark", "seductive", "elegant"],
        },
      },
      {
        name: "fresh warm weather",
        request: {
          budget: 1700,
          preferredSeasons: ["spring", "summer"],
          preferredOccasions: ["daily", "office", "casual"],
          preferredVibes: ["fresh", "clean", "energetic"],
        },
      },
      {
        name: "restrictive winter formal",
        request: {
          budget: 1700,
          preferredSeasons: ["winter"],
          preferredOccasions: ["formal"],
          preferredVibes: ["mysterious"],
        },
      },
    ];

    scenarios.forEach(({ name, request }) => {
      const premium = summarizeComposition(
        composeRealCatalog({ ...request, collectionStyle: "premium_focus" }, "fast")
      );
      const balanced = summarizeComposition(
        composeRealCatalog({ ...request, collectionStyle: "balanced_mix" }, "fast")
      );
      const variety = summarizeComposition(
        composeRealCatalog({ ...request, collectionStyle: "more_variety" }, "fast")
      );

      [premium, balanced, variety].forEach((summary) => {
        expect(summary.valid, name).toBe(true);
        expect(summary.duplicateFree, name).toBe(true);
        expect(summary.totalPoints, name).toBeLessThanOrEqual(request.budget / 100);
        expect(summary.preferenceFit, name).toBeGreaterThanOrEqual(75);
      });
      expect(premium.count, name).toBeLessThanOrEqual(balanced.count);
      expect(balanced.count, name).toBeLessThanOrEqual(variety.count);

      if (premium.count < variety.count) {
        expect(
          Math.abs(balanced.count - Math.round((premium.count + variety.count) / 2)),
          name
        ).toBeLessThanOrEqual(2);
      }
      expect(premium.averagePoints, name).toBeGreaterThanOrEqual(
        balanced.averagePoints
      );
      expect(balanced.averagePoints, name).toBeGreaterThanOrEqual(
        variety.averagePoints
      );
    });
  }, 20000);

  it("allows legitimate collection-style count ties when slot constraints collapse the range", () => {
    const request = {
      budget: 1200,
      minSlots: 3,
      maxSlots: 3,
      targetSlots: 3,
      strategy: "balanced",
    };
    const premium = compose(
      { ...request, collectionStyle: "premium_focus" },
      catalog,
      "fast"
    );
    const balanced = compose(
      { ...request, collectionStyle: "balanced_mix" },
      catalog,
      "fast"
    );
    const variety = compose(
      { ...request, collectionStyle: "more_variety" },
      catalog,
      "fast"
    );

    [premium, balanced, variety].forEach((result) => {
      expect(result.constraintResult.valid).toBe(true);
      expect(result.collection.length).toBe(3);
      expect(result.constraintResult.metrics.totalPoints).toBeLessThanOrEqual(12);
    });
    expect(balanced.greedyResult.diagnostics.balancedTargetSlots).toBe(3);
  });
});

function roundNumber(value) {
  return Math.round(value * 100) / 100;
}
