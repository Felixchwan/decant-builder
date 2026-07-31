import { describe, expect, it } from "vitest";

import {
  buildCollectionCardDnaItems,
  buildCollectionCardFilename,
  buildCollectionCardItems,
  buildCollectionCardProfileTraits,
  buildCollectionCardSeasonRows,
  buildCollectionCardViewModel,
} from "./buildCollectionCardViewModel.js";

const config = {
  brand: {
    businessName: "Discovery Decants Test",
  },
  commerce: {
    currency: "MXN",
  },
  collectionCard: {
    brandHeading: "DISCOVERY DECANTS",
    filenamePrefix: "discovery-box",
    ariaLabel: "Discovery Box share card",
    boxAriaLabel: "Rendered Discovery Box",
    footer: "Built with Discovery Decants",
    curatorBonusIncludedLabel: "Curator Bonus Included",
    curatorBonusAvailableLabel: "Curator Bonus Available",
    curatorBonusUnlockedCopy: "Mystery selections remain wrapped.",
    curatorBonusLockedCopy: "Complete your Discovery Box to unlock mystery selections.",
    shareTitle: "Share your Discovery Box",
    shareText: "Built with Discovery Decants",
  },
};

function perfume(overrides = {}) {
  return {
    id: 1,
    name: "Test Perfume",
    shortName: "Test",
    brand: "Test House",
    points: 1,
    tier: "Bronze",
    image: "/images/test.png",
    accords: [],
    vibes: [],
    occasions: [],
    seasons: [],
    ...overrides,
  };
}

function boxSummary(overrides = {}) {
  return {
    seasonStrengths: {},
    seasonCounts: {},
    accordCounts: {},
    accordMap: {},
    occasionCounts: {},
    vibeCounts: {},
    ...overrides,
  };
}

function coverageSummary(overrides = {}) {
  return {
    strengths: [],
    gaps: [],
    ...overrides,
  };
}

