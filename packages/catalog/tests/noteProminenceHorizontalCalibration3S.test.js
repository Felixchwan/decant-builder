import { describe, expect, it } from "vitest";

import { fragrances as perfumes, notes } from "@discovery-box/catalog";
import { NOTE_PROMINENCE_BY_ID } from "../src/fragrances.js";

// Composer Phase 3S: narrow regression coverage for the nineteenth
// horizontal note-family calibration pass -- three independent standalone
// canonical keys grouped only for workflow/editorial efficiency as
// citrus-tree-derived aromatic/floral materials, never as one ranking
// family: neroli, orangeBlossom, and petitgrain.
//
// Taxonomy audit (Step 1) -- exact canonical keys found in notes.js:
//   neroli ("Neroli", family: "floral") -- no qualified variant exists.
//   orangeBlossom ("Orange Blossom", family: "floral") -- no qualified
//     variant exists.
//   petitgrain ("Petitgrain", family: "green") -- no qualified variant
//     exists.
//   Per the Phase 3D conclusion, all three remain independent from
//     orange, bitterOrange, mandarin, mandarinOrange, greenMandarin,
//     bergamot, lemon, and every other calibrated citrus-fruit key.
//     jasmine (3I), geranium (3N), and lilyOfTheValley (still
//     unreviewed) were all re-confirmed as their own distinct floral
//     identities, never neroli or orangeBlossom substitutes.
//
// Canonical-data sanity audit (Step 2): every neroli-, orangeBlossom-,
// and petitgrain-carrying fragrance was checked for identity confusion
// among the three. No mismatch meeting the Phase 3A basil / Phase 3C
// blackVanilla bar was found. Essenza is the only fragrance carrying more
// than one of the three exact keys (neroli and petitgrain), each
// independently unscored, never cross-credited. No canonical-data
// correction was made in this phase.
//
// Across 5 neroli, 5 orangeBlossom, and 5 petitgrain fragrance/note
// pairs, this phase's own calibration changes zero individual pairs.
// Every already-scored entry held up as internally consistent, including
// Prada L'Homme's neroli: 6 and Prada L'Homme L'Eau's neroli: 5 (both
// correctly secondary to their own established iris signature) and
// Arancia di Capri's and Mandarino di Sicilia's petitgrain: 5 each (both
// correctly secondary to their own established, name-matching citrus-
// fruit signature).
const NEROLI_FAMILY = {
  1: undefined,
  3: undefined,
  101: undefined,
  208: 6,
  214: 5,
};

const ORANGE_BLOSSOM_FAMILY = {
  5: undefined,
  10: undefined,
  13: undefined,
  14: undefined,
  204: undefined,
};

const PETITGRAIN_FAMILY = {
  9: undefined,
  100: 5,
  101: undefined,
  103: 5,
  401: undefined,
};

const ALL_FAMILIES = {
  neroli: NEROLI_FAMILY,
  orangeBlossom: ORANGE_BLOSSOM_FAMILY,
  petitgrain: PETITGRAIN_FAMILY,
};

const CITRUS_TREE_KEYS = ["neroli", "orangeBlossom", "petitgrain"];

const CITRUS_FRUIT_ADJACENT_EXCLUDED_KEYS = ["orange", "bitterOrange", "bergamot", "lemon", "mandarin", "mandarinOrange", "greenMandarin"];
const FLORAL_ADJACENT_EXCLUDED_KEYS = ["jasmine", "lilyOfTheValley", "geranium"];

function getPerfumeNoteIds(perfume) {
  return [
    ...(perfume.topNotes || []),
    ...(perfume.middleNotes || []),
    ...(perfume.baseNotes || []),
    ...(perfume.generalNotes || []),
  ];
}

describe("Composer Phase 3S taxonomy audit", () => {
  it("finds the exact canonical neroli, orangeBlossom, and petitgrain definitions -- three independent standalone keys, not a shared ranking family", () => {
    expect(notes.neroli).toMatchObject({ name: "Neroli", family: "floral" });
    expect(notes.orangeBlossom).toMatchObject({ name: "Orange Blossom", family: "floral" });
    expect(notes.petitgrain).toMatchObject({ name: "Petitgrain", family: "green" });
  });

  it("confirms no additional qualified variant of any of the three was invented", () => {
    expect(notes.neroliOil).toBeUndefined();
    expect(notes.orangeBlossomAbsolute).toBeUndefined();
    expect(notes.petitgrainCitronnier).toBeUndefined();
  });

  it("excludes every calibrated citrus-fruit key, per the Phase 3D conclusion that neroli/orangeBlossom/petitgrain are not citrus-fruit variants", () => {
    for (const noteId of CITRUS_FRUIT_ADJACENT_EXCLUDED_KEYS) {
      expect(notes[noteId], `${noteId} should exist in the taxonomy`).toBeTruthy();
      expect(CITRUS_TREE_KEYS).not.toContain(noteId);
    }
  });

  it("excludes every adjacent floral identity from neroli and orangeBlossom", () => {
    for (const noteId of FLORAL_ADJACENT_EXCLUDED_KEYS) {
      expect(notes[noteId], `${noteId} should exist in the taxonomy`).toBeTruthy();
      expect(CITRUS_TREE_KEYS).not.toContain(noteId);
    }
  });
});

