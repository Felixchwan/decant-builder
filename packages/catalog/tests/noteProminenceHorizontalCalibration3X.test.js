import { describe, expect, it } from "vitest";

import { fragrances as perfumes, notes } from "@discovery-box/catalog";
import { NOTE_PROMINENCE_BY_ID } from "../src/fragrances.js";

// Composer Phase 3X: narrow regression coverage for the twenty-fourth
// horizontal note-family calibration pass -- nine independent minor-
// floral canonical keys, grouped only for workflow efficiency and never
// as one canonical family, each calibrated independently:
// lilyOfTheValley, hyacinth, osmanthus, cyclamen, magnolia, freesia,
// frangipani, mignonette, and whiteLotus.
//
// Taxonomy audit (Step 1) -- exact canonical keys found in notes.js:
//   lilyOfTheValley ("Lily-of-the-Valley", family: "floral")
//   hyacinth ("Hyacinth", family: "floral")
//   osmanthus ("Osmanthus", no family tag)
//   cyclamen ("Cyclamen", family: "floral")
//   magnolia ("Magnolia", family: "floral")
//   freesia ("Freesia", family: "floral")
//   frangipani ("Frangipani", family: "floral")
//   mignonette ("Mignonette", family: "floral")
//   whiteLotus ("White Lotus", family: "floral")
//   jasmine, rose, roseDeMai, violet, violetLeaf, iris, geranium,
//     orangeBlossom, and neroli were all re-confirmed as their own
//     distinct, already-established canonical keys, out of scope for
//     this phase.
//
// Canonical-data sanity audit (Step 2): every in-scope key's members
// were checked against their own accords/name/shortName for a case
// where a different in-scope or adjacent key would be clearly
// warranted instead. No mismatch meeting the Phase 3A basil / Phase 3C
// blackVanilla bar was found in any direction. Acqua di Gio EDT
// legitimately carries four in-scope keys simultaneously (hyacinth,
// cyclamen, freesia, mignonette), all independently unscored inside its
// own 13-note middle-note list, whose own accords tag never even
// mentions "floral" -- reinforcing that these are genuinely diffuse
// background notes, not misassigned identities. No canonical-data
// correction was made or is recommended in this phase.
//
// Across 3 lilyOfTheValley, 2 hyacinth, 2 osmanthus, 1 cyclamen, 1
// magnolia, 1 freesia, 1 frangipani, 1 mignonette, and 1 whiteLotus
// fragrance/note pairs, this phase's own calibration changes zero
// individual pairs. Birds of Paradise for Him's already-scored
// frangipani: 5 and Bvlgari Man Rain Essence's already-scored
// whiteLotus: 5 both held up as internally consistent, each one of only
// 2-3 total middle notes in its own fragrance and coherently ranked
// relative to its own already-established neighbors. None of the seven
// remaining unscored memberships is named or accord-tagged for its own
// in-scope key specifically -- generic "white floral"/"floral" accord
// tags do not clear the bar under the strict editorial caution against
// inferring identity from generic floral impression alone.
const LILY_OF_THE_VALLEY_FAMILY = {
  9: undefined,
  101: undefined,
  501: undefined,
};

const HYACINTH_FAMILY = {
  1: undefined,
  3: undefined,
};

const OSMANTHUS_FAMILY = {
  304: undefined,
  403: undefined,
};

const CYCLAMEN_FAMILY = { 1: undefined };
const MAGNOLIA_FAMILY = { 23: undefined };
const FREESIA_FAMILY = { 1: undefined };
const FRANGIPANI_FAMILY = { 107: 5 };
const MIGNONETTE_FAMILY = { 1: undefined };
const WHITE_LOTUS_FAMILY = { 105: 5 };

const ALL_FAMILIES = {
  lilyOfTheValley: LILY_OF_THE_VALLEY_FAMILY,
  hyacinth: HYACINTH_FAMILY,
  osmanthus: OSMANTHUS_FAMILY,
  cyclamen: CYCLAMEN_FAMILY,
  magnolia: MAGNOLIA_FAMILY,
  freesia: FREESIA_FAMILY,
  frangipani: FRANGIPANI_FAMILY,
  mignonette: MIGNONETTE_FAMILY,
  whiteLotus: WHITE_LOTUS_FAMILY,
};

