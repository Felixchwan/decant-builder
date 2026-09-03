import { describe, expect, it } from "vitest";

import { fragrances as perfumes, notes } from "@discovery-box/catalog";
import { NOTE_PROMINENCE_BY_ID } from "../src/fragrances.js";

// Composer Phase 3E: narrow regression coverage for the fifth horizontal
// note-family calibration pass -- the sandalwood and patchouli canonical-
// key families.
//
// Taxonomy audit (Step 1) -- exact canonical keys found in notes.js:
//   Sandalwood family (2 keys): sandalwood ("Sandalwood"),
//     australianSandalwood ("Australian Sandalwood") -- notes.js itself
//     documents these as a deliberately-kept-distinct pair (see the
//     comment above the "spices" note entry, which cites this exact pair
//     as precedent for never merging closely-related concepts).
//   Patchouli family (2 keys): patchouli ("Patchouli"), patchouliNoir
//     ("Patchouli Noir") -- the latter exists in the taxonomy but has
//     zero catalog membership, audited and confirmed empty, not
//     calibrated. Generic woody/earthy notes (woodyNotes, cashmeran,
//     akigalawood, cedar, cedarwood, vetiver, oakmoss, etc.) were never
//     included merely for being woody or earthy -- none of them are
//     sandalwood or patchouli variants.
//
// Canonical-data sanity audit (Step 2): every fragrance was checked for a
// case where the more specific australianSandalwood or patchouliNoir key
// exists and the documented note identity clearly supports it over the
// generic key actually used. No mismatch meeting the Phase 3A basil /
// Phase 3C blackVanilla bar was found -- Orange X Santal (305) already
// correctly uses the specific australianSandalwood (matching its own
// "Santal" identity and Essential Parfums' own material naming), and no
// fragrance was found generalized under "sandalwood" or "patchouli"
// where a specific listed ingredient clearly warranted a more specific
// key. No canonical-data correction was made in this phase.
//
// Despite 22 sandalwood, 1 australianSandalwood, 33 patchouli, and 0
// patchouliNoir fragrance/note pairs, the approved calibration adds only
// 2 new scores. Generic creaminess/smooth woodiness was never treated as
// proof of sandalwood prominence, and generic earthiness/darkness/woody
// depth was never treated as proof of patchouli prominence on its own --
// though patchouli genuinely is a signature identity in some fragrances
// here (Tuxedo's 9, this catalog's highest patchouli score, matches its
// own shipped subtitle "Sharp Patchouli"), which is exactly why each
// case was compared individually against its real peers rather than
// assumed from the note's mere presence. The only 2 approved additions:
//   2   Light Blue Pour Homme EDT -- patchouli: unscored -> 4 (the SOLE
//                                   base note in a minimal 3-note
//                                   composition, providing real dry-down
//                                   structure beneath the already-scored
//                                   lemon:7 top, despite no direct accord
//                                   corroboration)
//   111 Terre d'Hermès EDT        -- patchouli: unscored -> 5 (3rd of 4
//                                   base notes alongside the already-
//                                   scored vetiver:8/cedar:6, "earthy" is
//                                   accord #3, but clearly secondary to
//                                   vetiver's dominant, defining role)
const SANDALWOOD_FAMILY = {
  4: undefined,
  5: undefined,
  6: undefined,
  9: undefined,
  12: undefined,
  15: 5,
  22: 4,
  29: undefined,
  32: undefined,
  107: undefined,
  112: undefined,
  115: undefined,
  208: undefined,
  214: undefined,
  301: 7,
  302: undefined,
  401: undefined,
  402: undefined,
  404: undefined,
  405: undefined,
  410: undefined,
};

const AUSTRALIAN_SANDALWOOD_FAMILY = { 305: 7 };

const PATCHOULI_FAMILY = {
  1: undefined,
  2: 4,
  6: undefined,
  15: undefined,
  16: undefined,
  17: undefined,
  19: undefined,
  21: 5,
  25: 4,
  29: undefined,
  33: 5,
  101: 4,
  103: undefined,
  109: 5,
  110: 5,
  111: 5,
  115: undefined,
  205: 6,
  206: 6,
  207: undefined,
  208: undefined,
  209: 6,
  211: undefined,
  215: undefined,
  302: undefined,
  303: undefined,
  304: undefined,
  306: 7,
  402: undefined,
  403: undefined,
  404: undefined,
  406: 4,
  410: 6,
  501: 9,
};

