import { describe, expect, it } from "vitest";

import { fragrances as perfumes, notes } from "@discovery-box/catalog";
import { NOTE_PROMINENCE_BY_ID } from "../src/fragrances.js";

// Composer Phase 3D: narrow regression coverage for the fourth horizontal
// note-family calibration pass -- the citrus/orange and musk canonical-key
// families, the broadest audit yet by key count.
//
// Taxonomy audit (Step 1) -- exact canonical keys found in notes.js:
//   Citrus/orange family (18 keys): lime, lemon, bergamot, orange,
//     mandarinOrange, bitterOrange, sicilianMandarin, grapefruit, citron,
//     greenMandarin, bloodOrange, tangerine, fingerLime, mandarin,
//     citrus, chinotto, citruses, italianMandarin
//   Musk family (2 keys): musk, whiteMusk
// petitgrain, lemonVerbena, neroli, and orangeBlossom were investigated
// and excluded: the catalog's own notes.js tags each with a different
// family ("green" or "floral"), not "citrus" -- semantic family here is
// a discovery grouping the taxonomy itself defines, not a judgment call
// this phase makes. mandarinOil and lemonOil exist in notes.js but carry
// zero catalog membership (no fragrance uses them) -- audited and
// confirmed empty, not calibrated. ambergris and ambroxan were confirmed
// as distinct canonical keys from musk, never conflated.
//
// Canonical-data sanity audit (Step 2): every fragrance was checked for a
// case where a more specific citrus/musk variant exists and the
// documented note identity clearly supports it over the generic key
// actually used. No mismatch meeting the Phase 3A basil / Phase 3C
// blackVanilla bar was found -- every fragrance already uses the most
// specific variant its own note data supports (e.g. Arancia di Capri's
// sicilianMandarin, Cedrat Boise's citron, Legend Red's bloodOrange are
// all already correctly specific; no fragrance was found generalized
// under "orange"/"mandarin"/"musk" where a specific listed ingredient
// clearly warranted the more specific key). No canonical-data correction
// was made in this phase.
//
// Despite roughly 120 fragrance/citrus-note pairs and 27 fragrance/musk-
// note pairs, the approved calibration touches only 3 individual
// fragrance/note pairs. bergamot (40 members, only 6 ever scored) and
// musk (23 members, only 4 ever scored) are the two most common notes in
// the whole catalog specifically because they function as generic top/
// base filler in most compositions -- per this phase's editorial
// caution, common presence was never treated as evidence of genuine,
// differentiated prominence, and "citrus-forward"/"clean"/"powdery" were
// never treated as a stand-in for an exact canonical key's own score.
// Every already-scored entry across all 20 keys was reviewed and held up
// as internally consistent; the only 3 approved additions are:
//   24  Legend Red             -- grapefruit: unscored -> 5 (1 of 3 top
//                                notes alongside the already-scored
//                                bloodOrange:6, "citrus" accord #1,
//                                scored independently as its own variant
//                                rather than folded into bloodOrange's
//                                score)
//   103 Mandarino di Sicilia   -- bloodOrange: unscored -> 4 (2nd of 4 top
//                                notes, clearly secondary to the already-
//                                dominant greenMandarin:7 signature)
//   401 Silver Mountain Water  -- mandarin: unscored -> 4 (co-equal
//                                billing with the already-scored
//                                bergamot:5 as 1 of only 2 top notes,
//                                "citrus" accord #1, but still secondary
//                                to the defining greenTea:9/blackCurrant:8)
const LIME_FAMILY = { 1: undefined };

const LEMON_FAMILY = {
  1: undefined,
  2: 7,
  3: undefined,
  6: undefined,
  9: undefined,
  15: undefined,
  19: undefined,
  26: undefined,
  29: undefined,
  31: undefined,
  100: undefined,
  102: undefined,
  103: undefined,
  110: undefined,
  114: undefined,
  116: undefined,
  117: undefined,
  119: 5,
  201: undefined,
  301: 5,
  405: undefined,
  408: undefined,
};

