function normalizeSelection(selectedPerfumes) {
  return Array.isArray(selectedPerfumes) ? selectedPerfumes : [];
}

function hasPerfumeId(catalog, id) {
  return Array.isArray(catalog) && catalog.some((perfume) => perfume?.id === id);
}

function isValidIndex(index, length) {
  return Number.isInteger(index) && index >= 0 && index < length;
}

export function hydrateSelectedPerfumes({
  selectedPerfumeIds,
  catalog,
  maxSelectableSlots,
}) {
  if (!Array.isArray(selectedPerfumeIds) || !Array.isArray(catalog)) {
    return [];
  }

  const cappedIds = selectedPerfumeIds
    .filter((id) => Number.isInteger(id) && hasPerfumeId(catalog, id))
    .slice(0, maxSelectableSlots);
  const uniqueIds = [...new Set(cappedIds)];

  return uniqueIds
    .map((id) => catalog.find((perfume) => perfume.id === id))
    .filter(Boolean);
}

export function getSelectedPerfumeIds(selectedPerfumes) {
  return normalizeSelection(selectedPerfumes).map((perfume) => perfume.id);
}

export function canAddPerfume({
  selectedPerfumes,
  perfume,
  maxSelectableSlots,
}) {
  const currentSelection = normalizeSelection(selectedPerfumes);

  if (currentSelection.length >= maxSelectableSlots) {
    return { allowed: false, reason: "capacity" };
  }

  if (!perfume || typeof perfume !== "object") {
    return { allowed: false, reason: "invalid-perfume" };
  }

  if (currentSelection.some((selectedPerfume) => selectedPerfume.id === perfume.id)) {
    return { allowed: false, reason: "duplicate" };
  }

  return { allowed: true, reason: null };
}

export function addSelectedPerfume({
  selectedPerfumes,
  perfume,
  maxSelectableSlots,
}) {
  const currentSelection = normalizeSelection(selectedPerfumes);
  const eligibility = canAddPerfume({
    selectedPerfumes: currentSelection,
    perfume,
    maxSelectableSlots,
  });

  if (!eligibility.allowed) {
    return selectedPerfumes;
  }

  return [...currentSelection, perfume];
}

export function removeSelectedPerfumeAtIndex({
  selectedPerfumes,
  index,
}) {
  const currentSelection = normalizeSelection(selectedPerfumes);

  if (!isValidIndex(index, currentSelection.length)) {
    return selectedPerfumes;
  }

  return currentSelection.filter((_, currentIndex) => currentIndex !== index);
}

export function reorderSelectedPerfumes({
  selectedPerfumes,
  fromIndex,
  toIndex,
}) {
  const currentSelection = normalizeSelection(selectedPerfumes);

  if (
    fromIndex === toIndex ||
    !isValidIndex(fromIndex, currentSelection.length) ||
    !isValidIndex(toIndex, currentSelection.length)
  ) {
    return selectedPerfumes;
  }

  const reordered = [...currentSelection];
  const [movedPerfume] = reordered.splice(fromIndex, 1);
  reordered.splice(toIndex, 0, movedPerfume);

  return reordered;
}
