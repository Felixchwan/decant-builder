import { describe, expect, it } from "vitest";
import {
  getRecommendationConfidence,
  getRecommendationConfidenceLabel,
  getRecommendationDisplayReasons,
  getRecommendationExplanationLabel,
} from "./recommendationExplanationLabels.js";
import { createTranslator } from "../../i18n/createTranslator.js";
import { fragrances as perfumes } from "@discovery-box/catalog";
import { enUS } from "../../i18n/locales/en-US.js";
import { esMX } from "../../i18n/locales/es-MX.js";

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

  it("resolves the Composer preference regression values in en-US", () => {
    const translator = createTranslator("en-US");

    expect(getRequestedPreferenceLabel("vibes", "classic", translator)).toBe(
      "Adds classic polish"
    );
    expect(getRequestedPreferenceLabel("vibes", "bright", translator)).toBe(
      "Adds bright energy"
    );
    expect(getRequestedPreferenceLabel("occasions", "gym", translator)).toBe(
      "Adds gym-friendly freshness"
    );
  });

  it("resolves the Composer preference regression values in es-MX", () => {
    const translator = createTranslator("es-MX");

    expect(getRequestedPreferenceLabel("vibes", "classic", translator)).toBe(
      "Agrega pulido clásico"
    );
    expect(getRequestedPreferenceLabel("vibes", "bright", translator)).toBe(
      "Agrega energía luminosa"
    );
    expect(getRequestedPreferenceLabel("occasions", "gym", translator)).toBe(
      "Agrega frescura para gimnasio"
    );
  });

  it("keeps canonical preference values separate from display copy", () => {
    const canonicalValues = ["classic", "bright", "gym"];

    expect(canonicalValues).toEqual(["classic", "bright", "gym"]);
    expect(createTranslator("es-MX").label("vibes", "classic")).toBe("Clásico");
    expect(createTranslator("es-MX").label("occasions", "gym")).toBe("Gimnasio");
  });

  it("falls back to readable copy for unknown dynamic recommendation values", () => {
    const translator = createTranslator("en-US");
    const label = getRequestedPreferenceLabel("vibes", "future-mood", translator);

    expect(label).toBe("Adds Future Mood character");
    expect(label).not.toMatch(/recommendation\.|composer\.|filters\.|taxonomy\./);
  });

  it("covers all current catalog recommendation taxonomy values in both dictionaries", () => {
    const missingKeys = getMissingRecommendationTaxonomyKeys();

    expect(missingKeys).toEqual([]);
    expect(getMissingTaxonomyKeys()).toEqual([]);
  });
});

function getRequestedPreferenceLabel(domain, preference, translator) {
  return getRecommendationExplanationLabel(
    {
      code: "support_requested_preferences",
      severity: "positive",
      evidence: {
        unmatched: [{ domain, preference }],
      },
    },
    translator
  );
}

function getMissingRecommendationTaxonomyKeys() {
  const dictionaries = [
    ["en-US", enUS],
    ["es-MX", esMX],
  ];
  const categoryMap = {
    seasons: "season",
    occasions: "occasion",
    vibes: "vibe",
    accords: "accord",
  };

  return Object.entries(categoryMap).flatMap(([perfumeField, recommendationCategory]) => {
    const values = [...new Set(perfumes.flatMap((perfume) => perfume[perfumeField] || []))];

    return values.flatMap((value) => {
      const key = `recommendation.${recommendationCategory}.${toRecommendationKey(value)}`;
      return dictionaries
        .filter(([, dictionary]) => !Object.hasOwn(dictionary, key))
        .map(([locale]) => `${locale}:${key}`);
    });
  });
}

function toRecommendationKey(value) {
  return String(value).replace(/\s+/g, "_");
}

function getMissingTaxonomyKeys() {
  const dictionaries = [
    ["en-US", enUS],
    ["es-MX", esMX],
  ];

  return ["seasons", "occasions", "vibes"].flatMap((perfumeField) => {
    const values = [...new Set(perfumes.flatMap((perfume) => perfume[perfumeField] || []))];

    return values.flatMap((value) => {
      const key = `taxonomy.${value}`;
      return dictionaries
        .filter(([, dictionary]) => !Object.hasOwn(dictionary, key))
        .map(([locale]) => `${locale}:${key}`);
    });
  });
}
