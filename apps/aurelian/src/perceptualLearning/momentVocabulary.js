// Canonical Observation.moment values for Phase 1, kept deliberately
// separate from their presentation copy. Exactly two stages -- no
// perfumery jargon (opening/heart/drydown), no third stage.

export const OBSERVATION_MOMENTS = Object.freeze({
  INITIAL: "initial",
  LATER: "later",
});

export const OBSERVATION_MOMENT_VALUES = Object.freeze([
  OBSERVATION_MOMENTS.INITIAL,
  OBSERVATION_MOMENTS.LATER,
]);

// Illustrative es-MX copy -- Aurelian's own copy review may adjust wording;
// the two-value domain contract above is what's locked.
export const OBSERVATION_MOMENT_COPY = Object.freeze({
  [OBSERVATION_MOMENTS.INITIAL]: "Al aplicarlo",
  [OBSERVATION_MOMENTS.LATER]: "Más tarde",
});
