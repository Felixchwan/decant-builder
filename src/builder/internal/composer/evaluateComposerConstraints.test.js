import { describe, expect, it } from "vitest";

import { evaluateComposerConstraints } from "./evaluateComposerConstraints.js";
import { normalizeComposerRequest } from "./normalizeComposerRequest.js";

const testConfig = {
  commerce: {
    currency: "USD",
    pointValue: 50,
  },
  box: {
    minSelectableSlots: 2,
    maxSelectableSlots: 4,
    defaultTargetSlots: 3,
    totalPhysicalSlots: 6,
    bonusSlotCount: 2,
  },
};

const catalog = [
  perfume(1, 1),
  perfume(2, 1.5),
  perfume(3, 2),
  perfume(4, 2.5),
  perfume(5, 4),
];

function perfume(id, points, overrides = {}) {
  return {
    id,
    name: `Perfume ${id}`,
    points,
    accords: [],
    seasons: [],
    occasions: [],
    vibes: [],
    ...overrides,
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

describe("evaluateComposerConstraints", () => {
  it("evaluates the smallest valid complete candidate at the exact budget boundary", () => {
    expect(
      evaluateComposerConstraints({
        request: request({ budget: 125, minSlots: 2, maxSlots: 4, lockedPerfumeIds: [1] }),
        candidatePerfumes: [catalog[0], catalog[1]],
        catalog,
        config: testConfig,
      })
    ).toEqual({
      valid: true,
      violations: [],
      metrics: {
        selectedSlots: 2,
        totalPoints: 2.5,
        estimatedValue: 125,
        remainingPoints: 0,
        remainingBudget: 0,
        budgetUtilization: 1,
        lockedCount: 1,
        excludedCount: 0,
      },
    });
  });

  it("allows omitted budget and keeps remaining budget and points observable as Infinity", () => {
    expect(
      evaluateComposerConstraints({
        request: request({ minSlots: 1 }),
        candidatePerfumes: [catalog[4]],
        catalog,
        config: testConfig,
      }).metrics
    ).toEqual({
      selectedSlots: 1,
      totalPoints: 4,
      estimatedValue: 200,
      remainingPoints: Infinity,
      remainingBudget: Infinity,
      budgetUtilization: 0,
      lockedCount: 0,
      excludedCount: 0,
    });
  });

  it("returns deterministic budget, slot, locked, excluded, duplicate, unknown, and point violations", () => {
    expect(
      evaluateComposerConstraints({
        request: request({
          budget: 100,
          minSlots: 3,
          maxSlots: 4,
          lockedPerfumeIds: [1, 5],
          excludedPerfumeIds: [2],
        }),
        candidatePerfumes: [
          catalog[1],
          catalog[1],
          perfume(99, 2),
          { id: 4, name: "Missing Points" },
          null,
        ],
        catalog,
        config: testConfig,
      })
    ).toEqual({
      valid: false,
      violations: [
        {
          code: "LOCKED_POINTS_EXCEED_BUDGET",
          lockedPoints: 5,
          maxPoints: 2,
        },
        {
          code: "BUDGET_EXCEEDED",
          actualPoints: 5,
          maxPoints: 2,
          actualValue: 250,
          budget: 100,
        },
        {
          code: "MAX_SLOTS_EXCEEDED",
          actualSlots: 5,
          maxSlots: 4,
        },
        {
          code: "LOCKED_PERFUME_MISSING",
          perfumeId: 1,
        },
        {
          code: "LOCKED_PERFUME_MISSING",
          perfumeId: 5,
        },
        {
          code: "EXCLUDED_PERFUME_PRESENT",
          perfumeId: 2,
        },
        {
          code: "DUPLICATE_PERFUME_ID",
          perfumeId: 2,
        },
        {
          code: "UNKNOWN_PERFUME",
          perfumeId: 99,
        },
        {
          code: "INVALID_PERFUME_POINTS",
          perfumeId: 4,
          points: undefined,
        },
        {
          code: "INVALID_PERFUME_RECORD",
          index: 4,
        },
      ],
      metrics: {
        selectedSlots: 5,
        totalPoints: 5,
        estimatedValue: 250,
        remainingPoints: -3,
        remainingBudget: -150,
        budgetUtilization: 2.5,
        lockedCount: 2,
        excludedCount: 1,
      },
    });
  });

  it("reports minimum slots and zero-budget violations while still returning metrics", () => {
    expect(
      evaluateComposerConstraints({
        request: request({ budget: 0, minSlots: 2 }),
        candidatePerfumes: [catalog[0]],
        catalog,
        config: testConfig,
      })
    ).toEqual({
      valid: false,
      violations: [
        {
          code: "BUDGET_EXCEEDED",
          actualPoints: 1,
          maxPoints: 0,
          actualValue: 50,
          budget: 0,
        },
        {
          code: "MIN_SLOTS_NOT_MET",
          actualSlots: 1,
          minSlots: 2,
        },
      ],
      metrics: {
        selectedSlots: 1,
        totalPoints: 1,
        estimatedValue: 50,
        remainingPoints: -1,
        remainingBudget: -50,
        budgetUtilization: 0,
        lockedCount: 0,
        excludedCount: 0,
      },
    });
  });

  it("detects request-level invalid budget, locked capacity, unknown locked IDs, and insufficient catalog", () => {
    const normalizedRequest = request({
      budget: -1,
      minSlots: 4,
      maxSlots: 2,
      lockedPerfumeIds: [1, 2, 3],
      excludedPerfumeIds: [4, 5],
    });

    expect(
      evaluateComposerConstraints({
        request: normalizedRequest,
        candidatePerfumes: [catalog[0], catalog[1]],
        catalog: [catalog[0], catalog[1]],
        config: testConfig,
      }).violations
    ).toEqual([
      {
        code: "MIN_SLOTS_EXCEEDS_MAX_SLOTS",
        minSlots: 4,
        maxSlots: 2,
      },
      {
        code: "INVALID_BUDGET",
        budget: -1,
      },
      {
        code: "LOCKED_EXCEEDS_MAX_SLOTS",
        lockedCount: 3,
        maxSlots: 2,
      },
      {
        code: "UNKNOWN_LOCKED_PERFUME",
        perfumeId: 3,
      },
      {
        code: "LOCKED_POINTS_EXCEED_BUDGET",
        lockedPoints: 2.5,
        maxPoints: 0,
      },
      {
        code: "BUDGET_EXCEEDED",
        actualPoints: 2.5,
        maxPoints: 0,
        actualValue: 125,
        budget: null,
      },
      {
        code: "LOCKED_PERFUME_MISSING",
        perfumeId: 3,
      },
    ]);
  });

  it("reports insufficient catalog candidates when exclusions make the request infeasible", () => {
    expect(
      evaluateComposerConstraints({
        request: request({
          minSlots: 3,
          excludedPerfumeIds: [2, 3, 4, 5],
        }),
        candidatePerfumes: [catalog[0]],
        catalog,
        config: testConfig,
      }).violations
    ).toEqual([
      {
        code: "INSUFFICIENT_CATALOG_CANDIDATES",
        availableCount: 1,
        minSlots: 3,
      },
      {
        code: "MIN_SLOTS_NOT_MET",
        actualSlots: 1,
        minSlots: 3,
      },
    ]);
  });

  it("uses raw request input by normalizing it when needed", () => {
    expect(
      evaluateComposerConstraints({
        request: { budget: 125, minSlots: 2, lockedPerfumeIds: [1] },
        candidatePerfumes: [catalog[0], catalog[1]],
        catalog,
        config: testConfig,
      }).valid
    ).toBe(true);
  });

  it("handles non-array candidates and catalogs as empty sources", () => {
    expect(
      evaluateComposerConstraints({
        request: request({ minSlots: 0 }),
        candidatePerfumes: null,
        catalog: null,
        config: testConfig,
      })
    ).toEqual({
      valid: true,
      violations: [],
      metrics: {
        selectedSlots: 0,
        totalPoints: 0,
        estimatedValue: 0,
        remainingPoints: Infinity,
        remainingBudget: Infinity,
        budgetUtilization: 0,
        lockedCount: 0,
        excludedCount: 0,
      },
    });
  });

  it("is deterministic and does not mutate frozen inputs", () => {
    const normalizedRequest = deepFreeze(request({
      budget: 250,
      minSlots: 2,
      lockedPerfumeIds: [1],
      excludedPerfumeIds: [5],
    }));
    const frozenCandidate = deepFreeze([catalog[0], catalog[1]]);
    const frozenCatalog = deepFreeze([...catalog]);

    expect(
      evaluateComposerConstraints({
        request: normalizedRequest,
        candidatePerfumes: frozenCandidate,
        catalog: frozenCatalog,
        config: testConfig,
      })
    ).toEqual(
      evaluateComposerConstraints({
        request: normalizedRequest,
        candidatePerfumes: frozenCandidate,
        catalog: frozenCatalog,
        config: testConfig,
      })
    );
    expect(frozenCandidate).toHaveLength(2);
    expect(normalizedRequest.lockedPerfumeIds).toEqual([1]);
  });

  it("covers a golden valid composition", () => {
    expect(
      evaluateComposerConstraints({
        request: request({
          budget: 350,
          minSlots: 3,
          maxSlots: 4,
          targetSlots: 4,
          lockedPerfumeIds: [1, 3],
          excludedPerfumeIds: [5],
          preferredSeasons: ["winter"],
          strategy: "balanced",
        }),
        candidatePerfumes: [catalog[0], catalog[2], catalog[1]],
        catalog,
        config: testConfig,
      })
    ).toEqual({
      valid: true,
      violations: [],
      metrics: {
        selectedSlots: 3,
        totalPoints: 4.5,
        estimatedValue: 225,
        remainingPoints: 2.5,
        remainingBudget: 125,
        budgetUtilization: 0.6429,
        lockedCount: 2,
        excludedCount: 1,
      },
    });
  });

  it("covers a golden invalid composition with stable violation ordering", () => {
    expect(
      evaluateComposerConstraints({
        request: request({
          budget: 150,
          minSlots: 4,
          maxSlots: 4,
          lockedPerfumeIds: [1, 5],
          excludedPerfumeIds: [2, 3],
        }),
        candidatePerfumes: [catalog[1], catalog[2], catalog[2], perfume(99, 3)],
        catalog,
        config: testConfig,
      })
    ).toEqual({
      valid: false,
      violations: [
        {
          code: "LOCKED_POINTS_EXCEED_BUDGET",
          lockedPoints: 5,
          maxPoints: 3,
        },
        {
          code: "INSUFFICIENT_CATALOG_CANDIDATES",
          availableCount: 3,
          minSlots: 4,
        },
        {
          code: "BUDGET_EXCEEDED",
          actualPoints: 8.5,
          maxPoints: 3,
          actualValue: 425,
          budget: 150,
        },
        {
          code: "LOCKED_PERFUME_MISSING",
          perfumeId: 1,
        },
        {
          code: "LOCKED_PERFUME_MISSING",
          perfumeId: 5,
        },
        {
          code: "EXCLUDED_PERFUME_PRESENT",
          perfumeId: 2,
        },
        {
          code: "EXCLUDED_PERFUME_PRESENT",
          perfumeId: 3,
        },
        {
          code: "DUPLICATE_PERFUME_ID",
          perfumeId: 3,
        },
        {
          code: "UNKNOWN_PERFUME",
          perfumeId: 99,
        },
      ],
      metrics: {
        selectedSlots: 4,
        totalPoints: 8.5,
        estimatedValue: 425,
        remainingPoints: -5.5,
        remainingBudget: -275,
        budgetUtilization: 2.8333,
        lockedCount: 2,
        excludedCount: 2,
      },
    });
  });
});
