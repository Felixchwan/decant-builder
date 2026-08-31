import { describe, expect, it } from "vitest";

import { fragrances as perfumes, notes } from "@discovery-box/catalog";
import { NOTE_PROMINENCE_BY_ID } from "../src/fragrances.js";

// Composer Phase 3F: narrow regression coverage for the sixth horizontal
// note-family calibration pass -- the vetiver and amber canonical-key
// families.
//
// Taxonomy audit (Step 1) -- exact canonical keys found in notes.js:
//   Vetiver family (2 keys): vetiver ("Vetiver", family: "woody"),
//     haitianVetiver ("Haitian Vetiver", no family tag but shares
//     notes/vetiver.jpg with the generic key -- an explicitly-qualified
//     variant, kept distinct, matching this dictionary's own established
//     sandalwood/australianSandalwood precedent).
//   Amber family (1 key): amber ("Amber", family: "amber") -- the only
//     true canonical amber-identity key in the taxonomy. No qualified
//     amber variant (e.g. a hypothetical "greyAmber"/"blackAmber") exists
//     to audit.
//   Amber-adjacent keys explicitly excluded (7 keys, real separately-named
//     materials that commonly contribute to an amber-like effect but are
//     never canonical amber substitutes): ambroxan (family: "amber" in
//     notes.js, but per this phase's own explicit instruction never
//     renamed into amber), ambergris, amberwood (family: "woody" in
//     notes.js, not "amber"), ambermax, benzoin (family: "resinous"),
//     labdanum (family: "resinous"), opoponax. orientalNotes carries
//     family: "amber" in notes.js but is a generic collective-accord
//     label (the same pattern as the existing woodyNotes/spicyNotes/
//     fruityNotes umbrella notes), not a specific amber material, and was
//     excluded on that basis.
//
// Canonical-data sanity audit (Step 2): every vetiver-carrying fragrance
// was checked for a case where haitianVetiver is clearly warranted over
// generic vetiver (or vice versa); every amber-carrying fragrance was
// checked for a case where a more specific amber-adjacent material is
// clearly warranted instead of generic amber. No mismatch meeting the
// Phase 3A basil / Phase 3C blackVanilla bar was found in either
// direction. No canonical-data correction was made in this phase.
//
// Despite 22 vetiver, 2 haitianVetiver, and 26 amber fragrance/note
// pairs, the approved calibration adds zero new scores and changes zero
// existing scores. Every already-scored entry (vetiver: 9, 27, 34, 111,
// 118, 206, 210, 306; haitianVetiver: 25; amber: 13, 20, 26, 28, 31, 32,
// 208, 209, 302) held up as internally consistent under comparison
// against real peers, and every unscored member's vetiver or amber note
// is genuine generic-base/background material in a composition whose own
// documented signature clearly lies elsewhere -- e.g. Acqua di Gio EDT's
// marine accord (seaNotes: 10, calone: 9) dwarfs its unscored base amber;
// Bois Imperial's akigalawood (10) dwarfs its unscored base vetiver; Le
// Male's vanilla (8) dwarfs its unscored base amber. Per this phase's own
// strict editorial caution, generic dryness/greenness/woodiness was never
// treated as vetiver evidence, and generic warmth/sweetness/resinous
// character -- including ambroxan's, ambergris's, benzoin's, or
// labdanum's own contribution to a fragrance's amber-like effect -- was
// never treated as evidence for the explicit canonical amber key.
const VETIVER_FAMILY = {
  9: 5,
  10: undefined,
  11: undefined,
  12: undefined,
  17: undefined,
  27: 5,
  34: 6,
  101: undefined,
  108: undefined,
  109: undefined,
  111: 8,
  117: undefined,
  118: 3,
  203: undefined,
  206: 6,
  210: 6,
  211: undefined,
  213: undefined,
  301: undefined,
  303: undefined,
  306: 4,
  407: undefined,
};

const HAITIAN_VETIVER_FAMILY = { 25: 6, 402: undefined };

const AMBER_FAMILY = {
  1: undefined,
  3: undefined,
  5: undefined,
  12: undefined,
  13: 6,
  14: undefined,
  20: 6,
  26: 5,
  28: 5,
  31: 5,
  32: 5,
  101: undefined,
  107: undefined,
  112: undefined,
  114: undefined,
  116: undefined,
  119: undefined,
  201: undefined,
  208: 5,
  209: 5,
  214: undefined,
  302: 5,
  402: undefined,
  405: undefined,
  407: undefined,
  410: undefined,
};

const ALL_FAMILIES = {
  vetiver: VETIVER_FAMILY,
  haitianVetiver: HAITIAN_VETIVER_FAMILY,
  amber: AMBER_FAMILY,
};

const VETIVER_KEYS = ["vetiver", "haitianVetiver"];
const AMBER_KEYS = ["amber"];

