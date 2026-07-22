import { describe, expect, it } from "vitest";

import { COMPOSER_MOVE_TYPES, generateCandidateMoves } from "./generateCandidateMoves.js";
import { normalizeComposerRequest } from "./normalizeComposerRequest.js";

const testConfig = {
  commerce: {
    currency: "USD",
    pointValue: 100,
  },
  box: {
    minSelectableSlots: 1,
    maxSelectableSlots: 3,
    defaultTargetSlots: 3,
  },
};

const catalog = [
  perfume(3, 2),
  perfume(1, 1),
  perfume(2, 1.5),
  perfume(4, 4),
];

function perfume(id, points) {
  return {
    id,
    name: `Perfume ${id}`,
    brand: "Test",
    points,
    image: "/test.png",
    accords: ["fresh"],
    seasons: ["summer"],
    occasions: ["daily"],
    vibes: ["clean"],
  };
}

function request(input = {}) {
  return normalizeComposerRequest(input, { config: testConfig });
}

describe("generateCandidateMoves", () => {
  it("generates deterministic legal ADD_PERFUME moves independent of catalog order", () => {
    const moves = generateCandidateMoves({
      request: request({ budget: 500, minSlots: 0 }),
      currentPerfumes: [catalog[1]],
      catalog,
      config: testConfig,
    });

    expect(moves.map((move) => move.type)).toEqual([
      COMPOSER_MOVE_TYPES.ADD_PERFUME,
      COMPOSER_MOVE_TYPES.ADD_PERFUME,
      COMPOSER_MOVE_TYPES.ADD_PERFUME,
    ]);
    expect(moves.map((move) => move.perfumeId)).toEqual([2, 3, 4]);
    expect(moves.map((move) => move.candidatePerfumes.map((perfume) => perfume.id))).toEqual([
      [1, 2],
      [1, 3],
      [1, 4],
    ]);
  });

  it("respects excluded, selected, max-slot, and budget constraints through the constraint evaluator", () => {
    const moves = generateCandidateMoves({
      request: request({
        budget: 300,
        minSlots: 0,
        maxSlots: 2,
        excludedPerfumeIds: [2],
      }),
      currentPerfumes: [catalog[1]],
      catalog,
      config: testConfig,
    });

    expect(moves.map((move) => move.perfumeId)).toEqual([3]);
    expect(moves[0].constraintResult.valid).toBe(true);
  });

  it("returns no legal moves when every add would violate constraints", () => {
    expect(
      generateCandidateMoves({
        request: request({ budget: 100, minSlots: 0 }),
        currentPerfumes: [catalog[1]],
        catalog,
        config: testConfig,
      })
    ).toEqual([]);
  });

  it("does not mutate frozen inputs", () => {
    const frozenCatalog = deepFreeze([...catalog]);
    const frozenCurrent = deepFreeze([catalog[1]]);
    const normalizedRequest = deepFreeze(request({ budget: 500, minSlots: 0 }));

    generateCandidateMoves({
      request: normalizedRequest,
      currentPerfumes: frozenCurrent,
      catalog: frozenCatalog,
      config: testConfig,
    });

    expect(frozenCatalog.map((perfume) => perfume.id)).toEqual([3, 1, 2, 4]);
    expect(frozenCurrent.map((perfume) => perfume.id)).toEqual([1]);
  });
});

function deepFreeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    Object.values(value).forEach(deepFreeze);
  }

  return value;
}
