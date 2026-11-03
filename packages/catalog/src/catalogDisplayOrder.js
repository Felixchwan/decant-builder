// The one authoritative presentation order of the catalog: tier, then brand, then fragrance name.
//
// A fragrance's `id` is its permanent identity -- it is stored in saved boxes, Perceptual Learning evidence and
// `?fragrance=<id>` links, so it must never be reassigned to change how the catalog reads. Presentation order is
// therefore derived here, from the records, and applied when a host composes its catalog. IDs are never rewritten.
//
// Tier follows the established ID-band convention (< 100 Bronze, < 200 Silver, < 300 Gold, < 400 Platinum,
// < 500 Diamond, otherwise Mythic -- see docs/backlog/tier-id-range-integrity.md). Brand and name compare
// case- and accent-insensitively ("Hermès" sorts as "Hermes"); an identical brand and name falls back to the ID,
// so the order is fully deterministic.

const TIER_UPPER_BOUNDS = Object.freeze([100, 200, 300, 400, 500]);
const collator = new Intl.Collator("en", { sensitivity: "base" });

export function getFragranceTierRank(id) {
  const rank = TIER_UPPER_BOUNDS.findIndex((bound) => id < bound);

  return rank === -1 ? TIER_UPPER_BOUNDS.length : rank;
}

export function compareFragrancesForDisplay(left, right) {
  return (
    getFragranceTierRank(left.id) - getFragranceTierRank(right.id) ||
    collator.compare(left.brand ?? "", right.brand ?? "") ||
    collator.compare(left.name ?? "", right.name ?? "") ||
    left.id - right.id
  );
}

// Returns a new array in display order. The records themselves (and so their IDs) are the very same objects.
export function sortFragrancesForDisplay(fragrances) {
  if (!Array.isArray(fragrances)) {
    throw new TypeError("sortFragrancesForDisplay fragrances must be an array.");
  }

  return [...fragrances].sort(compareFragrancesForDisplay);
}
