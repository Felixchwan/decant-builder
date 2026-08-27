import { describe, expect, it } from "vitest";

import { fragrances as perfumes, notes } from "@discovery-box/catalog";
import { NOTE_PROMINENCE_BY_ID } from "../src/fragrances.js";

// Composer Phase 2I: narrow regression coverage for the sixth real
// editorial note-prominence batch -- continuing the "vertical pass"
// strategy (broad review coverage first; cross-fragrance comparative
// recalibration deferred to a later horizontal pass). Kept as its own
// file, separate from the Phase 2C/2E/2F/2G/2H regression files, per the
// established convention of one narrow regression file per batch.
//
// Selection progressed systematically through the remaining unreviewed
// ids. Includes three generalNotes-only fragrances of varying density
// (Graphite at 4 notes, Essenza at 17) and two flanker pairs (Prada
// L'Homme/L'Homme L'Eau, Born In Roma EDT/Coral Fantasy) exercising the
// fragrance-specific-not-note-specific rule again. Only one score in this
// batch reaches the defining/signature band: Fico di Amalfi's figNectar
// at 9, justified by independent real-world documentation of fig as this
// fragrance's genuinely central, unusually distinctive perceptual
// identity (an uncommon accord across the wider catalog), not merely
// inferred from the fragrance's name.
const PHASE_2I_BATCH = {
  34: { grapefruit: 7, vetiver: 6, olibanum: 5 },
  35: { leatherwood: 7, sage: 5 },
  100: { sicilianMandarin: 7, caramel: 5, petitgrain: 5 },
  101: { bergamot: 7, jasmine: 5, patchouli: 4 },
  102: { figNectar: 9, figTree: 6, citron: 5 },
  103: { greenMandarin: 7, petitgrain: 5, spearmint: 5 },
  106: { blackVanilla: 7, anise: 6 },
  107: { passionFruit: 6, frangipani: 5 },
  108: { truffle: 7, plum: 5 },
  114: { ambroxan: 6, apple: 4 },
  206: { vetiver: 6, patchouli: 6, pinkPepper: 5 },
  209: { coumarin: 7, patchouli: 6, amber: 5 },
  210: { seaSalt: 7, vetiver: 6 },
  211: { tobacco: 6, redApple: 7 }, // Phase 3B: redApple 5 -> 7 (horizontal calibration)
  214: { iris: 6, powderyNotes: 6, neroli: 5 },
};

// Pinned exactly as approved in the five prior batches -- this batch must
// never touch them.
const PHASE_2C_BATCH = {
  1: { seaNotes: 10, calone: 9, bergamot: 7, jasmine: 5, whiteMusk: 4 },
  5: { lavender: 9, vanilla: 8, mint: 7, tonkaBean: 5 }, // Phase 3B: mint 6 -> 7 (horizontal calibration)
  111: { orange: 8, vetiver: 8, grapefruit: 7, cedar: 6, pepper: 4 },
  118: { cardamom: 9, coumarin: 6, lavender: 5, vetiver: 3 },
  202: { ambroxan: 9, bergamot: 7, sichuanPepper: 6, vanilla: 5 },
  208: { iris: 9, neroli: 6, amber: 5, carrotSeeds: 3 },
  303: { akigalawood: 10, ambroxan: 6, basil: 4 },
  304: { madagascarVanilla: 10, cinnamon: 7, tonkaBean: 6, incense: 4 },
  401: { greenTea: 9, blackCurrant: 8, bergamot: 5, musk: 5 }, // Phase 3A: blackCurrant 7 -> 8 (horizontal calibration)
  404: { apple: 9, lavender: 8, vanilla: 7, cardamom: 4, coumarin: 4 }, // Phase 3B: apple 8 -> 9 (horizontal calibration)
  500: { ink: 9, incense: 7, seaSalt: 6, ambergris: 6 },
};

