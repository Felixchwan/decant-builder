import { normalizeComposerRequest } from "./normalizeComposerRequest.js";
import { requireComposerConfig } from "./requireComposerConfig.js";

export function evaluateComposerConstraints({
  request,
  candidatePerfumes = [],
  catalog = [],
  config,
} = {}) {
  const builderConfig = requireComposerConfig(config);
  const normalizedRequest = isNormalizedComposerRequest(request)
    ? request
    : normalizeComposerRequest(request, { config: builderConfig });
  const pointValue = normalizedRequest.pointValue || builderConfig.commerce.pointValue;
  const candidateItems = Array.isArray(candidatePerfumes) ? candidatePerfumes : [];
  const catalogItems = Array.isArray(catalog) ? catalog : [];
  const catalogById = buildCatalogById(catalogItems);
  const candidateIds = candidateItems.map((perfume) => perfume?.id);
  const candidateIdSet = new Set(candidateIds.filter((id) => Number.isInteger(id)));
  const totalPoints = roundNumber(
    candidateItems.reduce(
      (sum, perfume) => sum + (isValidPointValue(perfume?.points) ? perfume.points : 0),
      0
    )
  );
  const estimatedValue = roundNumber(totalPoints * pointValue);
  const metrics = {
    selectedSlots: candidateItems.length,
    totalPoints,
    estimatedValue,
    remainingPoints: roundNumber(normalizedRequest.maxPoints - totalPoints),
    remainingBudget:
      normalizedRequest.budget === null
        ? Infinity
        : roundNumber(normalizedRequest.budget - estimatedValue),
    budgetUtilization:
      normalizedRequest.budget && normalizedRequest.budget > 0
        ? roundNumber(estimatedValue / normalizedRequest.budget)
        : 0,
    lockedCount: normalizedRequest.lockedPerfumeIds.length,
    excludedCount: normalizedRequest.excludedPerfumeIds.length,
  };
  const violations = [];

  addRequestViolations({
    violations,
    request: normalizedRequest,
    catalogById,
    catalogItems,
  });
  addCandidateViolations({
    violations,
    request: normalizedRequest,
    candidateItems,
    candidateIds,
    candidateIdSet,
    catalogById,
    hasCatalog: catalogItems.length > 0,
    metrics,
  });

  return {
    valid: violations.length === 0,
    violations,
    metrics,
  };
}

function addRequestViolations({ violations, request, catalogById, catalogItems }) {
  request.inputIssues.forEach((issue) => {
    addViolation(violations, issue);
  });

  if (request.lockedPerfumeIds.length > request.maxSlots) {
    addViolation(violations, {
      code: "LOCKED_EXCEEDS_MAX_SLOTS",
      lockedCount: request.lockedPerfumeIds.length,
      maxSlots: request.maxSlots,
    });
  }

  if (catalogItems.length > 0) {
    request.lockedPerfumeIds.forEach((perfumeId) => {
      if (!catalogById.has(perfumeId)) {
        addViolation(violations, {
          code: "UNKNOWN_LOCKED_PERFUME",
          perfumeId,
        });
      }
    });
  }

  const lockedPoints = roundNumber(
    request.lockedPerfumeIds.reduce((sum, perfumeId) => {
      const perfume = catalogById.get(perfumeId);
      return sum + (isValidPointValue(perfume?.points) ? perfume.points : 0);
    }, 0)
  );

  if (lockedPoints > request.maxPoints) {
    addViolation(violations, {
      code: "LOCKED_POINTS_EXCEED_BUDGET",
      lockedPoints,
      maxPoints: request.maxPoints,
    });
  }

  if (catalogItems.length > 0) {
    const availableIds = new Set(
      catalogItems
        .filter((perfume) => Number.isInteger(perfume?.id))
        .filter((perfume) => !request.excludedPerfumeIds.includes(perfume.id))
        .map((perfume) => perfume.id)
    );

    if (availableIds.size < request.minSlots) {
      addViolation(violations, {
        code: "INSUFFICIENT_CATALOG_CANDIDATES",
        availableCount: availableIds.size,
        minSlots: request.minSlots,
      });
    }
  }
}

