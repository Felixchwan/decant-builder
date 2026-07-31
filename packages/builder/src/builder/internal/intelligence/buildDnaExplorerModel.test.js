import { describe, expect, it } from "vitest";

import {
  buildDnaExplorerIndex,
  formatIntelligenceLabel,
  getPerfumeNoteLabels,
  getStrengthSegmentCount,
  getSupportingAccords,
  normalizeAccordLabel,
  selectDnaExplorerDetail,
} from "./buildDnaExplorerModel.js";

function perfume(overrides = {}) {
  return {
    id: 1,
    name: "Test Perfume",
    brand: "Test House",
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

function accordItem(label, overrides = {}) {
  return {
    label,
    displayLabel: formatIntelligenceLabel(label),
    normalizedKey: normalizeAccordLabel(label),
    count: 1,
    ...overrides,
  };
}

function buildDetail({
  accord = "citrus",
  accordItems = [accordItem(accord)],
  selectedPerfumes = [],
  catalogPerfumes = [],
  selectedPerfumeIds = new Set(selectedPerfumes.map(({ id }) => id)),
  recommendations,
} = {}) {
  return buildDnaExplorerIndex({
    accordItems,
    selectedPerfumes,
    catalogPerfumes,
    selectedPerfumeIds,
    recommendations,
  })[normalizeAccordLabel(accord)];
}

function matchingPerfumes(count, total, accord = "citrus") {
  return Array.from({ length: total }, (_, index) =>
    perfume({
      id: index + 1,
      name: `Perfume ${index + 1}`,
      accords: index < count ? [accord] : ["amber"],
    })
  );
}

function deepFreeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    Object.values(value).forEach(deepFreeze);
  }

  return value;
}

