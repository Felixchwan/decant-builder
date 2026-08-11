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

const EMPTY_STATE = {
  learnerId: null,
  learnerCreatedAt: null,
  encounterInstances: [],
  observations: [],
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

  it("round-trips a valid write through a read", () => {
    const storage = createFakeStorage();
    const learnerId = createLearnerId();
    const encounter = createEncounterInstance({ learnerId, fragranceId: 42 });
    const observation = createObservation({
      encounterInstanceId: encounter.encounterInstanceId,
      learnerId,
      moment: "initial",
      freeText: "Huele a cítrico.",
    });
    const nextState = {
      learnerId,
      learnerCreatedAt: "2026-08-10T00:00:00.000Z",
      encounterInstances: [encounter],
      observations: [observation],
    };

    const result = writePerceptualLearningState({ storage, nextState });

    expect(result.persisted).toBe(true);
    expect(loadPerceptualLearningState({ storage })).toEqual(nextState);
  });

  it("rejects writing a structurally invalid nextState instead of persisting partial data", () => {
    const storage = createFakeStorage();

    expect(() =>
      writePerceptualLearningState({
        storage,
        nextState: { learnerId: null, encounterInstances: [], observations: "not-an-array" },
      })
    ).toThrow();
    expect(() =>
      writePerceptualLearningState({
        storage,
        nextState: { learnerId: "bad", encounterInstances: [], observations: [] },
      })
    ).toThrow();
    expect(() =>
      writePerceptualLearningState({
        storage,
        nextState: { learnerId: null, encounterInstances: [{ noId: true }], observations: [] },
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
        },
      })
    ).toThrow();

    // Confirms the earlier failed calls left nothing behind -- atomicity at
    // the persistence boundary.
    expect(loadPerceptualLearningState({ storage })).toEqual(EMPTY_STATE);
  });

  it("discards the entire payload on a schema version mismatch", () => {
    const learnerId = createLearnerId();
    const encounter = createEncounterInstance({ learnerId, fragranceId: 42 });
    const storage = createFakeStorage({
      [PERCEPTUAL_LEARNING_STORAGE_KEY]: JSON.stringify({
        schemaVersion: PERCEPTUAL_LEARNING_SCHEMA_VERSION + 1,
        learnerId,
        encounterInstances: [encounter],
        observations: [],
      }),
    });

    expect(loadPerceptualLearningState({ storage })).toEqual(EMPTY_STATE);
  });

  it("discards the entire payload on a malformed top-level shape", () => {
    const arrayShaped = createFakeStorage({
      [PERCEPTUAL_LEARNING_STORAGE_KEY]: JSON.stringify(["not", "an", "object"]),
    });
    expect(loadPerceptualLearningState({ storage: arrayShaped })).toEqual(EMPTY_STATE);

    const corruptJson = createFakeStorage({ [PERCEPTUAL_LEARNING_STORAGE_KEY]: "{not valid json" });
    expect(loadPerceptualLearningState({ storage: corruptJson })).toEqual(EMPTY_STATE);

    const invalidLearnerId = createFakeStorage({
      [PERCEPTUAL_LEARNING_STORAGE_KEY]: JSON.stringify({
        schemaVersion: PERCEPTUAL_LEARNING_SCHEMA_VERSION,
        learnerId: "x",
        encounterInstances: [],
        observations: [],
      }),
    });
    expect(loadPerceptualLearningState({ storage: invalidLearnerId })).toEqual(EMPTY_STATE);
  });

  it("drops individually malformed records without discarding the rest", () => {
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
      }),
    });

    expect(loadPerceptualLearningState({ storage })).toEqual({
      learnerId,
      learnerCreatedAt: null,
      encounterInstances: [validEncounter],
      observations: [validObservation],
    });
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
      }),
    });

    expect(loadPerceptualLearningState({ storage }).encounterInstances).toEqual([
      encounterForRemovedFragrance,
    ]);
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
      },
    });

    expect(loadPerceptualLearningState({ storage }).learnerId).toBe(secondLearnerId);
  });
});
