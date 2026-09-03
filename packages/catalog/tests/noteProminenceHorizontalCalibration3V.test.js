import { describe, expect, it } from "vitest";

import { fragrances as perfumes, notes } from "@discovery-box/catalog";
import { NOTE_PROMINENCE_BY_ID } from "../src/fragrances.js";

// Composer Phase 3V: narrow regression coverage for the twenty-second
// horizontal note-family calibration pass -- four resinous canonical
// keys grouped only for workflow efficiency, never as one umbrella
// "resin" ranking: benzoin, siamBenzoin, incense, and elemi.
//
// Taxonomy audit (Step 1) -- exact canonical keys found in notes.js:
//   benzoin ("Benzoin", family: "resinous") -- no other qualified
//     variant exists besides siamBenzoin.
//   siamBenzoin ("Siam Benzoin", no family tag, own bespoke image --
//     never reuses benzoin.jpg) -- a genuine, independently-audited
//     generic/origin-qualified pair with benzoin; unlike moss/oakmoss,
//     siamBenzoin does not reuse benzoin's image, and no fragrance
//     carries both keys, confirming they are treated as two
//     independently distinct materials.
//   incense ("Incense", family: "resinous") -- an independent standalone
//     material, never a benzoin variant.
//   elemi ("Elemi", family: "resinous") -- an independent standalone
//     material, never a benzoin variant.
//   olibanum, labdanum, opoponax, peruBalsam, and every amber-family key
//     (amber, ambergris, ambroxan, amberwood, ambermax) were all
//     re-confirmed as their own distinct, already-established canonical
//     identities.
//
// Canonical-data sanity audit (Step 2): every benzoin- and siamBenzoin-
// carrying fragrance was checked for a case where the other exact key
// would be clearly warranted instead. No mismatch meeting the Phase 3A
// basil / Phase 3C blackVanilla bar was found in either direction. No
// fragrance carries both benzoin and siamBenzoin. Squid legitimately
// carries benzoin and incense alongside its own already-established
// opoponax and ambergris (Phase 3U), all four independently scored,
// never conflated. Gentlemen Only carries both incense and elemi, and
// Divine Vanille carries both siamBenzoin and incense -- each pair
// independently scored. No canonical-data correction was made in this
// phase.
//
// Across 4 benzoin, 2 siamBenzoin, 4 incense, and 2 elemi fragrance/note
// pairs, this phase's own calibration changes zero individual pairs.
// Every already-scored entry held up as internally consistent, including
// Squid's incense: 7 (matching "incense" as one of its own listed
// accords -- a genuine, real contributing axis correctly trailing the
// fragrance's own defining ink: 9 concept, never conflated with generic
// smokiness).
const BENZOIN_FAMILY = {
  102: undefined,
  111: undefined,
  205: 6,
  500: undefined,
};

const SIAM_BENZOIN_FAMILY = {
  304: undefined,
  410: undefined,
};

const INCENSE_FAMILY = {
  17: 5,
  203: 6,
  304: 4,
  500: 7,
};

const ELEMI_FAMILY = {
  17: undefined,
  201: 5,
};

const ALL_FAMILIES = {
  benzoin: BENZOIN_FAMILY,
  siamBenzoin: SIAM_BENZOIN_FAMILY,
  incense: INCENSE_FAMILY,
  elemi: ELEMI_FAMILY,
};

const IN_SCOPE_KEYS = ["benzoin", "siamBenzoin", "incense", "elemi"];
const OUT_OF_SCOPE_ADJACENT_KEYS = ["olibanum", "labdanum", "opoponax", "peruBalsam", "amber", "ambergris", "ambroxan", "amberwood", "ambermax"];

function getPerfumeNoteIds(perfume) {
  return [
    ...(perfume.topNotes || []),
    ...(perfume.middleNotes || []),
    ...(perfume.baseNotes || []),
    ...(perfume.generalNotes || []),
  ];
}

describe("Composer Phase 3V taxonomy audit", () => {
  it("finds the exact canonical definitions for all 4 in-scope keys, each its own independent identity", () => {
    expect(notes.benzoin).toMatchObject({ name: "Benzoin", family: "resinous" });
    expect(notes.siamBenzoin).toMatchObject({ name: "Siam Benzoin" });
    expect(notes.incense).toMatchObject({ name: "Incense", family: "resinous" });
    expect(notes.elemi).toMatchObject({ name: "Elemi", family: "resinous" });
  });

  it("confirms siamBenzoin carries its own bespoke image, never reusing benzoin's -- unlike moss/oakmoss, this pair is two independently distinct materials", () => {
    expect(notes.siamBenzoin.noteImageAssetKey).not.toBe(notes.benzoin.noteImageAssetKey);
    expect(notes.siamBenzoin.noteImageAssetKey).toBe("notes/siamBenzoin.jpg");
  });

  it("confirms incense and elemi are independent standalone materials, never benzoin variants", () => {
    expect(notes.incense.name).not.toBe("Benzoin");
    expect(notes.elemi.name).not.toBe("Benzoin");
  });

  it("excludes every out-of-scope adjacent resinous/amber material from the four in-scope keys", () => {
    for (const noteId of OUT_OF_SCOPE_ADJACENT_KEYS) {
      expect(notes[noteId], `${noteId} should exist in the taxonomy`).toBeTruthy();
      expect(IN_SCOPE_KEYS).not.toContain(noteId);
    }
  });
});

