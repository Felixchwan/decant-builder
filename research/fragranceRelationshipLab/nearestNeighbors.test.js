import { describe, expect, it } from "vitest";

import { findNearestNeighbors } from "./nearestNeighbors.js";

function perfume(id, name) {
  return { id, name };
}

function scoreByFixedTable(table) {
  return (anchor, candidate) => ({ score: table[candidate.id] ?? 0, note: `candidate ${candidate.id}` });
}

describe("findNearestNeighbors -- signal-agnostic ranking helper", () => {
  const anchor = perfume(1, "Anchor");
  const catalog = [anchor, perfume(2, "B"), perfume(3, "C"), perfume(4, "D")];

  it("excludes the anchor itself from the results", () => {
    const results = findNearestNeighbors(anchor, catalog, scoreByFixedTable({ 2: 0.5, 3: 0.9, 4: 0.1 }));
    expect(results.some((r) => r.candidate.id === anchor.id)).toBe(false);
    expect(results).toHaveLength(3);
  });

  it("sorts strictly descending by score", () => {
    const results = findNearestNeighbors(anchor, catalog, scoreByFixedTable({ 2: 0.5, 3: 0.9, 4: 0.1 }));
    expect(results.map((r) => r.candidate.id)).toEqual([3, 2, 4]);
    expect(results.map((r) => r.score)).toEqual([0.9, 0.5, 0.1]);
  });

  it("breaks ties deterministically by ascending fragrance id", () => {
    // candidates 3 and 4 tie at 0.5; candidate 2 is lower.
    const results = findNearestNeighbors(anchor, catalog, scoreByFixedTable({ 2: 0.1, 3: 0.5, 4: 0.5 }));
    expect(results.map((r) => r.candidate.id)).toEqual([3, 4, 2]);
  });

  it("is deterministic across repeated calls", () => {
    const scoreFn = scoreByFixedTable({ 2: 0.5, 3: 0.5, 4: 0.5 });
    const first = findNearestNeighbors(anchor, catalog, scoreFn).map((r) => r.candidate.id);
    const second = findNearestNeighbors(anchor, catalog, scoreFn).map((r) => r.candidate.id);
    expect(first).toEqual(second);
  });

  it("preserves every field the scoring function returns, not just score", () => {
    const results = findNearestNeighbors(anchor, catalog, scoreByFixedTable({ 2: 0.5, 3: 0.9, 4: 0.1 }));
    results.forEach((result) => {
      expect(result).toHaveProperty("note");
      expect(result.note).toBe(`candidate ${result.candidate.id}`);
    });
  });

  it("treats a null score (e.g. Signal D's zero-mutual-evidence case) as sorting after every real score, without discarding the entry", () => {
    const scoreFn = (a, candidate) => ({ score: candidate.id === 4 ? null : 0.1 });
    const results = findNearestNeighbors(anchor, catalog, scoreFn);
    expect(results).toHaveLength(3); // candidate 4 still present
    expect(results[results.length - 1].candidate.id).toBe(4);
    expect(results[results.length - 1].score).toBeNull(); // score itself is never rewritten
  });

  it("places the anchor at any catalog position without affecting exclusion or ranking", () => {
    const reordered = [perfume(4, "D"), perfume(3, "C"), anchor, perfume(2, "B")];
    const results = findNearestNeighbors(anchor, reordered, scoreByFixedTable({ 2: 0.5, 3: 0.9, 4: 0.1 }));
    expect(results.map((r) => r.candidate.id)).toEqual([3, 2, 4]);
  });

  it("does not mutate the catalog array or its fragrance objects", () => {
    const beforeSnapshot = JSON.stringify(catalog);
    findNearestNeighbors(anchor, catalog, scoreByFixedTable({ 2: 0.5, 3: 0.9, 4: 0.1 }));
    expect(JSON.stringify(catalog)).toBe(beforeSnapshot);
  });

  it("has no awareness of Composer or recommendations in its actual code -- only in its own explanatory comments", async () => {
    const { readFileSync } = await import("node:fs");
    const source = readFileSync(new URL("./nearestNeighbors.js", import.meta.url), "utf8");
    const codeOnly = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
    expect(codeOnly).not.toMatch(/composer|recommendation/i);
  });
});
