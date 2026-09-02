import { describe, expect, it } from "vitest";

import { MIN_MUTUALLY_SCORED_COUNT_FOR_RANKING, compareProminenceSimilarity } from "./prominenceSimilarity.js";

function perfume(id, noteProminence) {
  return { id, noteProminence };
}

describe("compareProminenceSimilarity -- Ruzicka / weighted Jaccard over mutually-scored notes only", () => {
  it("scores identical score vectors as 1", () => {
    const a = perfume(1, { rose: 8, oud: 6 });
    const b = perfume(2, { rose: 8, oud: 6 });
    const result = compareProminenceSimilarity(a, b);
    expect(result.score).toBe(1);
    expect(result.mutuallyScoredCount).toBe(2);
  });

  it("computes a hand-verified strongly-different-scores case proportionally: rose 9 vs rose 3 -> 3/9 = 1/3", () => {
    const a = perfume(1, { rose: 9 });
    const b = perfume(2, { rose: 3 });
    const result = compareProminenceSimilarity(a, b);
    expect(result.score).toBeCloseTo(1 / 3, 10);
  });

  it("discriminates correctly even at n=1 -- this is exactly the case cosine cannot handle (see the rejected-cosine test below)", () => {
    const closeScores = compareProminenceSimilarity(perfume(1, { rose: 9 }), perfume(2, { rose: 8 }));
    const farScores = compareProminenceSimilarity(perfume(1, { rose: 9 }), perfume(2, { rose: 1 }));
    expect(closeScores.mutuallyScoredCount).toBe(1);
    expect(farScores.mutuallyScoredCount).toBe(1);
    expect(closeScores.score).toBeCloseTo(8 / 9, 10);
    expect(farScores.score).toBeCloseTo(1 / 9, 10);
    expect(closeScores.score).toBeGreaterThan(farScores.score);
  });

  it("computes a hand-verified multi-dimension case: {rose:9, oud:6, vanilla:4} vs {rose:6, oud:6, musk:5} -> mutual {rose,oud} only", () => {
    const a = perfume(1, { rose: 9, oud: 6, vanilla: 4 });
    const b = perfume(2, { rose: 6, oud: 6, musk: 5 });
    const result = compareProminenceSimilarity(a, b);
    // mutually scored: rose (9,6) and oud (6,6). minSum = 6+6=12, maxSum = 9+6=15.
    expect(result.mutuallyScoredCount).toBe(2);
    expect(result.mutuallyScoredNotes.map((n) => n.noteId).sort()).toEqual(["oud", "rose"]);
    expect(result.score).toBeCloseTo(12 / 15, 10);
  });

  it("excludes unscored/missing dimensions rather than zero-filling them -- vanilla and musk (present on only one side) never enter the sum", () => {
    const a = perfume(1, { rose: 9, oud: 6, vanilla: 4 });
    const b = perfume(2, { rose: 6, oud: 6, musk: 5 });
    const result = compareProminenceSimilarity(a, b);
    expect(result.mutuallyScoredNotes.some((n) => n.noteId === "vanilla")).toBe(false);
    expect(result.mutuallyScoredNotes.some((n) => n.noteId === "musk")).toBe(false);
  });

  it("returns score: null (never 0) when there are zero mutually-scored notes -- missing prominence must never become score 0", () => {
    const a = perfume(1, { rose: 9 });
    const b = perfume(2, { musk: 5 });
    const result = compareProminenceSimilarity(a, b);
    expect(result.score).toBeNull();
    expect(result.mutuallyScoredCount).toBe(0);
    expect(result.isSufficientForRanking).toBe(false);
  });

  it("reports an exact, correct mutuallyScoredCount", () => {
    const a = perfume(1, { rose: 9, oud: 6, vanilla: 4, cardamom: 5 });
    const b = perfume(2, { rose: 6, oud: 6, musk: 5 });
    const result = compareProminenceSimilarity(a, b);
    expect(result.mutuallyScoredCount).toBe(2); // rose, oud
  });

  it("reports an exact, correct coverageFraction relative to the smaller of the two fragrances' own scored-note counts", () => {
    // a has 4 scored notes, b has 3 scored notes -- smaller = 3.
    // mutual = {rose, oud} = 2. coverageFraction = 2/3.
    const a = perfume(1, { rose: 9, oud: 6, vanilla: 4, cardamom: 5 });
    const b = perfume(2, { rose: 6, oud: 6, musk: 5 });
    const result = compareProminenceSimilarity(a, b);
    expect(result.coverageFraction).toBeCloseTo(2 / 3, 10);
  });

  it("exposes canonical note id, anchor score, and candidate score for every mutually scored note", () => {
    const a = perfume(1, { rose: 9, oud: 6 });
    const b = perfume(2, { rose: 6, oud: 6 });
    const result = compareProminenceSimilarity(a, b);
    const roseEntry = result.mutuallyScoredNotes.find((n) => n.noteId === "rose");
    expect(roseEntry).toEqual({ noteId: "rose", anchorScore: 9, candidateScore: 6 });
  });

  it("flags mutuallyScoredCount < MIN_MUTUALLY_SCORED_COUNT_FOR_RANKING as insufficient for ranking, without fabricating a fallback score", () => {
    expect(MIN_MUTUALLY_SCORED_COUNT_FOR_RANKING).toBe(2);
    const oneShared = compareProminenceSimilarity(perfume(1, { rose: 9 }), perfume(2, { rose: 4 }));
    expect(oneShared.mutuallyScoredCount).toBe(1);
    expect(oneShared.isSufficientForRanking).toBe(false);
    expect(oneShared.score).toBeCloseTo(4 / 9, 10); // a real score, still present for raw inspection

    const twoShared = compareProminenceSimilarity(perfume(1, { rose: 9, oud: 5 }), perfume(2, { rose: 4, oud: 5 }));
    expect(twoShared.mutuallyScoredCount).toBe(2);
    expect(twoShared.isSufficientForRanking).toBe(true);
  });

  it("is empty-object safe when a fragrance has no scored notes at all", () => {
    const a = perfume(1, {});
    const b = perfume(2, { rose: 5 });
    const result = compareProminenceSimilarity(a, b);
    expect(result.score).toBeNull();
    expect(result.mutuallyScoredCount).toBe(0);
  });

  it("does not mutate either input fragrance", () => {
    const a = perfume(1, { rose: 9, oud: 6 });
    const b = perfume(2, { rose: 6 });
    const beforeA = JSON.stringify(a);
    const beforeB = JSON.stringify(b);
    compareProminenceSimilarity(a, b);
    expect(JSON.stringify(a)).toBe(beforeA);
    expect(JSON.stringify(b)).toBe(beforeB);
  });
});