const BERGAMOT_FAMILY = {
  1: 7,
  3: 6,
  4: undefined,
  5: undefined,
  7: undefined,
  12: undefined,
  17: undefined,
  19: undefined,
  23: undefined,
  25: undefined,
  30: 5,
  31: undefined,
  34: undefined,
  35: undefined,
  100: undefined,
  101: 7,
  102: undefined,
  103: undefined,
  107: undefined,
  114: undefined,
  115: undefined,
  117: undefined,
  118: undefined,
  119: undefined,
  201: undefined,
  202: 7,
  205: undefined,
  207: undefined,
  209: undefined,
  211: undefined,
  213: undefined,
  301: undefined,
  306: undefined,
  401: 5,
  404: undefined,
  405: undefined,
  406: undefined,
  410: undefined,
  501: undefined,
};

const ORANGE_FAMILY = {
  1: undefined,
  9: undefined,
  28: 6,
  31: undefined,
  100: undefined,
  101: undefined,
  105: undefined,
  110: 8,
  111: 8,
};

const MANDARIN_ORANGE_FAMILY = {
  1: undefined,
  6: undefined,
  7: undefined,
  11: 4,
  14: undefined,
  21: undefined,
  27: undefined,
  29: undefined,
  101: undefined,
};

const BITTER_ORANGE_FAMILY = {
  6: undefined,
  10: 5,
  110: 5,
  305: 7,
};

const SICILIAN_MANDARIN_FAMILY = { 100: 7 };

const GRAPEFRUIT_FAMILY = {
  12: undefined,
  13: 6,
  16: undefined,
  24: 5,
  26: 7,
  34: 7,
  101: undefined,
  102: undefined,
  111: 7,
  207: undefined,
  215: undefined,
  302: 7,
  402: undefined,
  405: 5,
  406: undefined,
};

const CITRON_FAMILY = {
  102: 5,
  115: 8,
};

const GREEN_MANDARIN_FAMILY = {
  17: undefined,
  103: 7,
  104: 5,
  215: undefined,
  306: undefined,
};

const BLOOD_ORANGE_FAMILY = {
  24: 6,
  103: 4,
  109: undefined,
};

const TANGERINE_FAMILY = { 15: undefined };

const FINGER_LIME_FAMILY = { 18: 6 };

const MANDARIN_FAMILY = {
  110: undefined,
  206: undefined,
  302: undefined,
  401: 4,
  404: undefined,
};

const CITRUS_GENERIC_FAMILY = { 302: undefined };

const CHINOTTO_FAMILY = { 29: 6 };

const CITRUSES_GENERIC_FAMILY = { 10: undefined };

const ITALIAN_MANDARIN_FAMILY = { 16: undefined };

const MUSK_FAMILY = {
  3: 6,
  9: 8,
  14: undefined,
  17: undefined,
  19: undefined,
  28: undefined,
  31: undefined,
  32: undefined,
  100: undefined,
  101: undefined,
  103: undefined,
  105: undefined,
  106: undefined,
  107: undefined,
  114: undefined,
  207: undefined,
  209: undefined,
  304: undefined,
  401: 5,
  405: undefined,
  408: undefined,
  500: undefined,
};

const WHITE_MUSK_FAMILY = {
  1: 4,
  27: 6,
  115: undefined,
  302: 6,
};

const ALL_FAMILIES = {
  lime: LIME_FAMILY,
  lemon: LEMON_FAMILY,
  bergamot: BERGAMOT_FAMILY,
  orange: ORANGE_FAMILY,
  mandarinOrange: MANDARIN_ORANGE_FAMILY,
  bitterOrange: BITTER_ORANGE_FAMILY,
  sicilianMandarin: SICILIAN_MANDARIN_FAMILY,
  grapefruit: GRAPEFRUIT_FAMILY,
  citron: CITRON_FAMILY,
  greenMandarin: GREEN_MANDARIN_FAMILY,
  bloodOrange: BLOOD_ORANGE_FAMILY,
  tangerine: TANGERINE_FAMILY,
  fingerLime: FINGER_LIME_FAMILY,
  mandarin: MANDARIN_FAMILY,
  citrus: CITRUS_GENERIC_FAMILY,
  chinotto: CHINOTTO_FAMILY,
  citruses: CITRUSES_GENERIC_FAMILY,
  italianMandarin: ITALIAN_MANDARIN_FAMILY,
  musk: MUSK_FAMILY,
  whiteMusk: WHITE_MUSK_FAMILY,
};

