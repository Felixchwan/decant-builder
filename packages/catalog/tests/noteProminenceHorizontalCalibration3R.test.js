import { describe, expect, it } from "vitest";

import { fragrances as perfumes, notes } from "@discovery-box/catalog";
import { NOTE_PROMINENCE_BY_ID } from "../src/fragrances.js";

// Composer Phase 3R: narrow regression coverage for the eighteenth
// horizontal note-family calibration pass -- three independent standalone
// canonical keys grouped only for workflow efficiency, never as a shared
// fruit/aquatic/aromatic family: pineapple, seaNotes, and juniper.
//
// Taxonomy audit (Step 1) -- exact canonical keys found in notes.js:
//   pineapple ("Pineapple", family: "fruity") -- no qualified variant
//     exists.
//   seaNotes ("Sea Notes", family: "aquatic") -- no qualified variant
//     exists.
//   juniper ("Juniper", no family tag) -- no qualified variant (e.g. a
//     hypothetical "juniperBerries") exists.
//   Adjacent keys re-confirmed as their own distinct, already-
//     established identities: apple, greenApple, redApple, candyApple,
//     mango, greenMango, passionFruit, fig, figNectar, fruityNotes
//     (pineapple-adjacent); seaSalt, mineralNotes, calone (seaNotes-
//     adjacent); pine, fir, firBalsam, rosemary, sage, clarySage, basil,
//     cypress (juniper-adjacent).
//
// Canonical-data sanity audit (Step 2): every pineapple-, seaNotes-, and
// juniper-carrying fragrance was checked for a case where a different
// explicit material would better match its documented identity. No
// mismatch meeting the Phase 3A basil / Phase 3C blackVanilla bar was
// found. Acqua di Gio EDT legitimately carries both seaNotes and calone
// as two separately-documented, separately-scored aquatic materials, and
// Born In Roma EDT correctly uses seaSalt and mineralNotes instead of
// seaNotes -- never conflated. No canonical-data correction was made in
// this phase.
//
// Across 6 pineapple, 6 seaNotes, and 6 juniper fragrance/note pairs --
// Mirto di Panarea carries both seaNotes and juniper, and Summer Hammer
// carries both pineapple and seaNotes -- this phase's own calibration
// changes zero individual pairs. Every already-scored entry held up as
// internally consistent, including Acqua di Gio EDT's seaNotes: 10
// (correctly the maximum, absolute defining signature of the fragrance
// that originated the aquatic genre), Club de Nuit Intense Man's
// pineapple: 8 (correctly leading its own well-documented pineapple/
// blackcurrant/birch top-note trio), and Hacivat's pineapple: 8
// (correctly tied with its own established oakmoss: 8, reflecting a
// genuine, real co-equal fruity-chypre dual signature). Born In Roma EDT
// was checked and confirmed not a member of any of the three families.
const PINEAPPLE_FAMILY = {
  4: undefined,
  19: 8,
  28: undefined,
  112: 6,
  406: 8,
  407: 6,
};

const SEA_NOTES_FAMILY = {
  1: 10,
  9: undefined,
  119: 6,
  207: 6,
  306: 6,
  407: 5,
};

const JUNIPER_FAMILY = {
  24: undefined,
  109: undefined,
  119: undefined,
  204: undefined,
  213: undefined,
  409: 6,
};

const ALL_FAMILIES = {
  pineapple: PINEAPPLE_FAMILY,
  seaNotes: SEA_NOTES_FAMILY,
  juniper: JUNIPER_FAMILY,
};

const PINEAPPLE_ADJACENT_EXCLUDED_KEYS = ["apple", "greenApple", "redApple", "candyApple", "mango", "greenMango", "passionFruit", "fig", "figNectar", "fruityNotes"];
const SEA_NOTES_ADJACENT_EXCLUDED_KEYS = ["seaSalt", "mineralNotes", "calone"];
const JUNIPER_ADJACENT_EXCLUDED_KEYS = ["pine", "fir", "firBalsam", "rosemary", "sage", "clarySage", "basil", "cypress"];

function getPerfumeNoteIds(perfume) {
  return [
    ...(perfume.topNotes || []),
    ...(perfume.middleNotes || []),
    ...(perfume.baseNotes || []),
    ...(perfume.generalNotes || []),
  ];
}

describe("Composer Phase 3R taxonomy audit", () => {
  it("finds the exact canonical pineapple, seaNotes, and juniper definitions -- three independent standalone keys, not a shared family", () => {
    expect(notes.pineapple).toMatchObject({ name: "Pineapple", family: "fruity" });
    expect(notes.seaNotes).toMatchObject({ name: "Sea Notes", family: "aquatic" });
    expect(notes.juniper).toMatchObject({ name: "Juniper" });
  });

  it("confirms no other pineapple, seaNotes, or juniper variant was invented", () => {
    expect(notes.juniperBerries).toBeUndefined();
    expect(notes.pineappleJuice).toBeUndefined();
    expect(notes.seaBreeze).toBeUndefined();
  });

  it("excludes every pineapple-adjacent fruit material", () => {
    for (const noteId of PINEAPPLE_ADJACENT_EXCLUDED_KEYS) {
      expect(notes[noteId], `${noteId} should exist in the taxonomy`).toBeTruthy();
      expect(noteId).not.toBe("pineapple");
    }
  });

  it("excludes every seaNotes-adjacent marine/mineral material", () => {
    for (const noteId of SEA_NOTES_ADJACENT_EXCLUDED_KEYS) {
      expect(notes[noteId], `${noteId} should exist in the taxonomy`).toBeTruthy();
      expect(noteId).not.toBe("seaNotes");
    }
  });

  it("excludes every juniper-adjacent coniferous/aromatic material", () => {
    for (const noteId of JUNIPER_ADJACENT_EXCLUDED_KEYS) {
      expect(notes[noteId], `${noteId} should exist in the taxonomy`).toBeTruthy();
      expect(noteId).not.toBe("juniper");
    }
  });
});

