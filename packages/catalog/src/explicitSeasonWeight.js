import { SEASON_WEIGHTS_BY_ID } from "./fragrances.js";

// The editorial season weight for one fragrance and one season, or null when no
// editorial judgment exists for that pair.
//
// Every fragrance exposes a merged `seasonWeights` object, but for a fragrance
// with no hand-written entry the catalog fills it with a synthesized default
// (6 for each declared season, 0 elsewhere). That default is a placeholder, not
// a judgment, and nothing on the merged object says which kind it is. Consumers
// that must tell the two apart -- for example to rank only what has been
// scored -- ask here instead of guessing from the numbers.
//
// null means "unscored": never 0, never derived from the fragrance's declared
// `seasons`, and never a reason to include or exclude a fragrance from a
// season (compatibility is the `seasons` list's job alone). A real editorial
// weight of 0 is returned as 0.
//
// Keyed by fragrance id so it stays independent of any merchant catalog subset.
export function getExplicitSeasonWeight(fragranceId, season) {
  const entry = SEASON_WEIGHTS_BY_ID[fragranceId];
  if (!entry || !Object.hasOwn(entry, season)) {
    return null;
  }

  const weight = entry[season];
  return typeof weight === "number" && Number.isFinite(weight) ? weight : null;
}
