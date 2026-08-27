import { describe, expect, it } from "vitest";

import { fragrances as perfumes, notes } from "@discovery-box/catalog";
import { NOTE_PROMINENCE_BY_ID } from "../src/fragrances.js";

// Composer Phase 2E: narrow regression coverage for the second real
// editorial note-prominence seed batch. Kept as its own file, separate
// from noteProminenceSeedBatch.test.js (the Phase 2C batch), per the
// established convention of one narrow regression file per batch rather
// than growing a single fixture indefinitely.
//
// This batch deliberately targets note families the Phase 2C batch left
// underrepresented -- tobacco and leather (previously zero coverage),
// green/aromatic, a second incense entry, a second iris/powdery entry, and
// citrus notes distinct from the bergamot/grapefruit Phase 2C already used
// -- rather than adding more aquatic/marine coverage.
//
// This batch also carries two editorial clarifications applied during a
// calibration pass (see the rubric comment above NOTE_PROMINENCE_BY_ID in
// fragrances.js for the full rationale):
// 1. Pyramid position alone neither justifies nor disqualifies a score. A
//    sole top/middle/base note is not automatically prominent for being
//    alone, but it IS scored here (Le Male Le Parfum's cardamom, Orphéon's
//    juniper) when perceptual identity genuinely supports it.
// 2. A prominence score is an independent editorial judgment, not a
//    compositional share -- overlapping canonical note concepts (vanilla
//    and bourbonVanilla in Spicebomb Extreme) may both be scored, since
//    each should independently produce a meaningful Explorer result and
//    nothing here is summed or normalized.
const PHASE_2E_BATCH = {
  13: { tobacco: 8, amber: 6, grapefruit: 6, cardamom: 5 },
  16: { roastedCoffeeBeans: 8, leather: 6, tonkaBean: 6, cinnamon: 5 },
  17: { birchLeaf: 7, incense: 5, pinkPepper: 4 },
  18: { pine: 7, fingerLime: 6, eucalyptus: 5, cedarwood: 4 },
  19: { pineapple: 8, birch: 7, blackCurrant: 6, ambergris: 5 },
  104: { tonkaBean: 9, lavender: 6, greenMandarin: 5, cedar: 4 },
  113: { cardamom: 7, vanilla: 8, lavender: 6, iris: 4 },
  115: { citron: 8, cedar: 5, blackCurrant: 4 },
  212: { tobacco: 9, vanilla: 7, bourbonVanilla: 7, cinnamon: 6, blackPepper: 5 },
  301: { sandalwood: 7, madagascarVanilla: 6, lemon: 5 },
  408: { mint: 9, basil: 6, rosemary: 5, blackCurrant: 4 },
  409: { powderyNotes: 7, juniper: 6, cedar: 6, jasmine: 5, tonkaBean: 4 },
};

