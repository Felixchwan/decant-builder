import { describe, expect, it } from "vitest";

import { fragrances as catalogFragrances } from "@discovery-box/catalog";
import {
  DEFAULT_MIN_SUPPORT,
  buildNoteRelationships,
  getPerfumeNoteIds,
  getSupportedNoteRelationships,
  sortByHighestJaccard,
  sortByHighestLift,
  sortByHighestSupport,
} from "./noteRelationships.js";

// Hand-verifiable synthetic dataset (N = 6), chosen so every metric below
// can be checked by hand, not just re-derived by a second implementation:
//
//   F1: rose, oud
//   F2: rose, oud
//   F3: rose, oud
//   F4: rose, vanilla
//   F5: musk
//   F6: musk, vanilla
//
// countRose = 4, countOud = 3, countVanilla = 2, countMusk = 2
//
// Only three note pairs ever co-occur:
//   oud   & rose    -> support 3 (F1, F2, F3)
//   rose  & vanilla -> support 1 (F4)
//   musk  & vanilla -> support 1 (F6)
// (musk never co-occurs with oud or rose; oud never co-occurs with vanilla.)
function perfume(id, noteIds) {
  return { id, topNotes: noteIds, middleNotes: [], baseNotes: [], generalNotes: [] };
}

const SYNTHETIC_FRAGRANCES = [
  perfume(1, ["rose", "oud"]),
  perfume(2, ["rose", "oud"]),
  perfume(3, ["rose", "oud"]),
  perfume(4, ["rose", "vanilla"]),
  perfume(5, ["musk"]),
  perfume(6, ["musk", "vanilla"]),
];

function findRelationship(relationships, noteA, noteB) {
  return relationships.find(
    (relationship) =>
      (relationship.noteA === noteA && relationship.noteB === noteB) ||
      (relationship.noteA === noteB && relationship.noteB === noteA)
  );
}

describe("getPerfumeNoteIds", () => {
  it("counts a note appearing in more than one pyramid location for the same fragrance only once", () => {
    const perfumeWithDuplicateNote = {
      id: 900,
      topNotes: ["rose"],
      middleNotes: ["rose"],
      baseNotes: ["oud"],
      generalNotes: [],
    };
    const relationships = buildNoteRelationships([perfumeWithDuplicateNote]);

    // rose appears twice in the raw pyramid but must collapse to a single
    // membership -- so rose/oud co-occurrence support is 1, not 2, and
    // rose's own frequency is 1, not 2.
    const roseOud = findRelationship(relationships, "rose", "oud");
    expect(roseOud.supportCount).toBe(1);
    expect(roseOud.frequencyA).toBe(1);
    expect(roseOud.frequencyB).toBe(1);
  });

  it("flattens topNotes/middleNotes/baseNotes/generalNotes without deduplicating by itself (dedup happens in buildNoteRelationships)", () => {
    const ids = getPerfumeNoteIds({
      topNotes: ["a"],
      middleNotes: ["a", "b"],
      baseNotes: ["c"],
      generalNotes: ["d"],
    });
    expect(ids).toEqual(["a", "a", "b", "c", "d"]);
  });
});

