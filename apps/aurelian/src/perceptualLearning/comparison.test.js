import { describe, expect, it } from "vitest";
import { createComparison, isValidPersistedComparison } from "./comparison.js";

describe("createComparison", () => {
  it("creates a valid record", () => {
    const comparison = createComparison({
      learnerId: "learner-1",
      firstEncounterInstanceId: "enc-a",
      secondEncounterInstanceId: "enc-b",
      freeText: "Esta se siente más fría y afilada; la otra más suave y redonda.",
    });

    expect(comparison).toMatchObject({
      learnerId: "learner-1",
      firstEncounterInstanceId: "enc-a",
      secondEncounterInstanceId: "enc-b",
      freeText: "Esta se siente más fría y afilada; la otra más suave y redonda.",
    });
    expect(typeof comparison.comparisonId).toBe("string");
    expect(comparison.comparisonId.length).toBeGreaterThan(0);
    expect(typeof comparison.createdAt).toBe("string");
  });

  it("produces exactly the persisted keys, no speculative fields", () => {
    const comparison = createComparison({
      learnerId: "learner-1",
      firstEncounterInstanceId: "enc-a",
      secondEncounterInstanceId: "enc-b",
      freeText: "x",
    });

    expect(Object.keys(comparison).sort()).toEqual(
      [
        "comparisonId",
        "learnerId",
        "firstEncounterInstanceId",
        "secondEncounterInstanceId",
        "freeText",
        "createdAt",
      ].sort()
    );
    expect(comparison).not.toHaveProperty("rating");
    expect(comparison).not.toHaveProperty("preference");
    expect(comparison).not.toHaveProperty("confidence");
    expect(comparison).not.toHaveProperty("structuredContrastAnswer");
    expect(comparison).not.toHaveProperty("fragranceId");
  });

  it("returns a frozen (immutable-by-convention) record", () => {
    const comparison = createComparison({
      learnerId: "learner-1",
      firstEncounterInstanceId: "enc-a",
      secondEncounterInstanceId: "enc-b",
      freeText: "x",
    });

    expect(Object.isFrozen(comparison)).toBe(true);
  });

  it("throws on blank freeText", () => {
    expect(() =>
      createComparison({
        learnerId: "learner-1",
        firstEncounterInstanceId: "enc-a",
        secondEncounterInstanceId: "enc-b",
        freeText: "",
      })
    ).toThrow();
    expect(() =>
      createComparison({
        learnerId: "learner-1",
        firstEncounterInstanceId: "enc-a",
        secondEncounterInstanceId: "enc-b",
        freeText: "   ",
      })
    ).toThrow();
  });

  it("preserves the submitted freeText verbatim, including surrounding whitespace", () => {
    const comparison = createComparison({
      learnerId: "learner-1",
      firstEncounterInstanceId: "enc-a",
      secondEncounterInstanceId: "enc-b",
      freeText: "  más fría  ",
    });

    expect(comparison.freeText).toBe("  más fría  ");
  });

  it("throws when the two EncounterInstance ids are the same", () => {
    expect(() =>
      createComparison({
        learnerId: "learner-1",
        firstEncounterInstanceId: "enc-a",
        secondEncounterInstanceId: "enc-a",
        freeText: "x",
      })
    ).toThrow();
  });

  it("throws on missing learnerId or either encounter id", () => {
    expect(() =>
      createComparison({ firstEncounterInstanceId: "enc-a", secondEncounterInstanceId: "enc-b", freeText: "x" })
    ).toThrow();
    expect(() =>
      createComparison({ learnerId: "learner-1", secondEncounterInstanceId: "enc-b", freeText: "x" })
    ).toThrow();
    expect(() =>
      createComparison({ learnerId: "learner-1", firstEncounterInstanceId: "enc-a", freeText: "x" })
    ).toThrow();
  });
});

describe("isValidPersistedComparison", () => {
  function validRecord(overrides = {}) {
    return {
      comparisonId: "cmp-1",
      learnerId: "learner-1",
      firstEncounterInstanceId: "enc-a",
      secondEncounterInstanceId: "enc-b",
      freeText: "x",
      createdAt: "2026-08-10T00:00:00.000Z",
      ...overrides,
    };
  }

  it("accepts a valid record", () => {
    expect(isValidPersistedComparison(validRecord())).toBe(true);
  });

  it("rejects a non-object", () => {
    expect(isValidPersistedComparison(null)).toBe(false);
    expect(isValidPersistedComparison("string")).toBe(false);
    expect(isValidPersistedComparison([])).toBe(false);
  });

  it("rejects an unknown extra key", () => {
    expect(isValidPersistedComparison(validRecord({ rating: 5 }))).toBe(false);
    expect(isValidPersistedComparison(validRecord({ confidence: "confident" }))).toBe(false);
  });

  it("rejects a missing/blank required field", () => {
    expect(isValidPersistedComparison(validRecord({ learnerId: "" }))).toBe(false);
    expect(isValidPersistedComparison(validRecord({ firstEncounterInstanceId: "" }))).toBe(false);
    expect(isValidPersistedComparison(validRecord({ secondEncounterInstanceId: "" }))).toBe(false);
    expect(isValidPersistedComparison(validRecord({ freeText: "" }))).toBe(false);
    expect(isValidPersistedComparison(validRecord({ createdAt: "" }))).toBe(false);
  });

  it("rejects identical first/second encounter ids", () => {
    expect(
      isValidPersistedComparison(validRecord({ secondEncounterInstanceId: "enc-a" }))
    ).toBe(false);
  });
});
