import { discoveryDecantsConfig } from "../../config/index.js";
import { composeCollectionGreedy } from "./composeCollectionGreedy.js";
import { COMPOSER_MODES, normalizeComposerMode } from "./composerModes.js";
import { evaluateComposerConstraints } from "./evaluateComposerConstraints.js";
import { evaluateCompositionQuality } from "./evaluateCompositionQuality.js";
import { normalizeComposerRequest } from "./normalizeComposerRequest.js";
import { REFINEMENT_STATUSES, refineCollection } from "./refineCollection.js";

export const COMPOSER_STATUSES = Object.freeze({
  COMPLETED: "completed",
  PARTIAL: "partial",
  IMPOSSIBLE: "impossible",
  FAILED: "failed",
});

export const COMPOSER_TERMINATION_REASONS = Object.freeze({
  GREEDY_TARGET_REACHED: "greedy-target-reached",
  GREEDY_VALID_PARTIAL: "greedy-valid-partial",
  REFINEMENT_LOCAL_OPTIMUM: "refinement-local-optimum",
  REFINEMENT_ITERATION_LIMIT: "refinement-iteration-limit",
  REFINEMENT_SKIPPED_FAST_MODE: "refinement-skipped-fast-mode",
  REFINEMENT_SKIPPED_INELIGIBLE_GREEDY: "refinement-skipped-ineligible-greedy",
  REFINEMENT_FALLBACK_INVALID_RESULT: "refinement-fallback-invalid-result",
  REFINEMENT_FALLBACK_LOWER_SCORE: "refinement-fallback-lower-score",
  REQUEST_INFEASIBLE: "request-infeasible",
  MINIMUM_UNREACHABLE: "minimum-unreachable",
  FINAL_VALIDATION_FAILED: "final-validation-failed",
});

const FINAL_SOURCES = Object.freeze({
  GREEDY: "greedy",
  REFINEMENT: "refinement",
  NONE: "none",
});

export function composeCollection({
  request,
  catalog = [],
  notes = {},
  mode,
  config,
  refinementMaxIterations,
} = {}) {
  const builderConfig = config || discoveryDecantsConfig;
  const normalizedRequest = canonicalizeComposerRequest(
    normalizeComposerRequest(request, { config: builderConfig })
  );
  const modeResult = normalizeComposerMode(mode);
  const normalizedMode = modeResult.mode;
  const catalogPerfumes = Array.isArray(catalog) ? catalog : [];
  const engineRequest = toEngineRequest(normalizedRequest);
  const greedyResult = composeCollectionGreedy({
    request: engineRequest,
    catalog: catalogPerfumes,
    notes,
    config: builderConfig,
  });
  const greedyEligibility = getGreedyRefinementEligibility(greedyResult, normalizedRequest);
  let refinementResult = null;
  let refinementSkippedReason =
    normalizedMode === COMPOSER_MODES.FAST
      ? COMPOSER_TERMINATION_REASONS.REFINEMENT_SKIPPED_FAST_MODE
      : null;
  let fallbackUsed = false;
  let fallbackReason = null;
  let finalSource = FINAL_SOURCES.GREEDY;
  let finalCollection = stablePerfumes(greedyResult.selectedPerfumes || []);

  if (normalizedMode === COMPOSER_MODES.BEST) {
    if (greedyEligibility.eligible) {
      refinementResult = refineCollection({
        request: engineRequest,
        catalog: catalogPerfumes,
        notes,
        config: builderConfig,
        initialPerfumes: greedyResult.selectedPerfumes,
        maxIterations: refinementMaxIterations,
      });
      const selection = selectBestModeCollection({
        greedyResult,
        refinementResult,
      });

      finalSource = selection.finalSource;
      finalCollection = selection.finalCollection;
      fallbackUsed = selection.fallbackUsed;
      fallbackReason = selection.fallbackReason;
    } else {
      refinementSkippedReason =
        COMPOSER_TERMINATION_REASONS.REFINEMENT_SKIPPED_INELIGIBLE_GREEDY;
    }
  }

  const constraintResult = evaluateComposerConstraints({
    request: normalizedRequest,
    candidatePerfumes: finalCollection,
    catalog: catalogPerfumes,
    config: builderConfig,
  });
  const qualityResult = evaluateCompositionQuality({
    request: normalizedRequest,
    candidatePerfumes: finalCollection,
    catalog: catalogPerfumes,
    notes,
    config: builderConfig,
    constraintResult,
  });
  const status = getComposerStatus({
    constraintResult,
    qualityResult,
    selectedCount: finalCollection.length,
    request: normalizedRequest,
    greedyResult,
  });
  const composed = getComposed({
    constraintResult,
    qualityResult,
    selectedCount: finalCollection.length,
    request: normalizedRequest,
  });
  const terminationReason = getTopLevelTerminationReason({
    status,
    mode: normalizedMode,
    finalSource,
    greedyResult,
    refinementResult,
    refinementSkippedReason,
    fallbackReason,
    constraintResult,
    request: normalizedRequest,
    selectedCount: finalCollection.length,
  });

  return {
    composed,
    mode: normalizedMode,
    status,
    terminationReason,
    normalizedRequest,
    collection: finalCollection,
    collectionIds: finalCollection.map((perfume) => perfume.id),
    constraintResult,
    qualityResult,
    greedyResult,
    refinementResult,
    diagnostics: {
      mode: normalizedMode,
      modeInputIssue: modeResult.inputIssue,
      normalizedStrategyId: normalizedRequest.strategy.id,
      greedyInvoked: true,
      greedyStatus: greedyResult.status,
      greedyTerminationReason: greedyResult.terminationReason,
      greedyCollectionIds: greedyResult.selectedPerfumeIds || [],
      greedyScore: greedyResult.qualityResult?.overallScore ?? null,
      refinementRequested: normalizedMode === COMPOSER_MODES.BEST,
      refinementEligible: greedyEligibility.eligible,
      refinementEligibilityReason: greedyEligibility.reason,
      refinementInvoked: Boolean(refinementResult),
      refinementStatus: refinementResult?.status || null,
      refinementTerminationReason: refinementResult?.terminationReason || null,
      refinementCollectionIds: refinementResult?.finalPerfumeIds || [],
      refinementScore: refinementResult?.qualityResult?.overallScore ?? null,
      refinementScoreImprovement: refinementResult?.diagnostics?.scoreImprovement ?? null,
      refinementSkippedReason,
      fallbackUsed,
      fallbackReason,
      finalSource,
      finalCollectionIds: finalCollection.map((perfume) => perfume.id),
      finalScore: qualityResult.overallScore,
      finalConstraintValidity: constraintResult.valid,
      composed,
      status,
      terminationReason,
      lockedIdsPreserved: idsPresent(normalizedRequest.lockedPerfumeIds, finalCollection),
      excludedIdsAbsent: idsAbsent(normalizedRequest.excludedPerfumeIds, finalCollection),
      targetSlotsReached: finalCollection.length >= normalizedRequest.targetSlots,
      minimumSlotsReached: finalCollection.length >= normalizedRequest.minSlots,
    },
  };
}