const IN_SCOPE_KEYS = [
  "lilyOfTheValley",
  "hyacinth",
  "osmanthus",
  "cyclamen",
  "magnolia",
  "freesia",
  "frangipani",
  "mignonette",
  "whiteLotus",
];
const OUT_OF_SCOPE_ADJACENT_KEYS = [
  "jasmine",
  "rose",
  "roseDeMai",
  "violet",
  "violetLeaf",
  "iris",
  "geranium",
  "orangeBlossom",
  "neroli",
];

function getPerfumeNoteIds(perfume) {
  return [
    ...(perfume.topNotes || []),
    ...(perfume.middleNotes || []),
    ...(perfume.baseNotes || []),
    ...(perfume.generalNotes || []),
  ];
}

describe("Composer Phase 3X taxonomy audit", () => {
  it("finds the exact canonical definitions for all 9 in-scope keys, each its own independent identity", () => {
    expect(notes.lilyOfTheValley).toMatchObject({ name: "Lily-of-the-Valley", family: "floral" });
    expect(notes.hyacinth).toMatchObject({ name: "Hyacinth", family: "floral" });
    expect(notes.osmanthus).toMatchObject({ name: "Osmanthus" });
    expect(notes.cyclamen).toMatchObject({ name: "Cyclamen", family: "floral" });
    expect(notes.magnolia).toMatchObject({ name: "Magnolia", family: "floral" });
    expect(notes.freesia).toMatchObject({ name: "Freesia", family: "floral" });
    expect(notes.frangipani).toMatchObject({ name: "Frangipani", family: "floral" });
    expect(notes.mignonette).toMatchObject({ name: "Mignonette", family: "floral" });
    expect(notes.whiteLotus).toMatchObject({ name: "White Lotus", family: "floral" });
  });

  it("excludes every out-of-scope adjacent floral material from the nine in-scope keys", () => {
    for (const noteId of OUT_OF_SCOPE_ADJACENT_KEYS) {
      expect(notes[noteId], `${noteId} should exist in the taxonomy`).toBeTruthy();
      expect(IN_SCOPE_KEYS).not.toContain(noteId);
    }
  });
});

describe("Composer Phase 3X canonical-data sanity audit", () => {
  const perfumesById = new Map(perfumes.map((perfume) => [perfume.id, perfume]));

  it("confirms no canonical-data correction was made or is recommended -- Acqua di Gio EDT legitimately carries four in-scope keys simultaneously, each independently unscored", () => {
    const adg = perfumesById.get(1);
    expect(adg.middleNotes).toContain("hyacinth");
    expect(adg.middleNotes).toContain("cyclamen");
    expect(adg.middleNotes).toContain("freesia");
    expect(adg.middleNotes).toContain("mignonette");
    expect(adg.accords).not.toContain("floral");
    for (const key of ["hyacinth", "cyclamen", "freesia", "mignonette"]) {
      expect(NOTE_PROMINENCE_BY_ID[1]?.[key]).toBeUndefined();
    }
  });

  it("confirms no fragrance conflates an in-scope key with an already-established adjacent floral -- Legend EDP's magnolia is never confused with its own scored jasmine", () => {
    const legend = perfumesById.get(23);
    expect(legend.middleNotes).toContain("magnolia");
    expect(legend.middleNotes).toContain("jasmine");
    expect(NOTE_PROMINENCE_BY_ID[23].jasmine).toBe(4);
    expect(NOTE_PROMINENCE_BY_ID[23].magnolia).toBeUndefined();
  });

  it("confirms no generic 'white floral'/'floral' accord tag alone was used to justify a score -- Essenza and Versace Pour Homme's lilyOfTheValley/hyacinth remain unscored despite the generic accord tag", () => {
    const essenza = perfumesById.get(101);
    expect(essenza.accords).toContain("white floral");
    expect(NOTE_PROMINENCE_BY_ID[101]?.lilyOfTheValley).toBeUndefined();

    const versace = perfumesById.get(3);
    expect(versace.accords).toContain("floral");
    expect(NOTE_PROMINENCE_BY_ID[3]?.hyacinth).toBeUndefined();
  });
});