function identity(overrides = {}) {
  return {
    title: "Fresh Rotation",
    subtitle: "Built around clean daily wear.",
    mood: ["Fresh", "Clean", "Daily"],
    palette: "fresh",
    archetype: "rotation",
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

const selectedPerfumes = [
  perfume({
    id: 11,
    name: "Fresh Office",
    shortName: "Fresh Office",
    brand: "Maison Test",
    points: 1,
    tier: "Bronze",
    image: "/images/fresh-office.png",
    accords: ["citrus", "fresh", "aromatic"],
    vibes: ["fresh", "clean"],
    occasions: ["daily", "office"],
    seasons: ["spring", "summer"],
  }),
  perfume({
    id: 112,
    name: "Marine Casual",
    shortName: "Marine Casual",
    brand: "Silver Test",
    points: 1.5,
    tier: "Silver",
    image: "/images/marine-casual.png",
    accords: ["marine", "aquatic"],
    vibes: ["fresh", "easy"],
    occasions: ["casual", "daily"],
    seasons: ["summer"],
  }),
  perfume({
    id: 213,
    name: "Amber Date",
    shortName: "Amber Date",
    brand: "Gold Test",
    points: 2,
    tier: "Gold",
    image: "/images/amber-date.png",
    accords: ["amber", "vanilla", "warm spicy"],
    vibes: ["warm", "seductive"],
    occasions: ["date", "night"],
    seasons: ["fall", "winter"],
  }),
  perfume({
    id: 314,
    name: "Formal Cedar",
    shortName: "Formal Cedar",
    brand: "Platinum Test",
    points: 2.5,
    tier: "Platinum",
    image: "/images/formal-cedar.png",
    accords: ["woody", "iris"],
    vibes: ["elegant"],
    occasions: ["formal", "office"],
    seasons: ["spring", "fall"],
  }),
];

const populatedSummary = boxSummary({
  seasonStrengths: {
    spring: 25,
    summer: 28,
    fall: 24,
    winter: 19,
  },
  accordCounts: {
    citrus: 2,
    amber: 2,
    woody: 1,
    marine: 1,
    iris: 1,
  },
  occasionCounts: {
    daily: 2,
    office: 2,
    casual: 1,
    date: 1,
    night: 1,
    formal: 1,
  },
  vibeCounts: {
    fresh: 2,
    clean: 1,
    easy: 1,
    warm: 1,
    seductive: 1,
    elegant: 1,
  },
});

const populatedScentDna = {
  scores: {
    versatility: 82,
    depth: 72,
    seasonBalance: 70,
  },
  topAccords: [
    { label: "citrus", score: 84 },
    { label: "amber", score: 78 },
    { label: "woody", score: 66 },
    { label: "marine", score: 55 },
  ],
};

function viewModel(overrides = {}) {
  return buildCollectionCardViewModel({
    selectedPerfumes,
    totalPoints: 7,
    estimatedValue: 700,
    boxSummary: populatedSummary,
    coverageSummary: coverageSummary(),
    scentDna: populatedScentDna,
    collectionIdentity: identity(),
    curatorBonus: { isUnlocked: true },
    config,
    maxSlots: 16,
    maxSelectableSlots: 14,
    ...overrides,
  });
}

describe("buildCollectionCardViewModel", () => {
  describe("public helper exports", () => {
    it("adapts selected perfumes into cloned collection card items in source order", () => {
      const items = buildCollectionCardItems(selectedPerfumes);

      expect(items).toEqual([
        {
          id: 11,
          name: "Fresh Office",
          shortName: "Fresh Office",
          brand: "Maison Test",
          points: 1,
          tier: "Bronze",
          image: "/images/fresh-office.png",
          accords: ["citrus", "fresh", "aromatic"],
          vibes: ["fresh", "clean"],
          occasions: ["daily", "office"],
          seasons: ["spring", "summer"],
        },
        {
          id: 112,
          name: "Marine Casual",
          shortName: "Marine Casual",
          brand: "Silver Test",
          points: 1.5,
          tier: "Silver",
          image: "/images/marine-casual.png",
          accords: ["marine", "aquatic"],
          vibes: ["fresh", "easy"],
          occasions: ["casual", "daily"],
          seasons: ["summer"],
        },
        {
          id: 213,
          name: "Amber Date",
          shortName: "Amber Date",
          brand: "Gold Test",
          points: 2,
          tier: "Gold",
          image: "/images/amber-date.png",
          accords: ["amber", "vanilla", "warm spicy"],
          vibes: ["warm", "seductive"],
          occasions: ["date", "night"],
          seasons: ["fall", "winter"],
        },
        {
          id: 314,
          name: "Formal Cedar",
          shortName: "Formal Cedar",
          brand: "Platinum Test",
          points: 2.5,
          tier: "Platinum",
          image: "/images/formal-cedar.png",
          accords: ["woody", "iris"],
          vibes: ["elegant"],
          occasions: ["formal", "office"],
          seasons: ["spring", "fall"],
        },
      ]);
      expect(items[0]).not.toBe(selectedPerfumes[0]);
      expect(items[0].accords).not.toBe(selectedPerfumes[0].accords);
      expect(buildCollectionCardItems(null)).toEqual([]);
    });

    it("builds season rows in fixed spring, summer, fall, winter order without clamping percentages", () => {
      expect(
        buildCollectionCardSeasonRows(
          {
            summer: 18,
            spring: 7,
            winter: 0,
            unknown: 100,
          },
          2
        )
      ).toEqual([
        { id: "spring", label: "Spring", count: 35, strength: 7, percent: 35 },
        { id: "summer", label: "Summer", count: 90, strength: 18, percent: 90 },
        { id: "fall", label: "Fall", count: 0, strength: 0, percent: 0 },
        { id: "winter", label: "Winter", count: 0, strength: 0, percent: 0 },
      ]);
      expect(buildCollectionCardSeasonRows({ spring: 2 }, 0)[0]).toEqual({
        id: "spring",
        label: "Spring",
        count: 200,
        strength: 2,
        percent: 200,
      });
    });

    it("builds DNA items from topAccords first and falls back to sorted accord counts", () => {
      const topAccords = Array.from({ length: 7 }, (_, index) => ({
        label: `accord${index}`,
        score: 100 - index,
      }));

      expect(buildCollectionCardDnaItems({
        boxSummary: boxSummary({
          accordCounts: { ignored: 99 },
        }),
        scentDna: { topAccords },
      })).toEqual(topAccords.slice(0, 6));
      expect(buildCollectionCardDnaItems({
        boxSummary: boxSummary({
          accordCounts: {
            woody: 2,
            amber: 3,
            citrus: 3,
            marine: 1,
          },
        }),
        scentDna: {},
      })).toEqual([
        { label: "amber", count: 3 },
        { label: "citrus", count: 3 },
        { label: "woody", count: 2 },
        { label: "marine", count: 1 },
      ]);
    });

    it("formats filenames by removing accents, punctuation, apostrophes, and repeated separators", () => {
      expect(buildCollectionCardFilename("L'Été / Signature  Box!!", config)).toBe(
        "discovery-box-lete-signature-box.png"
      );
      expect(buildCollectionCardFilename("", config)).toBe("discovery-box-collection.png");
      expect(buildCollectionCardFilename(null, config)).toBe("discovery-box-collection.png");
    });
  });

  describe("profile trait derivation", () => {
    it("returns no traits for empty selected count", () => {
      expect(
        buildCollectionCardProfileTraits({
          boxSummary: boxSummary(),
          coverageSummary: coverageSummary({ strengths: [{ label: "Ignored Strength" }] }),
          scentDna: { scores: { versatility: 100, depth: 100, seasonBalance: 100 } },
          selectedCount: 0,
          seasonRows: buildCollectionCardSeasonRows({}, 0),
        })
      ).toEqual([]);
    });

    it("derives and caps profile traits in implementation order", () => {
      expect(
        buildCollectionCardProfileTraits({
          boxSummary: populatedSummary,
          coverageSummary: coverageSummary(),
          scentDna: populatedScentDna,
          selectedCount: selectedPerfumes.length,
          seasonRows: buildCollectionCardSeasonRows(
            populatedSummary.seasonStrengths,
            selectedPerfumes.length
          ),
        })
      ).toEqual([
        "Balanced Rotation",
        "Office Friendly",
        "Date Night Strong",
        "Spring/Summer Specialist",
        "Autumn Specialist",
      ]);
    });

    it("uses coverage strengths fallback and final textual fallback when no profile rules match", () => {
      const neutralRows = buildCollectionCardSeasonRows({}, 1);

      expect(
        buildCollectionCardProfileTraits({
          boxSummary: boxSummary(),
          coverageSummary: coverageSummary({
            strengths: [{ label: "Clean Starter" }, { label: "Easy Wear" }],
          }),
          scentDna: {},
          selectedCount: 1,
          seasonRows: neutralRows,
        })
      ).toEqual(["Clean Starter", "Easy Wear"]);
      expect(
        buildCollectionCardProfileTraits({
          boxSummary: boxSummary(),
          coverageSummary: coverageSummary(),
          scentDna: {},
          selectedCount: 1,
          seasonRows: neutralRows,
        })
      ).toEqual(["Taking Shape"]);
      expect(
        buildCollectionCardProfileTraits({
          boxSummary: boxSummary(),
          coverageSummary: coverageSummary(),
          scentDna: {},
          selectedCount: 3,
          seasonRows: neutralRows,
        })
      ).toEqual(["Casual Heavy"]);
    });
  });

  describe("complete ViewModel shape", () => {
    it("builds the exact empty card model with config copy and locked curator bonus", () => {
      expect(
        buildCollectionCardViewModel({
          selectedPerfumes: [],
          totalPoints: 0,
          estimatedValue: 0,
          boxSummary: boxSummary(),
          coverageSummary: coverageSummary(),
          scentDna: {},
          collectionIdentity: null,
          curatorBonus: null,
          config,
          maxSlots: 16,
          maxSelectableSlots: 14,
        })
      ).toEqual({
        header: {
          businessName: "Discovery Decants Test",
          heading: "DISCOVERY DECANTS",
          title: undefined,
          subtitle: undefined,
          mood: [],
          palette: undefined,
        },
        collection: {
          items: [],
          totalSlots: 0,
          totalPoints: 0,
          collectionPoints: 0,
          monetaryTotal: 0,
          currency: "MXN",
        },
        identity: {
          title: undefined,
          subtitle: undefined,
          mood: [],
          palette: undefined,
          archetype: undefined,
        },
        dna: {
          descriptors: [],
          primary: "",
        },
        coverage: {
          seasons: [
            { id: "spring", label: "Spring", count: 0, strength: 0, percent: 0 },
            { id: "summer", label: "Summer", count: 0, strength: 0, percent: 0 },
            { id: "fall", label: "Fall", count: 0, strength: 0, percent: 0 },
            { id: "winter", label: "Winter", count: 0, strength: 0, percent: 0 },
          ],
          profileTraits: [],
        },
        curatorBonus: {
          isUnlocked: false,
          includedLabel: "Curator Bonus Included",
          availableLabel: "Curator Bonus Available",
          unlockedCopy: "Mystery selections remain wrapped.",
          lockedCopy: "Complete your Discovery Box to unlock mystery selections.",
        },
        export: {
          filename: "discovery-box-collection.png",
          defaultFilename: "discovery-box-collection.png",
          shareTitle: "Share your Discovery Box",
          shareText: "Built with Discovery Decants",
        },
        cardProps: {
          heading: "DISCOVERY DECANTS",
          ariaLabel: "Discovery Box share card",
          boxAriaLabel: "Rendered Discovery Box",
          footer: "Built with Discovery Decants",
          curatorBonusIncludedLabel: "Curator Bonus Included",
          curatorBonusAvailableLabel: "Curator Bonus Available",
          curatorBonusUnlockedCopy: "Mystery selections remain wrapped.",
          curatorBonusLockedCopy: "Complete your Discovery Box to unlock mystery selections.",
          perfumes: [],
          title: undefined,
          subtitle: undefined,
          mood: [],
          palette: undefined,
          fragranceCount: 0,
          collectionPoints: 0,
          profileTraits: [],
          dnaDescriptors: [],
          primaryDna: "",
          isCuratorBonusUnlocked: false,
          maxSlots: 16,
          maxSelectableSlots: 14,
        },
      });
    });

    it("builds the exact populated card model and duplicates export-facing values into cardProps", () => {
      expect(viewModel()).toEqual({
        header: {
          businessName: "Discovery Decants Test",
          heading: "DISCOVERY DECANTS",
          title: "Fresh Rotation",
          subtitle: "Built around clean daily wear.",
          mood: ["Fresh", "Clean", "Daily"],
          palette: "fresh",
        },
        collection: {
          items: buildCollectionCardItems(selectedPerfumes),
          totalSlots: 4,
          totalPoints: 7,
          collectionPoints: 7,
          monetaryTotal: 700,
          currency: "MXN",
        },
        identity: {
          title: "Fresh Rotation",
          subtitle: "Built around clean daily wear.",
          mood: ["Fresh", "Clean", "Daily"],
          palette: "fresh",
          archetype: "rotation",
        },
        dna: {
          descriptors: ["Citrus", "Amber", "Woody"],
          primary: "Citrus",
        },
        coverage: {
          seasons: [
            { id: "spring", label: "Spring", count: 63, strength: 25, percent: 63 },
            { id: "summer", label: "Summer", count: 70, strength: 28, percent: 70 },
            { id: "fall", label: "Fall", count: 60, strength: 24, percent: 60 },
            { id: "winter", label: "Winter", count: 48, strength: 19, percent: 48 },
          ],
          profileTraits: ["Balanced Rotation", "Office Friendly", "Date Night Strong"],
        },
        curatorBonus: {
          isUnlocked: true,
          includedLabel: "Curator Bonus Included",
          availableLabel: "Curator Bonus Available",
          unlockedCopy: "Mystery selections remain wrapped.",
          lockedCopy: "Complete your Discovery Box to unlock mystery selections.",
        },
        export: {
          filename: "discovery-box-fresh-rotation.png",
          defaultFilename: "discovery-box-collection.png",
          shareTitle: "Share your Discovery Box",
          shareText: "Built with Discovery Decants",
        },
        cardProps: {
          heading: "DISCOVERY DECANTS",
          ariaLabel: "Discovery Box share card",
          boxAriaLabel: "Rendered Discovery Box",
          footer: "Built with Discovery Decants",
          curatorBonusIncludedLabel: "Curator Bonus Included",
          curatorBonusAvailableLabel: "Curator Bonus Available",
          curatorBonusUnlockedCopy: "Mystery selections remain wrapped.",
          curatorBonusLockedCopy: "Complete your Discovery Box to unlock mystery selections.",
          perfumes: buildCollectionCardItems(selectedPerfumes),
          title: "Fresh Rotation",
          subtitle: "Built around clean daily wear.",
          mood: ["Fresh", "Clean", "Daily"],
          palette: "fresh",
          fragranceCount: 4,
          collectionPoints: 7,
          profileTraits: ["Balanced Rotation", "Office Friendly", "Date Night Strong"],
          dnaDescriptors: ["Citrus", "Amber", "Woody"],
          primaryDna: "Citrus",
          isCuratorBonusUnlocked: true,
          maxSlots: 16,
          maxSelectableSlots: 14,
        },
      });
    });
  });

  describe("invalid inputs, reference behavior, immutability, and determinism", () => {
    it("characterizes malformed inputs and missing required config as throwing", () => {
      expect(() => buildCollectionCardViewModel()).toThrow();
      expect(() =>
        buildCollectionCardViewModel({
          selectedPerfumes: [],
          totalPoints: 0,
          estimatedValue: 0,
          boxSummary: null,
          coverageSummary: coverageSummary(),
          scentDna: {},
          collectionIdentity: null,
          curatorBonus: null,
          config,
        })
      ).toThrow();
      expect(() =>
        buildCollectionCardViewModel({
          selectedPerfumes: [null],
          totalPoints: 0,
          estimatedValue: 0,
          boxSummary: boxSummary(),
          coverageSummary: coverageSummary(),
          scentDna: {},
          collectionIdentity: null,
          curatorBonus: null,
          config,
        })
      ).toThrow();
      expect(buildCollectionCardFilename("title", { collectionCard: {} })).toBe(
        "undefined-title.png"
      );
    });

    it("ignores unknown properties and reuses identity mood and palette references", () => {
      const identityInput = identity({
        mood: ["Warm", "Elegant"],
        palette: { key: "warm" },
        unknownIdentity: "ignored",
      });
      const result = viewModel({
        collectionIdentity: identityInput,
        unknownRoot: "ignored",
      });

      expect(result).not.toHaveProperty("unknownRoot");
      expect(result.header.mood).toBe(identityInput.mood);
      expect(result.identity.mood).toBe(identityInput.mood);
      expect(result.cardProps.mood).toBe(identityInput.mood);
      expect(result.header.palette).toBe(identityInput.palette);
      expect(result.identity).not.toHaveProperty("unknownIdentity");
    });

    it("does not mutate frozen inputs and clones selected perfume arrays for output", () => {
      const frozenPerfumes = deepFreeze([...selectedPerfumes]);
      const frozenSummary = deepFreeze({ ...populatedSummary });
      const frozenCoverage = deepFreeze(coverageSummary());
      const frozenScentDna = deepFreeze({ ...populatedScentDna });
      const frozenIdentity = deepFreeze(identity());
      const frozenConfig = deepFreeze(config);

      const result = buildCollectionCardViewModel({
        selectedPerfumes: frozenPerfumes,
        totalPoints: 7,
        estimatedValue: 700,
        boxSummary: frozenSummary,
        coverageSummary: frozenCoverage,
        scentDna: frozenScentDna,
        collectionIdentity: frozenIdentity,
        curatorBonus: deepFreeze({ isUnlocked: true }),
        config: frozenConfig,
        maxSlots: 16,
        maxSelectableSlots: 14,
      });

      expect(result.collection.items).toEqual(buildCollectionCardItems(selectedPerfumes));
      expect(result.collection.items[0]).not.toBe(frozenPerfumes[0]);
      expect(result.collection.items[0].accords).not.toBe(frozenPerfumes[0].accords);
      expect(frozenPerfumes).toHaveLength(4);
    });

    it("is deterministic for repeated identical inputs", () => {
      expect(viewModel()).toEqual(viewModel());
    });
  });

  it("covers a realistic golden Collection Card workflow", () => {
    const result = viewModel({
      collectionIdentity: identity({
        title: "Été Signature / Office",
        subtitle: "A polished warm-weather office rotation.",
        mood: ["Fresh", "Office", "Signature"],
        palette: "office",
        archetype: "signature",
      }),
      curatorBonus: { isUnlocked: false },
      maxSlots: 12,
      maxSelectableSlots: 10,
    });

    expect(Object.keys(result)).toEqual([
      "header",
      "collection",
      "identity",
      "dna",
      "coverage",
      "curatorBonus",
      "export",
      "cardProps",
    ]);
    expect(result.header).toEqual({
      businessName: "Discovery Decants Test",
      heading: "DISCOVERY DECANTS",
      title: "Été Signature / Office",
      subtitle: "A polished warm-weather office rotation.",
      mood: ["Fresh", "Office", "Signature"],
      palette: "office",
    });
    expect(result.collection).toEqual({
      items: buildCollectionCardItems(selectedPerfumes),
      totalSlots: 4,
      totalPoints: 7,
      collectionPoints: 7,
      monetaryTotal: 700,
      currency: "MXN",
    });
    expect(result.identity).toEqual({
      title: "Été Signature / Office",
      subtitle: "A polished warm-weather office rotation.",
      mood: ["Fresh", "Office", "Signature"],
      palette: "office",
      archetype: "signature",
    });
    expect(result.dna).toEqual({
      descriptors: ["Citrus", "Amber", "Woody"],
      primary: "Citrus",
    });
    expect(result.coverage.profileTraits).toEqual([
      "Balanced Rotation",
      "Office Friendly",
      "Date Night Strong",
    ]);
    expect(result.curatorBonus.isUnlocked).toBe(false);
    expect(result.export).toEqual({
      filename: "discovery-box-ete-signature-office.png",
      defaultFilename: "discovery-box-collection.png",
      shareTitle: "Share your Discovery Box",
      shareText: "Built with Discovery Decants",
    });
    expect(result.cardProps).toEqual({
      heading: "DISCOVERY DECANTS",
      ariaLabel: "Discovery Box share card",
      boxAriaLabel: "Rendered Discovery Box",
      footer: "Built with Discovery Decants",
      curatorBonusIncludedLabel: "Curator Bonus Included",
      curatorBonusAvailableLabel: "Curator Bonus Available",
      curatorBonusUnlockedCopy: "Mystery selections remain wrapped.",
      curatorBonusLockedCopy: "Complete your Discovery Box to unlock mystery selections.",
      perfumes: buildCollectionCardItems(selectedPerfumes),
      title: "Été Signature / Office",
      subtitle: "A polished warm-weather office rotation.",
      mood: ["Fresh", "Office", "Signature"],
      palette: "office",
      fragranceCount: 4,
      collectionPoints: 7,
      profileTraits: ["Balanced Rotation", "Office Friendly", "Date Night Strong"],
      dnaDescriptors: ["Citrus", "Amber", "Woody"],
      primaryDna: "Citrus",
      isCuratorBonusUnlocked: false,
      maxSlots: 12,
      maxSelectableSlots: 10,
    });
  });
});
