import { describe, expect, it } from "vitest";

import { fragrances as perfumes, notes } from "@discovery-box/catalog";
import { NOTE_PROMINENCE_BY_ID } from "../src/fragrances.js";

// Composer Phase 3M: narrow regression coverage for the thirteenth
// horizontal note-family calibration pass -- the ginger, nutmeg, and
// clove canonical-key families.
//
// Taxonomy audit (Step 1) -- exact canonical keys found in notes.js:
//   Ginger family (1 key): ginger ("Ginger", family: "spicy") -- no
//     qualified variant exists.
//   Nutmeg family (1 key): nutmeg ("Nutmeg", family: "spicy") -- no
//     qualified variant exists.
//   Clove family (1 key): cloves ("Cloves", family: "spicy") -- no
//     "clove" singular key or other qualified variant exists.
//   gingerFlower ("Ginger Flower") was investigated and excluded: it
//     carries its own bespoke image (notes/gingerFlower.jpg, never
//     reusing ginger.jpg) and its own distinct display name, matching
//     this dictionary's established pattern of keeping a plant's flower
//     materially distinct from its root/spice (orangeBlossom vs. orange,
//     violetLeaf vs. violet) -- a distinct floral material, not a ginger
//     variant.
//   Adjacent keys explicitly excluded (11 keys, real but semantically
//     distinct spice materials never treated as ginger/nutmeg/clove
//     substitutes): cardamom, cinnamon, blackPepper, pinkPepper, pepper,
//     whitePepper, anise (all family: "spicy", sharing these keys' own
//     family tag, yet each its own distinct, independently-named spice);
//     sichuanPepper, starAnise, saffron, caraway (real, separately-named
//     materials, still not ginger/nutmeg/clove variants).
//
// Canonical-data sanity audit (Step 2): every ginger-, nutmeg-, and
// cloves-carrying fragrance was checked for a case where a more specific
// qualified variant would be warranted. None exists in the taxonomy for
// any of the three families, so no reclassification target exists in any
// direction. No mismatch meeting the Phase 3A basil / Phase 3C
// blackVanilla bar was found. No canonical-data correction was made in
// this phase.
//
// Across 9 ginger, 9 nutmeg, and 4 cloves fragrance/note pairs, this
// phase's own calibration changes zero individual pairs -- every
// already-scored entry held up as internally consistent, including the
// explicit comparison anchors: YSL L'Homme's and YSL Y EDP's ginger: 6
// each (correctly leading L'Homme's own top accord, and correctly
// secondary to Y EDP's own established, more dominant apple: 8), The
// Scent EDT's ginger: 7 (a genuine co-axis alongside its own established
// leather: 8, never under-scored), Sauvage Elixir's nutmeg: 6 (a real,
// close-behind contributor within its own established cinnamon/licorice
// spice trio), Replica By The Fireplace's cloves: 6 and Gentleman EDP's
// cloves: 5 (both genuine, proportionate contributors beside each
// fragrance's own established, more dominant signature). Carlisle's
// nutmeg remains correctly unscored for lack of comparably strong
// documented signature status. F by Ferragamo Black was checked and
// confirmed not a member of any of the three families.
const GINGER_FAMILY = {
  7: 7,
  13: undefined,
  28: undefined,
  32: undefined,
  112: undefined,
  117: 6,
  210: undefined,
  213: 6,
  214: undefined,
};

const NUTMEG_FAMILY = {
  1: undefined,
  12: undefined,
  17: undefined,
  27: undefined,
  32: undefined,
  202: undefined,
  306: undefined,
  402: 6,
  403: undefined,
};

const CLOVES_FAMILY = {
  101: undefined,
  203: 4,
  204: 6,
  205: 5,
};

const GINGER_FLOWER_FAMILY = { 14: undefined };

const ALL_FAMILIES = {
  ginger: GINGER_FAMILY,
  nutmeg: NUTMEG_FAMILY,
  cloves: CLOVES_FAMILY,
};

const IN_SCOPE_KEYS = ["ginger", "nutmeg", "cloves"];

