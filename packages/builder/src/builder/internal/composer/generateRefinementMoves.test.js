import { describe, expect, it } from "vitest";

import { COMPOSER_MOVE_TYPES } from "./composerMoveTypes.js";
import { generateRefinementMoves } from "./generateRefinementMoves.js";
import { normalizeComposerRequest } from "./normalizeComposerRequest.js";

const testConfig = {
  commerce: {
    currency: "USD",
    pointValue: 100,
  },
  box: {
    minSelectableSlots: 2,
    maxSelectableSlots: 3,
    defaultTargetSlots: 3,
  },
};

const catalog = [
  perfume(3, 2),
  perfume(1, 1),
  perfume(2, 1.5),
  perfume(4, 3),
  perfume(5, 4),
  { id: 6, name: "Malformed Points" },
  { name: "Malformed ID", points: 1 },
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

function deepFreeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    Object.values(value).forEach(deepFreeze);
  }

  return value;
}

describe("generateRefinementMoves", () => {
  it("returns no moves for an empty collection", () => {
    expect(
      generateRefinementMoves({
        request: request({ budget: 500 }),
        selectedPerfumes: [],
        catalog,
        config: testConfig,
      })
    ).toEqual([]);
  });

  it("emits exact deterministic SWAP_PERFUME move shapes for a valid collection", () => {
    const moves = generateRefinementMoves({
      request: request({ budget: 500, minSlots: 2, maxSlots: 3 }),
      selectedPerfumes: [catalog[1], catalog[2]],
      catalog,
      config: testConfig,
    });

    expect(moves.map(({ removePerfumeId, addPerfumeId }) => [removePerfumeId, addPerfumeId]))
      .toEqual([
        [1, 3],
        [1, 4],
        [2, 3],
        [2, 4],
        [2, 5],
      ]);
    expect(moves[0]).toMatchObject({
      type: COMPOSER_MOVE_TYPES.SWAP_PERFUME,
      removePerfumeId: 1,
      addPerfumeId: 3,
      removedPerfume: catalog[1],
      addedPerfume: catalog[0],
      constraintResult: {
        valid: true,
      },
    });
    expect(moves[0].candidatePerfumes.map((perfume) => perfume.id)).toEqual([2, 3]);
    moves.forEach((move) => {
      expect(move.candidatePerfumes).toHaveLength(2);
    });
  });

  it("never removes locked perfumes, never re-adds selected perfumes, and never adds excluded perfumes", () => {
    const moves = generateRefinementMoves({
      request: request({
        budget: 500,
        minSlots: 2,
        lockedPerfumeIds: [1],
        excludedPerfumeIds: [4],
      }),
      selectedPerfumes: [catalog[1], catalog[2]],
      catalog,
      config: testConfig,
    });

    expect(moves.map(({ removePerfumeId, addPerfumeId }) => [removePerfumeId, addPerfumeId]))
      .toEqual([
        [2, 3],
        [2, 5],
      ]);
    expect(moves.some((move) => move.removePerfumeId === 1)).toBe(false);
    expect(moves.some((move) => move.addPerfumeId === 1 || move.addPerfumeId === 2)).toBe(false);
    expect(moves.some((move) => move.addPerfumeId === 4)).toBe(false);
  });

  it("omits over-budget, unknown, and malformed swaps through hard constraints", () => {
    const moves = generateRefinementMoves({
      request: request({ budget: 300, minSlots: 2 }),
      selectedPerfumes: [catalog[1], catalog[2]],
      catalog,
      config: testConfig,
    });

    expect(moves.map((move) => move.addPerfumeId)).toEqual([3]);
    expect(moves.some((move) => move.addPerfumeId === 5)).toBe(false);
    expect(moves.some((move) => move.addPerfumeId === 6)).toBe(false);
  });

  it("is independent of catalog and selected collection ordering", () => {
    const first = generateRefinementMoves({
      request: request({ budget: 500, minSlots: 2 }),
      selectedPerfumes: [catalog[2], catalog[1]],
      catalog,
      config: testConfig,
    });
    const second = generateRefinementMoves({
      request: request({ budget: 500, minSlots: 2 }),
      selectedPerfumes: [catalog[1], catalog[2]],
      catalog: [...catalog].reverse(),
      config: testConfig,
    });

    expect(second).toEqual(first);
  });

  it("rejects swaps that would drop an already-floor-satisfying collection below it", () => {
    const moves = generateRefinementMoves({
      request: { ...request({ budget: 500, minSlots: 2, maxSlots: 3 }), pointsFloor: 3 },
      selectedPerfumes: [catalog[0], catalog[1]], // ids 3(2pts) + 1(1pt) = 3pts, floor already met
      catalog,
      config: testConfig,
    });

    // Swapping out id 3 (2pts) for id 1... already selected; real options
    // are removing 3 or 1 and adding one of {2,4,5}. Removing 3 (2pts) and
    // adding 2 (1.5pts) => 1+1.5=2.5 < 3, rejected. Removing 1 (1pt) and
    // adding 2 (1.5pts) => 2+1.5=3.5 >= 3, kept.
    expect(moves.some((move) => move.removePerfumeId === 3 && move.addPerfumeId === 2)).toBe(
      false
    );
    expect(moves.some((move) => move.removePerfumeId === 1 && move.addPerfumeId === 2)).toBe(
      true
    );
  });

  it("does not restrict swaps when the starting collection is below an already-supplied floor", () => {
    const moves = generateRefinementMoves({
      request: { ...request({ budget: 500, minSlots: 2, maxSlots: 3 }), pointsFloor: 100 },
      selectedPerfumes: [catalog[1], catalog[2]], // far below an unreachable floor
      catalog,
      config: testConfig,
    });

    // No move can possibly satisfy floor:100, so the "already met" strict
    // rule must not apply (that would reject every move) -- refinement is
    // not responsible for reaching an unmet floor, only for not undoing an
    // already-met one.
    expect(moves.length).toBeGreaterThan(0);
  });

  it("does not mutate frozen inputs and remains deterministic", () => {
    const frozenRequest = deepFreeze(request({ budget: 500, minSlots: 2 }));
    const frozenSelected = deepFreeze([catalog[1], catalog[2]]);
    const frozenCatalog = deepFreeze([...catalog]);
    const first = generateRefinementMoves({
      request: frozenRequest,
      selectedPerfumes: frozenSelected,
      catalog: frozenCatalog,
      config: testConfig,
    });
    const second = generateRefinementMoves({
      request: frozenRequest,
      selectedPerfumes: frozenSelected,
      catalog: frozenCatalog,
      config: testConfig,
    });

    expect(second).toEqual(first);
    expect(frozenSelected.map((perfume) => perfume.id)).toEqual([1, 2]);
    expect(frozenCatalog.map((perfume) => perfume?.id)).toEqual([3, 1, 2, 4, 5, 6, undefined]);
  });
});
