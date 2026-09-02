import { describe, expect, it } from "vitest";

import { summarizeAllSignals, summarizeConvergence, summarizeSignalReviews } from "./reviewSummary.js";

function row({
  anchorId = 1,
  anchorName = "Anchor",
  signal,
  candidateId,
  candidateName = `Candidate ${candidateId}`,
  humanSimilarityRating = null,
  rightReasonRating = null,
  signalsPresent = [signal],
}) {
  return {
    anchorId,
    anchorName,
    signal,
    rank: 1,
    candidateId,
    candidateName,
    score: 0.5,
    sharedEvidence: [],
    support: {},
    humanSimilarityRating,
    rightReasonRating,
    reviewerNotes: null,
    signalsPresent,
  };
}

describe("summarizeSignalReviews", () => {
  it("handles a completely blank review matrix safely -- zero reviewed, null mean, zeroed distribution", () => {
    const rows = [
      row({ signal: "notes", candidateId: 2 }),
      row({ signal: "notes", candidateId: 3 }),
      row({ signal: "accords", candidateId: 2 }),
    ];
    const summary = summarizeSignalReviews(rows, "notes");
    expect(summary.totalRows).toBe(2);
    expect(summary.numberReviewed).toBe(0);
    expect(summary.meanHumanSimilarityRating).toBeNull();
    expect(summary.distribution).toEqual({ 0: 0, 1: 0, 2: 0, 3: 0 });
    expect(summary.rightReasonCounts).toEqual({ yes: 0, partially: 0, no: 0 });
  });

  it("computes a hand-verified mean and distribution for a synthetic reviewed fixture", () => {
    const rows = [
      row({ signal: "notes", candidateId: 2, humanSimilarityRating: 3, rightReasonRating: "yes" }),
      row({ signal: "notes", candidateId: 3, humanSimilarityRating: 1, rightReasonRating: "no" }),
      row({ signal: "notes", candidateId: 4, humanSimilarityRating: 1, rightReasonRating: "partially" }),
      row({ signal: "notes", candidateId: 5, humanSimilarityRating: 0, rightReasonRating: "no" }),
    ];
    const summary = summarizeSignalReviews(rows, "notes");
    expect(summary.numberReviewed).toBe(4);
    expect(summary.meanHumanSimilarityRating).toBeCloseTo((3 + 1 + 1 + 0) / 4, 10);
    expect(summary.distribution).toEqual({ 0: 1, 1: 2, 2: 0, 3: 1 });
    expect(summary.rightReasonCounts).toEqual({ yes: 1, partially: 1, no: 2 });
  });

  it("only counts rows belonging to the requested signal", () => {
    const rows = [
      row({ signal: "notes", candidateId: 2, humanSimilarityRating: 3 }),
      row({ signal: "accords", candidateId: 2, humanSimilarityRating: 0 }),
    ];
    const notesSummary = summarizeSignalReviews(rows, "notes");
    expect(notesSummary.numberReviewed).toBe(1);
    expect(notesSummary.meanHumanSimilarityRating).toBe(3);
  });

  it("ignores invalid humanSimilarityRating values (documented policy: excluded, not coerced) -- out-of-range number, wrong type, and undefined", () => {
    const rows = [
      row({ signal: "notes", candidateId: 2, humanSimilarityRating: 4 }), // out of range
      row({ signal: "notes", candidateId: 3, humanSimilarityRating: -1 }), // out of range
      row({ signal: "notes", candidateId: 4, humanSimilarityRating: "2" }), // wrong type (string, not number)
      row({ signal: "notes", candidateId: 5, humanSimilarityRating: undefined }),
      row({ signal: "notes", candidateId: 6, humanSimilarityRating: 2 }), // the only valid one
    ];
    const summary = summarizeSignalReviews(rows, "notes");
    expect(summary.numberReviewed).toBe(1);
    expect(summary.meanHumanSimilarityRating).toBe(2);
    expect(summary.distribution).toEqual({ 0: 0, 1: 0, 2: 1, 3: 0 });
  });

  it("ignores invalid rightReasonRating values (documented policy: excluded, not coerced) -- wrong casing, typo, and null", () => {
    const rows = [
      row({ signal: "notes", candidateId: 2, rightReasonRating: "Yes" }), // wrong casing
      row({ signal: "notes", candidateId: 3, rightReasonRating: "maybe" }), // not a valid value
      row({ signal: "notes", candidateId: 4, rightReasonRating: null }),
      row({ signal: "notes", candidateId: 5, rightReasonRating: "yes" }), // the only valid one
    ];
    const summary = summarizeSignalReviews(rows, "notes");
    expect(summary.rightReasonCounts).toEqual({ yes: 1, partially: 0, no: 0 });
  });

  it("returns totalRows: 0 and safe defaults for a signal with no rows at all", () => {
    const summary = summarizeSignalReviews([], "prominence");
    expect(summary.totalRows).toBe(0);
    expect(summary.numberReviewed).toBe(0);
    expect(summary.meanHumanSimilarityRating).toBeNull();
  });
});

