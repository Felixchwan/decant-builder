import { describe, expect, it } from "vitest";
import {
  PERCEPTUAL_LEARNING_SCHEMA_VERSION,
  PERCEPTUAL_LEARNING_STORAGE_KEY,
  loadPerceptualLearningState,
  resetLearningData,
  writePerceptualLearningState,
} from "./perceptualLearningPersistence.js";
import { createLearnerId } from "./learnerIdentity.js";
import { createEncounterInstance } from "./encounterInstance.js";
import { createObservation } from "./observation.js";
import { createComparison } from "./comparison.js";

function createFakeStorage(initial = {}) {
  const store = new Map(Object.entries(initial));
  let setItemCalls = 0;

  return {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => {
      setItemCalls += 1;
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

const EMPTY_STATE = {
  learnerId: null,
  learnerCreatedAt: null,
  encounterInstances: [],
  observations: [],
  comparisons: [],
};

describe("perceptualLearningPersistence", () => {
  it("returns an empty default state when storage is unavailable", () => {
    expect(loadPerceptualLearningState({ storage: null })).toEqual(EMPTY_STATE);
    expect(loadPerceptualLearningState({})).toEqual(EMPTY_STATE);
  });

  it("returns an empty default state when nothing is stored yet", () => {
    const storage = createFakeStorage();

    expect(loadPerceptualLearningState({ storage })).toEqual(EMPTY_STATE);
  });

  it("current schema version is 2", () => {
    expect(PERCEPTUAL_LEARNING_SCHEMA_VERSION).toBe(2);
  });

  it("round-trips a valid v2 write (including a Comparison) through a read", () => {
    const storage = createFakeStorage();
    const learnerId = createLearnerId();
    const encounterA = createEncounterInstance({ learnerId, fragranceId: 42 });
    const encounterB = createEncounterInstance({ learnerId, fragranceId: 7 });
    const observation = createObservation({
      encounterInstanceId: encounterA.encounterInstanceId,
      learnerId,
      moment: "initial",
      freeText: "Huele a cítrico.",
    });
    const comparison = createComparison({
      learnerId,
      firstEncounterInstanceId: encounterA.encounterInstanceId,
      secondEncounterInstanceId: encounterB.encounterInstanceId,
      freeText: "La primera es más fría; la segunda más suave.",
    });
    const nextState = {
      learnerId,
      learnerCreatedAt: "2026-08-10T00:00:00.000Z",
      encounterInstances: [encounterA, encounterB],
      observations: [observation],
      comparisons: [comparison],
    };

    const result = writePerceptualLearningState({ storage, nextState });

    expect(result.persisted).toBe(true);
    expect(result.state.schemaVersion).toBe(2);
    expect(loadPerceptualLearningState({ storage })).toEqual(nextState);
  });

  it("rejects writing a structurally invalid nextState instead of persisting partial data", () => {
    const storage = createFakeStorage();

    expect(() =>
      writePerceptualLearningState({
        storage,
        nextState: { learnerId: null, encounterInstances: [], observations: "not-an-array", comparisons: [] },
      })
    ).toThrow();
    expect(() =>
      writePerceptualLearningState({
        storage,
        nextState: { learnerId: "bad", encounterInstances: [], observations: [], comparisons: [] },
      })
    ).toThrow();
    expect(() =>
      writePerceptualLearningState({
        storage,
        nextState: { learnerId: null, encounterInstances: [{ noId: true }], observations: [], comparisons: [] },
      })
    ).toThrow();
    // Structurally shaped like an EncounterInstance but with a status field
    // that doesn't belong -- must also be rejected by the strengthened check.
    expect(() =>
      writePerceptualLearningState({
        storage,
        nextState: {
          learnerId: null,
          encounterInstances: [
            {
              encounterInstanceId: "enc-1",
              learnerId: "learner-1",
              fragranceId: 42,
              fragranceDisplaySnapshot: null,
              basedOnDesignId: null,
              designSnapshot: null,
              createdAt: "2026-08-10T00:00:00.000Z",
              status: "open",
            },
          ],
          observations: [],
          comparisons: [],
        },
      })
    ).toThrow();
    // comparisons omitted entirely -- required, not defaulted.
    expect(() =>
      writePerceptualLearningState({
        storage,
        nextState: { learnerId: null, encounterInstances: [], observations: [] },
      })
    ).toThrow();

    // Confirms the earlier failed calls left nothing behind -- atomicity at
    // the persistence boundary.
    expect(loadPerceptualLearningState({ storage })).toEqual(EMPTY_STATE);
  });

  it("discards the entire payload on an unrecognized schema version", () => {
    const learnerId = createLearnerId();
    const encounter = createEncounterInstance({ learnerId, fragranceId: 42 });
    const storage = createFakeStorage({
      [PERCEPTUAL_LEARNING_STORAGE_KEY]: JSON.stringify({
        schemaVersion: PERCEPTUAL_LEARNING_SCHEMA_VERSION + 1,
        learnerId,
        encounterInstances: [encounter],
        observations: [],
        comparisons: [],
      }),
    });

    expect(loadPerceptualLearningState({ storage })).toEqual(EMPTY_STATE);
  });

  it("discards the entire payload on a malformed top-level shape, at either recognized version", () => {
    const arrayShaped = createFakeStorage({
      [PERCEPTUAL_LEARNING_STORAGE_KEY]: JSON.stringify(["not", "an", "object"]),
    });
    expect(loadPerceptualLearningState({ storage: arrayShaped })).toEqual(EMPTY_STATE);

    const corruptJson = createFakeStorage({ [PERCEPTUAL_LEARNING_STORAGE_KEY]: "{not valid json" });
    expect(loadPerceptualLearningState({ storage: corruptJson })).toEqual(EMPTY_STATE);

    const invalidLearnerIdV2 = createFakeStorage({
      [PERCEPTUAL_LEARNING_STORAGE_KEY]: JSON.stringify({
        schemaVersion: PERCEPTUAL_LEARNING_SCHEMA_VERSION,
        learnerId: "x",
        encounterInstances: [],
        observations: [],
        comparisons: [],
      }),
    });
    expect(loadPerceptualLearningState({ storage: invalidLearnerIdV2 })).toEqual(EMPTY_STATE);

    // A malformed legacy v1 payload retains the same discard behavior --
    // migration only applies to an otherwise-valid v1 shape.
    const invalidLearnerIdV1 = createFakeStorage({
      [PERCEPTUAL_LEARNING_STORAGE_KEY]: JSON.stringify({
        schemaVersion: 1,
        learnerId: "x",
        encounterInstances: [],
        observations: [],
      }),
    });
    expect(loadPerceptualLearningState({ storage: invalidLearnerIdV1 })).toEqual(EMPTY_STATE);

    const nonObjectV1 = createFakeStorage({
      [PERCEPTUAL_LEARNING_STORAGE_KEY]: JSON.stringify(null),
    });
    expect(loadPerceptualLearningState({ storage: nonObjectV1 })).toEqual(EMPTY_STATE);
  });

  it("migrates a valid legacy v1 payload to the in-memory v2 shape, preserving existing evidence, with zero writes", () => {
    const learnerId = createLearnerId();
    const encounter = createEncounterInstance({ learnerId, fragranceId: 42 });
    const observation = createObservation({
      encounterInstanceId: encounter.encounterInstanceId,
      learnerId,
      moment: "initial",
      freeText: "Huele a cítrico.",
    });
    // A genuine legacy payload: schemaVersion 1, no comparisons field at all.
    const storage = createFakeStorage({
      [PERCEPTUAL_LEARNING_STORAGE_KEY]: JSON.stringify({
        schemaVersion: 1,
        learnerId,
        learnerCreatedAt: "2026-01-01T00:00:00.000Z",
        encounterInstances: [encounter],
        observations: [observation],
      }),
    });

    const loaded = loadPerceptualLearningState({ storage });

    expect(loaded).toEqual({
      learnerId,
      learnerCreatedAt: "2026-01-01T00:00:00.000Z",
      encounterInstances: [encounter],
      observations: [observation],
      comparisons: [],
    });
    // Loading/migrating must not itself call storage.setItem.
    expect(storage.setItemCalls).toBe(0);
  });

  it("persists a migrated legacy state as v2 on the next successful write", () => {
    const learnerId = createLearnerId();
    const encounter = createEncounterInstance({ learnerId, fragranceId: 42 });
    const storage = createFakeStorage({
      [PERCEPTUAL_LEARNING_STORAGE_KEY]: JSON.stringify({
        schemaVersion: 1,
        learnerId,
        learnerCreatedAt: null,
        encounterInstances: [encounter],
        observations: [],
      }),
    });

    const loaded = loadPerceptualLearningState({ storage });
    const result = writePerceptualLearningState({ storage, nextState: loaded });

    expect(result.persisted).toBe(true);
    expect(result.state.schemaVersion).toBe(2);
    expect(JSON.parse(storage.getItem(PERCEPTUAL_LEARNING_STORAGE_KEY)).schemaVersion).toBe(2);
  });

  it("drops individually malformed EncounterInstance/Observation records without discarding the rest", () => {
    const learnerId = createLearnerId();
    const validEncounter = createEncounterInstance({ learnerId, fragranceId: 42 });
    const validObservation = createObservation({
      encounterInstanceId: validEncounter.encounterInstanceId,
      learnerId,
      moment: "initial",
      freeText: "x",
    });
    const storage = createFakeStorage({
      [PERCEPTUAL_LEARNING_STORAGE_KEY]: JSON.stringify({
        schemaVersion: PERCEPTUAL_LEARNING_SCHEMA_VERSION,
        learnerId,
        learnerCreatedAt: null,
        encounterInstances: [
          validEncounter,
          { noId: true },
          { ...validEncounter, encounterInstanceId: "" },
          { ...validEncounter, fragranceId: "not-an-integer" },
        ],
        observations: [
          validObservation,
          {},
          { ...validObservation, moment: "drydown" },
          { ...validObservation, confidence: "confident" },
        ],
        comparisons: [],
      }),
    });

    expect(loadPerceptualLearningState({ storage })).toEqual({
      learnerId,
      learnerCreatedAt: null,
      encounterInstances: [validEncounter],
      observations: [validObservation],
      comparisons: [],
    });
  });

  it("drops an individually malformed Comparison without discarding valid sibling comparisons", () => {
    const learnerId = createLearnerId();
    const encounterA = createEncounterInstance({ learnerId, fragranceId: 42 });
    const encounterB = createEncounterInstance({ learnerId, fragranceId: 7 });
    const validComparison = createComparison({
      learnerId,
      firstEncounterInstanceId: encounterA.encounterInstanceId,
      secondEncounterInstanceId: encounterB.encounterInstanceId,
      freeText: "x",
    });
    const storage = createFakeStorage({
      [PERCEPTUAL_LEARNING_STORAGE_KEY]: JSON.stringify({
        schemaVersion: PERCEPTUAL_LEARNING_SCHEMA_VERSION,
        learnerId,
        learnerCreatedAt: null,
        encounterInstances: [encounterA, encounterB],
        observations: [],
        comparisons: [
          validComparison,
          { noId: true },
          { ...validComparison, freeText: "" },
          { ...validComparison, secondEncounterInstanceId: validComparison.firstEncounterInstanceId },
        ],
      }),
    });

    expect(loadPerceptualLearningState({ storage }).comparisons).toEqual([validComparison]);
  });

  it("drops an orphaned Comparison on read whose referenced encounter no longer validates", () => {
    const learnerId = createLearnerId();
    const encounterA = createEncounterInstance({ learnerId, fragranceId: 42 });
    const encounterB = createEncounterInstance({ learnerId, fragranceId: 7 });
    const orphanedComparison = createComparison({
      learnerId,
      firstEncounterInstanceId: encounterA.encounterInstanceId,
      secondEncounterInstanceId: encounterB.encounterInstanceId,
      freeText: "x",
    });
    const storage = createFakeStorage({
      [PERCEPTUAL_LEARNING_STORAGE_KEY]: JSON.stringify({
        schemaVersion: PERCEPTUAL_LEARNING_SCHEMA_VERSION,
        learnerId,
        learnerCreatedAt: null,
        // encounterB is deliberately absent -- e.g. dropped for being
        // individually malformed in some hypothetical earlier corruption.
        encounterInstances: [encounterA],
        observations: [],
        comparisons: [orphanedComparison],
      }),
    });

    expect(loadPerceptualLearningState({ storage }).comparisons).toEqual([]);
  });

  it("keeps a persisted EncounterInstance valid even when its fragranceId no longer resolves against any catalog", () => {
    // This predicate has no catalog dependency at all -- a removed/renamed
    // catalog item must not invalidate historical evidence. Using a
    // deliberately absurd fragranceId to make the point unambiguous: this
    // module never looks it up anywhere.
    const learnerId = createLearnerId();
    const encounterForRemovedFragrance = createEncounterInstance({
      learnerId,
      fragranceId: 999999999,
    });
    const storage = createFakeStorage({
      [PERCEPTUAL_LEARNING_STORAGE_KEY]: JSON.stringify({
        schemaVersion: PERCEPTUAL_LEARNING_SCHEMA_VERSION,
        learnerId,
        learnerCreatedAt: null,
        encounterInstances: [encounterForRemovedFragrance],
        observations: [],
        comparisons: [],
      }),
    });

    expect(loadPerceptualLearningState({ storage }).encounterInstances).toEqual([
      encounterForRemovedFragrance,
    ]);
  });

  it("allows a valid Comparison between two encounters of the same fragrance", () => {
    const storage = createFakeStorage();
    const learnerId = createLearnerId();
    const encounterA = createEncounterInstance({ learnerId, fragranceId: 42 });
    const encounterB = createEncounterInstance({ learnerId, fragranceId: 42 });
    const comparison = createComparison({
      learnerId,
      firstEncounterInstanceId: encounterA.encounterInstanceId,
      secondEncounterInstanceId: encounterB.encounterInstanceId,
      freeText: "Hoy se siente distinto a como lo recordaba.",
    });

    const result = writePerceptualLearningState({
      storage,
      nextState: {
        learnerId,
        learnerCreatedAt: null,
        encounterInstances: [encounterA, encounterB],
        observations: [],
        comparisons: [comparison],
      },
    });

    expect(result.persisted).toBe(true);
    expect(loadPerceptualLearningState({ storage }).comparisons).toEqual([comparison]);
  });

  it("rejects writing a Comparison that references an encounter not present in nextState.encounterInstances", () => {
    const storage = createFakeStorage();
    const learnerId = createLearnerId();
    const encounterA = createEncounterInstance({ learnerId, fragranceId: 42 });
    const comparison = createComparison({
      learnerId,
      firstEncounterInstanceId: encounterA.encounterInstanceId,
      secondEncounterInstanceId: "does-not-exist",
      freeText: "x",
    });

    expect(() =>
      writePerceptualLearningState({
        storage,
        nextState: {
          learnerId,
          learnerCreatedAt: null,
          encounterInstances: [encounterA],
          observations: [],
          comparisons: [comparison],
        },
      })
    ).toThrow();
    expect(loadPerceptualLearningState({ storage })).toEqual(EMPTY_STATE);
  });

  it("rejects writing a Comparison whose referenced encounters belong to a different learner", () => {
    const storage = createFakeStorage();
    const learnerId = createLearnerId();
    const otherLearnerId = createLearnerId();
    const encounterA = createEncounterInstance({ learnerId, fragranceId: 42 });
    const encounterB = createEncounterInstance({ learnerId: otherLearnerId, fragranceId: 7 });
    const comparison = createComparison({
      learnerId,
      firstEncounterInstanceId: encounterA.encounterInstanceId,
      secondEncounterInstanceId: encounterB.encounterInstanceId,
      freeText: "x",
    });

    expect(() =>
      writePerceptualLearningState({
        storage,
        nextState: {
          learnerId,
          learnerCreatedAt: null,
          encounterInstances: [encounterA, encounterB],
          observations: [],
          comparisons: [comparison],
        },
      })
    ).toThrow();
    expect(loadPerceptualLearningState({ storage })).toEqual(EMPTY_STATE);
  });

  it("resets by clearing storage entirely", () => {
    const storage = createFakeStorage();
    const learnerId = createLearnerId();
    writePerceptualLearningState({
      storage,
      nextState: {
        learnerId,
        learnerCreatedAt: null,
        encounterInstances: [createEncounterInstance({ learnerId, fragranceId: 42 })],
        observations: [],
        comparisons: [],
      },
    });

    expect(resetLearningData({ storage })).toBe(true);
    expect(loadPerceptualLearningState({ storage })).toEqual(EMPTY_STATE);
  });

  it("degrades gracefully, without throwing, when storage access itself throws (e.g. private browsing)", () => {
    const throwingStorage = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
      removeItem: () => {
        throw new Error("blocked");
      },
    };

    expect(() => loadPerceptualLearningState({ storage: throwingStorage })).not.toThrow();
    expect(loadPerceptualLearningState({ storage: throwingStorage })).toEqual(EMPTY_STATE);

    expect(
      writePerceptualLearningState({
        storage: throwingStorage,
        nextState: EMPTY_STATE,
      })
    ).toEqual({ persisted: false, state: null });

    expect(resetLearningData({ storage: throwingStorage })).toBe(false);
  });

  it("resets and regenerates a fresh, unrelated learner id on next use (decision 4)", () => {
    const storage = createFakeStorage();
    const firstLearnerId = createLearnerId();
    writePerceptualLearningState({
      storage,
      nextState: {
        learnerId: firstLearnerId,
        learnerCreatedAt: null,
        encounterInstances: [createEncounterInstance({ learnerId: firstLearnerId, fragranceId: 42 })],
        observations: [],
        comparisons: [],
      },
    });

    resetLearningData({ storage });

    expect(loadPerceptualLearningState({ storage }).learnerId).toBeNull();

    // Simulates "next use": the application layer resolves a fresh id
    // (learnerIdentity.resolveLearnerId(null)) and writes again.
    const secondLearnerId = createLearnerId();
    expect(secondLearnerId).not.toBe(firstLearnerId);

    writePerceptualLearningState({
      storage,
      nextState: {
        learnerId: secondLearnerId,
        learnerCreatedAt: null,
        encounterInstances: [],
        observations: [],
        comparisons: [],
      },
    });

    expect(loadPerceptualLearningState({ storage }).learnerId).toBe(secondLearnerId);
  });
});
