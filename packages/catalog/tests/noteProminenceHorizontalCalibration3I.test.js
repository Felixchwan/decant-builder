import { describe, expect, it } from "vitest";

import { fragrances as perfumes, notes } from "@discovery-box/catalog";
import { NOTE_PROMINENCE_BY_ID } from "../src/fragrances.js";

// Composer Phase 3I: narrow regression coverage for the ninth horizontal
// note-family calibration pass -- the rose and jasmine canonical-key
// families.
//
// Taxonomy audit (Step 1) -- exact canonical keys found in notes.js:
//   Rose family (2 keys): rose ("Rose", family: "floral"), roseDeMai
//     ("Rose de Mai", family: "floral") -- a real, specifically-named
//     perfumery rose cultivar, kept deliberately distinct (Versace Pour
//     Homme (3) carries roseDeMai, never generic rose).
//   Jasmine family (1 key): jasmine ("Jasmine", family: "floral") -- no
//     "jasmineSambac"/"grandiflorumJasmine" or other qualified variant
//     exists in the taxonomy. Do not invent one.
//   Adjacent keys explicitly excluded (16 keys, real but semantically
//     distinct floral/name-overlap concepts never treated as rose or
//     jasmine substitutes): orangeBlossom, neroli, lilyOfTheValley,
//     violet, violetLeaf, iris, frangipani, magnolia, freesia, hyacinth,
//     cyclamen, mignonette, osmanthus, geranium -- each its own
//     already-established distinct floral canonical key; pomarose -- a
//     real, separately-named captive material, not a literal rose;
//     brazilianRosewood -- a wood, not a flower, despite the "rose" name
//     substring (the same pattern as amberwood's exclusion from amber in
//     Phase 3F); rosemary -- an unrelated aromatic herb sharing only a
//     name substring with rose.
//
// Canonical-data sanity audit (Step 2): every rose-carrying fragrance was
// checked for a case where roseDeMai would be clearly warranted instead
// of generic rose (and vice versa); every jasmine-carrying fragrance was
// checked for a case where a more specific qualified jasmine variant
// would be warranted (none exists in the taxonomy, so no reclassification
// target exists). No mismatch meeting the Phase 3A basil / Phase 3C
// blackVanilla bar was found. No canonical-data correction was made in
// this phase.
//
// Despite 10 rose, 1 roseDeMai, and 14 jasmine fragrance/note pairs, this
// phase's own calibration changes zero individual pairs -- every
// already-scored entry held up as internally consistent, and every
// unscored member's rose or jasmine note sits in a composition whose own
// documented signature clearly lies elsewhere. Per this phase's own
// strict editorial caution, generic floral sweetness/powderiness/
// romantic character was never treated as rose evidence, and generic
// white-floral/clean/soapy/creamy/luminous character was never treated as
// jasmine evidence beyond the explicit canonical note itself.
const ROSE_FAMILY = {
  1: undefined,
  4: undefined,
  9: undefined,
  19: undefined,
  29: undefined,
  101: undefined,
  119: undefined,
  403: undefined,
  405: 4,
  501: undefined,
};

const ROSE_DE_MAI_FAMILY = { 3: undefined };

const JASMINE_FAMILY = {
  1: 5,
  9: undefined,
  12: undefined,
  19: undefined,
  23: 4,
  101: 5,
  102: undefined,
  115: undefined,
  119: undefined,
  404: undefined,
  406: undefined,
  408: undefined,
  409: 5,
};

const ALL_FAMILIES = {
  rose: ROSE_FAMILY,
  roseDeMai: ROSE_DE_MAI_FAMILY,
  jasmine: JASMINE_FAMILY,
};

const ROSE_KEYS = ["rose", "roseDeMai"];
const JASMINE_KEYS = ["jasmine"];

const ADJACENT_EXCLUDED_KEYS = [
  "orangeBlossom",
  "neroli",
  "lilyOfTheValley",
  "violet",
  "violetLeaf",
  "iris",
  "frangipani",
  "magnolia",
  "freesia",
  "hyacinth",
  "cyclamen",
  "mignonette",
  "osmanthus",
  "geranium",
  "pomarose",
  "brazilianRosewood",
  "rosemary",
];

function getPerfumeNoteIds(perfume) {
  return [
    ...(perfume.topNotes || []),
    ...(perfume.middleNotes || []),
    ...(perfume.baseNotes || []),
    ...(perfume.generalNotes || []),
  ];
}

describe("Composer Phase 3I taxonomy audit", () => {
  it("finds exactly these 2 canonical rose-family keys in the note dictionary, with distinct display names", () => {
    expect(notes.rose).toMatchObject({ name: "Rose", family: "floral" });
    expect(notes.roseDeMai).toMatchObject({ name: "Rose de Mai", family: "floral" });
  });

  it("finds exactly 1 true canonical jasmine-family key in the note dictionary -- no qualified variant exists", () => {
    expect(notes.jasmine).toMatchObject({ name: "Jasmine", family: "floral" });
    expect(notes.jasmineSambac).toBeUndefined();
    expect(notes.grandiflorumJasmine).toBeUndefined();
  });

  it("excludes every adjacent material from both families, despite a name substring or perceptual floral overlap", () => {
    for (const noteId of ADJACENT_EXCLUDED_KEYS) {
      expect(notes[noteId], `${noteId} should exist in the taxonomy`).toBeTruthy();
      expect(ROSE_KEYS).not.toContain(noteId);
      expect(JASMINE_KEYS).not.toContain(noteId);
    }
    // pomarose and brazilianRosewood both contain "rose" in their display
    // name/key, yet neither is the canonical rose key -- brazilianRosewood
    // is a wood, not a flower (the same pattern as amberwood's exclusion
    // from amber in Phase 3F), and pomarose is its own separately-named
    // captive material.
    expect(notes.brazilianRosewood.name).toBe("Brazilian Rosewood");
    expect(notes.pomarose.name).toBe("Pomarose");
    expect(notes.rose.name).not.toBe(notes.brazilianRosewood.name);
  });
});

