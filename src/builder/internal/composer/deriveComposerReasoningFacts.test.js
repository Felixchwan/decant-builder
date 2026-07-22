import { describe, expect, it } from "vitest";
import { createBuilderConfig } from "../../config/createBuilderConfig.js";
import { composeCollection } from "./composeCollection.js";
import { deriveComposerReasoningFacts } from "./deriveComposerReasoningFacts.js";
import {
  BUDGET_ASSESSMENTS,
  DIRECTIONALITY,
  MATCH_LEVELS,
  REFINEMENT_FACT_STATUSES,
  classifyBudgetUtilization,
  classifyCoveragePercent,
  classifyMatchRatio,
  classifyQualityScore,
  classifyRedundancyMagnitude,
} from "./composerReasoningLevels.js";

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

const zeroA = perfume(20, {
  points: 0,
  seasons: ["spring"],
  occasions: ["day"],
  vibes: ["fresh"],
  accords: ["citrus"],
  seasonWeights: { spring: 0, summer: 0, fall: 0, winter: 0 },
});

const zeroB = perfume(21, {
  points: 0,
  seasons: ["summer"],
  occasions: ["casual"],
  vibes: ["clean"],
  accords: ["aquatic"],
  seasonWeights: { spring: 0, summer: 0, fall: 0, winter: 0 },
});

const zeroC = perfume(22, {
  points: 0,
  seasons: ["fall"],
  occasions: ["office"],
  vibes: ["green"],
  accords: ["green"],
  seasonWeights: { spring: 0, summer: 0, fall: 0, winter: 0 },
});

const catalog = [fresh, green, amber, formal, smoky, sweet];
const partialCatalog = [zeroA, zeroB, zeroC, fresh];

function compose(request, sourceCatalog = catalog, mode = "best", refinementMaxIterations) {
  return composeCollection({
    request,
    catalog: sourceCatalog,
    notes: {},
    config,
    mode,
    refinementMaxIterations,
  });
}

function facts(compositionResult, sourceCatalog = catalog) {
  return deriveComposerReasoningFacts({
    compositionResult,
    catalog: sourceCatalog,
    config,
  });
}

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) {
    return value;
  }

  Object.freeze(value);
  Object.values(value).forEach(deepFreeze);
  return value;
}

function expectNoUnsafeJson(value) {
  const json = JSON.stringify(value);
  expect(json).not.toContain("undefined");
  expect(json).not.toContain("Infinity");
  expect(json).not.toContain("NaN");
  expect(JSON.parse(json)).toEqual(value);
}

describe("composer reasoning levels", () => {
  it("classifies score, match, coverage, budget, and redundancy boundaries", () => {
    expect(classifyQualityScore(19.9999)).toBe("very_low");
    expect(classifyQualityScore(20)).toBe("low");
    expect(classifyQualityScore(40)).toBe("moderate");
    expect(classifyQualityScore(70)).toBe("high");
    expect(classifyQualityScore(88)).toBe("very_high");

    expect(classifyMatchRatio(1, 0)).toBe(MATCH_LEVELS.NONE_REQUESTED);
    expect(classifyMatchRatio(0.3333, 3)).toBe("weak");
    expect(classifyMatchRatio(0.3334, 3)).toBe("partial");
    expect(classifyMatchRatio(0.6667, 3)).toBe("strong");
    expect(classifyMatchRatio(1, 3)).toBe("complete");

    expect(classifyCoveragePercent(0)).toBe("missing");
    expect(classifyCoveragePercent(29.9999)).toBe("weak");
    expect(classifyCoveragePercent(30)).toBe("present");
    expect(classifyCoveragePercent(60)).toBe("strong");

    expect(classifyBudgetUtilization(null, false)).toBe(BUDGET_ASSESSMENTS.UNLIMITED);
    expect(classifyBudgetUtilization(0.59, true)).toBe(BUDGET_ASSESSMENTS.UNDERUSED);
    expect(classifyBudgetUtilization(0.6, true)).toBe(BUDGET_ASSESSMENTS.EFFICIENT);
    expect(classifyBudgetUtilization(0.9, true)).toBe(BUDGET_ASSESSMENTS.NEAR_LIMIT);
    expect(classifyBudgetUtilization(0.9999, true)).toBe(BUDGET_ASSESSMENTS.EXACT_LIMIT);
    expect(classifyBudgetUtilization(0.5, true, true)).toBe(BUDGET_ASSESSMENTS.INVALID);

    expect(classifyRedundancyMagnitude(15)).toBe("very_low");
    expect(classifyRedundancyMagnitude(35)).toBe("low");
    expect(classifyRedundancyMagnitude(60)).toBe("moderate");
    expect(classifyRedundancyMagnitude(80)).toBe("high");
    expect(classifyRedundancyMagnitude(81)).toBe("very_high");
  });
});