describe("summarizeAllSignals", () => {
  it("returns one summary per requested signal, in the requested order", () => {
    const rows = [row({ signal: "notes", candidateId: 2 }), row({ signal: "accords", candidateId: 2 })];
    const summaries = summarizeAllSignals(rows, ["accords", "notes", "vibes"]);
    expect(summaries.map((s) => s.signal)).toEqual(["accords", "notes", "vibes"]);
    expect(summaries.find((s) => s.signal === "vibes").totalRows).toBe(0);
  });
});

describe("summarizeConvergence -- signal-agreement metadata, never a similarity score", () => {
  it("ranks by number of independent signals present, descending", () => {
    const rows = [
      row({ candidateId: 2, signal: "notes", signalsPresent: ["notes", "accords", "vibes", "prominence"] }),
      row({ candidateId: 3, signal: "notes", signalsPresent: ["notes"] }),
      row({ candidateId: 4, signal: "notes", signalsPresent: ["notes", "accords"] }),
    ];
    const convergence = summarizeConvergence(rows);
    expect(convergence.map((c) => c.candidateId)).toEqual([2, 4, 3]);
    expect(convergence.map((c) => c.signalCount)).toEqual([4, 2, 1]);
  });

  it("deduplicates a candidate that appears in multiple signal rows for the same anchor into one convergence entry", () => {
    const rows = [
      row({ candidateId: 2, signal: "notes", signalsPresent: ["notes", "accords"] }),
      row({ candidateId: 2, signal: "accords", signalsPresent: ["notes", "accords"] }),
    ];
    const convergence = summarizeConvergence(rows);
    expect(convergence).toHaveLength(1);
    expect(convergence[0].candidateId).toBe(2);
  });

  it("keeps convergence entries for different anchors separate even for the same candidateId", () => {
    const rows = [
      row({ anchorId: 1, candidateId: 2, signal: "notes", signalsPresent: ["notes"] }),
      row({ anchorId: 9, candidateId: 2, signal: "notes", signalsPresent: ["notes", "accords"] }),
    ];
    const convergence = summarizeConvergence(rows);
    expect(convergence).toHaveLength(2);
  });

  it("breaks ties deterministically by ascending anchorId then ascending candidateId", () => {
    const rows = [
      row({ anchorId: 2, candidateId: 5, signal: "notes", signalsPresent: ["notes", "accords"] }),
      row({ anchorId: 1, candidateId: 9, signal: "notes", signalsPresent: ["notes", "accords"] }),
      row({ anchorId: 1, candidateId: 3, signal: "notes", signalsPresent: ["notes", "accords"] }),
    ];
    const convergence = summarizeConvergence(rows);
    // All tie at signalCount 2 -- ascending anchorId first (1 before 2), then ascending candidateId within anchor 1 (3 before 9).
    expect(convergence.map((c) => [c.anchorId, c.candidateId])).toEqual([
      [1, 3],
      [1, 9],
      [2, 5],
    ]);
  });

  it("handles an empty row set safely", () => {
    expect(summarizeConvergence([])).toEqual([]);
  });
});
