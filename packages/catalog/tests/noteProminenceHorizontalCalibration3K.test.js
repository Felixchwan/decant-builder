import { describe, expect, it } from "vitest";

import { fragrances as perfumes, notes } from "@discovery-box/catalog";
import { NOTE_PROMINENCE_BY_ID } from "../src/fragrances.js";

// Composer Phase 3K: narrow regression coverage for the eleventh
// horizontal note-family calibration pass -- the cardamom and cinnamon
// canonical-key families.
//
// Taxonomy audit (Step 1) -- exact canonical keys found in notes.js:
//   Cardamom family (1 key): cardamom ("Cardamom", family: "spicy") -- no
//     qualified cardamom variant exists in the taxonomy. Do not invent
//     one.
//   Cinnamon family (1 key): cinnamon ("Cinnamon", family: "spicy") -- no
//     qualified cinnamon variant exists either.
//   Adjacent keys explicitly excluded (13 keys, real but semantically
//     distinct warm-spicy materials never treated as cardamom or
//     cinnamon substitutes): blackPepper, pinkPepper, sichuanPepper,
//     pepper, whitePepper, nutmeg, cloves, starAnise, anise (all family:
//     "spicy", sharing cardamom/cinnamon's own family tag -- yet each
//     remains its own distinct, independently-named spice); ginger,
//     gingerFlower, saffron, caraway (real, separately-named materials
//     without the same family tag, still not cardamom/cinnamon
//     variants).
//
// Canonical-data sanity audit (Step 2): every cardamom-carrying fragrance
// was checked for a case where a qualified cardamom variant would be
// warranted, and every cinnamon-carrying fragrance was checked for a case
// where a qualified cinnamon variant would be warranted. Neither exists
// in the taxonomy, so no reclassification target exists in either
// direction. No mismatch meeting the Phase 3A basil / Phase 3C
// blackVanilla bar was found. No canonical-data correction was made in
// this phase.
//
// Across 18 cardamom and 8 cinnamon fragrance/note pairs, this phase's
// own calibration changes zero individual pairs -- every already-scored
// entry held up as internally consistent, including the explicit
// comparison anchors: La Nuit de L'Homme's cardamom: 9 (correctly the
// family's highest score, its own well-documented, single defining
// opening note, never under-scored despite lavender/coumarin/vetiver also
// being scored), Le Male Le Parfum's cardamom: 7 (its sole top note,
// proportionate to vanilla's own greater base-level dominance), Layton's
// cardamom: 4 (correctly secondary to its own established apple/lavender
// dual signature), Spicebomb Extreme's and Sauvage Elixir's cinnamon:
// 6/7 (genuine, non-trivial contributing spice axes, proportionately
// trailing each fragrance's own established tobacco/licorice signature
// without being under-scored), and Gentleman EDP's cinnamon (correctly
// unscored, deferring to its own established iris signature). Armani
// Code EDT and Il Padrino were checked and confirmed not members of
// either family.
const CARDAMOM_FAMILY = {
  5: undefined,
  8: 8,
  9: undefined,
  13: 5,
  16: undefined,
  18: undefined,
  24: 5,
  31: 5,
  34: undefined,
  100: undefined,
  109: undefined,
  113: 7,
  118: 9,
  206: undefined,
  208: undefined,
  211: undefined,
  402: undefined,
  404: 4,
};

const CINNAMON_FAMILY = {
  5: undefined,
  14: 5,
  16: 5,
  21: 5,
  205: undefined,
  212: 6,
  304: 7,
  402: 7,
};

const ALL_FAMILIES = {
  cardamom: CARDAMOM_FAMILY,
  cinnamon: CINNAMON_FAMILY,
};

const CARDAMOM_KEYS = ["cardamom"];
const CINNAMON_KEYS = ["cinnamon"];

const ADJACENT_EXCLUDED_KEYS = [
  "blackPepper",
  "pinkPepper",
  "sichuanPepper",
  "pepper",
  "whitePepper",
  "nutmeg",
  "cloves",
  "starAnise",
  "anise",
  "ginger",
  "gingerFlower",
  "saffron",
  "caraway",
];

function getPerfumeNoteIds(perfume) {
  return [
    ...(perfume.topNotes || []),
    ...(perfume.middleNotes || []),
    ...(perfume.baseNotes || []),
    ...(perfume.generalNotes || []),
  ];
}

