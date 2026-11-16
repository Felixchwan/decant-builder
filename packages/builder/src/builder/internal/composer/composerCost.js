// What the Composer budgets with: the COST a fragrance has for the customer, in points.
//
// A fragrance's `points` are its regular, canonical value (its tier, its catalog value) and are never altered. When a host runs a
// promotion (see utils/customerPricing.js), the customer pays less than `points x pointValue`, and a monetary budget or a minimum
// spend must be measured against what is actually paid. For one Composer run the entry point (buildComposerBoxProposal) therefore
// hands the Composer COPIES of the affected fragrances carrying `composerCostPoints`: their effective price in points. Nothing is
// persisted and no record is mutated; the copies exist only inside that run, so a promotion that ends simply stops producing them.
//
// Every place the Composer SUMS or COMPARES a fragrance's cost against a budget, a minimum or a floor reads it through
// getComposerCostPoints. Places that use `points` as a tier or value signal (premium presence, signature anchors, tie-breaks) keep
// reading `points`. Without `composerCostPoints` (every fragrance of a points host, and every fragrance not on a valid sale) the two
// are the same number, so nothing changes for them.
export function getComposerCostPoints(perfume) {
  const cost = perfume?.composerCostPoints;

  return typeof cost === "number" && Number.isFinite(cost) ? cost : perfume?.points;
}

// The fragrance as the Composer should cost it: unchanged (the very same object) unless a valid promotion applies to it.
export function withComposerCost(perfume, pricing) {
  if (!perfume || typeof perfume !== "object") return perfume;

  return pricing.getFragrancePrice(perfume).isOnSale ? { ...perfume, composerCostPoints: pricing.getEffectivePoints(perfume) } : perfume;
}
