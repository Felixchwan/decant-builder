import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { compareVibeSimilarity } from "./vibeSimilarity.js";

const VIBE_SIMILARITY_SOURCE = readFileSync(new URL("./vibeSimilarity.js", import.meta.url), "utf8");

function perfume(id, vibes) {
  return { id, vibes };
}

describe("compareVibeSimilarity -- Jaccard over curated vibe sets", () => {
  it("scores identical vibe sets as 1", () => {
    const a = perfume(1, ["elegant", "warm"]);
    const b = perfume(2, ["elegant", "warm"]);
    const result = compareVibeSimilarity(a, b);
    expect(result.score).toBe(1);
    expect(result.sharedVibes.sort()).toEqual(["elegant", "warm"]);
  });

  it("scores disjoint vibe sets as 0", () => {
    const a = perfume(1, ["elegant", "warm"]);
    const b = perfume(2, ["playful", "energetic"]);
    const result = compareVibeSimilarity(a, b);
    expect(result.score).toBe(0);
    expect(result.sharedVibes).toEqual([]);
  });

  it("computes a hand-verified partial overlap: {seductive, elegant, warm, classic} vs {seductive, elegant, sophisticated} -> 2/5", () => {
    const a = perfume(1, ["seductive", "elegant", "warm", "classic"]);
    const b = perfume(2, ["seductive", "elegant", "sophisticated"]);
    const result = compareVibeSimilarity(a, b);
    expect(result.sharedVibes.sort()).toEqual(["elegant", "seductive"]);
    expect(result.unionSize).toBe(5);
    expect(result.score).toBeCloseTo(2 / 5, 10);
  });

  it("deduplicates repeated vibe values before comparison", () => {
    const withDuplicates = perfume(1, ["warm", "warm", "elegant"]);
    const other = perfume(2, ["warm", "elegant"]);
    const result = compareVibeSimilarity(withDuplicates, other);
    expect(result.score).toBe(1);
    expect(result.unionSize).toBe(2);
  });

  it("is empty-set safe", () => {
    const a = perfume(1, []);
    const b = perfume(2, []);
    const result = compareVibeSimilarity(a, b);
    expect(result.score).toBe(0);
    expect(Number.isNaN(result.score)).toBe(false);
  });

  it("remains conceptually independent from scent/material similarity -- this module has no awareness of notes or accords at all", () => {
    expect(VIBE_SIMILARITY_SOURCE).not.toMatch(/topNotes|middleNotes|baseNotes|noteProminence|\.accords\b/);
  });

  it("does not mutate either input fragrance", () => {
    const a = perfume(1, ["warm", "elegant"]);
    const b = perfume(2, ["warm"]);
    const beforeA = JSON.stringify(a);
    const beforeB = JSON.stringify(b);
    compareVibeSimilarity(a, b);
    expect(JSON.stringify(a)).toBe(beforeA);
    expect(JSON.stringify(b)).toBe(beforeB);
  });
});
