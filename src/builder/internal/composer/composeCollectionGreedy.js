import { discoveryDecantsConfig } from "../../config/index.js";
import { evaluateComposerConstraints } from "./evaluateComposerConstraints.js";
import { evaluateCompositionQuality } from "./evaluateCompositionQuality.js";
import { generateCandidateMoves } from "./generateCandidateMoves.js";
import { normalizeComposerRequest } from "./normalizeComposerRequest.js";

export const GREEDY_COMPOSER_STATUSES = Object.freeze({
  COMPLETED: "completed",
  PARTIAL: "partial",
  IMPOSSIBLE: "impossible",
  NO_IMPROVING_MOVE: "no_improving_move",
});

export const GREEDY_TERMINATION_REASONS = Object.freeze({
  TARGET_SLOTS_REACHED: "target-slots-reached",
  NO_LEGAL_MOVE: "no-legal-move",
  NO_IMPROVING_MOVE: "no-improving-move",
  REQUEST_INFEASIBLE: "request-infeasible",
});

const QUALITY_EPSILON = 0.000001;

export function composeCollectionGreedy({
  request,
  catalog = [],
  notes = {},
  config,
} = {}) {
  const builderConfig = config || discoveryDecantsConfig;
  const normalizedRequest = normalizeComposerRequest(request, { config: builderConfig });
  const catalogPerfumes = Array.isArray(catalog) ? catalog : [];
  const catalogById = buildCatalogById(catalogPerfumes);
  const initialPerfumes = getLockedPerfumes(normalizedRequest, catalogById);
  const searchRequest = {
    ...normalizedRequest,
    minSlots: 0,
  };
  const requestConstraintResult = evaluateComposerConstraints({
    request: normalizedRequest,
    candidatePerfumes: initialPerfumes,
    catalog: catalogPerfumes,
    config: builderConfig,
  });

  if (hasRequestInfeasibility(requestConstraintResult.violations)) {
    return buildResult({
      status: GREEDY_COMPOSER_STATUSES.IMPOSSIBLE,
      terminationReason: GREEDY_TERMINATION_REASONS.REQUEST_INFEASIBLE,
      request: normalizedRequest,
      selectedPerfumes: initialPerfumes,
      catalog: catalogPerfumes,
      notes,
      config: builderConfig,
      moveHistory: [],
      iterations: 0,
    });
  }

  let selectedPerfumes = stablePerfumes(initialPerfumes);
  let currentQuality = getSearchQuality({
    request: searchRequest,
    candidatePerfumes: selectedPerfumes,
    catalog: catalogPerfumes,
    notes,
    config: builderConfig,
  });
  const moveHistory = [];
  let terminationReason = GREEDY_TERMINATION_REASONS.TARGET_SLOTS_REACHED;

  while (selectedPerfumes.length < normalizedRequest.targetSlots) {
    const moves = generateCandidateMoves({
      request: searchRequest,
      currentPerfumes: selectedPerfumes,
      catalog: catalogPerfumes,
      config: builderConfig,
    });

    if (moves.length === 0) {
      terminationReason = GREEDY_TERMINATION_REASONS.NO_LEGAL_MOVE;
      break;
    }

    const evaluatedMoves = moves
      .map((move) => ({
        ...move,
        qualityResult: getSearchQuality({
          request: searchRequest,
          candidatePerfumes: move.candidatePerfumes,
          catalog: catalogPerfumes,
          notes,
          config: builderConfig,
          constraintResult: move.constraintResult,
        }),
      }))
      .filter((move) => move.qualityResult.evaluable)
      .sort(compareEvaluatedMoves);
    const bestMove = evaluatedMoves[0];

    if (!bestMove) {
      terminationReason = GREEDY_TERMINATION_REASONS.NO_LEGAL_MOVE;
      break;
    }

    if (
      selectedPerfumes.length >= normalizedRequest.minSlots &&
      currentQuality.evaluable &&
      bestMove.qualityResult.overallScore <= currentQuality.overallScore + QUALITY_EPSILON
    ) {
      terminationReason = GREEDY_TERMINATION_REASONS.NO_IMPROVING_MOVE;
      break;
    }

    selectedPerfumes = bestMove.candidatePerfumes;
    currentQuality = bestMove.qualityResult;
    moveHistory.push({
      type: bestMove.type,
      perfumeId: bestMove.perfumeId,
      qualityScore: bestMove.qualityResult.overallScore,
      preferenceFit: bestMove.qualityResult.dimensions.preferenceFit.score,
      points: bestMove.perfume.points,
      selectedPerfumeIds: selectedPerfumes.map((perfume) => perfume.id),
    });
  }

  return buildResult({
    status: getCompletionStatus({
      selectedPerfumes,
      request: normalizedRequest,
      terminationReason,
      catalog: catalogPerfumes,
      config: builderConfig,
    }),
    terminationReason,
    request: normalizedRequest,
    selectedPerfumes,
    catalog: catalogPerfumes,
    notes,
    config: builderConfig,
    moveHistory,
    iterations: moveHistory.length,
    searchQualityResult: currentQuality,
  });
}