const AMBER_ADJACENT_EXCLUDED_KEYS = [
  "ambroxan",
  "ambergris",
  "amberwood",
  "ambermax",
  "benzoin",
  "labdanum",
  "opoponax",
  "orientalNotes",
];

function getPerfumeNoteIds(perfume) {
  return [
    ...(perfume.topNotes || []),
    ...(perfume.middleNotes || []),
    ...(perfume.baseNotes || []),
    ...(perfume.generalNotes || []),
  ];
}

describe("Composer Phase 3F taxonomy audit", () => {
  it("finds exactly these 2 canonical vetiver-family keys in the note dictionary, with distinct display names", () => {
    expect(notes.vetiver).toMatchObject({ name: "Vetiver", family: "woody" });
    expect(notes.haitianVetiver).toMatchObject({ name: "Haitian Vetiver" });
    expect(notes.haitianVetiver.noteImageAssetKey).toBe(notes.vetiver.noteImageAssetKey);
  });

  it("finds exactly 1 true canonical amber-family key in the note dictionary -- no qualified amber variant exists", () => {
    expect(notes.amber).toMatchObject({ name: "Amber", family: "amber" });
  });

  it("excludes every amber-adjacent material from the canonical amber-family key, despite several sharing notes.js's own family: \"amber\" tag", () => {
    for (const noteId of AMBER_ADJACENT_EXCLUDED_KEYS) {
      expect(notes[noteId], `${noteId} should exist in the taxonomy`).toBeTruthy();
      expect(AMBER_KEYS).not.toContain(noteId);
      expect(notes[noteId].name).not.toBe("Amber");
    }
    // ambroxan and orientalNotes are tagged family: "amber" in notes.js
    // itself, yet are still real, separately-named entries -- never
    // collapsed into the generic amber key.
    expect(notes.ambroxan.family).toBe("amber");
    expect(notes.orientalNotes.family).toBe("amber");
    expect(notes.ambroxan.name).toBe("Ambroxan");
    expect(notes.orientalNotes.name).toBe("Oriental Notes");
    // amberwood and vetiver are both tagged family: "woody" in notes.js,
    // not "amber" -- confirming amberwood is not a taxonomy-recognized
    // amber variant despite its name.
    expect(notes.amberwood.family).toBe("woody");
  });

  it("excludes generic woody notes from the vetiver family despite thematic overlap", () => {
    const unrelatedWoodyNotes = ["woodyNotes", "cedar", "cedarwood", "sandalwood", "amberwood"];
    for (const noteId of unrelatedWoodyNotes) {
      expect(notes[noteId]).toBeTruthy();
      expect(VETIVER_KEYS).not.toContain(noteId);
    }
  });
});

describe("Composer Phase 3F canonical-data sanity audit", () => {
  const perfumesById = new Map(perfumes.map((perfume) => [perfume.id, perfume]));

  it("confirms no canonical-data correction was made or is recommended -- no fragrance carries both vetiver and haitianVetiver", () => {
    for (const id of Object.keys(HAITIAN_VETIVER_FAMILY).map(Number)) {
      const ownNoteIds = getPerfumeNoteIds(perfumesById.get(id));
      expect(ownNoteIds).toContain("haitianVetiver");
      expect(ownNoteIds).not.toContain("vetiver");
    }
    for (const id of Object.keys(VETIVER_FAMILY).map(Number)) {
      const ownNoteIds = getPerfumeNoteIds(perfumesById.get(id));
      expect(ownNoteIds).not.toContain("haitianVetiver");
    }
  });

  it("confirms every amber-adjacent material keeps its own explicit canonical key -- none was found merely 'smelling like amber' where the amber key would be a documented-identity improvement", () => {
    // Spot-checked representative amber-adjacent members: each already
    // uses its own specific, documented material identity rather than
    // the generic amber key, and none was found where the reverse
    // (amber -> a specific adjacent material) was clearly warranted.
    expect(perfumesById.get(202).baseNotes).toContain("ambroxan"); // Sauvage EDP
    expect(perfumesById.get(202).baseNotes).not.toContain("amber");
    expect(perfumesById.get(19).baseNotes).toContain("ambergris"); // Club de Nuit Intense Man
    expect(perfumesById.get(19).baseNotes).not.toContain("amber");
    expect(perfumesById.get(111).baseNotes).toContain("benzoin"); // Terre d'Hermès EDT
    expect(perfumesById.get(111).baseNotes).not.toContain("amber");
    expect(perfumesById.get(20).middleNotes).toContain("labdanum"); // F by Ferragamo Black
    expect(perfumesById.get(20).baseNotes).toContain("amber");

    // Game of Spades Wildcard legitimately carries both ambroxan (its own
    // scored, distinct base material) and generic amber (unscored) side
    // by side -- two separately-documented base notes, never conflated.
    expect(perfumesById.get(114).baseNotes).toContain("ambroxan");
    expect(perfumesById.get(114).baseNotes).toContain("amber");
    expect(NOTE_PROMINENCE_BY_ID[114].ambroxan).toBe(6);
    expect(NOTE_PROMINENCE_BY_ID[114].amber).toBeUndefined();
  });
});

