import { describe, expect, it } from "vitest";

import { fragrances as perfumes, notes } from "@discovery-box/catalog";
import { NOTE_PROMINENCE_BY_ID } from "../src/fragrances.js";

// Composer Phase 3P: narrow regression coverage for the sixteenth
// horizontal note-family calibration pass -- the violet family (violet,
// violetLeaf).
//
// Taxonomy audit (Step 1) -- exact canonical keys found in notes.js:
//   violet ("Violet", family: "floral") -- the flower/powdery-floral
//     material.
//   violetLeaf ("Violet Leaf", no family tag) -- the green/leaf
//     material.
//   Kept materially distinct despite a shared botanical source; no other
//     qualified violet variant exists in the taxonomy.
//   Adjacent keys re-confirmed as their own distinct, already-
//     established canonical identities: iris, powderyNotes, rose,
//     roseDeMai, geranium, lilyOfTheValley, cyclamen, hyacinth, freesia,
//     osmanthus.
//
// Canonical-data sanity audit (Step 2): every violet- and violetLeaf-
// carrying fragrance was checked for a case where the other exact key
// would be clearly warranted instead. No mismatch meeting the Phase 3A
// basil / Phase 3C blackVanilla bar was found in either direction. Acqua
// di Gio Elixir's own accords list includes a "violet" tag despite its
// canonical note being the distinct violetLeaf -- this generic accord-
// level classification was considered and rejected as evidence, per the
// same discipline established for woodyNotes in Phase 3O. No fragrance
// carries both violet and violetLeaf simultaneously. No canonical-data
// correction was made in this phase.
//
// Across 4 violet and 8 violetLeaf fragrance/note pairs -- both entirely
// unscored coming into this phase -- this phase's own calibration
// changes zero individual pairs. Every member was reviewed individually:
// Prada L'Homme's violet sits beside its own established, extensively-
// documented iris: 9 signature, and per this phase's own caution against
// equating iris-like softness with violet prominence, was left unscored
// rather than assumed to share iris's defining status.
const VIOLET_FAMILY = {
  1: undefined,
  12: undefined,
  208: undefined,
  404: undefined,
};

const VIOLET_LEAF_FAMILY = {
  14: undefined,
  17: undefined,
  23: undefined,
  27: undefined,
  117: undefined,
  210: undefined,
  306: undefined,
  501: undefined,
};

const ALL_FAMILIES = {
  violet: VIOLET_FAMILY,
  violetLeaf: VIOLET_LEAF_FAMILY,
};

const VIOLET_KEYS = ["violet", "violetLeaf"];

const ADJACENT_EXCLUDED_KEYS = [
  "iris",
  "powderyNotes",
  "rose",
  "roseDeMai",
  "geranium",
  "lilyOfTheValley",
  "cyclamen",
  "hyacinth",
  "freesia",
  "osmanthus",
];

function getPerfumeNoteIds(perfume) {
  return [
    ...(perfume.topNotes || []),
    ...(perfume.middleNotes || []),
    ...(perfume.baseNotes || []),
    ...(perfume.generalNotes || []),
  ];
}

describe("Composer Phase 3P taxonomy audit", () => {
  it("finds exactly these 2 canonical violet-family keys in the note dictionary, with distinct display names", () => {
    expect(notes.violet).toMatchObject({ name: "Violet", family: "floral" });
    expect(notes.violetLeaf).toMatchObject({ name: "Violet Leaf" });
    expect(notes.violetLeaf.noteImageAssetKey).not.toBe(notes.violet.noteImageAssetKey);
  });

  it("excludes every adjacent floral/green material from both exact keys", () => {
    for (const noteId of ADJACENT_EXCLUDED_KEYS) {
      expect(notes[noteId], `${noteId} should exist in the taxonomy`).toBeTruthy();
      expect(VIOLET_KEYS).not.toContain(noteId);
    }
  });

  it("confirms no additional qualified violet variant was invented", () => {
    expect(notes.violetAbsolute).toBeUndefined();
    expect(notes.parmaVioletta).toBeUndefined();
  });
});

describe("Composer Phase 3P canonical-data sanity audit", () => {
  const perfumesById = new Map(perfumes.map((perfume) => [perfume.id, perfume]));

  it("confirms no fragrance carries both violet and violetLeaf simultaneously", () => {
    for (const id of Object.keys(VIOLET_FAMILY).map(Number)) {
      expect(getPerfumeNoteIds(perfumesById.get(id))).not.toContain("violetLeaf");
    }
    for (const id of Object.keys(VIOLET_LEAF_FAMILY).map(Number)) {
      expect(getPerfumeNoteIds(perfumesById.get(id))).not.toContain("violet");
    }
  });

  it("considered, and rejected, Acqua di Gio Elixir's 'violet' accord tag as evidence for renaming its canonical violetLeaf note -- an accord is a genre-level signal, not the specific ingredient identity the correction bar requires", () => {
    const acquaDiGioElixir = perfumesById.get(306);
    expect(acquaDiGioElixir.accords).toContain("violet");
    expect(acquaDiGioElixir.middleNotes).toContain("violetLeaf");
    expect(acquaDiGioElixir.middleNotes).not.toContain("violet");
  });
});