const PHASE_2E_BATCH = {
  13: { tobacco: 8, amber: 6, grapefruit: 6, cardamom: 5, basil: 3 }, // Phase 3A: added basil (horizontal calibration)
  16: { roastedCoffeeBeans: 8, leather: 6, tonkaBean: 6, cinnamon: 5 },
  17: { birchLeaf: 7, incense: 5, pinkPepper: 4 },
  18: { pine: 7, fingerLime: 6, eucalyptus: 5, cedarwood: 4 },
  19: { pineapple: 8, birch: 7, blackCurrant: 6, ambergris: 5 }, // Phase 3A: blackCurrant 6 -> 8 -> 6 (final value, swapped with Loewe 7 Cobalt on finalization)
  104: { tonkaBean: 9, lavender: 6, greenMandarin: 5, cedar: 4 },
  113: { cardamom: 7, vanilla: 8, lavender: 6, iris: 4 },
  115: { citron: 8, cedar: 5, blackCurrant: 3 }, // Phase 3A: blackCurrant 4 -> 3 (horizontal calibration)
  212: { tobacco: 9, vanilla: 7, bourbonVanilla: 7, cinnamon: 6, blackPepper: 5 },
  301: { sandalwood: 7, madagascarVanilla: 6, lemon: 5 },
  408: { mint: 9, basil: 8, rosemary: 5, blackCurrant: 3 }, // Phase 3A: basil 6 -> 8, blackCurrant 4 -> 3 (horizontal calibration)
  409: { powderyNotes: 7, juniper: 6, cedar: 6, jasmine: 5, tonkaBean: 4 },
};

const PHASE_2F_BATCH = {
  7: { leather: 8, ginger: 7, maninka: 5 },
  9: { musk: 8, sage: 5, vetiver: 5 },
  10: { almond: 8, tonkaBean: 6, bitterOrange: 5, leather: 4 },
  11: { caramel: 8, tonkaBean: 6, mandarinOrange: 4 },
  12: { leather: 7, suede: 6, sugar: 6, grass: 5 },
  110: { orange: 8, mint: 6, patchouli: 5, bitterOrange: 5, basil: 8 }, // Phase 3A correction: added basil (canonical-data correction + horizontal calibration)
  119: { seaNotes: 6, basil: 7, lemon: 5 }, // Phase 3A: basil 5 -> 7 (horizontal calibration)
  203: { incense: 6, sage: 6, cloves: 4, blackCurrant: 8 }, // Phase 3A: added blackCurrant, final value 8 (swapped with Club de Nuit Intense Man on finalization)
  204: { guaiacWood: 9, chestnut: 7, cloves: 6, vanilla: 5 },
  205: { iris: 8, patchouli: 6, benzoin: 6, cloves: 5 },
  213: { ginger: 6, apple: 8, sage: 5 }, // Phase 3B: apple 5 -> 8 (horizontal calibration)
  306: { seaNotes: 6, patchouli: 7, leather: 5, vetiver: 4 },
};

const PHASE_2G_BATCH = {
  14: { leather: 6, cinnamon: 5, vanilla: 5 },
  15: { mango: 6, sandalwood: 5, tonkaBean: 4 },
  22: { spearmint: 7, ambroxan: 5, sandalwood: 4 }, // Phase 3B: spearmint 6 -> 7 (horizontal calibration)
  23: { oakmoss: 6, leather: 5, jasmine: 4 },
  24: { bloodOrange: 6, cardamom: 5, tonkaBean: 4 },
  25: { leather: 7, haitianVetiver: 6, akigalawood: 5, patchouli: 4 },
  105: { greenTea: 7, whiteLotus: 5, mineralNotes: 4 },
  109: { leather: 6, patchouli: 5, fig: 4 },
  112: { coconut: 9, pineapple: 6, tonkaBean: 5 },
  116: { vanilla: 5, tonkaBean: 5, pinkPepper: 4 },
  117: { ginger: 6, basil: 5, tonkaBean: 5, cedar: 4 },
  201: { aldehydes: 6, elemi: 5 },
  207: { seaNotes: 6, greenMango: 5, ambroxan: 4 },
  405: { iris: 6, grapefruit: 5, rose: 4 },
  407: { coconut: 7, pineapple: 6, seaNotes: 5, musk: 4 },
};

const PHASE_2H_BATCH = {
  2: { lemon: 7, rosemary: 5 },
  3: { bergamot: 6, musk: 6, cedar: 5 },
  4: { lavender: 7, redApple: 6, tonkaBean: 6 },
  6: { ambroxan: 7, vanilla: 7, mint: 5, candyApple: 5 }, // Phase 3B: added candyApple (horizontal calibration)
  8: { cardamom: 8, toffee: 7 },
  20: { lavender: 7, amber: 6, tonkaBean: 5 },
  21: { vanilla: 6, cinnamon: 5, patchouli: 5 },
  26: { grapefruit: 7, roastedCoffeeBeans: 7, amber: 5 },
  27: { whiteMusk: 6, vetiver: 5 },
  28: { orange: 6, apple: 5, amber: 5 },
  29: { vanilla: 7, chinotto: 6, tonkaBean: 5 },
  30: { leather: 7, bergamot: 5 },
  31: { amber: 5, cardamom: 5 },
  32: { suede: 5, amber: 5 },
  33: { cashmeran: 6, patchouli: 5, apple: 4 },
};