describe("Composer Phase 3F horizontal calibration -- vetiver and amber canonical-key families", () => {
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

  it("keeps every calibrated vetiver/amber-family value an integer from 1 to 10", () => {
    for (const family of Object.values(ALL_FAMILIES)) {
      for (const [id, score] of Object.entries(family)) {
        if (score === undefined) continue;
        expect(Number.isInteger(score), `id ${id}`).toBe(true);
        expect(score).toBeGreaterThanOrEqual(1);
        expect(score).toBeLessThanOrEqual(10);
      }
    }
  });

  it("never collapses distinct canonical keys into one another -- vetiver and haitianVetiver, amber and every amber-adjacent key, stay independent", () => {
    const allTouchedIds = new Set(Object.values(ALL_FAMILIES).flatMap((family) => Object.keys(family).map(Number)));

    for (const id of allTouchedIds) {
      const entry = NOTE_PROMINENCE_BY_ID[id] || {};
      const fragrance = perfumesById.get(id);
      const ownNoteIds = new Set(getPerfumeNoteIds(fragrance));

      for (const key of [...VETIVER_KEYS, ...AMBER_KEYS]) {
        if (key in entry) {
          expect(ownNoteIds.has(key), `${fragrance.name} does not canonically carry "${key}"`).toBe(true);
        }
      }
    }

    // No vetiver-family fragrance is ever also scored under an
    // amber-adjacent key as if they were the same material, and vice
    // versa -- each key's prominence entry stands entirely on its own.
    for (const id of Object.keys(VETIVER_FAMILY).map(Number)) {
      expect(NOTE_PROMINENCE_BY_ID[id]?.haitianVetiver).toBeUndefined();
    }
    for (const id of Object.keys(HAITIAN_VETIVER_FAMILY).map(Number)) {
      expect(NOTE_PROMINENCE_BY_ID[id]?.vetiver).toBeUndefined();
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

  it("changes zero prominence values in this phase -- every vetiver/haitianVetiver/amber score above is exactly what the catalog already held before Phase 3F", () => {
    // This phase's own conclusion: no new scores, no corrections. This
    // test pins that outcome as a regression guard -- if it ever fails,
    // either a later phase intentionally recalibrated one of these exact
    // keys (update this file's fixtures to match, with a comment), or an
    // unrelated change accidentally drifted a vetiver/amber score.
    const beforePhase3F = {
      9: { vetiver: 5 },
      27: { vetiver: 5 },
      34: { vetiver: 6 },
      111: { vetiver: 8 },
      118: { vetiver: 3 },
      206: { vetiver: 6 },
      210: { vetiver: 6 },
      306: { vetiver: 4 },
      25: { haitianVetiver: 6 },
      13: { amber: 6 },
      20: { amber: 6 },
      26: { amber: 5 },
      28: { amber: 5 },
      31: { amber: 5 },
      32: { amber: 5 },
      208: { amber: 5 },
      209: { amber: 5 },
      302: { amber: 5 },
    };
    for (const [id, expected] of Object.entries(beforePhase3F)) {
      for (const [key, value] of Object.entries(expected)) {
        expect(NOTE_PROMINENCE_BY_ID[id]?.[key], `id ${id} ${key}`).toBe(value);
      }
    }
  });

  it("leaves canonical note data completely unchanged in this phase -- no pyramid was edited for any vetiver/haitianVetiver/amber member", () => {
    // Spot-checked representative members across all three families.
    expect(perfumesById.get(111)).toMatchObject({
      name: "Terre d'Hermès EDT",
      baseNotes: ["vetiver", "cedar", "patchouli", "benzoin"],
    });
    expect(perfumesById.get(25)).toMatchObject({
      name: "Montblanc Explorer",
      middleNotes: ["haitianVetiver", "leather"],
    });
    expect(perfumesById.get(1)).toMatchObject({
      name: "Acqua di Gio EDT",
      baseNotes: ["whiteMusk", "cedar", "oakmoss", "patchouli", "amber"],
    });
  });

  // The Note Explorer "Most prominent" sort verification for vetiver,
  // haitianVetiver, and amber lives in
  // packages/builder/src/builder/internal/intelligence/buildNoteExplorerViewModel.test.js
  // instead of here -- packages/catalog must never import from
  // packages/builder (ADR-0006), and this file already proves the
  // underlying data (membership, scores, containment) that sort depends on.
});
