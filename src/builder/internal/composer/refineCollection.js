import { discoveryDecantsConfig } from "../../config/index.js";
import { evaluateComposerConstraints } from "./evaluateComposerConstraints.js";
import { evaluateCompositionQuality } from "./evaluateCompositionQuality.js";
import { generateRefinementMoves } from "./generateRefinementMoves.js";
import { normalizeComposerRequest } from "./normalizeComposerRequest.js";

export const REFINEMENT_STATUSES = Object.freeze({
  REFINED: "refined",
  UNCHANGED: "unchanged",
  INVALID_INITIAL: "invalid_initial",
  ITERATION_LIMIT: "iteration_limit",
});

export const REFINEMENT_TERMINATION_REASONS = Object.freeze({
  NO_IMPROVING_SWAP: "no-improving-swap",
  INVALID_INITIAL: "invalid-initial",
  ITERATION_LIMIT: "iteration-limit",
});

const DEFAULT_ITERATION_MULTIPLIER = 2;

export function refineCollection({
  request,
  catalog = [],
  initialPerfumes = [],
  notes = {},
  config,
  maxIterations,
} = {}) {
  const builderConfig = config || discoveryDecantsConfig;
  const normalizedRequest = normalizeComposerRequest(request, { config: builderConfig });
  const catalogPerfumes = Array.isArray(catalog) ? catalog : [];
  const startingPerfumes = stablePerfumes(Array.isArray(initialPerfumes) ? initialPerfumes : []);
  const iterationLimit = normalizeIterationLimit(
    maxIterations,
    startingPerfumes.length,
    catalogPerfumes.length
  );
  const initialConstraintResult = evaluateComposerConstraints({
    request: normalizedRequest,
    candidatePerfumes: startingPerfumes,
    catalog: catalogPerfumes,
    config: builderConfig,
  });
  const initialQuality = evaluateCompositionQuality({
    request: normalizedRequest,
    candidatePerfumes: startingPerfumes,
    catalog: catalogPerfumes,
    notes,
    config: builderConfig,
    constraintResult: initialConstraintResult,
  });

  if (!initialConstraintResult.valid || !initialQuality.evaluable) {
    return buildResult({
      status: REFINEMENT_STATUSES.INVALID_INITIAL,
      terminationReason: REFINEMENT_TERMINATION_REASONS.INVALID_INITIAL,
      request: normalizedRequest,
      initialPerfumes: startingPerfumes,
      collection: startingPerfumes,
      initialQuality,
      qualityResult: initialQuality,
      finalConstraintResult: initialConstraintResult,
      appliedMoves: [],
      iterations: 0,
      diagnostics: {
        iterationLimit,
        generatedMoveCounts: [],
        evaluatedMoveCount: 0,
        rejectedNonImprovingMoveCount: 0,
        visitedCollectionKeys: [getCollectionKey(startingPerfumes)],
        finalLocalOptimum: false,
      },
    });
  }

  let collection = startingPerfumes;
  let currentQuality = initialQuality;
  const visitedKeys = [getCollectionKey(collection)];
  const visitedKeySet = new Set(visitedKeys);
  const appliedMoves = [];
  const generatedMoveCounts = [];
  let evaluatedMoveCount = 0;
  let rejectedNonImprovingMoveCount = 0;
  let finalLocalOptimum = false;
  let terminationReason;

  while (true) {
    const moves = generateRefinementMoves({
      request: normalizedRequest,
      selectedPerfumes: collection,
      catalog: catalogPerfumes,
      config: builderConfig,
    });
    const evaluatedMoves = moves
      .map((move) => ({
        ...move,
        qualityResult: evaluateCompositionQuality({
          request: normalizedRequest,
          candidatePerfumes: move.candidatePerfumes,
          catalog: catalogPerfumes,
          notes,
          config: builderConfig,
          constraintResult: move.constraintResult,
        }),
        collectionKey: getCollectionKey(move.candidatePerfumes),
      }))
      .filter((move) => move.qualityResult.evaluable)
      .filter((move) => !visitedKeySet.has(move.collectionKey))
      .sort(compareRefinementMoves);
    const improvingMoves = evaluatedMoves.filter(
      (move) => move.qualityResult.overallScore > currentQuality.overallScore
    );
    const bestMove = improvingMoves[0];

    generatedMoveCounts.push(moves.length);
    evaluatedMoveCount += evaluatedMoves.length;
    rejectedNonImprovingMoveCount += evaluatedMoves.length - improvingMoves.length;

    if (!bestMove) {
      finalLocalOptimum = true;
      terminationReason = REFINEMENT_TERMINATION_REASONS.NO_IMPROVING_SWAP;
      break;
    }

    if (appliedMoves.length >= iterationLimit) {
      terminationReason = REFINEMENT_TERMINATION_REASONS.ITERATION_LIMIT;
      break;
    }

    const beforeScore = currentQuality.overallScore;
    collection = bestMove.candidatePerfumes;
    currentQuality = bestMove.qualityResult;
    visitedKeySet.add(bestMove.collectionKey);
    visitedKeys.push(bestMove.collectionKey);
    appliedMoves.push({
      type: bestMove.type,
      removePerfumeId: bestMove.removePerfumeId,
      addPerfumeId: bestMove.addPerfumeId,
      beforeScore,
      afterScore: bestMove.qualityResult.overallScore,
      preferenceFit: bestMove.qualityResult.dimensions.preferenceFit.score,
      redundancyPenalty: bestMove.qualityResult.penalties.redundancyPenalty.magnitude,
      addedPoints: bestMove.addedPerfume.points,
      selectedPerfumeIds: collection.map((perfume) => perfume.id),
    });
  }

  const finalConstraintResult = evaluateComposerConstraints({
    request: normalizedRequest,
    candidatePerfumes: collection,
    catalog: catalogPerfumes,
    config: builderConfig,
  });
  const qualityResult = evaluateCompositionQuality({
    request: normalizedRequest,
    candidatePerfumes: collection,
    catalog: catalogPerfumes,
    notes,
    config: builderConfig,
    constraintResult: finalConstraintResult,
  });
  const status = getStatus({
    appliedMoves,
    terminationReason,
  });

  return buildResult({
    status,
    terminationReason,
    request: normalizedRequest,
    initialPerfumes: startingPerfumes,
    collection,
    initialQuality,
    qualityResult,
    finalConstraintResult,
    appliedMoves,
    iterations: appliedMoves.length,
    diagnostics: {
      iterationLimit,
      generatedMoveCounts,
      evaluatedMoveCount,
      rejectedNonImprovingMoveCount,
      visitedCollectionKeys: visitedKeys,
      finalLocalOptimum,
    },
  });
}