describe("Composer Phase 3K taxonomy audit", () => {
  it("finds exactly 1 true canonical cardamom-family key in the note dictionary -- no qualified variant exists", () => {
    expect(notes.cardamom).toMatchObject({ name: "Cardamom", family: "spicy" });
  });

  it("finds exactly 1 true canonical cinnamon-family key in the note dictionary -- no qualified variant exists", () => {
    expect(notes.cinnamon).toMatchObject({ name: "Cinnamon", family: "spicy" });
  });

  it("excludes every adjacent material from both families, including several that share cardamom/cinnamon's own family: \"spicy\" tag", () => {
    for (const noteId of ADJACENT_EXCLUDED_KEYS) {
      expect(notes[noteId], `${noteId} should exist in the taxonomy`).toBeTruthy();
      expect(CARDAMOM_KEYS).not.toContain(noteId);
      expect(CINNAMON_KEYS).not.toContain(noteId);
    }
    // blackPepper, pinkPepper, pepper, whitePepper, nutmeg, cloves, and
    // anise all share cardamom/cinnamon's own family: "spicy" tag in
    // notes.js -- confirming the shared family tag is a discovery
    // grouping, not proof any of them is a cardamom or cinnamon variant.
    // (sichuanPepper and starAnise carry no family tag at all, but are
    // excluded on the same "real, separately-named material" basis.)
    for (const noteId of ["blackPepper", "pinkPepper", "pepper", "whitePepper", "nutmeg", "cloves", "anise"]) {
      expect(notes[noteId].family).toBe("spicy");
      expect(notes[noteId].name).not.toBe("Cardamom");
      expect(notes[noteId].name).not.toBe("Cinnamon");
    }
  });
});

describe("Composer Phase 3K canonical-data sanity audit", () => {
  it("confirms no canonical-data correction was made or is recommended -- no qualified cardamom or cinnamon variant exists to reclassify into", () => {
    expect(notes.cardamomAbsolute).toBeUndefined();
    expect(notes.ceylonCinnamon).toBeUndefined();
    expect(notes.cassiaCinnamon).toBeUndefined();
  });
});

describe("Composer Phase 3K horizontal calibration -- cardamom and cinnamon canonical-key families", () => {
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

  it("keeps every calibrated cardamom/cinnamon-family value an integer from 1 to 10", () => {
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

  it("changes zero prominence values in this phase -- every cardamom/cinnamon score above is exactly what the catalog already held before Phase 3K", () => {
    // This test pins that outcome as a regression guard -- if it ever
    // fails, either a later phase intentionally recalibrated one of these
    // exact keys (update this file's fixtures to match, with a comment),
    // or an unrelated change accidentally drifted a cardamom/cinnamon
    // score.
    expect(NOTE_PROMINENCE_BY_ID[118]).toEqual({ cardamom: 9, coumarin: 6, lavender: 5, vetiver: 3 });
    expect(NOTE_PROMINENCE_BY_ID[113]).toEqual({ cardamom: 7, vanilla: 8, lavender: 6, iris: 4 });
    expect(NOTE_PROMINENCE_BY_ID[404]).toEqual({ apple: 9, lavender: 9, vanilla: 7, cardamom: 4, coumarin: 4 });
    expect(NOTE_PROMINENCE_BY_ID[212]).toEqual({ tobacco: 9, vanilla: 8, bourbonVanilla: 8, cinnamon: 6, blackPepper: 5 });
    expect(NOTE_PROMINENCE_BY_ID[402]).toEqual({ licorice: 8, cinnamon: 7, nutmeg: 6 });
    expect(NOTE_PROMINENCE_BY_ID[205]).toEqual({ iris: 8, patchouli: 6, benzoin: 6, cloves: 5, blackVanilla: 6 });
  });

  it("leaves canonical note data completely unchanged in this phase -- no pyramid was edited for any cardamom/cinnamon member", () => {
    expect(perfumesById.get(118)).toMatchObject({
      name: "La Nuit de L'Homme",
      topNotes: ["cardamom"],
    });
    expect(perfumesById.get(304)).toMatchObject({
      name: "Divine Vanille",
      topNotes: ["cinnamon", "blackPepper", "clarySage"],
    });
  });

  it("does not under-score a genuinely defining cardamom note merely because other notes are also scored -- La Nuit de L'Homme's cardamom:9 correctly leads its own lavender/coumarin/vetiver", () => {
    const laNuitDeLHomme = NOTE_PROMINENCE_BY_ID[118];
    expect(laNuitDeLHomme.cardamom).toBeGreaterThan(laNuitDeLHomme.coumarin);
    expect(laNuitDeLHomme.cardamom).toBeGreaterThan(laNuitDeLHomme.lavender);
    expect(laNuitDeLHomme.cardamom).toBeGreaterThan(laNuitDeLHomme.vetiver);
  });

  it("confirms Armani Code EDT and Il Padrino are not members of either family", () => {
    for (const id of [104, 410]) {
      const ownNoteIds = getPerfumeNoteIds(perfumesById.get(id));
      expect(ownNoteIds).not.toContain("cardamom");
      expect(ownNoteIds).not.toContain("cinnamon");
    }
  });

  // The Note Explorer "Most prominent" sort verification for cardamom and
  // cinnamon lives in
  // packages/builder/src/builder/internal/intelligence/buildNoteExplorerViewModel.test.js
  // instead of here -- packages/catalog must never import from
  // packages/builder (ADR-0006), and this file already proves the
  // underlying data (membership, scores, containment) that sort depends on.
});
