import { describe, expect, it } from "vitest";

import { fragrances as perfumes, notes } from "@discovery-box/catalog";
import { NOTE_PROMINENCE_BY_ID } from "../src/fragrances.js";

// Composer Phase 3A: narrow regression coverage for the first horizontal
// note-family calibration pass -- basil and blackCurrant -- including a
// canonical-data correction for Concentré d'Orange Verte (id 110) made
// during this pass. Unlike every prior noteProminenceSeedBatch*.test.js
// file, this file does not introduce new fragrance ids; it re-examines
// two note families across fragrances the vertical pass already reviewed.
//
// Canonical-data correction: Concentré d'Orange Verte (id 110) was
// initially found to have no basil anywhere in its canonical notes (only
// mint), which an earlier pass of this phase reported as an out-of-scope
// catalog-data gap rather than a prominence issue. On explicit editorial
// instruction, that was revisited: for this catalog/Aurelian experience,
// Concentré d'Orange Verte is treated as canonically containing basil
// (its own "green" accord and widely-documented real-world green, herbal-
// orange character both support this), so basil was added to its existing
// generalNotes collection -- the smallest structural change, preserving
// every other canonical note and the fragrance's generalNotes-only shape.
//
// Basil family -- 8 fragrances now carry basil anywhere in their
// canonical notes (was 7 before the id 110 correction). Final calibrated
// scores, high to low:
//   408 Torino21             -- 8 (top-billed among only 3 top notes, and
//                                "green" is one of only 2 explicitly
//                                listed accords)
//   110 Concentré d'Orange   -- 8 (newly added and scored: per explicit
//       Verte                    editorial guidance this fragrance is
//                                perceived as strongly basil-forward, not
//                                secondary or incidental -- corroborated
//                                by its own "green" accord, the same
//                                internal signal that anchors Torino21's
//                                score. Tied with Torino21 rather than
//                                forced above or below it; ties are
//                                allowed and no distinction was invented
//                                for ranking's sake. Its overall identity
//                                is still citrus-first per its own accord
//                                list, so this stops at "very evident"
//                                rather than "defining/signature.")
//   119 Mirto di Panarea     -- 7 (raised from 5: basil is the FIRST-
//                                listed top note in a fragrance whose
//                                whole "aromatic Mediterranean" genre
//                                depends on herbal top notes like it)
//   117 YSL L'Homme          -- 5 (unchanged: one of 4 co-equal middle
//                                notes, no direct accord support)
//   305 Orange X Santal      -- 5 (one of only 5 generalNotes in a
//                                minimal-ingredient niche composition,
//                                comparable in role to YSL L'Homme's
//                                middle-note basil)
//   303 Bois Imperial        -- 4 (unchanged: one of 7 generalNotes,
//                                clearly secondary to the akigalawood
//                                signature already scored 10)
//   13  The One for Men EDP  -- 3 (a fleeting top note in a composition
//                                whose real identity is its tobacco/amber
//                                base, present but minor)
//   14  Halloween Man        -- unscored (basil is 1 of 4 top notes in a
//                                sweet vanilla/amber/leather composition
//                                with zero accord support for it; genuine
//                                confidence is insufficient)
const BASIL_FAMILY = {
  13: 3,
  14: undefined,
  110: 8,
  117: 5,
  119: 7,
  303: 4,
  305: 5,
  408: 8,
};

// blackCurrant family -- 6 fragrances carry blackCurrant anywhere in
// their canonical notes. Re-enumerated from the live catalog for this
// correction pass; membership is unchanged from the prior Phase 3A pass.
// Loewe 7 Cobalt and Club de Nuit Intense Man were swapped from an
// earlier draft of this pass on explicit editorial instruction during
// finalization -- both remain well above Cedrat Boise and Torino21
// either way, so the originally flagged implausible ordering stays
// resolved regardless of which of the two tops the family. Final
// calibrated scores, high to low:
//   203 Loewe 7 Cobalt           -- 8 (genuine, if unusual, real-world
//                                    documentation as a noticeable
//                                    dark-fruit contrast against this
//                                    fragrance's dry, woody-spicy
//                                    backdrop)
//   401 Silver Mountain Water    -- 8 (blackcurrant is one of only 2
//                                    middle notes and one of this
//                                    fragrance's most widely documented
//                                    identifying traits, alongside its
//                                    already-scored 9 green tea)
//   19  Club de Nuit Intense Man -- 6 (real-world documentation credits
//                                    blackcurrant as a genuinely
//                                    identifiable trait alongside the
//                                    already-scored pineapple and birch,
//                                    without topping the family)
//   115 Cedrat Boise             -- 3 (one of 4 top notes in a
//                                    composition clearly built around
//                                    citron, its minor role)
//   408 Torino21                 -- 3 (one of 4 middle notes in a
//                                    green/citrus/fresh composition with
//                                    zero "fruity" accord support, a
//                                    genuinely minor background element)
//   410 Il Padrino               -- unscored (top note in a boozy-sweet
//                                    gourmand with zero "fruity" accord
//                                    support; consistent with the
//                                    deliberately conservative Phase 2J
//                                    treatment of this fragrance -- no
//                                    new evidence emerged here to justify
//                                    overriding that caution)
const BLACK_CURRANT_FAMILY = {
  19: 6,
  115: 3,
  203: 8,
  401: 8,
  408: 3,
  410: undefined,
};

