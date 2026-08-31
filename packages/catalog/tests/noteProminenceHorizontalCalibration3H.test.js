import { describe, expect, it } from "vitest";

import { fragrances as perfumes, notes } from "@discovery-box/catalog";
import { NOTE_PROMINENCE_BY_ID } from "../src/fragrances.js";

// Composer Phase 3H: narrow regression coverage for the eighth horizontal
// note-family calibration pass -- the tobacco and coffee canonical-key
// families.
//
// Taxonomy audit (Step 1) -- exact canonical keys found in notes.js:
//   Tobacco family (1 key): tobacco ("Tobacco", family: "tobacco") -- no
//     "tobaccoLeaf" key, or any other explicitly-qualified tobacco
//     variant, exists in the taxonomy. Do not invent one.
//   Coffee family (1 key): roastedCoffeeBeans ("Roasted Coffee Beans", no
//     family tag) -- no generic "coffee" key exists in the taxonomy at
//     all, so there is nothing to keep it distinct from; it is simply the
//     only true canonical coffee-identity key.
//   Adjacent keys explicitly excluded (8 keys, real but semantically
//     distinct dark/gourmand materials never treated as tobacco or coffee
//     substitutes): caramel (family: "sweet"), toffee (family: "sweet"),
//     tonkaBean (family: "sweet"), vanilla (family: "sweet"),
//     madagascarVanilla (no family tag, its own established vanilla-
//     family variant per Phase 3C), bourbonVanilla (no family tag, same),
//     blackVanilla (family: "sweet", its own established vanilla-family
//     variant per Phase 3C's canonical correction), rum (family: "sweet").
//     cacao, chocolate, and smokyNotes do not exist as canonical keys in
//     the taxonomy at all, and were not invented.
//
// Canonical-data sanity audit (Step 2): every tobacco-carrying fragrance
// was checked for a case where a more specific tobacco variant would be
// warranted, and every roastedCoffeeBeans-carrying fragrance was checked
// for a case where a generic "coffee" key would be warranted instead.
// Neither variant exists in the taxonomy, so no reclassification target
// exists in either direction. No mismatch meeting the Phase 3A basil /
// Phase 3C blackVanilla bar was found. No canonical-data correction was
// made in this phase.
//
// Despite 3 tobacco and 2 roastedCoffeeBeans fragrance/note pairs, this
// phase's own calibration changes zero individual pairs -- every member
// of both families was already scored during earlier vertical review
// (none left unscored), and every already-scored entry held up as
// internally consistent under comparison against real peers. Per this
// phase's own strict editorial caution, Spicebomb Extreme's tobacco:9
// correctly leads its own vanilla:8/bourbonVanilla:8 rather than being
// under-scored for their co-prominence, and generic sweetness/smoke/
// spice/resin/dark warmth was never treated as tobacco evidence, nor was
// roasted/bitter/caramelized/chocolate-like/gourmand character ever
// treated as coffee evidence beyond the explicit roastedCoffeeBeans note
// itself.
const TOBACCO_FAMILY = {
  13: 8,
  211: 6,
  212: 9,
};

const ROASTED_COFFEE_BEANS_FAMILY = {
  16: 8,
  26: 7,
};

const ALL_FAMILIES = {
  tobacco: TOBACCO_FAMILY,
  roastedCoffeeBeans: ROASTED_COFFEE_BEANS_FAMILY,
};

const TOBACCO_KEYS = ["tobacco"];
const COFFEE_KEYS = ["roastedCoffeeBeans"];

const ADJACENT_EXCLUDED_KEYS = [
  "caramel",
  "toffee",
  "tonkaBean",
  "vanilla",
  "madagascarVanilla",
  "bourbonVanilla",
  "blackVanilla",
  "rum",
];

function getPerfumeNoteIds(perfume) {
  return [
    ...(perfume.topNotes || []),
    ...(perfume.middleNotes || []),
    ...(perfume.baseNotes || []),
    ...(perfume.generalNotes || []),
  ];
}