const CITRUS_KEYS = [
  "lime", "lemon", "bergamot", "orange", "mandarinOrange", "bitterOrange", "sicilianMandarin",
  "grapefruit", "citron", "greenMandarin", "bloodOrange", "tangerine", "fingerLime", "mandarin",
  "citrus", "chinotto", "citruses", "italianMandarin",
];
const MUSK_KEYS = ["musk", "whiteMusk"];

// The exact, unrelated prominence values on every touched fragrance,
// pinned so this phase is provably scoped to only the three approved
// additions above.
const UNRELATED_VALUES_BY_ID = {
  24: { cardamom: 5, tonkaBean: 4 },
  // greenMandarin is itself a citrus-family key (see GREEN_MANDARIN_FAMILY
  // above), so it is stripped by the delete loop below along with
  // bloodOrange -- only petitgrain and spearmint are truly unrelated here.
  103: { petitgrain: 5, spearmint: 5 },
  // musk is itself a musk-family key (see MUSK_FAMILY above), so it is
  // stripped too -- only greenTea and blackCurrant are truly unrelated.
  401: { greenTea: 9, blackCurrant: 8 },
};

function getPerfumeNoteIds(perfume) {
  return [
    ...(perfume.topNotes || []),
    ...(perfume.middleNotes || []),
    ...(perfume.baseNotes || []),
    ...(perfume.generalNotes || []),
  ];
}

describe("Composer Phase 3D taxonomy audit", () => {
  it("finds exactly these 18 canonical citrus/orange-family keys in the note dictionary", () => {
    for (const key of CITRUS_KEYS) {
      expect(notes[key], `notes.${key} should exist`).toBeTruthy();
    }
  });

  it("finds exactly these 2 canonical musk-family keys in the note dictionary, with distinct display names", () => {
    expect(notes.musk).toMatchObject({ name: "Musk" });
    expect(notes.whiteMusk).toMatchObject({ name: "White Musk" });
  });

  it("excludes petitgrain, lemonVerbena, neroli, and orangeBlossom from the citrus family -- notes.js tags each with a different family", () => {
    expect(notes.petitgrain.family).toBe("green");
    expect(notes.lemonVerbena.family).toBe("green");
    expect(notes.neroli.family).toBe("floral");
    expect(notes.orangeBlossom.family).toBe("floral");
    for (const key of ["petitgrain", "lemonVerbena", "neroli", "orangeBlossom"]) {
      expect(ALL_FAMILIES).not.toHaveProperty(key);
    }
  });

  it("excludes ambergris and ambroxan from the musk family -- distinct canonical keys, never conflated with musk/whiteMusk", () => {
    expect(notes.ambergris).toBeTruthy();
    expect(notes.ambroxan).toBeTruthy();
    expect(MUSK_KEYS).not.toContain("ambergris");
    expect(MUSK_KEYS).not.toContain("ambroxan");
  });

  it("confirms mandarinOil and lemonOil exist in the taxonomy but have zero catalog membership", () => {
    expect(notes.mandarinOil).toBeTruthy();
    expect(notes.lemonOil).toBeTruthy();
    for (const key of ["mandarinOil", "lemonOil"]) {
      const matches = perfumes.filter((perfume) => getPerfumeNoteIds(perfume).includes(key));
      expect(matches, `${key} should have zero catalog membership`).toHaveLength(0);
    }
  });
});

describe("Composer Phase 3D canonical-data sanity audit", () => {
  const perfumesById = new Map(perfumes.map((perfume) => [perfume.id, perfume]));

  it("confirms no canonical-data correction was made or is recommended -- every citrus/musk-variant assignment already uses its most specific available key", () => {
    // Arancia di Capri already uses the specific sicilianMandarin, not
    // generic mandarin/mandarinOrange.
    expect(perfumesById.get(100).topNotes).toContain("sicilianMandarin");

    // Cedrat Boise already uses the specific citron, not generic orange.
    expect(perfumesById.get(115).topNotes).toContain("citron");

    // Legend Red already uses the specific bloodOrange, not generic orange.
    expect(perfumesById.get(24).topNotes).toContain("bloodOrange");

    // Mandarino di Sicilia already uses the specific greenMandarin, not
    // generic mandarin/mandarinOrange.
    expect(perfumesById.get(103).topNotes).toContain("greenMandarin");
  });
});

