import { describe, expect, it } from "vitest";

import { fragrances as perfumes, notes } from "@discovery-box/catalog";
import { NOTE_PROMINENCE_BY_ID } from "../src/fragrances.js";

// Composer Phase 3W: narrow regression coverage for the twenty-third
// horizontal note-family calibration pass -- six independent aromatic
// seed/spice canonical keys, grouped only for workflow efficiency and
// never as one canonical family, each calibrated independently:
// coriander, caraway, cumin, fennel, anise, and starAnise.
//
// Taxonomy audit (Step 1) -- exact canonical keys found in notes.js:
//   coriander ("Coriander", family: "spicy") -- no qualified variant
//     exists.
//   caraway ("Caraway", family: "spicy") -- no qualified variant exists.
//   cumin ("Cumin", family: "spicy") -- no qualified variant exists.
//   fennel ("Fennel", family: "aromatic") -- no qualified variant exists.
//   anise ("Anise", family: "spicy") -- no qualified variant exists.
//   starAnise ("Star Anise", no family tag) -- carries its own bespoke
//     image, never reusing anise.jpg, confirming it is never treated as
//     an anise variant.
//   Per the coverage audit's own explicit correction: anise and
//     starAnise are related only by producing a similar licorice-like
//     aromatic effect -- they are distinct materials with distinct
//     botanical identities, never a generic/specific variant pair, and
//     no score or membership is ever inherited between them. cardamom,
//     cinnamon, nutmeg, cloves, ginger, the pepper-family keys, saffron,
//     artemisia, and wormwood were all re-confirmed as their own
//     distinct, already-established canonical keys, out of scope for
//     this phase.
//
// Canonical-data sanity audit (Step 2): every in-scope key's members
// were checked against their own accords/name/shortName for a case
// where a different in-scope or adjacent key would be clearly
// warranted instead. No mismatch meeting the Phase 3A basil / Phase 3C
// blackVanilla bar was found in any direction. 212 VIP Black carries
// both fennel and anise, and Spicebomb Extreme carries both caraway and
// cumin -- each pair independently scored, never cross-credited. No
// canonical-data correction was made or is recommended in this phase.
//
// Across 4 coriander, 3 caraway, 1 cumin, 1 fennel, 1 anise, and 1
// starAnise fragrance/note pairs, this phase's own calibration changes
// zero individual pairs. 212 VIP Black's already-scored anise: 6 held
// up as internally consistent, correctly trailing its own established
// blackVanilla: 7. None of the ten remaining unscored memberships is
// named or accord-tagged for its own in-scope key specifically, so none
// clears the bar for a first score under the strict editorial caution
// against inferring identity from generic seed-spice/aromatic/anisic
// character alone.
const CORIANDER_FAMILY = {
  1: undefined,
  13: undefined,
  20: undefined,
  501: undefined,
};

const CARAWAY_FAMILY = {
  5: undefined,
  118: undefined,
  212: undefined,
};

const CUMIN_FAMILY = { 212: undefined };
const FENNEL_FAMILY = { 106: undefined };
const ANISE_FAMILY = { 106: 6 };
const STAR_ANISE_FAMILY = { 202: undefined };

const ALL_FAMILIES = {
  coriander: CORIANDER_FAMILY,
  caraway: CARAWAY_FAMILY,
  cumin: CUMIN_FAMILY,
  fennel: FENNEL_FAMILY,
  anise: ANISE_FAMILY,
  starAnise: STAR_ANISE_FAMILY,
};

const IN_SCOPE_KEYS = ["coriander", "caraway", "cumin", "fennel", "anise", "starAnise"];
const OUT_OF_SCOPE_ADJACENT_KEYS = [
  "cardamom",
  "cinnamon",
  "nutmeg",
  "cloves",
  "ginger",
  "pepper",
  "blackPepper",
  "pinkPepper",
  "sichuanPepper",
  "whitePepper",
  "saffron",
  "artemisia",
  "wormwood",
];

