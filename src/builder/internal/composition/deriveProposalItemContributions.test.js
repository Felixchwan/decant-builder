import { describe, expect, it } from "vitest";
import { deriveProposalItemContributions } from "./deriveProposalItemContributions.js";

function perfume(id, overrides = {}) {
  return {
    id,
    name: `Perfume ${id}`,
    brand: "Test House",
    points: 1,
    seasons: ["spring"],
    occasions: ["day"],
    vibes: ["fresh"],
    accords: ["citrus"],
    ...overrides,
  };
}

const winterLeather = perfume(1, {
  seasons: ["winter"],
  occasions: ["night"],
  vibes: ["seductive"],
  accords: ["leather", "amber"],
});

const summerFresh = perfume(2, {
  seasons: ["summer"],
  occasions: ["office"],
  vibes: ["fresh"],
  accords: ["citrus", "aquatic"],
});

const officeWoody = perfume(3, {
  seasons: ["fall"],
  occasions: ["office"],
  vibes: ["elegant"],
  accords: ["woody", "citrus"],
});

describe("deriveProposalItemContributions", () => {
  it("marks requested preferences as unique when removal eliminates coverage", () => {
    const result = deriveProposalItemContributions({
      collection: [winterLeather, summerFresh, officeWoody],
      selectedPreferences: {
        preferredSeasons: ["winter"],
        preferredOccasions: ["night"],
        preferredVibes: ["seductive"],
      },
    });

    expect(result.byPerfumeId[winterLeather.id].facts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "preference_match",
          category: "season",
          value: "winter",
          strength: "unique",
        }),
        expect.objectContaining({
          type: "preference_match",
          category: "occasion",
          value: "night",
          strength: "unique",
        }),
        expect.objectContaining({
          type: "preference_match",
          category: "vibe",
          value: "seductive",
          strength: "unique",
        }),
      ])
    );
  });

  it("derives unique and scarce accord facts without over-claiming common accords", () => {
    const result = deriveProposalItemContributions({
      collection: [winterLeather, summerFresh, officeWoody],
      selectedPreferences: {},
    });
    const leatherFacts = result.byPerfumeId[winterLeather.id].facts;
    const citrusFacts = result.byPerfumeId[summerFresh.id].facts;

    expect(leatherFacts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "accord_contribution",
          value: "leather",
          strength: "unique",
        }),
      ])
    );
    expect(citrusFacts).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "accord_contribution",
          value: "citrus",
          strength: "unique",
        }),
      ])
    );
  });

  it("tracks analysis diagnostics without requiring quality evaluation", () => {
    const result = deriveProposalItemContributions({
      collection: [winterLeather, summerFresh],
      selectedPreferences: {},
    });

    expect(result.diagnostics).toMatchObject({
      itemComparisons: 2,
      qualityEvaluationRequired: false,
      reasoningFactsReused: false,
    });
  });
});
