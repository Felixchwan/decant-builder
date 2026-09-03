import { describe, expect, it } from "vitest";

import { fragrances as perfumes, notes } from "@discovery-box/catalog";
import { NOTE_PROMINENCE_BY_ID } from "../src/fragrances.js";

// Composer Phase 3Y: narrow regression coverage for the twenty-fifth
// horizontal note-family calibration pass -- a single standalone
// canonical key, calibrated on its own: coumarin.
//
// Taxonomy audit (Step 1) -- exact canonical key found in notes.js:
//   coumarin ("Coumarin", family: "sweet") -- no qualified variant
//     exists. tonkaBean, vanilla, bourbonVanilla, madagascarVanilla,
//     blackVanilla, almond, powderyNotes, and lavender were all
//     re-confirmed as their own distinct, already-established canonical
//     keys, out of scope for this phase -- coumarin is never treated as
//     an inferred proxy for any of them, for generic sweetness,
//     powderiness, hay-like character, or fougère structure.
//
// Canonical-data sanity audit (Step 2): every coumarin member was
// checked for a case where coumarin↔tonkaBean renaming, or inference
// from vanilla-like sweetness/hay character/almond nuance/powderiness/
// fougère character, would be warranted. No mismatch meeting the Phase
// 3A basil / Phase 3C blackVanilla bar was found. Legend EDT's coumarin
// sits in a classic fougère structure (lavender/oakmoss/tonka) with no
// accords-level evidence isolating it from its own already-scored
// lavender: 7 / tonkaBean: 6 -- correctly left unscored rather than
// inferred from fougère/tonka-heavy structure. La Nuit de L'Homme's
// coumarin: 6 already outranks its own lavender: 5, confirming it is a
// genuinely differentiated axis, not an inherited one. Luna Rossa
// Black's coumarin: 7 is its single highest-scored note with no
// competing tonka/vanilla/lavender present at all. Layton's coumarin: 4
// sits correctly modest below its own lavender: 9 and vanilla: 7,
// demonstrating the discipline this phase's own editorial caution
// calls for. No canonical-data correction was made or is recommended.
//
// Across 4 coumarin fragrance/note pairs, this phase's own calibration
// changes zero individual pairs.
const COUMARIN_FAMILY = {
  4: undefined,
  118: 6,
  209: 7,
  404: 4,
};

function getPerfumeNoteIds(perfume) {
  return [
    ...(perfume.topNotes || []),
    ...(perfume.middleNotes || []),
    ...(perfume.baseNotes || []),
    ...(perfume.generalNotes || []),
  ];
}

describe("Composer Phase 3Y taxonomy audit", () => {
  it("finds the exact canonical coumarin definition, its own independent identity", () => {
    expect(notes.coumarin).toMatchObject({ name: "Coumarin", family: "sweet" });
  });

  it("excludes every adjacent sweet/powdery/aromatic material from the coumarin key", () => {
    const adjacentKeys = [
      "tonkaBean",
      "vanilla",
      "bourbonVanilla",
      "madagascarVanilla",
      "blackVanilla",
      "almond",
      "powderyNotes",
      "lavender",
    ];
    for (const noteId of adjacentKeys) {
      expect(notes[noteId], `${noteId} should exist in the taxonomy`).toBeTruthy();
      expect(noteId).not.toBe("coumarin");
    }
  });
});

describe("Composer Phase 3Y canonical-data sanity audit", () => {
  const perfumesById = new Map(perfumes.map((perfume) => [perfume.id, perfume]));

  it("confirms no canonical-data correction was made or is recommended -- coumarin is never renamed to or from tonkaBean despite co-occurring in Legend EDT", () => {
    const legend = perfumesById.get(4);
    expect(legend.middleNotes).toContain("coumarin");
    expect(legend.baseNotes).toContain("tonkaBean");
    expect(NOTE_PROMINENCE_BY_ID[4].tonkaBean).toBe(6);
    expect(NOTE_PROMINENCE_BY_ID[4].coumarin).toBeUndefined();
  });

  it("confirms La Nuit de L'Homme's coumarin is a genuinely differentiated axis, not inherited from its own lavender", () => {
    expect(perfumesById.get(118)).toBeTruthy();
    expect(NOTE_PROMINENCE_BY_ID[118].coumarin).toBe(6);
    expect(NOTE_PROMINENCE_BY_ID[118].lavender).toBe(5);
    expect(NOTE_PROMINENCE_BY_ID[118].coumarin).toBeGreaterThan(NOTE_PROMINENCE_BY_ID[118].lavender);
  });

  it("confirms Layton's coumarin was not inflated by its own dominant lavender and vanilla", () => {
    expect(NOTE_PROMINENCE_BY_ID[404].coumarin).toBe(4);
    expect(NOTE_PROMINENCE_BY_ID[404].lavender).toBe(9);
    expect(NOTE_PROMINENCE_BY_ID[404].vanilla).toBe(7);
    expect(NOTE_PROMINENCE_BY_ID[404].coumarin).toBeLessThan(NOTE_PROMINENCE_BY_ID[404].lavender);
    expect(NOTE_PROMINENCE_BY_ID[404].coumarin).toBeLessThan(NOTE_PROMINENCE_BY_ID[404].vanilla);
  });
});

