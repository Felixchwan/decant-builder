import { describe, expect, it } from "vitest";

import { fragrances as perfumes, notes } from "@discovery-box/catalog";
import { NOTE_PROMINENCE_BY_ID } from "../src/fragrances.js";

// Composer Phase 3L: narrow regression coverage for the twelfth horizontal
// note-family calibration pass -- the pepper canonical-key families.
//
// Taxonomy audit (Step 1) -- exact canonical keys found in notes.js:
//   Pepper family (5 keys, all kept deliberately distinct): pepper
//     ("Pepper", family: "spicy", generic), blackPepper ("Black Pepper",
//     family: "spicy"), pinkPepper ("Pink Pepper", family: "spicy"),
//     sichuanPepper ("Sichuan Pepper", no family tag), whitePepper
//     ("White Pepper", family: "spicy"). No other pepper variant (e.g. a
//     hypothetical "longPepper"/"greenPepper") exists in the taxonomy.
//   Adjacent keys explicitly excluded (9 keys, real but semantically
//     distinct spice materials never treated as pepper substitutes):
//     cardamom, cinnamon, nutmeg, cloves, anise (all family: "spicy",
//     sharing the pepper keys' own family tag, yet each remains its own
//     distinct, independently-named spice); ginger, gingerFlower,
//     saffron, starAnise (real, separately-named materials without the
//     same family tag, still not pepper variants).
//
// Canonical-data sanity audit (Step 2): every pepper-family-carrying
// fragrance was checked for a case where a different exact pepper key
// would better match its own documented identity (e.g. generic pepper
// where a specific variant is warranted, or vice versa). No mismatch
// meeting the Phase 3A basil / Phase 3C blackVanilla bar was found --
// every fragrance already uses the most specific pepper-family key its
// own documented identity supports (Terre d'Hermès EDT's generic pepper
// matches Hermès's own published pyramid; Sauvage EDP's sichuanPepper
// matches Dior's own named differentiator for that specific release). No
// canonical-data correction was made in this phase.
//
// Across 4 pepper, 10 blackPepper, 12 pinkPepper, 2 sichuanPepper, and 3
// whitePepper fragrance/note pairs, this phase's own calibration changes
// zero individual pairs -- every already-scored entry held up as
// internally consistent, including the explicit comparison anchors:
// Terre d'Hermès EDT's pepper: 4 (correctly its lowest-scored note, a
// real but secondary facet beside its own established orange/vetiver
// dual signature), Sauvage EDP's sichuanPepper: 6 (a genuine, well-
// documented differentiator for this specific release, proportionately
// trailing its own established ambroxan: 9 signature without being
// under-scored), Spicebomb Extreme's blackPepper: 5 (a real contributing
// spice, correctly trailing its own established tobacco/vanilla
// signature), and Polo Blue Parfum's pinkPepper: 5 (proportionate to its
// own established vetiver/patchouli base duo). Gentleman EDP's and
// Tuxedo's blackPepper both remain correctly unscored, deferring to each
// fragrance's own established iris/patchouli signature. Sauvage Elixir
// and The One for Men EDP were checked and confirmed not members of any
// pepper-family key.
const PEPPER_FAMILY = {
  29: undefined,
  34: undefined,
  111: 4,
  404: undefined,
};

const BLACK_PEPPER_FAMILY = {
  20: undefined,
  21: undefined,
  29: undefined,
  33: undefined,
  114: undefined,
  205: undefined,
  208: undefined,
  212: 5,
  304: undefined,
  501: undefined,
};

const PINK_PEPPER_FAMILY = {
  16: undefined,
  17: 4,
  25: undefined,
  102: undefined,
  107: undefined,
  108: undefined,
  116: 4,
  201: undefined,
  203: undefined,
  204: undefined,
  206: 5,
  500: undefined,
};

const SICHUAN_PEPPER_FAMILY = { 28: undefined, 202: 6 };

const WHITE_PEPPER_FAMILY = { 32: undefined, 27: undefined, 117: undefined };

