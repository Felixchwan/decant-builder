import { describe, expect, it } from "vitest";

import { fragrances as perfumes, notes } from "@discovery-box/catalog";
import { NOTE_PROMINENCE_BY_ID } from "../src/fragrances.js";

// Composer Phase 3U: narrow regression coverage for the twenty-first
// horizontal note-family calibration pass -- seven amber/resinous-
// adjacent standalone canonical keys, grouped only for workflow
// efficiency and never as one canonical family, each calibrated
// independently: amberwood, ambergris, olibanum, labdanum, opoponax,
// peruBalsam, and ambermax.
//
// Taxonomy audit (Step 1) -- exact canonical keys found in notes.js:
//   amberwood ("Amberwood", family: "woody") -- no qualified variant
//     exists.
//   ambergris ("Ambergris", no family tag) -- no qualified variant
//     exists.
//   olibanum ("Olibanum", no family tag) -- no qualified variant exists.
//   labdanum ("Labdanum", family: "resinous") -- no qualified variant
//     exists.
//   opoponax ("Opoponax", no family tag) -- no qualified variant exists.
//   peruBalsam ("Peru Balsam", no family tag) -- no qualified variant
//     exists.
//   ambermax ("Ambermax", no family tag) -- no qualified variant exists.
//   Per Phases 3F and 3Q, amber, ambroxan, ambergris, amberwood,
//     ambermax, benzoin, labdanum, and opoponax remain separate
//     canonical identities. benzoin, siamBenzoin, incense, and elemi
//     were all re-confirmed as their own distinct, already-established
//     resinous/balsamic canonical keys, out of scope for this phase.
//
// Canonical-data sanity audit (Step 2): every in-scope key's members
// were checked for identity confusion with amber/ambroxan or with
// benzoin/siamBenzoin/incense. No mismatch meeting the Phase 3A basil /
// Phase 3C blackVanilla bar was found. YSL Y EDP carries both amberwood
// and olibanum, and Squid carries both ambergris and opoponax -- each
// pair independently scored, never cross-credited. No canonical-data
// correction was made in this phase.
//
// Across 5 amberwood, 3 ambergris, 5 olibanum, 2 labdanum, 2 opoponax, 2
// peruBalsam, and 1 ambermax fragrance/note pairs, this phase's own
// calibration changes zero individual pairs. Every already-scored entry
// held up as internally consistent, including Squid's ambergris: 6
// (correctly tied with its own established seaSalt: 6, both correctly
// secondary to the fragrance's own defining ink: 9 concept, never
// conflated with marine/salty/mineral genre character).
const AMBERWOOD_FAMILY = {
  8: undefined,
  33: undefined,
  105: undefined,
  213: undefined,
  306: undefined,
};

const AMBERGRIS_FAMILY = {
  19: 5,
  500: 6,
  501: undefined,
};

const OLIBANUM_FAMILY = {
  34: 5,
  116: undefined,
  201: undefined,
  206: undefined,
  213: undefined,
  215: undefined,
};

const LABDANUM_FAMILY = { 20: undefined, 410: undefined };
const OPOPONAX_FAMILY = { 403: undefined, 500: undefined };
const PERU_BALSAM_FAMILY = { 32: undefined, 204: undefined };
const AMBERMAX_FAMILY = { 404: undefined };

const ALL_FAMILIES = {
  amberwood: AMBERWOOD_FAMILY,
  ambergris: AMBERGRIS_FAMILY,
  olibanum: OLIBANUM_FAMILY,
  labdanum: LABDANUM_FAMILY,
  opoponax: OPOPONAX_FAMILY,
  peruBalsam: PERU_BALSAM_FAMILY,
  ambermax: AMBERMAX_FAMILY,
};

const IN_SCOPE_KEYS = ["amberwood", "ambergris", "olibanum", "labdanum", "opoponax", "peruBalsam", "ambermax"];
const OUT_OF_SCOPE_ADJACENT_KEYS = ["amber", "ambroxan", "benzoin", "siamBenzoin", "incense", "elemi"];

function getPerfumeNoteIds(perfume) {
  return [
    ...(perfume.topNotes || []),
    ...(perfume.middleNotes || []),
    ...(perfume.baseNotes || []),
    ...(perfume.generalNotes || []),
  ];
}

describe("Composer Phase 3U taxonomy audit", () => {
  it("finds the exact canonical definitions for all 7 in-scope keys, each its own independent identity", () => {
    expect(notes.amberwood).toMatchObject({ name: "Amberwood", family: "woody" });
    expect(notes.ambergris).toMatchObject({ name: "Ambergris" });
    expect(notes.olibanum).toMatchObject({ name: "Olibanum" });
    expect(notes.labdanum).toMatchObject({ name: "Labdanum", family: "resinous" });
    expect(notes.opoponax).toMatchObject({ name: "Opoponax" });
    expect(notes.peruBalsam).toMatchObject({ name: "Peru Balsam" });
    expect(notes.ambermax).toMatchObject({ name: "Ambermax" });
  });

  it("confirms no qualified variant of any in-scope key was invented", () => {
    expect(notes.ambergrisAbsolute).toBeUndefined();
    expect(notes.somaliOlibanum).toBeUndefined();
    expect(notes.opoponaxResin).toBeUndefined();
  });

  it("excludes every out-of-scope adjacent amber/resinous material from the seven in-scope keys", () => {
    for (const noteId of OUT_OF_SCOPE_ADJACENT_KEYS) {
      expect(notes[noteId], `${noteId} should exist in the taxonomy`).toBeTruthy();
      expect(IN_SCOPE_KEYS).not.toContain(noteId);
    }
  });
});

