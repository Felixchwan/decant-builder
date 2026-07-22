import { describe, expect, it } from "vitest";
import { createBuilderConfig } from "../../config/createBuilderConfig.js";
import { composeCollection } from "./composeCollection.js";
import { deriveComposerExplanations } from "./deriveComposerExplanations.js";
import { deriveComposerReasoningFacts } from "./deriveComposerReasoningFacts.js";

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

function explain(compositionResult, sourceCatalog = catalog) {
  return deriveComposerExplanations({
    reasoningFacts: facts(compositionResult, sourceCatalog),
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

function expectSerializable(value) {
  const json = JSON.stringify(value);
  expect(json).not.toContain("undefined");
  expect(json).not.toContain("Infinity");
  expect(json).not.toContain("NaN");
  expect(JSON.parse(json)).toEqual(value);
}

function getCodes(items) {
  return items.map((item) => item.code);
}

function expectNoLocalizedStrings(value) {
  const strings = [];
  collectStrings(value, strings);

  strings.forEach((entry) => {
    expect(entry).not.toMatch(/[.!?]/);
    expect(entry).not.toMatch(/\s{1,}/);
  });
}

function collectStrings(value, strings) {
  if (typeof value === "string") {
    strings.push(value);
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((item) => collectStrings(item, strings));
    return;
  }

  if (value && typeof value === "object") {
    Object.values(value).forEach((item) => collectStrings(item, strings));
  }
}

describe("deriveComposerExplanations", () => {
  it("returns the exact top-level object contract with object-based items only", () => {
    const result = compose(
      {
        budget: 1200,
        minSlots: 3,
        targetSlots: 4,
        preferredSeasons: ["summer", "winter"],
        preferredOccasions: ["office", "formal"],
        preferredVibes: ["fresh", "warm"],
        strategy: "balanced",
      },
      catalog,
      "fast"
    );
    const explanation = explain(result);

    expect(Object.keys(explanation)).toEqual([
      "explainable",
      "headline",
      "strengths",
      "weaknesses",
      "tradeoffs",
      "recommendations",
      "highlights",
      "diagnostics",
    ]);
    expect(explanation.explainable).toBe(true);
    expect(explanation.headline).toMatchObject({
      code: "collection_completed",
      severity: "positive",
      evidence: {
        perfumeCount: 4,
        targetSlots: 4,
      },
    });
    [...explanation.strengths, ...explanation.weaknesses, ...explanation.tradeoffs].forEach(
      (item) => {
        expect(Object.keys(item)).toEqual(["code", "severity", "evidence"]);
      }
    );
    explanation.recommendations.forEach((item) => {
      expect(Object.keys(item)).toEqual(["code", "priority", "evidence"]);
    });
    explanation.highlights.forEach((item) => {
      expect(Object.keys(item)).toEqual(["perfumeId", "reason", "rank", "evidence"]);
    });
    expectNoLocalizedStrings(explanation);
    expectSerializable(explanation);
  });

  it("derives preference and identity strengths from reasoning facts", () => {
    const result = compose(
      {
        budget: 1200,
        minSlots: 3,
        targetSlots: 4,
        preferredSeasons: ["summer", "winter"],
        preferredOccasions: ["office", "formal"],
        preferredVibes: ["fresh", "warm"],
        strategy: "balanced",
      },
      catalog,
      "fast"
    );
    const explanation = explain(result);

    expect(getCodes(explanation.strengths)).toContain("excellent_preference_match");
    expect(getCodes(explanation.strengths)).toContain("explorer_diversity");
    expect(
      explanation.strengths.find((item) => item.code === "excellent_preference_match").evidence
        .matchRatio
    ).toBe(1);
  });

  it("derives partial preference match and unsupported request recommendations", () => {
    const result = compose(
      {
        budget: 1200,
        minSlots: 3,
        targetSlots: 4,
        preferredSeasons: ["winter", "monsoon"],
        preferredOccasions: ["ceremony"],
        preferredVibes: ["fresh", "ghost"],
        strategy: "balanced",
      },
      catalog,
      "fast"
    );
    const explanation = explain(result);

    expect(getCodes(explanation.weaknesses)).toContain("partial_preference_match");
    expect(getCodes(explanation.weaknesses)).toContain("unmatched_preferences");
    expect(getCodes(explanation.recommendations)).toContain("support_requested_preferences");
    expect(
      explanation.recommendations.find((item) => item.code === "support_requested_preferences")
        .evidence.unmatched
    ).toEqual([
      { domain: "occasions", preference: "ceremony" },
      { domain: "seasons", preference: "monsoon" },
      { domain: "vibes", preference: "ghost" },
    ]);
  });

  it("derives season, occasion, and vibe gap explanations and recommendations from coverage facts", () => {
    const result = compose(
      { budget: 300, minSlots: 3, targetSlots: 3, strategy: "balanced" },
      [fresh, green, zeroA],
      "fast"
    );
    const explanation = explain(result, [fresh, green, zeroA, amber, formal, smoky]);

    expect(getCodes(explanation.weaknesses)).toContain("season_gap");
    expect(getCodes(explanation.weaknesses)).toContain("occasion_gap");
    expect(getCodes(explanation.weaknesses)).toContain("vibe_gap");
    expect(getCodes(explanation.recommendations)).toContain("expand_winter_coverage");
    expect(getCodes(explanation.recommendations)).toContain("expand_occasion_coverage");
    expect(
      explanation.recommendations.find((item) => item.code === "expand_winter_coverage")
    ).toMatchObject({
      priority: "medium",
      evidence: {
        missingSeason: "winter",
        domain: "seasons",
      },
    });
  });

  it("derives budget efficiency and low-budget-utilization objects without implying unsupported actions", () => {
    const efficient = explain(
      compose({ budget: 400, minSlots: 3, targetSlots: 3, strategy: "balanced" }, [fresh, green, formal], "fast"),
      [fresh, green, formal]
    );
    expect(getCodes(efficient.strengths)).toContain("excellent_budget_efficiency");
    expect(efficient.recommendations.map((item) => item.code)).not.toContain(
      "spend_remaining_budget"
    );

    const underused = explain(
      compose({ budget: 1200, minSlots: 3, targetSlots: 3, strategy: "balanced" }, catalog, "fast")
    );
    expect(getCodes(underused.weaknesses)).toContain("low_budget_utilization");
    expect(underused.recommendations.map((item) => item.code)).not.toContain(
      "spend_remaining_budget"
    );
  });

  it("derives high redundancy and signature-aligned identity without changing scoring", () => {
    const repeatFreshA = perfume(7, { ...fresh, id: 7 });
    const repeatFreshB = perfume(8, { ...fresh, id: 8 });
    const sourceCatalog = [fresh, repeatFreshA, repeatFreshB, amber];
    const result = compose(
      {
        budget: 1200,
        minSlots: 3,
        targetSlots: 4,
        preferredVibes: ["fresh"],
        strategy: "signature",
      },
      sourceCatalog,
      "fast"
    );
    const explanation = explain(result, sourceCatalog);

    expect(getCodes(explanation.strengths)).toContain("signature_aligned");
    if (getCodes(explanation.weaknesses).includes("high_redundancy")) {
      expect(explanation.weaknesses.find((item) => item.code === "high_redundancy").evidence)
        .toHaveProperty("penaltyScore");
    }
    explanation.highlights
      .filter((item) => item.reason === "redundancy_driver")
      .forEach((item) => {
        expect(item.evidence).toHaveProperty("similarityCount");
      });
  });

  it("derives refinement improved and no-change explanations from refinement facts", () => {
    const refined = explain(
      compose(
        { budget: 350, minSlots: 3, targetSlots: 3, strategy: "balanced" },
        [fresh, green, zeroA, amber, formal, smoky],
        "best"
      ),
      [fresh, green, zeroA, amber, formal, smoky]
    );
    expect(getCodes(refined.strengths)).toContain("refinement_improved_quality");
    expect(refined.strengths.find((item) => item.code === "refinement_improved_quality").evidence)
      .toMatchObject({
        appliedSwapCount: expect.any(Number),
        scoreImprovement: expect.any(Number),
      });

    const unchanged = explain(
      compose({ budget: 1200, minSlots: 3, targetSlots: 4, strategy: "balanced" }, catalog, "best")
    );
    expect(getCodes(unchanged.strengths)).toContain("refinement_no_change");
  });

  it("keeps valid partial and impossible requests distinguishable", () => {
    const partial = explain(
      compose({ budget: 250, minSlots: 3, targetSlots: 4, strategy: "balanced" }, partialCatalog, "best"),
      partialCatalog
    );
    expect(partial.headline.code).toBe("valid_partial_collection");
    expect(getCodes(partial.weaknesses)).toContain("valid_partial_collection");
    expect(getCodes(partial.recommendations)).toContain("fill_remaining_slots");

    const impossible = explain(
      compose({ budget: 100, minSlots: 3, lockedPerfumeIds: [5], strategy: "balanced" }, catalog, "best")
    );
    expect(impossible.explainable).toBe(true);
    expect(impossible.headline.code).toBe("impossible_request");
    expect(impossible.strengths).toEqual([]);
    expect(impossible.highlights).toEqual([]);
    expect(getCodes(impossible.weaknesses)).toContain("impossible_request");
    expect(getCodes(impossible.recommendations)).toContain("relax_request_constraints");
  });

  it("handles invalid reasoning facts with stable null-safe output", () => {
    const explanation = deriveComposerExplanations({ reasoningFacts: null });

    expect(explanation).toMatchObject({
      explainable: false,
      headline: {
        code: "invalid_reasoning_facts",
        severity: "warning",
        evidence: {},
      },
      strengths: [],
      weaknesses: [],
      tradeoffs: [],
      recommendations: [],
      highlights: [],
    });
    expectSerializable(explanation);
  });

  it("is deterministic across repeated calls and source ordering", () => {
    const result = compose(
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
    const firstFacts = facts(result, catalog);
    const reorderedFacts = {
      ...firstFacts,
      highlights: [...firstFacts.highlights || []].reverse(),
    };

    expect(deriveComposerExplanations({ reasoningFacts: firstFacts })).toEqual(
      deriveComposerExplanations({ reasoningFacts: firstFacts })
    );
    expect(deriveComposerExplanations({ reasoningFacts: firstFacts })).toEqual(
      deriveComposerExplanations({ reasoningFacts: reorderedFacts })
    );
  });

  it("does not mutate frozen reasoning facts", () => {
    const result = compose(
      { budget: 1200, minSlots: 3, targetSlots: 4, strategy: "signature" },
      catalog,
      "best"
    );
    const sourceFacts = facts(result);
    const frozenFacts = deepFreeze(structuredClone(sourceFacts));

    expect(() => deriveComposerExplanations({ reasoningFacts: frozenFacts })).not.toThrow();
    expect(frozenFacts).toEqual(sourceFacts);
  });

  it("emits golden object codes for completed, refined, partial, and impossible cases", () => {
    const completed = explain(
      compose(
        {
          budget: 1200,
          minSlots: 3,
          targetSlots: 4,
          preferredSeasons: ["winter", "summer"],
          strategy: "balanced",
        },
        catalog,
        "fast"
      )
    );
    expect(completed).toMatchObject({
      explainable: true,
      headline: { code: "collection_completed" },
      diagnostics: { sourceCompositionStatus: "completed", sourceMode: "fast" },
    });

    const refined = explain(
      compose(
        { budget: 350, minSlots: 3, targetSlots: 3, strategy: "explorer" },
        [fresh, green, zeroA, amber, formal, smoky],
        "best"
      ),
      [fresh, green, zeroA, amber, formal, smoky]
    );
    expect(getCodes(refined.strengths)).toContain("refinement_improved_quality");

    const partial = explain(
      compose({ budget: 250, minSlots: 3, targetSlots: 4 }, partialCatalog, "best"),
      partialCatalog
    );
    expect(partial).toMatchObject({
      headline: { code: "valid_partial_collection" },
      diagnostics: { sourceCompositionStatus: "partial" },
    });

    const impossible = explain(
      compose({ budget: 100, minSlots: 3, lockedPerfumeIds: [5] }, catalog, "best")
    );
    expect(impossible).toMatchObject({
      headline: { code: "impossible_request" },
      diagnostics: { sourceCompositionStatus: "impossible" },
    });
  });
});
