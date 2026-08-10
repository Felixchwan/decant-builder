import { COMPOSER_MOVE_TYPES } from "./composerMoveTypes.js";
import { evaluateComposerConstraints } from "./evaluateComposerConstraints.js";

export function generateRefinementMoves({
  request,
  selectedPerfumes = [],
  catalog = [],
  config,
} = {}) {
  const currentPerfumes = stablePerfumes(Array.isArray(selectedPerfumes) ? selectedPerfumes : []);
  const catalogPerfumes = Array.isArray(catalog) ? catalog : [];
  const catalogById = buildCatalogById(catalogPerfumes);
  const selectedIds = new Set(
    currentPerfumes
      .map((perfume) => perfume?.id)
      .filter((id) => Number.isInteger(id))
  );
  const lockedIds = new Set(request?.lockedPerfumeIds || []);
  const excludedIds = new Set(request?.excludedPerfumeIds || []);
  const removablePerfumes = currentPerfumes
    .filter((perfume) => Number.isInteger(perfume?.id))
    .filter((perfume) => !lockedIds.has(perfume.id));
  const addablePerfumes = [...catalogById.values()]
    .filter((perfume) => !selectedIds.has(perfume.id))
    .filter((perfume) => !excludedIds.has(perfume.id));

  return removablePerfumes
    .flatMap((removedPerfume) =>
      addablePerfumes.map((addedPerfume) => {
        const candidatePerfumes = stablePerfumes([
          ...currentPerfumes.filter((perfume) => perfume.id !== removedPerfume.id),
          addedPerfume,
        ]);
        const constraintResult = evaluateComposerConstraints({
          request,
          candidatePerfumes,
          catalog: catalogPerfumes,
          config,
        });

        return {
          type: COMPOSER_MOVE_TYPES.SWAP_PERFUME,
          removePerfumeId: removedPerfume.id,
          addPerfumeId: addedPerfume.id,
          removedPerfume,
          addedPerfume,
          candidatePerfumes,
          constraintResult,
        };
      })
    )
    .filter((move) => move.constraintResult.valid)
    .filter((move) => preservesPointsFloorIfAlreadyMet({ request, currentPerfumes, move }))
    .sort(
      (firstMove, secondMove) =>
        firstMove.removePerfumeId - secondMove.removePerfumeId ||
        firstMove.addPerfumeId - secondMove.addPerfumeId
    );
}

// Refinement is only ever invoked (see getGreedyRefinementEligibility in
// composeCollection.js) once the incoming collection already satisfies any
// requested points floor, or no floor was requested at all — greedy alone
// is responsible for reaching it, since only greedy can add slots.
// Refinement's sole responsibility toward the floor is therefore not to
// undo it: once the starting collection meets it, every swap must keep the
// resulting total at or above it too. There is nothing to enforce while
// the starting collection is below the floor, because that state should
// not reach refinement in the first place.
function preservesPointsFloorIfAlreadyMet({ request, currentPerfumes, move }) {
  const pointsFloor = request?.pointsFloor;

  if (pointsFloor == null) {
    return true;
  }

  const currentPoints = currentPerfumes.reduce(
    (sum, perfume) => sum + normalizePoints(perfume.points),
    0
  );

  if (currentPoints < pointsFloor) {
    return true;
  }

  const resultingPoints = move.candidatePerfumes.reduce(
    (sum, perfume) => sum + normalizePoints(perfume.points),
    0
  );

  return resultingPoints >= pointsFloor;
}

function normalizePoints(value) {
  return Number.isFinite(value) ? value : 0;
}

function buildCatalogById(catalog) {
  return catalog.reduce((map, perfume) => {
    if (Number.isInteger(perfume?.id) && !map.has(perfume.id)) {
      map.set(perfume.id, perfume);
    }

    return map;
  }, new Map());
}

function stablePerfumes(perfumes) {
  return [...perfumes]
    .filter((perfume) => perfume && typeof perfume === "object")
    .sort((firstPerfume, secondPerfume) => firstPerfume.id - secondPerfume.id);
}
