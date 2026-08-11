import { describe, expect, it } from "vitest";
import { createObservation, isValidPersistedObservation } from "./observation.js";

describe("createObservation", () => {
  it("creates a valid record with moment 'initial'", () => {
    const observation = createObservation({
      encounterInstanceId: "enc-1",
      learnerId: "learner-1",
      moment: "initial",
      freeText: "Huele a cítrico.",
    });

    expect(observation).toMatchObject({
      encounterInstanceId: "enc-1",
      learnerId: "learner-1",
      moment: "initial",
      freeText: "Huele a cítrico.",
    });
    expect(typeof observation.observationId).toBe("string");
    expect(observation.observationId.length).toBeGreaterThan(0);
    expect(typeof observation.createdAt).toBe("string");
  });

  it("creates a valid record with moment 'later'", () => {
    const observation = createObservation({
      encounterInstanceId: "enc-1",
      learnerId: "learner-1",
      moment: "later",
      freeText: "Cambió, ahora es más suave.",
    });

    expect(observation.moment).toBe("later");
  });

  it("rejects blank freeText", () => {
    expect(() =>
      createObservation({
        encounterInstanceId: "enc-1",
        learnerId: "learner-1",
        moment: "initial",
        freeText: "",
      })
    ).toThrow();
    expect(() =>
      createObservation({
        encounterInstanceId: "enc-1",
        learnerId: "learner-1",
        moment: "initial",
        freeText: "   ",
      })
    ).toThrow();
    expect(() =>
      createObservation({
        encounterInstanceId: "enc-1",
        learnerId: "learner-1",
        moment: "initial",
        freeText: undefined,
      })
    ).toThrow();
  });

  it("preserves the submitted freeText verbatim, including surrounding whitespace", () => {
    const observation = createObservation({
      encounterInstanceId: "enc-1",
      learnerId: "learner-1",
      moment: "initial",
      freeText: "  huele fresco  ",
    });

    expect(observation.freeText).toBe("  huele fresco  ");
  });

  it("rejects an invalid moment", () => {
    expect(() =>
      createObservation({
        encounterInstanceId: "enc-1",
        learnerId: "learner-1",
        moment: "drydown",
        freeText: "x",
      })
    ).toThrow();
    expect(() =>
      createObservation({
        encounterInstanceId: "enc-1",
        learnerId: "learner-1",
        moment: "opening",
        freeText: "x",
      })
    ).toThrow();
    expect(() =>
      createObservation({
        encounterInstanceId: "enc-1",
        learnerId: "learner-1",
        moment: null,
        freeText: "x",
      })
    ).toThrow();
  });

  it("rejects missing encounterInstanceId/learnerId", () => {
    expect(() =>
      createObservation({ learnerId: "learner-1", moment: "initial", freeText: "x" })
    ).toThrow();
    expect(() =>
      createObservation({ encounterInstanceId: "enc-1", moment: "initial", freeText: "x" })
    ).toThrow();
  });

  it("throws when a non-null comparisonRef, structuredContrastAnswer, or confidence is supplied", () => {
    const validInput = {
      encounterInstanceId: "enc-1",
      learnerId: "learner-1",
      moment: "initial",
      freeText: "x",
    };

    expect(() =>
      createObservation({ ...validInput, comparisonRef: { type: "self-temporal", targetId: "obs-0" } })
    ).toThrow();
    expect(() =>
      createObservation({ ...validInput, structuredContrastAnswer: { axis: "brightness", choice: "A" } })
    ).toThrow();
    expect(() => createObservation({ ...validInput, confidence: "confident" })).toThrow();
  });

  it("accepts an explicit null for comparisonRef/structuredContrastAnswer/confidence the same as omitting them", () => {
    const observation = createObservation({
      encounterInstanceId: "enc-1",
      learnerId: "learner-1",
      moment: "initial",
      freeText: "x",
      comparisonRef: null,
      structuredContrastAnswer: null,
      confidence: null,
    });

    expect(observation).not.toHaveProperty("comparisonRef");
    expect(observation).not.toHaveProperty("structuredContrastAnswer");
    expect(observation).not.toHaveProperty("confidence");
  });

  it("produces exactly the Phase-1 persisted keys, no speculative fields", () => {
    const observation = createObservation({
      encounterInstanceId: "enc-1",
      learnerId: "learner-1",
      moment: "initial",
      freeText: "x",
    });

    expect(Object.keys(observation).sort()).toEqual(
      ["createdAt", "encounterInstanceId", "freeText", "learnerId", "moment", "observationId"].sort()
    );
    expect(observation).not.toHaveProperty("comparisonRef");
    expect(observation).not.toHaveProperty("structuredContrastAnswer");
    expect(observation).not.toHaveProperty("confidence");
  });

  it("returns a frozen (append-only-by-architecture) record", () => {
    const observation = createObservation({
      encounterInstanceId: "enc-1",
      learnerId: "learner-1",
      moment: "initial",
      freeText: "x",
    });

    expect(Object.isFrozen(observation)).toBe(true);
  });
});

describe("isValidPersistedObservation", () => {
  function validRecord(overrides = {}) {
    return {
      observationId: "obs-1",
      encounterInstanceId: "enc-1",
      learnerId: "learner-1",
      moment: "initial",
      freeText: "x",
      createdAt: "2026-08-10T00:00:00.000Z",
      ...overrides,
    };
  }

  it("accepts a valid record", () => {
    expect(isValidPersistedObservation(validRecord())).toBe(true);
    expect(isValidPersistedObservation(validRecord({ moment: "later" }))).toBe(true);
  });

  it("rejects an invalid moment", () => {
    expect(isValidPersistedObservation(validRecord({ moment: "drydown" }))).toBe(false);
  });

  it("rejects blank freeText", () => {
    expect(isValidPersistedObservation(validRecord({ freeText: "" }))).toBe(false);
    expect(isValidPersistedObservation(validRecord({ freeText: "   " }))).toBe(false);
  });

  it("rejects a Phase-2 speculative field present on the record", () => {
    expect(
      isValidPersistedObservation({ ...validRecord(), comparisonRef: { type: "self-temporal" } })
    ).toBe(false);
    expect(
      isValidPersistedObservation({ ...validRecord(), structuredContrastAnswer: { axis: "x" } })
    ).toBe(false);
    expect(isValidPersistedObservation({ ...validRecord(), confidence: "confident" })).toBe(false);
  });

  it("rejects a non-object", () => {
    expect(isValidPersistedObservation(null)).toBe(false);
    expect(isValidPersistedObservation("string")).toBe(false);
  });
});
