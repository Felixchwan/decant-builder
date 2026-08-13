import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { buildEvidenceRevisit } from "./evidenceRevisit.js";
import { buildLearnerRecord } from "./learnerRecord.js";
import { createEncounterInstance } from "./encounterInstance.js";
import { createObservation } from "./observation.js";
import { createComparison } from "./comparison.js";

const LEARNER_ID = "learner-1";

function persistedState(overrides = {}) {
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

function emptyLearnerRecord() {
  return { learnerId: null, hasEvidence: false, encounters: [], comparisons: [] };
}

describe("buildEvidenceRevisit", () => {
  it("returns the requested fragranceId, hasPriorEvidence false, and empty arrays for an empty LearnerRecord (item 1)", () => {
    const result = buildEvidenceRevisit({ learnerRecord: emptyLearnerRecord(), fragranceId: 42 });

    expect(result).toEqual({
      fragranceId: 42,
      hasPriorEvidence: false,
      encounters: [],
      comparisons: [],
    });
  });

  it("excludes evidence for unrelated fragrances (item 2)", () => {
    const encounter = createEncounterInstance({ learnerId: LEARNER_ID, fragranceId: 1 });
    const observation = createObservation({
      encounterInstanceId: encounter.encounterInstanceId,
      learnerId: LEARNER_ID,
      moment: "initial",
      freeText: "On fragrance 1.",
    });
    const learnerRecord = buildLearnerRecord(
      persistedState({ encounterInstances: [encounter], observations: [observation] })
    );

    const result = buildEvidenceRevisit({ learnerRecord, fragranceId: 999 });

    expect(result).toEqual({
      fragranceId: 999,
      hasPriorEvidence: false,
      encounters: [],
      comparisons: [],
    });
  });

  it("includes a matching encounter with one Observation, with hasPriorEvidence true (item 3)", () => {
    const encounter = createEncounterInstance({ learnerId: LEARNER_ID, fragranceId: 1 });
    const observation = createObservation({
      encounterInstanceId: encounter.encounterInstanceId,
      learnerId: LEARNER_ID,
      moment: "initial",
      freeText: "Bright.",
    });
    const learnerRecord = buildLearnerRecord(
      persistedState({ encounterInstances: [encounter], observations: [observation] })
    );

    const result = buildEvidenceRevisit({ learnerRecord, fragranceId: 1 });

    expect(result.hasPriorEvidence).toBe(true);
    expect(result.encounters).toHaveLength(1);
    expect(result.encounters[0].observations.map((o) => o.freeText)).toEqual(["Bright."]);
  });

  it("preserves a matching zero-Observation, no-Comparison encounter, but hasPriorEvidence remains false (item 4)", () => {
    const encounter = createEncounterInstance({ learnerId: LEARNER_ID, fragranceId: 1 });
    const learnerRecord = buildLearnerRecord(persistedState({ encounterInstances: [encounter] }));

    const result = buildEvidenceRevisit({ learnerRecord, fragranceId: 1 });

    expect(result.encounters).toHaveLength(1);
    expect(result.encounters[0].encounterInstanceId).toBe(encounter.encounterInstanceId);
    expect(result.hasPriorEvidence).toBe(false);
  });

  it("keeps multiple matching encounters of the same fragrance separate, un-merged (item 5)", () => {
    const first = createEncounterInstance({
      learnerId: LEARNER_ID,
      fragranceId: 7,
      createdAt: "2026-08-01T00:00:00.000Z",
    });
    const second = createEncounterInstance({
      learnerId: LEARNER_ID,
      fragranceId: 7,
      createdAt: "2026-08-05T00:00:00.000Z",
    });
    const observationFirst = createObservation({
      encounterInstanceId: first.encounterInstanceId,
      learnerId: LEARNER_ID,
      moment: "initial",
      freeText: "Very bright.",
    });
    const observationSecond = createObservation({
      encounterInstanceId: second.encounterInstanceId,
      learnerId: LEARNER_ID,
      moment: "initial",
      freeText: "Greener than I remembered.",
    });
    const learnerRecord = buildLearnerRecord(
      persistedState({
        encounterInstances: [first, second],
        observations: [observationFirst, observationSecond],
      })
    );

    const result = buildEvidenceRevisit({ learnerRecord, fragranceId: 7 });

    expect(result.encounters).toHaveLength(2);
    expect(result.encounters.map((e) => e.observations[0].freeText).sort()).toEqual([
      "Greener than I remembered.",
      "Very bright.",
    ]);
  });

  it("attaches each Observation only to its own encounter, with no cross-encounter leakage (item 6)", () => {
    const encounterA = createEncounterInstance({ learnerId: LEARNER_ID, fragranceId: 1 });
    const encounterB = createEncounterInstance({ learnerId: LEARNER_ID, fragranceId: 1 });
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
    const learnerRecord = buildLearnerRecord(
      persistedState({
        encounterInstances: [encounterA, encounterB],
        observations: [observationA, observationB],
      })
    );

    const result = buildEvidenceRevisit({ learnerRecord, fragranceId: 1 });

    const projectedA = result.encounters.find((e) => e.encounterInstanceId === encounterA.encounterInstanceId);
    const projectedB = result.encounters.find((e) => e.encounterInstanceId === encounterB.encounterInstanceId);
    expect(projectedA.observations.map((o) => o.freeText)).toEqual(["On A."]);
    expect(projectedB.observations.map((o) => o.freeText)).toEqual(["On B."]);
  });

  it("keeps repeated Observations on the same encounter repeated, with no deduplication (item 7)", () => {
    const encounter = createEncounterInstance({ learnerId: LEARNER_ID, fragranceId: 1 });
    const first = createObservation({
      encounterInstanceId: encounter.encounterInstanceId,
      learnerId: LEARNER_ID,
      moment: "initial",
      freeText: "Bright.",
      createdAt: "2026-08-01T00:00:00.000Z",
    });
    const second = createObservation({
      encounterInstanceId: encounter.encounterInstanceId,
      learnerId: LEARNER_ID,
      moment: "later",
      freeText: "Bright.",
      createdAt: "2026-08-02T00:00:00.000Z",
    });
    const learnerRecord = buildLearnerRecord(
      persistedState({ encounterInstances: [encounter], observations: [first, second] })
    );

    const result = buildEvidenceRevisit({ learnerRecord, fragranceId: 1 });

    expect(result.encounters[0].observations).toHaveLength(2);
    expect(result.encounters[0].observations.map((o) => o.freeText)).toEqual(["Bright.", "Bright."]);
  });

  it("includes a Comparison where the requested fragrance is first, preserving first/second order (item 8)", () => {
    const first = createEncounterInstance({
      learnerId: LEARNER_ID,
      fragranceId: 1,
      fragranceDisplaySnapshot: snapshotFor(1, "Prada L'Homme"),
    });
    const second = createEncounterInstance({
      learnerId: LEARNER_ID,
      fragranceId: 2,
      fragranceDisplaySnapshot: snapshotFor(2, "Gentleman EDP"),
    });
    const comparison = createComparison({
      learnerId: LEARNER_ID,
      firstEncounterInstanceId: first.encounterInstanceId,
      secondEncounterInstanceId: second.encounterInstanceId,
      freeText: "A is softer.",
    });
    const learnerRecord = buildLearnerRecord(
      persistedState({ encounterInstances: [first, second], comparisons: [comparison] })
    );

    const result = buildEvidenceRevisit({ learnerRecord, fragranceId: 1 });

    expect(result.comparisons).toHaveLength(1);
    expect(result.comparisons[0].firstEncounter.fragranceId).toBe(1);
    expect(result.comparisons[0].secondEncounter.fragranceId).toBe(2);
  });

  it("includes a Comparison where the requested fragrance is second, preserving first/second order (item 9)", () => {
    const first = createEncounterInstance({
      learnerId: LEARNER_ID,
      fragranceId: 1,
      fragranceDisplaySnapshot: snapshotFor(1, "Prada L'Homme"),
    });
    const second = createEncounterInstance({
      learnerId: LEARNER_ID,
      fragranceId: 2,
      fragranceDisplaySnapshot: snapshotFor(2, "Gentleman EDP"),
    });
    const comparison = createComparison({
      learnerId: LEARNER_ID,
      firstEncounterInstanceId: first.encounterInstanceId,
      secondEncounterInstanceId: second.encounterInstanceId,
      freeText: "A is softer.",
    });
    const learnerRecord = buildLearnerRecord(
      persistedState({ encounterInstances: [first, second], comparisons: [comparison] })
    );

    const result = buildEvidenceRevisit({ learnerRecord, fragranceId: 2 });

    expect(result.comparisons).toHaveLength(1);
    // Still first/second, never reoriented to "target"/"other" -- fragrance 2
    // stays secondEncounter even though it was the query subject.
    expect(result.comparisons[0].firstEncounter.fragranceId).toBe(1);
    expect(result.comparisons[0].secondEncounter.fragranceId).toBe(2);
  });

  it("excludes a Comparison that does not involve the requested fragrance on either side (item 10)", () => {
    const first = createEncounterInstance({ learnerId: LEARNER_ID, fragranceId: 1 });
    const second = createEncounterInstance({ learnerId: LEARNER_ID, fragranceId: 2 });
    const comparison = createComparison({
      learnerId: LEARNER_ID,
      firstEncounterInstanceId: first.encounterInstanceId,
      secondEncounterInstanceId: second.encounterInstanceId,
      freeText: "x",
    });
    const learnerRecord = buildLearnerRecord(
      persistedState({ encounterInstances: [first, second], comparisons: [comparison] })
    );

    const result = buildEvidenceRevisit({ learnerRecord, fragranceId: 999 });

    expect(result.comparisons).toEqual([]);
  });

  it("keeps repeated Comparisons of the same fragrance/pair separate, with no deduplication (item 11)", () => {
    const first = createEncounterInstance({ learnerId: LEARNER_ID, fragranceId: 1 });
    const second = createEncounterInstance({ learnerId: LEARNER_ID, fragranceId: 2 });
    const comparisonA = createComparison({
      learnerId: LEARNER_ID,
      firstEncounterInstanceId: first.encounterInstanceId,
      secondEncounterInstanceId: second.encounterInstanceId,
      freeText: "First time comparing these.",
      createdAt: "2026-08-01T00:00:00.000Z",
    });
    const comparisonB = createComparison({
      learnerId: LEARNER_ID,
      firstEncounterInstanceId: first.encounterInstanceId,
      secondEncounterInstanceId: second.encounterInstanceId,
      freeText: "Comparing again, same pair.",
      createdAt: "2026-08-02T00:00:00.000Z",
    });
    const learnerRecord = buildLearnerRecord(
      persistedState({
        encounterInstances: [first, second],
        comparisons: [comparisonA, comparisonB],
      })
    );

    const result = buildEvidenceRevisit({ learnerRecord, fragranceId: 1 });

    expect(result.comparisons).toHaveLength(2);
    expect(result.comparisons.map((c) => c.freeText)).toEqual([
      "Comparing again, same pair.",
      "First time comparing these.",
    ]);
  });

  it("reports hasPriorEvidence true from Comparison-only evidence against a zero-Observation encounter (item 12)", () => {
    const encounterA = createEncounterInstance({ learnerId: LEARNER_ID, fragranceId: 1 });
    const encounterB = createEncounterInstance({ learnerId: LEARNER_ID, fragranceId: 2 });
    const comparison = createComparison({
      learnerId: LEARNER_ID,
      firstEncounterInstanceId: encounterA.encounterInstanceId,
      secondEncounterInstanceId: encounterB.encounterInstanceId,
      freeText: "x",
    });
    const learnerRecord = buildLearnerRecord(
      persistedState({ encounterInstances: [encounterA, encounterB], comparisons: [comparison] })
    );

    const result = buildEvidenceRevisit({ learnerRecord, fragranceId: 1 });

    expect(result.encounters[0].observations).toEqual([]);
    expect(result.comparisons).toHaveLength(1);
    expect(result.hasPriorEvidence).toBe(true);
  });

  it("reports hasPriorEvidence false for an encounter-only match plus an unrelated Comparison (item 13)", () => {
    const encounterA = createEncounterInstance({ learnerId: LEARNER_ID, fragranceId: 1 });
    const encounterB = createEncounterInstance({ learnerId: LEARNER_ID, fragranceId: 2 });
    const encounterC = createEncounterInstance({ learnerId: LEARNER_ID, fragranceId: 3 });
    const unrelatedComparison = createComparison({
      learnerId: LEARNER_ID,
      firstEncounterInstanceId: encounterB.encounterInstanceId,
      secondEncounterInstanceId: encounterC.encounterInstanceId,
      freeText: "x",
    });
    const learnerRecord = buildLearnerRecord(
      persistedState({
        encounterInstances: [encounterA, encounterB, encounterC],
        comparisons: [unrelatedComparison],
      })
    );

    const result = buildEvidenceRevisit({ learnerRecord, fragranceId: 1 });

    expect(result.encounters).toHaveLength(1);
    expect(result.comparisons).toEqual([]);
    expect(result.hasPriorEvidence).toBe(false);
  });

  it("still works for a fragranceId far outside any real catalog range, proving no catalog dependency (item 14)", () => {
    const encounter = createEncounterInstance({
      learnerId: LEARNER_ID,
      fragranceId: 999999,
      fragranceDisplaySnapshot: snapshotFor(999999, "Retired Fragrance"),
    });
    const observation = createObservation({
      encounterInstanceId: encounter.encounterInstanceId,
      learnerId: LEARNER_ID,
      moment: "initial",
      freeText: "Bright.",
    });
    const learnerRecord = buildLearnerRecord(
      persistedState({ encounterInstances: [encounter], observations: [observation] })
    );

    const result = buildEvidenceRevisit({ learnerRecord, fragranceId: 999999 });

    expect(result.hasPriorEvidence).toBe(true);
    expect(result.encounters[0].fragranceDisplaySnapshot).toEqual(
      snapshotFor(999999, "Retired Fragrance")
    );
  });

  it("preserves a null fragranceDisplaySnapshot safely (item 15)", () => {
    const encounter = createEncounterInstance({ learnerId: LEARNER_ID, fragranceId: 1 });
    const learnerRecord = buildLearnerRecord(persistedState({ encounterInstances: [encounter] }));

    const result = buildEvidenceRevisit({ learnerRecord, fragranceId: 1 });

    expect(result.encounters[0].fragranceDisplaySnapshot).toBeNull();
  });

  it("does not throw on a missing/null Comparison encounter reference, and determines relevance only from the available side (item 16)", () => {
    const only = createEncounterInstance({ learnerId: LEARNER_ID, fragranceId: 1 });
    // Hand-built LearnerRecord-shaped fixture: secondEncounter already null,
    // exactly as buildLearnerRecord itself would project an orphaned
    // reference (see learnerRecord.test.js's own equivalent fixture).
    const learnerRecord = {
      learnerId: LEARNER_ID,
      hasEvidence: true,
      encounters: [
        {
          encounterInstanceId: only.encounterInstanceId,
          fragranceId: 1,
          fragranceDisplaySnapshot: null,
          createdAt: only.createdAt,
          observations: [],
        },
      ],
      comparisons: [
        {
          comparisonId: "cmp-1",
          freeText: "x",
          createdAt: "2026-08-01T00:00:00.000Z",
          firstEncounter: {
            encounterInstanceId: only.encounterInstanceId,
            fragranceId: 1,
            fragranceDisplaySnapshot: null,
          },
          secondEncounter: null,
        },
      ],
    };

    expect(() => buildEvidenceRevisit({ learnerRecord, fragranceId: 1 })).not.toThrow();
    const matched = buildEvidenceRevisit({ learnerRecord, fragranceId: 1 });
    expect(matched.comparisons).toHaveLength(1);
    expect(matched.hasPriorEvidence).toBe(true);

    expect(() => buildEvidenceRevisit({ learnerRecord, fragranceId: 999 })).not.toThrow();
    const unmatched = buildEvidenceRevisit({ learnerRecord, fragranceId: 999 });
    expect(unmatched.comparisons).toEqual([]);
  });

  describe("deterministic ordering (item 17)", () => {
    it("keeps encounters newest-first, observations oldest-first, and comparisons newest-first, inherited from LearnerRecord", () => {
      const older = createEncounterInstance({
        learnerId: LEARNER_ID,
        fragranceId: 1,
        createdAt: "2026-08-01T00:00:00.000Z",
      });
      const newer = createEncounterInstance({
        learnerId: LEARNER_ID,
        fragranceId: 1,
        createdAt: "2026-08-05T00:00:00.000Z",
      });
      const laterObservation = createObservation({
        encounterInstanceId: older.encounterInstanceId,
        learnerId: LEARNER_ID,
        moment: "later",
        freeText: "Later.",
        createdAt: "2026-08-02T00:00:00.000Z",
      });
      const initialObservation = createObservation({
        encounterInstanceId: older.encounterInstanceId,
        learnerId: LEARNER_ID,
        moment: "initial",
        freeText: "Initial.",
        createdAt: "2026-08-01T00:00:00.000Z",
      });
      const otherEncounter = createEncounterInstance({ learnerId: LEARNER_ID, fragranceId: 2 });
      const olderComparison = createComparison({
        learnerId: LEARNER_ID,
        firstEncounterInstanceId: older.encounterInstanceId,
        secondEncounterInstanceId: otherEncounter.encounterInstanceId,
        freeText: "older comparison",
        createdAt: "2026-08-01T00:00:00.000Z",
      });
      const newerComparison = createComparison({
        learnerId: LEARNER_ID,
        firstEncounterInstanceId: newer.encounterInstanceId,
        secondEncounterInstanceId: otherEncounter.encounterInstanceId,
        freeText: "newer comparison",
        createdAt: "2026-08-05T00:00:00.000Z",
      });
      const learnerRecord = buildLearnerRecord(
        persistedState({
          encounterInstances: [older, newer, otherEncounter],
          // Deliberately persisted out of order.
          observations: [laterObservation, initialObservation],
          comparisons: [olderComparison, newerComparison],
        })
      );

      const result = buildEvidenceRevisit({ learnerRecord, fragranceId: 1 });

      expect(result.encounters.map((e) => e.encounterInstanceId)).toEqual([
        newer.encounterInstanceId,
        older.encounterInstanceId,
      ]);
      const olderProjection = result.encounters.find((e) => e.encounterInstanceId === older.encounterInstanceId);
      expect(olderProjection.observations.map((o) => o.freeText)).toEqual(["Initial.", "Later."]);
      expect(result.comparisons.map((c) => c.freeText)).toEqual(["newer comparison", "older comparison"]);
    });
  });

  it("preserves freeText verbatim, with no trimming/normalization (item 18)", () => {
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
    const learnerRecord = buildLearnerRecord(
      persistedState({
        encounterInstances: [encounterA, encounterB],
        observations: [observation],
        comparisons: [comparison],
      })
    );

    const result = buildEvidenceRevisit({ learnerRecord, fragranceId: 1 });

    expect(result.encounters[0].observations[0].freeText).toBe("  muy brillante  ");
    expect(result.comparisons[0].freeText).toBe("  más fría  ");
  });

  it("does not mutate the input LearnerRecord (item 19)", () => {
    const encounter = createEncounterInstance({ learnerId: LEARNER_ID, fragranceId: 1 });
    const observation = createObservation({
      encounterInstanceId: encounter.encounterInstanceId,
      learnerId: LEARNER_ID,
      moment: "initial",
      freeText: "Bright.",
    });
    const learnerRecord = buildLearnerRecord(
      persistedState({ encounterInstances: [encounter], observations: [observation] })
    );
    const snapshot = JSON.parse(JSON.stringify(learnerRecord));

    buildEvidenceRevisit({ learnerRecord, fragranceId: 1 });

    expect(JSON.parse(JSON.stringify(learnerRecord))).toEqual(snapshot);
  });

  it("returns safe projections, not source-array aliases -- mutating the result must not affect the input LearnerRecord (item 20)", () => {
    const encounter = createEncounterInstance({ learnerId: LEARNER_ID, fragranceId: 1 });
    const observation = createObservation({
      encounterInstanceId: encounter.encounterInstanceId,
      learnerId: LEARNER_ID,
      moment: "initial",
      freeText: "Bright.",
    });
    const learnerRecord = buildLearnerRecord(
      persistedState({ encounterInstances: [encounter], observations: [observation] })
    );

    const result = buildEvidenceRevisit({ learnerRecord, fragranceId: 1 });
    result.encounters.push({ fake: true });
    result.encounters[0].observations.push({ fake: true });
    result.comparisons.push({ fake: true });

    expect(learnerRecord.encounters).toHaveLength(1);
    expect(learnerRecord.encounters[0].observations).toHaveLength(1);
    expect(learnerRecord.comparisons).toHaveLength(0);

    // A second derivation from the same (untouched) input proves the first
    // result's arrays were never aliases of anything reused internally.
    const rebuilt = buildEvidenceRevisit({ learnerRecord, fragranceId: 1 });
    expect(rebuilt.encounters).toHaveLength(1);
    expect(rebuilt.encounters[0].observations).toHaveLength(1);
  });

  it("exposes exactly the approved fields at every level (item 21)", () => {
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
    const learnerRecord = buildLearnerRecord(
      persistedState({
        encounterInstances: [first, second],
        observations: [observation],
        comparisons: [comparison],
      })
    );

    const result = buildEvidenceRevisit({ learnerRecord, fragranceId: 1 });

    expect(Object.keys(result).sort()).toEqual(
      ["fragranceId", "hasPriorEvidence", "encounters", "comparisons"].sort()
    );
    expect(Object.keys(result.encounters[0]).sort()).toEqual(
      ["encounterInstanceId", "fragranceId", "fragranceDisplaySnapshot", "createdAt", "observations"].sort()
    );
    expect(Object.keys(result.encounters[0].observations[0]).sort()).toEqual(
      ["observationId", "moment", "freeText", "createdAt"].sort()
    );
    expect(Object.keys(result.comparisons[0]).sort()).toEqual(
      ["comparisonId", "freeText", "createdAt", "firstEncounter", "secondEncounter"].sort()
    );
    expect(Object.keys(result.comparisons[0].firstEncounter).sort()).toEqual(
      ["encounterInstanceId", "fragranceId", "fragranceDisplaySnapshot", "createdAt"].sort()
    );
  });

  it("contains no profile/preference/score/rating/confidence-style field names anywhere -- checked structurally, not by scanning learner-authored freeText (item 22)", () => {
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
      // Deliberately contains words that would trip a naive text scan --
      // proves the assertion below inspects field names, not this string.
      freeText: "Prefiero esta, le doy un score alto y tengo mucha confianza en mi rating.",
    });
    const comparison = createComparison({
      learnerId: LEARNER_ID,
      firstEncounterInstanceId: first.encounterInstanceId,
      secondEncounterInstanceId: second.encounterInstanceId,
      freeText: "x",
    });
    const learnerRecord = buildLearnerRecord(
      persistedState({
        encounterInstances: [first, second],
        observations: [observation],
        comparisons: [comparison],
      })
    );

    const result = buildEvidenceRevisit({ learnerRecord, fragranceId: 1 });

    const keyNames = collectKeyNames(result);
    const forbidden = [
      "insight",
      "summary",
      "profile",
      "preference",
      "capability",
      "capabilityEstimate",
      "score",
      "rating",
      "confidence",
      "trend",
      "progress",
      "consistency",
      "recommendation",
      "affinity",
      "importance",
      "frequencyScore",
      "tasteProfile",
    ];
    for (const key of keyNames) {
      expect(forbidden.map((f) => f.toLowerCase())).not.toContain(key.toLowerCase());
    }
  });

  describe("same-fragrance (temporal) Comparison, both sides matching the queried fragranceId (Phase 6.0)", () => {
    // The Phase 6.0 investigation verified by direct code reading that
    // Array.prototype.filter's OR-predicate here cannot duplicate an
    // element -- this locks that finding in as an explicit regression test
    // now that a real same-fragrance Comparison is reachable end-to-end.
    it("includes the Comparison exactly once, never twice, when both firstEncounter and secondEncounter match the queried fragranceId", () => {
      const encounterA = createEncounterInstance({ learnerId: LEARNER_ID, fragranceId: 1 });
      const encounterB = createEncounterInstance({ learnerId: LEARNER_ID, fragranceId: 1 });
      const comparison = createComparison({
        learnerId: LEARNER_ID,
        firstEncounterInstanceId: encounterA.encounterInstanceId,
        secondEncounterInstanceId: encounterB.encounterInstanceId,
        freeText: "Hoy se siente distinto a como lo recordaba.",
      });
      const learnerRecord = buildLearnerRecord(
        persistedState({ encounterInstances: [encounterA, encounterB], comparisons: [comparison] })
      );

      const result = buildEvidenceRevisit({ learnerRecord, fragranceId: 1 });

      expect(result.comparisons).toHaveLength(1);
      expect(result.comparisons[0].comparisonId).toBe(comparison.comparisonId);
    });
  });

  describe("no imports at all -- self-contained, matching learnerRecord.js's own design", () => {
    it("has zero import statements", () => {
      const source = readFileSync(
        fileURLToPath(new URL("./evidenceRevisit.js", import.meta.url)),
        "utf8"
      );

      expect(source).not.toMatch(/^import /m);
    });
  });
});

function collectKeyNames(value, keys = new Set()) {
  if (Array.isArray(value)) {
    for (const item of value) collectKeyNames(item, keys);
  } else if (value && typeof value === "object") {
    for (const key of Object.keys(value)) {
      keys.add(key);
      collectKeyNames(value[key], keys);
    }
  }
  return keys;
}
