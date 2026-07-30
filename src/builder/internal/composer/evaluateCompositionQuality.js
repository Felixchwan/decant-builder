import { evaluateComposerConstraints } from "./evaluateComposerConstraints.js";
import { normalizeComposerRequest } from "./normalizeComposerRequest.js";
import { requireComposerConfig } from "./requireComposerConfig.js";
import { getComposerStrategy } from "./composerStrategies.js";
import {
  COMPOSER_PENALTY_IDS,
  COMPOSER_WEIGHTED_DIMENSION_IDS,
  getComposerStrategyWeights,
} from "./composerStrategyWeights.js";
import { evaluateComposerQualityDimensions } from "./composerQualityDimensions.js";

const REQUEST_INFEASIBLE_CODES = new Set([
  "INVALID_BUDGET",
  "MIN_SLOTS_EXCEEDS_MAX_SLOTS",
  "LOCKED_EXCEEDS_MAX_SLOTS",
  "UNKNOWN_LOCKED_PERFUME",
  "LOCKED_POINTS_EXCEED_BUDGET",
  "INSUFFICIENT_CATALOG_CANDIDATES",
]);

export function evaluateCompositionQuality({
  request,
  candidatePerfumes = [],
  catalog = [],
  notes = {},
  config,
  constraintResult,
} = {}) {
  const builderConfig = requireComposerConfig(config);
  const normalizedRequest = isNormalizedComposerRequest(request)
    ? request
    : normalizeComposerRequest(request, { config: builderConfig });
  const constraints =
    constraintResult ||
    evaluateComposerConstraints({
      request: normalizedRequest,
      candidatePerfumes,
      catalog,
      config: builderConfig,
    });
  const strategy = getComposerStrategy(normalizedRequest.strategy?.id);
  const fallbackStrategyUsed = normalizedRequest.strategy?.id !== strategy.id;
  const baseDiagnostics = {
    strategyId: strategy.id,
    evaluatedPerfumeIds: stableIds(candidatePerfumes),
    collectionSize: Array.isArray(candidatePerfumes) ? candidatePerfumes.length : 0,
    constraintResult: constraints,
    fallbackStrategyUsed,
  };

  if (!constraints.valid) {
    const reason = hasRequestInfeasibility(constraints.violations)
      ? "infeasible-request"
      : "invalid-candidate";

    return {
      evaluable: false,
      overallScore: null,
      dimensions: {},
      penalties: {},
      diagnostics: {
        ...baseDiagnostics,
        reason,
        violations: constraints.violations,
      },
    };
  }

  const { dimensions, penalties, diagnostics } = evaluateComposerQualityDimensions({
    request: normalizedRequest,
    candidatePerfumes,
    catalog,
    notes,
  });
  const weights = getComposerStrategyWeights(strategy.id);
  const weightedDimensions = buildWeightedDimensions(dimensions, weights.dimensions);
  const weightedPenalties = buildWeightedPenalties(penalties, weights.penalties);
  const positiveSubtotal = roundNumber(
    Object.values(weightedDimensions).reduce(
      (sum, contribution) => sum + contribution.weightedScore,
      0
    )
  );
  const penaltySubtotal = roundNumber(
    Object.values(weightedPenalties).reduce(
      (sum, penalty) => sum + penalty.weightedEffect,
      0
    )
  );
  const overallScore = clampScore(positiveSubtotal - penaltySubtotal);

  return {
    evaluable: true,
    overallScore,
    dimensions,
    penalties,
    weightedDimensions,
    weightedPenalties,
    positiveSubtotal,
    penaltySubtotal,
    diagnostics: {
      ...baseDiagnostics,
      reason: "evaluable",
      weightStrategyId: strategy.id,
      dimensionIds: [...COMPOSER_WEIGHTED_DIMENSION_IDS],
      penaltyIds: [...COMPOSER_PENALTY_IDS],
      neutralDimensions: getNeutralDimensions(dimensions),
      unavailableDimensions: [],
      rawDimensionScores: Object.fromEntries(
        Object.entries(dimensions).map(([id, dimension]) => [id, dimension.score])
      ),
      rawPenaltyMagnitudes: Object.fromEntries(
        Object.entries(penalties).map(([id, penalty]) => [id, penalty.magnitude])
      ),
      positiveSubtotal,
      penaltySubtotal,
      finalScore: overallScore,
      quality: diagnostics,
    },
  };
}

function buildWeightedDimensions(dimensions, weights) {
  return Object.fromEntries(
    COMPOSER_WEIGHTED_DIMENSION_IDS.map((dimensionId) => {
      const rawScore = dimensions[dimensionId]?.score || 0;
      const weight = weights[dimensionId] || 0;

      return [
        dimensionId,
        {
          rawScore,
          weight,
          weightedScore: roundNumber(rawScore * weight),
        },
      ];
    })
  );
}

function buildWeightedPenalties(penalties, weights) {
  return Object.fromEntries(
    COMPOSER_PENALTY_IDS.map((penaltyId) => {
      const rawMagnitude = penalties[penaltyId]?.magnitude || 0;
      const weight = weights[penaltyId] || 0;

      return [
        penaltyId,
        {
          rawMagnitude,
          weight,
          weightedEffect: roundNumber(rawMagnitude * weight),
        },
      ];
    })
  );
}

function getNeutralDimensions(dimensions) {
  return Object.entries(dimensions)
    .filter(([, dimension]) => dimension.diagnostics?.neutral)
    .map(([id]) => id);
}

function hasRequestInfeasibility(violations) {
  return (violations || []).some((violation) =>
    REQUEST_INFEASIBLE_CODES.has(violation.code)
  );
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

function stableIds(candidatePerfumes) {
  return Array.isArray(candidatePerfumes)
    ? candidatePerfumes
        .map((perfume) => perfume?.id)
        .filter((id) => Number.isInteger(id))
        .sort((a, b) => a - b)
    : [];
}

function clampScore(value) {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.min(100, roundNumber(value)));
}

function roundNumber(value) {
  if (!Number.isFinite(value)) {
    return value;
  }

  return Math.round(value * 100) / 100;
}
