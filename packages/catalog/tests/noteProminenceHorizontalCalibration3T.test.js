import { describe, expect, it } from "vitest";

import { fragrances as perfumes, notes } from "@discovery-box/catalog";
import { NOTE_PROMINENCE_BY_ID } from "../src/fragrances.js";

// Composer Phase 3T: narrow regression coverage for the twentieth
// horizontal note-family calibration pass -- two related but exact-
// distinct canonical keys, never collapsed into one umbrella ranking:
// oakmoss and moss.
//
// Taxonomy audit (Step 1) -- exact canonical keys found in notes.js:
//   oakmoss ("Oakmoss", family: "green") -- a specific moss material,
//     with its own bespoke image.
//   moss ("Moss", family: "green", reusing notes/oakmoss.jpg as its own
//     image) -- a generic moss identity, the same generic/specific
//     image-reuse pattern already established for pepper/blackPepper and
//     texasCedar/cedarwood.
//   No fragrance carries both keys. vetiver, patchouli, cedar, and
//     woodyNotes were all re-confirmed as their own distinct, already-
//     established canonical keys, never oakmoss or moss substitutes.
//
// Canonical-data sanity audit (Step 2): every oakmoss- and moss-carrying
// fragrance was checked for a case where the other exact key would be
// clearly warranted instead. No mismatch meeting the Phase 3A basil /
// Phase 3C blackVanilla bar was found in either direction. No canonical-
// data correction was made in this phase.
//
// Across 11 oakmoss and 2 moss fragrance/note pairs -- moss entirely
// unscored coming into this phase -- this phase's own calibration
// changes zero individual pairs. Every already-scored oakmoss entry held
// up as internally consistent, including Hacivat's oakmoss: 8 (correctly
// tied with its own established pineapple: 8, matching "oakmoss" as one
// of its own listed accords -- a genuine, real co-equal fruity-chypre
// dual signature, per its own already-established Phase 3R rationale).
// Club de Nuit Intense Man and Terre d'Hermès EDT were checked and
// confirmed not members of either key.
const OAKMOSS_FAMILY = {
  1: undefined,
  4: undefined,
  9: undefined,
  12: undefined,
  23: 6,
  29: undefined,
  101: undefined,
  110: undefined,
  115: undefined,
  305: undefined,
  406: 8,
};

const MOSS_FAMILY = {
  22: undefined,
  33: undefined,
};

const ALL_FAMILIES = {
  oakmoss: OAKMOSS_FAMILY,
  moss: MOSS_FAMILY,
};

const MOSS_KEYS = ["oakmoss", "moss"];

const ADJACENT_EXCLUDED_KEYS = ["vetiver", "patchouli", "cedar", "woodyNotes", "grass", "galbanum", "oak", "birch"];

function getPerfumeNoteIds(perfume) {
  return [
    ...(perfume.topNotes || []),
    ...(perfume.middleNotes || []),
    ...(perfume.baseNotes || []),
    ...(perfume.generalNotes || []),
  ];
}

describe("Composer Phase 3T taxonomy audit", () => {
  it("finds the exact canonical oakmoss and moss definitions -- related but exact-distinct identities, never collapsed into one umbrella ranking", () => {
    expect(notes.oakmoss).toMatchObject({ name: "Oakmoss", family: "green" });
    expect(notes.moss).toMatchObject({ name: "Moss", family: "green" });
  });

  it("confirms moss reuses oakmoss's own image asset -- the same generic/specific pattern already established for pepper/blackPepper and texasCedar/cedarwood", () => {
    expect(notes.moss.noteImageAssetKey).toBe(notes.oakmoss.noteImageAssetKey);
    expect(notes.moss.name).not.toBe(notes.oakmoss.name);
  });

  it("excludes every adjacent green/earthy/woody material from both exact keys", () => {
    for (const noteId of ADJACENT_EXCLUDED_KEYS) {
      expect(notes[noteId], `${noteId} should exist in the taxonomy`).toBeTruthy();
      expect(MOSS_KEYS).not.toContain(noteId);
    }
  });
});

