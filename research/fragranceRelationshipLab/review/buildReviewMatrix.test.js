import { describe, expect, it } from "vitest";

import {
  TOP_N,
  buildInsufficientProminenceEvidence,
  buildReviewMatrix,
  buildReviewRowsForAnchor,
} from "./buildReviewMatrix.js";

// Hand-verifiable synthetic catalog (N = 7: 1 anchor + 6 candidates),
// deliberately built so every signal's top-5 ranking can be checked by
// hand, and so the four signals disagree with each other in informative
// ways -- exactly the kind of divergence Phase 2 found in the real
// catalog (e.g. Layton).
//
//   Anchor A (id 1): notes {rose, oud, vanilla}; accords {sweet, woody};
//                     vibes {warm, elegant}; prominence {rose:9, oud:6}
//   B (id 2): notes {rose, oud, musk}; accords {sweet, citrus};
//             vibes {warm, fresh}; prominence {rose:8, oud:5}
//   C (id 3): notes {rose}; accords {sweet, woody} (identical to A);
//             vibes {warm, elegant} (identical to A); prominence {rose:1}
//   D (id 4): notes {musk, amber}; accords {citrus}; vibes {fresh};
//             prominence {amber:5} -- shares nothing with A on any signal
//   E (id 5): notes {oud, vanilla}; accords {woody}; vibes {elegant};
//             prominence {oud:6}
//   F (id 6): notes {rose, vanilla}; accords {sweet}; vibes {warm};
//             prominence {} (no scored notes at all)
//   G (id 7): notes {rose, oud, vanilla} (identical to A); accords
//             {sweet, woody} (identical); vibes {warm, elegant}
//             (identical); prominence {rose:9, oud:6} (identical) -- a
//             deliberate "twin" of the anchor
function perfume(id, { notes = [], accords = [], vibes = [], noteProminence = {} }) {
  return {
    id,
    name: `Perfume ${id}`,
    topNotes: notes,
    middleNotes: [],
    baseNotes: [],
    generalNotes: [],
    accords,
    vibes,
    noteProminence,
  };
}

const ANCHOR = perfume(1, {
  notes: ["rose", "oud", "vanilla"],
  accords: ["sweet", "woody"],
  vibes: ["warm", "elegant"],
  noteProminence: { rose: 9, oud: 6 },
});

const CATALOG = [
  ANCHOR,
  perfume(2, { notes: ["rose", "oud", "musk"], accords: ["sweet", "citrus"], vibes: ["warm", "fresh"], noteProminence: { rose: 8, oud: 5 } }),
  perfume(3, { notes: ["rose"], accords: ["sweet", "woody"], vibes: ["warm", "elegant"], noteProminence: { rose: 1 } }),
  perfume(4, { notes: ["musk", "amber"], accords: ["citrus"], vibes: ["fresh"], noteProminence: { amber: 5 } }),
  perfume(5, { notes: ["oud", "vanilla"], accords: ["woody"], vibes: ["elegant"], noteProminence: { oud: 6 } }),
  perfume(6, { notes: ["rose", "vanilla"], accords: ["sweet"], vibes: ["warm"], noteProminence: {} }),
  perfume(7, { notes: ["rose", "oud", "vanilla"], accords: ["sweet", "woody"], vibes: ["warm", "elegant"], noteProminence: { rose: 9, oud: 6 } }),
];

function rowsFor(signal, rows) {
  return rows.filter((row) => row.signal === signal);
}