function compareRefinementMoves(firstMove, secondMove) {
  return (
    secondMove.qualityResult.overallScore - firstMove.qualityResult.overallScore ||
    secondMove.qualityResult.dimensions.preferenceFit.score -
      firstMove.qualityResult.dimensions.preferenceFit.score ||
    firstMove.qualityResult.penalties.redundancyPenalty.magnitude -
      secondMove.qualityResult.penalties.redundancyPenalty.magnitude ||
    firstMove.addedPerfume.points - secondMove.addedPerfume.points ||
    firstMove.addPerfumeId - secondMove.addPerfumeId ||
    firstMove.removePerfumeId - secondMove.removePerfumeId
  );
}

function buildResult({
  status,
  terminationReason,
  request,
  initialPerfumes,
  collection,
  initialQuality,
  qualityResult,
  finalConstraintResult,
  appliedMoves,
  iterations,
  diagnostics,
}) {
  return {
    status,
    terminationReason,
    initialPerfumes,
    collection,
    initialPerfumeIds: initialPerfumes.map((perfume) => perfume.id),
    finalPerfumeIds: collection.map((perfume) => perfume.id),
    initialQuality,
    qualityResult,
    finalConstraintResult,
    appliedMoves,
    iterations,
    request,
    diagnostics: {
      strategyId: request.strategy.id,
      initialPerfumeIds: initialPerfumes.map((perfume) => perfume.id),
      finalPerfumeIds: collection.map((perfume) => perfume.id),
      initialScore: initialQuality.overallScore,
      finalScore: qualityResult.overallScore,
      scoreImprovement:
        initialQuality.overallScore === null || qualityResult.overallScore === null
          ? null
          : roundNumber(qualityResult.overallScore - initialQuality.overallScore),
      iterations,
      appliedMoves,
      terminationReason,
      finalConstraintValidity: finalConstraintResult.valid,
      ...diagnostics,
    },
  };
}

function getStatus({ appliedMoves, terminationReason }) {
  if (terminationReason === REFINEMENT_TERMINATION_REASONS.ITERATION_LIMIT) {
    return REFINEMENT_STATUSES.ITERATION_LIMIT;
  }

  return appliedMoves.length > 0
    ? REFINEMENT_STATUSES.REFINED
    : REFINEMENT_STATUSES.UNCHANGED;
}

function normalizeIterationLimit(maxIterations, selectedCount, catalogSize) {
  if (maxIterations === undefined || maxIterations === null) {
    return Math.max(1, selectedCount * Math.max(1, catalogSize - selectedCount) * DEFAULT_ITERATION_MULTIPLIER);
  }

  if (typeof maxIterations !== "number" || !Number.isFinite(maxIterations) || maxIterations < 0) {
    return 0;
  }

  return Math.trunc(maxIterations);
}

function getCollectionKey(perfumes) {
  return stablePerfumes(perfumes)
    .map((perfume) => perfume.id)
    .join("|");
}

function stablePerfumes(perfumes) {
  return [...perfumes]
    .filter((perfume) => perfume && typeof perfume === "object")
    .sort((firstPerfume, secondPerfume) => firstPerfume.id - secondPerfume.id);
}

function roundNumber(value) {
  if (!Number.isFinite(value)) {
    return value;
  }

  return Math.round(value * 100) / 100;
}
