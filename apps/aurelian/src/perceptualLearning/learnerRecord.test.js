import { describe, expect, it } from "vitest";
import { buildLearnerRecord } from "./learnerRecord.js";
import { createEncounterInstance } from "./encounterInstance.js";
import { createObservation } from "./observation.js";
import { createComparison } from "./comparison.js";

const LEARNER_ID = "learner-1";

function emptyState(overrides = {}) {
  return {
    learnerId: LEARNER_ID,
    learnerCreatedAt: "2026-08-01T00:00:00.000Z",
    encounterInstances: [],
    observations: [],
    comparisons: [],
    ...overrides,
  };
}

function snapshotFor(fragranceId, name = `Fragrance ${fragranceId}`, brand = "Aurelian") {
  return { fragranceId, name, brand };
}

describe("buildLearnerRecord", () => {
  it("returns an empty record for a learner with no evidence", () => {
    const record = buildLearnerRecord(emptyState());

    expect(record).toEqual({
      learnerId: LEARNER_ID,
      hasEvidence: false,
      encounters: [],
      comparisons: [],
    });
  });

  it("returns learnerId null and hasEvidence false when nothing is persisted at all", () => {
    const record = buildLearnerRecord({
      learnerId: null,
      learnerCreatedAt: null,
      encounterInstances: [],
      observations: [],
      comparisons: [],
    });

    expect(record.learnerId).toBeNull();
    expect(record.hasEvidence).toBe(false);
  });

  describe("hasEvidence semantics", () => {
    it("is false when an EncounterInstance exists with no Observation and no Comparison", () => {
      const encounter = createEncounterInstance({ learnerId: LEARNER_ID, fragranceId: 1 });

      const record = buildLearnerRecord(
        emptyState({ encounterInstances: [encounter] })
      );

      expect(record.hasEvidence).toBe(false);
    });

    it("is true when at least one Observation exists", () => {
      const encounter = createEncounterInstance({ learnerId: LEARNER_ID, fragranceId: 1 });
      const observation = createObservation({
        encounterInstanceId: encounter.encounterInstanceId,
        learnerId: LEARNER_ID,
        moment: "initial",
        freeText: "Bright.",
      });

      const record = buildLearnerRecord(
        emptyState({ encounterInstances: [encounter], observations: [observation] })
      );

      expect(record.hasEvidence).toBe(true);
    });

    it("is true when at least one Comparison exists, even with zero Observations", () => {
      const encounterA = createEncounterInstance({ learnerId: LEARNER_ID, fragranceId: 1 });
      const encounterB = createEncounterInstance({ learnerId: LEARNER_ID, fragranceId: 2 });
      const comparison = createComparison({
        learnerId: LEARNER_ID,
        firstEncounterInstanceId: encounterA.encounterInstanceId,
        secondEncounterInstanceId: encounterB.encounterInstanceId,
        freeText: "A is softer.",
      });

      const record = buildLearnerRecord(
        emptyState({
          encounterInstances: [encounterA, encounterB],
          observations: [],
          comparisons: [comparison],
        })
      );

      expect(record.hasEvidence).toBe(true);
    });
  });

  it("joins each Observation only to its own EncounterInstance, with no cross-encounter leakage", () => {
    const encounterA = createEncounterInstance({ learnerId: LEARNER_ID, fragranceId: 1 });
    const encounterB = createEncounterInstance({ learnerId: LEARNER_ID, fragranceId: 2 });
    const observationA = createObservation({
      encounterInstanceId: encounterA.encounterInstanceId,
      learnerId: LEARNER_ID,
      moment: "initial",
      freeText: "On A.",
    });
    const observationB = createObservation({
      encounterInstanceId: encounterB.encounterInstanceId,
      learnerId: LEARNER_ID,
      moment: "initial",
      freeText: "On B.",
    });

    const record = buildLearnerRecord(
      emptyState({
        encounterInstances: [encounterA, encounterB],
        observations: [observationA, observationB],
      })
    );

    const projectedA = record.encounters.find(
      (encounter) => encounter.encounterInstanceId === encounterA.encounterInstanceId
    );
    const projectedB = record.encounters.find(
      (encounter) => encounter.encounterInstanceId === encounterB.encounterInstanceId
    );

    expect(projectedA.observations.map((observation) => observation.freeText)).toEqual(["On A."]);
    expect(projectedB.observations.map((observation) => observation.freeText)).toEqual(["On B."]);
  });

  it("orders an encounter's own Observations ascending by createdAt", () => {
    const encounter = createEncounterInstance({ learnerId: LEARNER_ID, fragranceId: 1 });
    const later = createObservation({
      encounterInstanceId: encounter.encounterInstanceId,
      learnerId: LEARNER_ID,
      moment: "later",
      freeText: "Greener now.",
      createdAt: "2026-08-03T00:00:00.000Z",
    });
    const initial = createObservation({
      encounterInstanceId: encounter.encounterInstanceId,
      learnerId: LEARNER_ID,
      moment: "initial",
      freeText: "Very bright.",
      createdAt: "2026-08-01T00:00:00.000Z",
    });

    const record = buildLearnerRecord(
      // Deliberately persisted out of order to prove the builder sorts,
      // rather than trusting input order.
      emptyState({ encounterInstances: [encounter], observations: [later, initial] })
    );

    expect(record.encounters[0].observations.map((observation) => observation.freeText)).toEqual([
      "Very bright.",
      "Greener now.",
    ]);
  });

  it("orders top-level encounters descending by createdAt", () => {
    const older = createEncounterInstance({
      learnerId: LEARNER_ID,
      fragranceId: 1,
      createdAt: "2026-08-01T00:00:00.000Z",
    });
    const newer = createEncounterInstance({
      learnerId: LEARNER_ID,
      fragranceId: 2,
      createdAt: "2026-08-05T00:00:00.000Z",
    });

    const record = buildLearnerRecord(
      emptyState({ encounterInstances: [older, newer] })
    );

    expect(record.encounters.map((encounter) => encounter.encounterInstanceId)).toEqual([
      newer.encounterInstanceId,
      older.encounterInstanceId,
    ]);
  });

  it("preserves two encounters of the same fragrance as two distinct, un-merged projections", () => {
    const firstVisit = createEncounterInstance({
      learnerId: LEARNER_ID,
      fragranceId: 7,
      fragranceDisplaySnapshot: snapshotFor(7, "Fico di Amalfi"),
      createdAt: "2026-08-01T00:00:00.000Z",
    });
    const secondVisit = createEncounterInstance({
      learnerId: LEARNER_ID,
      fragranceId: 7,
      fragranceDisplaySnapshot: snapshotFor(7, "Fico di Amalfi"),
      createdAt: "2026-08-05T00:00:00.000Z",
    });
    const firstObservation = createObservation({
      encounterInstanceId: firstVisit.encounterInstanceId,
      learnerId: LEARNER_ID,
      moment: "initial",
      freeText: "Very bright.",
    });
    const secondObservation = createObservation({
      encounterInstanceId: secondVisit.encounterInstanceId,
      learnerId: LEARNER_ID,
      moment: "initial",
      freeText: "Greener than I remembered.",
    });

    const record = buildLearnerRecord(
      emptyState({
        encounterInstances: [firstVisit, secondVisit],
        observations: [firstObservation, secondObservation],
      })
    );

    expect(record.encounters).toHaveLength(2);
    expect(record.encounters.every((encounter) => encounter.fragranceId === 7)).toBe(true);
    expect(record.encounters.map((encounter) => encounter.observations[0].freeText).sort()).toEqual(
      ["Greener than I remembered.", "Very bright."]
    );
  });

  it("resolves a Comparison's first/second EncounterInstance projections and preserves their order", () => {
    const first = createEncounterInstance({
      learnerId: LEARNER_ID,
      fragranceId: 1,
      fragranceDisplaySnapshot: snapshotFor(1, "Fico di Amalfi"),
    });
    const second = createEncounterInstance({
      learnerId: LEARNER_ID,
      fragranceId: 2,
      fragranceDisplaySnapshot: snapshotFor(2, "Acqua di Gio EDT"),
    });
    const comparison = createComparison({
      learnerId: LEARNER_ID,
      firstEncounterInstanceId: first.encounterInstanceId,
      secondEncounterInstanceId: second.encounterInstanceId,
      freeText: "Fico feels softer; ADG feels sharper.",
    });

    const record = buildLearnerRecord(
      emptyState({ encounterInstances: [first, second], comparisons: [comparison] })
    );

    expect(record.comparisons[0].firstEncounter).toEqual({
      encounterInstanceId: first.encounterInstanceId,
      fragranceId: 1,
      fragranceDisplaySnapshot: snapshotFor(1, "Fico di Amalfi"),
    });
    expect(record.comparisons[0].secondEncounter).toEqual({
      encounterInstanceId: second.encounterInstanceId,
      fragranceId: 2,
      fragranceDisplaySnapshot: snapshotFor(2, "Acqua di Gio EDT"),
    });
  });

  it("orders comparisons descending by createdAt", () => {
    const encounterA = createEncounterInstance({ learnerId: LEARNER_ID, fragranceId: 1 });
    const encounterB = createEncounterInstance({ learnerId: LEARNER_ID, fragranceId: 2 });
    const encounterC = createEncounterInstance({ learnerId: LEARNER_ID, fragranceId: 3 });
    const older = createComparison({
      learnerId: LEARNER_ID,
      firstEncounterInstanceId: encounterA.encounterInstanceId,
      secondEncounterInstanceId: encounterB.encounterInstanceId,
      freeText: "older",
      createdAt: "2026-08-01T00:00:00.000Z",
    });
    const newer = createComparison({
      learnerId: LEARNER_ID,
      firstEncounterInstanceId: encounterB.encounterInstanceId,
      secondEncounterInstanceId: encounterC.encounterInstanceId,
      freeText: "newer",
      createdAt: "2026-08-05T00:00:00.000Z",
    });

    const record = buildLearnerRecord(
      emptyState({
        encounterInstances: [encounterA, encounterB, encounterC],
        comparisons: [older, newer],
      })
    );

    expect(record.comparisons.map((comparison) => comparison.freeText)).toEqual(["newer", "older"]);
  });

  it("does not recursively embed observations inside a comparison's encounter projections", () => {
    const first = createEncounterInstance({ learnerId: LEARNER_ID, fragranceId: 1 });
    const second = createEncounterInstance({ learnerId: LEARNER_ID, fragranceId: 2 });
    const observation = createObservation({
      encounterInstanceId: first.encounterInstanceId,
      learnerId: LEARNER_ID,
      moment: "initial",
      freeText: "On first.",
    });
    const comparison = createComparison({
      learnerId: LEARNER_ID,
      firstEncounterInstanceId: first.encounterInstanceId,
      secondEncounterInstanceId: second.encounterInstanceId,
      freeText: "x",
    });

    const record = buildLearnerRecord(
      emptyState({
        encounterInstances: [first, second],
        observations: [observation],
        comparisons: [comparison],
      })
    );

    expect(record.comparisons[0].firstEncounter).not.toHaveProperty("observations");
    expect(record.comparisons[0].secondEncounter).not.toHaveProperty("observations");
  });

  it("projects null for a Comparison's referenced encounter when it is absent, without throwing", () => {
    const only = createEncounterInstance({ learnerId: LEARNER_ID, fragranceId: 1 });
    // Hand-built: a Comparison referencing an EncounterInstance id that is
    // not present in encounterInstances. Real persisted state should never
    // reach the builder in this shape (loadPerceptualLearningState already
    // filters such orphans out), but the builder must degrade gracefully
    // rather than assume that guarantee.
    const comparisonWithMissingSecond = createComparison({
      learnerId: LEARNER_ID,
      firstEncounterInstanceId: only.encounterInstanceId,
      secondEncounterInstanceId: "encounter-does-not-exist",
      freeText: "x",
    });

    expect(() =>
      buildLearnerRecord(
        emptyState({
          encounterInstances: [only],
          comparisons: [comparisonWithMissingSecond],
        })
      )
    ).not.toThrow();

    const record = buildLearnerRecord(
      emptyState({
        encounterInstances: [only],
        comparisons: [comparisonWithMissingSecond],
      })
    );

    expect(record.comparisons[0].firstEncounter).not.toBeNull();
    expect(record.comparisons[0].secondEncounter).toBeNull();
  });

  describe("snapshot / catalog independence", () => {
    it("copies a persisted fragranceDisplaySnapshot through unchanged", () => {
      const encounter = createEncounterInstance({
        learnerId: LEARNER_ID,
        fragranceId: 1,
        fragranceDisplaySnapshot: snapshotFor(1, "Fico di Amalfi", "Aurelian"),
      });

      const record = buildLearnerRecord(emptyState({ encounterInstances: [encounter] }));

      expect(record.encounters[0].fragranceDisplaySnapshot).toEqual(
        snapshotFor(1, "Fico di Amalfi", "Aurelian")
      );
    });

    it("leaves a null fragranceDisplaySnapshot as null", () => {
      const encounter = createEncounterInstance({ learnerId: LEARNER_ID, fragranceId: 1 });

      const record = buildLearnerRecord(emptyState({ encounterInstances: [encounter] }));

      expect(record.encounters[0].fragranceDisplaySnapshot).toBeNull();
    });

    it("renders a fragrance with an id far outside any real catalog range purely from its snapshot", () => {
      // Proves there is no live-catalog lookup anywhere in the builder --
      // an id that could never resolve against aurelianCatalog still
      // projects correctly from persisted evidence alone.
      const encounter = createEncounterInstance({
        learnerId: LEARNER_ID,
        fragranceId: 999999,
        fragranceDisplaySnapshot: snapshotFor(999999, "Retired Fragrance"),
      });

      const record = buildLearnerRecord(emptyState({ encounterInstances: [encounter] }));

      expect(record.encounters[0]).toMatchObject({
        fragranceId: 999999,
        fragranceDisplaySnapshot: snapshotFor(999999, "Retired Fragrance"),
      });
    });
  });

  it("derives normally from a migrated-v1-compatible state (empty comparisons array)", () => {
    const encounter = createEncounterInstance({ learnerId: LEARNER_ID, fragranceId: 1 });
    const observation = createObservation({
      encounterInstanceId: encounter.encounterInstanceId,
      learnerId: LEARNER_ID,
      moment: "initial",
      freeText: "Bright.",
    });

    const record = buildLearnerRecord(
      emptyState({ encounterInstances: [encounter], observations: [observation], comparisons: [] })
    );

    expect(record.hasEvidence).toBe(true);
    expect(record.comparisons).toEqual([]);
    expect(record.encounters[0].observations.map((o) => o.freeText)).toEqual(["Bright."]);
  });

  it("preserves an Observation's and a Comparison's freeText verbatim, including surrounding whitespace", () => {
    const encounterA = createEncounterInstance({ learnerId: LEARNER_ID, fragranceId: 1 });
    const encounterB = createEncounterInstance({ learnerId: LEARNER_ID, fragranceId: 2 });
    const observation = createObservation({
      encounterInstanceId: encounterA.encounterInstanceId,
      learnerId: LEARNER_ID,
      moment: "initial",
      freeText: "  muy brillante  ",
    });
    const comparison = createComparison({
      learnerId: LEARNER_ID,
      firstEncounterInstanceId: encounterA.encounterInstanceId,
      secondEncounterInstanceId: encounterB.encounterInstanceId,
      freeText: "  más fría  ",
    });

    const record = buildLearnerRecord(
      emptyState({
        encounterInstances: [encounterA, encounterB],
        observations: [observation],
        comparisons: [comparison],
      })
    );

    expect(record.encounters.find((e) => e.encounterInstanceId === encounterA.encounterInstanceId).observations[0].freeText).toBe(
      "  muy brillante  "
    );
    expect(record.comparisons[0].freeText).toBe("  más fría  ");
  });

  it("does not mutate the input state", () => {
    const encounter = createEncounterInstance({ learnerId: LEARNER_ID, fragranceId: 1 });
    const observation = createObservation({
      encounterInstanceId: encounter.encounterInstanceId,
      learnerId: LEARNER_ID,
      moment: "initial",
      freeText: "Bright.",
    });
    const state = emptyState({ encounterInstances: [encounter], observations: [observation] });
    const stateSnapshot = JSON.parse(JSON.stringify(state));

    buildLearnerRecord(state);

    expect(JSON.parse(JSON.stringify(state))).toEqual(stateSnapshot);
  });

  it("does not expose mutable references consumers could use to corrupt source state", () => {
    const encounter = createEncounterInstance({
      learnerId: LEARNER_ID,
      fragranceId: 1,
      fragranceDisplaySnapshot: snapshotFor(1),
    });
    const state = emptyState({ encounterInstances: [encounter] });

    const record = buildLearnerRecord(state);

    // fragranceDisplaySnapshot is Object.freeze()'d by createEncounterInstance
    // itself -- attempting to mutate the reference the read model exposes
    // must not silently succeed and must not affect the source encounter.
    expect(() => {
      record.encounters[0].fragranceDisplaySnapshot.name = "Tampered";
    }).toThrow();
    expect(encounter.fragranceDisplaySnapshot.name).toBe(snapshotFor(1).name);

    // The projected observations array is the builder's own array, not the
    // source array -- mutating it must not affect a second derivation.
    record.encounters[0].observations.push({ fake: true });
    const rebuilt = buildLearnerRecord(state);
    expect(rebuilt.encounters[0].observations).toEqual([]);
  });

  it("exposes exactly the approved fields at every level -- no inferred/profile/capability data", () => {
    const first = createEncounterInstance({
      learnerId: LEARNER_ID,
      fragranceId: 1,
      fragranceDisplaySnapshot: snapshotFor(1),
    });
    const second = createEncounterInstance({ learnerId: LEARNER_ID, fragranceId: 2 });
    const observation = createObservation({
      encounterInstanceId: first.encounterInstanceId,
      learnerId: LEARNER_ID,
      moment: "initial",
      freeText: "Bright.",
    });
    const comparison = createComparison({
      learnerId: LEARNER_ID,
      firstEncounterInstanceId: first.encounterInstanceId,
      secondEncounterInstanceId: second.encounterInstanceId,
      freeText: "x",
    });

    const record = buildLearnerRecord(
      emptyState({
        encounterInstances: [first, second],
        observations: [observation],
        comparisons: [comparison],
      })
    );

    expect(Object.keys(record).sort()).toEqual(
      ["learnerId", "hasEvidence", "encounters", "comparisons"].sort()
    );

    const encounterProjection = record.encounters.find(
      (encounter) => encounter.encounterInstanceId === first.encounterInstanceId
    );
    expect(Object.keys(encounterProjection).sort()).toEqual(
      ["encounterInstanceId", "fragranceId", "fragranceDisplaySnapshot", "createdAt", "observations"].sort()
    );
    expect(Object.keys(encounterProjection.observations[0]).sort()).toEqual(
      ["observationId", "moment", "freeText", "createdAt"].sort()
    );

    const comparisonProjection = record.comparisons[0];
    expect(Object.keys(comparisonProjection).sort()).toEqual(
      ["comparisonId", "freeText", "createdAt", "firstEncounter", "secondEncounter"].sort()
    );
    expect(Object.keys(comparisonProjection.firstEncounter).sort()).toEqual(
      ["encounterInstanceId", "fragranceId", "fragranceDisplaySnapshot"].sort()
    );

    // No known inferred/profile/capability field name anywhere in the record.
    const serialized = JSON.stringify(record);
    for (const forbiddenKey of [
      "capabilityEstimate",
      "capability",
      "profile",
      "preference",
      "score",
      "rating",
      "confidence",
      "tasteProfile",
    ]) {
      expect(serialized.toLowerCase()).not.toContain(forbiddenKey.toLowerCase());
    }
  });
});
