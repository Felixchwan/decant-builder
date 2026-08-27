import { describe, expect, it } from "vitest";

import { fragrances as perfumes, notes } from "@discovery-box/catalog";
import { NOTE_PROMINENCE_BY_ID } from "../src/fragrances.js";

// Composer Phase 2J: narrow regression coverage for the seventh and final
// editorial batch of the vertical pass -- completing first-pass review
// coverage of the full 87-fragrance catalog. Kept as its own file,
// separate from the Phase 2C/2E/2F/2G/2H/2I regression files, per the
// established convention of one narrow regression file per batch.
//
// Four of these (Carlisle, Hacivat, Il Padrino, Tuxedo) were reviewed
// under a stricter bar because they were previously deferred or flagged
// for uncertainty: Carlisle and Il Padrino were dropped from an earlier
// Phase 2C draft for leaning on textual/marketing consensus rather than
// confident perceptual judgment, and Hacivat was skipped in Phase 2G
// pending a closer look at its own catalog note data. All four are scored
// only from what the catalog's own note pyramid and accord list actually
// show, never from an outside marketing description. Hacivat's
// recognizable profile is centered on its pineapple/citrus, woody, and
// oakmoss character -- borne out directly by its own note pyramid and by
// "oakmoss" appearing as one of its own listed accords -- so it carries 4
// scored notes here, more than the other three stricter-bar entries (2
// notes each). Tuxedo's patchouli:9 is the one defining/signature score in
// this batch, grounded in three independent internal signals (the
// "patchouli" accord listed first, patchouli present in the base notes,
// and the catalog's own shipped subtitle "Sharp Patchouli"), not merely
// inferred from a name or marketing claim.
const PHASE_2J_BATCH = {
  302: { grapefruit: 7, whiteMusk: 6, amber: 5 },
  305: { bitterOrange: 7, australianSandalwood: 7, basil: 5 }, // Phase 3A: added basil (horizontal calibration)
  402: { licorice: 8, cinnamon: 7, nutmeg: 6 },
  403: { tonkaBean: 5, vanilla: 5 },
  406: { pineapple: 8, oakmoss: 8, cedar: 5, patchouli: 4 },
  410: { patchouli: 6, vanilla: 5 },
  501: { patchouli: 9, bourbonVanilla: 5 },
};

// Pinned exactly as approved in the six prior batches -- this batch must
// never touch them.
const PHASE_2C_BATCH = {
  1: { seaNotes: 10, calone: 9, bergamot: 7, jasmine: 5, whiteMusk: 4 },
  5: { lavender: 9, vanilla: 8, mint: 6, tonkaBean: 5 },
  111: { orange: 8, vetiver: 8, grapefruit: 7, cedar: 6, pepper: 4 },
  118: { cardamom: 9, coumarin: 6, lavender: 5, vetiver: 3 },
  202: { ambroxan: 9, bergamot: 7, sichuanPepper: 6, vanilla: 5 },
  208: { iris: 9, neroli: 6, amber: 5, carrotSeeds: 3 },
  303: { akigalawood: 10, ambroxan: 6, basil: 4 },
  304: { madagascarVanilla: 10, cinnamon: 7, tonkaBean: 6, incense: 4 },
  401: { greenTea: 9, blackCurrant: 8, bergamot: 5, musk: 5 }, // Phase 3A: blackCurrant 7 -> 8 (horizontal calibration)
  404: { apple: 8, lavender: 8, vanilla: 7, cardamom: 4, coumarin: 4 },
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
  213: { ginger: 6, apple: 5, sage: 5 },
  306: { seaNotes: 6, patchouli: 7, leather: 5, vetiver: 4 },
};

