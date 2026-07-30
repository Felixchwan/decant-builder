import { execFileSync } from "node:child_process";
import { execPath } from "node:process";
import { describe, expect, it } from "vitest";
import {
  brandAssets,
  fragrances as perfumes,
  metadataAssets,
  notes,
} from "@discovery-box/catalog";

import { buildCatalogView } from "../builder/internal/catalog/buildCatalogView.js";
import { getPerfumeNoteIds } from "../utils/noteUtils.js";

const METADATA_FIELDS = {
  accords: "accords",
  seasons: "seasons",
  occasions: "occasions",
  vibes: "vibes",
};

describe("catalog reference integrity", () => {
  it("resolves every note reference through the canonical note dictionary", () => {
    for (const perfume of perfumes) {
      for (const noteId of getPerfumeNoteIds(perfume)) {
        expect(notes[noteId], `${perfume.id} references missing note ${noteId}`).toBeTruthy();
      }
    }
  });

  it("resolves every current fragrance brand through current brand behavior", () => {
    for (const perfume of perfumes) {
      expect(brandAssets[perfume.brand], `${perfume.id} has no brand asset`).toMatch(
        /^brands\/.+\.png$/
      );
    }
  });

  it("has no dangling accord, season, occasion, or vibe metadata", () => {
    for (const perfume of perfumes) {
      for (const [field, type] of Object.entries(METADATA_FIELDS)) {
        for (const value of perfume[field]) {
          expect(
            metadataAssets[type]?.[value],
            `${perfume.id} ${field} references missing metadata ${value}`
          ).toMatch(/^metadata\/.+\.svg$/);
        }
      }
    }
  });

  it("allows multiple logical records to share canonical asset paths", () => {
    expect(Object.values(notes).length).toBeGreaterThan(
      new Set(Object.values(notes).map(({ noteImageAssetKey }) => noteImageAssetKey).filter(Boolean)).size
    );
  });

  it("imports the package entry in plain Node without browser or Vite dependencies", () => {
    expect(globalThis.window).toBeUndefined();
    expect(globalThis.document).toBeUndefined();

    const output = execFileSync(
      execPath,
      ["--input-type=module", "--eval", `await import("@discovery-box/catalog"); console.log("safe");`],
      { encoding: "utf8" }
    );
    expect(output.trim()).toBe("safe");
  });

  it("keeps canonical order stable through the unfiltered catalog view", () => {
    const result = buildCatalogView({ catalog: perfumes, notes });
    expect(result.visiblePerfumes.map(({ id }) => id)).toEqual(perfumes.map(({ id }) => id));
  });
});
