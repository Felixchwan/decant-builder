// EvidenceRevisit -- a read model built on top of LearnerRecord (Phase 4.0),
// not directly over persisted state. Answers exactly one deterministic
// question: "what prior learner-authored evidence exists for this
// fragrance?" Pure, synchronous, takes an already-built LearnerRecord and one
// fragranceId -- no storage access, no catalog lookup, no inference. See the
// approved Phase 4.0 plan.
//
// This is evidence retrieval, not interpretation: repeated encounters,
// repeated Observations, and repeated Comparisons all remain exactly as
// repeated as LearnerRecord already represents them. Nothing here merges,
// deduplicates, scores, or summarizes. It answers "what happened," never
// "what does this mean about the learner."
//
// Ordering is inherited, not recomputed: learnerRecord.encounters and
// learnerRecord.comparisons are already newest-first, and each encounter's
// own .observations is already oldest-first (see learnerRecord.js) --
// filtering preserves relative order, so no new sort is applied here.
//
// Encounter-only vs. learner-authored-evidence distinction (mirrors the
// Phase 3.1 presentation correction, at the read-model layer this time):
// EncounterInstances created solely as Comparison infrastructure (zero
// Observations) remain in `encounters` as real factual history, but do not
// by themselves make `hasPriorEvidence` true.

export function buildEvidenceRevisit({ learnerRecord, fragranceId }) {
  const encounters = learnerRecord.encounters
    .filter((encounter) => encounter.fragranceId === fragranceId)
    .map((encounter) => ({
      encounterInstanceId: encounter.encounterInstanceId,
      fragranceId: encounter.fragranceId,
      fragranceDisplaySnapshot: encounter.fragranceDisplaySnapshot,
      createdAt: encounter.createdAt,
      observations: encounter.observations.map((observation) => ({ ...observation })),
    }));

  const comparisons = learnerRecord.comparisons
    .filter(
      (comparison) =>
        comparison.firstEncounter?.fragranceId === fragranceId ||
        comparison.secondEncounter?.fragranceId === fragranceId
    )
    .map((comparison) => ({
      comparisonId: comparison.comparisonId,
      freeText: comparison.freeText,
      createdAt: comparison.createdAt,
      firstEncounter: comparison.firstEncounter ? { ...comparison.firstEncounter } : null,
      secondEncounter: comparison.secondEncounter ? { ...comparison.secondEncounter } : null,
    }));

  const hasPriorEvidence =
    encounters.some((encounter) => encounter.observations.length > 0) || comparisons.length > 0;

  return {
    fragranceId,
    hasPriorEvidence,
    encounters,
    comparisons,
  };
}
