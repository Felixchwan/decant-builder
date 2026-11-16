import { buildBoxSummary } from "../../../utils/buildBoxSummary.js";
import { buildCoverageSummary } from "../../../utils/buildCoverageSummary.js";
import { getSelectedPerfumeIds } from "../selection/selectionState.js";
import { createCustomerPricing } from "../../../utils/customerPricing.js";

function assertNumber(value, path) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    throw new Error(`buildCollectionSummary requires numeric config value: ${path}`);
  }
}

export function buildCollectionSummary({
  selectedPerfumes,
  catalog,
  notes,
  config,
}) {
  if (!Array.isArray(selectedPerfumes)) {
    throw new Error("buildCollectionSummary requires selectedPerfumes to be an array.");
  }

  if (!Array.isArray(catalog)) {
    throw new Error("buildCollectionSummary requires catalog to be an array.");
  }

  if (!config) {
    throw new Error("buildCollectionSummary requires a builder config.");
  }

  const minimumSlots = config.box?.minSelectableSlots;
  const maximumSlots = config.box?.maxSelectableSlots;
  const minimumPoints = config.box?.minPoints;
  const pointValue = config.commerce?.pointValue;

  assertNumber(minimumSlots, "box.minSelectableSlots");
  assertNumber(maximumSlots, "box.maxSelectableSlots");
  assertNumber(minimumPoints, "box.minPoints");
  assertNumber(pointValue, "commerce.pointValue");

  const selectedIds = getSelectedPerfumeIds(selectedPerfumes);
  const selectedCount = selectedPerfumes.length;
  const totalPoints = selectedPerfumes.reduce(
    (sum, perfume) => sum + perfume.points,
    0
  );
  // What the customer is charged: each fragrance at its effective price (the sale price while a valid sale applies, its regular
  // points x pointValue otherwise). `points.total` stays the regular value of the box (its tiers, its catalog value, never altered
  // by a promotion); `points.spend` is the same box measured at what the customer actually pays. The minimum box spend and the
  // Curator Bonus are commercial thresholds on what is paid, so they read `spend`; with no promotion the two are the same number.
  const pricing = createCustomerPricing(config);
  const savings = selectedPerfumes.reduce((sum, perfume) => sum + pricing.getFragrancePrice(perfume).savings, 0);
  const spendPoints = savings === 0 ? totalPoints : (totalPoints * pointValue - savings) / pointValue;
  const minimumSlotRemaining = Math.max(0, minimumSlots - selectedCount);
  const capacityRemaining = Math.max(0, maximumSlots - selectedCount);
  const pointRemaining = Math.max(0, minimumPoints - spendPoints);
  const hasMinimumSlots = minimumSlotRemaining === 0;
  const hasMinimumPoints = pointRemaining === 0;
  const blockers = [];

  if (!hasMinimumSlots) {
    blockers.push("minimum-slots");
  }

  if (!hasMinimumPoints) {
    blockers.push("minimum-points");
  }

  const boxSummary = buildBoxSummary(selectedPerfumes, notes);
  const coverageSummary = buildCoverageSummary(boxSummary, catalog);

  return {
    selectedPerfumes,
    selectedIds,
    counts: {
      selected: selectedCount,
      minimum: minimumSlots,
      maximum: maximumSlots,
      remaining: capacityRemaining,
      minimumRemaining: minimumSlotRemaining,
    },
    points: {
      total: totalPoints,
      spend: spendPoints,
      minimum: minimumPoints,
      remaining: pointRemaining,
    },
    money: {
      pointValue,
      total: totalPoints * pointValue - savings,
      regularTotal: totalPoints * pointValue,
      savings,
      currency: config.commerce?.currency,
    },
    readiness: {
      hasMinimumSlots,
      hasMinimumPoints,
      isReady: blockers.length === 0,
      blockers,
    },
    boxSummary,
    coverageSummary,
  };
}