describe("buildDnaExplorerModel", () => {
  describe("label helpers", () => {
    it("normalizes accord keys by trimming, lowercasing, and collapsing whitespace", () => {
      expect(normalizeAccordLabel("  Fresh   Spicy  ")).toBe("fresh spicy");
      expect(normalizeAccordLabel("WOODY")).toBe("woody");
      expect(normalizeAccordLabel(null)).toBe("");
      expect(normalizeAccordLabel(0)).toBe("");
    });

    it("formats intelligence labels from camelCase, delimiters, and empty values", () => {
      expect(formatIntelligenceLabel("freshSpicy")).toBe("Fresh Spicy");
      expect(formatIntelligenceLabel("sea-notes")).toBe("Sea Notes");
      expect(formatIntelligenceLabel("warm_spicy")).toBe("Warm Spicy");
      expect(formatIntelligenceLabel(null)).toBe("");
    });
  });

  describe("selection and detail lookup", () => {
    it("builds one detail per visible accord item using normalized keys", () => {
      const accordItems = [
        accordItem("citrus", { count: 3 }),
        accordItem("fresh spicy", { count: 2 }),
      ];
      const selectedPerfumes = [
        perfume({
          id: 11,
          name: "Citrus Lead",
          accords: ["citrus", "aromatic"],
        }),
        perfume({
          id: 12,
          name: "Spice Lead",
          accords: ["fresh spicy", "citrus"],
        }),
      ];

      const index = buildDnaExplorerIndex({ accordItems, selectedPerfumes });

      expect(Object.keys(index)).toEqual(["citrus", "fresh spicy"]);
      expect(index.citrus).toMatchObject({
        accord: "citrus",
        formattedAccord: "Citrus",
        accordItems,
      });
      expect(index["fresh spicy"].formattedAccord).toBe("Fresh Spicy");
    });

    it("selects details by normalized key and returns null for absent selections", () => {
      const detail = { accord: "fresh spicy" };
      const viewModel = {
        dna: {
          accordIndex: {
            "fresh spicy": detail,
          },
        },
      };

      expect(selectDnaExplorerDetail(viewModel, " Fresh   Spicy ")).toBe(detail);
      expect(selectDnaExplorerDetail(viewModel, "amber")).toBeNull();
      expect(selectDnaExplorerDetail(viewModel, "")).toBeNull();
      expect(selectDnaExplorerDetail(undefined, "fresh spicy")).toBeNull();
    });

    it("returns an empty index for the default empty accord item input", () => {
      expect(buildDnaExplorerIndex({})).toEqual({});
    });
  });

  describe("strength thresholds and labels", () => {
    it.each([
      {
        count: 1,
        total: 10,
        level: "Emerging",
        title: "A subtle accent",
        segments: 1,
      },
      {
        count: 2,
        total: 10,
        level: "Present",
        title: "A supporting role",
        segments: 2,
      },
      {
        count: 4,
        total: 10,
        level: "Strong presence",
        title: "A strong influence",
        segments: 4,
      },
      {
        count: 7,
        total: 10,
        level: "Defining",
        title: "A defining pillar",
        segments: 5,
      },
      {
        count: 3,
        total: 5,
        level: "Defining",
        title: "A defining pillar",
        segments: 5,
      },
    ])(
      "classifies $count of $total matching selected perfumes as $level",
      ({ count, total, level, title, segments }) => {
        const detail = buildDetail({
          selectedPerfumes: matchingPerfumes(count, total),
        });

        expect(detail.strength.level).toBe(level);
        expect(detail.strength.title).toBe(title);
        expect(getStrengthSegmentCount(detail.strength.level)).toBe(segments);
      }
    );

    it("uses accord-specific descriptions and a formatted generic fallback", () => {
      expect(
        buildDetail({
          accord: "citrus",
          selectedPerfumes: matchingPerfumes(4, 10, "citrus"),
        }).strength.description
      ).toBe(
        "Citrus is a strong driver here, keeping the collection bright, fresh, and easy to wear."
      );
      expect(
        buildDetail({
          accord: "powdery",
          selectedPerfumes: matchingPerfumes(1, 10, "powdery"),
        }).strength.description
      ).toBe(
        "Powdery gives this collection a emerging powdery thread without needing extra analysis."
      );
      expect(getStrengthSegmentCount("Unknown")).toBe(2);
    });
  });

  describe("contributors", () => {
    it("orders matching selected perfumes by contribution score and keeps source order for ties", () => {
      const selectedPerfumes = [
        perfume({
          id: 11,
          name: "Second Strongest",
          accords: ["aromatic", "citrus"],
          seasons: ["summer"],
          occasions: ["vacation"],
          vibes: ["bright"],
        }),
        perfume({
          id: 12,
          name: "Strongest",
          accords: ["citrus", "aromatic", "fresh spicy"],
          seasons: ["spring", "summer"],
          occasions: ["daily", "office"],
          vibes: ["fresh", "clean"],
        }),
        perfume({
          id: 13,
          name: "First Tie",
          accords: ["citrus"],
        }),
        perfume({
          id: 14,
          name: "Second Tie",
          accords: ["citrus"],
        }),
        perfume({
          id: 15,
          name: "Amber Control",
          accords: ["amber"],
        }),
      ];

      const detail = buildDetail({ selectedPerfumes });

      expect(detail.matchingSelectedPerfumes.map(({ perfume: item }) => item.name)).toEqual([
        "Strongest",
        "Second Strongest",
        "First Tie",
        "Second Tie",
      ]);
      expect(detail.matchingSelectedPerfumes.map(({ contributionScore }) => contributionScore)).toEqual([
        16,
        11.8,
        11,
        11,
      ]);
      expect(detail.mainContributors.map(({ perfume: item }) => item.name)).toEqual([
        "Strongest",
        "Second Strongest",
        "First Tie",
      ]);
    });

    it("exposes wrapper objects with original perfume references and selected indexes", () => {
      const selectedPerfumes = [
        perfume({ id: 11, name: "Original One", accords: ["citrus"] }),
        perfume({ id: 12, name: "Original Two", accords: ["citrus"] }),
      ];

      const detail = buildDetail({ selectedPerfumes });

      expect(detail.matchingSelectedPerfumes[0]).toMatchObject({
        perfume: selectedPerfumes[0],
        index: 0,
        contributionScore: 11,
      });
      expect(detail.matchingSelectedPerfumes[1].perfume).toBe(selectedPerfumes[1]);
    });
  });

  describe("similar accord picks", () => {
    it("excludes selected perfumes, ids without truthy values, and perfumes without the selected accord", () => {
      const selectedPerfumes = [
        perfume({ id: 11, name: "Selected Citrus", accords: ["citrus"] }),
      ];
      const catalogPerfumes = [
        selectedPerfumes[0],
        perfume({ id: 0, name: "Falsy Id Citrus", accords: ["citrus"] }),
        perfume({ id: 12, name: "Amber Only", accords: ["amber"] }),
        perfume({ id: 13, name: "Available Citrus", accords: ["citrus"] }),
      ];

      expect(
        buildDetail({ selectedPerfumes, catalogPerfumes }).similarPicks.map(
          ({ perfume: item }) => item.name
        )
      ).toEqual(["Available Citrus"]);
    });

    it("ranks similar picks by contribution, complements, recommendation boost, tier affinity, and name tie-breaks", () => {
      const selectedPerfumes = [
        perfume({
          id: 11,
          name: "Bronze Citrus",
          accords: ["citrus"],
          seasons: ["spring"],
          occasions: ["daily"],
        }),
        perfume({
          id: 12,
          name: "Bronze Aromatic",
          accords: ["aromatic"],
        }),
      ];
      const catalogPerfumes = [
        ...selectedPerfumes,
        perfume({
          id: 13,
          name: "Zulu Tie Citrus",
          accords: ["citrus"],
          seasons: ["spring"],
          occasions: ["daily"],
        }),
        perfume({
          id: 14,
          name: "Alpha Tie Citrus",
          accords: ["citrus"],
          seasons: ["spring"],
          occasions: ["daily"],
        }),
        perfume({
          id: 105,
          name: "Silver Boost Citrus",
          accords: ["citrus"],
          seasons: ["spring"],
          occasions: ["daily"],
        }),
        perfume({
          id: 205,
          name: "Gold Premium Citrus",
          accords: ["citrus"],
          seasons: ["spring"],
          occasions: ["daily"],
        }),
        perfume({
          id: 15,
          name: "Bronze Deep Citrus",
          accords: ["citrus", "aromatic", "fresh spicy"],
          seasons: ["summer"],
          occasions: ["office"],
          vibes: ["fresh", "clean"],
        }),
        perfume({
          id: 16,
          name: "Bronze Marine Citrus",
          accords: ["citrus", "marine"],
          seasons: ["fall"],
          occasions: ["date"],
        }),
        perfume({
          id: 17,
          name: "Bronze Green Citrus",
          accords: ["citrus", "green"],
          seasons: ["fall"],
          occasions: ["date"],
        }),
      ];

      const detail = buildDetail({
        selectedPerfumes,
        catalogPerfumes,
        recommendations: {
          basedOnYourPicks: [
            { perfume: catalogPerfumes[4], score: 12 },
            { perfume: catalogPerfumes[4], score: 30 },
          ],
          toBalanceYourBox: [{ perfume: catalogPerfumes[5], score: 20 }],
        },
      });

      expect(detail.similarPicks.map(({ perfume: item }) => item.name)).toEqual([
        "Bronze Deep Citrus",
        "Bronze Green Citrus",
        "Bronze Marine Citrus",
        "Silver Boost Citrus",
        "Gold Premium Citrus",
        "Alpha Tie Citrus",
      ]);
      expect(detail.similarPicks.map(({ reason }) => reason)).toEqual([
        "Adds formal versatility",
        "Introduces green contrast",
        "Adds marine freshness",
        "Reinforces citrus character",
        "Premium citrus option",
        "Reinforces citrus character",
      ]);
    });

    it("generates expansion reasons from the first matching benefit branch", () => {
      const selectedPerfumes = [
        perfume({
          id: 11,
          name: "Selected Citrus",
          accords: ["citrus"],
          seasons: ["spring"],
          occasions: ["daily"],
        }),
      ];
      const reasonByName = Object.fromEntries(
        buildDetail({
          selectedPerfumes,
          catalogPerfumes: [
            ...selectedPerfumes,
            perfume({ id: 12, name: "Marine", accords: ["citrus", "marine"] }),
            perfume({ id: 13, name: "Green", accords: ["citrus", "green"] }),
            perfume({ id: 14, name: "Woody", accords: ["citrus", "woody"] }),
            perfume({
              id: 15,
              name: "Formal",
              accords: ["citrus"],
              occasions: ["formal"],
            }),
            perfume({
              id: 16,
              name: "Summer",
              accords: ["citrus"],
              seasons: ["summer"],
            }),
          ],
        }).similarPicks.map(({ perfume: item, reason }) => [item.name, reason])
      );

      expect(reasonByName).toMatchObject({
        Marine: "Adds marine freshness",
        Green: "Introduces green contrast",
        Woody: "Brings woody depth",
        Formal: "Adds formal versatility",
        Summer: "Improves summer coverage",
      });

      const fallbackReasonByName = Object.fromEntries(
        buildDetail({
          selectedPerfumes,
          catalogPerfumes: [
            ...selectedPerfumes,
            perfume({ id: 205, name: "Premium", accords: ["citrus"] }),
            perfume({
              id: 17,
              name: "Reinforce",
              accords: ["citrus"],
              seasons: ["spring"],
              occasions: ["daily"],
            }),
          ],
        }).similarPicks.map(({ perfume: item, reason }) => [item.name, reason])
      );

      expect(fallbackReasonByName).toMatchObject({
        Premium: "Premium citrus option",
        Reinforce: "Reinforces citrus character",
      });
    });

    it("limits similar picks to six items", () => {
      const selectedPerfumes = [perfume({ id: 11, accords: ["citrus"] })];
      const catalogPerfumes = [
        ...selectedPerfumes,
        ...Array.from({ length: 8 }, (_, index) =>
          perfume({
            id: 20 + index,
            name: `Candidate ${index}`,
            accords: ["citrus"],
          })
        ),
      ];

      expect(buildDetail({ selectedPerfumes, catalogPerfumes }).similarPicks).toHaveLength(6);
    });
  });

  describe("supporting metadata helpers", () => {
    it("returns note labels from pyramid notes only in top, middle, base order", () => {
      expect(
        getPerfumeNoteLabels({
          topNotes: ["bergamot", "pinkPepper"],
          middleNotes: ["sea-notes", ""],
          baseNotes: ["tonka_bean"],
          generalNotes: ["ignoredNote"],
        })
      ).toEqual(["Bergamot", "Pink Pepper", "Sea Notes", "Tonka Bean"]);
    });

    it("returns up to three supporting accords after removing the selected accord and exact duplicates", () => {
      expect(
        getSupportingAccords(
          perfume({
            accords: ["citrus", "aromatic", "woody", "aromatic", "fresh spicy", "green"],
          }),
          "CITRUS"
        )
      ).toEqual(["aromatic", "woody", "fresh spicy"]);
    });

    it("characterizes exact-string duplicate behavior for differently cased accord values", () => {
      expect(
        getSupportingAccords(
          perfume({ accords: ["citrus", "Fresh Spicy", "fresh spicy", "green"] }),
          "citrus"
        )
      ).toEqual(["Fresh Spicy", "fresh spicy", "green"]);
    });
  });

  describe("invalid and boundary inputs", () => {
    it("uses catalog, recommendation, and selected id defaults when optional inputs are omitted", () => {
      expect(
        buildDnaExplorerIndex({
          accordItems: [accordItem("amber")],
          selectedPerfumes: [],
        }).amber
      ).toMatchObject({
        accord: "amber",
        formattedAccord: "Amber",
        matchingSelectedPerfumes: [],
        mainContributors: [],
        similarPicks: [],
        strength: {
          level: "Emerging",
          title: "A subtle accent",
          description: "Amber warmth is starting to add richness to the box.",
        },
      });
    });

    it("characterizes invalid non-defaultable top-level inputs as throwing", () => {
      expect(() => buildDnaExplorerIndex({ accordItems: null })).toThrow();
      expect(() =>
        buildDnaExplorerIndex({
          accordItems: [accordItem("citrus")],
          selectedPerfumes: null,
        })
      ).toThrow();
      expect(() =>
        buildDnaExplorerIndex({
          accordItems: [accordItem("citrus")],
          selectedPerfumes: [perfume({ id: 11, accords: ["citrus"] })],
          catalogPerfumes: [perfume({ id: 12, accords: ["citrus"] })],
          selectedPerfumeIds: [],
        })
      ).toThrow();
    });

    it("does not mutate frozen inputs and preserves object references in output", () => {
      const accordItems = deepFreeze([accordItem("citrus")]);
      const selectedPerfumes = deepFreeze([
        perfume({ id: 11, name: "Selected", accords: ["citrus"] }),
      ]);
      const catalogPerfumes = deepFreeze([
        selectedPerfumes[0],
        perfume({ id: 12, name: "Candidate", accords: ["citrus"] }),
      ]);
      const recommendations = deepFreeze({
        basedOnYourPicks: [{ perfume: catalogPerfumes[1], score: 50 }],
        toBalanceYourBox: [],
      });

      const detail = buildDetail({
        accordItems,
        selectedPerfumes,
        catalogPerfumes,
        recommendations,
      });

      expect(detail.accordItems).toBe(accordItems);
      expect(detail.matchingSelectedPerfumes[0].perfume).toBe(selectedPerfumes[0]);
      expect(detail.similarPicks[0].perfume).toBe(catalogPerfumes[1]);
      expect(selectedPerfumes).toHaveLength(1);
      expect(catalogPerfumes).toHaveLength(2);
    });

    it("is deterministic for repeated identical inputs", () => {
      const input = {
        accordItems: [accordItem("citrus"), accordItem("woody")],
        selectedPerfumes: [
          perfume({ id: 11, name: "Selected Citrus", accords: ["citrus"] }),
        ],
        catalogPerfumes: [
          perfume({ id: 12, name: "Alpha", accords: ["citrus"] }),
          perfume({ id: 13, name: "Beta", accords: ["woody"] }),
        ],
        recommendations: {
          basedOnYourPicks: [{ perfume: { id: 12 }, score: 40 }],
          toBalanceYourBox: [{ perfume: { id: 13 }, score: 20 }],
        },
      };

      expect(buildDnaExplorerIndex(input)).toEqual(buildDnaExplorerIndex(input));
    });
  });

  it("covers a realistic golden DNA Explorer workflow", () => {
    const selectedPerfumes = [
      perfume({
        id: 11,
        name: "Acqua Fresh",
        brand: "Maison Test",
        accords: ["citrus", "aromatic", "fresh spicy"],
        seasons: ["spring", "summer"],
        occasions: ["daily", "office"],
        vibes: ["fresh", "clean"],
      }),
      perfume({
        id: 12,
        name: "Cedar Office",
        brand: "Atelier Wood",
        accords: ["woody", "aromatic"],
        seasons: ["fall"],
        occasions: ["office"],
        vibes: ["sophisticated"],
      }),
      perfume({
        id: 13,
        name: "Amber Date",
        brand: "Atelier Warm",
        accords: ["amber", "woody"],
        seasons: ["winter", "fall"],
        occasions: ["date", "night"],
        vibes: ["warm"],
      }),
    ];
    const catalogPerfumes = [
      ...selectedPerfumes,
      perfume({
        id: 106,
        name: "Silver Citrus Lift",
        brand: "Silver House",
        accords: ["citrus", "green"],
        seasons: ["summer"],
        occasions: ["vacation"],
        vibes: ["bright"],
      }),
      perfume({
        id: 207,
        name: "Gold Citrus Evening",
        brand: "Gold House",
        accords: ["citrus"],
        seasons: ["spring"],
        occasions: ["daily"],
      }),
      perfume({
        id: 18,
        name: "Bronze Citrus Woods",
        brand: "Bronze House",
        accords: ["citrus", "woody"],
        seasons: ["spring"],
        occasions: ["daily"],
      }),
    ];
    const accordItems = [
      accordItem("citrus", { count: 1 }),
      accordItem("woody", { count: 2 }),
      accordItem("amber", { count: 1 }),
    ];

    const index = buildDnaExplorerIndex({
      accordItems,
      selectedPerfumes,
      catalogPerfumes,
      selectedPerfumeIds: new Set(selectedPerfumes.map(({ id }) => id)),
      recommendations: {
        basedOnYourPicks: [{ perfume: catalogPerfumes[3], score: 88 }],
        toBalanceYourBox: [{ perfume: catalogPerfumes[5], score: 70 }],
      },
    });

    expect(index).toEqual({
      citrus: {
        accord: "citrus",
        formattedAccord: "Citrus",
        accordItems,
        matchingSelectedPerfumes: [
          {
            perfume: selectedPerfumes[0],
            index: 0,
            contributionScore: 16,
          },
        ],
        strength: {
          level: "Present",
          title: "A supporting role",
          description: "Citrus adds clean lift and daytime clarity to the rotation.",
        },
        mainContributors: [
          {
            perfume: selectedPerfumes[0],
            index: 0,
            contributionScore: 16,
          },
        ],
        similarPicks: [
          {
            perfume: catalogPerfumes[3],
            reason: "Introduces green contrast",
          },
          {
            perfume: catalogPerfumes[5],
            reason: "Brings woody depth",
          },
          {
            perfume: catalogPerfumes[4],
            reason: "Premium citrus option",
          },
        ],
      },
      woody: {
        accord: "woody",
        formattedAccord: "Woody",
        accordItems,
        matchingSelectedPerfumes: [
          {
            perfume: selectedPerfumes[1],
            index: 1,
            contributionScore: 13.8,
          },
          {
            perfume: selectedPerfumes[2],
            index: 2,
            contributionScore: 11.2,
          },
        ],
        strength: {
          level: "Defining",
          title: "A defining pillar",
          description: "Woody depth defines the collection with a grounded, polished signature.",
        },
        mainContributors: [
          {
            perfume: selectedPerfumes[1],
            index: 1,
            contributionScore: 13.8,
          },
          {
            perfume: selectedPerfumes[2],
            index: 2,
            contributionScore: 11.2,
          },
        ],
        similarPicks: [
          {
            perfume: catalogPerfumes[5],
            reason: "Reinforces woody character",
          },
        ],
      },
      amber: {
        accord: "amber",
        formattedAccord: "Amber",
        accordItems,
        matchingSelectedPerfumes: [
          {
            perfume: selectedPerfumes[2],
            index: 2,
            contributionScore: 15,
          },
        ],
        strength: {
          level: "Present",
          title: "A supporting role",
          description: "Amber brings warmth and softness without overwhelming the rotation.",
        },
        mainContributors: [
          {
            perfume: selectedPerfumes[2],
            index: 2,
            contributionScore: 15,
          },
        ],
        similarPicks: [],
      },
    });
  });
});