function getPerfumeNoteIds(perfume) {
  return [
    ...(perfume.topNotes || []),
    ...(perfume.middleNotes || []),
    ...(perfume.baseNotes || []),
    ...(perfume.generalNotes || []),
  ];
}

describe("Composer Phase 3W taxonomy audit", () => {
  it("finds the exact canonical definitions for all 6 in-scope keys, each its own independent identity", () => {
    expect(notes.coriander).toMatchObject({ name: "Coriander", family: "spicy" });
    expect(notes.caraway).toMatchObject({ name: "Caraway", family: "spicy" });
    expect(notes.cumin).toMatchObject({ name: "Cumin", family: "spicy" });
    expect(notes.fennel).toMatchObject({ name: "Fennel", family: "aromatic" });
    expect(notes.anise).toMatchObject({ name: "Anise", family: "spicy" });
    expect(notes.starAnise).toMatchObject({ name: "Star Anise" });
  });

  it("confirms starAnise carries its own bespoke image, never reusing anise's -- confirming two independently distinct materials, not a generic/specific pair", () => {
    expect(notes.starAnise.noteImageAssetKey).not.toBe(notes.anise.noteImageAssetKey);
    expect(notes.starAnise.name).not.toBe(notes.anise.name);
  });

  it("excludes every out-of-scope adjacent spicy/aromatic material from the six in-scope keys", () => {
    for (const noteId of OUT_OF_SCOPE_ADJACENT_KEYS) {
      expect(notes[noteId], `${noteId} should exist in the taxonomy`).toBeTruthy();
      expect(IN_SCOPE_KEYS).not.toContain(noteId);
    }
  });
});

describe("Composer Phase 3W canonical-data sanity audit", () => {
  const perfumesById = new Map(perfumes.map((perfume) => [perfume.id, perfume]));

  it("confirms no canonical-data correction was made or is recommended -- 212 VIP Black legitimately carries both fennel and anise, and Spicebomb Extreme legitimately carries both caraway and cumin, each pair independently scored", () => {
    const vipBlack = perfumesById.get(106);
    expect(vipBlack.topNotes).toContain("fennel");
    expect(vipBlack.topNotes).toContain("anise");
    expect(NOTE_PROMINENCE_BY_ID[106].fennel).toBeUndefined();
    expect(NOTE_PROMINENCE_BY_ID[106].anise).toBe(6);

    const spicebomb = perfumesById.get(212);
    expect(spicebomb.topNotes).toContain("caraway");
    expect(spicebomb.middleNotes).toContain("cumin");
    expect(NOTE_PROMINENCE_BY_ID[212].caraway).toBeUndefined();
    expect(NOTE_PROMINENCE_BY_ID[212].cumin).toBeUndefined();
  });

  it("confirms anise and starAnise never inherit score or membership from one another", () => {
    expect(NOTE_PROMINENCE_BY_ID[106].starAnise).toBeUndefined();
    expect(NOTE_PROMINENCE_BY_ID[202].anise).toBeUndefined();
    const vipBlack = perfumesById.get(106);
    const sauvage = perfumesById.get(202);
    expect(getPerfumeNoteIds(vipBlack)).not.toContain("starAnise");
    expect(getPerfumeNoteIds(sauvage)).not.toContain("anise");
  });

  it("confirms no fragrance conflates an in-scope key with an adjacent spicy material -- La Nuit de L'Homme's caraway is never confused with its own dominant, already-established cardamom", () => {
    const laNuit = perfumesById.get(118);
    expect(laNuit.baseNotes).toContain("caraway");
    expect(laNuit.topNotes).toContain("cardamom");
    expect(NOTE_PROMINENCE_BY_ID[118].cardamom).toBe(9);
    expect(NOTE_PROMINENCE_BY_ID[118].caraway).toBeUndefined();
  });
});

