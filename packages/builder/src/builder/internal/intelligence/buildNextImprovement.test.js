import { describe, expect, it } from "vitest";

import {
  buildNextImprovementResult,
  getObjectiveCompatibilityScore,
} from "./buildNextImprovement.js";

function perfume(overrides = {}) {
  return {
    id: 1,
    name: "Test Perfume",
    shortName: "Test",
    accords: [],
    vibes: [],
    occasions: [],
    seasons: [],
    ...overrides,
  };
}

function recommendation(perfumeOverrides = {}, overrides = {}) {
  return {
    perfume: perfume(perfumeOverrides),
    score: 80,
    finalScore: 80,
    reasons: ["Existing reason"],
    ...overrides,
  };
}

function intelligence(overrides = {}) {
  return {
    mainGap: {
      type: "contrast",
      label: "Missing a clear contrast profile",
    },
    bestNextMove: "Add a clear contrast fragrance",
    dominantProfile: "Balanced and versatile",
    strongestCoverage: "strong daily versatility",
    items: [],
    ...overrides,
  };
}

function buildResult(overrides = {}) {
  return buildNextImprovementResult({
    intelligence: intelligence(),
    selectedPerfumes: [],
    balanceRecommendations: [],
    selectedCount: 0,
    isBoxFull: false,
    ...overrides,
  });
}

function deepFreeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    Object.values(value).forEach(deepFreeze);
  }

  return value;
}

const freshRecommendation = recommendation(
  {
    id: 11,
    name: "Fresh Anchor",
    shortName: "Fresh Anchor",
    accords: ["citrus", "fresh", "green"],
    vibes: ["fresh", "clean", "bright"],
    occasions: ["daily", "office", "casual"],
    seasons: ["spring", "summer"],
  },
  { score: 88, finalScore: 91 }
);

const coldWeatherRecommendation = recommendation(
  {
    id: 12,
    name: "Amber Winter",
    shortName: "Amber Winter",
    accords: ["warm spicy", "amber", "vanilla"],
    vibes: ["warm", "cozy", "dark"],
    occasions: ["date", "night", "evening"],
    seasons: ["fall", "winter"],
  },
  { score: 90, finalScore: 94 }
);

const formalRecommendation = recommendation(
  {
    id: 13,
    name: "Formal Cedar",
    shortName: "Formal Cedar",
    accords: ["woody", "iris", "powdery"],
    vibes: ["elegant", "sophisticated", "classic"],
    occasions: ["formal", "office", "special"],
    seasons: ["spring", "fall"],
  },
  { score: 86, finalScore: 89 }
);

const eveningRecommendation = recommendation(
  {
    id: 14,
    name: "Club Amber",
    shortName: "Club Amber",
    accords: ["sweet"],
    vibes: ["intense"],
    occasions: ["club", "special"],
    seasons: [],
  },
  { score: 84, finalScore: 86 }
);

const contrastRecommendation = recommendation(
  {
    id: 15,
    name: "Artistic Contrast",
    shortName: "Artistic Contrast",
    accords: [],
    vibes: ["unique", "artistic"],
    occasions: ["special"],
    seasons: ["spring", "winter"],
  },
  { score: 82, finalScore: 83 }
);

