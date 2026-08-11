// Records an additional Observation against an EncounterInstance that
// already exists in durable storage -- the "Registrar otro momento" case
// within an already-active capture session. Never creates a new
// EncounterInstance; a genuinely new capture session (a later, fresh page
// load) goes through createEncounterWithObservation.js instead.
//
// Submitting the same `moment` twice against the same EncounterInstance is
// allowed by design -- no uniqueness constraint is enforced here.

import { loadPerceptualLearningState, writePerceptualLearningState } from "./perceptualLearningPersistence.js";
import { createObservation } from "./observation.js";

export function recordObservation({ storage, encounterInstanceId, learnerId, moment, freeText }) {
  const currentState = loadPerceptualLearningState({ storage });

  const encounterInstance = currentState.encounterInstances.find(
    (candidate) => candidate.encounterInstanceId === encounterInstanceId
  );

  if (!encounterInstance) {
    throw new Error(
      "recordObservation: no matching EncounterInstance found in the current persisted state."
    );
  }

  if (encounterInstance.learnerId !== learnerId || currentState.learnerId !== learnerId) {
    throw new Error("recordObservation: EncounterInstance does not belong to the current learner.");
  }

  const observation = createObservation({
    encounterInstanceId,
    learnerId,
    moment,
    freeText,
  });

  const nextState = {
    ...currentState,
    observations: [...currentState.observations, observation],
  };

  const writeResult = writePerceptualLearningState({ storage, nextState });

  if (!writeResult.persisted) {
    return { persisted: false, observation: null };
  }

  return { persisted: true, observation };
}