describe("Composer Phase 3X horizontal calibration -- nine independent minor-floral keys", () => {
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

  it("keeps every calibrated value across the nine in-scope keys an integer from 1 to 10", () => {
    for (const family of Object.values(ALL_FAMILIES)) {
      for (const [id, score] of Object.entries(family)) {
        if (score === undefined) continue;
        expect(Number.isInteger(score), `id ${id}`).toBe(true);
        expect(score).toBeGreaterThanOrEqual(1);
        expect(score).toBeLessThanOrEqual(10);
      }
    }
  });

  it("never collapses the nine in-scope keys into one another, or into any adjacent floral material", () => {
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

  it("changes zero prominence values in this phase -- every in-scope score above is exactly what the catalog already held before Phase 3X", () => {
    // This test pins that outcome as a regression guard -- if it ever
    // fails, either a later phase intentionally recalibrated one of
    // these exact keys (update this file's fixtures to match, with a
    // comment), or an unrelated change accidentally drifted a score.
    expect(NOTE_PROMINENCE_BY_ID[107]).toEqual({ passionFruit: 6, frangipani: 5 });
    expect(NOTE_PROMINENCE_BY_ID[105]).toEqual({ greenTea: 7, whiteLotus: 5, mineralNotes: 4 });
    expect(NOTE_PROMINENCE_BY_ID[1]).toEqual({ seaNotes: 10, calone: 9, bergamot: 7, jasmine: 5, whiteMusk: 4 });
    expect(NOTE_PROMINENCE_BY_ID[23]).toEqual({ oakmoss: 6, leather: 5, jasmine: 4 });
  });

  it("leaves canonical note data completely unchanged in this phase -- no pyramid was edited for any in-scope member", () => {
    expect(perfumesById.get(1)).toMatchObject({
      name: "Acqua di Gio EDT",
      middleNotes: ["seaNotes", "jasmine", "calone", "rosemary", "peach", "freesia", "hyacinth", "cyclamen", "violet", "coriander", "rose", "nutmeg", "mignonette"],
    });
    expect(perfumesById.get(107)).toMatchObject({
      name: "Birds of Paradise for Him",
      middleNotes: ["frangipani", "lavender", "geranium"],
    });
  });

  it("does not manufacture a score for a diffuse background note merely to avoid an all-unscored result -- Acqua di Gio EDT's four in-scope keys remain unscored despite the fragrance's own established prominence hierarchy", () => {
    const adg = NOTE_PROMINENCE_BY_ID[1];
    for (const key of ["hyacinth", "cyclamen", "freesia", "mignonette"]) {
      expect(adg[key]).toBeUndefined();
    }
    expect(adg.seaNotes).toBe(10);
  });

  it("does not suppress a genuinely recognizable axis merely because another note is stronger -- frangipani:5 and whiteLotus:5 both stand despite their fragrances' own stronger top notes", () => {
    expect(NOTE_PROMINENCE_BY_ID[107].frangipani).toBe(5);
    expect(NOTE_PROMINENCE_BY_ID[107].frangipani).toBeLessThan(NOTE_PROMINENCE_BY_ID[107].passionFruit);
    expect(NOTE_PROMINENCE_BY_ID[105].whiteLotus).toBe(5);
    expect(NOTE_PROMINENCE_BY_ID[105].whiteLotus).toBeLessThan(NOTE_PROMINENCE_BY_ID[105].greenTea);
  });

  // The Note Explorer "Most prominent" sort verification for these nine
  // keys lives in
  // packages/builder/src/builder/internal/intelligence/buildNoteExplorerViewModel.test.js
  // instead of here -- packages/catalog must never import from
  // packages/builder (ADR-0006), and this file already proves the
  // underlying data (membership, scores, containment) that sort depends on.
});