describe("buildNextImprovement", () => {
  describe("getObjectiveCompatibilityScore", () => {
    it("scores each objective from weighted signal groups and limits reasons to three", () => {
      expect(getObjectiveCompatibilityScore("freshDaytime", freshRecommendation.perfume)).toEqual({
        score: 10,
        normalizedScore: 1,
        reasons: [
          "Adds fresh daytime contrast",
          "Broadens daily rotation",
          "Improves warm-weather versatility",
        ],
      });
      expect(getObjectiveCompatibilityScore("coldWeather", coldWeatherRecommendation.perfume)).toEqual({
        score: 10,
        normalizedScore: 1,
        reasons: [
          "Adds warm evening depth",
          "Adds evening range",
          "Strengthens cold-weather coverage",
        ],
      });
      expect(getObjectiveCompatibilityScore("formal", formalRecommendation.perfume)).toEqual({
        score: 10,
        normalizedScore: 1,
        reasons: [
          "Adds polished formal range",
          "Improves dressed-up versatility",
          "Broadens formal-season range",
        ],
      });
      expect(getObjectiveCompatibilityScore("evening", eveningRecommendation.perfume)).toEqual({
        score: 7,
        normalizedScore: 0.7128000000000001,
        reasons: ["Adds a stronger after-dark profile", "Adds evening range"],
      });
      expect(getObjectiveCompatibilityScore("contrast", contrastRecommendation.perfume)).toEqual({
        score: 6,
        normalizedScore: 0.5769333333333334,
        reasons: ["Adds a distinct scent direction", "Expands wearable range", "Broadens seasonal range"],
      });
    });

    it("uses contrast as the fallback objective and treats missing or malformed perfume fields as no match", () => {
      expect(getObjectiveCompatibilityScore("unknown", contrastRecommendation.perfume)).toEqual(
        getObjectiveCompatibilityScore("contrast", contrastRecommendation.perfume)
      );
      expect(getObjectiveCompatibilityScore("freshDaytime", undefined)).toEqual({
        score: 0,
        normalizedScore: 0,
        reasons: [],
      });
      expect(
        getObjectiveCompatibilityScore(
          "freshDaytime",
          perfume({
            accords: "citrus",
            vibes: null,
            occasions: undefined,
            seasons: ["spring"],
          })
        )
      ).toEqual({
        score: 1,
        normalizedScore: 0.129,
        reasons: ["Improves warm-weather versatility"],
      });
    });
  });

  describe("empty and fallback states", () => {
    it("returns null for an empty collection without recommendations", () => {
      expect(buildResult()).toBeNull();
      expect(buildNextImprovementResult({
        selectedCount: 0,
        selectedPerfumes: [],
        balanceRecommendations: [],
      })).toBeNull();
    });

    it("builds starter guidance when recommendations exist for an empty collection", () => {
      expect(
        buildResult({
          balanceRecommendations: [contrastRecommendation],
        })
      ).toEqual({
        objectiveKey: "contrast",
        objectiveUrgency: 110,
        title: "Start with a versatile anchor",
        titleCode: "starterAnchor",
        description:
          "Choose a first fragrance that gives the box a clear center. The recommendation below is a strong opening pick.",
        descriptionCode: "starter",
        descriptionParams: undefined,
        eyebrow: "STARTER DIRECTION",
        eyebrowCode: "starterDirection",
        recommendations: [
          {
            ...contrastRecommendation,
            objectiveKey: "contrast",
            objectiveCompatibilityScore: 6,
            objectiveReasons: [
              "Adds a distinct scent direction",
              "Expands wearable range",
              "Broadens seasonal range",
            ],
          },
        ],
        primaryRecommendation: {
          ...contrastRecommendation,
          objectiveKey: "contrast",
          objectiveCompatibilityScore: 6,
          objectiveReasons: [
            "Adds a distinct scent direction",
            "Expands wearable range",
            "Broadens seasonal range",
          ],
        },
      });
    });

    it("returns guidance without recommendations when no candidate reaches compatibility threshold", () => {
      const result = buildResult({
        intelligence: intelligence({
          mainGap: { type: "winter", label: "Limited winter depth" },
          bestNextMove: "Add one warm evening fragrance",
          dominantProfile: "Fresh-heavy",
          strongestCoverage: "strong summer coverage",
        }),
        selectedPerfumes: [
          perfume({
            id: 21,
            accords: ["citrus"],
            vibes: ["fresh"],
            occasions: ["daily"],
            seasons: ["summer"],
          }),
        ],
        selectedCount: 1,
        balanceRecommendations: [
          recommendation(
            {
              id: 22,
              name: "Weak Citrus",
              shortName: "Weak Citrus",
              accords: ["citrus"],
            },
            { score: 100, finalScore: 100 }
          ),
        ],
      });

      expect(result).toEqual({
        objectiveKey: "coldWeather",
        objectiveUrgency: 90,
        title: "Add warm evening fragrance",
        titleCode: undefined,
        description:
          "Your box is beginning to lean fresh-heavy. A warmer evening addition would add depth and improve cold-weather range. The next recommendation is chosen to answer that opportunity.",
        descriptionCode: "objective",
        descriptionParams: {
          profile: "Fresh-heavy",
          coverage: "strong summer coverage",
          profilePhraseCode: "earlyLeaning",
          objectiveKey: "coldWeather",
          recommendationName: null,
        },
        eyebrow: "EARLY OPPORTUNITY",
        eyebrowCode: "earlyOpportunity",
        recommendations: [],
        primaryRecommendation: undefined,
      });
    });

    it("uses box-full guidance while preserving the best compatible recommendation", () => {
      const result = buildResult({
        intelligence: intelligence({
          mainGap: { type: "formal", label: "Weak formal coverage" },
          bestNextMove: "Add a formal woody option",
          dominantProfile: "Woody and sophisticated",
          strongestCoverage: "strong date-night profile",
        }),
        selectedPerfumes: [
          perfume({ id: 31, accords: ["citrus"], seasons: ["summer"] }),
          perfume({ id: 32, accords: ["amber"], seasons: ["winter"] }),
          perfume({ id: 33, accords: ["marine"], seasons: ["spring"] }),
        ],
        selectedCount: 3,
        isBoxFull: true,
        balanceRecommendations: [formalRecommendation],
      });

      expect(result).toMatchObject({
        objectiveKey: "formal",
        title: "Box complete",
        description:
          "Your Discovery Box is full. Use the recommendation below only as a comparison point for future swaps.",
        eyebrow: "NEXT IMPROVEMENT",
      });
      expect(result.primaryRecommendation).toMatchObject({
        perfume: formalRecommendation.perfume,
        objectiveKey: "formal",
        objectiveCompatibilityScore: 10,
      });
    });
  });

  describe("recommendation categories and guidance copy", () => {
    it.each([
      {
        label: "cold weather",
        expectedObjective: "coldWeather",
        intelligenceInput: {
          mainGap: { type: "winter", label: "Limited winter depth" },
          bestNextMove: "Add one warm evening fragrance",
          dominantProfile: "Fresh-heavy",
          strongestCoverage: "strong summer coverage",
        },
        recommendationInput: coldWeatherRecommendation,
        expectedTitle: "Add warm evening fragrance",
        expectedDescription:
          "Your box is currently strongest as fresh-heavy. A warmer evening addition would add depth and improve cold-weather range. Amber Winter is the pick that best answers that opportunity.",
      },
      {
        label: "formal",
        expectedObjective: "formal",
        intelligenceInput: {
          mainGap: { type: "formal", label: "Weak formal coverage" },
          bestNextMove: "Add a formal woody option",
          dominantProfile: "Woody and sophisticated",
          strongestCoverage: "strong date-night profile",
        },
        recommendationInput: formalRecommendation,
        expectedTitle: "Add formal woody option",
        expectedDescription:
          "Your box is currently strongest as woody and sophisticated. A polished formal fragrance would make the box more useful for dressed-up occasions. Formal Cedar is the pick that best answers that opportunity.",
      },
      {
        label: "fresh daytime",
        expectedObjective: "freshDaytime",
        intelligenceInput: {
          mainGap: { type: "summer", label: "Limited warm-weather freshness" },
          bestNextMove: "Add a fresh daytime fragrance",
          dominantProfile: "Warm and evening-oriented",
          strongestCoverage: "strong winter coverage",
        },
        recommendationInput: freshRecommendation,
        expectedTitle: "Add fresh daytime fragrance",
        expectedDescription:
          "Your box is currently strongest as warm and evening-oriented. A brighter daytime fragrance would add contrast and improve warm-weather versatility. Fresh Anchor is the pick that best answers that opportunity.",
      },
      {
        label: "evening",
        expectedObjective: "evening",
        intelligenceInput: {
          mainGap: { type: "evening", label: "Limited evening versatility" },
          bestNextMove: "Add a stronger evening fragrance",
          dominantProfile: "Fresh-heavy",
          strongestCoverage: "strong daily versatility",
        },
        recommendationInput: eveningRecommendation,
        expectedTitle: "Add stronger evening fragrance",
        expectedDescription:
          "Your box is currently strongest as fresh-heavy. A stronger evening profile would make the box feel more complete after dark. Club Amber is the pick that best answers that opportunity.",
      },
      {
        label: "contrast",
        expectedObjective: "contrast",
        intelligenceInput: {
          mainGap: { type: "diversity", label: "Low accord diversity" },
          bestNextMove: "Add a contrasting profile for more diversity",
          dominantProfile: "Balanced and versatile",
          strongestCoverage: "strong daily versatility",
        },
        recommendationInput: contrastRecommendation,
        expectedTitle: "Add contrasting profile for more diversity",
        expectedDescription:
          "Your box already reads balanced, with strong daily versatility. A contrasting scent direction would prevent the box from feeling too similar. Artistic Contrast is the pick that best answers that opportunity.",
      },
    ])("builds $label guidance from the reachable objective category", ({
      expectedObjective,
      intelligenceInput,
      recommendationInput,
      expectedTitle,
      expectedDescription,
    }) => {
      const result = buildResult({
        intelligence: intelligence(intelligenceInput),
        selectedPerfumes: [
          perfume({ id: 41, name: "Selected One" }),
          perfume({ id: 42, name: "Selected Two" }),
          perfume({ id: 43, name: "Selected Three" }),
        ],
        selectedCount: 3,
        balanceRecommendations: [recommendationInput],
      });

      expect(result).toMatchObject({
        objectiveKey: expectedObjective,
        title: expectedTitle,
        description: expectedDescription,
        eyebrow: "NEXT IMPROVEMENT",
      });
      expect(result.primaryRecommendation).toMatchObject({
        perfume: recommendationInput.perfume,
        objectiveKey: expectedObjective,
      });
    });

    it("uses early-profile copy for one or two selected fragrances", () => {
      expect(
        buildResult({
          intelligence: intelligence({
            mainGap: { type: "formal", label: "Weak formal coverage" },
            bestNextMove: "Add a formal woody option",
            dominantProfile: "Still taking shape",
            strongestCoverage: "Profile still developing",
          }),
          selectedPerfumes: [perfume({ id: 51 })],
          selectedCount: 1,
          balanceRecommendations: [formalRecommendation],
        }).description
      ).toBe(
        "Your box is just beginning to form a profile. A polished formal fragrance would make the box more useful for dressed-up occasions. Formal Cedar is the pick that best answers that opportunity."
      );

      expect(
        buildResult({
          intelligence: intelligence({
            mainGap: { type: "winter", label: "Limited winter depth" },
            bestNextMove: "Add one warm evening fragrance",
            dominantProfile: "Fresh-heavy",
            strongestCoverage: "moderate summer coverage",
          }),
          selectedPerfumes: [perfume({ id: 52 }), perfume({ id: 53 })],
          selectedCount: 2,
          balanceRecommendations: [coldWeatherRecommendation],
        }).description
      ).toBe(
        "Your box is beginning to lean fresh-heavy. A warmer evening addition would add depth and improve cold-weather range. Amber Winter is the pick that best answers that opportunity."
      );
    });
  });

  describe("priority ordering and tie-breaking", () => {
    it("chooses a higher urgency objective over compatible alternatives when the switch margin is exceeded", () => {
      const result = buildResult({
        intelligence: intelligence({
          mainGap: { type: "winter", label: "Limited winter depth" },
          bestNextMove: "Add one warm evening fragrance",
          dominantProfile: "Fresh-heavy",
          strongestCoverage: "strong summer coverage",
        }),
        selectedPerfumes: [
          perfume({
            id: 61,
            accords: ["citrus", "fresh", "green"],
            vibes: ["fresh", "clean", "bright"],
            occasions: ["daily", "office", "casual"],
            seasons: ["spring", "summer"],
          }),
          perfume({ id: 62, accords: ["citrus"], seasons: ["summer"] }),
          perfume({ id: 63, accords: ["marine"], seasons: ["summer"] }),
        ],
        selectedCount: 3,
        balanceRecommendations: [freshRecommendation, coldWeatherRecommendation],
      });

      expect(result.objectiveKey).toBe("coldWeather");
      expect(result.primaryRecommendation.perfume.name).toBe("Amber Winter");
    });

    it("sorts recommendations by compatibility, finalScore, score, then perfume name", () => {
      const alphaTie = recommendation(
        {
          id: 71,
          name: "Alpha Tie",
          shortName: "",
          accords: ["warm spicy", "amber"],
          vibes: ["warm"],
          occasions: ["date"],
          seasons: ["winter"],
        },
        { score: 80, finalScore: 82 }
      );
      const zuluTie = recommendation(
        {
          id: 72,
          name: "Zulu Tie",
          shortName: "",
          accords: ["warm spicy", "amber"],
          vibes: ["warm"],
          occasions: ["date"],
          seasons: ["winter"],
        },
        { score: 80, finalScore: 82 }
      );
      const higherScore = recommendation(
        {
          id: 73,
          name: "Higher Score",
          accords: ["warm spicy", "amber"],
          vibes: ["warm"],
          occasions: ["date"],
          seasons: ["winter"],
        },
        { score: 81, finalScore: 82 }
      );
      const higherFinalScore = recommendation(
        {
          id: 74,
          name: "Higher Final",
          accords: ["warm spicy", "amber"],
          vibes: ["warm"],
          occasions: ["date"],
          seasons: ["winter"],
        },
        { score: 70, finalScore: 83 }
      );
      const higherCompatibility = recommendation(
        {
          id: 75,
          name: "Higher Compatibility",
          accords: ["warm spicy", "amber", "vanilla"],
          vibes: ["warm", "cozy"],
          occasions: ["date", "night"],
          seasons: ["winter", "fall"],
        },
        { score: 60, finalScore: 60 }
      );

      const result = buildResult({
        intelligence: intelligence({
          mainGap: { type: "winter", label: "Limited winter depth" },
          bestNextMove: "Add one warm evening fragrance",
          dominantProfile: "Fresh-heavy",
          strongestCoverage: "strong summer coverage",
        }),
        selectedPerfumes: [perfume({ id: 76, accords: ["citrus"], seasons: ["summer"] })],
        selectedCount: 1,
        balanceRecommendations: [
          zuluTie,
          alphaTie,
          higherScore,
          higherFinalScore,
          higherCompatibility,
        ],
      });

      expect(result.recommendations.map(({ perfume: item }) => item.name)).toEqual([
        "Higher Compatibility",
        "Higher Final",
        "Higher Score",
        "Alpha Tie",
        "Zulu Tie",
      ]);
      expect(result.primaryRecommendation.perfume.name).toBe("Higher Compatibility");
    });

    it("uses objective key alphabetical ordering when urgency, missing coverage, compatibility, and scores tie", () => {
      const result = buildResult({
        intelligence: intelligence({
          mainGap: { type: "unknown", label: "General gap" },
          bestNextMove: "",
          dominantProfile: "",
          strongestCoverage: "Profile still developing",
        }),
        selectedPerfumes: [],
        selectedCount: 1,
        balanceRecommendations: [
          recommendation(
            {
              id: 81,
              name: "Universal Candidate",
              shortName: "Universal",
              accords: [],
              vibes: [],
              occasions: [],
              seasons: ["spring", "summer", "fall", "winter"],
            },
            { score: 80, finalScore: 80 }
          ),
        ],
      });

      expect(result.objectiveKey).toBe("coldWeather");
      expect(result.title).toBe("Add warm evening depth");
    });
  });

  describe("invalid inputs, references, and deterministic behavior", () => {
    it("normalizes non-array balanceRecommendations to an empty list", () => {
      expect(
        buildResult({
          intelligence: intelligence({
            mainGap: { type: "diversity", label: "Low accord diversity" },
            bestNextMove: "Add a contrasting profile for more diversity",
            dominantProfile: "Fresh-heavy",
            strongestCoverage: "strong summer coverage",
          }),
          selectedPerfumes: [perfume({ id: 91 })],
          selectedCount: 1,
          balanceRecommendations: { perfume: contrastRecommendation.perfume },
        })
      ).toEqual({
        objectiveKey: "coldWeather",
        objectiveUrgency: 76,
        title: "Add warm evening depth",
        titleCode: "warmEveningDepth",
        description:
          "Your box is beginning to lean fresh-heavy. A warmer evening addition would add depth and improve cold-weather range. The next recommendation is chosen to answer that opportunity.",
        descriptionCode: "objective",
        descriptionParams: {
          profile: "Fresh-heavy",
          coverage: "strong summer coverage",
          profilePhraseCode: "earlyLeaning",
          objectiveKey: "coldWeather",
          recommendationName: null,
        },
        eyebrow: "EARLY OPPORTUNITY",
        eyebrowCode: "earlyOpportunity",
        recommendations: [],
        primaryRecommendation: undefined,
      });
    });

    it("characterizes invalid top-level and recommendation inputs as throwing", () => {
      expect(() => buildNextImprovementResult()).toThrow();
      expect(() =>
        buildResult({
          selectedCount: 1,
          intelligence: undefined,
          balanceRecommendations: [contrastRecommendation],
        })
      ).toThrow();
      expect(() =>
        buildResult({
          selectedCount: 1,
          selectedPerfumes: { not: "an array" },
          balanceRecommendations: [contrastRecommendation],
        })
      ).toThrow();
    });

    it("ignores malformed recommendation records when they are not compatible", () => {
      expect(
        buildResult({
          intelligence: intelligence({
            mainGap: { type: "diversity", label: "Low accord diversity" },
            bestNextMove: "Add a contrasting profile for more diversity",
          }),
          selectedCount: 1,
          balanceRecommendations: [{ score: 1, finalScore: 1 }],
        })
      ).toMatchObject({
        objectiveKey: "coldWeather",
        recommendations: [],
        primaryRecommendation: undefined,
      });
    });

    it("treats null selectedPerfumes as an empty coverage source", () => {
      expect(
        buildResult({
          selectedCount: 1,
          selectedPerfumes: null,
          balanceRecommendations: [contrastRecommendation],
        })
      ).toMatchObject({
        objectiveKey: "contrast",
        primaryRecommendation: {
          perfume: contrastRecommendation.perfume,
          objectiveKey: "contrast",
        },
      });
    });

    it("ignores unknown properties while preserving recommendation object references inside copied outputs", () => {
      const customRecommendation = recommendation(
        {
          id: 101,
          name: "Reference Candidate",
          shortName: "Reference",
          accords: [],
          vibes: ["unique", "artistic"],
          occasions: ["special"],
          seasons: ["spring", "winter"],
          unknownPerfumeField: "ignored",
        },
        {
          score: 81,
          finalScore: 82,
          unknownRecommendationField: "preserved",
        }
      );

      const result = buildResult({
        intelligence: intelligence({
          mainGap: { type: "diversity", label: "Low accord diversity" },
          bestNextMove: "Add a contrasting profile for more diversity",
        }),
        selectedPerfumes: [perfume({ id: 102 })],
        selectedCount: 1,
        balanceRecommendations: [customRecommendation],
      });

      expect(result.primaryRecommendation).not.toBe(customRecommendation);
      expect(result.primaryRecommendation.perfume).toBe(customRecommendation.perfume);
      expect(result.primaryRecommendation.unknownRecommendationField).toBe("preserved");
      expect(result.primaryRecommendation.perfume.unknownPerfumeField).toBe("ignored");
    });

    it("does not mutate frozen intelligence, selected perfume, or recommendation inputs", () => {
      const frozenIntelligence = deepFreeze(
        intelligence({
          mainGap: { type: "formal", label: "Weak formal coverage" },
          bestNextMove: "Add a formal woody option",
          dominantProfile: "Woody and sophisticated",
        })
      );
      const frozenSelected = deepFreeze([
        perfume({ id: 111, accords: ["citrus"], seasons: ["summer"] }),
      ]);
      const frozenRecommendations = deepFreeze([formalRecommendation]);

      const result = buildResult({
        intelligence: frozenIntelligence,
        selectedPerfumes: frozenSelected,
        selectedCount: frozenSelected.length,
        balanceRecommendations: frozenRecommendations,
      });

      expect(result.primaryRecommendation.perfume).toBe(formalRecommendation.perfume);
      expect(frozenRecommendations[0]).not.toHaveProperty("objectiveKey");
      expect(frozenSelected).toHaveLength(1);
    });

    it("is deterministic for repeated identical inputs", () => {
      const input = {
        intelligence: intelligence({
          mainGap: { type: "winter", label: "Limited winter depth" },
          bestNextMove: "Add one warm evening fragrance",
          dominantProfile: "Fresh-heavy",
          strongestCoverage: "strong summer coverage",
        }),
        selectedPerfumes: [
          perfume({
            id: 121,
            accords: ["citrus"],
            vibes: ["fresh"],
            occasions: ["daily"],
            seasons: ["summer"],
          }),
        ],
        selectedCount: 1,
        balanceRecommendations: [
          coldWeatherRecommendation,
          formalRecommendation,
          freshRecommendation,
        ],
      };

      expect(buildResult(input)).toEqual(buildResult(input));
    });
  });

  it("covers a realistic golden next-improvement workflow", () => {
    const selectedPerfumes = [
      perfume({
        id: 131,
        name: "Fresh Office",
        accords: ["citrus", "fresh", "aromatic"],
        vibes: ["fresh", "clean"],
        occasions: ["daily", "office"],
        seasons: ["spring", "summer"],
      }),
      perfume({
        id: 132,
        name: "Marine Casual",
        accords: ["marine", "aquatic"],
        vibes: ["fresh", "easy"],
        occasions: ["casual", "daily"],
        seasons: ["summer"],
      }),
      perfume({
        id: 133,
        name: "Green Day",
        accords: ["green", "citrus"],
        vibes: ["bright", "fresh"],
        occasions: ["office"],
        seasons: ["spring"],
      }),
    ];
    const recommendations = [
      recommendation(
        {
          id: 134,
          name: "Amber Night",
          shortName: "Amber Night",
          brand: "Atelier Warm",
          accords: ["warm spicy", "amber", "vanilla"],
          vibes: ["warm", "cozy", "dark"],
          occasions: ["date", "night", "evening"],
          seasons: ["fall", "winter"],
        },
        {
          score: 93,
          finalScore: 98,
          reasons: ["Strengthens winter coverage"],
        }
      ),
      recommendation(
        {
          id: 135,
          name: "Formal Iris",
          shortName: "Formal Iris",
          brand: "Atelier Formal",
          accords: ["woody", "iris", "powdery"],
          vibes: ["elegant", "sophisticated"],
          occasions: ["formal", "office", "special"],
          seasons: ["spring", "fall"],
        },
        {
          score: 88,
          finalScore: 90,
          reasons: ["Strengthens formal versatility"],
        }
      ),
      recommendation(
        {
          id: 136,
          name: "Another Fresh",
          shortName: "Another Fresh",
          brand: "Atelier Fresh",
          accords: ["citrus", "fresh"],
          vibes: ["fresh", "clean"],
          occasions: ["daily"],
          seasons: ["spring", "summer"],
        },
        {
          score: 99,
          finalScore: 99,
          reasons: ["Adds citrus brightness"],
        }
      ),
    ];

    expect(
      buildResult({
        intelligence: intelligence({
          mainGap: { type: "winter", label: "Limited winter depth" },
          bestNextMove: "Add one warm evening fragrance",
          dominantProfile: "Fresh-heavy",
          strongestCoverage: "excellent summer coverage",
        }),
        selectedPerfumes,
        selectedCount: selectedPerfumes.length,
        balanceRecommendations: recommendations,
      })
    ).toEqual({
      objectiveKey: "coldWeather",
      objectiveUrgency: 90,
      title: "Add warm evening fragrance",
      titleCode: undefined,
      description:
        "Your box is currently strongest as fresh-heavy. A warmer evening addition would add depth and improve cold-weather range. Amber Night is the pick that best answers that opportunity.",
      descriptionCode: "objective",
      descriptionParams: {
        profile: "Fresh-heavy",
        coverage: "excellent summer coverage",
        profilePhraseCode: "currentlyStrongest",
        objectiveKey: "coldWeather",
        recommendationName: "Amber Night",
      },
      eyebrow: "NEXT IMPROVEMENT",
      eyebrowCode: "nextImprovement",
      recommendations: [
        {
          ...recommendations[0],
          objectiveKey: "coldWeather",
          objectiveCompatibilityScore: 10,
          objectiveReasons: [
            "Adds warm evening depth",
            "Adds evening range",
            "Strengthens cold-weather coverage",
          ],
        },
        {
          ...recommendations[1],
          objectiveKey: "coldWeather",
          objectiveCompatibilityScore: 6,
          objectiveReasons: [
            "Adds warm evening depth",
            "Adds evening range",
            "Strengthens cold-weather coverage",
          ],
        },
      ],
      primaryRecommendation: {
        ...recommendations[0],
        objectiveKey: "coldWeather",
        objectiveCompatibilityScore: 10,
        objectiveReasons: [
          "Adds warm evening depth",
          "Adds evening range",
          "Strengthens cold-weather coverage",
        ],
      },
    });
  });
});
