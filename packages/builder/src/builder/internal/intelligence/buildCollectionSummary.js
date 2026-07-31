import { buildBoxSummary } from "../../../utils/buildBoxSummary.js";
import { buildCoverageSummary } from "../../../utils/buildCoverageSummary.js";
import { getSelectedPerfumeIds } from "../selection/selectionState.js";

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
  const minimumSlotRemaining = Math.max(0, minimumSlots - selectedCount);
  const capacityRemaining = Math.max(0, maximumSlots - selectedCount);
  const pointRemaining = Math.max(0, minimumPoints - totalPoints);
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
      minimum: minimumPoints,
      remaining: pointRemaining,
    },
    money: {
      pointValue,
      total: totalPoints * pointValue,
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
