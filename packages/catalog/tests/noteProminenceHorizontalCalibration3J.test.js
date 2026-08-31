import { describe, expect, it } from "vitest";

import { fragrances as perfumes, notes } from "@discovery-box/catalog";
import { NOTE_PROMINENCE_BY_ID } from "../src/fragrances.js";

// Composer Phase 3J: narrow regression coverage for the tenth horizontal
// note-family calibration pass -- the tonka bean and lavender canonical-
// key families.
//
// Taxonomy audit (Step 1) -- exact canonical keys found in notes.js:
//   Tonka family (1 key): tonkaBean ("Tonka Bean", family: "sweet") -- no
//     qualified tonka variant exists in the taxonomy. Do not invent one.
//   Lavender family (1 key): lavender ("Lavender", family: "aromatic") --
//     no qualified lavender variant exists either.
//   Adjacent keys explicitly excluded (15 keys, real but semantically
//     distinct sweet/aromatic materials never treated as tonka or
//     lavender substitutes): coumarin, vanilla, bourbonVanilla,
//     blackVanilla, madagascarVanilla, almond, anise, amaretto, starAnise
//     (all family: "sweet"/"spicy" or unrelated to lavender's "aromatic"
//     tag); sage, rosemary, clarySage, basil, mint, spearmint (each
//     shares lavender's own family: "aromatic" tag, yet each remains its
//     own distinct, independently-named herb, never a lavender variant --
//     the taxonomy's family grouping is a discovery grouping, not a
//     ranking or aliasing identity).
//
// Canonical-data sanity audit (Step 2): every tonkaBean-carrying
// fragrance was checked for a case where a qualified tonka variant would
// be warranted, and every lavender-carrying fragrance was checked for a
// case where a qualified lavender variant would be warranted. Neither
// exists in the taxonomy, so no reclassification target exists in either
// direction. No mismatch meeting the Phase 3A basil / Phase 3C
// blackVanilla bar was found. No canonical-data correction was made in
// this phase.
//
// Across 22 tonkaBean and 29 lavender fragrance/note pairs, the approved
// calibration changes exactly 1 score:
//   404 Layton -- lavender: 8 -> 9, tied with the fragrance's own
//       apple: 9. Layton is widely and specifically documented (by its
//       own maker, Parfums de Marly, and throughout perfume criticism) as
//       an apple-AND-lavender dual signature, not an apple fragrance with
//       lavender as a secondary support -- exactly the case this phase's
//       own editorial caution anticipated: a truly structural,
//       signature-level lavender must not be under-scored merely because
//       another note is also prominent.
// Every other already-scored entry across both families -- including the
// explicit comparison anchors Armani Code EDT (tonkaBean: 9, correctly
// dominant), Le Male (lavender: 9, tonkaBean: 5), Le Male Le Parfum
// (lavender: 6), La Nuit de L'Homme (lavender: 5, correctly secondary to
// cardamom: 9), Eros Flame (tonkaBean: 5), F by Ferragamo Black
// (lavender: 7, tonkaBean: 5), Legend EDT (lavender: 7, tonkaBean: 6),
// and Gentleman EDP (both unscored, correctly deferring to its own
// established iris: 8) -- held up as internally consistent on individual
// review. The Most Wanted was checked and confirmed not a member of
// either family.
const TONKA_BEAN_FAMILY = {
  3: undefined,
  4: 6,
  5: 5,
  10: 6,
  11: 6,
  15: 4,
  16: 6,
  20: 5,
  21: undefined,
  24: 4,
  27: undefined,
  29: 5,
  104: 9,
  112: 5,
  116: 5,
  117: 5,
  203: undefined,
  205: undefined,
  213: undefined,
  304: 6,
  403: 5,
  409: 4,
};

const LAVENDER_FAMILY = {
  4: 7,
  5: 9,
  7: undefined,
  14: undefined,
  20: 7,
  21: undefined,
  22: undefined,
  31: undefined,
  32: undefined,
  33: undefined,
  34: undefined,
  104: 6,
  106: undefined,
  107: undefined,
  108: undefined,
  113: 6,
  114: undefined,
  116: undefined,
  118: 5,
  202: undefined,
  205: undefined,
  206: undefined,
  211: undefined,
  212: undefined,
  306: undefined,
  402: undefined,
  404: 9,
  405: undefined,
  408: undefined,
};

const ALL_FAMILIES = {
  tonkaBean: TONKA_BEAN_FAMILY,
  lavender: LAVENDER_FAMILY,
};

const TONKA_KEYS = ["tonkaBean"];
const LAVENDER_KEYS = ["lavender"];

const ADJACENT_EXCLUDED_KEYS = [
  "coumarin",
  "vanilla",
  "bourbonVanilla",
  "blackVanilla",
  "madagascarVanilla",
  "almond",
  "anise",
  "amaretto",
  "starAnise",
  "sage",
  "rosemary",
  "clarySage",
  "basil",
  "mint",
  "spearmint",
];

// The exact, unrelated prominence values on the one touched fragrance,
// pinned so this phase is provably scoped to only the 1 approved change
// above.
const UNRELATED_VALUES_BY_ID = {
  404: { apple: 9, vanilla: 7, cardamom: 4, coumarin: 4 },
};

function getPerfumeNoteIds(perfume) {
  return [
    ...(perfume.topNotes || []),
    ...(perfume.middleNotes || []),
    ...(perfume.baseNotes || []),
    ...(perfume.generalNotes || []),
  ];
}

