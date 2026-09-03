import { describe, expect, it } from "vitest";

import { fragrances as perfumes, notes } from "@discovery-box/catalog";
import { NOTE_PROMINENCE_BY_ID } from "../src/fragrances.js";

// Composer Phase 3Q: narrow regression coverage for the seventeenth
// horizontal note-family calibration pass -- two independent standalone
// canonical keys grouped only for workflow efficiency, never as a shared
// semantic family: rosemary and ambroxan.
//
// Taxonomy audit (Step 1) -- exact canonical keys found in notes.js:
//   rosemary ("Rosemary", family: "aromatic") -- no qualified variant
//     exists.
//   ambroxan ("Ambroxan", family: "amber") -- no qualified variant
//     exists.
//   Adjacent keys re-confirmed as their own distinct, already-
//     established identities: sage, clarySage, lavender, basil, mint,
//     spearmint, artemisia, wormwood, eucalyptus (rosemary-adjacent);
//     amber, ambergris, amberwood, ambermax, benzoin, labdanum,
//     opoponax, mineralNotes (ambroxan-adjacent).
//
// Canonical-data sanity audit (Step 2): every rosemary- and ambroxan-
// carrying fragrance was checked for a case where a different explicit
// material would better match its documented identity. No mismatch
// meeting the Phase 3A basil / Phase 3C blackVanilla bar was found. Game
// of Spades Wildcard legitimately carries both ambroxan (scored) and
// generic amber (unscored) as two separately-documented base materials,
// never conflated. No canonical-data correction was made in this phase.
//
// Across 8 rosemary and 7 ambroxan fragrance/note pairs, this phase's own
// calibration changes zero individual pairs. Every already-scored entry
// held up as internally consistent, including Sauvage EDP's ambroxan: 9
// (correctly the family's highest score, its own universally-cited
// defining signature material). Montblanc Legend Blue's ambroxan: 5,
// scored well below its own spearmint: 7, was specifically weighed
// against this phase's caution not to under-score a genuinely defining
// axis -- but the available evidence for treating the two as a
// documented, co-equal dual signature did not clear the correction bar's
// explicit-identity/high-confidence threshold, and the score was left
// unchanged. Versace Pour Homme, Sauvage Elixir, and Dior Homme Sport
// were checked and confirmed not members of either family.
const ROSEMARY_FAMILY = {
  1: undefined,
  2: 5,
  9: undefined,
  10: undefined,
  29: undefined,
  33: undefined,
  101: undefined,
  408: 5,
};

const AMBROXAN_FAMILY = {
  6: 7,
  22: 5,
  25: undefined,
  114: 6,
  202: 9,
  207: 4,
  303: 6,
};

const ALL_FAMILIES = {
  rosemary: ROSEMARY_FAMILY,
  ambroxan: AMBROXAN_FAMILY,
};

const ROSEMARY_ADJACENT_EXCLUDED_KEYS = ["sage", "clarySage", "lavender", "basil", "mint", "spearmint", "artemisia", "wormwood", "eucalyptus"];
const AMBROXAN_ADJACENT_EXCLUDED_KEYS = ["amber", "ambergris", "amberwood", "ambermax", "benzoin", "labdanum", "opoponax", "mineralNotes"];

function getPerfumeNoteIds(perfume) {
  return [
    ...(perfume.topNotes || []),
    ...(perfume.middleNotes || []),
    ...(perfume.baseNotes || []),
    ...(perfume.generalNotes || []),
  ];
}

describe("Composer Phase 3Q taxonomy audit", () => {
  it("finds the exact canonical rosemary and ambroxan definitions -- two independent standalone keys, not a shared family", () => {
    expect(notes.rosemary).toMatchObject({ name: "Rosemary", family: "aromatic" });
    expect(notes.ambroxan).toMatchObject({ name: "Ambroxan", family: "amber" });
  });

  it("excludes every rosemary-adjacent aromatic/herbal material", () => {
    for (const noteId of ROSEMARY_ADJACENT_EXCLUDED_KEYS) {
      expect(notes[noteId], `${noteId} should exist in the taxonomy`).toBeTruthy();
      expect(noteId).not.toBe("rosemary");
    }
  });

  it("excludes every ambroxan-adjacent amber/mineral/synthetic material", () => {
    for (const noteId of AMBROXAN_ADJACENT_EXCLUDED_KEYS) {
      expect(notes[noteId], `${noteId} should exist in the taxonomy`).toBeTruthy();
      expect(noteId).not.toBe("ambroxan");
    }
  });
});

