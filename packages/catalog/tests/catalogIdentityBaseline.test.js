import { describe, expect, it } from "vitest";

import { CATALOG_IDENTITY_BASELINE } from "./catalogIdentityBaseline.fixture.js";
import { fragrances as perfumes } from "@discovery-box/catalog";

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

});