function compareEvaluatedMoves(firstMove, secondMove) {
  return (
    secondMove.qualityResult.overallScore - firstMove.qualityResult.overallScore ||
    secondMove.qualityResult.dimensions.preferenceFit.score -
      firstMove.qualityResult.dimensions.preferenceFit.score ||
    firstMove.perfume.points - secondMove.perfume.points ||
    firstMove.perfumeId - secondMove.perfumeId
  );
}

function getSearchQuality({
  request,
  candidatePerfumes,
  catalog,
  notes,
  config,
  constraintResult,
}) {
  return evaluateCompositionQuality({
    request,
    candidatePerfumes,
    catalog,
    notes,
    config,
    constraintResult,
  });
}

function buildResult({
  status,
  terminationReason,
  request,
  selectedPerfumes,
  catalog,
  notes,
  config,
  moveHistory,
  iterations,
  searchQualityResult,
}) {
  const finalConstraintResult = evaluateComposerConstraints({
    request,
    candidatePerfumes: selectedPerfumes,
    catalog,
    config,
  });
  const qualityResult = evaluateCompositionQuality({
    request,
    candidatePerfumes: selectedPerfumes,
    catalog,
    notes,
    config,
    constraintResult: finalConstraintResult,
  });

  return {
    status,
    terminationReason,
    selectedPerfumes,
    selectedPerfumeIds: selectedPerfumes.map((perfume) => perfume.id),
    iterations,
    moveHistory,
    request,
    finalConstraintResult,
    qualityResult,
    searchQualityResult: searchQualityResult || null,
    diagnostics: {
      catalogSize: catalog.length,
      targetSlots: request.targetSlots,
      minSlots: request.minSlots,
      maxSlots: request.maxSlots,
      lockedPerfumeIds: [...request.lockedPerfumeIds],
      excludedPerfumeIds: [...request.excludedPerfumeIds],
    },
  };
}

function getCompletionStatus({ selectedPerfumes, request, terminationReason, catalog, config }) {
  const finalConstraintResult = evaluateComposerConstraints({
    request,
    candidatePerfumes: selectedPerfumes,
    catalog,
    config,
  });

  if (finalConstraintResult.valid && selectedPerfumes.length >= request.targetSlots) {
    return GREEDY_COMPOSER_STATUSES.COMPLETED;
  }

  if (terminationReason === GREEDY_TERMINATION_REASONS.NO_IMPROVING_MOVE) {
    return GREEDY_COMPOSER_STATUSES.NO_IMPROVING_MOVE;
  }

  if (!finalConstraintResult.valid && selectedPerfumes.length === 0) {
    return GREEDY_COMPOSER_STATUSES.IMPOSSIBLE;
  }

  return GREEDY_COMPOSER_STATUSES.PARTIAL;
}

function getLockedPerfumes(request, catalogById) {
  return stablePerfumes(
    request.lockedPerfumeIds
      .map((perfumeId) => catalogById.get(perfumeId))
      .filter(Boolean)
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

function hasRequestInfeasibility(violations) {
  return (violations || []).some((violation) =>
    [
      "INVALID_BUDGET",
      "MIN_SLOTS_EXCEEDS_MAX_SLOTS",
      "LOCKED_EXCEEDS_MAX_SLOTS",
      "UNKNOWN_LOCKED_PERFUME",
      "LOCKED_POINTS_EXCEED_BUDGET",
      "INSUFFICIENT_CATALOG_CANDIDATES",
    ].includes(violation.code)
  );
}

function stablePerfumes(perfumes) {
  return [...perfumes].sort((a, b) => a.id - b.id);
}