function canonicalizeComposerRequest(request) {
  return {
    ...request,
    lockedPerfumeIds: [...request.lockedPerfumeIds].sort((a, b) => a - b),
    excludedPerfumeIds: [...request.excludedPerfumeIds].sort((a, b) => a - b),
    preferredSeasons: [...request.preferredSeasons].sort(),
    preferredOccasions: [...request.preferredOccasions].sort(),
    preferredVibes: [...request.preferredVibes].sort(),
  };
}

function toEngineRequest(request) {
  return {
    ...request,
    strategy: request.strategy.id,
    collectionStyle: request.collectionStyle.id,
  };
}

function getGreedyRefinementEligibility(greedyResult, request) {
  if (!greedyResult?.finalConstraintResult?.valid) {
    return {
      eligible: false,
      reason: "greedy-final-constraints-invalid",
    };
  }

  if (!greedyResult?.qualityResult?.evaluable) {
    return {
      eligible: false,
      reason: "greedy-quality-unevaluable",
    };
  }

  if ((greedyResult.selectedPerfumes || []).length < request.minSlots) {
    return {
      eligible: false,
      reason: "greedy-below-minimum-slots",
    };
  }

  if (greedyResult.status === "impossible") {
    return {
      eligible: false,
      reason: "greedy-impossible",
    };
  }

  return {
    eligible: true,
    reason: "eligible",
  };
}

