import { describe, expect, it } from "vitest";

import { compareAccordSimilarity } from "./accordSimilarity.js";

function perfume(id, accords) {
  return { id, accords };
}

describe("compareAccordSimilarity -- Jaccard over curated accord sets", () => {
  it("scores identical accord sets as 1", () => {
    const a = perfume(1, ["sweet", "woody"]);
    const b = perfume(2, ["sweet", "woody"]);
    const result = compareAccordSimilarity(a, b);
    expect(result.score).toBe(1);
    expect(result.sharedAccords.sort()).toEqual(["sweet", "woody"]);
    expect(result.unionSize).toBe(2);
  });

  it("scores disjoint accord sets as 0", () => {
    const a = perfume(1, ["sweet", "woody"]);
    const b = perfume(2, ["citrus", "aquatic"]);
    const result = compareAccordSimilarity(a, b);
    expect(result.score).toBe(0);
    expect(result.sharedAccords).toEqual([]);
  });

  it("computes a hand-verified partial overlap: {sweet, warm spicy, woody, vanilla} vs {citrus, aromatic, sweet} -> 1/6", () => {
    const a = perfume(1, ["sweet", "warm spicy", "woody", "vanilla"]);
    const b = perfume(2, ["citrus", "aromatic", "sweet"]);
    const result = compareAccordSimilarity(a, b);
    expect(result.sharedAccords).toEqual(["sweet"]);
    expect(result.unionSize).toBe(6);
    expect(result.score).toBeCloseTo(1 / 6, 10);
  });

  it("deduplicates repeated accord values before comparison", () => {
    const withDuplicates = perfume(1, ["sweet", "sweet", "woody"]);
    const other = perfume(2, ["sweet", "woody"]);
    const result = compareAccordSimilarity(withDuplicates, other);
    expect(result.score).toBe(1);
    expect(result.unionSize).toBe(2);
  });

  it("is empty-set safe", () => {
    const a = perfume(1, []);
    const b = perfume(2, []);
    const result = compareAccordSimilarity(a, b);
    expect(result.score).toBe(0);
    expect(Number.isNaN(result.score)).toBe(false);
  });

  it("does not mutate either input fragrance", () => {
    const a = perfume(1, ["sweet", "woody"]);
    const b = perfume(2, ["sweet"]);
    const beforeA = JSON.stringify(a);
    const beforeB = JSON.stringify(b);
    compareAccordSimilarity(a, b);
    expect(JSON.stringify(a)).toBe(beforeA);
    expect(JSON.stringify(b)).toBe(beforeB);
  });
});