const PATCHOULI_NOIR_FAMILY = {};

const ALL_FAMILIES = {
  sandalwood: SANDALWOOD_FAMILY,
  australianSandalwood: AUSTRALIAN_SANDALWOOD_FAMILY,
  patchouli: PATCHOULI_FAMILY,
};

const SANDALWOOD_KEYS = ["sandalwood", "australianSandalwood"];
const PATCHOULI_KEYS = ["patchouli", "patchouliNoir"];

// The exact, unrelated prominence values on the two touched fragrances,
// pinned so this phase is provably scoped to only the 2 approved
// additions above.
const UNRELATED_VALUES_BY_ID = {
  2: { lemon: 7, rosemary: 5 },
  111: { orange: 8, vetiver: 8, grapefruit: 7, cedar: 6, pepper: 4 },
};

function getPerfumeNoteIds(perfume) {
  return [
    ...(perfume.topNotes || []),
    ...(perfume.middleNotes || []),
    ...(perfume.baseNotes || []),
    ...(perfume.generalNotes || []),
  ];
}

describe("Composer Phase 3E taxonomy audit", () => {
  it("finds exactly these 2 canonical sandalwood-family keys in the note dictionary, with distinct display names", () => {
    expect(notes.sandalwood).toMatchObject({ name: "Sandalwood" });
    expect(notes.australianSandalwood).toMatchObject({ name: "Australian Sandalwood" });
  });

  it("finds exactly these 2 canonical patchouli-family keys in the note dictionary, with distinct display names", () => {
    expect(notes.patchouli).toMatchObject({ name: "Patchouli" });
    expect(notes.patchouliNoir).toMatchObject({ name: "Patchouli Noir" });
  });

  it("excludes generic woody/earthy notes from both families despite thematic overlap", () => {
    const unrelatedWoodyEarthyNotes = ["woodyNotes", "cashmeran", "akigalawood", "cedar", "cedarwood", "vetiver", "oakmoss"];
    for (const noteId of unrelatedWoodyEarthyNotes) {
      expect(notes[noteId]).toBeTruthy();
      expect(SANDALWOOD_KEYS).not.toContain(noteId);
      expect(PATCHOULI_KEYS).not.toContain(noteId);
    }
  });

  it("confirms patchouliNoir exists in the taxonomy but has zero catalog membership", () => {
    expect(notes.patchouliNoir).toBeTruthy();
    const matches = perfumes.filter((perfume) => getPerfumeNoteIds(perfume).includes("patchouliNoir"));
    expect(matches).toHaveLength(0);
    expect(PATCHOULI_NOIR_FAMILY).toEqual({});
  });
});

describe("Composer Phase 3E canonical-data sanity audit", () => {
  const perfumesById = new Map(perfumes.map((perfume) => [perfume.id, perfume]));

  it("confirms no canonical-data correction was made or is recommended -- every sandalwood/patchouli-variant assignment already uses its most specific available key", () => {
    // Orange X Santal already uses the specific australianSandalwood, not
    // generic sandalwood -- matching its own "Santal" identity.
    expect(perfumesById.get(305).generalNotes).toContain("australianSandalwood");
    expect(perfumesById.get(305).generalNotes).not.toContain("sandalwood");

    // Tuxedo's patchouli is already generic "patchouli" -- there is no
    // more specific documented variant (e.g. patchouliNoir) warranted by
    // its own note identity, despite patchouli being this fragrance's
    // defining signature (matching its own shipped subtitle).
    expect(perfumesById.get(501).baseNotes).toContain("patchouli");
    expect(perfumesById.get(501).baseNotes).not.toContain("patchouliNoir");
  });
});