describe("Composer Phase 3J taxonomy audit", () => {
  it("finds exactly 1 true canonical tonka-family key in the note dictionary -- no qualified variant exists", () => {
    expect(notes.tonkaBean).toMatchObject({ name: "Tonka Bean", family: "sweet" });
  });

  it("finds exactly 1 true canonical lavender-family key in the note dictionary -- no qualified variant exists", () => {
    expect(notes.lavender).toMatchObject({ name: "Lavender", family: "aromatic" });
  });

  it("excludes every adjacent material from both families, including several that share lavender's own family: \"aromatic\" tag", () => {
    for (const noteId of ADJACENT_EXCLUDED_KEYS) {
      expect(notes[noteId], `${noteId} should exist in the taxonomy`).toBeTruthy();
      expect(TONKA_KEYS).not.toContain(noteId);
      expect(LAVENDER_KEYS).not.toContain(noteId);
    }
    // sage, rosemary, clarySage, basil, mint, and spearmint all share
    // lavender's own family: "aromatic" tag in notes.js -- confirming the
    // shared family tag is a discovery grouping, not proof any of them is
    // a lavender variant. Each remains its own distinct, independently-
    // named herb.
    for (const noteId of ["sage", "rosemary", "clarySage", "basil", "mint", "spearmint"]) {
      expect(notes[noteId].family).toBe("aromatic");
      expect(notes[noteId].name).not.toBe("Lavender");
    }
  });
});

describe("Composer Phase 3J canonical-data sanity audit", () => {
  it("confirms no canonical-data correction was made or is recommended -- no qualified tonka or lavender variant exists to reclassify into", () => {
    expect(notes.frenchLavender).toBeUndefined();
    expect(notes.lavenderAbsolute).toBeUndefined();
    expect(notes.tonkaAbsolute).toBeUndefined();
  });
});

describe("Composer Phase 3J horizontal calibration -- tonka bean and lavender canonical-key families", () => {
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

  it("keeps every calibrated tonka/lavender-family value an integer from 1 to 10", () => {
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

  it("leaves every unrelated prominence value on the one touched fragrance exactly as it was -- this phase only changes one individual score", () => {
    for (const [id, unrelatedValues] of Object.entries(UNRELATED_VALUES_BY_ID)) {
      const liveEntry = { ...NOTE_PROMINENCE_BY_ID[id] };
      for (const key of [...TONKA_KEYS, ...LAVENDER_KEYS]) delete liveEntry[key];

      expect(liveEntry, `${perfumesById.get(Number(id)).name}`).toEqual(unrelatedValues);
    }
  });

  it("leaves the touched fragrance's canonical note pyramid exactly as it was -- no canonical note data was changed in this phase", () => {
    expect(perfumesById.get(404)).toMatchObject({
      name: "Layton",
      topNotes: ["apple", "lavender", "bergamot", "mandarin"],
    });
  });

  it("does not under-score a genuinely co-defining lavender note merely because another note (apple) is also prominent -- Layton's lavender now ties its own apple at 9", () => {
    const layton = NOTE_PROMINENCE_BY_ID[404];
    expect(layton.lavender).toBe(layton.apple);
    expect(layton.lavender).toBe(9);
  });

  it("confirms the explicit comparison anchors held up as internally consistent, with no under-scoring found", () => {
    // Armani Code EDT: tonkaBean correctly dominant and unchanged.
    expect(NOTE_PROMINENCE_BY_ID[104]).toEqual({ tonkaBean: 9, lavender: 6, greenMandarin: 5, cedar: 4 });
    // Le Male: lavender correctly dominant, tonkaBean correctly secondary.
    expect(NOTE_PROMINENCE_BY_ID[5]).toEqual({ lavender: 9, vanilla: 8, mint: 7, tonkaBean: 5 });
    // Le Male Le Parfum: lavender unchanged.
    expect(NOTE_PROMINENCE_BY_ID[113]).toEqual({ cardamom: 7, vanilla: 8, lavender: 6, iris: 4 });
    // La Nuit de L'Homme: lavender correctly secondary to cardamom.
    expect(NOTE_PROMINENCE_BY_ID[118]).toEqual({ cardamom: 9, coumarin: 6, lavender: 5, vetiver: 3 });
    // Eros Flame: tonkaBean unchanged, no lavender (not a member).
    expect(NOTE_PROMINENCE_BY_ID[29]).toEqual({ vanilla: 7, chinotto: 6, tonkaBean: 5 });
    // F by Ferragamo Black: both unchanged.
    expect(NOTE_PROMINENCE_BY_ID[20]).toEqual({ lavender: 7, amber: 6, tonkaBean: 5 });
    // Legend EDT: both unchanged.
    expect(NOTE_PROMINENCE_BY_ID[4]).toEqual({ lavender: 7, redApple: 6, tonkaBean: 6 });
    // Gentleman EDP: both remain unscored, correctly deferring to iris.
    expect(NOTE_PROMINENCE_BY_ID[205].tonkaBean).toBeUndefined();
    expect(NOTE_PROMINENCE_BY_ID[205].lavender).toBeUndefined();
    expect(NOTE_PROMINENCE_BY_ID[205].iris).toBe(8);
    // The Most Wanted: confirmed not a member of either family.
    const theMostWanted = perfumesById.get(8);
    expect(getPerfumeNoteIds(theMostWanted)).not.toContain("tonkaBean");
    expect(getPerfumeNoteIds(theMostWanted)).not.toContain("lavender");
  });

  // The Note Explorer "Most prominent" sort verification for tonkaBean and
  // lavender lives in
  // packages/builder/src/builder/internal/intelligence/buildNoteExplorerViewModel.test.js
  // instead of here -- packages/catalog must never import from
  // packages/builder (ADR-0006), and this file already proves the
  // underlying data (membership, scores, containment) that sort depends on.
});
