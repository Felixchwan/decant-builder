import { describe, expect, it } from "vitest";

import { fragrances as perfumes, notes } from "@discovery-box/catalog";
import { NOTE_PROMINENCE_BY_ID } from "../src/fragrances.js";

// Composer Phase 2C: narrow regression coverage for the first real
// editorial note-prominence seed batch. Mirrors this repo's established
// per-batch regression convention (see perfumes.orpheon.test.js,
// perfumes.pradaLHommeLEauGraphiteIlPadrino.test.js) -- pins the exact
// values this batch introduced, so a later, broader population effort
// can't silently drift or overwrite this batch's editorial judgments.
//
// This batch is deliberately NOT optimized for catalog coverage -- 11 of
// 87 fragrances, chosen for clearly recognizable, well-documented
// signature notes across varied scent profiles (aquatic, fougère-oriental,
// citrus-woody, ambroxan-modern, powdery-iris, a generalNotes-only
// fragrance, vanilla-gourmand, green-tea-fresh, apple-gourmand, and an
// unconventional marine niche release). Every scored fragrance still has
// several of its own canonical notes left deliberately unscored -- see the
// per-entry assertions below.
//
// Carlisle (403) and Il Padrino (410) were part of an earlier draft of this
// batch and were deliberately dropped after an editorial-calibration pass
// (their scores in the draft leaned too heavily on textual/name consensus
// rather than confident perceptual judgment) -- not replaced, since this
// batch is intentionally sized to what could be scored with confidence,
// not to a target count.
const EXPECTED_BATCH = {
  1: { seaNotes: 10, calone: 9, bergamot: 7, jasmine: 5, whiteMusk: 4 },
  5: { lavender: 9, vanilla: 8, mint: 6, tonkaBean: 5 },
  111: { orange: 8, vetiver: 8, grapefruit: 7, cedar: 6, pepper: 4 },
  118: { cardamom: 9, coumarin: 6, lavender: 5, vetiver: 3 },
  202: { ambroxan: 9, bergamot: 7, sichuanPepper: 6, vanilla: 5 },
  208: { iris: 9, neroli: 6, amber: 5, carrotSeeds: 3 },
  303: { akigalawood: 10, ambroxan: 6, basil: 4 },
  304: { madagascarVanilla: 10, cinnamon: 7, tonkaBean: 6, incense: 4 },
  401: { greenTea: 9, blackCurrant: 7, bergamot: 5, musk: 5 },
  404: { apple: 8, lavender: 8, vanilla: 7, cardamom: 4, coumarin: 4 },
  500: { ink: 9, incense: 7, seaSalt: 6, ambergris: 6 },
};

function getPerfumeNoteIds(perfume) {
  return [
    ...(perfume.topNotes || []),
    ...(perfume.middleNotes || []),
    ...(perfume.baseNotes || []),
    ...(perfume.generalNotes || []),
  ];
}

