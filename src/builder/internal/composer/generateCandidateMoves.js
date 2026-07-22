import { evaluateComposerConstraints } from "./evaluateComposerConstraints.js";
import { COMPOSER_MOVE_TYPES } from "./composerMoveTypes.js";

export { COMPOSER_MOVE_TYPES };

export function generateCandidateMoves({
  request,
  currentPerfumes = [],
  catalog = [],
  config,
} = {}) {
  const selectedPerfumes = Array.isArray(currentPerfumes) ? currentPerfumes : [];
  const catalogPerfumes = Array.isArray(catalog) ? catalog : [];
  const selectedIds = new Set(
    selectedPerfumes
      .map((perfume) => perfume?.id)
      .filter((id) => Number.isInteger(id))
  );
  const excludedIds = new Set(request?.excludedPerfumeIds || []);

  return catalogPerfumes
    .filter((perfume) => Number.isInteger(perfume?.id))
    .filter((perfume, index, allPerfumes) =>
      allPerfumes.findIndex((candidate) => candidate?.id === perfume.id) === index
    )
    .filter((perfume) => !selectedIds.has(perfume.id))
    .filter((perfume) => !excludedIds.has(perfume.id))
    .map((perfume) => {
      const candidatePerfumes = stablePerfumes([...selectedPerfumes, perfume]);
      const constraintResult = evaluateComposerConstraints({
        request,
        candidatePerfumes,
        catalog: catalogPerfumes,
        config,
      });

      return {
        type: COMPOSER_MOVE_TYPES.ADD_PERFUME,
        perfumeId: perfume.id,
        perfume,
        candidatePerfumes,
        constraintResult,
      };
    })
    .filter((move) => move.constraintResult.valid)
    .filter((move) =>
      canStillReachConstructionMinimum({
        request,
        move,
        currentPerfumes: selectedPerfumes,
        catalogPerfumes,
        excludedIds,
      })
    )
    .sort((a, b) => a.perfumeId - b.perfumeId);
}

function canStillReachConstructionMinimum({
  request,
  move,
  currentPerfumes,
  catalogPerfumes,
  excludedIds,
}) {
  const constructionMinSlots = request?.constructionMinSlots;

  if (
    !Number.isFinite(constructionMinSlots) ||
    move.candidatePerfumes.length >= constructionMinSlots
  ) {
    return true;
  }

  if (
    !canReachConstructionMinimum({
      request,
      currentPerfumes,
      catalogPerfumes,
      excludedIds,
      constructionMinSlots,
    })
  ) {
    return true;
  }

  return canReachConstructionMinimum({
    request,
    currentPerfumes: move.candidatePerfumes,
    catalogPerfumes,
    excludedIds,
    constructionMinSlots,
  });
}

function canReachConstructionMinimum({
  request,
  currentPerfumes,
  catalogPerfumes,
  excludedIds,
  constructionMinSlots,
}) {
  if (currentPerfumes.length >= constructionMinSlots) {
    return true;
  }

  const remainingSlotCount = constructionMinSlots - currentPerfumes.length;
  const selectedIds = new Set(currentPerfumes.map((perfume) => perfume.id));
  const remainingPointBudget =
    request.maxPoints -
    currentPerfumes.reduce((sum, perfume) => sum + normalizePoints(perfume.points), 0);

  if (!Number.isFinite(remainingPointBudget)) {
    return true;
  }

  const cheapestRemainingPoints = catalogPerfumes
    .filter((perfume) => Number.isInteger(perfume?.id))
    .filter((perfume) => !selectedIds.has(perfume.id))
    .filter((perfume) => !excludedIds.has(perfume.id))
    .map((perfume) => normalizePoints(perfume.points))
    .filter((points) => points >= 0)
    .sort((first, second) => first - second)
    .slice(0, remainingSlotCount);

  if (cheapestRemainingPoints.length < remainingSlotCount) {
    return false;
  }

  const minimumRemainingPoints = cheapestRemainingPoints.reduce(
    (sum, points) => sum + points,
    0
  );

  return minimumRemainingPoints <= remainingPointBudget;
}

function normalizePoints(value) {
  return Number.isFinite(value) ? value : 0;
}

function stablePerfumes(perfumes) {
  return [...perfumes].sort((a, b) => a.id - b.id);
}
