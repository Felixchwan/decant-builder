import { describe, expect, it } from "vitest";
import {
  createEncounterInstance,
  isValidPersistedEncounterInstance,
} from "./encounterInstance.js";

describe("createEncounterInstance", () => {
  it("creates a valid record with no display snapshot", () => {
    const encounter = createEncounterInstance({ learnerId: "learner-1", fragranceId: 42 });

    expect(encounter).toMatchObject({
      learnerId: "learner-1",
      fragranceId: 42,
      fragranceDisplaySnapshot: null,
      basedOnDesignId: null,
      designSnapshot: null,
    });
    expect(typeof encounter.encounterInstanceId).toBe("string");
    expect(encounter.encounterInstanceId.length).toBeGreaterThan(0);
    expect(typeof encounter.createdAt).toBe("string");
  });

  it("creates a valid record with a matching display snapshot", () => {
    const encounter = createEncounterInstance({
      learnerId: "learner-1",
      fragranceId: 42,
      fragranceDisplaySnapshot: { fragranceId: 42, name: "Aurelian No. 1", brand: "Aurelian" },
    });

    expect(encounter.fragranceDisplaySnapshot).toEqual({
      fragranceId: 42,
      name: "Aurelian No. 1",
      brand: "Aurelian",
    });
  });

  it("throws on a missing learnerId", () => {
    expect(() => createEncounterInstance({ fragranceId: 42 })).toThrow();
    expect(() => createEncounterInstance({ learnerId: "", fragranceId: 42 })).toThrow();
    expect(() => createEncounterInstance({ learnerId: "   ", fragranceId: 42 })).toThrow();
  });

  it("throws on a missing or non-integer fragranceId", () => {
    expect(() => createEncounterInstance({ learnerId: "learner-1" })).toThrow();
    expect(() => createEncounterInstance({ learnerId: "learner-1", fragranceId: "42" })).toThrow();
    expect(() => createEncounterInstance({ learnerId: "learner-1", fragranceId: 4.2 })).toThrow();
  });

  it("throws when the display snapshot's fragranceId does not match", () => {
    expect(() =>
      createEncounterInstance({
        learnerId: "learner-1",
        fragranceId: 42,
        fragranceDisplaySnapshot: { fragranceId: 43, name: "X", brand: "Y" },
      })
    ).toThrow();
  });

  it("throws when the display snapshot is missing name/brand", () => {
    expect(() =>
      createEncounterInstance({
        learnerId: "learner-1",
        fragranceId: 42,
        fragranceDisplaySnapshot: { fragranceId: 42, name: "", brand: "Y" },
      })
    ).toThrow();
    expect(() =>
      createEncounterInstance({
        learnerId: "learner-1",
        fragranceId: 42,
        fragranceDisplaySnapshot: { fragranceId: 42, name: "X" },
      })
    ).toThrow();
  });

  it("persists basedOnDesignId and designSnapshot as null for ordinary Phase-1 creation", () => {
    const encounter = createEncounterInstance({ learnerId: "learner-1", fragranceId: 42 });

    expect(encounter.basedOnDesignId).toBeNull();
    expect(encounter.designSnapshot).toBeNull();
  });

  it("accepts an explicit null for basedOnDesignId/designSnapshot the same as omitting them", () => {
    const encounter = createEncounterInstance({
      learnerId: "learner-1",
      fragranceId: 42,
      basedOnDesignId: null,
      designSnapshot: null,
    });

    expect(encounter.basedOnDesignId).toBeNull();
    expect(encounter.designSnapshot).toBeNull();
  });

  it("throws on a non-null basedOnDesignId -- Phase 1 does not support EncounterDesign yet", () => {
    expect(() =>
      createEncounterInstance({ learnerId: "learner-1", fragranceId: 42, basedOnDesignId: "design-1" })
    ).toThrow();
  });

  it("throws on a non-null designSnapshot -- Phase 1 does not support EncounterDesign yet", () => {
    expect(() =>
      createEncounterInstance({
        learnerId: "learner-1",
        fragranceId: 42,
        designSnapshot: { some: "thing" },
      })
    ).toThrow();
  });

  it("carries no status or lifecycle taxonomy field", () => {
    const encounter = createEncounterInstance({ learnerId: "learner-1", fragranceId: 42 });

    expect(encounter).not.toHaveProperty("status");
    expect(encounter).not.toHaveProperty("state");
    expect(Object.keys(encounter).sort()).toEqual(
      [
        "basedOnDesignId",
        "createdAt",
        "designSnapshot",
        "encounterInstanceId",
        "fragranceDisplaySnapshot",
        "fragranceId",
        "learnerId",
      ].sort()
    );
  });

  it("returns a frozen (immutable-by-convention) record", () => {
    const encounter = createEncounterInstance({ learnerId: "learner-1", fragranceId: 42 });

    expect(Object.isFrozen(encounter)).toBe(true);
  });

  it("does not copy notes/accords or other catalog metadata into the snapshot", () => {
    const encounter = createEncounterInstance({
      learnerId: "learner-1",
      fragranceId: 42,
      fragranceDisplaySnapshot: {
        fragranceId: 42,
        name: "Aurelian No. 1",
        brand: "Aurelian",
        accords: ["citrus"],
        topNotes: ["bergamot"],
      },
    });

    expect(encounter.fragranceDisplaySnapshot).toEqual({
      fragranceId: 42,
      name: "Aurelian No. 1",
      brand: "Aurelian",
    });
  });
});

