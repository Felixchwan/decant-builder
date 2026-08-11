import { describe, expect, it } from "vitest";
import { createComparisonWithEncounters } from "./createComparisonWithEncounters.js";
import { loadPerceptualLearningState, writePerceptualLearningState } from "./perceptualLearningPersistence.js";
import { createLearnerId } from "./learnerIdentity.js";
import { createEncounterInstance } from "./encounterInstance.js";
import { createObservation } from "./observation.js";

function createCountingStorage({ failWrites = 0 } = {}) {
  const store = new Map();
  let setItemCalls = 0;
  let remainingFailures = failWrites;

  return {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => {
      setItemCalls += 1;
      if (remainingFailures > 0) {
        remainingFailures -= 1;
        throw new Error("simulated storage failure");
      }
      store.set(key, value);
    },
    removeItem: (key) => {
      store.delete(key);
    },
    get setItemCalls() {
      return setItemCalls;
    },
  };
}

describe("createComparisonWithEncounters", () => {
  it("from an empty state, creates a learner, two EncounterInstances, and a Comparison in one write", () => {
    const storage = createCountingStorage();

    const result = createComparisonWithEncounters({
      storage,
      firstFragranceId: 42,
      firstFragranceDisplaySnapshot: { fragranceId: 42, name: "Aurelian No. 1", brand: "Aurelian" },
      secondFragranceId: 7,
      secondFragranceDisplaySnapshot: { fragranceId: 7, name: "Aurelian No. 2", brand: "Aurelian" },
      freeText: "La primera es más fría; la segunda más suave.",
    });

    expect(result.persisted).toBe(true);
    expect(typeof result.learnerId).toBe("string");
    expect(result.firstEncounterInstance.fragranceId).toBe(42);
    expect(result.secondEncounterInstance.fragranceId).toBe(7);
    expect(result.firstEncounterInstance.learnerId).toBe(result.learnerId);
    expect(result.secondEncounterInstance.learnerId).toBe(result.learnerId);
    expect(result.comparison.firstEncounterInstanceId).toBe(
      result.firstEncounterInstance.encounterInstanceId
    );
    expect(result.comparison.secondEncounterInstanceId).toBe(
      result.secondEncounterInstance.encounterInstanceId
    );
    expect(result.comparison.freeText).toBe("La primera es más fría; la segunda más suave.");
    expect(result.comparison.learnerId).toBe(result.learnerId);
    expect(storage.setItemCalls).toBe(1);

    const persisted = loadPerceptualLearningState({ storage });
    expect(persisted.learnerId).toBe(result.learnerId);
    expect(persisted.encounterInstances).toEqual([
      result.firstEncounterInstance,
      result.secondEncounterInstance,
    ]);
    expect(persisted.comparisons).toEqual([result.comparison]);
  });

  it("reuses an existing learnerId instead of creating a new one", () => {
    const storage = createCountingStorage();
    const existingLearnerId = createLearnerId();
    writePerceptualLearningState({
      storage,
      nextState: {
        learnerId: existingLearnerId,
        learnerCreatedAt: "2026-01-01T00:00:00.000Z",
        encounterInstances: [],
        observations: [],
        comparisons: [],
      },
    });

    const result = createComparisonWithEncounters({
      storage,
      firstFragranceId: 1,
      secondFragranceId: 2,
      freeText: "x",
    });

    expect(result.learnerId).toBe(existingLearnerId);
    expect(loadPerceptualLearningState({ storage }).learnerCreatedAt).toBe("2026-01-01T00:00:00.000Z");
  });

  it("does not touch existing Observations", () => {
    const storage = createCountingStorage();
    const learnerId = createLearnerId();
    const priorEncounter = createEncounterInstance({ learnerId, fragranceId: 5 });
    const priorObservation = createObservation({
      encounterInstanceId: priorEncounter.encounterInstanceId,
      learnerId,
      moment: "initial",
      freeText: "Observación previa.",
    });
    writePerceptualLearningState({
      storage,
      nextState: {
        learnerId,
        learnerCreatedAt: null,
        encounterInstances: [priorEncounter],
        observations: [priorObservation],
        comparisons: [],
      },
    });

    createComparisonWithEncounters({
      storage,
      firstFragranceId: 1,
      secondFragranceId: 2,
      freeText: "x",
    });

    expect(loadPerceptualLearningState({ storage }).observations).toEqual([priorObservation]);
  });

  it("allows the same fragranceId on both sides -- no different-fragrance invariant at this layer", () => {
    const storage = createCountingStorage();

    const result = createComparisonWithEncounters({
      storage,
      firstFragranceId: 42,
      secondFragranceId: 42,
      freeText: "Hoy se siente distinto a como lo recordaba.",
    });

    expect(result.persisted).toBe(true);
    expect(result.firstEncounterInstance.fragranceId).toBe(42);
    expect(result.secondEncounterInstance.fragranceId).toBe(42);
    expect(result.firstEncounterInstance.encounterInstanceId).not.toBe(
      result.secondEncounterInstance.encounterInstanceId
    );
  });

  it("throws on invalid input and performs zero writes", () => {
    const storage = createCountingStorage();

    expect(() =>
      createComparisonWithEncounters({
        storage,
        firstFragranceId: 42,
        secondFragranceId: 7,
        freeText: "",
      })
    ).toThrow();
    expect(() =>
      createComparisonWithEncounters({
        storage,
        firstFragranceId: "not-an-id",
        secondFragranceId: 7,
        freeText: "x",
      })
    ).toThrow();
    expect(() =>
      createComparisonWithEncounters({
        storage,
        firstFragranceId: 42,
        secondFragranceId: "not-an-id",
        freeText: "x",
      })
    ).toThrow();

    expect(storage.setItemCalls).toBe(0);
    expect(loadPerceptualLearningState({ storage })).toEqual({
      learnerId: null,
      learnerCreatedAt: null,
      encounterInstances: [],
      observations: [],
      comparisons: [],
    });
  });

  it("leaves no partial durable state when the persistence write itself fails", () => {
    const storage = createCountingStorage({ failWrites: 1 });

    const result = createComparisonWithEncounters({
      storage,
      firstFragranceId: 42,
      secondFragranceId: 7,
      freeText: "x",
    });

    expect(result.persisted).toBe(false);
    expect(result.learnerId).toBeNull();
    expect(result.firstEncounterInstance).toBeNull();
    expect(result.secondEncounterInstance).toBeNull();
    expect(result.comparison).toBeNull();
    expect(loadPerceptualLearningState({ storage })).toEqual({
      learnerId: null,
      learnerCreatedAt: null,
      encounterInstances: [],
      observations: [],
      comparisons: [],
    });
  });

  it("retrying after a failed write persists exactly one pair of EncounterInstances and one Comparison", () => {
    const storage = createCountingStorage({ failWrites: 1 });

    const failedAttempt = createComparisonWithEncounters({
      storage,
      firstFragranceId: 42,
      secondFragranceId: 7,
      freeText: "x",
    });
    expect(failedAttempt.persisted).toBe(false);

    const retry = createComparisonWithEncounters({
      storage,
      firstFragranceId: 42,
      secondFragranceId: 7,
      freeText: "x",
    });
    expect(retry.persisted).toBe(true);

    const finalState = loadPerceptualLearningState({ storage });
    expect(finalState.encounterInstances).toHaveLength(2);
    expect(finalState.comparisons).toHaveLength(1);
    expect(finalState.comparisons[0].comparisonId).toBe(retry.comparison.comparisonId);
    expect(finalState.encounterInstances.map((encounter) => encounter.encounterInstanceId)).toEqual([
      retry.firstEncounterInstance.encounterInstanceId,
      retry.secondEncounterInstance.encounterInstanceId,
    ]);
  });
});
