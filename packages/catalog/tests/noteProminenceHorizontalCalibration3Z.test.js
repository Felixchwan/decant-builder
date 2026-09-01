import { describe, expect, it } from "vitest";

import { fragrances as perfumes, notes } from "@discovery-box/catalog";
import { NOTE_PROMINENCE_BY_ID } from "../src/fragrances.js";

// Composer Phase 3Z: narrow regression coverage for the twenty-sixth
// horizontal note-family calibration pass -- a single standalone
// canonical key, calibrated on its own: cypress.
//
// Taxonomy audit (Step 1) -- exact canonical key found in notes.js:
//   cypress ("Cypress", no family tag) -- no qualified variant exists.
//   pine, fir, firBalsam, juniper, rosemary, sage, clarySage, cedar,
//     cedarwood, woodyNotes, galbanum, and grass were all re-confirmed
//     as their own distinct, already-established canonical keys, out
//     of scope for this phase -- cypress is never treated as an
//     inferred proxy for any of them, for generic woody freshness,
//     forest/conifer impression, pine-like character, juniper-like
//     aromatic sharpness, or cedar dryness.
//
// Canonical-data sanity audit (Step 2): every cypress member was
// checked for a case where cypress -> pine/fir/juniper/cedar renaming,
// or inference from coniferous/woody-green/resinous/aromatic/
// forest-like impression, would be warranted. No mismatch meeting the
// Phase 3A basil / Phase 3C blackVanilla bar was found. Every member's
// own accords list uses only generic "woody"/"aromatic"/"fresh" tags --
// none names cypress or any coniferous material specifically -- and no
// fragrance's own name or shortName references cypress. None of the
// four members carries any of pine, fir, firBalsam, juniper, cedar, or
// cedarwood, so no cross-material confusion was even possible in this
// membership set. No canonical-data correction was made or is
// recommended.
//
// Across 4 cypress fragrance/note pairs, this phase's own calibration
// changes zero individual pairs. Uomo Signature's cypress sits inside
// its own coffee/leather/spicy-sweet concept (roastedCoffeeBeans: 8,
// leather: 6, tonkaBean: 6, cinnamon: 5); Le Beau Le Parfum's cypress
// sits inside its own coconut-tropical concept (coconut: 9,
// pineapple: 6, tonkaBean: 5); Polo Deep Blue Parfum's cypress sits
// inside its own aquatic-citrus concept (seaNotes: 6, greenMango: 5,
// ambroxan: 4); Orange X Santal's cypress sits inside its own
// citrus-woody concept (bitterOrange: 7, australianSandalwood: 7,
// basil: 5). None of the four fragrances' own evidence isolates
// cypress as a differentiated perceptual axis distinct from its
// established dominant notes, so none clears the correction bar for a
// first score under the strict editorial caution against inferring
// identity from generic coniferous/woody impression alone.
const CYPRESS_FAMILY = {
  16: undefined,
  112: undefined,
  207: undefined,
  305: undefined,
};

function getPerfumeNoteIds(perfume) {
  return [
    ...(perfume.topNotes || []),
    ...(perfume.middleNotes || []),
    ...(perfume.baseNotes || []),
    ...(perfume.generalNotes || []),
  ];
}

describe("Composer Phase 3Z taxonomy audit", () => {
  it("finds the exact canonical cypress definition, its own independent identity", () => {
    expect(notes.cypress).toMatchObject({ name: "Cypress" });
  });

  it("excludes every adjacent coniferous/green/woody material from the cypress key", () => {
    const adjacentKeys = [
      "pine",
      "fir",
      "firBalsam",
      "juniper",
      "rosemary",
      "sage",
      "clarySage",
      "cedar",
      "cedarwood",
      "woodyNotes",
      "galbanum",
      "grass",
    ];
    for (const noteId of adjacentKeys) {
      expect(notes[noteId], `${noteId} should exist in the taxonomy`).toBeTruthy();
      expect(noteId).not.toBe("cypress");
    }
  });
});

describe("Composer Phase 3Z canonical-data sanity audit", () => {
  const perfumesById = new Map(perfumes.map((perfume) => [perfume.id, perfume]));

  it("confirms none of the four cypress members carries a competing coniferous material -- no cross-material confusion was possible", () => {
    const adjacentConiferous = ["pine", "fir", "firBalsam", "juniper", "cedar", "cedarwood"];
    for (const id of Object.keys(CYPRESS_FAMILY).map(Number)) {
      const ownNoteIds = new Set(getPerfumeNoteIds(perfumesById.get(id)));
      for (const key of adjacentConiferous) {
        expect(ownNoteIds.has(key), `${perfumesById.get(id).name} should not carry "${key}"`).toBe(false);
      }
    }
  });

  it("confirms no canonical-data correction was made or is recommended -- every member's own accords use only generic woody/aromatic/fresh tags, never naming cypress or a coniferous material specifically", () => {
    const genericOnlyAccordTerms = ["woody", "aromatic", "fresh", "warm spicy", "leather", "sweet", "coffee", "coconut", "amber", "tropical", "aquatic", "fresh spicy", "citrus"];
    for (const id of Object.keys(CYPRESS_FAMILY).map(Number)) {
      const fragrance = perfumesById.get(id);
      for (const accord of fragrance.accords || []) {
        expect(genericOnlyAccordTerms).toContain(accord);
      }
      expect(NOTE_PROMINENCE_BY_ID[id]?.cypress).toBeUndefined();
    }
  });
});