const PHASE_2G_BATCH = {
  14: { leather: 6, cinnamon: 5, vanilla: 5 },
  15: { mango: 6, sandalwood: 5, tonkaBean: 4 },
  22: { spearmint: 6, ambroxan: 5, sandalwood: 4 },
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
  6: { ambroxan: 7, vanilla: 7, mint: 5 },
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
  211: { tobacco: 6, redApple: 5 },
  214: { iris: 6, powderyNotes: 6, neroli: 5 },
};

function getPerfumeNoteIds(perfume) {
  return [
    ...(perfume.topNotes || []),
    ...(perfume.middleNotes || []),
    ...(perfume.baseNotes || []),
    ...(perfume.generalNotes || []),
  ];
}

describe("Composer Phase 2J note-prominence seed batch (final vertical-pass batch)", () => {
  const perfumesById = new Map(perfumes.map((perfume) => [perfume.id, perfume]));

  it("adds exactly this batch's 7 fragrance IDs on top of all six prior batches", () => {
    const allExpectedIds = [
      ...Object.keys(PHASE_2J_BATCH),
      ...Object.keys(PHASE_2C_BATCH),
      ...Object.keys(PHASE_2E_BATCH),
      ...Object.keys(PHASE_2F_BATCH),
      ...Object.keys(PHASE_2G_BATCH),
      ...Object.keys(PHASE_2H_BATCH),
      ...Object.keys(PHASE_2I_BATCH),
    ]
      .map(Number)
      .sort((a, b) => a - b);
    const actualIds = Object.keys(NOTE_PROMINENCE_BY_ID).map(Number).sort((a, b) => a - b);

    expect(actualIds).toEqual(allExpectedIds);
  });

  it("matches the exact intended score for every fragrance/note pair in this batch", () => {
    for (const [id, expectedScores] of Object.entries(PHASE_2J_BATCH)) {
      expect(NOTE_PROMINENCE_BY_ID[id]).toEqual(expectedScores);
    }
  });

  it("scores only notes that actually belong to each fragrance's own canonical note set", () => {
    for (const [id, entry] of Object.entries(PHASE_2J_BATCH)) {
      const fragrance = perfumesById.get(Number(id));
      const ownNoteIds = new Set(getPerfumeNoteIds(fragrance));

      for (const noteId of Object.keys(entry)) {
        expect(ownNoteIds.has(noteId), `${fragrance.name} is not documented to carry "${noteId}"`).toBe(true);
        expect(notes[noteId]).toBeTruthy();
      }
    }
  });

  it("keeps every value an integer from 1 to 10 -- no zeros, no fractions", () => {
    for (const entry of Object.values(PHASE_2J_BATCH)) {
      for (const value of Object.values(entry)) {
        expect(Number.isInteger(value)).toBe(true);
        expect(value).toBeGreaterThanOrEqual(1);
        expect(value).toBeLessThanOrEqual(10);
      }
    }
  });

  it("leaves at least one of each scored fragrance's own canonical notes deliberately unscored -- sparse coverage remains valid, especially for the four stricter-bar entries", () => {
    for (const [id, entry] of Object.entries(PHASE_2J_BATCH)) {
      const fragrance = perfumesById.get(Number(id));
      const ownNoteIds = getPerfumeNoteIds(fragrance);
      const unscoredCount = ownNoteIds.filter((noteId) => !(noteId in entry)).length;

      expect(unscoredCount, `${fragrance.name} should have at least one deliberately unscored note`).toBeGreaterThan(0);
    }
  });

  it("scores Carlisle, Il Padrino, and Tuxedo with only 2 notes each, reflecting the stricter review bar applied to previously-deferred/flagged fragrances", () => {
    const twoNoteStrictBarIds = [403, 410, 501];
    for (const id of twoNoteStrictBarIds) {
      expect(Object.keys(PHASE_2J_BATCH[id])).toHaveLength(2);
    }
  });

  it("scores Hacivat's pineapple/citrus, woody, and oakmoss character with 4 notes, all drawn directly from its own note pyramid and accord list", () => {
    const hacivat = perfumesById.get(406);
    const hacivatNoteIds = new Set(getPerfumeNoteIds(hacivat));

    expect(Object.keys(PHASE_2J_BATCH[406])).toHaveLength(4);
    for (const noteId of Object.keys(PHASE_2J_BATCH[406])) {
      expect(hacivatNoteIds.has(noteId), `Hacivat is not documented to carry "${noteId}"`).toBe(true);
    }
    // "oakmoss" is one of Hacivat's own listed accords, not just a note
    // buried in its pyramid -- a direct internal signal for the score.
    expect(hacivat.accords).toContain("oakmoss");
  });

  it("scores Orange X Santal through its generalNotes shape, not an invented pyramid", () => {
    const orangeXSantal = perfumesById.get(305);
    expect(orangeXSantal.topNotes).toEqual([]);
    expect(orangeXSantal.middleNotes).toEqual([]);
    expect(orangeXSantal.baseNotes).toEqual([]);
    expect(orangeXSantal.generalNotes).toEqual(
      expect.arrayContaining(["bitterOrange", "australianSandalwood", "cypress", "basil", "oakmoss"])
    );
  });

  it("has exactly one 9-10 score in this batch (Tuxedo's patchouli) -- the vertical pass stayed conservative on defining/signature claims", () => {
    const nineOrTenScores = Object.entries(PHASE_2J_BATCH).flatMap(([id, entry]) =>
      Object.entries(entry)
        .filter(([, value]) => value >= 9)
        .map(([noteId, value]) => `${id}:${noteId}:${value}`)
    );

    expect(nineOrTenScores).toEqual(["501:patchouli:9"]);
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

  it("leaves every Phase 2I entry exactly as previously approved -- this batch never revises them", () => {
    for (const [id, expectedScores] of Object.entries(PHASE_2I_BATCH)) {
      expect(NOTE_PROMINENCE_BY_ID[id]).toEqual(expectedScores);
    }
  });

  it("leaves every batch fragrance's canonical note pyramid exactly as it was -- this batch adds only editorial metadata", () => {
    expect(perfumesById.get(403)).toMatchObject({
      name: "Carlisle",
      topNotes: ["nutmeg", "greenApple", "saffron"],
      middleNotes: ["tonkaBean", "rose", "osmanthus", "davana"],
      baseNotes: ["patchouli", "vanilla", "opoponax"],
    });
    expect(perfumesById.get(406)).toMatchObject({
      name: "Hacivat",
      topNotes: ["bergamot", "pineapple", "grapefruit"],
      baseNotes: ["woodyNotes", "oakmoss", "cedar"],
    });
    expect(perfumesById.get(410)).toMatchObject({
      name: "Il Padrino",
      topNotes: ["blackCurrant", "rum", "amaretto", "bergamot"],
      baseNotes: ["vanilla", "siamBenzoin", "labdanum"],
    });
    expect(perfumesById.get(501)).toMatchObject({
      name: "Tuxedo",
      subtitle: "Sharp Patchouli",
      baseNotes: ["patchouli", "bourbonVanilla", "ambergris"],
    });
  });

  it("covers exactly 87/87 catalog fragrances with a NOTE_PROMINENCE_BY_ID entry -- the vertical pass is complete", () => {
    expect(perfumes).toHaveLength(87);
    expect(Object.keys(NOTE_PROMINENCE_BY_ID)).toHaveLength(87);

    for (const perfume of perfumes) {
      expect(NOTE_PROMINENCE_BY_ID, `${perfume.name} (id ${perfume.id}) should have a prominence entry`).toHaveProperty(
        String(perfume.id)
      );
    }
  });

  it("leaves no fragrance with the never-reviewed default-empty prominence object -- every fragrance now has at least one editorial score", () => {
    for (const perfume of perfumes) {
      expect(Object.keys(perfume.noteProminence).length, `${perfume.name} should have at least one score`).toBeGreaterThan(0);
    }
  });
});
