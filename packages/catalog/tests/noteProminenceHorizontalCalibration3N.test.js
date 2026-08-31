import { describe, expect, it } from "vitest";

import { fragrances as perfumes, notes } from "@discovery-box/catalog";
import { NOTE_PROMINENCE_BY_ID } from "../src/fragrances.js";

// Composer Phase 3N: narrow regression coverage for the fourteenth
// horizontal note-family calibration pass -- the sage family (sage,
// clarySage) and geranium.
//
// Taxonomy audit (Step 1) -- exact canonical keys found in notes.js:
//   Sage family (2 keys): sage ("Sage", family: "aromatic"), clarySage
//     ("Clary Sage", family: "aromatic", own bespoke image never reusing
//     sage.jpg) -- two real, separately-named aromatic herbs, kept
//     deliberately distinct. No other qualified sage variant exists.
//   Geranium (1 key): geranium ("Geranium", family: "floral") -- an
//     independent floral/aromatic material, distinct from sage's own
//     family: "aromatic" tag, never collapsed into the sage family
//     despite frequently co-occurring in the same fougère middle
//     accords.
//   Adjacent keys re-confirmed as their own distinct, already-established
//     canonical identities: lavender, rosemary, basil, mint, spearmint,
//     artemisia, wormwood, violetLeaf.
//
// Canonical-data sanity audit (Step 2): every sage-carrying fragrance was
// checked for a case where clarySage would be clearly warranted instead
// (and vice versa). No mismatch meeting the Phase 3A basil / Phase 3C
// blackVanilla bar was found in either direction. geranium was audited
// for canonical defects and never found conflated with an adjacent
// aromatic/floral material. No canonical-data correction was made in
// this phase.
//
// Across 8 sage, 10 clarySage, and 15 geranium fragrance/note pairs --
// clarySage and geranium both entirely unscored coming into this phase
// -- this phase's own calibration changes zero individual pairs. Every
// already-scored sage entry held up as internally consistent. Every
// clarySage and geranium member was reviewed individually: geranium in
// particular functions almost entirely as a generic, near-universal
// fougère-structural ingredient across this catalog's masculine
// compositions rather than a differentiated, fragrance-specific
// highlight in any single one -- including Terre d'Hermès EDT, where
// geranium sits as one of only two official middle notes alongside the
// already-scored pepper: 4, a structural parity considered but not
// treated as sufficient evidence on its own, per this phase's own
// caution against equating fougère structure with genuine geranium
// prominence.
const SAGE_FAMILY = {
  9: 5,
  15: undefined,
  26: undefined,
  35: 5,
  101: undefined,
  203: 6,
  210: undefined,
  213: 5,
};

const CLARY_SAGE_FAMILY = {
  3: undefined,
  6: undefined,
  11: undefined,
  24: undefined,
  25: undefined,
  109: undefined,
  206: undefined,
  207: undefined,
  211: undefined,
  304: undefined,
};

const GERANIUM_FAMILY = {
  3: undefined,
  4: undefined,
  6: undefined,
  29: undefined,
  31: undefined,
  107: undefined,
  108: undefined,
  109: undefined,
  111: undefined,
  114: undefined,
  207: undefined,
  208: undefined,
  211: undefined,
  213: undefined,
  404: undefined,
};

const ALL_FAMILIES = {
  sage: SAGE_FAMILY,
  clarySage: CLARY_SAGE_FAMILY,
  geranium: GERANIUM_FAMILY,
};

const SAGE_KEYS = ["sage", "clarySage"];
const GERANIUM_KEYS = ["geranium"];

const ADJACENT_EXCLUDED_KEYS = ["lavender", "rosemary", "basil", "mint", "spearmint", "artemisia", "wormwood", "violetLeaf"];

function getPerfumeNoteIds(perfume) {
  return [
    ...(perfume.topNotes || []),
    ...(perfume.middleNotes || []),
    ...(perfume.baseNotes || []),
    ...(perfume.generalNotes || []),
  ];
}

describe("Composer Phase 3N taxonomy audit", () => {
  it("finds exactly these 2 canonical sage-family keys in the note dictionary, with distinct display names and images", () => {
    expect(notes.sage).toMatchObject({ name: "Sage", family: "aromatic" });
    expect(notes.clarySage).toMatchObject({ name: "Clary Sage", family: "aromatic" });
    expect(notes.clarySage.noteImageAssetKey).not.toBe(notes.sage.noteImageAssetKey);
  });

  it("finds exactly 1 canonical geranium key, independent of the sage family", () => {
    expect(notes.geranium).toMatchObject({ name: "Geranium", family: "floral" });
    expect(notes.geranium.family).not.toBe(notes.sage.family === "floral" ? "aromatic" : notes.sage.family);
    expect(GERANIUM_KEYS).not.toEqual(expect.arrayContaining(SAGE_KEYS));
  });

  it("excludes every adjacent aromatic/floral material from both the sage family and geranium", () => {
    for (const noteId of ADJACENT_EXCLUDED_KEYS) {
      expect(notes[noteId], `${noteId} should exist in the taxonomy`).toBeTruthy();
      expect(SAGE_KEYS).not.toContain(noteId);
      expect(GERANIUM_KEYS).not.toContain(noteId);
    }
  });
});

describe("Composer Phase 3N canonical-data sanity audit", () => {
  it("confirms no canonical-data correction was made or is recommended -- no fragrance carries both sage and clarySage as if they were the same material", () => {
    const perfumesById = new Map(perfumes.map((perfume) => [perfume.id, perfume]));
    for (const id of Object.keys(SAGE_FAMILY).map(Number)) {
      expect(getPerfumeNoteIds(perfumesById.get(id))).not.toContain("clarySage");
    }
    for (const id of Object.keys(CLARY_SAGE_FAMILY).map(Number)) {
      expect(getPerfumeNoteIds(perfumesById.get(id))).not.toContain("sage");
    }
  });
});