function addCandidateViolations({
  violations,
  request,
  candidateItems,
  candidateIds,
  candidateIdSet,
  catalogById,
  hasCatalog,
  metrics,
}) {
  if (metrics.totalPoints > request.maxPoints) {
    addViolation(violations, {
      code: "BUDGET_EXCEEDED",
      actualPoints: metrics.totalPoints,
      maxPoints: request.maxPoints,
      actualValue: metrics.estimatedValue,
      budget: request.budget,
    });
  }

  if (metrics.selectedSlots < request.minSlots) {
    addViolation(violations, {
      code: "MIN_SLOTS_NOT_MET",
      actualSlots: metrics.selectedSlots,
      minSlots: request.minSlots,
    });
  }

  if (metrics.selectedSlots > request.maxSlots) {
    addViolation(violations, {
      code: "MAX_SLOTS_EXCEEDED",
      actualSlots: metrics.selectedSlots,
      maxSlots: request.maxSlots,
    });
  }

  request.lockedPerfumeIds.forEach((perfumeId) => {
    if (!candidateIdSet.has(perfumeId)) {
      addViolation(violations, {
        code: "LOCKED_PERFUME_MISSING",
        perfumeId,
      });
    }
  });

  request.excludedPerfumeIds.forEach((perfumeId) => {
    if (candidateIdSet.has(perfumeId)) {
      addViolation(violations, {
        code: "EXCLUDED_PERFUME_PRESENT",
        perfumeId,
      });
    }
  });

  getDuplicateIds(candidateIds).forEach((perfumeId) => {
    addViolation(violations, {
      code: "DUPLICATE_PERFUME_ID",
      perfumeId,
    });
  });

  candidateItems.forEach((perfume, index) => {
    if (!perfume || typeof perfume !== "object" || !Number.isInteger(perfume.id)) {
      addViolation(violations, {
        code: "INVALID_PERFUME_RECORD",
        index,
      });
      return;
    }

    if (hasCatalog && !catalogById.has(perfume.id)) {
      addViolation(violations, {
        code: "UNKNOWN_PERFUME",
        perfumeId: perfume.id,
      });
    }

    if (!isValidPointValue(perfume.points)) {
      addViolation(violations, {
        code: "INVALID_PERFUME_POINTS",
        perfumeId: perfume.id,
        points: perfume.points,
      });
    }
  });
}

function isNormalizedComposerRequest(request) {
  return (
    request &&
    typeof request === "object" &&
    Array.isArray(request.lockedPerfumeIds) &&
    Array.isArray(request.excludedPerfumeIds) &&
    Array.isArray(request.inputIssues) &&
    typeof request.minSlots === "number" &&
    typeof request.maxSlots === "number" &&
    typeof request.maxPoints === "number"
  );
}

function buildCatalogById(catalog) {
  return catalog.reduce((map, perfume) => {
    if (Number.isInteger(perfume?.id) && !map.has(perfume.id)) {
      map.set(perfume.id, perfume);
    }

    return map;
  }, new Map());
}

function getDuplicateIds(ids) {
  const seen = new Set();
  const duplicates = [];

  ids.forEach((id) => {
    if (!Number.isInteger(id)) {
      return;
    }

    if (seen.has(id) && !duplicates.includes(id)) {
      duplicates.push(id);
      return;
    }

    seen.add(id);
  });

  return duplicates;
}

function addViolation(violations, violation) {
  const key = JSON.stringify(violation);

  if (!violations.some((existing) => JSON.stringify(existing) === key)) {
    violations.push(violation);
  }
}

function isValidPointValue(value) {
  return typeof value === "number" && Number.isFinite(value);
}

function roundNumber(value) {
  if (!Number.isFinite(value)) {
    return value;
  }

  return Math.round(value * 10000) / 10000;
}