describe("Composer Phase 2C note-prominence seed batch", () => {
  const perfumesById = new Map(perfumes.map((perfume) => [perfume.id, perfume]));

  it("adds this batch's 11 fragrance IDs to NOTE_PROMINENCE_BY_ID", () => {
    // A subset check, not an exact-set check: NOTE_PROMINENCE_BY_ID also
    // holds the later Phase 2E batch (see noteProminenceSeedBatch2E.test.js,
    // which asserts the combined exact key set) -- this file only proves
    // its own batch's entries are present and correct, so it stays valid
    // as further batches are added rather than needing to be widened every
    // time.
    for (const id of Object.keys(EXPECTED_BATCH).map(Number)) {
      expect(NOTE_PROMINENCE_BY_ID).toHaveProperty(String(id));
    }
  });

  it("matches the exact intended score for every fragrance/note pair in this batch", () => {
    for (const [id, expectedScores] of Object.entries(EXPECTED_BATCH)) {
      expect(NOTE_PROMINENCE_BY_ID[id]).toEqual(expectedScores);
    }
  });

  it("upgrades fragrance 1's Phase 2B placeholder rather than merging with it -- the old {bergamot: 8, jasmine: 5} placeholder is fully replaced", () => {
    expect(NOTE_PROMINENCE_BY_ID[1]).toEqual({
      seaNotes: 10,
      calone: 9,
      bergamot: 7,
      jasmine: 5,
      whiteMusk: 4,
    });
    expect(NOTE_PROMINENCE_BY_ID[1].bergamot).toBe(7);
  });

  it("keeps every value an integer from 1 to 10 -- no zeros, no fractions", () => {
    for (const entry of Object.values(EXPECTED_BATCH)) {
      for (const value of Object.values(entry)) {
        expect(Number.isInteger(value)).toBe(true);
        expect(value).toBeGreaterThanOrEqual(1);
        expect(value).toBeLessThanOrEqual(10);
      }
    }
  });

  it("scores only notes that actually belong to each fragrance's own canonical note set", () => {
    for (const [id, entry] of Object.entries(EXPECTED_BATCH)) {
      const fragrance = perfumesById.get(Number(id));
      const ownNoteIds = new Set(getPerfumeNoteIds(fragrance));

      for (const noteId of Object.keys(entry)) {
        expect(ownNoteIds.has(noteId), `${fragrance.name} is not documented to carry "${noteId}"`).toBe(true);
        expect(notes[noteId]).toBeTruthy();
      }
    }
  });

  it("leaves several of each scored fragrance's own canonical notes deliberately unscored -- this batch never scores every note in a pyramid", () => {
    for (const [id, entry] of Object.entries(EXPECTED_BATCH)) {
      const fragrance = perfumesById.get(Number(id));
      const ownNoteIds = getPerfumeNoteIds(fragrance);
      const unscoredCount = ownNoteIds.filter((noteId) => !(noteId in entry)).length;

      expect(unscoredCount, `${fragrance.name} should have at least one deliberately unscored note`).toBeGreaterThan(0);
    }
  });

  it("scores Bois Imperial through its generalNotes shape, not an invented pyramid", () => {
    const boisImperial = perfumesById.get(303);
    expect(boisImperial.topNotes).toEqual([]);
    expect(boisImperial.middleNotes).toEqual([]);
    expect(boisImperial.baseNotes).toEqual([]);
    expect(boisImperial.generalNotes).toEqual(
      expect.arrayContaining(["akigalawood", "ambroxan", "basil"])
    );
  });

  it("leaves every batch fragrance's canonical note pyramid/general notes exactly as they were -- this batch adds only editorial metadata", () => {
    expect(perfumesById.get(1)).toMatchObject({
      name: "Acqua di Gio EDT",
      topNotes: ["lime", "lemon", "bergamot", "jasmine", "orange", "mandarinOrange", "neroli"],
      baseNotes: ["whiteMusk", "cedar", "oakmoss", "patchouli", "amber"],
    });
    expect(perfumesById.get(202)).toMatchObject({
      name: "Sauvage EDP",
      topNotes: ["bergamot"],
      baseNotes: ["ambroxan", "vanilla"],
    });
    expect(perfumesById.get(500)).toMatchObject({
      name: "Squid",
      baseNotes: ["ambergris", "benzoin", "musk"],
    });
  });

  it("never claims any ID belonging to a later batch, including Carlisle (403) and Il Padrino (410) which were dropped from an earlier draft of this batch", () => {
    // As of Phase 2J, every one of the 87 catalog fragrances has a
    // NOTE_PROMINENCE_BY_ID entry, so there is no longer any id that is
    // globally unscored -- see noteProminenceSeedBatch2J.test.js for the
    // "full 87/87 coverage" assertion. This test is now scoped to this
    // batch's own fixture instead: it proves EXPECTED_BATCH never grew to
    // claim an id that actually belongs to a later phase (including
    // Carlisle and Il Padrino, eventually reviewed in Phase 2J).
    const laterPhaseIds = [34, 35, 100, 101, 102, 103, 106, 107, 108, 114, 206, 209, 210, 211, 214, 302, 305, 402, 403, 406, 410, 501];
    const batchIds = Object.keys(EXPECTED_BATCH).map(Number);
    for (const id of laterPhaseIds) {
      expect(batchIds).not.toContain(id);
    }
  });
});