describe("Composer Phase 3E horizontal calibration -- sandalwood and patchouli canonical-key families", () => {
  const perfumesById = new Map(perfumes.map((perfume) => [perfume.id, perfume]));

  it("has exactly 88 catalog fragrances to search for exhaustive family membership", () => {
    expect(perfumes).toHaveLength(88);
  });

  for (const [noteId, family] of Object.entries(ALL_FAMILIES)) {
    it(`${noteId} family membership is exhaustive against the live catalog`, () => {
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

  it("keeps every calibrated sandalwood/patchouli-family value an integer from 1 to 10", () => {
    for (const family of Object.values(ALL_FAMILIES)) {
      for (const [id, score] of Object.entries(family)) {
        if (score === undefined) continue;
        expect(Number.isInteger(score), `id ${id}`).toBe(true);
        expect(score).toBeGreaterThanOrEqual(1);
        expect(score).toBeLessThanOrEqual(10);
      }
    }
  });

  it("never collapses distinct canonical keys into one another -- sandalwood and australianSandalwood, patchouli and patchouliNoir, stay independent", () => {
    const allTouchedIds = new Set(Object.values(ALL_FAMILIES).flatMap((family) => Object.keys(family).map(Number)));

    for (const id of allTouchedIds) {
      const entry = NOTE_PROMINENCE_BY_ID[id] || {};
      const fragrance = perfumesById.get(id);
      const ownNoteIds = new Set(getPerfumeNoteIds(fragrance));

      for (const key of [...SANDALWOOD_KEYS, ...PATCHOULI_KEYS]) {
        if (key in entry) {
          expect(ownNoteIds.has(key), `${fragrance.name} does not canonically carry "${key}"`).toBe(true);
        }
      }
    }

    // Orange X Santal is scored under australianSandalwood, never
    // generic sandalwood, and vice versa for every generic-sandalwood
    // fragrance -- no fragrance carries both keys.
    for (const id of Object.keys(SANDALWOOD_FAMILY).map(Number)) {
      expect(NOTE_PROMINENCE_BY_ID[id]?.australianSandalwood).toBeUndefined();
    }
    expect(NOTE_PROMINENCE_BY_ID[305]?.sandalwood).toBeUndefined();
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

  it("leaves every unrelated prominence value on the two touched fragrances exactly as it was -- this phase only adds two individual scores", () => {
    for (const [id, unrelatedValues] of Object.entries(UNRELATED_VALUES_BY_ID)) {
      const liveEntry = { ...NOTE_PROMINENCE_BY_ID[id] };
      for (const key of [...SANDALWOOD_KEYS, ...PATCHOULI_KEYS]) delete liveEntry[key];

      expect(liveEntry, `${perfumesById.get(Number(id)).name}`).toEqual(unrelatedValues);
    }
  });

  it("leaves the two touched fragrances' canonical note pyramids exactly as they were -- no canonical note data was changed in this phase", () => {
    expect(perfumesById.get(2)).toMatchObject({
      name: "Light Blue Pour Homme EDT",
      topNotes: ["lemon"],
      middleNotes: ["rosemary"],
      baseNotes: ["patchouli"],
    });
    expect(perfumesById.get(111)).toMatchObject({
      name: "Terre d'Hermès EDT",
      baseNotes: ["vetiver", "cedar", "patchouli", "benzoin"],
    });
  });

  it("has exactly one 9-10 score across both families (Tuxedo's patchouli) -- reflecting a genuinely documented signature identity, not generic earthiness", () => {
    const allScores = Object.entries(ALL_FAMILIES).flatMap(([noteId, family]) =>
      Object.entries(family)
        .filter(([, value]) => value !== undefined && value >= 9)
        .map(([id, value]) => `${id}:${noteId}:${value}`)
    );

    expect(allScores).toEqual(["501:patchouli:9"]);
  });

  // The Note Explorer "Most prominent" sort verification for sandalwood
  // and patchouli lives in
  // packages/builder/src/builder/internal/intelligence/buildNoteExplorerViewModel.test.js
  // instead of here -- packages/catalog must never import from
  // packages/builder (ADR-0006), and this file already proves the
  // underlying data (membership, scores, containment) that sort depends on.
});
