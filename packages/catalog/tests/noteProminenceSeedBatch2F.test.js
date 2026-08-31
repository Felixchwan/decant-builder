import { describe, expect, it } from "vitest";

import { fragrances as perfumes, notes } from "@discovery-box/catalog";
import { NOTE_PROMINENCE_BY_ID } from "../src/fragrances.js";

// Composer Phase 2F: narrow regression coverage for the third real
// editorial note-prominence seed batch. Kept as its own file, separate
// from noteProminenceSeedBatch.test.js (Phase 2C) and
// noteProminenceSeedBatch2E.test.js (Phase 2E), per the established
// convention of one narrow regression file per batch.
//
// This batch targets directional usefulness for Note Explorer's "Most
// prominent" sort in families the first two batches left underrepresented:
// leather, incense/resins (including a first benzoin entry), aquatic/
// marine, woods (first patchouli and guaiacWood entries -- both previously
// entirely absent from NOTE_PROMINENCE_BY_ID despite being common
// canonical notes), iris/powdery, citrus, and green/aromatic (first sage
// entries). It is not optimized for overall catalog coverage percentage.
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

// Pinned exactly as approved -- this batch must never touch them.
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

function getPerfumeNoteIds(perfume) {
  return [
    ...(perfume.topNotes || []),
    ...(perfume.middleNotes || []),
    ...(perfume.baseNotes || []),
    ...(perfume.generalNotes || []),
  ];
}

