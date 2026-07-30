import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { execPath } from "node:process";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { buildCatalogView } from "../builder/internal/catalog/buildCatalogView.js";
import { getPerfumeNoteIds } from "../utils/noteUtils.js";
import { getBrandAsset } from "./brandAssets.js";
import { getMetadataAsset } from "./metadataAssets.js";
import { notes } from "./notes.js";
import { perfumes } from "./perfumes.js";

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
      expect(getBrandAsset(perfume.brand), `${perfume.id} has no brand asset`).toMatch(
        /^\/images\/brands\/.+\.png$/
      );
    }
  });

  it("has no dangling accord, season, occasion, or vibe metadata", () => {
    for (const perfume of perfumes) {
      for (const [field, type] of Object.entries(METADATA_FIELDS)) {
        for (const value of perfume[field]) {
          expect(
            getMetadataAsset(type, value),
            `${perfume.id} ${field} references missing metadata ${value}`
          ).toMatch(/^\/images\/metadata\/.+\.svg$/);
        }
      }
    }
  });

  it("allows multiple logical records to share canonical asset paths", () => {
    expect(Object.values(notes).length).toBeGreaterThan(
      new Set(Object.values(notes).map(({ noteImage }) => noteImage).filter(Boolean)).size
    );
  });

  it("imports all data modules in plain Node shape without browser or Vite dependencies", async () => {
    expect(globalThis.window).toBeUndefined();
    expect(globalThis.document).toBeUndefined();

    const moduleUrls = ["perfumes.js", "notes.js", "brandAssets.js", "metadataAssets.js"]
      .map((filename) => new URL(filename, import.meta.url).href);
    const output = execFileSync(
      execPath,
      ["--input-type=module", "--eval", `await Promise.all(${JSON.stringify(moduleUrls)}.map((url) => import(url))); console.log("safe");`],
      { encoding: "utf8" }
    );
    expect(output.trim()).toBe("safe");

    for (const filename of ["perfumes.js", "notes.js", "brandAssets.js", "metadataAssets.js"]) {
      const source = readFileSync(fileURLToPath(new URL(filename, import.meta.url)), "utf8");
      expect(source).not.toContain("import.meta.env");
      expect(source).not.toMatch(/\b(?:window|document|localStorage|navigator)\b/);
    }
  });

  it("keeps canonical order stable through the unfiltered catalog view", () => {
    const result = buildCatalogView({ catalog: perfumes, notes });
    expect(result.visiblePerfumes.map(({ id }) => id)).toEqual(perfumes.map(({ id }) => id));
  });
});
