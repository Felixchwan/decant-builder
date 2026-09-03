import { describe, expect, it } from "vitest";

import { fragrances as perfumes, notes } from "@discovery-box/catalog";
import { NOTE_PROMINENCE_BY_ID } from "../src/fragrances.js";

// Composer Phase 3G: narrow regression coverage for the seventh horizontal
// note-family calibration pass -- the iris and leather canonical-key
// families.
//
// Taxonomy audit (Step 1) -- exact canonical keys found in notes.js:
//   Iris family (1 key): iris ("Iris", family: "floral") -- no
//     "orris"/"orrisRoot" key, or any other explicitly-qualified iris
//     variant, exists in the taxonomy. Do not invent one.
//   Leather family (2 keys): leather ("Leather", family: "leather"),
//     suede ("Suede", no family tag) -- both real, separately-named
//     materials, kept deliberately distinct (CH Men (12) legitimately
//     carries both, scored independently: leather 7, suede 6).
//   Adjacent keys explicitly excluded (5 keys, real but semantically
//     distinct from iris/leather despite an overlapping perceptual
//     effect): violetLeaf (a green floral note, not an iris variant, no
//     family tag), powderyNotes (family: "powdery" -- a generic texture
//     descriptor, not iris), birch (family: "woody"), birchLeaf (no
//     family tag, a distinct aromatic-green material), leatherwood
//     (family: "woody" -- notes.js itself documents this elsewhere as its
//     own real Fragrantica note, "not an alias" for leather).
//
// Canonical-data sanity audit (Step 2): every iris-carrying fragrance was
// checked for a case where a more specific orris variant would be
// warranted (none exists in the taxonomy, so no reclassification target
// exists); every leather-carrying fragrance was checked for a case where
// generic leather should instead be the explicit suede key. No mismatch
// meeting the Phase 3A basil / Phase 3C blackVanilla bar was found in
// either family, and no fragrance's canonical key was renamed.
//
// Despite 7 iris, 12 leather, and 2 suede fragrance/note pairs, the
// approved calibration changes exactly 1 individual pair -- every other
// already-scored entry held up as internally consistent under comparison
// against real peers, and the overwhelming majority of unscored members
// stay unscored, per this phase's own strict editorial caution (iris:
// powderiness/lipstick-like/violet-like/soapy character is not iris
// evidence; leather: smoke/birch/suede/animalic darkness/dry woodiness is
// not leather evidence). The one approved change:
//   30 Vibrant Leather Bogoss -- leather: 7 -> 9. Its own catalog data
//      already names "leather" as the second of five listed accords
//      (["citrus", "leather", "woody", "fresh", "green"]) and its own
//      shortName drops "Bogoss" entirely, leaving "Vibrant Leather" as the
//      product's own declared identity -- not a perceptual read, and
//      exactly the case this phase's own editorial caution anticipated:
//      "where leather is truly a defining identity, do not under-score it
//      merely because it sits in the base."
const IRIS_FAMILY = {
  33: undefined,
  112: undefined,
  113: 4,
  205: 8,
  208: 9,
  214: 6,
  405: 6,
};

const LEATHER_FAMILY = {
  6: undefined,
  7: 8,
  10: 4,
  12: 7,
  14: 6,
  16: 6,
  23: 5,
  25: 7,
  30: 9,
  109: 6,
  115: undefined,
  215: undefined,
  306: 5,
};

const SUEDE_FAMILY = { 12: 6, 32: 5 };

const ALL_FAMILIES = {
  iris: IRIS_FAMILY,
  leather: LEATHER_FAMILY,
  suede: SUEDE_FAMILY,
};

const IRIS_KEYS = ["iris"];
const LEATHER_KEYS = ["leather", "suede"];

const ADJACENT_EXCLUDED_KEYS = ["violetLeaf", "powderyNotes", "birch", "birchLeaf", "leatherwood"];

// The exact, unrelated prominence values on the one touched fragrance,
// pinned so this phase is provably scoped to only the 1 approved change
// above.
const UNRELATED_VALUES_BY_ID = {
  30: { bergamot: 5 },
};

function getPerfumeNoteIds(perfume) {
  return [
    ...(perfume.topNotes || []),
    ...(perfume.middleNotes || []),
    ...(perfume.baseNotes || []),
    ...(perfume.generalNotes || []),
  ];
}

describe("Composer Phase 3G taxonomy audit", () => {
  it("finds exactly 1 true canonical iris-family key in the note dictionary -- as of Phase 3G, no orris/orrisRoot variant existed", () => {
    // As of this phase, no catalog fragrance's own source data had ever
    // named "orris" -- that changed later with Ralph's Club Elixir, whose
    // merchant-supplied note pyramid explicitly names "Orris" (perceptually
    // related to but a documented-distinct source material from iris),
    // adding a genuine, separately-scoped orris key -- see notes.js. That
    // key was never part of this phase's own 7-member iris family and
    // carries no member of its own here.
    expect(notes.iris).toMatchObject({ name: "Iris", family: "floral" });
    expect(notes.orris).toMatchObject({ name: "Orris" });
    expect(notes.orrisRoot).toBeUndefined();
  });

  it("finds exactly these 2 canonical leather-family keys in the note dictionary, with distinct display names", () => {
    expect(notes.leather).toMatchObject({ name: "Leather", family: "leather" });
    expect(notes.suede).toMatchObject({ name: "Suede" });
  });

  it("excludes every adjacent material from both families, despite an overlapping perceptual effect", () => {
    for (const noteId of ADJACENT_EXCLUDED_KEYS) {
      expect(notes[noteId], `${noteId} should exist in the taxonomy`).toBeTruthy();
      expect(IRIS_KEYS).not.toContain(noteId);
      expect(LEATHER_KEYS).not.toContain(noteId);
    }
    // leatherwood and birch are tagged family: "woody" in notes.js, not
    // "leather" -- confirming neither is a taxonomy-recognized leather
    // variant despite the name/perceptual overlap.
    expect(notes.leatherwood.family).toBe("woody");
    expect(notes.birch.family).toBe("woody");
    expect(notes.powderyNotes.family).toBe("powdery");
  });
});