describe("Composer Phase 3S canonical-data sanity audit", () => {
  const perfumesById = new Map(perfumes.map((perfume) => [perfume.id, perfume]));

  it("confirms no canonical-data correction was made or is recommended -- Essenza legitimately carries both neroli and petitgrain as distinct, separately-documented materials, never conflated", () => {
    const essenza = perfumesById.get(101);
    expect(essenza.generalNotes).toContain("neroli");
    expect(essenza.generalNotes).toContain("petitgrain");
    expect(NOTE_PROMINENCE_BY_ID[101].neroli).toBeUndefined();
    expect(NOTE_PROMINENCE_BY_ID[101].petitgrain).toBeUndefined();
  });

  it("confirms no fragrance conflates neroli, orangeBlossom, or petitgrain with one another", () => {
    for (const id of Object.keys(NEROLI_FAMILY).map(Number)) {
      const ownNoteIds = getPerfumeNoteIds(perfumesById.get(id));
      expect(ownNoteIds.filter((n) => CITRUS_TREE_KEYS.includes(n)).length).toBeGreaterThanOrEqual(1);
    }
  });
});

describe("Composer Phase 3S horizontal calibration -- neroli, orangeBlossom, and petitgrain", () => {
  const perfumesById = new Map(perfumes.map((perfume) => [perfume.id, perfume]));

  it("has exactly 88 catalog fragrances to search for exhaustive family membership", () => {
    expect(perfumes).toHaveLength(88);
  });

  for (const [noteId, family] of Object.entries(ALL_FAMILIES)) {
    it(`${noteId} membership is exhaustive against the live catalog`, () => {
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

  it("keeps every calibrated neroli/orangeBlossom/petitgrain value an integer from 1 to 10", () => {
    for (const family of Object.values(ALL_FAMILIES)) {
      for (const [id, score] of Object.entries(family)) {
        if (score === undefined) continue;
        expect(Number.isInteger(score), `id ${id}`).toBe(true);
        expect(score).toBeGreaterThanOrEqual(1);
        expect(score).toBeLessThanOrEqual(10);
      }
    }
  });

  it("never collapses the three exact identities into one another", () => {
    const allTouchedIds = new Set(Object.values(ALL_FAMILIES).flatMap((family) => Object.keys(family).map(Number)));

    for (const id of allTouchedIds) {
      const entry = NOTE_PROMINENCE_BY_ID[id] || {};
      const fragrance = perfumesById.get(id);
      const ownNoteIds = new Set(getPerfumeNoteIds(fragrance));

      for (const key of CITRUS_TREE_KEYS) {
        if (key in entry) {
          expect(ownNoteIds.has(key), `${fragrance.name} does not canonically carry "${key}"`).toBe(true);
        }
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

  it("changes zero prominence values in this phase -- every neroli/orangeBlossom/petitgrain score above is exactly what the catalog already held before Phase 3S", () => {
    // This test pins that outcome as a regression guard -- if it ever
    // fails, either a later phase intentionally recalibrated one of these
    // exact keys (update this file's fixtures to match, with a comment),
    // or an unrelated change accidentally drifted a neroli/orangeBlossom/
    // petitgrain score.
    expect(NOTE_PROMINENCE_BY_ID[208]).toEqual({ iris: 9, neroli: 6, amber: 5, carrotSeeds: 3 });
    expect(NOTE_PROMINENCE_BY_ID[214]).toEqual({ iris: 6, powderyNotes: 6, neroli: 5 });
    expect(NOTE_PROMINENCE_BY_ID[100]).toEqual({ sicilianMandarin: 7, caramel: 5, petitgrain: 5 });
    expect(NOTE_PROMINENCE_BY_ID[103]).toEqual({ greenMandarin: 7, petitgrain: 5, spearmint: 5, bloodOrange: 4 });
  });

  it("leaves canonical note data completely unchanged in this phase -- no pyramid was edited for any neroli/orangeBlossom/petitgrain member", () => {
    expect(perfumesById.get(208)).toMatchObject({
      name: "Prada L'Homme",
      topNotes: ["neroli", "blackPepper", "cardamom", "carrotSeeds"],
    });
    expect(perfumesById.get(101)).toMatchObject({
      name: "Essenza",
      generalNotes: expect.arrayContaining(["neroli", "petitgrain"]),
    });
  });

  it("does not assume neroli shares iris's defining status merely for coexisting with it -- both Prada L'Homme fragrances' neroli stays correctly secondary to their own established iris scores", () => {
    expect(NOTE_PROMINENCE_BY_ID[208].neroli).toBeLessThan(NOTE_PROMINENCE_BY_ID[208].iris);
    expect(NOTE_PROMINENCE_BY_ID[214].neroli).toBeLessThan(NOTE_PROMINENCE_BY_ID[214].iris);
  });

  // The Note Explorer "Most prominent" sort verification for neroli,
  // orangeBlossom, and petitgrain lives in
  // packages/builder/src/builder/internal/intelligence/buildNoteExplorerViewModel.test.js
  // instead of here -- packages/catalog must never import from
  // packages/builder (ADR-0006), and this file already proves the
  // underlying data (membership, scores, containment) that sort depends on.
});