// Documentation/assertion regression proving exactly why cosine was
// rejected as the active metric in prominenceSimilarity.js. This is
// intentionally NOT exercising any exported production/research API --
// cosine is never implemented as a callable function anywhere in this
// lab. It exists here only as inline arithmetic, to keep the rejection
// reasoning verifiable rather than asserted by comment alone.
describe("rejected alternative: cosine similarity at n=1 is mathematically degenerate", () => {
  function cosineOverSharedDimensions(valuesA, valuesB) {
    const sharedKeys = Object.keys(valuesA).filter((key) => key in valuesB);
    let dot = 0;
    let magA = 0;
    let magB = 0;
    sharedKeys.forEach((key) => {
      dot += valuesA[key] * valuesB[key];
      magA += valuesA[key] ** 2;
      magB += valuesB[key] ** 2;
    });
    return dot / (Math.sqrt(magA) * Math.sqrt(magB));
  }

  it("is always exactly 1.0 for any two positive values sharing exactly one dimension, regardless of how different they are", () => {
    expect(cosineOverSharedDimensions({ x: 1 }, { x: 10 })).toBe(1);
    expect(cosineOverSharedDimensions({ x: 9 }, { x: 1 })).toBe(1);
  });

  it("is exactly the failure mode Ruzicka avoids -- the same two pairs discriminate correctly under Ruzicka", () => {
    const closeOnRuzicka = compareProminenceSimilarity(perfume(1, { x: 1 }), perfume(2, { x: 10 }));
    const farOnRuzicka = compareProminenceSimilarity(perfume(1, { x: 9 }), perfume(2, { x: 1 }));
    expect(closeOnRuzicka.score).toBeCloseTo(1 / 10, 10);
    expect(farOnRuzicka.score).toBeCloseTo(1 / 9, 10);
    expect(closeOnRuzicka.score).not.toBe(farOnRuzicka.score);
  });
});