describe("Composer Phase 3T canonical-data sanity audit", () => {
  const perfumesById = new Map(perfumes.map((perfume) => [perfume.id, perfume]));

  it("confirms no fragrance carries both oakmoss and moss simultaneously", () => {
    for (const id of Object.keys(OAKMOSS_FAMILY).map(Number)) {
      expect(getPerfumeNoteIds(perfumesById.get(id))).not.toContain("moss");
    }
    for (const id of Object.keys(MOSS_FAMILY).map(Number)) {
      expect(getPerfumeNoteIds(perfumesById.get(id))).not.toContain("oakmoss");
    }
  });

  it("confirms no canonical-data correction was made or is recommended -- Hacivat's oakmoss matches its own explicit accords data, not merely perceived chypre character", () => {
    const hacivat = perfumesById.get(406);
    expect(hacivat.accords).toContain("oakmoss");
    expect(hacivat.baseNotes).toContain("oakmoss");
    expect(NOTE_PROMINENCE_BY_ID[406].oakmoss).toBe(8);
  });

  it("confirms Club de Nuit Intense Man and Terre d'Hermès EDT are not members of either key", () => {
    for (const id of [19, 111]) {
      const ownNoteIds = getPerfumeNoteIds(perfumesById.get(id));
      expect(ownNoteIds).not.toContain("oakmoss");
      expect(ownNoteIds).not.toContain("moss");
    }
  });
});

describe("Composer Phase 3T horizontal calibration -- oakmoss and moss", () => {
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

  it("keeps every calibrated oakmoss/moss value an integer from 1 to 10", () => {
    for (const family of Object.values(ALL_FAMILIES)) {
      for (const [id, score] of Object.entries(family)) {
        if (score === undefined) continue;
        expect(Number.isInteger(score), `id ${id}`).toBe(true);
        expect(score).toBeGreaterThanOrEqual(1);
        expect(score).toBeLessThanOrEqual(10);
      }
    }
  });

  it("never collapses oakmoss and moss into one another -- exact-key containment is fully independent", () => {
    const allTouchedIds = new Set(Object.values(ALL_FAMILIES).flatMap((family) => Object.keys(family).map(Number)));

    for (const id of allTouchedIds) {
      const entry = NOTE_PROMINENCE_BY_ID[id] || {};
      const fragrance = perfumesById.get(id);
      const ownNoteIds = new Set(getPerfumeNoteIds(fragrance));

      for (const key of MOSS_KEYS) {
        if (key in entry) {
          expect(ownNoteIds.has(key), `${fragrance.name} does not canonically carry "${key}"`).toBe(true);
        }
      }
    }

    for (const id of Object.keys(OAKMOSS_FAMILY).map(Number)) {
      expect(NOTE_PROMINENCE_BY_ID[id]?.moss).toBeUndefined();
    }
    for (const id of Object.keys(MOSS_FAMILY).map(Number)) {
      expect(NOTE_PROMINENCE_BY_ID[id]?.oakmoss).toBeUndefined();
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

  it("changes zero prominence values in this phase -- every oakmoss/moss score above is exactly what the catalog already held before Phase 3T", () => {
    // This test pins that outcome as a regression guard -- if it ever
    // fails, either a later phase intentionally recalibrated one of
    // these exact keys (update this file's fixtures to match, with a
    // comment), or an unrelated change accidentally drifted an
    // oakmoss/moss score.
    expect(NOTE_PROMINENCE_BY_ID[23]).toEqual({ oakmoss: 6, leather: 5, jasmine: 4 });
    expect(NOTE_PROMINENCE_BY_ID[406]).toEqual({ pineapple: 8, oakmoss: 8, cedar: 4, patchouli: 4 });
  });

  it("leaves canonical note data completely unchanged in this phase -- no pyramid was edited for any oakmoss/moss member", () => {
    expect(perfumesById.get(406)).toMatchObject({
      name: "Hacivat",
      baseNotes: ["woodyNotes", "oakmoss", "cedar"],
    });
    expect(perfumesById.get(22)).toMatchObject({
      name: "Legend Blue",
      baseNotes: ["ambroxan", "moss"],
    });
  });

  it("does not manufacture a rank difference between two genuinely co-equal signature notes -- Hacivat's oakmoss:8 correctly ties its own pineapple:8", () => {
    expect(NOTE_PROMINENCE_BY_ID[406].oakmoss).toBe(NOTE_PROMINENCE_BY_ID[406].pineapple);
    expect(NOTE_PROMINENCE_BY_ID[406].oakmoss).toBe(8);
  });

  it("never lets generic moss inherit oakmoss's prominence merely for sharing the generic term -- moss remains unscored on its own evidence", () => {
    expect(NOTE_PROMINENCE_BY_ID[22].moss).toBeUndefined();
    expect(NOTE_PROMINENCE_BY_ID[33].moss).toBeUndefined();
  });

  // The Note Explorer "Most prominent" sort verification for oakmoss and
  // moss lives in
  // packages/builder/src/builder/internal/intelligence/buildNoteExplorerViewModel.test.js
  // instead of here -- packages/catalog must never import from
  // packages/builder (ADR-0006), and this file already proves the
  // underlying data (membership, scores, containment) that sort depends on.
});
