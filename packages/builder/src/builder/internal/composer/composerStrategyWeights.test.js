import { describe, expect, it } from "vitest";

import {
  COMPOSER_PENALTY_IDS,
  COMPOSER_STRATEGY_WEIGHTS,
  COMPOSER_WEIGHTED_DIMENSION_IDS,
  MAX_BUDGET_EFFICIENCY_WEIGHT,
  getComposerStrategyWeights,
} from "./composerStrategyWeights.js";

const STRATEGY_IDS = ["balanced", "versatile", "explorer", "signature"];

describe("composerStrategyWeights", () => {
  it("exposes exact stable dimension, penalty, and strategy weight contracts", () => {
    expect(COMPOSER_WEIGHTED_DIMENSION_IDS).toEqual([
      "preferenceFit",
      "coverage",
      "diversity",
      "versatility",
      "coherence",
      "budgetEfficiency",
      "signatureFocus",
    ]);
    expect(COMPOSER_PENALTY_IDS).toEqual(["redundancyPenalty"]);
    expect(Object.keys(COMPOSER_STRATEGY_WEIGHTS)).toEqual(STRATEGY_IDS);
    expect(COMPOSER_STRATEGY_WEIGHTS).toEqual({
      balanced: {
        dimensions: {
          preferenceFit: 0.14,
          coverage: 0.22,
          diversity: 0.15,
          versatility: 0.18,
          coherence: 0.22,
          budgetEfficiency: 0.04,
          signatureFocus: 0.05,
        },
        penalties: {
          redundancyPenalty: 0.18,
        },
      },
      versatile: {
        dimensions: {
          preferenceFit: 0.18,
          coverage: 0.24,
          diversity: 0.08,
          versatility: 0.32,
          coherence: 0.14,
          budgetEfficiency: 0.04,
          signatureFocus: 0,
        },
        penalties: {
          redundancyPenalty: 0.14,
        },
      },
      explorer: {
        dimensions: {
          preferenceFit: 0.16,
          coverage: 0.22,
          diversity: 0.32,
          versatility: 0.12,
          coherence: 0.12,
          budgetEfficiency: 0.03,
          signatureFocus: 0.03,
        },
        penalties: {
          redundancyPenalty: 0.1,
        },
      },
      signature: {
        dimensions: {
          preferenceFit: 0.16,
          coverage: 0.02,
          diversity: 0.1,
          versatility: 0.12,
          coherence: 0.28,
          budgetEfficiency: 0.05,
          signatureFocus: 0.27,
        },
        penalties: {
          redundancyPenalty: 0.16,
        },
      },
    });
  });

  it("keeps positive weights normalized and budget efficiency capped for every strategy", () => {
    STRATEGY_IDS.forEach((strategyId) => {
      const weights = getComposerStrategyWeights(strategyId);
      const positiveSum = Object.values(weights.dimensions).reduce(
        (sum, weight) => sum + weight,
        0
      );

      expect(positiveSum).toBeCloseTo(1, 8);
      expect(weights.dimensions.budgetEfficiency).toBeLessThanOrEqual(
        MAX_BUDGET_EFFICIENCY_WEIGHT
      );
    });
  });

  it("falls back to balanced for unknown or missing strategy IDs", () => {
    expect(getComposerStrategyWeights("missing")).toBe(getComposerStrategyWeights("balanced"));
    expect(getComposerStrategyWeights("")).toBe(getComposerStrategyWeights("balanced"));
    expect(getComposerStrategyWeights(null)).toBe(getComposerStrategyWeights("balanced"));
    expect(getComposerStrategyWeights(undefined)).toBe(getComposerStrategyWeights("balanced"));
  });

  it("resists external mutation and remains deterministic", () => {
    expect(Object.isFrozen(COMPOSER_STRATEGY_WEIGHTS)).toBe(true);

    STRATEGY_IDS.forEach((strategyId) => {
      const weights = getComposerStrategyWeights(strategyId);

      expect(Object.isFrozen(weights)).toBe(true);
      expect(Object.isFrozen(weights.dimensions)).toBe(true);
      expect(Object.isFrozen(weights.penalties)).toBe(true);
      expect(getComposerStrategyWeights(strategyId)).toBe(weights);
    });
  });
});
