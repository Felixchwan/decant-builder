import { describe, expect, it } from "vitest";
import { createEncounterWithObservation } from "./createEncounterWithObservation.js";
import { loadPerceptualLearningState, writePerceptualLearningState } from "./perceptualLearningPersistence.js";
import { createLearnerId } from "./learnerIdentity.js";
import { createEncounterInstance } from "./encounterInstance.js";
import { createComparison } from "./comparison.js";

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

describe("createEncounterWithObservation", () => {
  it("from an empty state, creates a learner, an EncounterInstance, and an Observation in one write", () => {
    const storage = createCountingStorage();

    const result = createEncounterWithObservation({
      storage,
      fragranceId: 42,
      fragranceDisplaySnapshot: { fragranceId: 42, name: "Aurelian No. 1", brand: "Aurelian" },
      moment: "initial",
      freeText: "Huele a cítrico.",
    });

    expect(result.persisted).toBe(true);
    expect(typeof result.learnerId).toBe("string");
    expect(result.encounterInstance.fragranceId).toBe(42);
    expect(result.encounterInstance.learnerId).toBe(result.learnerId);
    expect(result.observation.encounterInstanceId).toBe(result.encounterInstance.encounterInstanceId);
    expect(result.observation.freeText).toBe("Huele a cítrico.");
    expect(storage.setItemCalls).toBe(1);

    const persisted = loadPerceptualLearningState({ storage });
    expect(persisted.learnerId).toBe(result.learnerId);
    expect(persisted.encounterInstances).toEqual([result.encounterInstance]);
    expect(persisted.observations).toEqual([result.observation]);
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

    const result = createEncounterWithObservation({
      storage,
      fragranceId: 7,
      moment: "later",
      freeText: "Sigue ahí, más suave.",
    });

    expect(result.learnerId).toBe(existingLearnerId);
    expect(loadPerceptualLearningState({ storage }).learnerCreatedAt).toBe("2026-01-01T00:00:00.000Z");
  });

  it("throws on invalid input and performs zero writes", () => {
    const storage = createCountingStorage();

    expect(() =>
      createEncounterWithObservation({ storage, fragranceId: 42, moment: "initial", freeText: "" })
    ).toThrow();
    expect(() =>
      createEncounterWithObservation({ storage, fragranceId: "not-an-id", moment: "initial", freeText: "x" })
    ).toThrow();
    expect(() =>
      createEncounterWithObservation({ storage, fragranceId: 42, moment: "drydown", freeText: "x" })
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

  it("carries an existing learner's comparisons forward unmodified on an ordinary write (ADR-0022)", () => {
    // Regression coverage for a real bug found while adding schema v2:
    // this use case constructs nextState by hand-picking fields rather than
    // spreading currentState, so it must explicitly carry comparisons
    // forward or it would silently drop them.
    const storage = createCountingStorage();
    const learnerId = createLearnerId();
    const priorEncounterA = createEncounterInstance({ learnerId, fragranceId: 1 });
    const priorEncounterB = createEncounterInstance({ learnerId, fragranceId: 2 });
    const priorComparison = createComparison({
      learnerId,
      firstEncounterInstanceId: priorEncounterA.encounterInstanceId,
      secondEncounterInstanceId: priorEncounterB.encounterInstanceId,
      freeText: "x",
    });
    writePerceptualLearningState({
      storage,
      nextState: {
        learnerId,
        learnerCreatedAt: null,
        encounterInstances: [priorEncounterA, priorEncounterB],
        observations: [],
        comparisons: [priorComparison],
      },
    });

    createEncounterWithObservation({
      storage,
      fragranceId: 42,
      moment: "initial",
      freeText: "Otra fragancia distinta.",
    });

    expect(loadPerceptualLearningState({ storage }).comparisons).toEqual([priorComparison]);
  });

  it("never forwards Phase-2 fields to the factories even if a caller supplies them, and performs zero writes", () => {
    // createEncounterWithObservation's own signature does not destructure
    // basedOnDesignId/designSnapshot/comparisonRef/structuredContrastAnswer/
    // confidence at all -- so even if a caller passes them, they can never
    // reach createEncounterInstance/createObservation through this use case.
    // This is itself an atomicity guarantee: there is no path through the
    // first-submission use case that could trip the new Phase-1 hardening
    // guards and leave a partial write behind.
    const storage = createCountingStorage();

    const result = createEncounterWithObservation({
      storage,
      fragranceId: 42,
      moment: "initial",
      freeText: "x",
      basedOnDesignId: "design-1",
      designSnapshot: { some: "thing" },
      comparisonRef: { type: "self-temporal", targetId: "obs-0" },
      structuredContrastAnswer: { axis: "brightness", choice: "A" },
      confidence: "confident",
    });

    expect(result.persisted).toBe(true);
    expect(result.encounterInstance.basedOnDesignId).toBeNull();
    expect(result.encounterInstance.designSnapshot).toBeNull();
    expect(result.observation).not.toHaveProperty("comparisonRef");
    expect(result.observation).not.toHaveProperty("structuredContrastAnswer");
    expect(result.observation).not.toHaveProperty("confidence");
    expect(storage.setItemCalls).toBe(1);
  });

  it("leaves no partial durable state when the persistence write itself fails", () => {
    const storage = createCountingStorage({ failWrites: 1 });

    const result = createEncounterWithObservation({
      storage,
      fragranceId: 42,
      moment: "initial",
      freeText: "x",
    });

    expect(result.persisted).toBe(false);
    expect(result.learnerId).toBeNull();
    expect(result.encounterInstance).toBeNull();
    expect(result.observation).toBeNull();
    expect(loadPerceptualLearningState({ storage })).toEqual({
      learnerId: null,
      learnerCreatedAt: null,
      encounterInstances: [],
      observations: [],
      comparisons: [],
    });
  });

  it("retrying after a failed write persists exactly one EncounterInstance and one Observation", () => {
    const storage = createCountingStorage({ failWrites: 1 });

    const failedAttempt = createEncounterWithObservation({
      storage,
      fragranceId: 42,
      moment: "initial",
      freeText: "x",
    });
    expect(failedAttempt.persisted).toBe(false);

    const retry = createEncounterWithObservation({
      storage,
      fragranceId: 42,
      moment: "initial",
      freeText: "x",
    });
    expect(retry.persisted).toBe(true);

    const finalState = loadPerceptualLearningState({ storage });
    expect(finalState.encounterInstances).toHaveLength(1);
    expect(finalState.observations).toHaveLength(1);
    expect(finalState.encounterInstances[0].encounterInstanceId).toBe(
      retry.encounterInstance.encounterInstanceId
    );
  });
});
