import { describe, expect, it } from "vitest";

import { buildCatalogView } from "../builder/internal/catalog/buildCatalogView.js";
import { buildCollectionSummary } from "../builder/internal/intelligence/buildCollectionSummary.js";
import { buildComposerRecommendations } from "../builder/internal/recommendations/buildComposerRecommendations.js";
import { discoveryDecantsConfig } from "../builder/config/discoveryDecantsConfig.js";
import { getTierData } from "../utils/tierUtils.js";
import { CATALOG_IDENTITY_BASELINE } from "./catalogIdentityBaseline.fixture.js";
import { fragrances as perfumes, notes } from "@discovery-box/catalog";

const SUPPORTED_SEASONS = ["spring", "summer", "fall", "winter"];
describe("catalog identity baseline", () => {
  it("freezes the exact 84-record ID order", () => {
    expect(perfumes).toHaveLength(84);
    expect(perfumes.map(({ id }) => id)).toEqual(
      CATALOG_IDENTITY_BASELINE.map(([id]) => id)
    );
    expect(perfumes.every(({ id }) => typeof id === "number" && Number.isFinite(id))).toBe(true);
    expect(new Set(perfumes.map(({ id }) => id)).size).toBe(perfumes.length);
  });

  it("freezes tier inference and points for every current ID", () => {
    expect(
      perfumes.map(({ id, points }) => [id, getTierData(id).name, points])
    ).toEqual(CATALOG_IDENTITY_BASELINE);
    expect(new Set(perfumes.map(({ points }) => points))).toEqual(
      new Set([1, 1.5, 2, 2.5, 4, 4.5, 5])
    );
  });

  it("preserves decimal point totals and derives money from merchant pointValue", () => {
    const selectedPerfumes = [
      perfumes.find(({ id }) => id === 100),
      perfumes.find(({ id }) => id === 301),
      perfumes.find(({ id }) => id === 403),
    ];
    const config = {
      ...discoveryDecantsConfig,
      commerce: { ...discoveryDecantsConfig.commerce, pointValue: 37 },
    };
    const summary = buildCollectionSummary({ selectedPerfumes, catalog: perfumes, notes, config });

    expect(summary.points.total).toBe(8.5);
    expect(summary.money).toMatchObject({ pointValue: 37, total: 314.5 });
  });

  it("validates the record shapes used by catalog and recommendation logic", () => {
    for (const perfume of perfumes) {
      expect(perfume).toEqual(expect.objectContaining({
        id: expect.any(Number),
        name: expect.any(String),
        shortName: expect.any(String),
        brand: expect.any(String),
        imageAssetKey: expect.stringMatching(/^perfumes\/.+\.(?:png|avif)$/),
        points: expect.any(Number),
        accords: expect.any(Array),
        seasons: expect.any(Array),
        occasions: expect.any(Array),
        vibes: expect.any(Array),
        seasonWeights: expect.any(Object),
      }));
      expect(perfume.name.trim()).not.toBe("");
      expect(perfume.shortName.trim()).not.toBe("");
      expect(perfume.brand.trim()).not.toBe("");
      expect(Number.isFinite(perfume.points) && perfume.points > 0).toBe(true);
      expect(Object.keys(perfume.seasonWeights).sort()).toEqual([...SUPPORTED_SEASONS].sort());
      expect(Object.values(perfume.seasonWeights).every(
        (value) => Number.isFinite(value) && value >= 0 && value <= 10
      )).toBe(true);
      expect(perfume.seasons.every((season) => SUPPORTED_SEASONS.includes(season))).toBe(true);
      expect(
        ["topNotes", "middleNotes", "baseNotes", "generalNotes"]
          .filter((field) => field in perfume)
          .every((field) => Array.isArray(perfume[field]))
      ).toBe(true);
      for (const field of ["subtitle", "subtitleColor", "warningMessage"]) {
        if (field in perfume) expect(typeof perfume[field]).toBe("string");
      }
      if ("subtitleGlow" in perfume) expect(typeof perfume.subtitleGlow).toBe("boolean");
    }
  });

  it("does not mutate canonical records during representative read operations", () => {
    const beforePerfumes = JSON.stringify(perfumes);
    const beforeNotes = JSON.stringify(notes);
    const selectedPerfumes = perfumes.slice(0, 3);

    buildCatalogView({ catalog: perfumes, notes, searchQuery: "fresh", sortOption: "tier" });
    buildCollectionSummary({
      selectedPerfumes,
      catalog: perfumes,
      notes,
      config: discoveryDecantsConfig,
    });
    buildComposerRecommendations({
      perfumes,
      selectedPerfumes,
      notes,
      config: discoveryDecantsConfig,
      limit: 1,
    });

    expect(JSON.stringify(perfumes)).toBe(beforePerfumes);
    expect(JSON.stringify(notes)).toBe(beforeNotes);
  });
});
