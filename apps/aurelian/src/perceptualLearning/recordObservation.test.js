import { describe, expect, it } from "vitest";
import { recordObservation } from "./recordObservation.js";
import { createEncounterWithObservation } from "./createEncounterWithObservation.js";
import { loadPerceptualLearningState } from "./perceptualLearningPersistence.js";

function createFakeStorage(initial = {}) {
  const store = new Map(Object.entries(initial));

  return {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => {
      store.set(key, value);
    },
    removeItem: (key) => {
      store.delete(key);
    },
  };
}

describe("recordObservation", () => {
  it("appends a new Observation to the existing EncounterInstance, without creating a new one", () => {
    const storage = createFakeStorage();
    const first = createEncounterWithObservation({
      storage,
      fragranceId: 42,
      moment: "initial",
      freeText: "Huele a cítrico.",
    });

    const result = recordObservation({
      storage,
      encounterInstanceId: first.encounterInstance.encounterInstanceId,
      learnerId: first.learnerId,
      moment: "later",
      freeText: "Ahora es más suave.",
    });

    expect(result.persisted).toBe(true);
    expect(result.observation.encounterInstanceId).toBe(first.encounterInstance.encounterInstanceId);
    expect(result.observation.observationId).not.toBe(first.observation.observationId);
    expect(result.observation.learnerId).toBe(first.learnerId);

    const state = loadPerceptualLearningState({ storage });
    expect(state.encounterInstances).toHaveLength(1);
    expect(state.observations).toHaveLength(2);
  });

  it("allows submitting the same moment twice against the same encounter", () => {
    const storage = createFakeStorage();
    const first = createEncounterWithObservation({
      storage,
      fragranceId: 42,
      moment: "initial",
      freeText: "Primero.",
    });

    const result = recordObservation({
      storage,
      encounterInstanceId: first.encounterInstance.encounterInstanceId,
      learnerId: first.learnerId,
      moment: "initial",
      freeText: "Otra vez inicial, sin problema.",
    });

    expect(result.persisted).toBe(true);
    expect(loadPerceptualLearningState({ storage }).observations).toHaveLength(2);
  });

  it("rejects a nonexistent EncounterInstance", () => {
    const storage = createFakeStorage();
    createEncounterWithObservation({ storage, fragranceId: 42, moment: "initial", freeText: "x" });

    expect(() =>
      recordObservation({
        storage,
        encounterInstanceId: "does-not-exist",
        learnerId: "whoever",
        moment: "later",
        freeText: "x",
      })
    ).toThrow();
  });

  it("rejects an EncounterInstance that belongs to a different learner", () => {
    const storage = createFakeStorage();
    const first = createEncounterWithObservation({
      storage,
      fragranceId: 42,
      moment: "initial",
      freeText: "x",
    });

    expect(() =>
      recordObservation({
        storage,
        encounterInstanceId: first.encounterInstance.encounterInstanceId,
        learnerId: "someone-else",
        moment: "later",
        freeText: "x",
      })
    ).toThrow();
  });
});