describe("Composer Phase 2F note-prominence seed batch", () => {
  const perfumesById = new Map(perfumes.map((perfume) => [perfume.id, perfume]));

  it("adds this batch's 12 fragrance IDs to NOTE_PROMINENCE_BY_ID", () => {
    // A subset check, not an exact-set check: NOTE_PROMINENCE_BY_ID also
    // holds the later Phase 2G batch (see noteProminenceSeedBatch2G.test.js,
    // which asserts the combined exact key set across all four batches) --
    // this file only proves its own batch's entries are present and
    // correct, so it stays valid as further batches are added.
    for (const id of Object.keys(PHASE_2F_BATCH).map(Number)) {
      expect(NOTE_PROMINENCE_BY_ID).toHaveProperty(String(id));
    }
  });

  it("matches the exact intended score for every fragrance/note pair in this batch", () => {
    for (const [id, expectedScores] of Object.entries(PHASE_2F_BATCH)) {
      expect(NOTE_PROMINENCE_BY_ID[id]).toEqual(expectedScores);
    }
  });

  it("scores only notes that actually belong to each fragrance's own canonical note set", () => {
    for (const [id, entry] of Object.entries(PHASE_2F_BATCH)) {
      const fragrance = perfumesById.get(Number(id));
      const ownNoteIds = new Set(getPerfumeNoteIds(fragrance));

      for (const noteId of Object.keys(entry)) {
        expect(ownNoteIds.has(noteId), `${fragrance.name} is not documented to carry "${noteId}"`).toBe(true);
        expect(notes[noteId]).toBeTruthy();
      }
    }
  });

  it("keeps every value an integer from 1 to 10 -- no zeros, no fractions", () => {
    for (const entry of Object.values(PHASE_2F_BATCH)) {
      for (const value of Object.values(entry)) {
        expect(Number.isInteger(value)).toBe(true);
        expect(value).toBeGreaterThanOrEqual(1);
        expect(value).toBeLessThanOrEqual(10);
      }
    }
  });

  it("leaves several of each scored fragrance's own canonical notes deliberately unscored -- sparse coverage remains intentional", () => {
    for (const [id, entry] of Object.entries(PHASE_2F_BATCH)) {
      const fragrance = perfumesById.get(Number(id));
      const ownNoteIds = getPerfumeNoteIds(fragrance);
      const unscoredCount = ownNoteIds.filter((noteId) => !(noteId in entry)).length;

      expect(unscoredCount, `${fragrance.name} should have at least one deliberately unscored note`).toBeGreaterThan(0);
    }
  });

  it("scores Loewe 7 Cobalt through its generalNotes shape, not an invented pyramid", () => {
    const loewe7Cobalt = perfumesById.get(203);
    expect(loewe7Cobalt.topNotes).toEqual([]);
    expect(loewe7Cobalt.middleNotes).toEqual([]);
    expect(loewe7Cobalt.baseNotes).toEqual([]);
    expect(loewe7Cobalt.generalNotes).toEqual(
      expect.arrayContaining(["sage", "incense", "cloves"])
    );
  });

  it("scores Concentré d'Orange Verte through its generalNotes shape, not an invented pyramid", () => {
    const orangeVerte = perfumesById.get(110);
    expect(orangeVerte.topNotes).toEqual([]);
    expect(orangeVerte.middleNotes).toEqual([]);
    expect(orangeVerte.baseNotes).toEqual([]);
    expect(orangeVerte.generalNotes).toEqual(
      expect.arrayContaining(["orange", "bitterOrange", "mint", "patchouli"])
    );
  });

  it("introduces the first patchouli and guaiacWood scores in NOTE_PROMINENCE_BY_ID, closing a woods-family gap Phase 2C and 2E left entirely unscored during the vertical pass", () => {
    // Excludes id 111 (Terre d'Hermès EDT, a Phase 2C entry): Phase 3E's
    // later horizontal calibration added its own patchouli score to that
    // fragrance, so the embedded PHASE_2C_BATCH snapshot above now
    // legitimately carries patchouli too. This test's claim is scoped to
    // the original vertical pass -- Phase 2C and 2E's own vertical-pass
    // reviews never scored patchouli or guaiacWood -- not to values a
    // later horizontal phase subsequently added.
    const priorEntries = { ...PHASE_2C_BATCH, ...PHASE_2E_BATCH };
    delete priorEntries[111];
    const priorHadPatchouli = Object.values(priorEntries).some((entry) => "patchouli" in entry);
    const priorHadGuaiacWood = Object.values(priorEntries).some((entry) => "guaiacWood" in entry);

    expect(priorHadPatchouli).toBe(false);
    expect(priorHadGuaiacWood).toBe(false);

    // Scoped to this batch's own fixture, not the live (ever-growing) map --
    // a later batch (e.g. Phase 2G) may legitimately add more patchouli/
    // guaiacWood scores of its own without that changing what THIS batch
    // introduced.
    const patchouliValues = Object.values(PHASE_2F_BATCH)
      .filter((entry) => "patchouli" in entry)
      .map((entry) => entry.patchouli);
    const guaiacWoodValues = Object.values(PHASE_2F_BATCH)
      .filter((entry) => "guaiacWood" in entry)
      .map((entry) => entry.guaiacWood);

    expect(patchouliValues.sort()).toEqual([5, 6, 7]);
    expect(guaiacWoodValues).toEqual([9]);
  });

  it("scores overlapping citrus concepts (orange and bitterOrange) independently in Concentré d'Orange Verte", () => {
    expect(NOTE_PROMINENCE_BY_ID[110].orange).toBe(8);
    expect(NOTE_PROMINENCE_BY_ID[110].bitterOrange).toBe(5);
  });

  it("scores Acqua di Gio Elixir's seaNotes lower than the original Acqua di Gio EDT's -- this Elixir flanker is a documented woodier reinterpretation, never inferred from sharing the same note id", () => {
    expect(NOTE_PROMINENCE_BY_ID[1].seaNotes).toBe(10);
    expect(NOTE_PROMINENCE_BY_ID[306].seaNotes).toBe(6);
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

  it("leaves every batch fragrance's canonical note pyramid exactly as it was -- this batch adds only editorial metadata", () => {
    expect(perfumesById.get(7)).toMatchObject({
      name: "The Scent EDT",
      topNotes: ["ginger", "mandarinOrange", "bergamot"],
      baseNotes: ["leather", "woodyNotes"],
    });
    expect(perfumesById.get(204)).toMatchObject({
      name: "Replica By The Fireplace",
      middleNotes: ["chestnut", "guaiacWood", "juniper"],
    });
    expect(perfumesById.get(205)).toMatchObject({
      name: "Gentleman EDP",
      // Phase 3C canonical correction: "vanilla" -> "blackVanilla" --
      // Givenchy's own published note identity names this base note
      // Black Vanilla, not generic vanilla. See
      // noteProminenceHorizontalCalibration3C.test.js. This is an
      // approved correction, not drift from this batch's original entry.
      baseNotes: ["blackVanilla", "tonkaBean", "benzoin", "patchouli"],
    });
    expect(perfumesById.get(306)).toMatchObject({
      name: "Acqua di Gio Elixir",
      baseNotes: ["patchouli", "vetiver", "leather", "amberwood"],
    });
  });

  it("never claims any ID belonging to a later batch", () => {
    // As of Phase 2J, every one of the 87 catalog fragrances has a
    // NOTE_PROMINENCE_BY_ID entry, so there is no longer any id that is
    // globally unscored -- see noteProminenceSeedBatch2J.test.js for the
    // "full 87/87 coverage" assertion. This test is now scoped to this
    // batch's own fixture instead: it proves PHASE_2F_BATCH never grew to
    // claim an id that actually belongs to a later phase.
    const laterPhaseIds = [34, 35, 100, 101, 102, 103, 106, 107, 108, 114, 206, 209, 210, 211, 214, 302, 305, 402, 403, 406, 410, 501];
    const batchIds = Object.keys(PHASE_2F_BATCH).map(Number);
    for (const id of laterPhaseIds) {
      expect(batchIds).not.toContain(id);
    }
  });
});
