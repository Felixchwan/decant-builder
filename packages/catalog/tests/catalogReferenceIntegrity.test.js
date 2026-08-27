import { execFileSync } from "node:child_process";
import { execPath } from "node:process";
import { describe, expect, it } from "vitest";
import {
  brandAssets,
  fragrances as perfumes,
  metadataAssets,
  notes,
} from "@discovery-box/catalog";
// NOTE_PROMINENCE_BY_ID is deliberately imported from the source file, not
// the public package entry -- it is internal editorial metadata, never
// re-exported through index.js (see catalogPackageBoundary.test.js's locked
// export list). Reading the raw map here, rather than only the merged
// `perfumes[i].noteProminence` field, is what lets this test catch a
// typo'd/orphaned fragrance-id key: an unmatched numeric key in the map
// never gets picked up by fragrances.js's `.map()` merge, so it would
// otherwise be silently dropped instead of failing loudly.
import { NOTE_PROMINENCE_BY_ID } from "../src/fragrances.js";

const METADATA_FIELDS = {
  accords: "accords",
  seasons: "seasons",
  occasions: "occasions",
  vibes: "vibes",
};

// TODO(architecture): this duplicates packages/builder/src/utils/
// noteUtils.js's getPerfumeNoteIds exactly. packages/catalog must never
// import from packages/builder (that would invert the established
// dependency direction -- see ADR-0006), so this stays a small local
// duplicate for now, matching this repo's existing convention of small
// per-module private helpers (e.g. formatLabel) rather than a shared util.
// The canonical fix, if this concept is needed in more than one place
// again, is to promote getPerfumeNoteIds down into packages/catalog/src/
// and have packages/builder import it from there instead of the reverse.
function getPerfumeNoteIds(perfume) {
  return [
    ...(perfume.topNotes || []),
    ...(perfume.middleNotes || []),
    ...(perfume.baseNotes || []),
    ...(perfume.generalNotes || []),
  ];
}

describe("catalog reference integrity", () => {
  it("resolves every note reference through the canonical note dictionary", () => {
    for (const perfume of perfumes) {
      const noteIds = ["topNotes", "middleNotes", "baseNotes", "generalNotes"]
        .flatMap((field) => perfume[field] || []);
      for (const noteId of noteIds) {
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

  // Composer Phase 2B foundation: NOTE_PROMINENCE_BY_ID is sparse and stays
  // that way indefinitely -- these rules only ever validate entries that
  // actually exist. None of them require every fragrance, or every note a
  // scored fragrance carries, to have a prominence value. There is
  // deliberately no coverage-floor assertion anywhere in this file: partial
  // adoption must never fail the suite.
  describe("note prominence metadata", () => {
    const perfumesById = new Map(perfumes.map((perfume) => [perfume.id, perfume]));

    it("references only fragrance IDs that exist in the catalog", () => {
      for (const rawId of Object.keys(NOTE_PROMINENCE_BY_ID)) {
        expect(
          perfumesById.has(Number(rawId)),
          `NOTE_PROMINENCE_BY_ID references unknown fragrance id ${rawId}`
        ).toBe(true);
      }
    });

    it("references only note IDs that exist in the canonical note dictionary", () => {
      for (const [fragranceId, entry] of Object.entries(NOTE_PROMINENCE_BY_ID)) {
        for (const noteId of Object.keys(entry)) {
          expect(
            notes[noteId],
            `Fragrance ${fragranceId} scores unknown note "${noteId}"`
          ).toBeTruthy();
        }
      }
    });

    it("only scores notes that actually belong to that fragrance's own canonical note set", () => {
      for (const [rawId, entry] of Object.entries(NOTE_PROMINENCE_BY_ID)) {
        const fragrance = perfumesById.get(Number(rawId));
        const ownNoteIds = new Set(getPerfumeNoteIds(fragrance));

        for (const noteId of Object.keys(entry)) {
          expect(
            ownNoteIds.has(noteId),
            `Fragrance ${rawId} is scored for "${noteId}", which is not one of its own notes`
          ).toBe(true);
        }
      }
    });

    it("keeps every prominence value an integer from 1 through 10 -- 0 is invalid", () => {
      for (const [rawId, entry] of Object.entries(NOTE_PROMINENCE_BY_ID)) {
        for (const [noteId, value] of Object.entries(entry)) {
          expect(
            Number.isInteger(value) && value >= 1 && value <= 10,
            `Fragrance ${rawId} note "${noteId}" prominence ${value} must be an integer from 1 to 10`
          ).toBe(true);
        }
      }
    });

    it("treats a missing fragrance entry as valid (no editorial data yet), never as an error", () => {
      // As of Composer Phase 2J, every real catalog fragrance has been
      // reviewed at least once, so there is no longer a live example of an
      // unscored fragrance to find (see noteProminenceSeedBatch2J.test.js
      // for the full 87/87 coverage assertion). This test now verifies the
      // underlying mechanism directly instead of relying on a fixture that
      // happened to still be unscored: looking up an id that is not (and
      // could never be) a real fragrance id is valid and never throws, and
      // the merge in fragrances.js falls back to the shared empty object
      // rather than fabricating a score.
      const neverAFragranceId = -1;

      expect(neverAFragranceId in NOTE_PROMINENCE_BY_ID).toBe(false);
      expect(() => NOTE_PROMINENCE_BY_ID[neverAFragranceId]).not.toThrow();
      expect(NOTE_PROMINENCE_BY_ID[neverAFragranceId]).toBeUndefined();
    });

    it("treats a missing note key within a scored fragrance as valid partial coverage, never a fabricated score", () => {
      const [scoredId, scoredEntry] = Object.entries(NOTE_PROMINENCE_BY_ID)[0];
      const scoredFragrance = perfumesById.get(Number(scoredId));
      const ownNoteIds = getPerfumeNoteIds(scoredFragrance);
      const unscoredOwnNoteId = ownNoteIds.find((noteId) => !(noteId in scoredEntry));

      expect(unscoredOwnNoteId, "fixture fragrance has no partially-unscored note to demonstrate with").toBeTruthy();
      expect(scoredFragrance.noteProminence[unscoredOwnNoteId]).toBeUndefined();
    });

    // Non-blocking coverage report. This intentionally has no meaningful
    // pass/fail threshold -- it exists so coverage is visible in test
    // output as the map is populated over time, without ever turning
    // "metadata is incomplete" into a build failure. Do not add a minimum-
    // coverage assertion here.
    it("reports current note-prominence coverage (informational only, never a gate)", () => {
      const scoredFragranceCount = Object.keys(NOTE_PROMINENCE_BY_ID).length;
      const coverageRatio = scoredFragranceCount / perfumes.length;

      console.log(
        `[noteProminence coverage] ${scoredFragranceCount}/${perfumes.length} fragrances ` +
          `(${(coverageRatio * 100).toFixed(1)}%) have at least one editorial prominence score.`
      );

      expect(coverageRatio).toBeGreaterThanOrEqual(0);
      expect(coverageRatio).toBeLessThanOrEqual(1);
    });
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

});
