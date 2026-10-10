import { describe, expect, it } from "vitest";

import {
  SEASON_BALANCED_MIN_SCORE,
  SEASON_BALANCE_FULL_RATIO,
  SEASON_IDS,
  SEASON_LEVEL_BANDS,
  areAdjacentSeasons,
  buildSeasonalEvidence,
  describeSeasonalLevels,
  getSeasonCoverageBand,
  getSeasonStrengthLevel,
  scoreToStars,
} from "./seasonalEvidence.js";

// strengths are SUMS of 0-10 weights over the box, so level = strength / (box size * 10)
const evidence = (seasonStrengths, selectedCount) => buildSeasonalEvidence({ seasonStrengths, selectedCount });

describe("seasonal levels", () => {
  it("is the mean season weight as a percentage, so box size does not matter", () => {
    const small = evidence({ spring: 40, summer: 50, fall: 10, winter: 0 }, 6);
    const large = evidence({ spring: 80, summer: 100, fall: 20, winter: 0 }, 12);

    expect(small.levels).toEqual({ spring: 67, summer: 83, fall: 17, winter: 0 });
    expect(large.levels).toEqual(small.levels);
    expect(large.balanceScore).toBe(small.balanceScore);
    expect(large.shape).toEqual(small.shape);
    expect(large.gaps).toEqual(small.gaps);
  });

  it("clamps to 0-100 and reads an empty box as empty, never as 200%", () => {
    expect(evidence({ spring: 50 }, 2).levels.spring).toBe(100);
    const empty = evidence({ spring: 5 }, 0);

    expect(empty.isEmpty).toBe(true);
    expect(empty.levels).toEqual({ spring: 0, summer: 0, fall: 0, winter: 0 });
    expect(empty.balanceScore).toBe(0);
    expect(empty.shape).toEqual({ kind: "empty", seasons: [] });
  });
});

describe("season balance: how evenly the box serves the four seasons", () => {
  it("is the weakest season relative to the strongest, scaled so the most even real box reads as full", () => {
    // levels 85 / 85 / 85 / 72: ratio 0.847 ~ the full-balance ratio
    expect(evidence({ spring: 85, summer: 85, fall: 85, winter: 72 }, 10).balanceScore).toBe(100);
    // weakest is half the strongest: 0.5 / 0.85
    expect(evidence({ spring: 80, summer: 80, fall: 40, winter: 40 }, 10).balanceScore).toBe(Math.round((100 * 0.5) / SEASON_BALANCE_FULL_RATIO));
    // a season at zero is zero balance, however strong the others are
    expect(evidence({ spring: 90, summer: 90, fall: 90, winter: 0 }, 10).balanceScore).toBe(0);
  });

  it("does not award anything for a season merely being non-zero (the old 45-point presence bonus)", () => {
    // a Spring/Summer specialist whose every fragrance carries a token Fall/Winter weight
    const specialist = evidence({ spring: 80, summer: 90, fall: 20, winter: 8 }, 10);

    expect(specialist.levels.winter).toBeGreaterThan(0);
    expect(specialist.balanceScore).toBeLessThan(20);
    expect(specialist.stars).toBe(1);
    expect(specialist.isBalanced).toBe(false);
  });

  it("cannot be lifted out of the bottom by one small contribution to the missing season", () => {
    const before = evidence({ spring: 80, summer: 90, fall: 20, winter: 5 }, 10).balanceScore;
    const after = evidence({ spring: 80, summer: 90, fall: 20, winter: 15 }, 10).balanceScore;

    // ten more points of winter level (5 -> 15) is worth about 13 points of 100: a nudge, not a different box
    expect(after - before).toBeLessThanOrEqual(15);
    expect(after).toBeLessThan(SEASON_BALANCED_MIN_SCORE);
  });

  it("uses the full range, and 4-5 stars is exactly 'balanced'", () => {
    const scores = [
      evidence({ spring: 90, summer: 90, fall: 5, winter: 5 }, 10),
      evidence({ spring: 80, summer: 80, fall: 40, winter: 24 }, 10),
      evidence({ spring: 60, summer: 70, fall: 50, winter: 45 }, 10),
      evidence({ spring: 60, summer: 62, fall: 58, winter: 55 }, 10),
    ].map(({ stars, isBalanced }) => ({ stars, isBalanced }));

    expect(scores.map(({ stars }) => stars)).toEqual([1, 2, 4, 5]);
    expect(scores.map(({ isBalanced }) => isBalanced)).toEqual([false, false, true, true]);
    expect(SEASON_BALANCED_MIN_SCORE).toBe(3 * 20 + 1);
  });
});

describe("season shape (the text under the radar)", () => {
  it("is described from the same levels as the stars", () => {
    expect(evidence({ spring: 60, summer: 62, fall: 58, winter: 55 }, 10).shape).toEqual({
      kind: "balanced",
      seasons: [...SEASON_IDS],
    });
    expect(evidence({ spring: 80, summer: 82, fall: 15, winter: 5 }, 10).shape).toEqual({
      kind: "pair",
      seasons: ["spring", "summer"],
    });
    expect(evidence({ spring: 40, summer: 90, fall: 10, winter: 0 }, 10).shape).toEqual({
      kind: "single",
      seasons: ["summer"],
    });
  });

  it("treats winter and spring as neighbours on the season cycle", () => {
    expect(areAdjacentSeasons("winter", "spring")).toBe(true);
    expect(areAdjacentSeasons("spring", "summer")).toBe(true);
    expect(areAdjacentSeasons("spring", "fall")).toBe(false);
    expect(areAdjacentSeasons("spring", "spring")).toBe(false);
    expect(evidence({ spring: 80, summer: 5, fall: 5, winter: 82 }, 10).shape).toEqual({
      kind: "pair",
      seasons: ["spring", "winter"],
    });
  });

  it("is never 'balanced' when the stars say the box is not (shape and stars cannot disagree)", () => {
    for (let spring = 0; spring <= 100; spring += 10) {
      for (let winter = 0; winter <= 100; winter += 10) {
        const result = describeSeasonalLevels({ spring, summer: 70, fall: 60, winter });

        expect(result.shape.kind === "balanced").toBe(result.stars >= 4);
      }
    }
  });
});

describe("coverage bands", () => {
  it("share the radar's lines: strong from 50, covered from 30, a gap below 30", () => {
    expect([49, 50, 29, 30].map(getSeasonCoverageBand)).toEqual(["covered", "strong", "gap", "covered"]);
    expect(SEASON_LEVEL_BANDS).toEqual({ dominant: 90, excellent: 70, strong: 50, moderate: 30 });
    expect([95, 75, 55, 35, 5].map(getSeasonStrengthLevel)).toEqual(["Dominant", "Excellent", "Strong", "Moderate", "Weak"]);
  });

  it("lists gaps weakest first, and an empty box has all four", () => {
    expect(evidence({ spring: 90, summer: 80, fall: 20, winter: 5 }, 10).gaps).toEqual(["winter", "fall"]);
    expect(evidence({}, 0).gaps).toEqual(["winter", "fall", "summer", "spring"]);
  });
});

describe("stars", () => {
  it("are equal 20-point bands, and 0 stays 0", () => {
    expect([0, 1, 20, 21, 40, 41, 60, 61, 80, 81, 100].map(scoreToStars)).toEqual([0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5]);
    expect(scoreToStars(Number.NaN)).toBe(0);
    expect(scoreToStars(-5)).toBe(0);
  });
});
