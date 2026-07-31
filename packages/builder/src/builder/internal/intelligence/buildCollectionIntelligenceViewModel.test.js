import { describe, expect, it } from "vitest";

import {
  buildCollectionIntelligenceViewModel,
  formatFiveStarRating,
  formatIntelligenceLabel,
  getObjectiveCompatibilityScore,
  getPerfumeNoteLabels,
  getStrengthSegmentCount,
  getSupportingAccords,
  normalizeAccordLabel,
  selectDnaExplorerDetail,
} from "./buildCollectionIntelligenceViewModel.js";

function perfume(overrides = {}) {
  return {
    id: 1,
    name: "Test Perfume",
    shortName: "Test",
    brand: "House",
    points: 1,
    accords: [],
    vibes: [],
    occasions: [],
    seasons: [],
    topNotes: [],
    middleNotes: [],
    baseNotes: [],
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

function summary(overrides = {}) {
  return {
    seasonStrengths: {},
    seasons: [],
    occasions: [],
    vibes: [],
    notes: [],
    accordMap: {},
    occasionCounts: {},
    vibeCounts: {},
    ...overrides,
  };
}

function deepFreeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    Object.values(value).forEach(deepFreeze);
  }

  return value;
}

const freshOffice = perfume({
  id: 11,
  name: "Fresh Office",
  shortName: "Fresh Office",
  accords: ["citrus", "fresh", "aromatic"],
  vibes: ["fresh", "clean"],
  occasions: ["daily", "office"],
  seasons: ["spring", "summer"],
  topNotes: ["bergamot"],
  middleNotes: ["mint"],
  baseNotes: ["cedar"],
});

const marineCasual = perfume({
  id: 12,
  name: "Marine Casual",
  shortName: "Marine Casual",
  accords: ["marine", "aquatic"],
  vibes: ["fresh", "easy"],
  occasions: ["casual", "daily"],
  seasons: ["summer"],
});

const greenDay = perfume({
  id: 13,
  name: "Green Day",
  shortName: "Green Day",
  accords: ["green", "citrus"],
  vibes: ["bright", "fresh"],
  occasions: ["office"],
  seasons: ["spring"],
});