// The exact, unrelated prominence values on every touched fragrance,
// pinned so this phase is provably scoped to only basil/blackCurrant.
// Note: cedar on ids 115 and 117 was subsequently recalibrated by Phase
// 3C's own horizontal pass (115: cedar 5 -> 6; 117 unchanged at 4) --
// updated here to the current approved value, since this snapshot's job
// is to prove Phase 3A's own scope, not to freeze values Phase 3A never
// owned.
const UNRELATED_VALUES_BY_ID = {
  13: { tobacco: 8, amber: 6, grapefruit: 6, cardamom: 5 },
  19: { pineapple: 8, birch: 7, ambergris: 5 },
  110: { orange: 8, mint: 6, patchouli: 5, bitterOrange: 5 },
  115: { citron: 8, cedar: 6 },
  117: { ginger: 6, tonkaBean: 5, cedar: 4 },
  119: { seaNotes: 6, lemon: 5 },
  203: { incense: 6, sage: 6, cloves: 4 },
  303: { akigalawood: 10, ambroxan: 6 },
  305: { bitterOrange: 7, australianSandalwood: 7 },
  401: { greenTea: 9, bergamot: 5, musk: 5 },
  408: { mint: 9, rosemary: 5 },
  410: { patchouli: 6, vanilla: 5 },
};

function getPerfumeNoteIds(perfume) {
  return [
    ...(perfume.topNotes || []),
    ...(perfume.middleNotes || []),
    ...(perfume.baseNotes || []),
    ...(perfume.generalNotes || []),
  ];
}

describe("Composer Phase 3A canonical-data correction", () => {
  const perfumesById = new Map(perfumes.map((perfume) => [perfume.id, perfume]));

  it("Concentré d'Orange Verte now canonically contains basil", () => {
    const orangeVerte = perfumesById.get(110);
    expect(orangeVerte.name).toBe("Concentré d'Orange Verte");
    expect(getPerfumeNoteIds(orangeVerte)).toContain("basil");
  });

  it("preserves every other canonical note on Concentré d'Orange Verte exactly, still using its generalNotes-only shape", () => {
    const orangeVerte = perfumesById.get(110);
    expect(orangeVerte.topNotes).toEqual([]);
    expect(orangeVerte.middleNotes).toEqual([]);
    expect(orangeVerte.baseNotes).toEqual([]);
    expect(orangeVerte.generalNotes.sort()).toEqual(
      ["orange", "bitterOrange", "lemon", "mandarin", "mint", "basil", "oakmoss", "patchouli"].sort()
    );
  });

  it("introduces no duplicate note id within Concentré d'Orange Verte's canonical notes", () => {
    const orangeVerte = perfumesById.get(110);
    const noteIds = getPerfumeNoteIds(orangeVerte);
    expect(new Set(noteIds).size).toBe(noteIds.length);
  });

  it("basil exists exactly once in the canonical note dictionary", () => {
    expect(notes.basil).toBeTruthy();
  });

  it("touches no other fragrance's canonical notes -- this correction is scoped to id 110 alone", () => {
    // Spot-check a representative sample of other fragrances (including
    // every other basil/blackCurrant family member) rather than every one
    // of the 87 -- the full-catalog pyramid-immutability guarantee is
    // already covered by catalogReferenceIntegrity.test.js and every
    // noteProminenceSeedBatch*.test.js file's own pyramid assertions.
    expect(perfumesById.get(13).topNotes).toEqual(["grapefruit", "coriander", "basil"]);
    expect(perfumesById.get(14).topNotes).toEqual(["martini", "violetLeaf", "mandarinOrange", "basil"]);
    expect(perfumesById.get(19).topNotes).toEqual(["lemon", "pineapple", "bergamot", "blackCurrant", "apple"]);
    expect(perfumesById.get(115).topNotes).toEqual(["citron", "blackCurrant", "bergamot", "spicyNotes"]);
    expect(perfumesById.get(117).middleNotes).toEqual(["spicyNotes", "whitePepper", "violetLeaf", "basil"]);
    expect(perfumesById.get(119).topNotes).toEqual(["basil", "lemon", "bergamot"]);
    expect(perfumesById.get(203).generalNotes).toEqual([
      "sage", "incense", "blackCurrant", "vetiver", "pinkPepper", "cloves", "tonkaBean",
    ]);
    expect(perfumesById.get(303).generalNotes).toEqual([
      "akigalawood", "woodyNotes", "basil", "vetiver", "timur", "ambroxan", "patchouli",
    ]);
    expect(perfumesById.get(305).generalNotes).toEqual([
      "bitterOrange", "australianSandalwood", "cypress", "basil", "oakmoss",
    ]);
    expect(perfumesById.get(401).middleNotes).toEqual(["greenTea", "blackCurrant"]);
    expect(perfumesById.get(408).topNotes).toEqual(["mint", "lemon", "basil"]);
    expect(perfumesById.get(408).middleNotes).toEqual(["blackCurrant", "rosemary", "jasmine", "lavender"]);
    expect(perfumesById.get(410).topNotes).toEqual(["blackCurrant", "rum", "amaretto", "bergamot"]);
  });
});