describe("Composer Phase 3V canonical-data sanity audit", () => {
  const perfumesById = new Map(perfumes.map((perfume) => [perfume.id, perfume]));

  it("confirms no fragrance carries both benzoin and siamBenzoin simultaneously", () => {
    for (const id of Object.keys(BENZOIN_FAMILY).map(Number)) {
      expect(getPerfumeNoteIds(perfumesById.get(id))).not.toContain("siamBenzoin");
    }
    for (const id of Object.keys(SIAM_BENZOIN_FAMILY).map(Number)) {
      expect(getPerfumeNoteIds(perfumesById.get(id))).not.toContain("benzoin");
    }
  });

  it("confirms no canonical-data correction was made or is recommended -- Squid legitimately carries benzoin and incense alongside its own already-established opoponax and ambergris, all four independently scored", () => {
    const squid = perfumesById.get(500);
    expect(squid.baseNotes).toContain("benzoin");
    expect(squid.topNotes).toContain("incense");
    expect(squid.middleNotes).toContain("opoponax");
    expect(squid.baseNotes).toContain("ambergris");
    expect(NOTE_PROMINENCE_BY_ID[500].incense).toBe(7);
    expect(NOTE_PROMINENCE_BY_ID[500].ambergris).toBe(6);
    expect(NOTE_PROMINENCE_BY_ID[500].benzoin).toBeUndefined();
    expect(NOTE_PROMINENCE_BY_ID[500].opoponax).toBeUndefined();
  });

  it("confirms Gentlemen Only legitimately carries both incense and elemi, and Divine Vanille legitimately carries both siamBenzoin and incense, each pair independently scored", () => {
    const gentlemenOnly = perfumesById.get(17);
    expect(gentlemenOnly.baseNotes).toContain("incense");
    expect(gentlemenOnly.middleNotes).toContain("elemi");
    expect(NOTE_PROMINENCE_BY_ID[17].incense).toBe(5);
    expect(NOTE_PROMINENCE_BY_ID[17].elemi).toBeUndefined();

    const divineVanille = perfumesById.get(304);
    expect(divineVanille.baseNotes).toContain("siamBenzoin");
    expect(divineVanille.middleNotes).toContain("incense");
    expect(NOTE_PROMINENCE_BY_ID[304].incense).toBe(4);
    expect(NOTE_PROMINENCE_BY_ID[304].siamBenzoin).toBeUndefined();
  });
});

describe("Composer Phase 3V horizontal calibration -- benzoin, siamBenzoin, incense, and elemi", () => {
  const perfumesById = new Map(perfumes.map((perfume) => [perfume.id, perfume]));

  it("has exactly 88 catalog fragrances to search for exhaustive family membership", () => {
    expect(perfumes).toHaveLength(88);
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

  it("keeps every calibrated value across the four in-scope keys an integer from 1 to 10", () => {
    for (const family of Object.values(ALL_FAMILIES)) {
      for (const [id, score] of Object.entries(family)) {
        if (score === undefined) continue;
        expect(Number.isInteger(score), `id ${id}`).toBe(true);
        expect(score).toBeGreaterThanOrEqual(1);
        expect(score).toBeLessThanOrEqual(10);
      }
    }
  });

  it("never collapses the four in-scope keys into one another, or into olibanum/labdanum/opoponax/peruBalsam/amber-family keys", () => {
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

  it("changes zero prominence values in this phase -- every in-scope score above is exactly what the catalog already held before Phase 3V", () => {
    // This test pins that outcome as a regression guard -- if it ever
    // fails, either a later phase intentionally recalibrated one of
    // these exact keys (update this file's fixtures to match, with a
    // comment), or an unrelated change accidentally drifted a score.
    expect(NOTE_PROMINENCE_BY_ID[205]).toEqual({ iris: 8, patchouli: 6, benzoin: 6, cloves: 5, blackVanilla: 6 });
    expect(NOTE_PROMINENCE_BY_ID[17]).toEqual({ birchLeaf: 7, incense: 5, pinkPepper: 4, cedar: 4 });
    expect(NOTE_PROMINENCE_BY_ID[203]).toEqual({ incense: 6, sage: 6, cloves: 4, blackCurrant: 8 });
    expect(NOTE_PROMINENCE_BY_ID[304]).toEqual({ madagascarVanilla: 10, cinnamon: 7, tonkaBean: 6, incense: 4 });
    expect(NOTE_PROMINENCE_BY_ID[500]).toEqual({ ink: 9, incense: 7, seaSalt: 6, ambergris: 6 });
    expect(NOTE_PROMINENCE_BY_ID[201]).toEqual({ aldehydes: 6, elemi: 5 });
  });

  it("leaves canonical note data completely unchanged in this phase -- no pyramid was edited for any in-scope member", () => {
    expect(perfumesById.get(500)).toMatchObject({
      name: "Squid",
      topNotes: ["incense", "amylSalicylate", "pinkPepper"],
      baseNotes: ["ambergris", "benzoin", "musk"],
    });
    expect(perfumesById.get(304)).toMatchObject({
      name: "Divine Vanille",
      baseNotes: expect.arrayContaining(["siamBenzoin"]),
    });
  });

  it("does not under-score a genuinely documented incense axis merely because a bigger signature note also dominates -- Squid's incense:7 stays real and non-trivial beside its own established ink:9", () => {
    const squid = NOTE_PROMINENCE_BY_ID[500];
    expect(squid.incense).toBeGreaterThanOrEqual(5);
    expect(squid.incense).toBeLessThan(squid.ink);
  });

  // The Note Explorer "Most prominent" sort verification for benzoin,
  // siamBenzoin, incense, and elemi lives in
  // packages/builder/src/builder/internal/intelligence/buildNoteExplorerViewModel.test.js
  // instead of here -- packages/catalog must never import from
  // packages/builder (ADR-0006), and this file already proves the
  // underlying data (membership, scores, containment) that sort depends on.
});