describe("buildReviewRowsForAnchor", () => {
  const rows = buildReviewRowsForAnchor(ANCHOR, CATALOG);

  it("excludes the anchor itself from every signal", () => {
    expect(rows.some((row) => row.candidateId === ANCHOR.id)).toBe(false);
  });

  it("produces exactly top 5 for notes/accords/vibes (6 real candidates exist, so exactly one is dropped per signal)", () => {
    expect(rowsFor("notes", rows)).toHaveLength(TOP_N);
    expect(rowsFor("accords", rows)).toHaveLength(TOP_N);
    expect(rowsFor("vibes", rows)).toHaveLength(TOP_N);
  });

  it("computes the hand-verified notes ranking exactly: G, E, F, B, C (D excluded, 6th place)", () => {
    expect(rowsFor("notes", rows).map((row) => row.candidateId)).toEqual([7, 5, 6, 2, 3]);
  });

  it("computes the hand-verified accords ranking exactly: C, G, E, F, B (a different order than notes -- proving independent signals)", () => {
    expect(rowsFor("accords", rows).map((row) => row.candidateId)).toEqual([3, 7, 5, 6, 2]);
  });

  it("computes the hand-verified vibes ranking, matching accords' order in this fixture (C, G, E, F, B)", () => {
    expect(rowsFor("vibes", rows).map((row) => row.candidateId)).toEqual([3, 7, 5, 6, 2]);
  });

  it("produces fewer than top 5 for prominence when fewer than 5 candidates reach the sufficiency threshold -- only G and B qualify (n=2 each)", () => {
    const prominenceRows = rowsFor("prominence", rows);
    expect(prominenceRows).toHaveLength(2);
    expect(prominenceRows.map((row) => row.candidateId)).toEqual([7, 2]);
  });

  it("never includes an insufficient-support prominence candidate as a normal ranked row, even when its raw score is a perfect 1.0 (candidate E)", () => {
    const prominenceRows = rowsFor("prominence", rows);
    expect(prominenceRows.some((row) => row.candidateId === 5)).toBe(false);
  });

  it("preserves exact signal-specific evidence -- notes", () => {
    const gRow = rowsFor("notes", rows).find((row) => row.candidateId === 7);
    expect([...gRow.sharedEvidence].sort()).toEqual(["oud", "rose", "vanilla"]);
    expect(gRow.support).toEqual({ unionSize: 3 });
    expect(gRow.score).toBe(1);
  });

  it("preserves exact signal-specific evidence -- accords", () => {
    const cRow = rowsFor("accords", rows).find((row) => row.candidateId === 3);
    expect([...cRow.sharedEvidence].sort()).toEqual(["sweet", "woody"]);
    expect(cRow.support).toEqual({ unionSize: 2 });
  });

  it("preserves exact signal-specific evidence -- vibes", () => {
    const cRow = rowsFor("vibes", rows).find((row) => row.candidateId === 3);
    expect([...cRow.sharedEvidence].sort()).toEqual(["elegant", "warm"]);
  });

  it("preserves exact signal-specific evidence -- prominence (mutually scored notes with both scores, plus count/coverage)", () => {
    const bRow = rowsFor("prominence", rows).find((row) => row.candidateId === 2);
    expect(bRow.sharedEvidence.map((e) => e.noteId).sort()).toEqual(["oud", "rose"]);
    expect(bRow.sharedEvidence.find((e) => e.noteId === "rose")).toEqual({
      noteId: "rose",
      anchorScore: 9,
      candidateScore: 8,
    });
    expect(bRow.support.mutuallyScoredCount).toBe(2);
    expect(bRow.score).toBeCloseTo(13 / 15, 10);
  });

  it("starts every human-review field as null -- no automatic judgment is ever populated", () => {
    rows.forEach((row) => {
      expect(row.humanSimilarityRating).toBeNull();
      expect(row.rightReasonRating).toBeNull();
      expect(row.reviewerNotes).toBeNull();
    });
  });

  it("keeps the same anchor/candidate pair as distinct observations across signals, never merged", () => {
    const candidate2Rows = rows.filter((row) => row.candidateId === 2);
    // B appears under notes, accords, vibes, and prominence -- 4 separate rows.
    expect(candidate2Rows).toHaveLength(4);
    expect(new Set(candidate2Rows.map((row) => row.signal)).size).toBe(4);
    // Each row's own score/evidence is independent -- notes and accords
    // scores for the same pair are not required (or expected) to match.
    const noteScore = candidate2Rows.find((row) => row.signal === "notes").score;
    const accordScore = candidate2Rows.find((row) => row.signal === "accords").score;
    expect(noteScore).not.toBe(accordScore);
  });

  it("computes signalsPresent correctly -- B and G appear in all four signals; C, E, F appear in three (never prominence)", () => {
    const byCandidateId = (id) => rows.find((row) => row.candidateId === id);
    expect(byCandidateId(2).signalsPresent).toEqual(["accords", "notes", "prominence", "vibes"]);
    expect(byCandidateId(7).signalsPresent).toEqual(["accords", "notes", "prominence", "vibes"]);
    expect(byCandidateId(3).signalsPresent).toEqual(["accords", "notes", "vibes"]);
    expect(byCandidateId(5).signalsPresent).toEqual(["accords", "notes", "vibes"]);
    expect(byCandidateId(6).signalsPresent).toEqual(["accords", "notes", "vibes"]);
  });

  it("gives every row for the same (anchor, candidate) pair the identical signalsPresent list", () => {
    const candidate2Rows = rows.filter((row) => row.candidateId === 2);
    const distinctSignalsPresentValues = new Set(candidate2Rows.map((row) => JSON.stringify(row.signalsPresent)));
    expect(distinctSignalsPresentValues.size).toBe(1);
  });

  it("produces deterministic output across repeated calls", () => {
    const again = buildReviewRowsForAnchor(ANCHOR, CATALOG);
    expect(again).toEqual(rows);
  });

  it("does not mutate the anchor, the catalog array, or any candidate object", () => {
    const beforeSnapshot = JSON.stringify(CATALOG);
    buildReviewRowsForAnchor(ANCHOR, CATALOG);
    expect(JSON.stringify(CATALOG)).toBe(beforeSnapshot);
  });
});

