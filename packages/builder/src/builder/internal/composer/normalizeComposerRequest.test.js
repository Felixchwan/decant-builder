import { describe, expect, it } from "vitest";

import { discoveryDecantsConfig } from "../../../../../../src/merchants/discoveryDecants/config.js";
import { getComposerCollectionStyle } from "./composerCollectionStyles.js";
import { getComposerStrategy } from "./composerStrategies.js";
import { normalizeComposerRequest } from "./normalizeComposerRequest.js";

const testConfig = {
  commerce: {
    currency: "USD",
    pointValue: 50,
  },
  box: {
    minSelectableSlots: 3,
    maxSelectableSlots: 8,
    defaultTargetSlots: 6,
    totalPhysicalSlots: 10,
    bonusSlotCount: 2,
  },
};

function deepFreeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    Object.values(value).forEach(deepFreeze);
  }

  return value;
}

function normalizeWithActiveConfig(input) {
  return normalizeComposerRequest(input, { config: discoveryDecantsConfig });
}

describe("normalizeComposerRequest", () => {
  it("normalizes undefined, null, and empty input using canonical Builder defaults", () => {
    const expected = {
      budget: null,
      currency: "MXN",
      pointValue: 100,
      maxPoints: Infinity,
      minSlots: 6,
      maxSlots: 14,
      targetSlots: 14,
      lockedPerfumeIds: [],
      excludedPerfumeIds: [],
      preferredSeasons: [],
      preferredOccasions: [],
      preferredVibes: [],
      strategy: getComposerStrategy("balanced"),
      collectionStyle: getComposerCollectionStyle("balanced_mix"),
      inputIssues: [],
      lockedExcludedConflicts: [],
    };

    expect(normalizeWithActiveConfig()).toEqual(expected);
    expect(normalizeWithActiveConfig(undefined)).toEqual(expected);
    expect(normalizeWithActiveConfig(null)).toEqual(expected);
    expect(normalizeWithActiveConfig({})).toEqual(expected);
  });

  it("normalizes a representative valid request with context config and fractional budget points", () => {
    expect(
      normalizeComposerRequest(
        {
          budget: 375,
          minSlots: 2.9,
          maxSlots: 7.8,
          targetSlots: 6.2,
          lockedPerfumeIds: [9, 3, 9, "3", 0, 4.5, -2],
          excludedPerfumeIds: [5, 3, 5, 6, null, "7", -2],
          preferredSeasons: [" Summer ", "summer", "WINTER", "", null],
          preferredOccasions: [" Office ", "date night", "OFFICE", 7],
          preferredVibes: [" Fresh ", "fresh", "Warm  Spicy", undefined],
          strategy: "explorer",
          unknownRoot: "ignored",
        },
        { config: testConfig }
      )
    ).toEqual({
      budget: 375,
      currency: "USD",
      pointValue: 50,
      maxPoints: 7.5,
      minSlots: 2,
      maxSlots: 7,
      targetSlots: 6,
      lockedPerfumeIds: [9, 3, 0, -2],
      excludedPerfumeIds: [5, 6],
      preferredSeasons: ["summer", "winter"],
      preferredOccasions: ["office", "date night"],
      preferredVibes: ["fresh", "warm spicy"],
      strategy: getComposerStrategy("explorer"),
      collectionStyle: getComposerCollectionStyle("balanced_mix"),
      inputIssues: [],
      lockedExcludedConflicts: [3, -2],
    });
  });

  it("characterizes zero, omitted, malformed, and negative budget values", () => {
    expect(normalizeWithActiveConfig({ budget: 0 }).budget).toBe(0);
    expect(normalizeWithActiveConfig({ budget: 0 }).maxPoints).toBe(0);
    expect(normalizeWithActiveConfig({ budget: "" }).maxPoints).toBe(Infinity);
    expect(normalizeWithActiveConfig({ budget: "500" }).inputIssues).toEqual([
      { code: "INVALID_BUDGET", budget: "500" },
    ]);
    expect(normalizeWithActiveConfig({ budget: -1 })).toMatchObject({
      budget: null,
      maxPoints: 0,
      inputIssues: [{ code: "INVALID_BUDGET", budget: -1 }],
    });

    const nanResult = normalizeWithActiveConfig({ budget: NaN });
    expect(nanResult.budget).toBeNull();
    expect(nanResult.maxPoints).toBe(0);
    expect(nanResult.inputIssues[0].code).toBe("INVALID_BUDGET");
    expect(Number.isNaN(nanResult.inputIssues[0].budget)).toBe(true);
  });

  it("normalizes slot inputs by truncating, clamping, defaulting, and resolving min greater than max", () => {
    expect(
      normalizeComposerRequest(
        {
          minSlots: 9,
          maxSlots: 4,
          targetSlots: 99,
        },
        { config: testConfig }
      )
    ).toMatchObject({
      minSlots: 4,
      maxSlots: 4,
      targetSlots: 4,
      inputIssues: [{ code: "MIN_SLOTS_EXCEEDS_MAX_SLOTS", minSlots: 8, maxSlots: 4 }],
    });
    expect(
      normalizeComposerRequest(
        {
          minSlots: -2.2,
          maxSlots: 99,
          targetSlots: -4,
        },
        { config: testConfig }
      )
    ).toMatchObject({
      minSlots: 0,
      maxSlots: 8,
      targetSlots: 0,
    });
    expect(
      normalizeComposerRequest(
        {
          minSlots: NaN,
          maxSlots: Infinity,
          targetSlots: "6",
        },
        { config: testConfig }
      )
    ).toMatchObject({
      minSlots: 3,
      maxSlots: 8,
      targetSlots: 6,
    });
  });

  it("keeps preferences as soft normalized arrays and ignores non-arrays", () => {
    expect(
      normalizeWithActiveConfig({
        preferredSeasons: "summer",
        preferredOccasions: null,
        preferredVibes: [" Clean ", "unknown future vibe", "CLEAN"],
      })
    ).toMatchObject({
      preferredSeasons: [],
      preferredOccasions: [],
      preferredVibes: ["clean", "unknown future vibe"],
    });
  });

  it("does not mutate frozen input arrays and is deterministic", () => {
    const input = deepFreeze({
      budget: 125,
      lockedPerfumeIds: [1, 2, 1],
      excludedPerfumeIds: [2, 3],
      preferredSeasons: ["Summer", "Fall"],
      preferredOccasions: ["Office"],
      preferredVibes: ["Fresh"],
      strategy: "signature",
    });

    expect(normalizeWithActiveConfig(input)).toEqual(normalizeWithActiveConfig(input));
    expect(input.lockedPerfumeIds).toEqual([1, 2, 1]);
    expect(input.excludedPerfumeIds).toEqual([2, 3]);
  });

  it("covers a golden normalized Composer request", () => {
    expect(
      normalizeWithActiveConfig({
        budget: 1225,
        minSlots: 6,
        maxSlots: 14,
        targetSlots: 12,
        lockedPerfumeIds: [101, 205, 101, 0, "bad"],
        excludedPerfumeIds: [301, 205, 302, 301],
        preferredSeasons: ["Winter", "Fall"],
        preferredOccasions: ["Date", "Formal"],
        preferredVibes: ["Warm", "Elegant"],
        strategy: "signature",
        collectionStyle: "more_variety",
      })
    ).toEqual({
      budget: 1225,
      currency: "MXN",
      pointValue: 100,
      maxPoints: 12.25,
      minSlots: 6,
      maxSlots: 14,
      targetSlots: 12,
      lockedPerfumeIds: [101, 205, 0],
      excludedPerfumeIds: [301, 302],
      preferredSeasons: ["winter", "fall"],
      preferredOccasions: ["date", "formal"],
      preferredVibes: ["warm", "elegant"],
      strategy: getComposerStrategy("signature"),
      collectionStyle: getComposerCollectionStyle("more_variety"),
      inputIssues: [],
      lockedExcludedConflicts: [205],
    });
  });
});
