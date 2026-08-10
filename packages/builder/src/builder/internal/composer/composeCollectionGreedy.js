import { COMPOSER_COLLECTION_STYLE_IDS } from "./composerCollectionStyles.js";
import { evaluateComposerConstraints } from "./evaluateComposerConstraints.js";
import { evaluateCompositionQuality } from "./evaluateCompositionQuality.js";
import { generateCandidateMoves } from "./generateCandidateMoves.js";
import { normalizeComposerRequest } from "./normalizeComposerRequest.js";
import { requireComposerConfig } from "./requireComposerConfig.js";

export const GREEDY_COMPOSER_STATUSES = Object.freeze({
  COMPLETED: "completed",
  PARTIAL: "partial",
  IMPOSSIBLE: "impossible",
  NO_IMPROVING_MOVE: "no_improving_move",
});

export const GREEDY_TERMINATION_REASONS = Object.freeze({
  TARGET_SLOTS_REACHED: "target-slots-reached",
  COLLECTION_STYLE_TARGET_REACHED: "collection-style-target-reached",
  // Only used when an explicit points floor forced construction past the
  // collection style's own preferred target slot count, up to maxSlots, and
  // the floor was then satisfied. When the floor happens to be met exactly
  // at the ordinary target (no extra iterations forced), the ordinary
  // TARGET_SLOTS_REACHED/COLLECTION_STYLE_TARGET_REACHED reasons are used
  // instead, since nothing about the floor changed what already happened.
  POINTS_FLOOR_REACHED: "points-floor-reached",
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
  const builderConfig = requireComposerConfig(config);
  const normalizedRequest = normalizeComposerRequest(request, { config: builderConfig });
  const catalogPerfumes = Array.isArray(catalog) ? catalog : [];
  const catalogById = buildCatalogById(catalogPerfumes);
  const initialPerfumes = getLockedPerfumes(normalizedRequest, catalogById);
  const searchRequest = {
    ...normalizedRequest,
    minSlots: 0,
    constructionMinSlots: normalizedRequest.minSlots,
  };
  const requestConstraintResult = evaluateComposerConstraints({
    request: normalizedRequest,
    candidatePerfumes: initialPerfumes,
    catalog: catalogPerfumes,
    config: builderConfig,
    // The one genuine preflight moment: is an explicit points floor even
    // reachable at all, before spending any search effort on it.
    checkPointsFloorReachability: true,
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
  const searchPlan = buildSearchPlan({
    request: searchRequest,
    selectedPerfumes,
    catalog: catalogPerfumes,
  });
  let currentQuality = getSearchQuality({
    request: searchRequest,
    candidatePerfumes: selectedPerfumes,
    catalog: catalogPerfumes,
    notes,
    config: builderConfig,
  });
  const moveHistory = [];
  let terminationReason = GREEDY_TERMINATION_REASONS.TARGET_SLOTS_REACHED;

  while (
    (selectedPerfumes.length < searchPlan.targetSlots ||
      isBelowPointsFloor(normalizedRequest, selectedPerfumes)) &&
    selectedPerfumes.length < normalizedRequest.maxSlots
  ) {
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
        feasibleFinalSlotCount: getFeasibleFinalSlotCount({
          request: searchRequest,
          candidatePerfumes: move.candidatePerfumes,
          catalog: catalogPerfumes,
        }),
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
      .sort((firstMove, secondMove) =>
        compareEvaluatedMoves(firstMove, secondMove, searchRequest, searchPlan)
      );
    const bestMove = evaluatedMoves[0];

    if (!bestMove) {
      terminationReason = GREEDY_TERMINATION_REASONS.NO_LEGAL_MOVE;
      break;
    }

    if (
      selectedPerfumes.length >= normalizedRequest.minSlots &&
      selectedPerfumes.length >= searchPlan.noImprovingStopSlots &&
      searchRequest.collectionStyle.id !== COMPOSER_COLLECTION_STYLE_IDS.MORE_VARIETY &&
      currentQuality.evaluable &&
      bestMove.qualityResult.overallScore <= currentQuality.overallScore + QUALITY_EPSILON &&
      // An explicit, still-unmet points floor overrides the ordinary
      // quality plateau: a caller who asked for a completion-valid box
      // gets the least-damaging legal move toward it instead of an early
      // stop, for as long as reaching it remains possible (moves that
      // would make it impossible were already filtered out of `moves`
      // above by generateCandidateMoves).
      !isBelowPointsFloor(normalizedRequest, selectedPerfumes)
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

  // Captured once: every branch below only reinterprets a "the while
  // condition itself became false" exit (the loop's only path that leaves
  // terminationReason at its untouched default) — an internal break
  // (NO_LEGAL_MOVE / NO_IMPROVING_MOVE / REQUEST_INFEASIBLE) always wins
  // and is left alone.
  const exitedThroughLoopCondition =
    terminationReason === GREEDY_TERMINATION_REASONS.TARGET_SLOTS_REACHED;

  if (exitedThroughLoopCondition && isBelowPointsFloor(normalizedRequest, selectedPerfumes)) {
    // The only way the loop's own condition can become false while still
    // below an explicit, believed-reachable floor is hitting maxSlots —
    // an honest "ran out of room" outcome, not a real target completion.
    terminationReason = GREEDY_TERMINATION_REASONS.NO_LEGAL_MOVE;
  } else if (
    exitedThroughLoopCondition &&
    searchPlan.targetSlots < normalizedRequest.targetSlots &&
    selectedPerfumes.length >= normalizedRequest.minSlots &&
    selectedPerfumes.length >= searchPlan.targetSlots
  ) {
    terminationReason = GREEDY_TERMINATION_REASONS.COLLECTION_STYLE_TARGET_REACHED;
  }

  if (
    exitedThroughLoopCondition &&
    normalizedRequest.pointsFloor != null &&
    !isBelowPointsFloor(normalizedRequest, selectedPerfumes) &&
    selectedPerfumes.length > searchPlan.targetSlots
  ) {
    // The floor genuinely forced construction past what the collection
    // style's own target math would have produced — say so explicitly
    // rather than reporting an ordinary target-reached reason that would
    // misstate why the search kept going.
    terminationReason = GREEDY_TERMINATION_REASONS.POINTS_FLOOR_REACHED;
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
    searchPlan,
  });
}

function buildSearchPlan({ request, selectedPerfumes, catalog }) {
  if (request.collectionStyle.id !== COMPOSER_COLLECTION_STYLE_IDS.BALANCED_MIX) {
    return {
      targetSlots: request.targetSlots,
      noImprovingStopSlots: request.minSlots,
      balancedTargetSlots: null,
      balancedPremiumFloorSlots: null,
      balancedVarietyCeilingSlots: null,
    };
  }

  const constructionMinSlots = Number.isFinite(request.constructionMinSlots)
    ? request.constructionMinSlots
    : request.minSlots;
  const premiumFloorSlots = Math.max(constructionMinSlots, selectedPerfumes.length);
  const varietyCeilingSlots = getFeasibleFinalSlotCount({
    request,
    candidatePerfumes: selectedPerfumes,
    catalog,
  });
  const balancedTargetSlots = getBalancedTargetSlots({
    request,
    premiumFloorSlots,
    varietyCeilingSlots,
    selectedCount: selectedPerfumes.length,
  });

  return {
    targetSlots: balancedTargetSlots,
    noImprovingStopSlots: constructionMinSlots > 0 ? balancedTargetSlots : 0,
    balancedTargetSlots,
    balancedPremiumFloorSlots: premiumFloorSlots,
    balancedVarietyCeilingSlots: varietyCeilingSlots,
  };
}

function getBalancedTargetSlots({
  request,
  premiumFloorSlots,
  varietyCeilingSlots,
  selectedCount,
}) {
  const feasibleCeiling = Math.min(request.targetSlots, varietyCeilingSlots);

  if (feasibleCeiling <= selectedCount) {
    return selectedCount;
  }

  if (feasibleCeiling < premiumFloorSlots) {
    return Math.max(selectedCount, premiumFloorSlots);
  }

  if (feasibleCeiling <= premiumFloorSlots) {
    return feasibleCeiling;
  }

  return clampSlotCount(
    Math.round((premiumFloorSlots + feasibleCeiling) / 2),
    Math.max(selectedCount, premiumFloorSlots),
    feasibleCeiling
  );
}

function compareEvaluatedMoves(firstMove, secondMove, request, searchPlan) {
  if (request.collectionStyle.id === COMPOSER_COLLECTION_STYLE_IDS.MORE_VARIETY) {
    return (
      secondMove.feasibleFinalSlotCount - firstMove.feasibleFinalSlotCount ||
      secondMove.candidatePerfumes.length - firstMove.candidatePerfumes.length ||
      secondMove.qualityResult.overallScore - firstMove.qualityResult.overallScore ||
      secondMove.qualityResult.dimensions.preferenceFit.score -
        firstMove.qualityResult.dimensions.preferenceFit.score ||
      firstMove.perfume.points - secondMove.perfume.points ||
      firstMove.perfumeId - secondMove.perfumeId
    );
  }

  if (request.collectionStyle.id === COMPOSER_COLLECTION_STYLE_IDS.BALANCED_MIX) {
    const targetSlots = searchPlan?.balancedTargetSlots || request.minSlots;
    const firstCanReachTarget = firstMove.feasibleFinalSlotCount >= targetSlots ? 1 : 0;
    const secondCanReachTarget = secondMove.feasibleFinalSlotCount >= targetSlots ? 1 : 0;

    return (
      secondCanReachTarget - firstCanReachTarget ||
      secondMove.qualityResult.overallScore - firstMove.qualityResult.overallScore ||
      secondMove.qualityResult.dimensions.preferenceFit.score -
        firstMove.qualityResult.dimensions.preferenceFit.score ||
      firstMove.perfume.points - secondMove.perfume.points ||
      firstMove.perfumeId - secondMove.perfumeId
    );
  }

  return (
    secondMove.qualityResult.overallScore - firstMove.qualityResult.overallScore ||
    secondMove.qualityResult.dimensions.preferenceFit.score -
      firstMove.qualityResult.dimensions.preferenceFit.score ||
    firstMove.perfume.points - secondMove.perfume.points ||
    firstMove.perfumeId - secondMove.perfumeId
  );
}

function getFeasibleFinalSlotCount({ request, candidatePerfumes, catalog }) {
  const currentPerfumes = Array.isArray(candidatePerfumes) ? candidatePerfumes : [];
  const selectedIds = new Set(currentPerfumes.map((perfume) => perfume.id));
  const excludedIds = new Set(request.excludedPerfumeIds || []);
  const remainingPointBudget =
    request.maxPoints -
    currentPerfumes.reduce((sum, perfume) => sum + normalizePoints(perfume.points), 0);

  if (!Number.isFinite(remainingPointBudget)) {
    return Math.min(
      request.targetSlots,
      currentPerfumes.length +
        catalog.filter(
          (perfume) =>
            Number.isInteger(perfume?.id) &&
            !selectedIds.has(perfume.id) &&
            !excludedIds.has(perfume.id)
        ).length
    );
  }

  let usedPoints = 0;
  let fillCount = 0;
  const remainingPoints = catalog
    .filter((perfume) => Number.isInteger(perfume?.id))
    .filter((perfume) => !selectedIds.has(perfume.id))
    .filter((perfume) => !excludedIds.has(perfume.id))
    .map((perfume) => normalizePoints(perfume.points))
    .filter((points) => points >= 0)
    .sort((first, second) => first - second);

  for (const points of remainingPoints) {
    if (currentPerfumes.length + fillCount >= request.targetSlots) {
      break;
    }

    if (usedPoints + points > remainingPointBudget) {
      break;
    }

    usedPoints += points;
    fillCount += 1;
  }

  return currentPerfumes.length + fillCount;
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
  searchPlan,
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
      searchTargetSlots: searchPlan?.targetSlots || request.targetSlots,
      balancedTargetSlots: searchPlan?.balancedTargetSlots || null,
      balancedPremiumFloorSlots: searchPlan?.balancedPremiumFloorSlots || null,
      balancedVarietyCeilingSlots: searchPlan?.balancedVarietyCeilingSlots || null,
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
      "POINTS_FLOOR_UNREACHABLE",
    ].includes(violation.code)
  );
}

function isBelowPointsFloor(request, perfumes) {
  if (request.pointsFloor == null) {
    return false;
  }

  const totalPoints = perfumes.reduce(
    (sum, perfume) => sum + (Number.isFinite(perfume?.points) ? perfume.points : 0),
    0
  );

  return totalPoints < request.pointsFloor;
}

function normalizePoints(value) {
  return Number.isFinite(value) ? value : 0;
}

function clampSlotCount(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function stablePerfumes(perfumes) {
  return [...perfumes].sort((a, b) => a.id - b.id);
}
