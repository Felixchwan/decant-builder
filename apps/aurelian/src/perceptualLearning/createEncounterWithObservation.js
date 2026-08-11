// The narrowest atomic first-submission use case: a Learner's first
// Observation of a fresh capture session must produce exactly one validated
// next state and one persistence write -- never a separate "create the
// learner" write, then "create the encounter" write, then "create the
// observation" write. See docs/adr/0021-... and the approved Phase 1 plan.
//
// If anything fails before writePerceptualLearningState succeeds (an
// invalid input throwing out of createEncounterInstance/createObservation,
// or the write itself failing, e.g. storage unavailable), durable storage is
// left exactly as it was: no empty Learner, no empty EncounterInstance.
//
// Supersedes the earlier conceptual startEncounter() + recordObservation()
// split for this one case -- splitting the first write in two would have
// meant two separate storage writes, which is exactly what atomicity here
// forbids. Additional Observations against an already-persisted
// EncounterInstance are a genuinely different, simpler case -- see
// recordObservation.js.

import { loadPerceptualLearningState, writePerceptualLearningState } from "./perceptualLearningPersistence.js";
import { resolveLearnerId } from "./learnerIdentity.js";
import { createEncounterInstance } from "./encounterInstance.js";
import { createObservation } from "./observation.js";

export function createEncounterWithObservation({
  storage,
  fragranceId,
  fragranceDisplaySnapshot = null,
  moment,
  freeText,
}) {
  const currentState = loadPerceptualLearningState({ storage });
  const learnerId = resolveLearnerId(currentState.learnerId);
  const isNewLearner = currentState.learnerId !== learnerId;
  const learnerCreatedAt = isNewLearner ? new Date().toISOString() : currentState.learnerCreatedAt;

  // Both factories throw on invalid input before any write is attempted --
  // nothing below this point can leave storage in a partially-created state.
  const encounterInstance = createEncounterInstance({
    learnerId,
    fragranceId,
    fragranceDisplaySnapshot,
  });
  const observation = createObservation({
    encounterInstanceId: encounterInstance.encounterInstanceId,
    learnerId,
    moment,
    freeText,
  });

  const nextState = {
    learnerId,
    learnerCreatedAt,
    encounterInstances: [...currentState.encounterInstances, encounterInstance],
    observations: [...currentState.observations, observation],
  };

  const writeResult = writePerceptualLearningState({ storage, nextState });

  if (!writeResult.persisted) {
    return { persisted: false, learnerId: null, encounterInstance: null, observation: null };
  }

  return { persisted: true, learnerId, encounterInstance, observation };
}
