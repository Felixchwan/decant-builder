// Unlike a static, catalog-wide minimum-budget floor, this is completion-aware:
// it accounts for the box's separate point minimum too, so a customer who
// accepts the default without editing it gets a budget that can realistically
// reach both the remaining slot count and the remaining point requirement —
// not just enough to satisfy the slot count while silently falling short on
// points. This does not change what Composer itself decides to spend or
// select; it only changes what the budget field starts at.
export function deriveDefaultComposerBudget({ catalog, missingSlots, missingPoints, pointValue }) {
  const minimumPerfumePoints = (Array.isArray(catalog) ? catalog : [])
    .map((perfume) => perfume?.points)
    .filter((points) => Number.isFinite(points) && points > 0)
    .sort((first, second) => first - second)[0];

  if (
    !Number.isFinite(minimumPerfumePoints) ||
    !Number.isFinite(missingSlots) ||
    !Number.isFinite(missingPoints) ||
    !Number.isFinite(pointValue)
  ) {
    return "";
  }

  const pointsNeeded = Math.max(missingSlots * minimumPerfumePoints, missingPoints);
  return Math.round(pointsNeeded * pointValue);
}
