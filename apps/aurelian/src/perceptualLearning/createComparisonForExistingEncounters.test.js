import { describe, expect, it } from "vitest";
import { createComparisonForExistingEncounters } from "./createComparisonForExistingEncounters.js";
import {
  PERCEPTUAL_LEARNING_STORAGE_KEY,
  loadPerceptualLearningState,
  writePerceptualLearningState,
} from "./perceptualLearningPersistence.js";
import { createLearnerId } from "./learnerIdentity.js";
import { createEncounterInstance } from "./encounterInstance.js";
import { createObservation } from "./observation.js";

// initialEntries seeds the backing store directly, bypassing setItem (and
// therefore failWrites) entirely -- needed so a test can pre-populate real
// persisted state without that seed itself consuming an injected failure.
function createCountingStorage({ failWrites = 0, initialEntries = [] } = {}) {
  const store = new Map(initialEntries);
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

// Seeds storage with a learner, N EncounterInstances (all fragranceId: 1
// unless overridden), and, for each index listed in observedIndices, one
// Observation on that specific encounter. Returns { storage, learnerId,
// encounters }.
function seedLearnerWithEncounters({ count, observedIndices = [] }) {
  const storage = createCountingStorage();
  const learnerId = createLearnerId();
  const encounters = Array.from({ length: count }, (_, index) =>
    createEncounterInstance({
      learnerId,
      fragranceId: 1,
      fragranceDisplaySnapshot: { fragranceId: 1, name: "Aurelian No. 1", brand: "Aurelian" },
      createdAt: `2026-08-0${index + 1}T00:00:00.000Z`,
    })
  );
  const observations = observedIndices.map((index) =>
    createObservation({
      encounterInstanceId: encounters[index].encounterInstanceId,
      learnerId,
      moment: "initial",
      freeText: `Nota del encuentro ${index + 1}.`,
    })
  );

  writePerceptualLearningState({
    storage,
    nextState: {
      learnerId,
      learnerCreatedAt: encounters[0]?.createdAt ?? null,
      encounterInstances: encounters,
      observations,
      comparisons: [],
    },
  });

  return { storage, learnerId, encounters };
}

describe("createComparisonForExistingEncounters", () => {
  it("succeeds and persists a Comparison referencing both existing EncounterInstances when both are eligible", () => {
    const { storage, encounters } = seedLearnerWithEncounters({ count: 2, observedIndices: [0, 1] });

    const result = createComparisonForExistingEncounters({
      storage,
      firstEncounterInstanceId: encounters[0].encounterInstanceId,
      secondEncounterInstanceId: encounters[1].encounterInstanceId,
      freeText: "Hoy se siente distinto a como lo recordaba.",
    });

    expect(result.persisted).toBe(true);
    expect(result.comparison.firstEncounterInstanceId).toBe(encounters[0].encounterInstanceId);
    expect(result.comparison.secondEncounterInstanceId).toBe(encounters[1].encounterInstanceId);
    expect(result.comparison.freeText).toBe("Hoy se siente distinto a como lo recordaba.");

    const persisted = loadPerceptualLearningState({ storage });
    expect(persisted.comparisons).toEqual([result.comparison]);
    // Neither EncounterInstance nor any Observation was touched -- this
    // use case never mints new evidence, only references existing evidence.
    expect(persisted.encounterInstances).toEqual(encounters);
  });

  it("never reorders by chronology -- preserves exactly the learner-selected first/second orientation even when the chronologically later encounter is supplied as first", () => {
    const { storage, encounters } = seedLearnerWithEncounters({ count: 2, observedIndices: [0, 1] });
    // encounters[0].createdAt (2026-08-01) is chronologically EARLIER than
    // encounters[1].createdAt (2026-08-02) -- supplying the LATER one as
    // "first" must persist it as first regardless.

    const result = createComparisonForExistingEncounters({
      storage,
      firstEncounterInstanceId: encounters[1].encounterInstanceId,
      secondEncounterInstanceId: encounters[0].encounterInstanceId,
      freeText: "x",
    });

    expect(result.persisted).toBe(true);
    expect(result.comparison.firstEncounterInstanceId).toBe(encounters[1].encounterInstanceId);
    expect(result.comparison.secondEncounterInstanceId).toBe(encounters[0].encounterInstanceId);
  });

  it("rejects and performs no write when the first encounter has Observations but the second has none", () => {
    const { storage, encounters } = seedLearnerWithEncounters({ count: 2, observedIndices: [0] });
    const before = loadPerceptualLearningState({ storage });

    const result = createComparisonForExistingEncounters({
      storage,
      firstEncounterInstanceId: encounters[0].encounterInstanceId,
      secondEncounterInstanceId: encounters[1].encounterInstanceId,
      freeText: "x",
    });

    expect(result.persisted).toBe(false);
    expect(result.comparison).toBeNull();
    expect(storage.setItemCalls).toBe(1); // only the seed write
    expect(loadPerceptualLearningState({ storage })).toEqual(before);
  });

  it("rejects and performs no write when the second encounter has Observations but the first has none", () => {
    const { storage, encounters } = seedLearnerWithEncounters({ count: 2, observedIndices: [1] });
    const before = loadPerceptualLearningState({ storage });

    const result = createComparisonForExistingEncounters({
      storage,
      firstEncounterInstanceId: encounters[0].encounterInstanceId,
      secondEncounterInstanceId: encounters[1].encounterInstanceId,
      freeText: "x",
    });

    expect(result.persisted).toBe(false);
    expect(result.comparison).toBeNull();
    expect(storage.setItemCalls).toBe(1);
    expect(loadPerceptualLearningState({ storage })).toEqual(before);
  });

  it("rejects and performs no write when both encounters have zero Observations", () => {
    const { storage, encounters } = seedLearnerWithEncounters({ count: 2, observedIndices: [] });
    const before = loadPerceptualLearningState({ storage });

    const result = createComparisonForExistingEncounters({
      storage,
      firstEncounterInstanceId: encounters[0].encounterInstanceId,
      secondEncounterInstanceId: encounters[1].encounterInstanceId,
      freeText: "x",
    });

    expect(result.persisted).toBe(false);
    expect(storage.setItemCalls).toBe(1);
    expect(loadPerceptualLearningState({ storage })).toEqual(before);
  });

  it("rejects and performs no write when the same exact EncounterInstance is supplied on both sides", () => {
    const { storage, encounters } = seedLearnerWithEncounters({ count: 1, observedIndices: [0] });
    const before = loadPerceptualLearningState({ storage });

    const result = createComparisonForExistingEncounters({
      storage,
      firstEncounterInstanceId: encounters[0].encounterInstanceId,
      secondEncounterInstanceId: encounters[0].encounterInstanceId,
      freeText: "x",
    });

    expect(result.persisted).toBe(false);
    expect(storage.setItemCalls).toBe(1);
    expect(loadPerceptualLearningState({ storage })).toEqual(before);
  });

  it("rejects and performs no write when an encounter id does not exist in persisted state", () => {
    const { storage, encounters } = seedLearnerWithEncounters({ count: 1, observedIndices: [0] });
    const before = loadPerceptualLearningState({ storage });

    const result = createComparisonForExistingEncounters({
      storage,
      firstEncounterInstanceId: encounters[0].encounterInstanceId,
      secondEncounterInstanceId: "encounter-does-not-exist",
      freeText: "x",
    });

    expect(result.persisted).toBe(false);
    expect(loadPerceptualLearningState({ storage })).toEqual(before);
  });

  it("rejects and performs no write when an encounter belongs to a different learner", () => {
    // Hand-built anomalous state: two learners' encounters coexist in one
    // payload (persisted state legitimately holds only one learner at a
    // time per ADR-0021, but nothing at the persistence layer forbids this
    // shape). The use case must still refuse to pair an id that does not
    // belong to the CURRENT learnerId, even though it exists and is itself
    // eligible for its own learner.
    const storage = createCountingStorage();
    const learnerId = createLearnerId();
    const otherLearnerId = createLearnerId();
    const ownEncounter = createEncounterInstance({ learnerId, fragranceId: 1 });
    const otherEncounter = createEncounterInstance({ learnerId: otherLearnerId, fragranceId: 1 });
    const ownObservation = createObservation({
      encounterInstanceId: ownEncounter.encounterInstanceId,
      learnerId,
      moment: "initial",
      freeText: "x",
    });
    const otherObservation = createObservation({
      encounterInstanceId: otherEncounter.encounterInstanceId,
      learnerId: otherLearnerId,
      moment: "initial",
      freeText: "x",
    });
    writePerceptualLearningState({
      storage,
      nextState: {
        learnerId,
        learnerCreatedAt: null,
        encounterInstances: [ownEncounter, otherEncounter],
        observations: [ownObservation, otherObservation],
        comparisons: [],
      },
    });
    const before = loadPerceptualLearningState({ storage });

    const result = createComparisonForExistingEncounters({
      storage,
      firstEncounterInstanceId: ownEncounter.encounterInstanceId,
      secondEncounterInstanceId: otherEncounter.encounterInstanceId,
      freeText: "x",
    });

    expect(result.persisted).toBe(false);
    expect(loadPerceptualLearningState({ storage })).toEqual(before);
  });

  it("rejects and performs no write when freeText is blank, without throwing", () => {
    const { storage, encounters } = seedLearnerWithEncounters({ count: 2, observedIndices: [0, 1] });
    const before = loadPerceptualLearningState({ storage });

    expect(() =>
      createComparisonForExistingEncounters({
        storage,
        firstEncounterInstanceId: encounters[0].encounterInstanceId,
        secondEncounterInstanceId: encounters[1].encounterInstanceId,
        freeText: "   ",
      })
    ).not.toThrow();

    const result = createComparisonForExistingEncounters({
      storage,
      firstEncounterInstanceId: encounters[0].encounterInstanceId,
      secondEncounterInstanceId: encounters[1].encounterInstanceId,
      freeText: "",
    });

    expect(result.persisted).toBe(false);
    expect(loadPerceptualLearningState({ storage })).toEqual(before);
  });

  it("repeated Observations on either encounter remain valid, untouched, and do not affect eligibility", () => {
    const storage = createCountingStorage();
    const learnerId = createLearnerId();
    const encounterA = createEncounterInstance({ learnerId, fragranceId: 1 });
    const encounterB = createEncounterInstance({ learnerId, fragranceId: 1 });
    const observations = [
      createObservation({
        encounterInstanceId: encounterA.encounterInstanceId,
        learnerId,
        moment: "initial",
        freeText: "Primera nota de A.",
      }),
      createObservation({
        encounterInstanceId: encounterA.encounterInstanceId,
        learnerId,
        moment: "later",
        freeText: "Segunda nota de A.",
      }),
      createObservation({
        encounterInstanceId: encounterB.encounterInstanceId,
        learnerId,
        moment: "initial",
        freeText: "Nota de B.",
      }),
    ];
    writePerceptualLearningState({
      storage,
      nextState: {
        learnerId,
        learnerCreatedAt: null,
        encounterInstances: [encounterA, encounterB],
        observations,
        comparisons: [],
      },
    });

    const result = createComparisonForExistingEncounters({
      storage,
      firstEncounterInstanceId: encounterA.encounterInstanceId,
      secondEncounterInstanceId: encounterB.encounterInstanceId,
      freeText: "x",
    });

    expect(result.persisted).toBe(true);
    expect(loadPerceptualLearningState({ storage }).observations).toEqual(observations);
  });

  it("leaves no partial durable state when the persistence write itself fails", () => {
    const learnerId = createLearnerId();
    const encounterA = createEncounterInstance({ learnerId, fragranceId: 1 });
    const encounterB = createEncounterInstance({ learnerId, fragranceId: 1 });
    const observationA = createObservation({
      encounterInstanceId: encounterA.encounterInstanceId,
      learnerId,
      moment: "initial",
      freeText: "x",
    });
    const observationB = createObservation({
      encounterInstanceId: encounterB.encounterInstanceId,
      learnerId,
      moment: "initial",
      freeText: "x",
    });
    // Seed via a separate, always-succeeding storage first, then construct
    // the fail-once storage with that payload already in its backing
    // store, so the seed itself never consumes the injected failure.
    const seedStorage = createCountingStorage();
    writePerceptualLearningState({
      storage: seedStorage,
      nextState: {
        learnerId,
        learnerCreatedAt: null,
        encounterInstances: [encounterA, encounterB],
        observations: [observationA, observationB],
        comparisons: [],
      },
    });
    const storage = createCountingStorage({
      failWrites: 1,
      initialEntries: [[PERCEPTUAL_LEARNING_STORAGE_KEY, seedStorage.getItem(PERCEPTUAL_LEARNING_STORAGE_KEY)]],
    });

    const before = loadPerceptualLearningState({ storage });

    const result = createComparisonForExistingEncounters({
      storage,
      firstEncounterInstanceId: encounterA.encounterInstanceId,
      secondEncounterInstanceId: encounterB.encounterInstanceId,
      freeText: "x",
    });

    expect(result.persisted).toBe(false);
    expect(result.comparison).toBeNull();
    expect(loadPerceptualLearningState({ storage })).toEqual(before);
  });
});