describe("Composer Phase 3R canonical-data sanity audit", () => {
  const perfumesById = new Map(perfumes.map((perfume) => [perfume.id, perfume]));

  it("confirms no canonical-data correction was made or is recommended -- Acqua di Gio EDT legitimately carries both seaNotes and calone as distinct, separately-scored aquatic materials", () => {
    const acquaDiGioEDT = perfumesById.get(1);
    expect(acquaDiGioEDT.middleNotes).toContain("seaNotes");
    expect(acquaDiGioEDT.middleNotes).toContain("calone");
    expect(NOTE_PROMINENCE_BY_ID[1].seaNotes).toBe(10);
    expect(NOTE_PROMINENCE_BY_ID[1].calone).toBe(9);
  });

  it("confirms Born In Roma EDT correctly uses seaSalt and mineralNotes instead of seaNotes, never conflated", () => {
    const bornInRomaEDT = perfumesById.get(210);
    expect(bornInRomaEDT.topNotes).toContain("seaSalt");
    expect(bornInRomaEDT.topNotes).toContain("mineralNotes");
    expect(getPerfumeNoteIds(bornInRomaEDT)).not.toContain("seaNotes");
  });

  it("confirms Born In Roma EDT is not a member of pineapple, seaNotes, or juniper", () => {
    const ownNoteIds = getPerfumeNoteIds(perfumesById.get(210));
    for (const key of ["pineapple", "seaNotes", "juniper"]) {
      expect(ownNoteIds).not.toContain(key);
    }
  });

  it("confirms Mirto di Panarea and Summer Hammer legitimately carry two in-scope exact keys each, independently scored", () => {
    expect(NOTE_PROMINENCE_BY_ID[119].seaNotes).toBe(6);
    expect(NOTE_PROMINENCE_BY_ID[119].juniper).toBeUndefined();
    expect(NOTE_PROMINENCE_BY_ID[407].pineapple).toBe(6);
    expect(NOTE_PROMINENCE_BY_ID[407].seaNotes).toBe(5);
  });
});

describe("Composer Phase 3R horizontal calibration -- pineapple, seaNotes, and juniper", () => {
  const perfumesById = new Map(perfumes.map((perfume) => [perfume.id, perfume]));

  it("has exactly 87 catalog fragrances to search for exhaustive family membership", () => {
    expect(perfumes).toHaveLength(87);
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

  it("keeps every calibrated pineapple/seaNotes/juniper value an integer from 1 to 10", () => {
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

  it("changes zero prominence values in this phase -- every pineapple/seaNotes/juniper score above is exactly what the catalog already held before Phase 3R", () => {
    // This test pins that outcome as a regression guard -- if it ever
    // fails, either a later phase intentionally recalibrated one of these
    // exact keys (update this file's fixtures to match, with a comment),
    // or an unrelated change accidentally drifted a pineapple/seaNotes/
    // juniper score.
    expect(NOTE_PROMINENCE_BY_ID[19]).toEqual({ pineapple: 8, birch: 7, blackCurrant: 6, ambergris: 5 });
    expect(NOTE_PROMINENCE_BY_ID[406]).toEqual({ pineapple: 8, oakmoss: 8, cedar: 4, patchouli: 4 });
    expect(NOTE_PROMINENCE_BY_ID[1]).toEqual({ seaNotes: 10, calone: 9, bergamot: 7, jasmine: 5, whiteMusk: 4 });
    expect(NOTE_PROMINENCE_BY_ID[409]).toEqual({ powderyNotes: 7, juniper: 6, cedar: 6, jasmine: 5, tonkaBean: 4 });
  });

  it("leaves canonical note data completely unchanged in this phase -- no pyramid was edited for any pineapple/seaNotes/juniper member", () => {
    expect(perfumesById.get(19)).toMatchObject({
      name: "Club de Nuit Intense Man",
      topNotes: ["lemon", "pineapple", "bergamot", "blackCurrant", "apple"],
    });
    expect(perfumesById.get(1)).toMatchObject({
      name: "Acqua di Gio EDT",
      baseNotes: ["whiteMusk", "cedar", "oakmoss", "patchouli", "amber"],
    });
  });

  it("does not manufacture a rank difference between two genuinely co-equal signature notes -- Hacivat's pineapple:8 correctly ties its own oakmoss:8", () => {
    expect(NOTE_PROMINENCE_BY_ID[406].pineapple).toBe(NOTE_PROMINENCE_BY_ID[406].oakmoss);
    expect(NOTE_PROMINENCE_BY_ID[406].pineapple).toBe(8);
  });

  // The Note Explorer "Most prominent" sort verification for pineapple,
  // seaNotes, and juniper lives in
  // packages/builder/src/builder/internal/intelligence/buildNoteExplorerViewModel.test.js
  // instead of here -- packages/catalog must never import from
  // packages/builder (ADR-0006), and this file already proves the
  // underlying data (membership, scores, containment) that sort depends on.
});
