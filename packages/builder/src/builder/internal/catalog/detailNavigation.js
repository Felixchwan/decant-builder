// Previous/next navigation for the fragrance-details modal, over whichever
// ordered collection the details were opened from. Boundary behavior is the
// modal's established convention -- navigation WRAPS (last -> first, first ->
// last) and is only offered when more than one fragrance is in scope -- and
// applies identically to every source (the catalog grid, or a Note Explorer
// result set); no source gets its own boundary rules.

// Resolves a snapshot of ordered fragrance ids (e.g. a Note Explorer result
// set, in exactly the order it was displayed) into catalog fragrances.
// Order is preserved verbatim, never re-sorted; ids that no longer resolve are
// dropped rather than throwing. `null`/`undefined` ids mean "no scoped
// collection" and fall back to the given default (the catalog's visible list).
export function resolveDetailNavigationPerfumes({ scopedPerfumeIds, catalog = [], fallbackPerfumes = [] } = {}) {
  if (!Array.isArray(scopedPerfumeIds)) {
    return fallbackPerfumes;
  }

  const perfumesById = new Map((Array.isArray(catalog) ? catalog : []).map((perfume) => [perfume.id, perfume]));

  return scopedPerfumeIds.map((perfumeId) => perfumesById.get(perfumeId)).filter(Boolean);
}

export function getAdjacentPerfume(currentPerfume, perfumes, direction) {
  if (!currentPerfume || !Array.isArray(perfumes) || perfumes.length === 0) {
    return currentPerfume;
  }

  const currentIndex = perfumes.findIndex((perfume) => perfume.id === currentPerfume.id);

  if (currentIndex === -1) {
    return direction > 0 ? perfumes[0] : perfumes[perfumes.length - 1];
  }

  return perfumes[(currentIndex + direction + perfumes.length) % perfumes.length];
}

export function getDetailNavigation(currentPerfume, perfumes) {
  const safePerfumes = Array.isArray(perfumes) ? perfumes : [];
  const index = currentPerfume ? safePerfumes.findIndex((perfume) => perfume.id === currentPerfume.id) : -1;
  const hasCurrent = index >= 0 && safePerfumes.length > 0;

  return {
    index,
    canNavigate: safePerfumes.length > 1,
    previous: hasCurrent ? safePerfumes[(index - 1 + safePerfumes.length) % safePerfumes.length] : null,
    next: hasCurrent ? safePerfumes[(index + 1) % safePerfumes.length] : null,
  };
}