const ADJACENT_EXCLUDED_KEYS = [
  "cardamom",
  "cinnamon",
  "blackPepper",
  "pinkPepper",
  "pepper",
  "whitePepper",
  "anise",
  "sichuanPepper",
  "starAnise",
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

describe("Composer Phase 3M taxonomy audit", () => {
  it("finds exactly these 3 canonical keys in the note dictionary, each the only true identity in its family, with distinct display names", () => {
    expect(notes.ginger).toMatchObject({ name: "Ginger", family: "spicy" });
    expect(notes.nutmeg).toMatchObject({ name: "Nutmeg", family: "spicy" });
    expect(notes.cloves).toMatchObject({ name: "Cloves", family: "spicy" });
    expect(notes.clove).toBeUndefined();
  });

  it("excludes gingerFlower as its own distinct floral material, not a ginger variant -- it carries a bespoke image, never reusing ginger.jpg", () => {
    expect(notes.gingerFlower).toMatchObject({ name: "Ginger Flower" });
    expect(notes.gingerFlower.noteImageAssetKey).not.toBe(notes.ginger.noteImageAssetKey);
    expect(IN_SCOPE_KEYS).not.toContain("gingerFlower");

    // Confirmed exhaustively: gingerFlower has exactly 1 catalog member,
    // and that member never also carries generic ginger.
    const perfumesById = new Map(perfumes.map((perfume) => [perfume.id, perfume]));
    const halloweenMan = perfumesById.get(14);
    expect(getPerfumeNoteIds(halloweenMan)).toContain("gingerFlower");
    expect(getPerfumeNoteIds(halloweenMan)).not.toContain("ginger");
    expect(NOTE_PROMINENCE_BY_ID[14]?.gingerFlower).toBeUndefined();
  });

  it("excludes every adjacent spice from all three families, including several that share their own family: \"spicy\" tag", () => {
    for (const noteId of ADJACENT_EXCLUDED_KEYS) {
      expect(notes[noteId], `${noteId} should exist in the taxonomy`).toBeTruthy();
      expect(IN_SCOPE_KEYS).not.toContain(noteId);
    }
    for (const noteId of ["cardamom", "cinnamon", "blackPepper", "pinkPepper", "pepper", "whitePepper", "anise"]) {
      expect(notes[noteId].family).toBe("spicy");
    }
  });
});

describe("Composer Phase 3M canonical-data sanity audit", () => {
  it("confirms no canonical-data correction was made or is recommended -- no qualified ginger, nutmeg, or clove variant exists to reclassify into", () => {
    expect(notes.gingerRoot).toBeUndefined();
    expect(notes.freshNutmeg).toBeUndefined();
    expect(notes.wholeCloves).toBeUndefined();
  });
});

describe("Composer Phase 3M horizontal calibration -- ginger, nutmeg, and clove canonical-key families", () => {
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

  it("has exactly 1 gingerFlower member, and it stays unscored", () => {
    const actualIds = perfumes
      .filter((perfume) => getPerfumeNoteIds(perfume).includes("gingerFlower"))
      .map((perfume) => perfume.id);
    expect(actualIds).toEqual(Object.keys(GINGER_FLOWER_FAMILY).map(Number));
    expect(NOTE_PROMINENCE_BY_ID[14]?.gingerFlower).toBeUndefined();
  });

  it("keeps every calibrated ginger/nutmeg/clove-family value an integer from 1 to 10", () => {
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

  it("changes zero prominence values in this phase -- every ginger/nutmeg/cloves score above is exactly what the catalog already held before Phase 3M", () => {
    // This test pins that outcome as a regression guard -- if it ever
    // fails, either a later phase intentionally recalibrated one of these
    // exact keys (update this file's fixtures to match, with a comment),
    // or an unrelated change accidentally drifted a ginger/nutmeg/cloves
    // score.
    expect(NOTE_PROMINENCE_BY_ID[7]).toEqual({ leather: 8, ginger: 7, maninka: 5 });
    expect(NOTE_PROMINENCE_BY_ID[117]).toEqual({ ginger: 6, basil: 5, tonkaBean: 5, cedar: 4 });
    expect(NOTE_PROMINENCE_BY_ID[213]).toEqual({ ginger: 6, apple: 8, sage: 5 });
    expect(NOTE_PROMINENCE_BY_ID[402]).toEqual({ licorice: 8, cinnamon: 7, nutmeg: 6 });
    expect(NOTE_PROMINENCE_BY_ID[204]).toEqual({ guaiacWood: 9, chestnut: 7, cloves: 6, vanilla: 4 });
    expect(NOTE_PROMINENCE_BY_ID[205]).toEqual({ iris: 8, patchouli: 6, benzoin: 6, cloves: 5, blackVanilla: 6 });
  });

  it("leaves canonical note data completely unchanged in this phase -- no pyramid was edited for any ginger/nutmeg/cloves member", () => {
    expect(perfumesById.get(7)).toMatchObject({
      name: "The Scent EDT",
      topNotes: ["ginger", "mandarinOrange", "bergamot"],
    });
    expect(perfumesById.get(204)).toMatchObject({
      name: "Replica By The Fireplace",
      topNotes: ["cloves", "pinkPepper", "orangeBlossom"],
    });
  });

  it("does not under-score a genuine co-axis note merely because a bigger signature note also dominates -- The Scent EDT's ginger:7 stays close behind its own established leather:8", () => {
    const theScentEDT = NOTE_PROMINENCE_BY_ID[7];
    expect(theScentEDT.ginger).toBeGreaterThanOrEqual(4);
    expect(theScentEDT.ginger).toBeLessThan(theScentEDT.leather);
  });

  it("confirms F by Ferragamo Black is not a member of any of the three families", () => {
    const fByFerragamoBlack = perfumesById.get(20);
    const ownNoteIds = new Set(getPerfumeNoteIds(fByFerragamoBlack));
    for (const key of IN_SCOPE_KEYS) {
      expect(ownNoteIds.has(key)).toBe(false);
    }
  });

  // The Note Explorer "Most prominent" sort verification for ginger,
  // nutmeg, and cloves lives in
  // packages/builder/src/builder/internal/intelligence/buildNoteExplorerViewModel.test.js
  // instead of here -- packages/catalog must never import from
  // packages/builder (ADR-0006), and this file already proves the
  // underlying data (membership, scores, containment) that sort depends on.
});