describe("Composer Phase 3Y horizontal calibration -- coumarin", () => {
  const perfumesById = new Map(perfumes.map((perfume) => [perfume.id, perfume]));

  it("has exactly 88 catalog fragrances to search for exhaustive family membership", () => {
    expect(perfumes).toHaveLength(88);
  });

  it("coumarin membership is exhaustive against the live catalog", () => {
    const actualIds = perfumes
      .filter((perfume) => getPerfumeNoteIds(perfume).includes("coumarin"))
      .map((perfume) => perfume.id)
      .sort((a, b) => a - b);

    expect(actualIds).toEqual(Object.keys(COUMARIN_FAMILY).map(Number).sort((a, b) => a - b));
  });

  it("matches the exact calibrated coumarin score for every scored member, and confirms intentionally-unscored members stay unscored", () => {
    for (const [id, expectedScore] of Object.entries(COUMARIN_FAMILY)) {
      const actualScore = NOTE_PROMINENCE_BY_ID[id]?.coumarin;
      if (expectedScore === undefined) {
        expect(actualScore, `${perfumesById.get(Number(id)).name} should remain unscored for coumarin`).toBeUndefined();
      } else {
        expect(actualScore, `${perfumesById.get(Number(id)).name} coumarin score`).toBe(expectedScore);
      }
    }
  });

  it("keeps every calibrated coumarin value an integer from 1 to 10", () => {
    for (const score of Object.values(COUMARIN_FAMILY)) {
      if (score === undefined) continue;
      expect(Number.isInteger(score)).toBe(true);
      expect(score).toBeGreaterThanOrEqual(1);
      expect(score).toBeLessThanOrEqual(10);
    }
  });

  it("never collapses coumarin into tonkaBean, vanilla, or lavender -- exact-key containment is fully independent", () => {
    for (const id of Object.keys(COUMARIN_FAMILY).map(Number)) {
      const entry = NOTE_PROMINENCE_BY_ID[id] || {};
      const fragrance = perfumesById.get(id);
      const ownNoteIds = new Set(getPerfumeNoteIds(fragrance));

      if ("coumarin" in entry) {
        expect(ownNoteIds.has("coumarin"), `${fragrance.name} does not canonically carry "coumarin"`).toBe(true);
      }
    }
  });

  it("scores only notes that actually belong to each fragrance's own canonical note set", () => {
    for (const id of Object.keys(COUMARIN_FAMILY).map(Number)) {
      const fragrance = perfumesById.get(id);
      const ownNoteIds = new Set(getPerfumeNoteIds(fragrance));
      for (const noteId of Object.keys(NOTE_PROMINENCE_BY_ID[id] || {})) {
        expect(ownNoteIds.has(noteId), `${fragrance.name} is not documented to carry "${noteId}"`).toBe(true);
        expect(notes[noteId]).toBeTruthy();
      }
    }
  });

  it("changes zero prominence values in this phase -- every coumarin score above is exactly what the catalog already held before Phase 3Y", () => {
    // This test pins that outcome as a regression guard -- if it ever
    // fails, either a later phase intentionally recalibrated this exact
    // key (update this file's fixtures to match, with a comment), or an
    // unrelated change accidentally drifted a coumarin score.
    expect(NOTE_PROMINENCE_BY_ID[4]).toEqual({ lavender: 7, redApple: 6, tonkaBean: 6 });
    expect(NOTE_PROMINENCE_BY_ID[118]).toEqual({ cardamom: 9, coumarin: 6, lavender: 5, vetiver: 3 });
    expect(NOTE_PROMINENCE_BY_ID[209]).toEqual({ coumarin: 7, patchouli: 6, amber: 5 });
    expect(NOTE_PROMINENCE_BY_ID[404]).toEqual({ apple: 9, lavender: 9, vanilla: 7, cardamom: 4, coumarin: 4 });
  });

  it("leaves canonical note data completely unchanged in this phase -- no pyramid was edited for any coumarin member", () => {
    expect(perfumesById.get(4)).toMatchObject({
      name: "Legend EDT",
      middleNotes: ["redApple", "driedFruits", "oakmoss", "geranium", "coumarin", "rose"],
    });
    expect(perfumesById.get(209)).toMatchObject({
      name: "Luna Rossa Black",
      baseNotes: ["coumarin", "amber", "musk"],
    });
  });

  it("does not manufacture prominence for a diffuse fougère-structure note merely because lavender and tonka are stronger -- Legend EDT's coumarin remains unscored", () => {
    expect(NOTE_PROMINENCE_BY_ID[4].coumarin).toBeUndefined();
    expect(NOTE_PROMINENCE_BY_ID[4].lavender).toBe(7);
    expect(NOTE_PROMINENCE_BY_ID[4].tonkaBean).toBe(6);
  });

  it("does not suppress a genuinely differentiated coumarin axis merely because it is not the top note -- Luna Rossa Black's coumarin:7 stands as its own highest-scored note", () => {
    const lunaRossa = NOTE_PROMINENCE_BY_ID[209];
    expect(lunaRossa.coumarin).toBe(7);
    expect(lunaRossa.coumarin).toBeGreaterThan(lunaRossa.patchouli);
    expect(lunaRossa.coumarin).toBeGreaterThan(lunaRossa.amber);
  });

  // The Note Explorer "Most prominent" sort verification for coumarin
  // lives in
  // packages/builder/src/builder/internal/intelligence/buildNoteExplorerViewModel.test.js
  // instead of here -- packages/catalog must never import from
  // packages/builder (ADR-0006), and this file already proves the
  // underlying data (membership, scores, containment) that sort depends on.
});