describe("Composer Phase 3I canonical-data sanity audit", () => {
  const perfumesById = new Map(perfumes.map((perfume) => [perfume.id, perfume]));

  it("confirms no canonical-data correction was made or is recommended -- Versace Pour Homme already correctly uses the specific roseDeMai, not generic rose", () => {
    const versacePourHomme = perfumesById.get(3);
    expect(versacePourHomme.topNotes).toContain("roseDeMai");
    expect(versacePourHomme.topNotes).not.toContain("rose");
  });

  it("confirms no fragrance carries both rose and roseDeMai as if they were the same material", () => {
    for (const id of Object.keys(ROSE_FAMILY).map(Number)) {
      const ownNoteIds = getPerfumeNoteIds(perfumesById.get(id));
      expect(ownNoteIds).not.toContain("roseDeMai");
    }
    for (const id of Object.keys(ROSE_DE_MAI_FAMILY).map(Number)) {
      const ownNoteIds = getPerfumeNoteIds(perfumesById.get(id));
      expect(ownNoteIds).not.toContain("rose");
    }
  });
});

describe("Composer Phase 3I horizontal calibration -- rose and jasmine canonical-key families", () => {
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

  it("keeps every calibrated rose/jasmine-family value an integer from 1 to 10", () => {
    for (const family of Object.values(ALL_FAMILIES)) {
      for (const [id, score] of Object.entries(family)) {
        if (score === undefined) continue;
        expect(Number.isInteger(score), `id ${id}`).toBe(true);
        expect(score).toBeGreaterThanOrEqual(1);
        expect(score).toBeLessThanOrEqual(10);
      }
    }
  });

  it("never collapses distinct canonical keys into one another -- rose and roseDeMai stay independent", () => {
    const allTouchedIds = new Set(Object.values(ALL_FAMILIES).flatMap((family) => Object.keys(family).map(Number)));

    for (const id of allTouchedIds) {
      const entry = NOTE_PROMINENCE_BY_ID[id] || {};
      const fragrance = perfumesById.get(id);
      const ownNoteIds = new Set(getPerfumeNoteIds(fragrance));

      for (const key of [...ROSE_KEYS, ...JASMINE_KEYS]) {
        if (key in entry) {
          expect(ownNoteIds.has(key), `${fragrance.name} does not canonically carry "${key}"`).toBe(true);
        }
      }
    }

    for (const id of Object.keys(ROSE_FAMILY).map(Number)) {
      expect(NOTE_PROMINENCE_BY_ID[id]?.roseDeMai).toBeUndefined();
    }
    expect(NOTE_PROMINENCE_BY_ID[3]?.rose).toBeUndefined();
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

  it("changes zero prominence values in this phase -- every rose/roseDeMai/jasmine score above is exactly what the catalog already held before Phase 3I", () => {
    // This test pins that outcome as a regression guard -- if it ever
    // fails, either a later phase intentionally recalibrated one of these
    // exact keys (update this file's fixtures to match, with a comment),
    // or an unrelated change accidentally drifted a rose/jasmine score.
    expect(NOTE_PROMINENCE_BY_ID[405]).toEqual({ iris: 6, grapefruit: 5, rose: 4 });
    expect(NOTE_PROMINENCE_BY_ID[1]).toEqual({ seaNotes: 10, calone: 9, bergamot: 7, jasmine: 5, whiteMusk: 4 });
    expect(NOTE_PROMINENCE_BY_ID[23]).toEqual({ oakmoss: 6, leather: 5, jasmine: 4 });
    expect(NOTE_PROMINENCE_BY_ID[101]).toEqual({ bergamot: 7, jasmine: 5, patchouli: 4 });
    expect(NOTE_PROMINENCE_BY_ID[409]).toEqual({ powderyNotes: 7, juniper: 6, cedar: 6, jasmine: 5, tonkaBean: 4 });
  });

  it("leaves canonical note data completely unchanged in this phase -- no pyramid was edited for any rose/roseDeMai/jasmine member", () => {
    expect(perfumesById.get(3)).toMatchObject({
      name: "Versace Pour Homme",
      topNotes: ["lemon", "bergamot", "neroli", "roseDeMai"],
    });
    expect(perfumesById.get(405)).toMatchObject({
      name: "Mefisto",
      middleNotes: ["lavender", "iris", "rose"],
    });
  });

  it("does not under-score a genuinely defining note in a co-scored composition -- Tuxedo's rose stays unscored beneath its own established, far more dominant patchouli:9 signature", () => {
    expect(NOTE_PROMINENCE_BY_ID[501].patchouli).toBe(9);
    expect(NOTE_PROMINENCE_BY_ID[501].rose).toBeUndefined();
  });

  // The Note Explorer "Most prominent" sort verification for rose,
  // roseDeMai, and jasmine lives in
  // packages/builder/src/builder/internal/intelligence/buildNoteExplorerViewModel.test.js
  // instead of here -- packages/catalog must never import from
  // packages/builder (ADR-0006), and this file already proves the
  // underlying data (membership, scores, containment) that sort depends on.
});