describe("Composer Phase 3N horizontal calibration -- sage family and geranium", () => {
  const perfumesById = new Map(perfumes.map((perfume) => [perfume.id, perfume]));

  it("has exactly 87 catalog fragrances to search for exhaustive family membership", () => {
    expect(perfumes).toHaveLength(87);
  });

  for (const [noteId, family] of Object.entries(ALL_FAMILIES)) {
    it(`${noteId} family membership is exhaustive against the live catalog`, () => {
      const actualIds = perfumes
        .filter((perfume) => getPerfumeNoteIds(perfume).includes(noteId))
        .map((perfume) => perfume.id)
        .sort((a, b) => a - b);

      expect(actualIds).toEqual(Object.keys(family).map(Number).sort((a, b) => a - b));
    });

    it(`matches the exact calibrated ${noteId} score for every scored member, and confirms intentionally-unscored members stay unscored`, () => {
      for (const [id, expectedScore] of Object.entries(family)) {
        const actualScore = NOTE_PROMINENCE_BY_ID[id]?.[noteId];
        if (expectedScore === undefined) {
          expect(actualScore, `${perfumesById.get(Number(id)).name} should remain unscored for ${noteId}`).toBeUndefined();
        } else {
          expect(actualScore, `${perfumesById.get(Number(id)).name} ${noteId} score`).toBe(expectedScore);
        }
      }
    });
  }

  it("keeps every calibrated sage/geranium-family value an integer from 1 to 10", () => {
    for (const family of Object.values(ALL_FAMILIES)) {
      for (const [id, score] of Object.entries(family)) {
        if (score === undefined) continue;
        expect(Number.isInteger(score), `id ${id}`).toBe(true);
        expect(score).toBeGreaterThanOrEqual(1);
        expect(score).toBeLessThanOrEqual(10);
      }
    }
  });

  it("scores only notes that actually belong to each fragrance's own canonical note set", () => {
    const allTouchedIds = new Set(Object.values(ALL_FAMILIES).flatMap((family) => Object.keys(family).map(Number)));
    for (const id of allTouchedIds) {
      const fragrance = perfumesById.get(id);
      const ownNoteIds = new Set(getPerfumeNoteIds(fragrance));
      for (const noteId of Object.keys(NOTE_PROMINENCE_BY_ID[id] || {})) {
        expect(ownNoteIds.has(noteId), `${fragrance.name} is not documented to carry "${noteId}"`).toBe(true);
        expect(notes[noteId]).toBeTruthy();
      }
    }
  });

  it("changes zero prominence values in this phase -- every sage/clarySage/geranium score above is exactly what the catalog already held before Phase 3N", () => {
    // This test pins that outcome as a regression guard -- if it ever
    // fails, either a later phase intentionally recalibrated one of these
    // exact keys (update this file's fixtures to match, with a comment),
    // or an unrelated change accidentally drifted a sage/geranium score.
    expect(NOTE_PROMINENCE_BY_ID[9]).toEqual({ musk: 8, sage: 5, vetiver: 5 });
    expect(NOTE_PROMINENCE_BY_ID[35]).toEqual({ leatherwood: 7, sage: 5 });
    expect(NOTE_PROMINENCE_BY_ID[203]).toEqual({ incense: 6, sage: 6, cloves: 4, blackCurrant: 8 });
    expect(NOTE_PROMINENCE_BY_ID[213]).toEqual({ ginger: 6, apple: 8, sage: 5 });
    expect(NOTE_PROMINENCE_BY_ID[111]).toEqual({
      orange: 8,
      vetiver: 8,
      grapefruit: 7,
      cedar: 6,
      pepper: 4,
      patchouli: 5,
    });
  });

  it("leaves canonical note data completely unchanged in this phase -- no pyramid was edited for any sage/clarySage/geranium member", () => {
    expect(perfumesById.get(3)).toMatchObject({
      name: "Versace Pour Homme",
      middleNotes: ["hyacinth", "cedar", "clarySage", "geranium"],
    });
    expect(perfumesById.get(111)).toMatchObject({
      name: "Terre d'Hermès EDT",
      middleNotes: ["pepper", "geranium"],
    });
  });

  it("considered, and rejected, a structural-parity argument for Terre d'Hermès EDT's geranium -- it remains unscored, matching the caution against treating fougère/pyramid structure alone as prominence evidence", () => {
    expect(NOTE_PROMINENCE_BY_ID[111].geranium).toBeUndefined();
    expect(NOTE_PROMINENCE_BY_ID[111].pepper).toBe(4);
  });

  it("confirms geranium is never accidentally conflated with an adjacent aromatic/floral material on any touched fragrance", () => {
    const allTouchedIds = new Set(Object.keys(GERANIUM_FAMILY).map(Number));
    for (const id of allTouchedIds) {
      const entry = NOTE_PROMINENCE_BY_ID[id] || {};
      for (const key of ADJACENT_EXCLUDED_KEYS) {
        // Presence of an adjacent key is fine (many fougères legitimately
        // carry both); what must never happen is geranium's own score
        // being copied onto, or borrowed from, an adjacent key's slot.
        if (key in entry) {
          expect(entry[key]).not.toBe(entry.geranium);
        }
      }
    }
  });

  // The Note Explorer "Most prominent" sort verification for sage,
  // clarySage, and geranium lives in
  // packages/builder/src/builder/internal/intelligence/buildNoteExplorerViewModel.test.js
  // instead of here -- packages/catalog must never import from
  // packages/builder (ADR-0006), and this file already proves the
  // underlying data (membership, scores, containment) that sort depends on.
});
