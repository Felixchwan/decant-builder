import { evaluateComposerConstraints } from "./evaluateComposerConstraints.js";

export const COMPOSER_MOVE_TYPES = Object.freeze({
  ADD_PERFUME: "ADD_PERFUME",
});

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
    .sort((a, b) => a.perfumeId - b.perfumeId);
}

function stablePerfumes(perfumes) {
  return [...perfumes].sort((a, b) => a.id - b.id);
}