describe("Composer Phase 3D horizontal calibration -- citrus/orange and musk canonical-key families", () => {
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

  it("keeps every calibrated citrus/musk-family value an integer from 1 to 10", () => {
    for (const family of Object.values(ALL_FAMILIES)) {
      for (const [id, score] of Object.entries(family)) {
        if (score === undefined) continue;
        expect(Number.isInteger(score), `id ${id}`).toBe(true);
        expect(score).toBeGreaterThanOrEqual(1);
        expect(score).toBeLessThanOrEqual(10);
      }
    }
  });

  it("never collapses distinct canonical keys into one another -- e.g. a fragrance scored for bloodOrange never silently also carries an orange score meant for the same facet", () => {
    const allTouchedIds = new Set(Object.values(ALL_FAMILIES).flatMap((family) => Object.keys(family).map(Number)));

    for (const id of allTouchedIds) {
      const entry = NOTE_PROMINENCE_BY_ID[id] || {};
      const fragrance = perfumesById.get(id);
      const ownNoteIds = new Set(getPerfumeNoteIds(fragrance));

      for (const key of [...CITRUS_KEYS, ...MUSK_KEYS]) {
        if (key in entry) {
          expect(ownNoteIds.has(key), `${fragrance.name} does not canonically carry "${key}"`).toBe(true);
        }
      }
    }

    // Legend Red carries both bloodOrange (its own established score) and
    // the newly-approved grapefruit score, independently -- not collapsed.
    expect(NOTE_PROMINENCE_BY_ID[24].bloodOrange).toBe(6);
    expect(NOTE_PROMINENCE_BY_ID[24].grapefruit).toBe(5);
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

  it("leaves every unrelated prominence value on each of the three touched fragrances exactly as it was -- this phase only adds three individual scores", () => {
    for (const [id, unrelatedValues] of Object.entries(UNRELATED_VALUES_BY_ID)) {
      const liveEntry = { ...NOTE_PROMINENCE_BY_ID[id] };
      for (const key of [...CITRUS_KEYS, ...MUSK_KEYS]) delete liveEntry[key];

      expect(liveEntry, `${perfumesById.get(Number(id)).name}`).toEqual(unrelatedValues);
    }
  });

  it("leaves the three touched fragrances' canonical note pyramids exactly as they were -- no canonical note data was changed in this phase", () => {
    expect(perfumesById.get(24)).toMatchObject({
      name: "Legend Red",
      topNotes: ["bloodOrange", "grapefruit", "cardamom"],
    });
    expect(perfumesById.get(103)).toMatchObject({
      name: "Mandarino di Sicilia",
      topNotes: ["greenMandarin", "bloodOrange", "bergamot", "lemon"],
    });
    expect(perfumesById.get(401)).toMatchObject({
      name: "Silver Mountain Water",
      topNotes: ["bergamot", "mandarin"],
    });
  });

  it("bergamot (39 members) and musk (22 members) stay overwhelmingly unscored -- common presence was never treated as evidence of genuine prominence", () => {
    const bergamotScoredCount = Object.values(BERGAMOT_FAMILY).filter((score) => score !== undefined).length;
    const muskScoredCount = Object.values(MUSK_FAMILY).filter((score) => score !== undefined).length;

    expect(Object.keys(BERGAMOT_FAMILY)).toHaveLength(39);
    expect(bergamotScoredCount).toBe(6);

    expect(Object.keys(MUSK_FAMILY)).toHaveLength(22);
    expect(muskScoredCount).toBe(3);
  });

  // The Note Explorer "Most prominent" sort verification for every
  // citrus/musk-family key with meaningful membership lives in
  // packages/builder/src/builder/internal/intelligence/buildNoteExplorerViewModel.test.js
  // instead of here -- packages/catalog must never import from
  // packages/builder (ADR-0006), and this file already proves the
  // underlying data (membership, scores, containment) that sort depends on.
});
