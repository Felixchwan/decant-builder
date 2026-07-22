const STRATEGIES = Object.freeze([
  Object.freeze({
    id: "balanced",
    label: "Balanced",
    description: "Broad, coherent coverage across the collection.",
  }),
  Object.freeze({
    id: "versatile",
    label: "Versatile",
    description: "Prioritizes practical wearability across common contexts.",
  }),
  Object.freeze({
    id: "explorer",
    label: "Explorer",
    description: "Prioritizes variety, contrast, and discovery.",
  }),
  Object.freeze({
    id: "signature",
    label: "Signature",
    description: "Prioritizes stronger identity and premium focal selections.",
  }),
]);

const STRATEGY_BY_ID = Object.freeze(
  Object.fromEntries(STRATEGIES.map((strategy) => [strategy.id, strategy]))
);

export const DEFAULT_COMPOSER_STRATEGY_ID = "balanced";
export const COMPOSER_STRATEGIES = STRATEGIES;

export function getComposerStrategies() {
  return STRATEGIES;
}

export function getComposerStrategy(strategyId) {
  return STRATEGY_BY_ID[strategyId] || STRATEGY_BY_ID[DEFAULT_COMPOSER_STRATEGY_ID];
}