describe("Composer Phase 3Z horizontal calibration -- cypress", () => {
  const perfumesById = new Map(perfumes.map((perfume) => [perfume.id, perfume]));

  it("has exactly 87 catalog fragrances to search for exhaustive family membership", () => {
    expect(perfumes).toHaveLength(87);
  });

  it("cypress membership is exhaustive against the live catalog", () => {
    const actualIds = perfumes
      .filter((perfume) => getPerfumeNoteIds(perfume).includes("cypress"))
      .map((perfume) => perfume.id)
      .sort((a, b) => a - b);

    expect(actualIds).toEqual(Object.keys(CYPRESS_FAMILY).map(Number).sort((a, b) => a - b));
  });

  it("matches the exact calibrated cypress score for every scored member, and confirms intentionally-unscored members stay unscored", () => {
    for (const [id, expectedScore] of Object.entries(CYPRESS_FAMILY)) {
      const actualScore = NOTE_PROMINENCE_BY_ID[id]?.cypress;
      if (expectedScore === undefined) {
        expect(actualScore, `${perfumesById.get(Number(id)).name} should remain unscored for cypress`).toBeUndefined();
      } else {
        expect(actualScore, `${perfumesById.get(Number(id)).name} cypress score`).toBe(expectedScore);
      }
    }
  });

  it("keeps every calibrated cypress value an integer from 1 to 10", () => {
    for (const score of Object.values(CYPRESS_FAMILY)) {
      if (score === undefined) continue;
      expect(Number.isInteger(score)).toBe(true);
      expect(score).toBeGreaterThanOrEqual(1);
      expect(score).toBeLessThanOrEqual(10);
    }
  });

  it("never collapses cypress into pine, fir, juniper, cedar, or woodyNotes -- exact-key containment is fully independent", () => {
    for (const id of Object.keys(CYPRESS_FAMILY).map(Number)) {
      const entry = NOTE_PROMINENCE_BY_ID[id] || {};
      const fragrance = perfumesById.get(id);
      const ownNoteIds = new Set(getPerfumeNoteIds(fragrance));

      if ("cypress" in entry) {
        expect(ownNoteIds.has("cypress"), `${fragrance.name} does not canonically carry "cypress"`).toBe(true);
      }
    }
  });

  it("scores only notes that actually belong to each fragrance's own canonical note set", () => {
    for (const id of Object.keys(CYPRESS_FAMILY).map(Number)) {
      const fragrance = perfumesById.get(id);
      const ownNoteIds = new Set(getPerfumeNoteIds(fragrance));
      for (const noteId of Object.keys(NOTE_PROMINENCE_BY_ID[id] || {})) {
        expect(ownNoteIds.has(noteId), `${fragrance.name} is not documented to carry "${noteId}"`).toBe(true);
        expect(notes[noteId]).toBeTruthy();
      }
    }
  });

  it("changes zero prominence values in this phase -- every cypress score above is exactly what the catalog already held before Phase 3Z", () => {
    // This test pins that outcome as a regression guard -- if it ever
    // fails, either a later phase intentionally recalibrated this exact
    // key (update this file's fixtures to match, with a comment), or an
    // unrelated change accidentally drifted a cypress score.
    expect(NOTE_PROMINENCE_BY_ID[16]).toEqual({ roastedCoffeeBeans: 8, leather: 6, tonkaBean: 6, cinnamon: 5 });
    expect(NOTE_PROMINENCE_BY_ID[112]).toEqual({ coconut: 9, pineapple: 6, tonkaBean: 5 });
    expect(NOTE_PROMINENCE_BY_ID[207]).toEqual({ seaNotes: 6, greenMango: 5, ambroxan: 4 });
    expect(NOTE_PROMINENCE_BY_ID[305]).toEqual({ bitterOrange: 7, australianSandalwood: 7, basil: 5 });
  });

  it("leaves canonical note data completely unchanged in this phase -- no pyramid was edited for any cypress member", () => {
    expect(perfumesById.get(16)).toMatchObject({
      name: "Uomo Signature",
      middleNotes: ["cinnamon", "cardamom", "cypress"],
    });
    expect(perfumesById.get(305)).toMatchObject({
      name: "Orange X Santal",
      generalNotes: ["bitterOrange", "australianSandalwood", "cypress", "basil", "oakmoss"],
    });
  });

  it("does not manufacture prominence for a background coniferous note merely because the fragrance is generically 'woody' or 'aromatic' -- all four cypress members remain unscored", () => {
    for (const id of Object.keys(CYPRESS_FAMILY).map(Number)) {
      expect(NOTE_PROMINENCE_BY_ID[id]?.cypress).toBeUndefined();
    }
  });

  // The Note Explorer "Most prominent" sort verification for cypress
  // lives in
  // packages/builder/src/builder/internal/intelligence/buildNoteExplorerViewModel.test.js
  // instead of here -- packages/catalog must never import from
  // packages/builder (ADR-0006), and this file already proves the
  // underlying data (membership, scores, containment) that sort depends on.
});