const ALL_FAMILIES = {
  pepper: PEPPER_FAMILY,
  blackPepper: BLACK_PEPPER_FAMILY,
  pinkPepper: PINK_PEPPER_FAMILY,
  sichuanPepper: SICHUAN_PEPPER_FAMILY,
  whitePepper: WHITE_PEPPER_FAMILY,
};

const PEPPER_KEYS = ["pepper", "blackPepper", "pinkPepper", "sichuanPepper", "whitePepper"];

const ADJACENT_EXCLUDED_KEYS = ["cardamom", "cinnamon", "nutmeg", "cloves", "anise", "ginger", "gingerFlower", "saffron", "starAnise"];

function getPerfumeNoteIds(perfume) {
  return [
    ...(perfume.topNotes || []),
    ...(perfume.middleNotes || []),
    ...(perfume.baseNotes || []),
    ...(perfume.generalNotes || []),
  ];
}

describe("Composer Phase 3L taxonomy audit", () => {
  it("finds exactly these 5 canonical pepper-family keys in the note dictionary, with distinct display names", () => {
    expect(notes.pepper).toMatchObject({ name: "Pepper", family: "spicy" });
    expect(notes.blackPepper).toMatchObject({ name: "Black Pepper", family: "spicy" });
    expect(notes.pinkPepper).toMatchObject({ name: "Pink Pepper", family: "spicy" });
    expect(notes.sichuanPepper).toMatchObject({ name: "Sichuan Pepper" });
    expect(notes.whitePepper).toMatchObject({ name: "White Pepper", family: "spicy" });
  });

  it("excludes every adjacent spice from the pepper family, including several that share pepper's own family: \"spicy\" tag", () => {
    for (const noteId of ADJACENT_EXCLUDED_KEYS) {
      expect(notes[noteId], `${noteId} should exist in the taxonomy`).toBeTruthy();
      expect(PEPPER_KEYS).not.toContain(noteId);
    }
    // cardamom, cinnamon, nutmeg, cloves, and anise all share the pepper
    // keys' own family: "spicy" tag in notes.js -- confirming the shared
    // family tag is a discovery grouping, not proof any of them is a
    // pepper variant.
    for (const noteId of ["cardamom", "cinnamon", "nutmeg", "cloves", "anise"]) {
      expect(notes[noteId].family).toBe("spicy");
      expect(PEPPER_KEYS.some((key) => notes[key].name === notes[noteId].name)).toBe(false);
    }
  });

  it("confirms no other pepper variant was invented beyond the 5 found", () => {
    expect(notes.longPepper).toBeUndefined();
    expect(notes.greenPepper).toBeUndefined();
    expect(notes.tasmanianPepper).toBeUndefined();
  });
});

describe("Composer Phase 3L canonical-data sanity audit", () => {
  const perfumesById = new Map(perfumes.map((perfume) => [perfume.id, perfume]));

  it("confirms no canonical-data correction was made or is recommended -- Sauvage EDP already uses the specific sichuanPepper, and Versace Eros Flame legitimately carries two distinct pepper variants side by side", () => {
    const sauvageEDP = perfumesById.get(202);
    expect(sauvageEDP.middleNotes).toContain("sichuanPepper");
    expect(sauvageEDP.middleNotes).not.toContain("pepper");

    // Versace Eros Flame carries both generic pepper and blackPepper as
    // two separately-documented notes -- never conflated into one.
    const erosFlame = perfumesById.get(29);
    expect(erosFlame.topNotes).toContain("blackPepper");
    expect(erosFlame.middleNotes).toContain("pepper");
  });
});