describe("Composer Phase 3G canonical-data sanity audit", () => {
  const perfumesById = new Map(perfumes.map((perfume) => [perfume.id, perfume]));

  it("confirms no canonical-data correction was made or is recommended -- CH Men already correctly carries both leather and suede as independent, distinct keys", () => {
    const chMen = perfumesById.get(12);
    expect(chMen.baseNotes).toContain("leather");
    expect(chMen.baseNotes).toContain("suede");
    expect(NOTE_PROMINENCE_BY_ID[12].leather).toBe(7);
    expect(NOTE_PROMINENCE_BY_ID[12].suede).toBe(6);
  });

  it("confirms Vibrant Leather Bogoss's canonical key remains generic \"leather\" -- only the score changed, not the key", () => {
    const vibrantLeather = perfumesById.get(30);
    expect(vibrantLeather.baseNotes).toContain("leather");
    expect(vibrantLeather.baseNotes).not.toContain("suede");
    expect(vibrantLeather.accords).toContain("leather");
    expect(vibrantLeather.shortName).toBe("Vibrant Leather");
  });
});

describe("Composer Phase 3G horizontal calibration -- iris and leather canonical-key families", () => {
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

  it("keeps every calibrated iris/leather-family value an integer from 1 to 10", () => {
    for (const family of Object.values(ALL_FAMILIES)) {
      for (const [id, score] of Object.entries(family)) {
        if (score === undefined) continue;
        expect(Number.isInteger(score), `id ${id}`).toBe(true);
        expect(score).toBeGreaterThanOrEqual(1);
        expect(score).toBeLessThanOrEqual(10);
      }
    }
  });

  it("never collapses distinct canonical keys into one another -- leather and suede stay independent", () => {
    const allTouchedIds = new Set(Object.values(ALL_FAMILIES).flatMap((family) => Object.keys(family).map(Number)));

    for (const id of allTouchedIds) {
      const entry = NOTE_PROMINENCE_BY_ID[id] || {};
      const fragrance = perfumesById.get(id);
      const ownNoteIds = new Set(getPerfumeNoteIds(fragrance));

      for (const key of [...IRIS_KEYS, ...LEATHER_KEYS]) {
        if (key in entry) {
          expect(ownNoteIds.has(key), `${fragrance.name} does not canonically carry "${key}"`).toBe(true);
        }
      }
    }

    // No generic-leather fragrance is ever also scored under suede as if
    // they were the same material, and vice versa -- CH Men (12) is the
    // sole fragrance carrying both, and each key stands on its own score.
    for (const id of Object.keys(LEATHER_FAMILY).map(Number)) {
      if (id === 12) continue;
      expect(NOTE_PROMINENCE_BY_ID[id]?.suede).toBeUndefined();
    }
    for (const id of Object.keys(SUEDE_FAMILY).map(Number)) {
      if (id === 12) continue;
      expect(NOTE_PROMINENCE_BY_ID[id]?.leather).toBeUndefined();
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

  it("leaves every unrelated prominence value on the one touched fragrance exactly as it was -- this phase only changes one individual score", () => {
    for (const [id, unrelatedValues] of Object.entries(UNRELATED_VALUES_BY_ID)) {
      const liveEntry = { ...NOTE_PROMINENCE_BY_ID[id] };
      for (const key of [...IRIS_KEYS, ...LEATHER_KEYS]) delete liveEntry[key];

      expect(liveEntry, `${perfumesById.get(Number(id)).name}`).toEqual(unrelatedValues);
    }
  });

  it("leaves the touched fragrance's canonical note pyramid exactly as it was -- no canonical note data was changed in this phase", () => {
    expect(perfumesById.get(30)).toMatchObject({
      name: "Vibrant Leather Bogoss",
      topNotes: ["bergamot"],
      middleNotes: ["bamboo"],
      baseNotes: ["leather", "woodyNotes"],
    });
  });

  it("has exactly two 9-10 scores across both families (Prada L'Homme's iris and Vibrant Leather Bogoss's leather) -- each reflecting a genuinely documented signature identity, not generic perceptual overlap", () => {
    const allScores = Object.entries(ALL_FAMILIES).flatMap(([noteId, family]) =>
      Object.entries(family)
        .filter(([, value]) => value !== undefined && value >= 9)
        .map(([id, value]) => `${id}:${noteId}:${value}`)
    );

    expect(allScores.sort()).toEqual(["208:iris:9", "30:leather:9"].sort());
  });

  // The Note Explorer "Most prominent" sort verification for iris,
  // leather, and suede lives in
  // packages/builder/src/builder/internal/intelligence/buildNoteExplorerViewModel.test.js
  // instead of here -- packages/catalog must never import from
  // packages/builder (ADR-0006), and this file already proves the
  // underlying data (membership, scores, containment) that sort depends on.
});
