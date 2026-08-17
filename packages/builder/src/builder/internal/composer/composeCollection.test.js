import { describe, expect, it } from "vitest";

import {
  COMPOSER_STATUSES,
  COMPOSER_TERMINATION_REASONS,
  composeCollection,
} from "./composeCollection.js";
import { COMPOSER_MODES, DEFAULT_COMPOSER_MODE, normalizeComposerMode } from "./composerModes.js";
import { evaluateCompositionQuality } from "./evaluateCompositionQuality.js";
import { fragrances as realCatalog, notes as realNotes } from "@discovery-box/catalog";
import { discoveryDecantsConfig } from "../../../../../../src/merchants/discoveryDecants/config.js";

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

    // Recomputed after adding 3 new real catalog entries (ids 35, 214, 410):
    // Graphite (35, bronze) legitimately outcompetes some previously-picked
    // items on this budget/preference scenario -- a real, expected
    // consequence of adding new inventory that fits, not a regression.
    expect(
      composeRealCatalog({ ...baseRequest, collectionStyle: "premium_focus" }, "best")
        .collectionIds
    ).toEqual([35, 109, 208, 210, 302, 407, 409]);
    expect(
      composeRealCatalog({ ...baseRequest, collectionStyle: "more_variety" }, "best")
        .collectionIds
    ).toEqual([1, 7, 8, 10, 11, 15, 19, 23, 26, 30, 35, 118, 207, 302]);
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

describe("points floor completion", () => {
  it("behaves identically to today when no floor is supplied", () => {
    const withoutField = compose({ minSlots: 2, maxSlots: 4, targetSlots: 2 });
    const withNullField = compose({
      minSlots: 2,
      maxSlots: 4,
      targetSlots: 2,
      minimumPoints: null,
    });

    expect(withoutField.status).toBe(COMPOSER_STATUSES.COMPLETED);
    expect(withoutField.collection.length).toBe(2);
    expect(withoutField.constraintResult.metrics.pointsFloor).toBeNull();
    expect(withNullField).toEqual(withoutField);
  });

  it("reports impossible/minimum-unreachable when the floor cannot be reached at all", () => {
    // Max achievable with all 4 selectable catalog items (amber+formal+smoky+sweet)
    // is 13.5 points, comfortably short of 20.
    const result = compose({ minSlots: 3, maxSlots: 4, targetSlots: 4, minimumPoints: 20 });

    expect(result.status).toBe(COMPOSER_STATUSES.IMPOSSIBLE);
    expect(result.terminationReason).toBe(COMPOSER_TERMINATION_REASONS.MINIMUM_UNREACHABLE);
    expect(result.composed).toBe(false);
  });

  it("reports impossible when the floor exceeds the budget ceiling itself", () => {
    // budget=650 with pointValue=100 -> maxPoints=6.5, already below floor=12
    // regardless of catalog contents.
    const result = compose({
      minSlots: 2,
      maxSlots: 4,
      targetSlots: 2,
      budget: 650,
      minimumPoints: 12,
    });

    expect(result.status).toBe(COMPOSER_STATUSES.IMPOSSIBLE);
    expect(result.composed).toBe(false);
  });

  it("suppresses the quality plateau and extends past targetSlots (not maxSlots) to reach a floor", () => {
    // The natural (no-floor) balanced_mix result for targetSlots=2 is
    // [green, smoky] = 5.5pts, below floor=5... no -- picked to sit strictly
    // above what 2 items alone can reach (5.5) but reachable with a 3rd:
    // greedy's own floor-safe extension lands on [green, formal, sweet] =
    // 1.5+2.5+5 = 9pts, and stops there rather than continuing to maxSlots.
    const result = compose({
      minSlots: 2,
      maxSlots: 4,
      targetSlots: 2,
      minimumPoints: 8,
      collectionStyle: "balanced_mix",
    });

    expect(result.status).toBe(COMPOSER_STATUSES.COMPLETED);
    expect(result.terminationReason).toBe(COMPOSER_TERMINATION_REASONS.POINTS_FLOOR_REACHED);
    expect(result.collection.length).toBe(3);
    expect(result.constraintResult.metrics.totalPoints).toBe(9);
    expect(result.constraintResult.metrics.pointsFloorMet).toBe(true);
    expect(result.composed).toBe(true);
  });

  it("extends all the way to maxSlots when the floor requires it", () => {
    const result = compose({
      minSlots: 2,
      maxSlots: 4,
      targetSlots: 2,
      minimumPoints: 13,
      collectionStyle: "balanced_mix",
    });

    expect(result.status).toBe(COMPOSER_STATUSES.COMPLETED);
    expect(result.terminationReason).toBe(COMPOSER_TERMINATION_REASONS.POINTS_FLOOR_REACHED);
    expect(result.collection.length).toBe(4);
    expect(result.constraintResult.metrics.totalPoints).toBe(13);
    expect(result.constraintResult.metrics.totalPoints).toBeGreaterThanOrEqual(13);
  });

  it("uses the ordinary (non-floor) reason when the floor is already met by the natural result", () => {
    const withoutFloor = compose({
      minSlots: 2,
      maxSlots: 4,
      targetSlots: 2,
      collectionStyle: "balanced_mix",
    });
    const withAlreadyMetFloor = compose({
      minSlots: 2,
      maxSlots: 4,
      targetSlots: 2,
      minimumPoints: 2,
      collectionStyle: "balanced_mix",
    });

    expect(withAlreadyMetFloor.collectionIds).toEqual(withoutFloor.collectionIds);
    expect(withAlreadyMetFloor.terminationReason).toBe(withoutFloor.terminationReason);
    expect(withAlreadyMetFloor.terminationReason).not.toBe(
      COMPOSER_TERMINATION_REASONS.POINTS_FLOOR_REACHED
    );
  });

  it("treats a floor already satisfied by locked perfumes as ordinary, unmodified behavior", () => {
    const result = compose({
      minSlots: 1,
      maxSlots: 4,
      targetSlots: 1,
      minimumPoints: 3,
      lockedPerfumeIds: [6],
    });

    expect(result.terminationReason).toBe(COMPOSER_TERMINATION_REASONS.GREEDY_TARGET_REACHED);
    expect(result.collection.length).toBe(1);
    expect(result.constraintResult.metrics.pointsFloorMet).toBe(true);
  });

  it("does not affect a request whose natural (no-floor) result already clears the floor", () => {
    const withoutFloor = composeRealCatalog({});

    expect(withoutFloor.constraintResult.metrics.totalPoints).toBeGreaterThanOrEqual(12);

    const withFloor = composeRealCatalog({ minimumPoints: 12 });

    expect(withFloor.collectionIds).toEqual(withoutFloor.collectionIds);
  }, 20000);

  it("never lets refinement undo an already-met floor for a higher-quality swap", () => {
    const result = compose(
      {
        minSlots: 2,
        maxSlots: 4,
        targetSlots: 3,
        minimumPoints: 8,
        collectionStyle: "balanced_mix",
      },
      refinementCatalog
    );

    expect(result.status).toBe(COMPOSER_STATUSES.COMPLETED);
    expect(result.constraintResult.metrics.pointsFloorMet).toBe(true);
    expect(result.constraintResult.metrics.totalPoints).toBeGreaterThanOrEqual(8);
  });
});

function roundNumber(value) {
  return Math.round(value * 100) / 100;
}