describe("isValidPersistedEncounterInstance", () => {
  function validRecord(overrides = {}) {
    return {
      encounterInstanceId: "enc-1",
      learnerId: "learner-1",
      fragranceId: 42,
      fragranceDisplaySnapshot: null,
      basedOnDesignId: null,
      designSnapshot: null,
      createdAt: "2026-08-10T00:00:00.000Z",
      ...overrides,
    };
  }

  it("accepts a valid record", () => {
    expect(isValidPersistedEncounterInstance(validRecord())).toBe(true);
  });

  it("accepts a valid record with a well-formed display snapshot", () => {
    expect(
      isValidPersistedEncounterInstance(
        validRecord({
          fragranceDisplaySnapshot: { fragranceId: 42, name: "X", brand: "Y" },
        })
      )
    ).toBe(true);
  });

  it("rejects a non-object", () => {
    expect(isValidPersistedEncounterInstance(null)).toBe(false);
    expect(isValidPersistedEncounterInstance("string")).toBe(false);
    expect(isValidPersistedEncounterInstance([])).toBe(false);
  });

  it("rejects an unknown extra key", () => {
    expect(isValidPersistedEncounterInstance(validRecord({ extra: "field" }))).toBe(false);
  });

  it("rejects a missing/blank learnerId", () => {
    expect(isValidPersistedEncounterInstance(validRecord({ learnerId: "" }))).toBe(false);
    expect(isValidPersistedEncounterInstance(validRecord({ learnerId: undefined }))).toBe(false);
  });

  it("rejects a non-integer fragranceId", () => {
    expect(isValidPersistedEncounterInstance(validRecord({ fragranceId: "42" }))).toBe(false);
  });

  it("rejects a mismatched display snapshot fragranceId", () => {
    expect(
      isValidPersistedEncounterInstance(
        validRecord({ fragranceDisplaySnapshot: { fragranceId: 99, name: "X", brand: "Y" } })
      )
    ).toBe(false);
  });

  it("rejects a non-null basedOnDesignId/designSnapshot", () => {
    expect(isValidPersistedEncounterInstance(validRecord({ basedOnDesignId: "design-1" }))).toBe(
      false
    );
    expect(isValidPersistedEncounterInstance(validRecord({ designSnapshot: {} }))).toBe(false);
  });

  it("does not consider catalog resolvability at all -- a removed fragrance stays valid", () => {
    // fragranceId 999999 does not need to exist in any catalog for this to
    // pass; this predicate has no catalog dependency by design.
    expect(isValidPersistedEncounterInstance(validRecord({ fragranceId: 999999 }))).toBe(true);
  });
});
