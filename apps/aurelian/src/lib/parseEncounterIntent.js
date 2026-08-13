// Single Aurelian-owned source of truth for what an encounter-scoped deep
// link looks like (Phase 6.0 temporal comparison). Sibling to, not a
// replacement for, parseFragranceIntent.js: fragrance deep links pick a
// catalog item, encounter deep links pick one specific, already-persisted
// EncounterInstance -- two different domains of identifier (a small
// catalog integer vs. an opaque per-record id, see encounterInstance.js's
// createId), each parsed by its own small, pure, single-purpose file per
// this codebase's established convention.
//
// Deliberately does not validate that the id actually resolves to a real,
// eligible EncounterInstance -- that requires persisted state, which a
// pure URL parser must never touch. Existence and eligibility (Phase 6.0's
// "at least one Observation" invariant) are resolved downstream, against
// real state, by ComparisonCaptureFlow.jsx's own resolver and re-enforced
// again at createComparisonForExistingEncounters.js's use-case boundary.
export const ENCOUNTER_QUERY_PARAM = "encounter";

export function parseEncounterIntent(search = "") {
  const params = new URLSearchParams(search);
  const values = params.getAll(ENCOUNTER_QUERY_PARAM);

  if (values.length !== 1 || values[0].trim().length === 0) {
    return null;
  }

  return values[0];
}