describe("Composer Phase 3P horizontal calibration -- the violet family", () => {
  const perfumesById = new Map(perfumes.map((perfume) => [perfume.id, perfume]));

  it("has exactly 88 catalog fragrances to search for exhaustive family membership", () => {
    expect(perfumes).toHaveLength(88);
  });

  for (const [noteId, family] of Object.entries(ALL_FAMILIES)) {
    it(`${noteId} family membership is exhaustive against the live catalog`, () => {
      const actualIds = perfumes
        .filter((perfume) => getPerfumeNoteIds(perfume).includes(noteId))
        .map((perfume) => perfume.id)
        .sort((a, b) => a - b);

      expect(actualIds).toEqual(Object.keys(family).map(Number).sort((a, b) => a - b));
    });

    it(`matches the exact calibrated ${noteId} score for every scored member, and confirms every member remains intentionally unscored`, () => {
      for (const [id, expectedScore] of Object.entries(family)) {
        const actualScore = NOTE_PROMINENCE_BY_ID[id]?.[noteId];
        expect(expectedScore).toBeUndefined();
        expect(actualScore, `${perfumesById.get(Number(id)).name} should remain unscored for ${noteId}`).toBeUndefined();
      }
    });
  }

  it("never collapses violet and violetLeaf into one another -- exact-key containment is fully independent", () => {
    const allTouchedIds = new Set(Object.values(ALL_FAMILIES).flatMap((family) => Object.keys(family).map(Number)));

    for (const id of allTouchedIds) {
      const entry = NOTE_PROMINENCE_BY_ID[id] || {};
      const fragrance = perfumesById.get(id);
      const ownNoteIds = new Set(getPerfumeNoteIds(fragrance));

      for (const key of VIOLET_KEYS) {
        if (key in entry) {
          expect(ownNoteIds.has(key), `${fragrance.name} does not canonically carry "${key}"`).toBe(true);
        }
      }
    }

    for (const id of Object.keys(VIOLET_FAMILY).map(Number)) {
      expect(NOTE_PROMINENCE_BY_ID[id]?.violetLeaf).toBeUndefined();
    }
    for (const id of Object.keys(VIOLET_LEAF_FAMILY).map(Number)) {
      expect(NOTE_PROMINENCE_BY_ID[id]?.violet).toBeUndefined();
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

  it("leaves every unrelated prominence value on all 12 touched fragrances exactly as it was -- this phase changes zero scores", () => {
    expect(NOTE_PROMINENCE_BY_ID[1]).toEqual({ seaNotes: 10, calone: 9, bergamot: 7, jasmine: 5, whiteMusk: 4 });
    expect(NOTE_PROMINENCE_BY_ID[208]).toEqual({ iris: 9, neroli: 6, amber: 5, carrotSeeds: 3 });
    expect(NOTE_PROMINENCE_BY_ID[404]).toEqual({
      apple: 9,
      lavender: 9,
      vanilla: 7,
      cardamom: 4,
      coumarin: 4,
    });
    expect(NOTE_PROMINENCE_BY_ID[501]).toEqual({ patchouli: 9, bourbonVanilla: 5 });
    expect(NOTE_PROMINENCE_BY_ID[306]).toEqual({ seaNotes: 6, patchouli: 7, leather: 5, vetiver: 4 });
  });

  it("leaves canonical note data completely unchanged in this phase -- no pyramid was edited for any violet/violetLeaf member", () => {
    expect(perfumesById.get(208)).toMatchObject({
      name: "Prada L'Homme",
      middleNotes: ["iris", "violet", "geranium"],
    });
    expect(perfumesById.get(306)).toMatchObject({
      name: "Acqua di Gio Elixir",
      middleNotes: ["violetLeaf", "seaNotes", "lavender"],
    });
  });

  it("does not assume violet shares iris's defining status merely for coexisting with it -- Prada L'Homme's violet stays unscored beside its own established iris:9", () => {
    expect(NOTE_PROMINENCE_BY_ID[208].iris).toBe(9);
    expect(NOTE_PROMINENCE_BY_ID[208].violet).toBeUndefined();
  });

  // The Note Explorer "Most prominent" sort verification for violet and
  // violetLeaf lives in
  // packages/builder/src/builder/internal/intelligence/buildNoteExplorerViewModel.test.js
  // instead of here -- packages/catalog must never import from
  // packages/builder (ADR-0006), and this file already proves the
  // underlying data (membership, scores, containment) that sort depends on.
});
