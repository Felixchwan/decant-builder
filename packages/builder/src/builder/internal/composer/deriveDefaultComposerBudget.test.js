import { describe, expect, it } from "vitest";
import { deriveDefaultComposerBudget } from "./deriveDefaultComposerBudget.js";

const CATALOG = [
  { id: 1, points: 1 },
  { id: 2, points: 1.5 },
  { id: 3, points: 2 },
  { id: 4, points: 4 },
];
const POINT_VALUE = 100;

describe("deriveDefaultComposerBudget", () => {
  it("covers an empty box: needs the full slot AND point minimum", () => {
    // 6 slots needed, cheapest item is 1pt -> 6pts from slots alone, but the
    // box also needs 12pts -> points is the binding constraint.
    const budget = deriveDefaultComposerBudget({
      catalog: CATALOG,
      missingSlots: 6,
      missingPoints: 12,
      pointValue: POINT_VALUE,
    });

    expect(budget).toBe(1200);
  });

  it("covers a partially filled box below both thresholds", () => {
    // 3 more slots and 8 more points needed; 3 cheap items only cover 3pts,
    // so the 8pt requirement is binding.
    const budget = deriveDefaultComposerBudget({
      catalog: CATALOG,
      missingSlots: 3,
      missingPoints: 8,
      pointValue: POINT_VALUE,
    });

    expect(budget).toBe(800);
  });

  it("covers enough slots but insufficient points", () => {
    const budget = deriveDefaultComposerBudget({
      catalog: CATALOG,
      missingSlots: 0,
      missingPoints: 5,
      pointValue: POINT_VALUE,
    });

    expect(budget).toBe(500);
  });

  it("covers enough points but insufficient slots", () => {
    // 4 more slots needed, cheapest item 1pt each -> 4pts, more than the 0
    // remaining points required.
    const budget = deriveDefaultComposerBudget({
      catalog: CATALOG,
      missingSlots: 4,
      missingPoints: 0,
      pointValue: POINT_VALUE,
    });

    expect(budget).toBe(400);
  });

  it("covers an already-eligible box: no artificial floor", () => {
    const budget = deriveDefaultComposerBudget({
      catalog: CATALOG,
      missingSlots: 0,
      missingPoints: 0,
      pointValue: POINT_VALUE,
    });

    expect(budget).toBe(0);
  });

  it("guarantees enough budget to satisfy both floors simultaneously, not just whichever is checked first", () => {
    // A budget sized only for missingSlots at the cheapest price (6pts) would
    // be short of the real 12pt requirement; the formula must pick the
    // larger of the two floors.
    const budget = deriveDefaultComposerBudget({
      catalog: CATALOG,
      missingSlots: 6,
      missingPoints: 12,
      pointValue: POINT_VALUE,
    });

    expect(budget).toBeGreaterThanOrEqual(6 * POINT_VALUE);
    expect(budget).toBeGreaterThanOrEqual(12 * POINT_VALUE);
  });

  it("returns an empty string when required inputs are not finite numbers", () => {
    expect(
      deriveDefaultComposerBudget({
        catalog: CATALOG,
        missingSlots: undefined,
        missingPoints: 12,
        pointValue: POINT_VALUE,
      })
    ).toBe("");
    expect(
      deriveDefaultComposerBudget({
        catalog: [],
        missingSlots: 6,
        missingPoints: 12,
        pointValue: POINT_VALUE,
      })
    ).toBe("");
  });
});
