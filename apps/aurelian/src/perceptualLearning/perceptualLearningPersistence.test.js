import { describe, expect, it } from "vitest";
import {
  PERCEPTUAL_LEARNING_SCHEMA_VERSION,
  PERCEPTUAL_LEARNING_STORAGE_KEY,
  loadPerceptualLearningState,
  resetLearningData,
  writePerceptualLearningState,
} from "./perceptualLearningPersistence.js";
import { createLearnerId } from "./learnerIdentity.js";

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
    const nextState = {
      learnerId,
      learnerCreatedAt: "2026-08-10T00:00:00.000Z",
      encounterInstances: [{ encounterInstanceId: "enc-1" }],
      observations: [{ observationId: "obs-1" }],
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

    // Confirms the earlier failed calls left nothing behind -- atomicity at
    // the persistence boundary (this repo's correction #1).
    expect(loadPerceptualLearningState({ storage })).toEqual(EMPTY_STATE);
  });

  it("discards the entire payload on a schema version mismatch", () => {
    const storage = createFakeStorage({
      [PERCEPTUAL_LEARNING_STORAGE_KEY]: JSON.stringify({
        schemaVersion: PERCEPTUAL_LEARNING_SCHEMA_VERSION + 1,
        learnerId: createLearnerId(),
        encounterInstances: [{ encounterInstanceId: "enc-1" }],
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
    const storage = createFakeStorage({
      [PERCEPTUAL_LEARNING_STORAGE_KEY]: JSON.stringify({
        schemaVersion: PERCEPTUAL_LEARNING_SCHEMA_VERSION,
        learnerId,
        learnerCreatedAt: null,
        encounterInstances: [
          { encounterInstanceId: "enc-1" },
          { noId: true },
          { encounterInstanceId: "" },
        ],
        observations: [{ observationId: "obs-1" }, {}],
      }),
    });

    expect(loadPerceptualLearningState({ storage })).toEqual({
      learnerId,
      learnerCreatedAt: null,
      encounterInstances: [{ encounterInstanceId: "enc-1" }],
      observations: [{ observationId: "obs-1" }],
    });
  });

  it("resets by clearing storage entirely", () => {
    const storage = createFakeStorage();
    writePerceptualLearningState({
      storage,
      nextState: {
        learnerId: createLearnerId(),
        learnerCreatedAt: null,
        encounterInstances: [{ encounterInstanceId: "enc-1" }],
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
        encounterInstances: [{ encounterInstanceId: "enc-1" }],
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