// Pinned exactly as approved in Phase 2C -- this batch must never touch them.
const PHASE_2C_BATCH = {
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

describe("Composer Phase 2E note-prominence seed batch", () => {
  const perfumesById = new Map(perfumes.map((perfume) => [perfume.id, perfume]));

  it("adds exactly this batch's 12 fragrance IDs on top of the existing Phase 2C batch", () => {
    const allExpectedIds = [...Object.keys(PHASE_2E_BATCH), ...Object.keys(PHASE_2C_BATCH)]
      .map(Number)
      .sort((a, b) => a - b);
    const actualIds = Object.keys(NOTE_PROMINENCE_BY_ID).map(Number).sort((a, b) => a - b);

    expect(actualIds).toEqual(allExpectedIds);
  });

  it("matches the exact intended score for every fragrance/note pair in this batch", () => {
    for (const [id, expectedScores] of Object.entries(PHASE_2E_BATCH)) {
      expect(NOTE_PROMINENCE_BY_ID[id]).toEqual(expectedScores);
    }
  });

  it("scores only notes that actually belong to each fragrance's own canonical note set", () => {
    for (const [id, entry] of Object.entries(PHASE_2E_BATCH)) {
      const fragrance = perfumesById.get(Number(id));
      const ownNoteIds = new Set(getPerfumeNoteIds(fragrance));

      for (const noteId of Object.keys(entry)) {
        expect(ownNoteIds.has(noteId), `${fragrance.name} is not documented to carry "${noteId}"`).toBe(true);
        expect(notes[noteId]).toBeTruthy();
      }
    }
  });

  it("keeps every value an integer from 1 to 10 -- no zeros, no fractions", () => {
    for (const entry of Object.values(PHASE_2E_BATCH)) {
      for (const value of Object.values(entry)) {
        expect(Number.isInteger(value)).toBe(true);
        expect(value).toBeGreaterThanOrEqual(1);
        expect(value).toBeLessThanOrEqual(10);
      }
    }
  });

  it("leaves several of each scored fragrance's own canonical notes deliberately unscored, except the two documented full-coverage exceptions", () => {
    // Armani Code EDT (104) and Orphéon EDP (409) are deliberate, reported
    // exceptions: both are genuinely minimal compositions (4 and 5 total
    // canonical notes respectively), and every one of their notes is
    // scored with real confidence -- this is not "score every note because
    // it's easy", it's the case where the full canonical note set IS the
    // small, well-characterized set the fragrance is actually built from.
    const fullCoverageExceptionIds = new Set([104, 409]);

    for (const [id, entry] of Object.entries(PHASE_2E_BATCH)) {
      if (fullCoverageExceptionIds.has(Number(id))) {
        continue;
      }

      const fragrance = perfumesById.get(Number(id));
      const ownNoteIds = getPerfumeNoteIds(fragrance);
      const unscoredCount = ownNoteIds.filter((noteId) => !(noteId in entry)).length;

      expect(unscoredCount, `${fragrance.name} should have at least one deliberately unscored note`).toBeGreaterThan(0);
    }
  });

  it("documents both full-coverage exceptions explicitly: Armani Code EDT and Orphéon EDP have every canonical note scored, not left partially unscored", () => {
    const armaniCode = perfumesById.get(104);
    const armaniCodeNoteIds = getPerfumeNoteIds(armaniCode);
    expect(armaniCodeNoteIds.sort()).toEqual(["cedar", "greenMandarin", "lavender", "tonkaBean"].sort());
    expect(Object.keys(NOTE_PROMINENCE_BY_ID[104]).sort()).toEqual(armaniCodeNoteIds.sort());

    const orpheon = perfumesById.get(409);
    const orpheonNoteIds = getPerfumeNoteIds(orpheon);
    expect(orpheonNoteIds.sort()).toEqual(["cedar", "jasmine", "juniper", "powderyNotes", "tonkaBean"].sort());
    expect(Object.keys(NOTE_PROMINENCE_BY_ID[409]).sort()).toEqual(orpheonNoteIds.sort());
  });

  it("scores a fragrance's sole top note when perceptual identity supports it -- pyramid position alone neither justifies nor disqualifies a score", () => {
    const leMaleLeParfum = perfumesById.get(113);
    expect(leMaleLeParfum.topNotes).toEqual(["cardamom"]);
    expect(NOTE_PROMINENCE_BY_ID[113].cardamom).toBe(7);

    const orpheon = perfumesById.get(409);
    expect(orpheon.topNotes).toEqual(["juniper"]);
    expect(NOTE_PROMINENCE_BY_ID[409].juniper).toBe(6);
  });

  it("scores overlapping canonical note concepts independently -- vanilla and bourbonVanilla in Spicebomb Extreme are each their own editorial judgment, not a divided compositional share", () => {
    const spicebombExtreme = perfumesById.get(212);
    expect(spicebombExtreme.baseNotes).toEqual(expect.arrayContaining(["vanilla", "bourbonVanilla"]));

    expect(NOTE_PROMINENCE_BY_ID[212].vanilla).toBe(7);
    expect(NOTE_PROMINENCE_BY_ID[212].bourbonVanilla).toBe(7);
    // Neither score was reduced to "make room" for the other -- both sit at
    // the same "very evident" value simultaneously, proving these are
    // independent judgments rather than a normalized/summed split.
  });

  it("leaves every Phase 2C entry exactly as previously approved -- this batch never revises them", () => {
    for (const [id, expectedScores] of Object.entries(PHASE_2C_BATCH)) {
      expect(NOTE_PROMINENCE_BY_ID[id]).toEqual(expectedScores);
    }
  });

  it("leaves every batch fragrance's canonical note pyramid exactly as it was -- this batch adds only editorial metadata", () => {
    expect(perfumesById.get(13)).toMatchObject({
      name: "The One for Men EDP",
      topNotes: ["grapefruit", "coriander", "basil"],
      baseNotes: ["amber", "tobacco", "cedar"],
    });
    expect(perfumesById.get(104)).toMatchObject({
      name: "Armani Code EDT",
      topNotes: ["greenMandarin"],
      middleNotes: ["lavender"],
      baseNotes: ["tonkaBean", "cedar"],
    });
    expect(perfumesById.get(212)).toMatchObject({
      name: "Spicebomb Extreme",
      baseNotes: ["tobacco", "vanilla", "bourbonVanilla"],
    });
    expect(perfumesById.get(409)).toMatchObject({
      name: "Orphéon EDP",
      topNotes: ["juniper"],
      middleNotes: ["jasmine"],
      baseNotes: ["powderyNotes", "cedar", "tonkaBean"],
    });
  });

  it("leaves every fragrance outside both batches with the default empty prominence object", () => {
    const outsideBatchIds = [2, 3, 4, 15, 100, 306, 403, 410, 501];
    for (const id of outsideBatchIds) {
      expect(NOTE_PROMINENCE_BY_ID).not.toHaveProperty(String(id));
      expect(perfumesById.get(id).noteProminence).toEqual({});
    }
  });
});
