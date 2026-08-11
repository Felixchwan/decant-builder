// The atomic first-comparison use case: a Learner's first Comparison of a
// fresh comparison session must produce exactly one validated next state and
// one persistence write -- learner identity (if new), both fresh
// EncounterInstances, and the Comparison referencing them, all in one write.
// Mirrors createEncounterWithObservation.js's atomicity shape exactly (see
// ADR-0021, ADR-0022, and the approved Phase 2 design).
//
// If anything fails before writePerceptualLearningState succeeds (an
// invalid input throwing out of createEncounterInstance/createComparison, or
// the write itself failing, e.g. storage unavailable), durable storage is
// left exactly as it was: no empty Learner, no orphaned EncounterInstance.
//
// Observations are never touched by this use case -- carried forward
// unmodified from the currently persisted state.
//
// Per the approved Phase 2 design (ADR-0022), this use case enforces no
// different-fragrance invariant: two EncounterInstances of the same
// fragrance are a structurally valid pair at this layer. Phase 2.1's UI is
// responsible for steering the ordinary user journey away from that case;
// this layer must remain capable of it (e.g. a future same-fragrance
// self-temporal comparison).

import { loadPerceptualLearningState, writePerceptualLearningState } from "./perceptualLearningPersistence.js";
import { resolveLearnerId } from "./learnerIdentity.js";
import { createEncounterInstance } from "./encounterInstance.js";
import { createComparison } from "./comparison.js";

export function createComparisonWithEncounters({
  storage,
  firstFragranceId,
  firstFragranceDisplaySnapshot = null,
  secondFragranceId,
  secondFragranceDisplaySnapshot = null,
  freeText,
}) {
  const currentState = loadPerceptualLearningState({ storage });
  const learnerId = resolveLearnerId(currentState.learnerId);
  const isNewLearner = currentState.learnerId !== learnerId;
  const learnerCreatedAt = isNewLearner ? new Date().toISOString() : currentState.learnerCreatedAt;

  // All three factories throw on invalid input before any write is
  // attempted -- nothing below this point can leave storage in a
  // partially-created state.
  const firstEncounterInstance = createEncounterInstance({
    learnerId,
    fragranceId: firstFragranceId,
    fragranceDisplaySnapshot: firstFragranceDisplaySnapshot,
  });
  const secondEncounterInstance = createEncounterInstance({
    learnerId,
    fragranceId: secondFragranceId,
    fragranceDisplaySnapshot: secondFragranceDisplaySnapshot,
  });
  const comparison = createComparison({
    learnerId,
    firstEncounterInstanceId: firstEncounterInstance.encounterInstanceId,
    secondEncounterInstanceId: secondEncounterInstance.encounterInstanceId,
    freeText,
  });

  const nextState = {
    learnerId,
    learnerCreatedAt,
    encounterInstances: [
      ...currentState.encounterInstances,
      firstEncounterInstance,
      secondEncounterInstance,
    ],
    observations: currentState.observations,
    comparisons: [...currentState.comparisons, comparison],
  };

  const writeResult = writePerceptualLearningState({ storage, nextState });

  if (!writeResult.persisted) {
    return {
      persisted: false,
      learnerId: null,
      firstEncounterInstance: null,
      secondEncounterInstance: null,
      comparison: null,
    };
  }

  return {
    persisted: true,
    learnerId,
    firstEncounterInstance,
    secondEncounterInstance,
    comparison,
  };
}