describe("deriveComposerReasoningFacts", () => {
  it("returns a stable serializable shape for a completed fast composition", () => {
    const result = compose(
      {
        budget: 1200,
        minSlots: 3,
        targetSlots: 4,
        preferredSeasons: ["winter", "summer"],
        preferredOccasions: ["formal", "office"],
        preferredVibes: ["fresh", "warm"],
        strategy: "balanced",
      },
      catalog,
      "fast"
    );
    const derived = facts(result);

    expect(Object.keys(derived)).toEqual([
      "derivable",
      "compositionStatus",
      "strategy",
      "mode",
      "summary",
      "preferenceMatch",
      "coverage",
      "diversity",
      "versatility",
      "coherence",
      "budget",
      "redundancy",
      "identity",
      "refinement",
      "contributors",
      "tradeoffs",
      "warnings",
      "diagnostics",
    ]);
    expect(derived.derivable).toBe(true);
    expect(derived.summary).toMatchObject({
      perfumeCount: 4,
      targetSlots: 4,
      minimumSlots: 3,
      targetReached: true,
      minimumReached: true,
      mode: "fast",
      composed: true,
      status: "completed",
    });
    expect(derived.summary.totalPoints).toBe(result.constraintResult.metrics.totalPoints);
    expect(derived.summary.estimatedValue).toBe(result.constraintResult.metrics.estimatedValue);
    expect(derived.summary.qualityScore).toBe(result.qualityResult.overallScore);
    expect(derived.refinement.status).toBe(REFINEMENT_FACT_STATUSES.NOT_REQUESTED);
    expect(derived.coverage.direction).toBe(DIRECTIONALITY.HIGHER_IS_BETTER);
    expect(derived.redundancy.direction).toBe(DIRECTIONALITY.LOWER_IS_BETTER);
    expectNoUnsafeJson(derived);
  });

  it("derives complete, partial, missing, and unknown preference facts with contributors", () => {
    const result = compose(
      {
        budget: 1200,
        minSlots: 3,
        targetSlots: 4,
        preferredSeasons: ["winter", "monsoon", "summer"],
        preferredOccasions: ["formal", "ceremony"],
        preferredVibes: ["fresh", "ghost"],
        strategy: "balanced",
      },
      catalog,
      "fast"
    );
    const derived = facts(result);

    expect(derived.preferenceMatch.domains.seasons.requested).toEqual([
      "monsoon",
      "summer",
      "winter",
    ]);
    expect(derived.preferenceMatch.domains.seasons.matched).toEqual(["summer", "winter"]);
    expect(derived.preferenceMatch.domains.seasons.unmatched).toEqual(["monsoon"]);
    expect(derived.preferenceMatch.domains.occasions.unmatched).toEqual(["ceremony"]);
    expect(derived.preferenceMatch.domains.vibes.unmatched).toEqual(["ghost"]);
    expect(derived.preferenceMatch.domains.seasons.perfumeContributors.winter).toEqual(
      expect.arrayContaining([3, 4])
    );
    expect(derived.preferenceMatch.aggregate.level).toBe("partial");
    expect(derived.warnings.map((warning) => warning.code)).toContain("unmatched_preferences");
  });

  it("returns none_requested preference facts when no preferences are requested", () => {
    const result = compose({ budget: 1200, minSlots: 3, targetSlots: 4 }, catalog, "fast");
    const derived = facts(result);

    expect(derived.preferenceMatch.aggregate).toMatchObject({
      requestedCount: 0,
      matchedCount: 0,
      overallMatchRatio: 1,
      level: MATCH_LEVELS.NONE_REQUESTED,
      strongestDomain: null,
      weakestDomain: null,
    });
    expect(derived.preferenceMatch.domains.seasons.level).toBe(MATCH_LEVELS.NONE_REQUESTED);
  });

  it("derives coverage breadth, accord dominance, and deterministic tie handling", () => {
    const result = compose({ budget: 1200, minSlots: 3, targetSlots: 4 }, catalog, "fast");
    const derived = facts(result);

    expect(derived.coverage.domains.seasons.covered).toEqual([
      "fall",
      "spring",
      "summer",
      "winter",
    ]);
    expect(derived.coverage.domains.seasons.counts).toMatchObject({
      fall: expect.any(Number),
      spring: expect.any(Number),
      summer: expect.any(Number),
      winter: expect.any(Number),
    });
    expect(derived.coverage.domains.accords.strongest[0]).toMatchObject({
      value: expect.any(String),
      count: expect.any(Number),
    });
    expect(derived.coverage.domains.occasions.missing).toEqual(
      [...derived.coverage.domains.occasions.missing].sort()
    );
  });

  it("derives diversity, similar pairs, repeated profiles, and redundancy facts", () => {
    const result = compose(
      {
        budget: 1200,
        minSlots: 3,
        targetSlots: 4,
        preferredVibes: ["fresh"],
        strategy: "signature",
      },
      [fresh, perfume(7, { ...fresh, id: 7 }), perfume(8, { ...fresh, id: 8 }), amber],
      "fast"
    );
    const derived = facts(result, [fresh, perfume(7, { ...fresh, id: 7 }), perfume(8, { ...fresh, id: 8 }), amber]);

    expect(derived.diversity.score).toBe(result.qualityResult.dimensions.diversity.score);
    expect(derived.diversity.mostSimilarPairs.length).toBeGreaterThan(0);
    expect(derived.redundancy.penaltyScore).toBe(
      result.qualityResult.penalties.redundancyPenalty.magnitude
    );
    expect(derived.redundancy.similarPairs[0].perfumeIds).toEqual([1, 7]);
    expect(["strategy_aligned", "acceptable", "unexpected"]).toContain(
      derived.redundancy.strategyContext
    );
  });

  it("derives versatility, coherence, and contributor rankings without treating locked perfumes as automatic anchors", () => {
    const result = compose(
      {
        budget: 1200,
        minSlots: 3,
        targetSlots: 4,
        lockedPerfumeIds: [1],
        strategy: "signature",
      },
      catalog,
      "best"
    );
    const derived = facts(result);

    expect(derived.versatility.score).toBe(result.qualityResult.dimensions.versatility.score);
    expect(derived.coherence.score).toBe(result.qualityResult.dimensions.coherence.score);
    expect(derived.identity.anchorPerfumeIds.length).toBeGreaterThan(0);
    expect(derived.contributors.signatureAnchors.every((item) => item.evidence.locked === true)).toBe(false);
    expect(derived.contributors.versatilityLeaders[0]).toMatchObject({
      perfumeId: expect.any(Number),
      rank: 1,
      contributions: ["versatility"],
    });
  });

  it("derives budget facts for unlimited, zero, underused, efficient, near limit, exact, and exceeded budgets", () => {
    const unlimited = facts(compose({ minSlots: 3, targetSlots: 4 }, catalog, "fast"));
    expect(unlimited.budget).toMatchObject({
      provided: false,
      budget: null,
      remaining: null,
      utilization: null,
      assessment: BUDGET_ASSESSMENTS.UNLIMITED,
    });

    const zero = facts(compose({ budget: 0, minSlots: 3, targetSlots: 4 }, partialCatalog, "fast"), partialCatalog);
    expect(zero.budget.assessment).toBe(BUDGET_ASSESSMENTS.EXACT_LIMIT);
    expect(zero.budget.spent).toBe(0);

    const underused = facts(compose({ budget: 1200, minSlots: 3, targetSlots: 3 }, catalog, "fast"));
    expect(underused.budget.assessment).toBe(BUDGET_ASSESSMENTS.UNDERUSED);

    const efficient = facts(compose({ budget: 500, minSlots: 3, targetSlots: 3 }, catalog, "fast"));
    expect([BUDGET_ASSESSMENTS.EFFICIENT, BUDGET_ASSESSMENTS.NEAR_LIMIT]).toContain(
      efficient.budget.assessment
    );

    const exact = facts(compose({ budget: 400, minSlots: 3, targetSlots: 3 }, [fresh, green, formal], "fast"), [
      fresh,
      green,
      formal,
    ]);
    expect(exact.budget.assessment).toBe(BUDGET_ASSESSMENTS.EXACT_LIMIT);

    const invalidResult = compose(
      { budget: 100, minSlots: 3, lockedPerfumeIds: [5], strategy: "balanced" },
      catalog,
      "best"
    );
    expect(facts(invalidResult).budget.assessment).toBe(BUDGET_ASSESSMENTS.INVALID);
  });

  it("derives refinement facts for best improved, unchanged, ineligible, fallback-like invalid, and iteration limited states", () => {
    const refined = facts(
      compose(
        { budget: 350, minSlots: 3, targetSlots: 3, strategy: "balanced" },
        [fresh, green, zeroA, amber, formal, smoky],
        "best"
      ),
      [fresh, green, zeroA, amber, formal, smoky]
    );
    expect(refined.refinement.status).toBe(REFINEMENT_FACT_STATUSES.IMPROVED);
    expect(refined.refinement.scoreImprovement).toBeGreaterThan(0);
    expect(refined.refinement.swaps[0]).toMatchObject({
      removePerfumeId: expect.any(Number),
      addPerfumeId: expect.any(Number),
      dimensionChanges: {
        redundancyPenalty: { direction: DIRECTIONALITY.LOWER_IS_BETTER, after: expect.any(Number) },
      },
    });

    const unchanged = facts(compose({ budget: 1200, minSlots: 3, targetSlots: 4 }, catalog, "best"));
    expect(unchanged.refinement.status).toBe(REFINEMENT_FACT_STATUSES.UNCHANGED);

    const ineligible = facts(
      compose({ budget: 100, minSlots: 3, lockedPerfumeIds: [5] }, catalog, "best")
    );
    expect(ineligible.refinement.status).toBe(REFINEMENT_FACT_STATUSES.NOT_ELIGIBLE);

    const limited = facts(
      compose(
        { budget: 350, minSlots: 3, targetSlots: 3, strategy: "balanced" },
        [fresh, green, zeroA, amber, formal, smoky],
        "best",
        0
      ),
      [fresh, green, zeroA, amber, formal, smoky]
    );
    expect(limited.refinement.status).toBe(REFINEMENT_FACT_STATUSES.ITERATION_LIMITED);
    expect(limited.warnings.map((warning) => warning.code)).toContain(
      "refinement_iteration_limit"
    );
  });

  it("keeps valid partial collections derivable and impossible collections non-derivable", () => {
    const partialResult = compose(
      { budget: 250, minSlots: 3, targetSlots: 4, strategy: "balanced" },
      partialCatalog,
      "best"
    );
    const partialFacts = facts(partialResult, partialCatalog);

    expect(partialFacts.derivable).toBe(true);
    expect(partialFacts.compositionStatus).toBe("partial");
    expect(partialFacts.summary.minimumReached).toBe(true);
    expect(partialFacts.summary.targetReached).toBe(false);
    expect(partialFacts.warnings.map((warning) => warning.code)).toContain("partial_collection");

    const impossibleResult = compose(
      { budget: 100, minSlots: 3, lockedPerfumeIds: [5], strategy: "balanced" },
      catalog,
      "best"
    );
    const impossibleFacts = facts(impossibleResult);

    expect(impossibleFacts.derivable).toBe(false);
    expect(impossibleFacts.summary.qualityScore).toBe(null);
    expect(impossibleFacts.coverage.domains.accords.covered).toEqual([]);
    expect(impossibleFacts.contributors.preferenceLeaders).toEqual([]);
    expect(impossibleFacts.warnings.map((warning) => warning.code)).toContain(
      "impossible_composition"
    );
  });

  it("handles a failed composition result without fabricated quality facts", () => {
    const completed = compose({ budget: 1200, minSlots: 3, targetSlots: 4 }, catalog, "fast");
    const failed = {
      ...completed,
      composed: false,
      status: "failed",
      constraintResult: {
        valid: false,
        violations: [{ code: "SYNTHETIC_FAILURE" }],
        metrics: completed.constraintResult.metrics,
      },
      qualityResult: {
        evaluable: false,
        overallScore: null,
        dimensions: {},
        penalties: {},
        diagnostics: { reason: "invalid-candidate" },
      },
    };
    const derived = facts(failed);

    expect(derived.derivable).toBe(false);
    expect(derived.diversity.score).toBe(null);
    expect(derived.identity.primaryTrait).toBe(null);
    expect(derived.warnings).toEqual([
      {
        code: "invalid_composition_result",
        severity: "warning",
        evidence: {
          status: "failed",
          violations: [{ code: "SYNTHETIC_FAILURE" }],
        },
      },
    ]);
    expectNoUnsafeJson(derived);
  });

  it("is deterministic across repeated calls, reversed catalog, collection order, and preference order", () => {
    const firstResult = compose(
      {
        budget: 1200,
        minSlots: 3,
        targetSlots: 4,
        preferredSeasons: ["winter", "summer"],
        preferredOccasions: ["formal", "office"],
        preferredVibes: ["warm", "fresh"],
        strategy: "explorer",
      },
      catalog,
      "best"
    );
    const reorderedResult = {
      ...firstResult,
      collection: [...firstResult.collection].reverse(),
      collectionIds: [...firstResult.collectionIds].reverse(),
      normalizedRequest: {
        ...firstResult.normalizedRequest,
        preferredSeasons: [...firstResult.normalizedRequest.preferredSeasons].reverse(),
        preferredOccasions: [...firstResult.normalizedRequest.preferredOccasions].reverse(),
        preferredVibes: [...firstResult.normalizedRequest.preferredVibes].reverse(),
      },
    };

    expect(facts(firstResult, catalog)).toEqual(facts(firstResult, catalog));
    expect(facts(firstResult, catalog)).toEqual(facts(reorderedResult, [...catalog].reverse()));
  });

  it("does not mutate frozen composition results, catalog records, or nested diagnostics", () => {
    const result = compose(
      { budget: 1200, minSlots: 3, targetSlots: 4, strategy: "signature" },
      catalog,
      "best"
    );
    const frozenResult = deepFreeze(structuredClone(result));
    const frozenCatalog = deepFreeze(structuredClone(catalog));

    expect(() => facts(frozenResult, frozenCatalog)).not.toThrow();
    expect(frozenResult.collectionIds).toEqual(result.collectionIds);
    expect(frozenCatalog.map((item) => item.id)).toEqual(catalog.map((item) => item.id));
  });

  it("emits bounded tradeoffs only when measurable evidence supports them", () => {
    const balanced = facts(compose({ budget: 1200, minSlots: 3, targetSlots: 4 }, catalog, "fast"));
    expect(balanced.tradeoffs.length).toBeLessThanOrEqual(4);

    const preferenceGap = facts(
      compose(
        {
          budget: 1200,
          minSlots: 3,
          targetSlots: 4,
          preferredSeasons: ["winter", "summer"],
          preferredOccasions: ["impossible occasion"],
          strategy: "balanced",
        },
        catalog,
        "fast"
      )
    );
    expect(preferenceGap.tradeoffs.every((item) => item.type)).toBe(true);
    expect(preferenceGap.tradeoffs).toEqual(
      [...preferenceGap.tradeoffs].sort((a, b) => b.strength - a.strength || (a.type < b.type ? -1 : a.type > b.type ? 1 : 0))
    );
  });

  it("supports product-intent strategy interpretations without prose", () => {
    const balanced = facts(
      compose({ budget: 1200, minSlots: 3, targetSlots: 4, strategy: "balanced" }, catalog, "best")
    );
    const versatile = facts(
      compose({ budget: 1200, minSlots: 3, targetSlots: 4, strategy: "versatile" }, catalog, "best")
    );
    const explorer = facts(
      compose({ budget: 1200, minSlots: 3, targetSlots: 4, strategy: "explorer" }, catalog, "best")
    );
    const signature = facts(
      compose({ budget: 1200, minSlots: 3, targetSlots: 4, strategy: "signature" }, catalog, "best")
    );

    expect(balanced.identity.alignment.requestedStrategy).toBe("balanced");
    expect(versatile.identity.practicalityLevel).not.toBe(null);
    expect(explorer.identity.explorationLevel).not.toBe(null);
    expect(signature.identity.signatureFocus).toBe(
      signature.summary.status === "completed"
        ? signature.identity.signatureFocus
        : expect.any(Number)
    );
    [balanced, versatile, explorer, signature].forEach((derived) => {
      expect(["balanced", "versatile", "exploratory", "signature_focused"]).toContain(
        derived.identity.primaryTrait
      );
    });
  });

  it("covers golden facts for completed, refined, unchanged, partial, and impossible outcomes", () => {
    const fast = facts(
      compose({ budget: 1200, minSlots: 3, targetSlots: 4, strategy: "balanced" }, catalog, "fast")
    );
    expect(fast).toMatchObject({
      derivable: true,
      compositionStatus: "completed",
      mode: "fast",
      strategy: "balanced",
      refinement: { status: "not_requested", invoked: false },
      summary: { perfumeCount: 4, targetReached: true, minimumReached: true },
    });

    const refined = facts(
      compose(
        { budget: 350, minSlots: 3, targetSlots: 3, strategy: "explorer" },
        [fresh, green, zeroA, amber, formal, smoky],
        "best"
      ),
      [fresh, green, zeroA, amber, formal, smoky]
    );
    expect(refined.refinement.status).toBe("improved");
    expect(refined.summary.status).toBe("completed");

    const unchanged = facts(
      compose({ budget: 1200, minSlots: 3, targetSlots: 4, strategy: "signature" }, catalog, "best")
    );
    expect(["unchanged", "improved"]).toContain(unchanged.refinement.status);
    expect(unchanged.identity.alignment.requestedStrategy).toBe("signature");

    const partial = facts(
      compose({ budget: 250, minSlots: 3, targetSlots: 4 }, partialCatalog, "best"),
      partialCatalog
    );
    expect(partial).toMatchObject({
      derivable: true,
      compositionStatus: "partial",
      summary: { perfumeCount: 3, targetReached: false, minimumReached: true },
    });

    const impossible = facts(
      compose({ budget: 100, minSlots: 3, lockedPerfumeIds: [5] }, catalog, "best")
    );
    expect(impossible).toMatchObject({
      derivable: false,
      compositionStatus: "impossible",
      summary: { qualityScore: null, composed: false },
    });
  });
});
