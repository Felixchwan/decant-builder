import { describe, expect, it } from "vitest";

import { compareNoteSimilarity } from "./noteSimilarity.js";

function perfume(id, noteIds) {
  return { id, topNotes: noteIds, middleNotes: [], baseNotes: [], generalNotes: [] };
}

describe("compareNoteSimilarity -- Jaccard over exact canonical note membership", () => {
  it("scores identical note sets as 1", () => {
    const a = perfume(1, ["rose", "oud"]);
    const b = perfume(2, ["rose", "oud"]);
    const result = compareNoteSimilarity(a, b);
    expect(result.score).toBe(1);
    expect(result.unionSize).toBe(2);
    expect(result.sharedNotes.sort()).toEqual(["oud", "rose"]);
  });

  it("scores disjoint note sets as 0", () => {
    const a = perfume(1, ["rose", "oud"]);
    const b = perfume(2, ["musk", "vanilla"]);
    const result = compareNoteSimilarity(a, b);
    expect(result.score).toBe(0);
    expect(result.sharedNotes).toEqual([]);
    expect(result.unionSize).toBe(4);
  });

  it("computes a hand-verified partial overlap: {rose, oud, vanilla} vs {rose, musk} -> 1/4", () => {
    const a = perfume(1, ["rose", "oud", "vanilla"]);
    const b = perfume(2, ["rose", "musk"]);
    const result = compareNoteSimilarity(a, b);
    expect(result.sharedNotes).toEqual(["rose"]);
    expect(result.unionSize).toBe(4); // rose, oud, vanilla, musk
    expect(result.score).toBeCloseTo(1 / 4, 10);
  });

  it("is unaffected by duplicate note membership within one fragrance (pyramid position does not inflate the score)", () => {
    const withDuplicates = {
      id: 1,
      topNotes: ["rose"],
      middleNotes: ["rose", "oud"],
      baseNotes: ["oud"],
      generalNotes: [],
    };
    const other = perfume(2, ["rose", "oud"]);
    const result = compareNoteSimilarity(withDuplicates, other);
    expect(result.score).toBe(1);
    expect(result.sharedNotes.sort()).toEqual(["oud", "rose"]);
    expect(result.unionSize).toBe(2); // not 4 -- duplicates collapse before comparison
  });

  it("is empty-set safe -- two fragrances with no notes at all score 0, not NaN", () => {
    const a = perfume(1, []);
    const b = perfume(2, []);
    const result = compareNoteSimilarity(a, b);
    expect(result.score).toBe(0);
    expect(result.unionSize).toBe(0);
    expect(Number.isNaN(result.score)).toBe(false);
  });

  it("never hides evidence behind the score -- sharedNotes and unionSize are always present", () => {
    const a = perfume(1, ["rose", "oud"]);
    const b = perfume(2, ["rose"]);
    const result = compareNoteSimilarity(a, b);
    expect(result).toHaveProperty("score");
    expect(result).toHaveProperty("sharedNotes");
    expect(result).toHaveProperty("unionSize");
  });

  it("does not mutate either input fragrance", () => {
    const a = perfume(1, ["rose", "oud"]);
    const b = perfume(2, ["rose"]);
    const beforeA = JSON.stringify(a);
    const beforeB = JSON.stringify(b);
    compareNoteSimilarity(a, b);
    expect(JSON.stringify(a)).toBe(beforeA);
    expect(JSON.stringify(b)).toBe(beforeB);
  });
});
