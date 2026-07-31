import { DEFAULT_COMPOSER_STRATEGY_ID } from "./composerStrategies.js";

export const COMPOSER_WEIGHTED_DIMENSION_IDS = Object.freeze([
  "preferenceFit",
  "coverage",
  "diversity",
  "versatility",
  "coherence",
  "budgetEfficiency",
  "signatureFocus",
]);

export const COMPOSER_PENALTY_IDS = Object.freeze(["redundancyPenalty"]);

const STRATEGY_WEIGHT_DEFINITIONS = Object.freeze({
  balanced: freezeWeights({
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
  }),
  versatile: freezeWeights({
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
  }),
  explorer: freezeWeights({
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
  }),
  signature: freezeWeights({
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
  }),
});

export const COMPOSER_STRATEGY_WEIGHTS = Object.freeze(STRATEGY_WEIGHT_DEFINITIONS);
export const MAX_BUDGET_EFFICIENCY_WEIGHT = 0.05;

export function getComposerStrategyWeights(strategyId) {
  return (
    STRATEGY_WEIGHT_DEFINITIONS[strategyId] ||
    STRATEGY_WEIGHT_DEFINITIONS[DEFAULT_COMPOSER_STRATEGY_ID]
  );
}

function freezeWeights(weights) {
  return Object.freeze({
    dimensions: Object.freeze({ ...weights.dimensions }),
    penalties: Object.freeze({ ...weights.penalties }),
  });
}