describe("buildNoteRelationships -- synthetic dataset", () => {
  const relationships = buildNoteRelationships(SYNTHETIC_FRAGRANCES);

  it("produces exactly the three real co-occurring pairs, no more, no fewer", () => {
    expect(relationships).toHaveLength(3);
    expect(findRelationship(relationships, "oud", "rose")).toBeTruthy();
    expect(findRelationship(relationships, "rose", "vanilla")).toBeTruthy();
    expect(findRelationship(relationships, "musk", "vanilla")).toBeTruthy();
    expect(findRelationship(relationships, "musk", "oud")).toBeUndefined();
    expect(findRelationship(relationships, "oud", "vanilla")).toBeUndefined();
  });

  it("uses stable canonical (noteA, noteB) ordering -- A/B and B/A are the same relationship, never duplicated", () => {
    const oudRose = relationships.find((r) => r.noteA === "oud" && r.noteB === "rose");
    expect(oudRose).toBeTruthy();
    // The reverse orientation must never appear as a second entry.
    expect(relationships.find((r) => r.noteA === "rose" && r.noteB === "oud")).toBeUndefined();
  });

  it("computes the exact hand-verified statistics for oud & rose (support 3)", () => {
    const oudRose = findRelationship(relationships, "oud", "rose");
    expect(oudRose.supportCount).toBe(3);
    expect(oudRose.frequencyA).toBe(3); // oud
    expect(oudRose.frequencyB).toBe(4); // rose
    expect(oudRose.conditionalProbabilityA_given_B).toBeCloseTo(3 / 4, 10); // P(oud|rose)
    expect(oudRose.conditionalProbabilityB_given_A).toBeCloseTo(3 / 3, 10); // P(rose|oud)
    expect(oudRose.jaccard).toBeCloseTo(3 / (3 + 4 - 3), 10); // 0.75
    expect(oudRose.lift).toBeCloseTo(3 / ((3 * 4) / 6), 10); // 1.5
  });

  it("computes the exact hand-verified statistics for rose & vanilla (support 1, lift below 1)", () => {
    const roseVanilla = findRelationship(relationships, "rose", "vanilla");
    expect(roseVanilla.supportCount).toBe(1);
    expect(roseVanilla.frequencyA).toBe(4); // rose
    expect(roseVanilla.frequencyB).toBe(2); // vanilla
    expect(roseVanilla.conditionalProbabilityA_given_B).toBeCloseTo(1 / 2, 10); // P(rose|vanilla)
    expect(roseVanilla.conditionalProbabilityB_given_A).toBeCloseTo(1 / 4, 10); // P(vanilla|rose)
    expect(roseVanilla.jaccard).toBeCloseTo(1 / (4 + 2 - 1), 10); // 0.2
    expect(roseVanilla.lift).toBeCloseTo(1 / ((4 * 2) / 6), 10); // 0.75 -- co-occur less than chance
  });

  it("computes the exact hand-verified statistics for musk & vanilla (support 1, but lift 1.5 -- illustrates lift is not simply proportional to support)", () => {
    const muskVanilla = findRelationship(relationships, "musk", "vanilla");
    expect(muskVanilla.supportCount).toBe(1);
    expect(muskVanilla.frequencyA).toBe(2); // musk
    expect(muskVanilla.frequencyB).toBe(2); // vanilla
    expect(muskVanilla.jaccard).toBeCloseTo(1 / (2 + 2 - 1), 10); // 0.3333...
    expect(muskVanilla.lift).toBeCloseTo(1 / ((2 * 2) / 6), 10); // 1.5, same as oud/rose despite far less support
  });

  it("does not mutate the input fragrance objects or array", () => {
    const beforeSnapshot = JSON.stringify(SYNTHETIC_FRAGRANCES);
    buildNoteRelationships(SYNTHETIC_FRAGRANCES);
    expect(JSON.stringify(SYNTHETIC_FRAGRANCES)).toBe(beforeSnapshot);
  });

  it("is zero-division safe -- no relationship ever contains NaN or Infinity", () => {
    relationships.forEach((relationship) => {
      for (const key of [
        "conditionalProbabilityA_given_B",
        "conditionalProbabilityB_given_A",
        "jaccard",
        "lift",
      ]) {
        expect(Number.isFinite(relationship[key]), `${key} on ${relationship.noteA}/${relationship.noteB}`).toBe(
          true
        );
      }
    });
  });

  it("is zero-division safe even for a note with zero frequency (degenerate/defensive case)", () => {
    const emptyRelationships = buildNoteRelationships([]);
    expect(emptyRelationships).toEqual([]);

    const singleFragranceNoPairs = buildNoteRelationships([perfume(1, ["rose"])]);
    expect(singleFragranceNoPairs).toEqual([]);
  });
});

describe("getSupportedNoteRelationships", () => {
  const relationships = buildNoteRelationships(SYNTHETIC_FRAGRANCES);

  it("keeps the full raw relationship set intact in buildNoteRelationships -- filtering happens only in this separate helper", () => {
    expect(relationships).toHaveLength(3); // includes the two support-1 pairs
  });

  it("defaults to minSupport 3, matching DEFAULT_MIN_SUPPORT", () => {
    expect(DEFAULT_MIN_SUPPORT).toBe(3);
    const supported = getSupportedNoteRelationships(relationships);
    expect(supported).toHaveLength(1);
    expect(supported[0].noteA).toBe("oud");
    expect(supported[0].noteB).toBe("rose");
  });

  it("accepts a configurable minSupport", () => {
    expect(getSupportedNoteRelationships(relationships, { minSupport: 1 })).toHaveLength(3);
    expect(getSupportedNoteRelationships(relationships, { minSupport: 2 })).toHaveLength(1);
    expect(getSupportedNoteRelationships(relationships, { minSupport: 4 })).toHaveLength(0);
  });
});

