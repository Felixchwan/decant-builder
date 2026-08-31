import { describe, expect, it } from "vitest";

import { fragrances as perfumes, notes } from "@discovery-box/catalog";
import { NOTE_PROMINENCE_BY_ID } from "../src/fragrances.js";

// Composer Phase 2H: narrow regression coverage for the fifth real
// editorial note-prominence batch -- continuing the "vertical pass"
// strategy (broad review coverage first; cross-fragrance comparative
// recalibration deferred to a later horizontal pass). Kept as its own
// file, separate from the Phase 2C/2E/2F/2G regression files, per the
// established convention of one narrow regression file per batch.
//
// Selection progressed systematically through the catalog's lowest
// unreviewed ids rather than targeting note families or coverage themes.
// Several of these are smaller mass-market releases with fewer independent
// real-world references than earlier batches' flagship fragrances, so this
// round stayed conservative: no score reaches the 9-10 defining/signature
// band, and several entries carry only two scored notes.
const PHASE_2H_BATCH = {
  2: { lemon: 7, rosemary: 5, patchouli: 4 }, // Phase 3E: added patchouli (horizontal calibration)
  3: { bergamot: 6, musk: 6, cedar: 4 }, // Phase 3C: cedar 5 -> 4 (horizontal calibration)
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

// Pinned exactly as approved in the four prior batches -- this batch must
// never touch them.
const PHASE_2C_BATCH = {
  1: { seaNotes: 10, calone: 9, bergamot: 7, jasmine: 5, whiteMusk: 4 },
  5: { lavender: 9, vanilla: 8, mint: 7, tonkaBean: 5 }, // Phase 3B: mint 6 -> 7 (horizontal calibration)
  111: { orange: 8, vetiver: 8, grapefruit: 7, cedar: 6, pepper: 4, patchouli: 5 }, // Phase 3E: added patchouli (horizontal calibration)
  118: { cardamom: 9, coumarin: 6, lavender: 5, vetiver: 3 },
  202: { ambroxan: 9, bergamot: 7, sichuanPepper: 6, vanilla: 5 },
  208: { iris: 9, neroli: 6, amber: 5, carrotSeeds: 3 },
  303: { akigalawood: 10, ambroxan: 6, basil: 4 },
  304: { madagascarVanilla: 10, cinnamon: 7, tonkaBean: 6, incense: 4 },
  401: { greenTea: 9, blackCurrant: 8, bergamot: 5, musk: 5, mandarin: 4 }, // Phase 3D: added mandarin (horizontal calibration) // Phase 3A: blackCurrant 7 -> 8 (horizontal calibration)
  404: { apple: 9, lavender: 8, vanilla: 7, cardamom: 4, coumarin: 4 }, // Phase 3B: apple 8 -> 9 (horizontal calibration)
  500: { ink: 9, incense: 7, seaSalt: 6, ambergris: 6 },
};

const PHASE_2E_BATCH = {
  13: { tobacco: 8, amber: 6, grapefruit: 6, cardamom: 5, basil: 3 }, // Phase 3A: added basil (horizontal calibration)
  16: { roastedCoffeeBeans: 8, leather: 6, tonkaBean: 6, cinnamon: 5 },
  17: { birchLeaf: 7, incense: 5, pinkPepper: 4, cedar: 4 }, // Phase 3C: added cedar (horizontal calibration)
  18: { pine: 7, fingerLime: 6, eucalyptus: 5, cedarwood: 4 },
  19: { pineapple: 8, birch: 7, blackCurrant: 6, ambergris: 5 }, // Phase 3A: blackCurrant 6 -> 8 -> 6 (final value, swapped with Loewe 7 Cobalt on finalization)
  104: { tonkaBean: 9, lavender: 6, greenMandarin: 5, cedar: 4 },
  113: { cardamom: 7, vanilla: 8, lavender: 6, iris: 4 },
  115: { citron: 8, cedar: 6, blackCurrant: 3 }, // Phase 3C: cedar 5 -> 6 (horizontal calibration) // Phase 3A: blackCurrant 4 -> 3 (horizontal calibration)
  212: { tobacco: 9, vanilla: 8, bourbonVanilla: 8, cinnamon: 6, blackPepper: 5 }, // Phase 3C: vanilla 7 -> 8, bourbonVanilla 7 -> 8 (horizontal calibration)
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
  204: { guaiacWood: 9, chestnut: 7, cloves: 6, vanilla: 4 }, // Phase 3C: vanilla 5 -> 4 (horizontal calibration)
  205: { iris: 8, patchouli: 6, benzoin: 6, cloves: 5, blackVanilla: 6 }, // Phase 3C: canonical correction vanilla -> blackVanilla (Givenchy officially names this base note Black Vanilla)
  213: { ginger: 6, apple: 8, sage: 5 }, // Phase 3B: apple 5 -> 8 (horizontal calibration)
  306: { seaNotes: 6, patchouli: 7, leather: 5, vetiver: 4 },
};

const PHASE_2G_BATCH = {
  14: { leather: 6, cinnamon: 5, vanilla: 5 },
  15: { mango: 6, sandalwood: 5, tonkaBean: 4 },
  22: { spearmint: 7, ambroxan: 5, sandalwood: 4, cedar: 4 }, // Phase 3C: added cedar (horizontal calibration) // Phase 3B: spearmint 6 -> 7 (horizontal calibration)
  23: { oakmoss: 6, leather: 5, jasmine: 4 },
  24: { bloodOrange: 6, cardamom: 5, tonkaBean: 4, grapefruit: 5 }, // Phase 3D: added grapefruit (horizontal calibration)
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

function getPerfumeNoteIds(perfume) {
  return [
    ...(perfume.topNotes || []),
    ...(perfume.middleNotes || []),
    ...(perfume.baseNotes || []),
    ...(perfume.generalNotes || []),
  ];
}

describe("Composer Phase 2H note-prominence seed batch", () => {
  const perfumesById = new Map(perfumes.map((perfume) => [perfume.id, perfume]));

  it("adds this batch's 15 fragrance IDs to NOTE_PROMINENCE_BY_ID", () => {
    // A subset check, not an exact-set check: NOTE_PROMINENCE_BY_ID also
    // holds the later Phase 2I batch (see noteProminenceSeedBatch2I.test.js,
    // which asserts the combined exact key set across all six batches) --
    // this file only proves its own batch's entries are present and
    // correct, so it stays valid as further batches are added.
    for (const id of Object.keys(PHASE_2H_BATCH).map(Number)) {
      expect(NOTE_PROMINENCE_BY_ID).toHaveProperty(String(id));
    }
  });

  it("matches the exact intended score for every fragrance/note pair in this batch", () => {
    for (const [id, expectedScores] of Object.entries(PHASE_2H_BATCH)) {
      expect(NOTE_PROMINENCE_BY_ID[id]).toEqual(expectedScores);
    }
  });

  it("scores only notes that actually belong to each fragrance's own canonical note set", () => {
    for (const [id, entry] of Object.entries(PHASE_2H_BATCH)) {
      const fragrance = perfumesById.get(Number(id));
      const ownNoteIds = new Set(getPerfumeNoteIds(fragrance));

      for (const noteId of Object.keys(entry)) {
        expect(ownNoteIds.has(noteId), `${fragrance.name} is not documented to carry "${noteId}"`).toBe(true);
        expect(notes[noteId]).toBeTruthy();
      }
    }
  });

  it("keeps every value an integer from 1 to 10 -- no zeros, no fractions", () => {
    for (const entry of Object.values(PHASE_2H_BATCH)) {
      for (const value of Object.values(entry)) {
        expect(Number.isInteger(value)).toBe(true);
        expect(value).toBeGreaterThanOrEqual(1);
        expect(value).toBeLessThanOrEqual(10);
      }
    }
  });

  it("leaves at least one of each scored fragrance's own canonical notes deliberately unscored -- sparse coverage remains valid, except the one documented full-coverage exception", () => {
    // Light Blue Pour Homme EDT (2) is a full-coverage exception, in the
    // same spirit as Phase 2E's Armani Code EDT/Orphéon EDP precedent: it
    // is a genuinely minimal composition (exactly 3 canonical notes --
    // lemon top, rosemary middle, patchouli base), and Phase 3E's later
    // horizontal calibration scored the last of the three (patchouli)
    // with real, independent confidence -- not because every note is
    // "easy" to score, but because all 3 happen to be the small,
    // well-characterized set this fragrance is actually built from.
    const fullCoverageExceptionIds = new Set([2]);

    for (const [id, entry] of Object.entries(PHASE_2H_BATCH)) {
      if (fullCoverageExceptionIds.has(Number(id))) {
        continue;
      }

      const fragrance = perfumesById.get(Number(id));
      const ownNoteIds = getPerfumeNoteIds(fragrance);
      const unscoredCount = ownNoteIds.filter((noteId) => !(noteId in entry)).length;

      expect(unscoredCount, `${fragrance.name} should have at least one deliberately unscored note`).toBeGreaterThan(0);
    }
  });

  it("documents the full-coverage exception explicitly: Light Blue Pour Homme EDT has every canonical note scored, not left partially unscored", () => {
    const lightBluePourHomme = perfumesById.get(2);
    const ownNoteIds = getPerfumeNoteIds(lightBluePourHomme);
    expect(ownNoteIds.sort()).toEqual(["lemon", "patchouli", "rosemary"].sort());
    expect(Object.keys(NOTE_PROMINENCE_BY_ID[2]).sort()).toEqual(ownNoteIds.sort());
  });

  it("stays conservative -- no 9-10 defining/signature score appears anywhere in this batch", () => {
    const highScores = Object.entries(PHASE_2H_BATCH).flatMap(([id, entry]) =>
      Object.entries(entry)
        .filter(([, value]) => value >= 9)
        .map(([noteId, value]) => `${id}:${noteId}:${value}`)
    );

    expect(highScores).toEqual([]);
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

  it("leaves every batch fragrance's canonical note pyramid exactly as it was -- this batch adds only editorial metadata", () => {
    expect(perfumesById.get(2)).toMatchObject({
      name: "Light Blue Pour Homme EDT",
      topNotes: ["lemon"],
      middleNotes: ["rosemary"],
      baseNotes: ["patchouli"],
    });
    expect(perfumesById.get(8)).toMatchObject({
      name: "The Most Wanted",
      topNotes: ["cardamom"],
      middleNotes: ["toffee"],
      baseNotes: ["amberwood"],
    });
    expect(perfumesById.get(30)).toMatchObject({
      name: "Vibrant Leather Bogoss",
      topNotes: ["bergamot"],
      baseNotes: ["leather", "woodyNotes"],
    });
  });

  it("never claims any ID belonging to a later batch", () => {
    // As of Phase 2J, every one of the 87 catalog fragrances has a
    // NOTE_PROMINENCE_BY_ID entry, so there is no longer any id that is
    // globally unscored -- see noteProminenceSeedBatch2J.test.js for the
    // "full 87/87 coverage" assertion. This test is now scoped to this
    // batch's own fixture instead: it proves PHASE_2H_BATCH never grew to
    // claim an id that actually belongs to a later phase.
    const laterPhaseIds = [34, 35, 100, 101, 102, 103, 106, 107, 108, 114, 206, 209, 210, 211, 214, 302, 305, 402, 403, 406, 410, 501];
    const batchIds = Object.keys(PHASE_2H_BATCH).map(Number);
    for (const id of laterPhaseIds) {
      expect(batchIds).not.toContain(id);
    }
  });
});