describe("Composer Phase 3W horizontal calibration -- six independent aromatic seed/spice keys", () => {
  const perfumesById = new Map(perfumes.map((perfume) => [perfume.id, perfume]));

  it("has exactly 87 catalog fragrances to search for exhaustive family membership", () => {
    expect(perfumes).toHaveLength(87);
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

  it("keeps every calibrated value across the six in-scope keys an integer from 1 to 10", () => {
    for (const family of Object.values(ALL_FAMILIES)) {
      for (const [id, score] of Object.entries(family)) {
        if (score === undefined) continue;
        expect(Number.isInteger(score), `id ${id}`).toBe(true);
        expect(score).toBeGreaterThanOrEqual(1);
        expect(score).toBeLessThanOrEqual(10);
      }
    }
  });

  it("never collapses the six in-scope keys into one another, or into any adjacent spicy/aromatic material", () => {
    const allTouchedIds = new Set(Object.values(ALL_FAMILIES).flatMap((family) => Object.keys(family).map(Number)));

    for (const id of allTouchedIds) {
      const entry = NOTE_PROMINENCE_BY_ID[id] || {};
      const fragrance = perfumesById.get(id);
      const ownNoteIds = new Set(getPerfumeNoteIds(fragrance));

      for (const key of IN_SCOPE_KEYS) {
        if (key in entry) {
          expect(ownNoteIds.has(key), `${fragrance.name} does not canonically carry "${key}"`).toBe(true);
        }
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

  it("changes zero prominence values in this phase -- every in-scope score above is exactly what the catalog already held before Phase 3W", () => {
    // This test pins that outcome as a regression guard -- if it ever
    // fails, either a later phase intentionally recalibrated one of
    // these exact keys (update this file's fixtures to match, with a
    // comment), or an unrelated change accidentally drifted a score.
    expect(NOTE_PROMINENCE_BY_ID[106]).toEqual({ blackVanilla: 7, anise: 6 });
    expect(NOTE_PROMINENCE_BY_ID[118]).toEqual({ cardamom: 9, coumarin: 6, lavender: 5, vetiver: 3 });
    expect(NOTE_PROMINENCE_BY_ID[212]).toEqual({ tobacco: 9, vanilla: 8, bourbonVanilla: 8, cinnamon: 6, blackPepper: 5 });
    expect(NOTE_PROMINENCE_BY_ID[202]).toEqual({ ambroxan: 9, bergamot: 7, sichuanPepper: 6, vanilla: 5 });
  });

  it("leaves canonical note data completely unchanged in this phase -- no pyramid was edited for any in-scope member", () => {
    expect(perfumesById.get(106)).toMatchObject({
      name: "212 VIP Black",
      topNotes: ["wormwood", "anise", "fennel"],
    });
    expect(perfumesById.get(202)).toMatchObject({
      name: "Sauvage EDP",
      middleNotes: ["sichuanPepper", "lavender", "starAnise", "nutmeg"],
    });
  });

  it("does not let starAnise inherit prominence from Sauvage EDP's own already-established sichuanPepper, and does not let fennel inherit prominence from 212 VIP Black's own already-established anise", () => {
    expect(NOTE_PROMINENCE_BY_ID[202].starAnise).toBeUndefined();
    expect(NOTE_PROMINENCE_BY_ID[202].sichuanPepper).toBe(6);
    expect(NOTE_PROMINENCE_BY_ID[106].fennel).toBeUndefined();
    expect(NOTE_PROMINENCE_BY_ID[106].anise).toBe(6);
  });

  // The Note Explorer "Most prominent" sort verification for these six
  // keys lives in
  // packages/builder/src/builder/internal/intelligence/buildNoteExplorerViewModel.test.js
  // instead of here -- packages/catalog must never import from
  // packages/builder (ADR-0006), and this file already proves the
  // underlying data (membership, scores, containment) that sort depends on.
});