describe("sort helpers -- deterministic ordering", () => {
  const relationships = buildNoteRelationships(SYNTHETIC_FRAGRANCES);

  it("sortByHighestSupport orders oud/rose first (support 3) over the two support-1 pairs", () => {
    const sorted = sortByHighestSupport(relationships);
    expect(sorted[0].noteA).toBe("oud");
    expect(sorted[0].noteB).toBe("rose");
    expect(sorted[0].supportCount).toBe(3);
  });

  it("sortByHighestLift breaks a real tie (musk/vanilla and oud/rose both lift 1.5) with ascending canonical note-key order", () => {
    const sorted = sortByHighestLift(relationships);
    // oud/rose (lift 1.5) and musk/vanilla (lift 1.5) tie; "musk" < "oud"
    // alphabetically, so musk/vanilla must come first on a stable,
    // canonical-key tie-break.
    expect(sorted[0].noteA).toBe("musk");
    expect(sorted[0].noteB).toBe("vanilla");
    expect(sorted[0].lift).toBeCloseTo(1.5, 10);
    expect(sorted[1].noteA).toBe("oud");
    expect(sorted[1].noteB).toBe("rose");
    expect(sorted[1].lift).toBeCloseTo(1.5, 10);
    // rose/vanilla (lift 0.75) is last.
    expect(sorted[2].noteA).toBe("rose");
    expect(sorted[2].noteB).toBe("vanilla");
  });

  it("sortByHighestJaccard orders oud/rose (0.75) first, then musk/vanilla (0.333...), then rose/vanilla (0.2)", () => {
    const sorted = sortByHighestJaccard(relationships);
    expect(sorted.map((r) => [r.noteA, r.noteB])).toEqual([
      ["oud", "rose"],
      ["musk", "vanilla"],
      ["rose", "vanilla"],
    ]);
  });

  it("is deterministic -- repeated calls on the same input produce identical order", () => {
    const first = sortByHighestLift(relationships).map((r) => `${r.noteA}/${r.noteB}`);
    const second = sortByHighestLift(relationships).map((r) => `${r.noteA}/${r.noteB}`);
    expect(first).toEqual(second);
  });

  it("does not mutate the array passed in", () => {
    const original = buildNoteRelationships(SYNTHETIC_FRAGRANCES);
    const originalOrder = original.map((r) => `${r.noteA}/${r.noteB}`);
    sortByHighestLift(original);
    expect(original.map((r) => `${r.noteA}/${r.noteB}`)).toEqual(originalOrder);
  });
});

// Broad, stable, live-catalog invariants only -- not a giant snapshot of
// every pair's exact numbers (that would be exactly the kind of brittle,
// uninformative test this phase's own research/production boundary is
// designed to avoid encouraging). These numbers come directly from the
// live catalog audit performed before this phase was implemented.
describe("buildNoteRelationships -- live catalog regression (broad invariants only)", () => {
  const relationships = buildNoteRelationships(catalogFragrances);

  it("has exactly 87 catalog fragrances to compute over", () => {
    expect(catalogFragrances).toHaveLength(87);
  });

  it("produces a total co-occurring-pair count in the range confirmed by the live audit (~2,155)", () => {
    expect(relationships.length).toBeGreaterThan(2000);
    expect(relationships.length).toBeLessThan(2300);
  });

  it("has a singleton-support majority in the range confirmed by the live audit (~1,517 of ~2,155, i.e. roughly 70%)", () => {
    const singletonCount = relationships.filter((r) => r.supportCount === 1).length;
    const singletonRatio = singletonCount / relationships.length;
    expect(singletonRatio).toBeGreaterThan(0.6);
    expect(singletonRatio).toBeLessThan(0.8);
  });

  it("has a supported (>= default minSupport) pair count in the range confirmed by the live audit (~309)", () => {
    const supported = getSupportedNoteRelationships(relationships);
    expect(supported.length).toBeGreaterThan(250);
    expect(supported.length).toBeLessThan(370);
  });

  it("confirms raw top-support rankings are dominated by a high-frequency note (bergamot), motivating lift over raw support", () => {
    const topBySupport = sortByHighestSupport(relationships).slice(0, 5);
    const involvesBergamot = topBySupport.filter((r) => r.noteA === "bergamot" || r.noteB === "bergamot");
    expect(involvesBergamot.length).toBeGreaterThan(0);
  });

  it("does not mutate the live catalog array or its fragrance objects", () => {
    const beforeSnapshot = JSON.stringify(catalogFragrances);
    buildNoteRelationships(catalogFragrances);
    expect(JSON.stringify(catalogFragrances)).toBe(beforeSnapshot);
  });
});
