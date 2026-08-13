// The temporal-comparison use case (Phase 6.0): creates a Comparison
// referencing two EncounterInstances that ALREADY EXIST in persisted
// state, rather than minting two fresh ones. Contrast with
// createComparisonWithEncounters.js -- the general, different-fragrance
// use case, left completely untouched -- which unconditionally creates two
// brand-new EncounterInstances on every call and therefore can never
// reference real history. This is the missing capability the Phase 6.0
// investigation identified: the domain (comparison.js, ADR-0022) has
// always been able to reference any two distinct EncounterInstances, but
// no application-layer entry point could hand it two pre-existing ones
// until now.
//
// Enforces the Phase 6.0 eligibility invariant at THIS boundary, not
// merely in whichever UI happens to call it (per explicit instruction):
// both referenced EncounterInstances must (1) exist in persisted state,
// (2) belong to the resolved current learner, (3) be distinct from each
// other, and (4) carry at least one persisted Observation. This is
// deliberately an application-layer invariant for this one use case, NOT a
// change to comparison.js's general domain rule -- createComparisonWithEncounters
// remains free to produce a Comparison referencing a zero-Observation,
// infrastructure-only EncounterInstance exactly as before, because a fresh
// EncounterInstance is expected to have no Observation yet at the moment
// it's created. Only a comparison over EXISTING history requires that
// history to actually contain learner-authored evidence -- an
// EncounterInstance existing is not itself evidence (see
// evidenceRevisit.js's identical "encounter-only vs. learner-authored"
// distinction, applied here one layer down, at the point evidence is
// selected for a NEW comparison rather than merely displayed).
//
// All-or-nothing, mirroring createComparisonWithEncounters.js exactly: any
// failure -- ineligible encounter, invalid freeText, storage failure --
// returns persisted:false and leaves storage completely untouched. Unlike
// its sibling, every failure mode here (including createComparison's own
// factory throws) is normalized into that same { persisted: false }
// shape, rather than letting some throw and others return -- this use
// case is inherently more validation-heavy than its sibling, and a single
// uniform failure contract is simplest for the one caller (ComparisonCaptureFlow's
// handleSubmit) to check.

import { loadPerceptualLearningState, writePerceptualLearningState } from "./perceptualLearningPersistence.js";
import { createComparison } from "./comparison.js";

export function createComparisonForExistingEncounters({
  storage,
  firstEncounterInstanceId,
  secondEncounterInstanceId,
  freeText,
}) {
  const currentState = loadPerceptualLearningState({ storage });

  if (firstEncounterInstanceId === secondEncounterInstanceId) {
    return rejected();
  }

  const first = findEligibleEncounter({
    state: currentState,
    encounterInstanceId: firstEncounterInstanceId,
  });
  const second = findEligibleEncounter({
    state: currentState,
    encounterInstanceId: secondEncounterInstanceId,
  });

  if (!first || !second) {
    return rejected();
  }

  let comparison;

  try {
    comparison = createComparison({
      learnerId: currentState.learnerId,
      firstEncounterInstanceId,
      secondEncounterInstanceId,
      freeText,
    });
  } catch {
    return rejected();
  }

  const nextState = {
    learnerId: currentState.learnerId,
    learnerCreatedAt: currentState.learnerCreatedAt,
    encounterInstances: currentState.encounterInstances,
    observations: currentState.observations,
    comparisons: [...currentState.comparisons, comparison],
  };

  const writeResult = writePerceptualLearningState({ storage, nextState });

  if (!writeResult.persisted) {
    return rejected();
  }

  return { persisted: true, comparison };
}

// Eligible = exists, belongs to the current learner, and carries at least
// one persisted Observation (Phase 6.0's eligibility invariant, enforced
// here independent of whatever UI-level filtering already narrowed the
// candidate list before this was ever called).
function findEligibleEncounter({ state, encounterInstanceId }) {
  if (typeof encounterInstanceId !== "string" || encounterInstanceId.trim().length === 0) {
    return null;
  }

  const encounter = state.encounterInstances.find(
    (candidate) => candidate.encounterInstanceId === encounterInstanceId
  );

  if (!encounter || !state.learnerId || encounter.learnerId !== state.learnerId) {
    return null;
  }

  const hasObservation = state.observations.some(
    (observation) => observation.encounterInstanceId === encounterInstanceId
  );

  return hasObservation ? encounter : null;
}

function rejected() {
  return { persisted: false, comparison: null };
}