describe("Composer Phase 3L horizontal calibration -- pepper canonical-key families", () => {
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

  it("keeps every calibrated pepper-family value an integer from 1 to 10", () => {
    for (const family of Object.values(ALL_FAMILIES)) {
      for (const [id, score] of Object.entries(family)) {
        if (score === undefined) continue;
        expect(Number.isInteger(score), `id ${id}`).toBe(true);
        expect(score).toBeGreaterThanOrEqual(1);
        expect(score).toBeLessThanOrEqual(10);
      }
    }
  });

  it("never collapses distinct pepper variants into one another", () => {
    const allTouchedIds = new Set(Object.values(ALL_FAMILIES).flatMap((family) => Object.keys(family).map(Number)));

    for (const id of allTouchedIds) {
      const entry = NOTE_PROMINENCE_BY_ID[id] || {};
      const fragrance = perfumesById.get(id);
      const ownNoteIds = new Set(getPerfumeNoteIds(fragrance));

      for (const key of PEPPER_KEYS) {
        if (key in entry) {
          expect(ownNoteIds.has(key), `${fragrance.name} does not canonically carry "${key}"`).toBe(true);
        }
      }
    }

    // Sauvage EDP is scored under sichuanPepper only, never generic
    // pepper or another variant.
    expect(NOTE_PROMINENCE_BY_ID[202]?.pepper).toBeUndefined();
    expect(NOTE_PROMINENCE_BY_ID[202]?.blackPepper).toBeUndefined();
    expect(NOTE_PROMINENCE_BY_ID[202]?.pinkPepper).toBeUndefined();
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

  it("changes zero prominence values in this phase -- every pepper-family score above is exactly what the catalog already held before Phase 3L", () => {
    // This test pins that outcome as a regression guard -- if it ever
    // fails, either a later phase intentionally recalibrated one of these
    // exact keys (update this file's fixtures to match, with a comment),
    // or an unrelated change accidentally drifted a pepper score.
    expect(NOTE_PROMINENCE_BY_ID[111]).toEqual({
      orange: 8,
      vetiver: 8,
      grapefruit: 7,
      cedar: 6,
      pepper: 4,
      patchouli: 5,
    });
    expect(NOTE_PROMINENCE_BY_ID[212]).toEqual({ tobacco: 9, vanilla: 8, bourbonVanilla: 8, cinnamon: 6, blackPepper: 5 });
    expect(NOTE_PROMINENCE_BY_ID[17]).toEqual({ birchLeaf: 7, incense: 5, pinkPepper: 4, cedar: 4 });
    expect(NOTE_PROMINENCE_BY_ID[116]).toEqual({ vanilla: 5, tonkaBean: 5, pinkPepper: 4 });
    expect(NOTE_PROMINENCE_BY_ID[206]).toEqual({ vetiver: 6, patchouli: 6, pinkPepper: 5 });
    expect(NOTE_PROMINENCE_BY_ID[202]).toEqual({ ambroxan: 9, bergamot: 7, sichuanPepper: 6, vanilla: 5 });
  });

  it("leaves canonical note data completely unchanged in this phase -- no pyramid was edited for any pepper-family member", () => {
    expect(perfumesById.get(111)).toMatchObject({
      name: "Terre d'Hermès EDT",
      middleNotes: ["pepper", "geranium"],
    });
    expect(perfumesById.get(202)).toMatchObject({
      name: "Sauvage EDP",
      middleNotes: ["sichuanPepper", "lavender", "starAnise", "nutmeg"],
    });
  });

  it("does not under-score a genuinely documented pepper differentiator merely because a bigger signature note also dominates -- Sauvage EDP's sichuanPepper stays real and non-trivial beside its own ambroxan:9", () => {
    const sauvageEDP = NOTE_PROMINENCE_BY_ID[202];
    expect(sauvageEDP.sichuanPepper).toBeGreaterThanOrEqual(4);
    expect(sauvageEDP.sichuanPepper).toBeLessThan(sauvageEDP.ambroxan);
  });

  it("confirms Sauvage Elixir and The One for Men EDP are not members of any pepper-family key", () => {
    for (const id of [402, 13]) {
      const ownNoteIds = getPerfumeNoteIds(perfumesById.get(id));
      for (const key of PEPPER_KEYS) {
        expect(ownNoteIds).not.toContain(key);
      }
    }
  });

  // The Note Explorer "Most prominent" sort verification for the pepper
  // family lives in
  // packages/builder/src/builder/internal/intelligence/buildNoteExplorerViewModel.test.js
  // instead of here -- packages/catalog must never import from
  // packages/builder (ADR-0006), and this file already proves the
  // underlying data (membership, scores, containment) that sort depends on.
});