const amberNightRecommendation = recommendation(
  {
    id: 101,
    name: "Amber Night",
    shortName: "Amber Night",
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
);

const formalIrisRecommendation = recommendation(
  {
    id: 102,
    name: "Formal Iris",
    shortName: "Formal Iris",
    accords: ["woody", "iris", "powdery"],
    vibes: ["elegant"],
    occasions: ["formal", "office"],
    seasons: ["spring", "fall"],
  },
  {
    score: 88,
    finalScore: 90,
    reasons: ["Strengthens formal versatility"],
  }
);

const freshCitrusRecommendation = recommendation(
  {
    id: 103,
    name: "Citrus Lift",
    shortName: "Citrus Lift",
    accords: ["citrus", "green"],
    vibes: ["fresh", "bright"],
    occasions: ["daily", "office"],
    seasons: ["spring", "summer"],
  },
  {
    score: 86,
    finalScore: 87,
    reasons: ["Adds citrus brightness"],
  }
);

const variedSelected = [freshOffice, marineCasual, greenDay];

const variedSummary = summary({
  seasonStrengths: {
    spring: 24,
    summer: 27,
    fall: 3,
    winter: 2,
  },
  seasons: ["spring", "summer"],
  occasions: ["daily", "office", "casual"],
  vibes: ["fresh", "clean", "easy", "bright"],
  notes: ["bergamot", "mint"],
  accordMap: {
    citrus: ["Fresh Office", "Green Day"],
    fresh: ["Fresh Office"],
    aromatic: ["Fresh Office"],
    marine: ["Marine Casual"],
    aquatic: ["Marine Casual"],
    green: ["Green Day"],
  },
  occasionCounts: {
    daily: 2,
    office: 2,
    casual: 1,
  },
  vibeCounts: {
    fresh: 3,
    clean: 1,
    easy: 1,
    bright: 1,
  },
});

const variedCoverage = {
  strengths: [{ label: "Warm Weather Ready" }],
  gaps: [{ category: "seasons", target: "winter" }],
};

const variedScentDna = {
  scores: {
    versatility: 76,
    depth: 62,
    seasonBalance: 48,
  },
  topAccords: [
    { label: "citrus", score: 82 },
    { label: "fresh", score: 72 },
    { label: "marine", score: 55 },
    { label: "green", score: 43 },
  ],
};

function variedViewModel(overrides = {}) {
  const recommendations = {
    basedOnYourPicks: [freshCitrusRecommendation],
    toBalanceYourBox: [amberNightRecommendation, formalIrisRecommendation],
  };

  return buildCollectionIntelligenceViewModel({
    selectedPerfumes: variedSelected,
    catalog: [
      ...variedSelected,
      amberNightRecommendation.perfume,
      formalIrisRecommendation.perfume,
      freshCitrusRecommendation.perfume,
    ],
    collectionSummary: variedSummary,
    coverageSummary: variedCoverage,
    scentDna: variedScentDna,
    recommendations,
    curatorBonus: {
      recommendations: recommendations.toBalanceYourBox,
      preference: "complement",
    },
    config: {
      isBoxFull: false,
    },
    ...overrides,
  });
}

describe("buildCollectionIntelligenceViewModel", () => {
  describe("public exports", () => {
    it("re-exports pure display and scoring helpers used by BuilderPanel", () => {
      expect(formatFiveStarRating(3)).toBe("★★★☆☆");
      expect(formatIntelligenceLabel("freshSpicy")).toBe("Fresh Spicy");
      expect(normalizeAccordLabel(" Fresh   Spicy ")).toBe("fresh spicy");
      expect(getStrengthSegmentCount("Defining")).toBe(5);
      expect(getPerfumeNoteLabels(freshOffice)).toEqual(["Bergamot", "Mint", "Cedar"]);
      expect(getSupportingAccords(freshOffice, "citrus")).toEqual(["fresh", "aromatic"]);
      expect(getObjectiveCompatibilityScore("coldWeather", amberNightRecommendation.perfume)).toEqual({
        score: 10,
        normalizedScore: 1,
        reasons: [
          "Adds warm evening depth",
          "Adds evening range",
          "Strengthens cold-weather coverage",
        ],
      });
    });
  });

  describe("empty and fallback output", () => {
    it("builds the exact empty ViewModel shape for the smallest valid input", () => {
      expect(buildCollectionIntelligenceViewModel({})).toEqual({
        profile: {
          traits: [],
          primaryTrait: "",
          supportingTraits: [],
          hasProfileData: false,
        },
        seasons: {
          rows: [
            { id: "spring", label: "Spring", count: 0, strength: 0, percent: 0 },
            { id: "summer", label: "Summer", count: 0, strength: 0, percent: 0 },
            { id: "fall", label: "Fall", count: 0, strength: 0, percent: 0 },
            { id: "winter", label: "Winter", count: 0, strength: 0, percent: 0 },
          ],
          strongest: { id: "fall", label: "Fall", count: 0, strength: 0, percent: 0 },
          weakest: { id: "fall", label: "Fall", count: 0, strength: 0, percent: 0 },
        },
        dna: {
          descriptors: [],
          visibleItems: [],
          accordIndex: {},
        },
        balance: {
          rows: [
            { label: "Versatility", level: 0 },
            { label: "Depth", level: 0 },
            { label: "Freshness", level: 0 },
            { label: "Season Balance", level: 0 },
            { label: "Signature Potential", level: 0 },
          ],
        },
        boxIntelligence: {
          isEarly: false,
          items: [],
          mainGap: null,
          bestNextMove: "",
          dominantProfile: "",
          strongestCoverage: "",
          curatorInsight: {
            strengths: [],
            improvementGoals: [],
          },
          hasAnalysisData: false,
        },
        nextImprovement: null,
      });
    });

    it("defaults null collection, coverage, scent DNA, recommendations, catalog, curator, and config inputs", () => {
      const result = buildCollectionIntelligenceViewModel({
        selectedPerfumes: null,
        catalog: null,
        collectionSummary: null,
        coverageSummary: null,
        scentDna: null,
        recommendations: null,
        curatorBonus: null,
        config: null,
      });

      expect(Object.keys(result)).toEqual([
        "profile",
        "seasons",
        "dna",
        "balance",
        "boxIntelligence",
        "nextImprovement",
      ]);
      expect(result.profile.hasProfileData).toBe(false);
      expect(result.boxIntelligence.hasAnalysisData).toBe(false);
      expect(result.nextImprovement).toBeNull();
    });
  });

  describe("summary, profile, balance, and box intelligence wiring", () => {
    it("derives the expected profile, season, balance, curator insight, and next-improvement values", () => {
      const result = variedViewModel();

      expect(result.profile).toEqual({
        traits: ["Highly Versatile", "Office Friendly", "Spring/Summer Specialist"],
        primaryTrait: "Highly Versatile",
        supportingTraits: ["Office Friendly", "Spring/Summer Specialist"],
        hasProfileData: true,
      });
      expect(result.seasons).toEqual({
        rows: [
          { id: "spring", label: "Spring", count: 80, strength: 24, percent: 80 },
          { id: "summer", label: "Summer", count: 90, strength: 27, percent: 90 },
          { id: "fall", label: "Fall", count: 10, strength: 3, percent: 10 },
          { id: "winter", label: "Winter", count: 7, strength: 2, percent: 7 },
        ],
        strongest: { id: "summer", label: "Summer", count: 90, strength: 27, percent: 90 },
        weakest: { id: "winter", label: "Winter", count: 7, strength: 2, percent: 7 },
      });
      expect(result.balance.rows).toEqual([
        { label: "Versatility", level: 4 },
        { label: "Depth", level: 3 },
        { label: "Freshness", level: 5 },
        { label: "Season Balance", level: 2 },
        { label: "Signature Potential", level: 2 },
      ]);
      expect(result.boxIntelligence).toEqual({
        isEarly: false,
        mainGap: { type: "winter", label: "Limited winter depth" },
        bestNextMove: "Add one warm evening fragrance",
        dominantProfile: "Fresh-heavy",
        strongestCoverage: "Strong daily versatility",
        items: [
          { type: "profile", label: "Dominant profile", value: "Fresh-heavy" },
          {
            type: "coverage",
            label: "Strongest coverage",
            value: "Strong daily versatility",
          },
        ],
        curatorInsight: {
          strengths: [
            "Excellent Spring Coverage",
            "Dominant Summer Coverage",
            "Strong Daily Versatility",
          ],
          improvementGoals: [
            "Weak Fall Coverage",
            "Weak Winter Coverage",
            "Limited Cold-weather Depth",
          ],
        },
        hasAnalysisData: true,
      });
    });

    it("changes curator improvement goal ordering when preference is similar", () => {
      expect(
        variedViewModel({
          curatorBonus: {
            recommendations: [amberNightRecommendation],
            preference: "similar",
          },
        }).boxIntelligence.curatorInsight.improvementGoals
      ).toEqual([
        "Limited Cold-weather Depth",
        "Missing Evening Variety",
        "Underrepresented Woody Fragrances",
      ]);
    });

    it("uses balanced profile copy when scores and selected count satisfy the balance threshold", () => {
      const result = buildCollectionIntelligenceViewModel({
        selectedPerfumes: [
          freshOffice,
          marineCasual,
          greenDay,
          perfume({
            id: 14,
            name: "Amber Date",
            accords: ["amber", "warm spicy"],
            vibes: ["warm"],
            occasions: ["date", "night"],
            seasons: ["fall", "winter"],
          }),
        ],
        collectionSummary: summary({
          seasonStrengths: { spring: 22, summer: 22, fall: 22, winter: 22 },
          seasons: ["spring", "summer", "fall", "winter"],
          occasions: ["daily", "office", "date", "night"],
          vibes: ["fresh", "warm"],
          accordMap: {
            citrus: ["Fresh Office"],
            marine: ["Marine Casual"],
            amber: ["Amber Date"],
            "warm spicy": ["Amber Date"],
          },
          occasionCounts: { daily: 1, office: 1, date: 1, night: 1 },
          vibeCounts: { fresh: 1, warm: 1 },
        }),
        scentDna: { scores: { versatility: 82, depth: 64, seasonBalance: 70 } },
      });

      expect(result.boxIntelligence.dominantProfile).toBe("Balanced and versatile");
      expect(result.boxIntelligence.items[0]).toEqual({
        type: "profile",
        label: "Dominant profile",
        value: "Balanced and versatile",
      });
    });
  });

  describe("DNA Explorer composition and selected detail behavior", () => {
    it("builds visible DNA items, accord index, contributors, and selected detail from real child modules", () => {
      const result = variedViewModel();

      expect(result.dna.descriptors).toEqual(variedScentDna.topAccords);
      expect(result.dna.descriptors).not.toBe(variedScentDna.topAccords);
      expect(result.dna.visibleItems).toEqual([
        {
          label: "citrus",
          score: 82,
          count: 2,
          displayLabel: "Citrus",
          normalizedKey: "citrus",
        },
        {
          label: "fresh",
          score: 72,
          count: 1,
          displayLabel: "Fresh",
          normalizedKey: "fresh",
        },
        {
          label: "marine",
          score: 55,
          count: 1,
          displayLabel: "Marine",
          normalizedKey: "marine",
        },
        {
          label: "green",
          score: 43,
          count: 1,
          displayLabel: "Green",
          normalizedKey: "green",
        },
      ]);
      expect(Object.keys(result.dna.accordIndex)).toEqual(["citrus", "fresh", "marine", "green"]);
      expect(result.dna.accordIndex.citrus.matchingSelectedPerfumes.map(({ perfume: item }) => item.id)).toEqual([
        11,
        13,
      ]);
      expect(result.dna.accordIndex.citrus.mainContributors.map(({ perfume: item }) => item.id)).toEqual([
        11,
        13,
      ]);

      expect(selectDnaExplorerDetail(result, " CITRUS ")).toBe(result.dna.accordIndex.citrus);
      expect(selectDnaExplorerDetail(result, "unknown")).toBeNull();
      expect(selectDnaExplorerDetail(result, null)).toBeNull();
    });

    it("passes catalog and recommendation scores into DNA similar-pick ordering", () => {
      const selectedPerfumes = [freshOffice];
      const selectedSummary = summary({
        accordMap: { citrus: ["Fresh Office"] },
        seasonStrengths: { spring: 8, summer: 10 },
        occasions: ["daily", "office"],
        seasons: ["spring", "summer"],
        vibes: ["fresh", "clean"],
        occasionCounts: { daily: 1, office: 1 },
        vibeCounts: { fresh: 1, clean: 1 },
      });
      const weakCatalogPick = recommendation(
        {
          id: 201,
          name: "Alpha Citrus",
          accords: ["citrus"],
          seasons: ["spring"],
          occasions: ["daily"],
        },
        { score: 10, finalScore: 10 }
      );
      const boostedCatalogPick = recommendation(
        {
          id: 202,
          name: "Zulu Citrus Green",
          accords: ["citrus", "green"],
          seasons: ["fall"],
          occasions: ["date"],
        },
        { score: 100, finalScore: 100 }
      );

      const result = buildCollectionIntelligenceViewModel({
        selectedPerfumes,
        catalog: [freshOffice, weakCatalogPick.perfume, boostedCatalogPick.perfume],
        collectionSummary: selectedSummary,
        scentDna: { topAccords: [{ label: "citrus", score: 70 }] },
        recommendations: {
          basedOnYourPicks: [weakCatalogPick],
          toBalanceYourBox: [boostedCatalogPick],
        },
      });

      expect(result.dna.accordIndex.citrus.similarPicks.map(({ perfume: item, reason }) => [
        item.id,
        reason,
      ])).toEqual([
        [202, "Introduces green contrast"],
        [201, "Premium citrus option"],
      ]);
    });

    it("filters top DNA descriptors with no selected contributors out of visible items and index", () => {
      const result = buildCollectionIntelligenceViewModel({
        selectedPerfumes: [freshOffice],
        collectionSummary: summary({
          accordMap: { citrus: ["Fresh Office"], amber: ["Catalog Only"] },
        }),
        scentDna: {
          topAccords: [
            { label: "amber", score: 90 },
            { label: "citrus", score: 70 },
          ],
        },
      });

      expect(result.dna.descriptors.map(({ label }) => label)).toEqual(["amber", "citrus"]);
      expect(result.dna.visibleItems.map(({ label }) => label)).toEqual(["citrus"]);
      expect(Object.keys(result.dna.accordIndex)).toEqual(["citrus"]);
      expect(selectDnaExplorerDetail(result, "amber")).toBeNull();
    });
  });

  describe("Next Improvement and capacity wiring", () => {
    it("passes balance recommendations and box-full capacity state into next improvement", () => {
      const result = variedViewModel({
        config: { isBoxFull: true },
      });

      expect(result.nextImprovement).toMatchObject({
        objectiveKey: "coldWeather",
        title: "Box complete",
        description:
          "Your Discovery Box is full. Use the recommendation below only as a comparison point for future swaps.",
        eyebrow: "NEXT IMPROVEMENT",
      });
      expect(result.nextImprovement.recommendations.map(({ perfume: item }) => item.id)).toEqual([
        101,
        102,
      ]);
    });

    it("retains fallback next-improvement guidance when no recommendations are compatible", () => {
      const result = buildCollectionIntelligenceViewModel({
        selectedPerfumes: [freshOffice],
        collectionSummary: summary({
          seasonStrengths: { spring: 10, summer: 10, winter: 0 },
          accordMap: { citrus: ["Fresh Office"] },
          vibeCounts: { fresh: 1 },
          occasionCounts: { daily: 1 },
        }),
        recommendations: {
          toBalanceYourBox: [
            recommendation({
              id: 301,
              name: "Weak Citrus",
              shortName: "Weak Citrus",
              accords: ["citrus"],
            }),
          ],
        },
      });

      expect(result.nextImprovement).toEqual({
        objectiveKey: "coldWeather",
        objectiveUrgency: 90,
        title: "Add warm evening fragrance",
        description:
          "Your box is beginning to lean fresh-heavy. A warmer evening addition would add depth and improve cold-weather range. The next recommendation is chosen to answer that opportunity.",
        eyebrow: "EARLY OPPORTUNITY",
        recommendations: [],
        primaryRecommendation: undefined,
      });
    });

    it("does not expose or accept an active objective field at the compositor boundary", () => {
      const result = variedViewModel({
        activeObjective: "formal",
        selectedDnaKey: "citrus",
      });

      expect(result).not.toHaveProperty("activeObjective");
      expect(result).not.toHaveProperty("selectedDnaKey");
      expect(result.nextImprovement.objectiveKey).toBe("coldWeather");
    });
  });

  describe("invalid inputs, references, immutability, and determinism", () => {
    it("characterizes invalid top-level and incomplete selected perfume behavior", () => {
      expect(() => buildCollectionIntelligenceViewModel()).toThrow();
      expect(() =>
        buildCollectionIntelligenceViewModel({
          selectedPerfumes: [null],
          collectionSummary: summary({
            accordMap: { citrus: ["Broken"] },
          }),
          scentDna: { topAccords: [{ label: "citrus", score: 90 }] },
        })
      ).toThrow();
    });

    it("ignores unknown root and nested properties while preserving meaningful child references", () => {
      const result = variedViewModel({
        unknownRoot: "ignored",
        collectionSummary: {
          ...variedSummary,
          unknownSummary: "ignored",
        },
      });

      expect(result).not.toHaveProperty("unknownRoot");
      expect(result.dna.descriptors).toEqual(variedScentDna.topAccords);
      expect(result.dna.descriptors).not.toBe(variedScentDna.topAccords);
      expect(result.dna.accordIndex.citrus.matchingSelectedPerfumes[0].perfume).toBe(freshOffice);
      expect(result.nextImprovement.primaryRecommendation.perfume).toBe(
        amberNightRecommendation.perfume
      );
    });

    it("does not mutate frozen inputs", () => {
      const selectedPerfumes = deepFreeze([...variedSelected]);
      const catalog = deepFreeze([
        ...selectedPerfumes,
        amberNightRecommendation.perfume,
        formalIrisRecommendation.perfume,
      ]);
      const collectionSummary = deepFreeze({ ...variedSummary });
      const coverageSummary = deepFreeze({ ...variedCoverage });
      const scentDna = deepFreeze({ ...variedScentDna });
      const recommendations = deepFreeze({
        toBalanceYourBox: [amberNightRecommendation, formalIrisRecommendation],
      });
      const curatorBonus = deepFreeze({
        recommendations: [amberNightRecommendation],
        preference: "complement",
      });

      const result = buildCollectionIntelligenceViewModel({
        selectedPerfumes,
        catalog,
        collectionSummary,
        coverageSummary,
        scentDna,
        recommendations,
        curatorBonus,
        config: { isBoxFull: false },
      });

      expect(result.dna.visibleItems.map(({ label }) => label)).toEqual([
        "citrus",
        "fresh",
        "marine",
        "green",
      ]);
      expect(selectedPerfumes).toHaveLength(3);
      expect(recommendations.toBalanceYourBox[0]).not.toHaveProperty("objectiveKey");
    });

    it("is deterministic for repeated identical inputs", () => {
      expect(variedViewModel()).toEqual(variedViewModel());
    });
  });

  it("covers a realistic golden intelligence workflow", () => {
    const result = variedViewModel();

    expect(Object.keys(result)).toEqual([
      "profile",
      "seasons",
      "dna",
      "balance",
      "boxIntelligence",
      "nextImprovement",
    ]);
    expect(result.profile.primaryTrait).toBe("Highly Versatile");
    expect(result.seasons.strongest.id).toBe("summer");
    expect(result.seasons.weakest.id).toBe("winter");
    expect(result.dna.visibleItems.map(({ label, count, displayLabel, normalizedKey }) => ({
      label,
      count,
      displayLabel,
      normalizedKey,
    }))).toEqual([
      { label: "citrus", count: 2, displayLabel: "Citrus", normalizedKey: "citrus" },
      { label: "fresh", count: 1, displayLabel: "Fresh", normalizedKey: "fresh" },
      { label: "marine", count: 1, displayLabel: "Marine", normalizedKey: "marine" },
      { label: "green", count: 1, displayLabel: "Green", normalizedKey: "green" },
    ]);
    expect(Object.keys(result.dna.accordIndex)).toEqual(["citrus", "fresh", "marine", "green"]);
    expect(selectDnaExplorerDetail(result, "citrus")).toEqual(result.dna.accordIndex.citrus);
    expect(result.dna.accordIndex.citrus.matchingSelectedPerfumes.map(({ perfume: item }) => item.id)).toEqual([
      11,
      13,
    ]);
    expect(result.nextImprovement).toEqual({
      objectiveKey: "coldWeather",
      objectiveUrgency: 90,
      title: "Add warm evening fragrance",
      description:
        "Your box is currently strongest as fresh-heavy. A warmer evening addition would add depth and improve cold-weather range. Amber Night is the pick that best answers that opportunity.",
      eyebrow: "NEXT IMPROVEMENT",
      recommendations: [
        {
          ...amberNightRecommendation,
          objectiveKey: "coldWeather",
          objectiveCompatibilityScore: 10,
          objectiveReasons: [
            "Adds warm evening depth",
            "Adds evening range",
            "Strengthens cold-weather coverage",
          ],
        },
        {
          ...formalIrisRecommendation,
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
        ...amberNightRecommendation,
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