function selectBestModeCollection({ greedyResult, refinementResult }) {
  const greedyCollection = stablePerfumes(greedyResult.selectedPerfumes || []);
  const greedyScore = greedyResult.qualityResult?.overallScore;
  const refinementScore = refinementResult?.qualityResult?.overallScore;

  if (
    !refinementResult ||
    refinementResult.status === REFINEMENT_STATUSES.INVALID_INITIAL ||
    !refinementResult.finalConstraintResult?.valid ||
    !refinementResult.qualityResult?.evaluable
  ) {
    return {
      finalSource: FINAL_SOURCES.GREEDY,
      finalCollection: greedyCollection,
      fallbackUsed: Boolean(refinementResult),
      fallbackReason: refinementResult
        ? COMPOSER_TERMINATION_REASONS.REFINEMENT_FALLBACK_INVALID_RESULT
        : null,
    };
  }

  if (
    typeof greedyScore === "number" &&
    typeof refinementScore === "number" &&
    refinementScore < greedyScore
  ) {
    return {
      finalSource: FINAL_SOURCES.GREEDY,
      finalCollection: greedyCollection,
      fallbackUsed: true,
      fallbackReason: COMPOSER_TERMINATION_REASONS.REFINEMENT_FALLBACK_LOWER_SCORE,
    };
  }

  if (refinementResult.status === REFINEMENT_STATUSES.REFINED) {
    return {
      finalSource: FINAL_SOURCES.REFINEMENT,
      finalCollection: stablePerfumes(refinementResult.collection || []),
      fallbackUsed: false,
      fallbackReason: null,
    };
  }

  if (
    refinementResult.status === REFINEMENT_STATUSES.ITERATION_LIMIT &&
    typeof greedyScore === "number" &&
    typeof refinementScore === "number" &&
    refinementScore >= greedyScore
  ) {
    return {
      finalSource: FINAL_SOURCES.REFINEMENT,
      finalCollection: stablePerfumes(refinementResult.collection || []),
      fallbackUsed: false,
      fallbackReason: null,
    };
  }

  return {
    finalSource: FINAL_SOURCES.GREEDY,
    finalCollection: greedyCollection,
    fallbackUsed: false,
    fallbackReason: null,
  };
}

function getComposerStatus({ constraintResult, qualityResult, selectedCount, request }) {
  if (!constraintResult.valid || !qualityResult.evaluable) {
    return selectedCount >= request.minSlots
      ? COMPOSER_STATUSES.FAILED
      : COMPOSER_STATUSES.IMPOSSIBLE;
  }

  if (selectedCount >= request.targetSlots) {
    return COMPOSER_STATUSES.COMPLETED;
  }

  return COMPOSER_STATUSES.PARTIAL;
}

function getComposed({ constraintResult, qualityResult, selectedCount, request }) {
  return (
    constraintResult.valid &&
    qualityResult.evaluable &&
    selectedCount >= request.minSlots
  );
}

function getTopLevelTerminationReason({
  status,
  mode,
  finalSource,
  greedyResult,
  refinementResult,
  refinementSkippedReason,
  fallbackReason,
  constraintResult,
  request,
  selectedCount,
}) {
  if (fallbackReason) {
    return fallbackReason;
  }

  if (!constraintResult.valid) {
    if (hasRequestInfeasibility(constraintResult.violations)) {
      return COMPOSER_TERMINATION_REASONS.REQUEST_INFEASIBLE;
    }

    if (selectedCount < request.minSlots) {
      return COMPOSER_TERMINATION_REASONS.MINIMUM_UNREACHABLE;
    }

    return COMPOSER_TERMINATION_REASONS.FINAL_VALIDATION_FAILED;
  }

  if (mode === COMPOSER_MODES.FAST) {
    return selectedCount >= request.targetSlots
      ? COMPOSER_TERMINATION_REASONS.GREEDY_TARGET_REACHED
      : COMPOSER_TERMINATION_REASONS.GREEDY_VALID_PARTIAL;
  }

  if (finalSource === FINAL_SOURCES.REFINEMENT) {
    return refinementResult?.status === REFINEMENT_STATUSES.ITERATION_LIMIT
      ? COMPOSER_TERMINATION_REASONS.REFINEMENT_ITERATION_LIMIT
      : COMPOSER_TERMINATION_REASONS.REFINEMENT_LOCAL_OPTIMUM;
  }

  if (refinementSkippedReason) {
    return refinementSkippedReason;
  }

  if (greedyResult?.status === "completed") {
    return COMPOSER_TERMINATION_REASONS.GREEDY_TARGET_REACHED;
  }

  return status === COMPOSER_STATUSES.PARTIAL
    ? COMPOSER_TERMINATION_REASONS.GREEDY_VALID_PARTIAL
    : COMPOSER_TERMINATION_REASONS.REFINEMENT_LOCAL_OPTIMUM;
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

function idsPresent(ids, collection) {
  const selectedIds = new Set(collection.map((perfume) => perfume.id));
  return ids.every((id) => selectedIds.has(id));
}

function idsAbsent(ids, collection) {
  const selectedIds = new Set(collection.map((perfume) => perfume.id));
  return ids.every((id) => !selectedIds.has(id));
}

function stablePerfumes(perfumes) {
  return [...perfumes]
    .filter((perfume) => perfume && typeof perfume === "object")
    .sort((firstPerfume, secondPerfume) => firstPerfume.id - secondPerfume.id);
}