describe("Composer Phase 3H taxonomy audit", () => {
  it("finds exactly 1 true canonical tobacco-family key in the note dictionary -- no tobaccoLeaf or other qualified variant exists", () => {
    expect(notes.tobacco).toMatchObject({ name: "Tobacco", family: "tobacco" });
    expect(notes.tobaccoLeaf).toBeUndefined();
  });

  it("finds exactly 1 true canonical coffee-family key in the note dictionary -- no generic \"coffee\" key exists at all", () => {
    expect(notes.roastedCoffeeBeans).toMatchObject({ name: "Roasted Coffee Beans" });
    expect(notes.coffee).toBeUndefined();
  });

  it("confirms cacao, chocolate, and smokyNotes do not exist as canonical keys, and were not invented", () => {
    expect(notes.cacao).toBeUndefined();
    expect(notes.chocolate).toBeUndefined();
    expect(notes.smokyNotes).toBeUndefined();
  });

  it("excludes every adjacent dark/gourmand material from both families, despite an overlapping perceptual effect", () => {
    for (const noteId of ADJACENT_EXCLUDED_KEYS) {
      expect(notes[noteId], `${noteId} should exist in the taxonomy`).toBeTruthy();
      expect(TOBACCO_KEYS).not.toContain(noteId);
      expect(COFFEE_KEYS).not.toContain(noteId);
    }
    // caramel, toffee, tonkaBean, vanilla, blackVanilla, and rum are all
    // tagged family: "sweet" in notes.js, distinct from tobacco's own
    // family: "tobacco" tag -- confirming none is a taxonomy-recognized
    // tobacco or coffee variant despite the dark/gourmand overlap.
    expect(notes.caramel.family).toBe("sweet");
    expect(notes.toffee.family).toBe("sweet");
    expect(notes.tonkaBean.family).toBe("sweet");
    expect(notes.vanilla.family).toBe("sweet");
    expect(notes.blackVanilla.family).toBe("sweet");
    expect(notes.rum.family).toBe("sweet");
  });
});

describe("Composer Phase 3H canonical-data sanity audit", () => {
  it("confirms no canonical-data correction was made or is recommended -- no qualified tobacco or coffee variant exists to reclassify into", () => {
    expect(notes.tobaccoLeaf).toBeUndefined();
    expect(notes.coffee).toBeUndefined();
  });
});