describe("buildReviewMatrix", () => {
  it("finds anchors by name and builds rows only for anchors present in the catalog", () => {
    const rows = buildReviewMatrix(["Perfume 1", "Perfume 999 (does not exist)"], CATALOG);
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((row) => row.anchorId === 1)).toBe(true);
  });

  it("returns an empty array for an empty anchor list, without throwing", () => {
    expect(buildReviewMatrix([], CATALOG)).toEqual([]);
  });

  it("concatenates rows for multiple real anchors, keeping each anchor's own rows scoped to it", () => {
    const secondAnchor = perfume(8, { notes: ["musk"], accords: [], vibes: [], noteProminence: {} });
    const catalogWithSecondAnchor = [...CATALOG, secondAnchor];
    const rows = buildReviewMatrix(["Perfume 1", "Perfume 8"], catalogWithSecondAnchor);
    expect(new Set(rows.map((row) => row.anchorId))).toEqual(new Set([1, 8]));
  });
});

describe("buildInsufficientProminenceEvidence", () => {
  it("returns exactly the candidates with 1 mutually-scored note (C and E), excluding both the sufficient (B, G) and zero-evidence (D, F) candidates", () => {
    const insufficient = buildInsufficientProminenceEvidence(ANCHOR, CATALOG);
    expect(insufficient.map((entry) => entry.candidateId).sort()).toEqual([3, 5]);
    insufficient.forEach((entry) => {
      expect(entry.mutuallyScoredCount).toBe(1);
    });
  });

  it("is never mixed into buildReviewRowsForAnchor's main output", () => {
    const mainRows = buildReviewRowsForAnchor(ANCHOR, CATALOG);
    const insufficient = buildInsufficientProminenceEvidence(ANCHOR, CATALOG);
    const insufficientIds = new Set(insufficient.map((entry) => entry.candidateId));
    const prominenceRowIds = new Set(rowsFor("prominence", mainRows).map((row) => row.candidateId));
    insufficientIds.forEach((id) => {
      expect(prominenceRowIds.has(id)).toBe(false);
    });
  });
});