describe("Composer Phase 3Q canonical-data sanity audit", () => {
  const perfumesById = new Map(perfumes.map((perfume) => [perfume.id, perfume]));

  it("confirms no canonical-data correction was made or is recommended -- Game of Spades Wildcard legitimately carries both ambroxan and generic amber as distinct, separately-documented base materials", () => {
    const gameOfSpadesWildcard = perfumesById.get(114);
    expect(gameOfSpadesWildcard.baseNotes).toContain("ambroxan");
    expect(gameOfSpadesWildcard.baseNotes).toContain("amber");
    expect(NOTE_PROMINENCE_BY_ID[114].ambroxan).toBe(6);
    expect(NOTE_PROMINENCE_BY_ID[114].amber).toBeUndefined();
  });

  it("confirms Versace Pour Homme, Sauvage Elixir, and Dior Homme Sport are not members of either family", () => {
    for (const id of [3, 402, 201]) {
      const ownNoteIds = getPerfumeNoteIds(perfumesById.get(id));
      expect(ownNoteIds).not.toContain("rosemary");
      expect(ownNoteIds).not.toContain("ambroxan");
    }
  });
});

describe("Composer Phase 3Q horizontal calibration -- rosemary and ambroxan", () => {
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

  it("keeps every calibrated rosemary/ambroxan value an integer from 1 to 10", () => {
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

  it("changes zero prominence values in this phase -- every rosemary/ambroxan score above is exactly what the catalog already held before Phase 3Q", () => {
    // This test pins that outcome as a regression guard -- if it ever
    // fails, either a later phase intentionally recalibrated one of these
    // exact keys (update this file's fixtures to match, with a comment),
    // or an unrelated change accidentally drifted a rosemary/ambroxan
    // score.
    expect(NOTE_PROMINENCE_BY_ID[2]).toEqual({ lemon: 7, rosemary: 5, patchouli: 4 });
    expect(NOTE_PROMINENCE_BY_ID[408]).toEqual({ mint: 9, basil: 8, rosemary: 5, blackCurrant: 3 });
    expect(NOTE_PROMINENCE_BY_ID[6]).toEqual({ ambroxan: 7, vanilla: 7, mint: 5, candyApple: 5 });
    expect(NOTE_PROMINENCE_BY_ID[22]).toEqual({ spearmint: 7, ambroxan: 5, sandalwood: 4, cedar: 4 });
    expect(NOTE_PROMINENCE_BY_ID[202]).toEqual({ ambroxan: 9, bergamot: 7, sichuanPepper: 6, vanilla: 5 });
  });

  it("leaves canonical note data completely unchanged in this phase -- no pyramid was edited for any rosemary/ambroxan member", () => {
    expect(perfumesById.get(2)).toMatchObject({
      name: "Light Blue Pour Homme EDT",
      topNotes: ["lemon"],
      middleNotes: ["rosemary"],
      baseNotes: ["patchouli"],
    });
    expect(perfumesById.get(202)).toMatchObject({
      name: "Sauvage EDP",
      baseNotes: ["ambroxan", "vanilla"],
    });
  });

  it("considered, and rejected, raising Legend Blue's ambroxan to match its own spearmint -- the available evidence for a documented co-equal dual signature did not clear the correction bar's high-confidence threshold", () => {
    expect(NOTE_PROMINENCE_BY_ID[22].spearmint).toBe(7);
    expect(NOTE_PROMINENCE_BY_ID[22].ambroxan).toBe(5);
  });

  it("does not under-score a genuinely defining ambroxan axis -- Sauvage EDP's ambroxan:9 remains the family's highest score", () => {
    const allAmbroxanScores = Object.values(AMBROXAN_FAMILY).filter((score) => score !== undefined);
    expect(Math.max(...allAmbroxanScores)).toBe(9);
    expect(NOTE_PROMINENCE_BY_ID[202].ambroxan).toBe(9);
  });

  // The Note Explorer "Most prominent" sort verification for rosemary and
  // ambroxan lives in
  // packages/builder/src/builder/internal/intelligence/buildNoteExplorerViewModel.test.js
  // instead of here -- packages/catalog must never import from
  // packages/builder (ADR-0006), and this file already proves the
  // underlying data (membership, scores, containment) that sort depends on.
});