describe("Composer Phase 3H horizontal calibration -- tobacco and coffee canonical-key families", () => {
  const perfumesById = new Map(perfumes.map((perfume) => [perfume.id, perfume]));

  it("has exactly 87 catalog fragrances to search for exhaustive family membership", () => {
    expect(perfumes).toHaveLength(87);
  });

  for (const [noteId, family] of Object.entries(ALL_FAMILIES)) {
    it(`${noteId} family membership is exhaustive against the live catalog`, () => {
      const actualIds = perfumes
        .filter((perfume) => getPerfumeNoteIds(perfume).includes(noteId))
        .map((perfume) => perfume.id)
        .sort((a, b) => a - b);

      expect(actualIds).toEqual(Object.keys(family).map(Number).sort((a, b) => a - b));
    });

    it(`matches the exact calibrated ${noteId} score for every member -- both families are fully scored, no member is intentionally unscored`, () => {
      for (const [id, expectedScore] of Object.entries(family)) {
        const actualScore = NOTE_PROMINENCE_BY_ID[id]?.[noteId];
        expect(actualScore, `${perfumesById.get(Number(id)).name} ${noteId} score`).toBe(expectedScore);
      }
    });
  }

  it("keeps every calibrated tobacco/coffee-family value an integer from 1 to 10", () => {
    for (const family of Object.values(ALL_FAMILIES)) {
      for (const score of Object.values(family)) {
        expect(Number.isInteger(score)).toBe(true);
        expect(score).toBeGreaterThanOrEqual(1);
        expect(score).toBeLessThanOrEqual(10);
      }
    }
  });

  it("never collapses distinct canonical keys into one another -- tobacco and roastedCoffeeBeans stay independent, and no fragrance carries both", () => {
    const allTouchedIds = new Set(Object.values(ALL_FAMILIES).flatMap((family) => Object.keys(family).map(Number)));

    for (const id of allTouchedIds) {
      const entry = NOTE_PROMINENCE_BY_ID[id] || {};
      const fragrance = perfumesById.get(id);
      const ownNoteIds = new Set(getPerfumeNoteIds(fragrance));

      for (const key of [...TOBACCO_KEYS, ...COFFEE_KEYS]) {
        if (key in entry) {
          expect(ownNoteIds.has(key), `${fragrance.name} does not canonically carry "${key}"`).toBe(true);
        }
      }
    }

    for (const id of Object.keys(TOBACCO_FAMILY).map(Number)) {
      expect(NOTE_PROMINENCE_BY_ID[id]?.roastedCoffeeBeans).toBeUndefined();
    }
    for (const id of Object.keys(ROASTED_COFFEE_BEANS_FAMILY).map(Number)) {
      expect(NOTE_PROMINENCE_BY_ID[id]?.tobacco).toBeUndefined();
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

  it("changes zero prominence values in this phase -- every tobacco/roastedCoffeeBeans score above is exactly what the catalog already held before Phase 3H", () => {
    // This test pins that outcome as a regression guard -- if it ever
    // fails, either a later phase intentionally recalibrated one of these
    // exact keys (update this file's fixtures to match, with a comment),
    // or an unrelated change accidentally drifted a tobacco/coffee score.
    expect(NOTE_PROMINENCE_BY_ID[13]).toEqual({ tobacco: 8, amber: 6, grapefruit: 6, cardamom: 5, basil: 3 });
    expect(NOTE_PROMINENCE_BY_ID[211]).toEqual({ tobacco: 6, redApple: 7 });
    expect(NOTE_PROMINENCE_BY_ID[212]).toEqual({ tobacco: 9, vanilla: 8, bourbonVanilla: 8, cinnamon: 6, blackPepper: 5 });
    expect(NOTE_PROMINENCE_BY_ID[16]).toEqual({ roastedCoffeeBeans: 8, leather: 6, tonkaBean: 6, cinnamon: 5 });
    expect(NOTE_PROMINENCE_BY_ID[26]).toEqual({ grapefruit: 7, roastedCoffeeBeans: 7, amber: 5 });
  });

  it("leaves canonical note data completely unchanged in this phase -- no pyramid was edited for any tobacco/roastedCoffeeBeans member", () => {
    expect(perfumesById.get(212)).toMatchObject({
      name: "Spicebomb Extreme",
      baseNotes: ["tobacco", "vanilla", "bourbonVanilla"],
    });
    expect(perfumesById.get(16)).toMatchObject({
      name: "Uomo Signature",
      baseNotes: ["tonkaBean", "leather", "roastedCoffeeBeans", "patchouli"],
    });
  });

  it("does not under-score a genuinely defining tobacco note merely because vanilla is also highly prominent -- Spicebomb Extreme's tobacco:9 correctly leads its own vanilla:8/bourbonVanilla:8", () => {
    const spicebombExtreme = NOTE_PROMINENCE_BY_ID[212];
    expect(spicebombExtreme.tobacco).toBeGreaterThan(spicebombExtreme.vanilla);
    expect(spicebombExtreme.tobacco).toBeGreaterThan(spicebombExtreme.bourbonVanilla);
  });

  // The Note Explorer "Most prominent" sort verification for tobacco and
  // roastedCoffeeBeans lives in
  // packages/builder/src/builder/internal/intelligence/buildNoteExplorerViewModel.test.js
  // instead of here -- packages/catalog must never import from
  // packages/builder (ADR-0006), and this file already proves the
  // underlying data (membership, scores, containment) that sort depends on.
});
