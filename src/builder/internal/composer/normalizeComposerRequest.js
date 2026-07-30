import { getComposerCollectionStyle } from "./composerCollectionStyles.js";
import { getComposerStrategy } from "./composerStrategies.js";
import { requireComposerConfig } from "./requireComposerConfig.js";

const EMPTY_ARRAY = [];

export function normalizeComposerRequest(input = {}, context = {}) {
  const source = input && typeof input === "object" ? input : {};
  const config = requireComposerConfig(context?.config);
  const pointValue = config.commerce.pointValue;
  const currency = config.commerce.currency;
  const maxSelectableSlots = config.box.maxSelectableSlots;
  const defaultMinSlots = config.box.minSelectableSlots;
  const defaultTargetSlots = normalizeSlotNumber(
    config.box.defaultTargetSlots,
    maxSelectableSlots
  );
  const inputIssues = [];
  const budgetResult = normalizeBudget(source.budget, pointValue);
  const lockedPerfumeIds = normalizeIdList(source.lockedPerfumeIds);
  const excludedPerfumeIdsBeforeConflict = normalizeIdList(source.excludedPerfumeIds);
  const lockedSet = new Set(lockedPerfumeIds);
  const excludedPerfumeIds = excludedPerfumeIdsBeforeConflict.filter(
    (id) => !lockedSet.has(id)
  );
  const lockedExcludedConflicts = excludedPerfumeIdsBeforeConflict.filter((id) =>
    lockedSet.has(id)
  );
  let maxSlots = normalizeSlotNumber(source.maxSlots, maxSelectableSlots);
  maxSlots = clamp(maxSlots, 0, maxSelectableSlots);
  let minSlots = normalizeSlotNumber(source.minSlots, defaultMinSlots);
  minSlots = clamp(minSlots, 0, maxSelectableSlots);

  if (minSlots > maxSlots) {
    inputIssues.push({
      code: "MIN_SLOTS_EXCEEDS_MAX_SLOTS",
      minSlots,
      maxSlots,
    });
    minSlots = maxSlots;
  }

  const targetSlots = clamp(
    normalizeSlotNumber(source.targetSlots, defaultTargetSlots),
    minSlots,
    maxSlots
  );

  if (budgetResult.issue) {
    inputIssues.push(budgetResult.issue);
  }

  return {
    budget: budgetResult.budget,
    currency,
    pointValue,
    maxPoints: budgetResult.maxPoints,
    minSlots,
    maxSlots,
    targetSlots,
    lockedPerfumeIds,
    excludedPerfumeIds,
    preferredSeasons: normalizePreferenceList(source.preferredSeasons),
    preferredOccasions: normalizePreferenceList(source.preferredOccasions),
    preferredVibes: normalizePreferenceList(source.preferredVibes),
    strategy: getComposerStrategy(source.strategy),
    collectionStyle: getComposerCollectionStyle(source.collectionStyle),
    inputIssues,
    lockedExcludedConflicts,
  };
}

function normalizeBudget(value, pointValue) {
  if (value === undefined || value === null || value === "") {
    return {
      budget: null,
      maxPoints: Infinity,
      issue: null,
    };
  }

  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    return {
      budget: null,
      maxPoints: 0,
      issue: {
        code: "INVALID_BUDGET",
        budget: value,
      },
    };
  }

  return {
    budget: value,
    maxPoints: roundNumber(value / pointValue),
    issue: null,
  };
}

function normalizeIdList(value) {
  if (!Array.isArray(value)) {
    return EMPTY_ARRAY;
  }

  return uniqueInOrder(value.filter((id) => Number.isInteger(id)));
}

function normalizePreferenceList(value) {
  if (!Array.isArray(value)) {
    return EMPTY_ARRAY;
  }

  return uniqueInOrder(
    value
      .filter((item) => typeof item === "string")
      .map((item) => item.trim().toLowerCase().replace(/\s+/g, " "))
      .filter(Boolean)
  );
}

function normalizeSlotNumber(value, fallback) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }

  return Math.trunc(value);
}

function uniqueInOrder(values) {
  return [...new Set(values)];
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function roundNumber(value) {
  return Math.round(value * 10000) / 10000;
}
