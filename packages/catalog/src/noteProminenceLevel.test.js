import { describe, expect, it } from "vitest";

import { fragrances } from "./fragrances.js";
import { getNoteProminenceLevel } from "./noteProminenceLevel.js";

// Smallest safe architecture phase: a deterministic qualitative projection
// of an already-existing numeric noteProminence score. This file proves
// the pure mapping contract only -- no catalog data, no Note Explorer
// behavior, and no recommendation scoring is exercised or changed here.

describe("getNoteProminenceLevel", () => {
  it("maps every valid score to its exact rubric-defined level", () => {
    expect(getNoteProminenceLevel(1)).toBe("secondary");
    expect(getNoteProminenceLevel(2)).toBe("secondary");
    expect(getNoteProminenceLevel(3)).toBe("secondary");
    expect(getNoteProminenceLevel(4)).toBe("clearlyPerceptible");
    expect(getNoteProminenceLevel(5)).toBe("clearlyPerceptible");
    expect(getNoteProminenceLevel(6)).toBe("clearlyPerceptible");
    expect(getNoteProminenceLevel(7)).toBe("veryEvident");
    expect(getNoteProminenceLevel(8)).toBe("veryEvident");
    expect(getNoteProminenceLevel(9)).toBe("defining");
    expect(getNoteProminenceLevel(10)).toBe("defining");
  });

  it("draws no off-by-one error at any tier boundary", () => {
    // 3 / 4 boundary
    expect(getNoteProminenceLevel(3)).toBe("secondary");
    expect(getNoteProminenceLevel(4)).toBe("clearlyPerceptible");

    // 6 / 7 boundary
    expect(getNoteProminenceLevel(6)).toBe("clearlyPerceptible");
    expect(getNoteProminenceLevel(7)).toBe("veryEvident");

    // 8 / 9 boundary
    expect(getNoteProminenceLevel(8)).toBe("veryEvident");
    expect(getNoteProminenceLevel(9)).toBe("defining");
  });

  it("returns null for every invalid or unscored input, and never returns the string \"unscored\"", () => {
    const invalidInputs = [undefined, null, 0, -1, -10, 11, 100, 5.5, 9.9, NaN, "7", "defining", true, false, {}, [], [7], () => {}];

    for (const input of invalidInputs) {
      expect(getNoteProminenceLevel(input)).toBeNull();
    }
  });

  it("never returns the literal string \"unscored\" -- missing prominence is null, never a fifth tier", () => {
    const allOutputs = [undefined, null, 0, 11, "unscored", NaN].map((input) => getNoteProminenceLevel(input));
    expect(allOutputs).not.toContain("unscored");
    expect(new Set(allOutputs)).toEqual(new Set([null]));
  });

  it("is deterministic across repeated calls with the same input", () => {
    for (const score of [1, 4, 7, 9, 0, undefined, NaN]) {
      const first = getNoteProminenceLevel(score);
      const second = getNoteProminenceLevel(score);
      const third = getNoteProminenceLevel(score);
      expect(first).toBe(second);
      expect(second).toBe(third);
    }
  });

  it("does not mutate a caller-owned object passed incidentally as an invalid score", () => {
    const callerOwned = Object.freeze({ score: 7 });
    expect(() => getNoteProminenceLevel(callerOwned)).not.toThrow();
    expect(getNoteProminenceLevel(callerOwned)).toBeNull();
    expect(callerOwned).toEqual({ score: 7 });
  });

  it("does not mutate the live catalog projection when classifying every real noteProminence value", () => {
    const before = fragrances.map((perfume) => ({ id: perfume.id, noteProminence: { ...perfume.noteProminence } }));

    for (const perfume of fragrances) {
      for (const score of Object.values(perfume.noteProminence)) {
        getNoteProminenceLevel(score);
      }
    }

    const after = fragrances.map((perfume) => ({ id: perfume.id, noteProminence: { ...perfume.noteProminence } }));
    expect(after).toEqual(before);
  });

  it("real-catalog sanity check: Squid's already-established incense: 7 classifies as veryEvident", () => {
    const squid = fragrances.find((perfume) => perfume.id === 500);
    expect(squid.name).toBe("Squid");
    expect(squid.noteProminence.incense).toBe(7);
    expect(getNoteProminenceLevel(squid.noteProminence.incense)).toBe("veryEvident");
  });

  it("real-catalog sanity check: Layton's already-established coumarin: 4 classifies as clearlyPerceptible", () => {
    const layton = fragrances.find((perfume) => perfume.id === 404);
    expect(layton.name).toBe("Layton");
    expect(layton.noteProminence.coumarin).toBe(4);
    expect(getNoteProminenceLevel(layton.noteProminence.coumarin)).toBe("clearlyPerceptible");
  });

  it("real-catalog sanity check: a canonically-carried but unscored note (Uomo Signature's cypress) classifies as null, distinct from an absent note", () => {
    const uomoSignature = fragrances.find((perfume) => perfume.id === 16);
    expect(uomoSignature.name).toBe("Uomo Signature");
    expect(uomoSignature.middleNotes).toContain("cypress");
    expect(uomoSignature.noteProminence.cypress).toBeUndefined();
    expect(getNoteProminenceLevel(uomoSignature.noteProminence.cypress)).toBeNull();
  });
});