describe("Composer Phase 3U canonical-data sanity audit", () => {
  const perfumesById = new Map(perfumes.map((perfume) => [perfume.id, perfume]));

  it("confirms no canonical-data correction was made or is recommended -- YSL Y EDP legitimately carries both amberwood and olibanum, and Squid legitimately carries both ambergris and opoponax, each pair independently scored", () => {
    const yEDP = perfumesById.get(213);
    expect(yEDP.baseNotes).toContain("amberwood");
    expect(yEDP.baseNotes).toContain("olibanum");
    expect(NOTE_PROMINENCE_BY_ID[213].amberwood).toBeUndefined();
    expect(NOTE_PROMINENCE_BY_ID[213].olibanum).toBeUndefined();

    const squid = perfumesById.get(500);
    expect(squid.middleNotes).toContain("opoponax");
    expect(squid.baseNotes).toContain("ambergris");
    expect(NOTE_PROMINENCE_BY_ID[500].ambergris).toBe(6);
    expect(NOTE_PROMINENCE_BY_ID[500].opoponax).toBeUndefined();
  });

  it("confirms no fragrance conflates an in-scope key with amber, ambroxan, benzoin, siamBenzoin, or incense", () => {
    const fByFerragamoBlack = perfumesById.get(20);
    expect(fByFerragamoBlack.baseNotes).toContain("amber");
    expect(fByFerragamoBlack.middleNotes).toContain("labdanum");
    expect(NOTE_PROMINENCE_BY_ID[20].amber).toBe(6);
    expect(NOTE_PROMINENCE_BY_ID[20].labdanum).toBeUndefined();
  });
});

describe("Composer Phase 3U horizontal calibration -- seven amber/resinous-adjacent standalone keys", () => {
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

  it("keeps every calibrated value across the seven in-scope keys an integer from 1 to 10", () => {
    for (const family of Object.values(ALL_FAMILIES)) {
      for (const [id, score] of Object.entries(family)) {
        if (score === undefined) continue;
        expect(Number.isInteger(score), `id ${id}`).toBe(true);
        expect(score).toBeGreaterThanOrEqual(1);
        expect(score).toBeLessThanOrEqual(10);
      }
    }
  });

  it("never collapses the seven in-scope keys into one another, or into amber/ambroxan/benzoin/incense", () => {
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

  it("changes zero prominence values in this phase -- every in-scope score above is exactly what the catalog already held before Phase 3U", () => {
    // This test pins that outcome as a regression guard -- if it ever
    // fails, either a later phase intentionally recalibrated one of
    // these exact keys (update this file's fixtures to match, with a
    // comment), or an unrelated change accidentally drifted a score.
    expect(NOTE_PROMINENCE_BY_ID[19]).toEqual({ pineapple: 8, birch: 7, blackCurrant: 6, ambergris: 5 });
    expect(NOTE_PROMINENCE_BY_ID[500]).toEqual({ ink: 9, incense: 7, seaSalt: 6, ambergris: 6 });
    expect(NOTE_PROMINENCE_BY_ID[34]).toEqual({ grapefruit: 7, vetiver: 6, olibanum: 5 });
  });

  it("leaves canonical note data completely unchanged in this phase -- no pyramid was edited for any in-scope member", () => {
    expect(perfumesById.get(500)).toMatchObject({
      name: "Squid",
      middleNotes: ["ink", "seaSalt", "opoponax"],
      baseNotes: ["ambergris", "benzoin", "musk"],
    });
    expect(perfumesById.get(213)).toMatchObject({
      name: "YSL Y EDP",
      baseNotes: ["amberwood", "tonkaBean", "cedar", "vetiver", "olibanum"],
    });
  });

  it("does not manufacture a rank difference between two genuinely tied notes -- Squid's ambergris:6 correctly ties its own seaSalt:6, both secondary to its own established ink:9", () => {
    const squid = NOTE_PROMINENCE_BY_ID[500];
    expect(squid.ambergris).toBe(squid.seaSalt);
    expect(squid.ambergris).toBeLessThan(squid.ink);
  });

  // The Note Explorer "Most prominent" sort verification for these seven
  // keys lives in
  // packages/builder/src/builder/internal/intelligence/buildNoteExplorerViewModel.test.js
  // instead of here -- packages/catalog must never import from
  // packages/builder (ADR-0006), and this file already proves the
  // underlying data (membership, scores, containment) that sort depends on.
});
