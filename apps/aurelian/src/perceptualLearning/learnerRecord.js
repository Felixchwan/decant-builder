// LearnerRecord -- the first Perceptual Learning read model (Phase 3.0). Named
// to match the frozen conceptual domain model's own naming
// (docs/domain/PERCEPTUAL_LEARNING_DOMAIN_MODEL.md §5: "un modelo de lectura
// conceptual (Read Model)... no protege ningún invariante transaccional
// propio"). Pure, synchronous, derived entirely from already-validated state
// (as returned by loadPerceptualLearningState) -- never persisted itself,
// never touches storage, never consults the live catalog. See ADR-0021,
// ADR-0022, and the approved Phase 3.0 investigation report.
//
// Exposes only fields directly traceable to persisted evidence -- no
// formatted copy, no counts, no inferred/profile/capability fields. That
// epistemic boundary is enforced structurally (see learnerRecord.test.js's
// exact-shape assertions), not by scanning output text for forbidden
// vocabulary.

export function buildLearnerRecord(state) {
  const { encounterInstances, observations, comparisons } = state;

  const encounterById = new Map(
    encounterInstances.map((encounter) => [encounter.encounterInstanceId, encounter])
  );

  const observationsByEncounterId = new Map();
  for (const observation of observations) {
    const bucket = observationsByEncounterId.get(observation.encounterInstanceId);
    if (bucket) {
      bucket.push(observation);
    } else {
      observationsByEncounterId.set(observation.encounterInstanceId, [observation]);
    }
  }

  const encounterProjections = encounterInstances
    .map((encounter) =>
      projectEncounter(encounter, observationsByEncounterId.get(encounter.encounterInstanceId) ?? [])
    )
    .sort(byCreatedAtDescending);

  const comparisonProjections = comparisons
    .map((comparison) => ({
      comparisonId: comparison.comparisonId,
      freeText: comparison.freeText,
      createdAt: comparison.createdAt,
      firstEncounter: projectEncounterReference(encounterById.get(comparison.firstEncounterInstanceId)),
      secondEncounter: projectEncounterReference(encounterById.get(comparison.secondEncounterInstanceId)),
    }))
    .sort(byCreatedAtDescending);

  return {
    learnerId: state.learnerId ?? null,
    hasEvidence: observations.length > 0 || comparisons.length > 0,
    encounters: encounterProjections,
    comparisons: comparisonProjections,
  };
}

function projectEncounter(encounter, observationsForEncounter) {
  return {
    encounterInstanceId: encounter.encounterInstanceId,
    fragranceId: encounter.fragranceId,
    fragranceDisplaySnapshot: encounter.fragranceDisplaySnapshot,
    createdAt: encounter.createdAt,
    observations: [...observationsForEncounter]
      .sort(byCreatedAtAscending)
      .map((observation) => ({
        observationId: observation.observationId,
        moment: observation.moment,
        freeText: observation.freeText,
        createdAt: observation.createdAt,
      })),
  };
}

// Cannot and does not throw when a Comparison's referenced encounter is
// absent -- loadPerceptualLearningState's own referential-integrity
// filtering should already prevent this in real persisted state, but this
// function accepts any validated-shaped state, including hand-built test
// fixtures, and must degrade to null rather than crash.
//
// Includes createdAt (Phase 6.0) so presentation can disambiguate a
// same-fragrance Comparison pair by date -- without it, two sides of a
// temporal (same-fragrance) Comparison render as visually identical
// fragrance names with nothing to tell them apart. Purely additive: no
// existing consumer of this shape reads or is affected by the new field.
function projectEncounterReference(encounter) {
  if (!encounter) {
    return null;
  }

  return {
    encounterInstanceId: encounter.encounterInstanceId,
    fragranceId: encounter.fragranceId,
    fragranceDisplaySnapshot: encounter.fragranceDisplaySnapshot,
    createdAt: encounter.createdAt,
  };
}

function byCreatedAtAscending(a, b) {
  if (a.createdAt < b.createdAt) return -1;
  if (a.createdAt > b.createdAt) return 1;
  return 0;
}

function byCreatedAtDescending(a, b) {
  return byCreatedAtAscending(b, a);
}
