import { describe, expect, it } from "vitest";
import {
  getRecommendationConfidence,
  getRecommendationConfidenceLabel,
  getRecommendationDisplayReasons,
  getRecommendationExplanationLabel,
} from "./recommendationExplanationLabels.js";
import { createTranslator } from "../../i18n/createTranslator.js";

const winterPerfume = {
  id: 10,
  name: "Winter Test",
  brand: "Test House",
  points: 1,
  seasons: ["fall", "winter"],
  occasions: ["date", "night"],
  vibes: ["warm", "dark"],
  accords: ["woody", "amber"],
  seasonWeights: { spring: 0, summer: 0, fall: 8, winter: 10 },
};

describe("recommendationExplanationLabels", () => {
  it("maps Composer explanation objects to stable display labels", () => {
    expect(
      getRecommendationExplanationLabel({
        code: "expand_winter_coverage",
        severity: "positive",
        evidence: { missingSeason: "winter" },
      })
    ).toBe("Strengthens cold-weather coverage");
    expect(
      getRecommendationExplanationLabel({
        code: "expand_occasion_coverage",
        severity: "positive",
        evidence: { missingOccasion: "formal" },
      })
    ).toBe("Strengthens formal versatility");
    expect(
      getRecommendationExplanationLabel({
        code: "composer_balance_pick",
        severity: "positive",
        evidence: {},
      })
    ).toBe("Improves collection balance");
  });

  it("returns compact non-duplicated labels from structured Composer explanations", () => {
    const reasons = getRecommendationDisplayReasons({
      recommendation: {
        perfume: winterPerfume,
        finalScore: 82,
        explanations: [
          {
            code: "expand_winter_coverage",
            severity: "positive",
            evidence: { missingSeason: "winter" },
          },
          {
            code: "coverage_anchor",
            severity: "positive",
            evidence: {},
          },
          {
            code: "composer_balance_pick",
            severity: "positive",
            evidence: {},
          },
          {
            code: "composer_affinity_pick",
            severity: "positive",
            evidence: {},
          },
        ],
        scoreBreakdown: {
          seasons: 12,
          occasions: 0,
          vibes: 0,
          accordDiversity: 0,
          noteDiversity: 0,
        },
      },
    });

    expect(reasons).toEqual([
      "Improves multiple coverage gaps",
      "Improves collection balance",
      "Complements your current scent direction",
    ]);
  });

  it("keeps legacy reason fallback display-only and filters low-value filler", () => {
    const reasons = getRecommendationDisplayReasons({
      recommendation: {
        perfume: winterPerfume,
        reasons: [
          "Fits your current box tier",
          "Adds Winter Coverage",
          "Adds woody depth currently missing",
        ],
        explanations: [],
        scoreBreakdown: {},
      },
    });

    expect(reasons).toEqual([
      "Adds Winter Coverage",
      "Introduces woody depth",
    ]);
  });

  it("assigns confidence labels from existing scores without changing thresholds", () => {
    expect(getRecommendationConfidence({ finalScore: 90 })).toBe("High");
    expect(getRecommendationConfidence({ finalScore: 60 })).toBe("Medium");
    expect(getRecommendationConfidence({ finalScore: 30 })).toBe("Situational");
  });

  it("localizes recommendation explanations without changing confidence thresholds", () => {
    const translator = createTranslator("es-MX");

    expect(
      getRecommendationExplanationLabel(
        {
          code: "expand_winter_coverage",
          severity: "positive",
          evidence: { missingSeason: "winter" },
        },
        translator
      )
    ).toBe("Fortalece la cobertura para clima frío");
    expect(getRecommendationConfidenceLabel({ finalScore: 90 }, translator)).toBe("Alta");
  });
});