describe("Composer Phase 3A horizontal calibration -- basil and blackCurrant", () => {
  const perfumesById = new Map(perfumes.map((perfume) => [perfume.id, perfume]));

  it("has exactly 87 catalog fragrances to search for exhaustive family membership", () => {
    expect(perfumes).toHaveLength(87);
  });

  it("basil family membership is exhaustive: exactly these 8 ids (including the newly-corrected id 110) carry basil anywhere in their canonical notes", () => {
    const actualBasilIds = perfumes
      .filter((perfume) => getPerfumeNoteIds(perfume).includes("basil"))
      .map((perfume) => perfume.id)
      .sort((a, b) => a - b);

    expect(actualBasilIds).toEqual(Object.keys(BASIL_FAMILY).map(Number).sort((a, b) => a - b));
  });

  it("blackCurrant family membership is exhaustive: exactly these 6 ids carry blackCurrant anywhere in their canonical notes", () => {
    const actualBlackCurrantIds = perfumes
      .filter((perfume) => getPerfumeNoteIds(perfume).includes("blackCurrant"))
      .map((perfume) => perfume.id)
      .sort((a, b) => a - b);

    expect(actualBlackCurrantIds).toEqual(Object.keys(BLACK_CURRANT_FAMILY).map(Number).sort((a, b) => a - b));
  });

  it("matches the exact calibrated basil score for every scored member, and confirms the one intentionally-unscored member stays unscored", () => {
    for (const [id, expectedScore] of Object.entries(BASIL_FAMILY)) {
      const actualScore = NOTE_PROMINENCE_BY_ID[id]?.basil;
      if (expectedScore === undefined) {
        expect(actualScore, `${perfumesById.get(Number(id)).name} should remain unscored for basil`).toBeUndefined();
      } else {
        expect(actualScore, `${perfumesById.get(Number(id)).name} basil score`).toBe(expectedScore);
      }
    }
  });

  it("matches the exact calibrated blackCurrant score for every scored member, and confirms the one intentionally-unscored member stays unscored", () => {
    for (const [id, expectedScore] of Object.entries(BLACK_CURRANT_FAMILY)) {
      const actualScore = NOTE_PROMINENCE_BY_ID[id]?.blackCurrant;
      if (expectedScore === undefined) {
        expect(actualScore, `${perfumesById.get(Number(id)).name} should remain unscored for blackCurrant`).toBeUndefined();
      } else {
        expect(actualScore, `${perfumesById.get(Number(id)).name} blackCurrant score`).toBe(expectedScore);
      }
    }
  });

  it("has Concentré d'Orange Verte tied with Torino21 at the top of the basil family, not ranked as a secondary/incidental note", () => {
    expect(NOTE_PROMINENCE_BY_ID[110].basil).toBe(8);
    expect(NOTE_PROMINENCE_BY_ID[408].basil).toBe(8);

    const allBasilScores = Object.values(BASIL_FAMILY).filter((score) => score !== undefined);
    expect(Math.max(...allBasilScores)).toBe(8);
  });

  it("keeps every calibrated basil/blackCurrant value an integer from 1 to 10", () => {
    for (const [id, score] of [...Object.entries(BASIL_FAMILY), ...Object.entries(BLACK_CURRANT_FAMILY)]) {
      if (score === undefined) continue;
      expect(Number.isInteger(score), `id ${id}`).toBe(true);
      expect(score).toBeGreaterThanOrEqual(1);
      expect(score).toBeLessThanOrEqual(10);
    }
  });

  it("scores only notes that actually belong to each fragrance's own canonical note set", () => {
    for (const id of new Set([...Object.keys(BASIL_FAMILY), ...Object.keys(BLACK_CURRANT_FAMILY)].map(Number))) {
      const fragrance = perfumesById.get(id);
      const ownNoteIds = new Set(getPerfumeNoteIds(fragrance));
      for (const noteId of Object.keys(NOTE_PROMINENCE_BY_ID[id] || {})) {
        expect(ownNoteIds.has(noteId), `${fragrance.name} is not documented to carry "${noteId}"`).toBe(true);
        expect(notes[noteId]).toBeTruthy();
      }
    }
  });

  it("leaves every unrelated prominence value on each touched fragrance exactly as it was -- this phase only touches basil and blackCurrant", () => {
    for (const [id, unrelatedValues] of Object.entries(UNRELATED_VALUES_BY_ID)) {
      const liveEntry = { ...NOTE_PROMINENCE_BY_ID[id] };
      delete liveEntry.basil;
      delete liveEntry.blackCurrant;

      expect(liveEntry, `${perfumesById.get(Number(id)).name}`).toEqual(unrelatedValues);
    }
  });

  it("leaves every touched fragrance's canonical note pyramid exactly as it was, except id 110's approved basil correction", () => {
    expect(perfumesById.get(13)).toMatchObject({
      name: "The One for Men EDP",
      topNotes: ["grapefruit", "coriander", "basil"],
    });
    expect(perfumesById.get(14)).toMatchObject({
      name: "Halloween Man",
      topNotes: ["martini", "violetLeaf", "mandarinOrange", "basil"],
    });
    expect(perfumesById.get(19)).toMatchObject({
      name: "Club de Nuit Intense Man",
      topNotes: ["lemon", "pineapple", "bergamot", "blackCurrant", "apple"],
    });
    expect(perfumesById.get(110)).toMatchObject({
      name: "Concentré d'Orange Verte",
      generalNotes: expect.arrayContaining(["orange", "bitterOrange", "lemon", "mandarin", "mint", "basil", "oakmoss", "patchouli"]),
    });
    expect(perfumesById.get(115)).toMatchObject({
      name: "Cedrat Boise",
      topNotes: ["citron", "blackCurrant", "bergamot", "spicyNotes"],
    });
    expect(perfumesById.get(117)).toMatchObject({
      name: "YSL L'Homme",
      middleNotes: ["spicyNotes", "whitePepper", "violetLeaf", "basil"],
    });
    expect(perfumesById.get(119)).toMatchObject({
      name: "Mirto di Panarea",
      topNotes: ["basil", "lemon", "bergamot"],
    });
    expect(perfumesById.get(203)).toMatchObject({
      name: "Loewe 7 Cobalt",
      generalNotes: ["sage", "incense", "blackCurrant", "vetiver", "pinkPepper", "cloves", "tonkaBean"],
    });
    expect(perfumesById.get(303)).toMatchObject({
      name: "Bois Imperial",
      generalNotes: ["akigalawood", "woodyNotes", "basil", "vetiver", "timur", "ambroxan", "patchouli"],
    });
    expect(perfumesById.get(305)).toMatchObject({
      name: "Orange X Santal",
      generalNotes: ["bitterOrange", "australianSandalwood", "cypress", "basil", "oakmoss"],
    });
    expect(perfumesById.get(401)).toMatchObject({
      name: "Silver Mountain Water",
      middleNotes: ["greenTea", "blackCurrant"],
    });
    expect(perfumesById.get(408)).toMatchObject({
      name: "Torino21",
      topNotes: ["mint", "lemon", "basil"],
      middleNotes: ["blackCurrant", "rosemary", "jasmine", "lavender"],
    });
    expect(perfumesById.get(410)).toMatchObject({
      name: "Il Padrino",
      topNotes: ["blackCurrant", "rum", "amaretto", "bergamot"],
    });
  });

  // The Note Explorer "Most prominent" sort verification for basil and
  // blackCurrant against these exact calibrated scores lives in
  // packages/builder/src/builder/internal/intelligence/buildNoteExplorerViewModel.test.js
  // instead of here -- packages/catalog must never import from
  // packages/builder (ADR-0006), and this file already proves the
  // underlying data (membership, scores, containment) that sort depends on.
});