function getPerfumeNoteIds(perfume) {
  return [
    ...(perfume.topNotes || []),
    ...(perfume.middleNotes || []),
    ...(perfume.baseNotes || []),
    ...(perfume.generalNotes || []),
  ];
}

describe("Composer Phase 2I note-prominence seed batch", () => {
  const perfumesById = new Map(perfumes.map((perfume) => [perfume.id, perfume]));

  it("adds this batch's 15 fragrance IDs to NOTE_PROMINENCE_BY_ID", () => {
    // A subset check, not an exact-set check: NOTE_PROMINENCE_BY_ID also
    // holds the later, final Phase 2J batch (see
    // noteProminenceSeedBatch2J.test.js, which asserts the full 87/87
    // catalog coverage) -- this file only proves its own batch's entries
    // are present and correct, so it stays valid now that the vertical
    // pass is complete.
    for (const id of Object.keys(PHASE_2I_BATCH).map(Number)) {
      expect(NOTE_PROMINENCE_BY_ID).toHaveProperty(String(id));
    }
  });

  it("matches the exact intended score for every fragrance/note pair in this batch", () => {
    for (const [id, expectedScores] of Object.entries(PHASE_2I_BATCH)) {
      expect(NOTE_PROMINENCE_BY_ID[id]).toEqual(expectedScores);
    }
  });

  it("scores only notes that actually belong to each fragrance's own canonical note set", () => {
    for (const [id, entry] of Object.entries(PHASE_2I_BATCH)) {
      const fragrance = perfumesById.get(Number(id));
      const ownNoteIds = new Set(getPerfumeNoteIds(fragrance));

      for (const noteId of Object.keys(entry)) {
        expect(ownNoteIds.has(noteId), `${fragrance.name} is not documented to carry "${noteId}"`).toBe(true);
        expect(notes[noteId]).toBeTruthy();
      }
    }
  });

  it("keeps every value an integer from 1 to 10 -- no zeros, no fractions", () => {
    for (const entry of Object.values(PHASE_2I_BATCH)) {
      for (const value of Object.values(entry)) {
        expect(Number.isInteger(value)).toBe(true);
        expect(value).toBeGreaterThanOrEqual(1);
        expect(value).toBeLessThanOrEqual(10);
      }
    }
  });

  it("leaves at least one of each scored fragrance's own canonical notes deliberately unscored -- sparse coverage remains valid, including for the two generalNotes-only fragrances of very different density", () => {
    for (const [id, entry] of Object.entries(PHASE_2I_BATCH)) {
      const fragrance = perfumesById.get(Number(id));
      const ownNoteIds = getPerfumeNoteIds(fragrance);
      const unscoredCount = ownNoteIds.filter((noteId) => !(noteId in entry)).length;

      expect(unscoredCount, `${fragrance.name} should have at least one deliberately unscored note`).toBeGreaterThan(0);
    }
  });

  it("scores Graphite and Essenza through their generalNotes shape, not an invented pyramid", () => {
    const graphite = perfumesById.get(35);
    expect(graphite.topNotes || []).toEqual([]);
    expect(graphite.middleNotes || []).toEqual([]);
    expect(graphite.baseNotes || []).toEqual([]);
    expect(graphite.generalNotes).toEqual(
      expect.arrayContaining(["bergamot", "sage", "spices", "leatherwood"])
    );

    const essenza = perfumesById.get(101);
    expect(essenza.topNotes).toEqual([]);
    expect(essenza.middleNotes).toEqual([]);
    expect(essenza.baseNotes).toEqual([]);
    expect(essenza.generalNotes.length).toBeGreaterThan(10);
  });

  it("has exactly one 9-10 score in this batch (Fico di Amalfi's figNectar) -- the vertical pass stayed conservative on defining/signature claims", () => {
    const nineOrTenScores = Object.entries(PHASE_2I_BATCH).flatMap(([id, entry]) =>
      Object.entries(entry)
        .filter(([, value]) => value >= 9)
        .map(([noteId, value]) => `${id}:${noteId}:${value}`)
    );

    expect(nineOrTenScores).toEqual(["102:figNectar:9"]);
  });

  it("scores the same note differently across each flanker pair, per the fragrance-specific-not-note-specific rule", () => {
    // Prada L'Homme (208, Phase 2C) vs. its lighter L'Homme L'Eau flanker
    // (214, this batch): iris is the shared defining concept, but scored
    // lower here to reflect the L'Eau's genuinely fresher, less concentrated
    // character -- never inferred from the original's score.
    expect(NOTE_PROMINENCE_BY_ID[208].iris).toBe(9);
    expect(NOTE_PROMINENCE_BY_ID[214].iris).toBe(6);

    // Born In Roma EDT (210, this batch) vs. Coral Fantasy (211, this
    // batch): vetiver is confidently scored in the EDT's woodier base but
    // deliberately left unscored in the fruitier Coral Fantasy flanker.
    expect(NOTE_PROMINENCE_BY_ID[210].vetiver).toBe(6);
    expect(NOTE_PROMINENCE_BY_ID[211].vetiver).toBeUndefined();
  });

  it("leaves every Phase 2C entry exactly as previously approved -- this batch never revises them", () => {
    for (const [id, expectedScores] of Object.entries(PHASE_2C_BATCH)) {
      expect(NOTE_PROMINENCE_BY_ID[id]).toEqual(expectedScores);
    }
  });

  it("leaves every Phase 2E entry exactly as previously approved -- this batch never revises them", () => {
    for (const [id, expectedScores] of Object.entries(PHASE_2E_BATCH)) {
      expect(NOTE_PROMINENCE_BY_ID[id]).toEqual(expectedScores);
    }
  });

  it("leaves every Phase 2F entry exactly as previously approved -- this batch never revises them", () => {
    for (const [id, expectedScores] of Object.entries(PHASE_2F_BATCH)) {
      expect(NOTE_PROMINENCE_BY_ID[id]).toEqual(expectedScores);
    }
  });

  it("leaves every Phase 2G entry exactly as previously approved -- this batch never revises them", () => {
    for (const [id, expectedScores] of Object.entries(PHASE_2G_BATCH)) {
      expect(NOTE_PROMINENCE_BY_ID[id]).toEqual(expectedScores);
    }
  });

  it("leaves every Phase 2H entry exactly as previously approved -- this batch never revises them", () => {
    for (const [id, expectedScores] of Object.entries(PHASE_2H_BATCH)) {
      expect(NOTE_PROMINENCE_BY_ID[id]).toEqual(expectedScores);
    }
  });

  it("leaves every batch fragrance's canonical note pyramid exactly as it was -- this batch adds only editorial metadata", () => {
    expect(perfumesById.get(34)).toMatchObject({
      name: "Givenchy Pour Homme Blue Label",
      topNotes: ["grapefruit", "bergamot"],
      baseNotes: ["vetiver", "olibanum", "cedarwood"],
    });
    expect(perfumesById.get(102)).toMatchObject({
      name: "Fico di Amalfi",
      middleNotes: ["figNectar", "jasmine", "pinkPepper"],
      baseNotes: ["figTree", "cedar", "benzoin"],
    });
    expect(perfumesById.get(208)).toMatchObject({
      name: "Prada L'Homme",
      middleNotes: ["iris", "violet", "geranium"],
    });
    expect(perfumesById.get(214)).toMatchObject({
      name: "Prada L'Homme L'Eau",
      middleNotes: ["iris", "amber"],
    });
    expect(perfumesById.get(210)).toMatchObject({
      name: "Born In Roma EDT",
      topNotes: ["mineralNotes", "violetLeaf", "seaSalt"],
    });
    expect(perfumesById.get(211)).toMatchObject({
      name: "Born In Roma Coral Fantasy",
      baseNotes: ["tobacco", "patchouli", "vetiver"],
    });
  });

  it("never claims any ID belonging to a later batch", () => {
    // As of Phase 2J, every one of the 87 catalog fragrances has a
    // NOTE_PROMINENCE_BY_ID entry, so there is no longer any id that is
    // globally unscored -- see noteProminenceSeedBatch2J.test.js for the
    // "full 87/87 coverage" assertion. This test is now scoped to this
    // batch's own fixture instead: it proves PHASE_2I_BATCH never grew to
    // claim an id that actually belongs to the later Phase 2J batch.
    const laterPhaseIds = [302, 305, 402, 403, 406, 410, 501];
    const batchIds = Object.keys(PHASE_2I_BATCH).map(Number);
    for (const id of laterPhaseIds) {
      expect(batchIds).not.toContain(id);
    }
  });
});
