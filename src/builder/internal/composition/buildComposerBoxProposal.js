import { composeCollection } from "../composer/composeCollection.js";
import { deriveComposerExplanations } from "../composer/deriveComposerExplanations.js";
import { deriveComposerReasoningFacts } from "../composer/deriveComposerReasoningFacts.js";
import { buildComposerRequestFromBuilderState } from "../recommendations/buildComposerRecommendations.js";

export const COMPOSER_BOX_PROPOSAL_STATUSES = Object.freeze({
  COMPLETED: "completed",
  PARTIAL: "partial",
  ALREADY_COMPLETE: "already_complete",
  AT_MAX: "at_max",
  INVALID_SELECTION: "invalid_selection",
  IMPOSSIBLE: "impossible",
  FAILED: "failed",
  MALFORMED_INPUT: "malformed_input",
});

export function buildComposerBoxProposal({
  selectedPerfumes = [],
  excludedPerfumeIds = [],
  strategy = "balanced",
  budget = null,
  targetSlots,
  minSlots,
  maxSlots,
  seasons = [],
  occasions = [],
  vibes = [],
  catalog = [],
  notes = {},
  config,
} = {}) {
  const safeCatalog = Array.isArray(catalog) ? catalog : [];
  const safeSelectedPerfumes = Array.isArray(selectedPerfumes) ? selectedPerfumes : [];
  const safeExcludedPerfumeIds = normalizeIdList(excludedPerfumeIds);
  const maxCustomerSlots = normalizeSlot(maxSlots, config?.box?.maxSelectableSlots || 14);
  const minCustomerSlots = normalizeSlot(minSlots, config?.box?.minSelectableSlots || 6);
  const customerTargetSlots = Math.min(
    maxCustomerSlots,
    Math.max(
      minCustomerSlots,
      normalizeSlot(targetSlots, config?.box?.defaultTargetSlots || maxCustomerSlots)
    )
  );
  const preferences = {
    preferredSeasons: normalizeStringList(seasons),
    preferredOccasions: normalizeStringList(occasions),
    preferredVibes: normalizeStringList(vibes),
  };
  const inputKey = buildComposerProposalInputKey({
    selectedPerfumes: safeSelectedPerfumes,
    excludedPerfumeIds: safeExcludedPerfumeIds,
    strategy,
    budget,
    targetSlots: customerTargetSlots,
    minSlots: minCustomerSlots,
    maxSlots: maxCustomerSlots,
    seasons: preferences.preferredSeasons,
    occasions: preferences.preferredOccasions,
    vibes: preferences.preferredVibes,
    catalog,
    config,
  });
  const selectedValidation = validateCurrentSelections({
    selectedPerfumes: safeSelectedPerfumes,
    catalog: safeCatalog,
    maxSlots: maxCustomerSlots,
  });

  if (!config || !config.box || !config.commerce) {
    return unavailableProposal({
      status: COMPOSER_BOX_PROPOSAL_STATUSES.MALFORMED_INPUT,
      inputKey,
      selectedPerfumes: safeSelectedPerfumes,
      targetSlots: customerTargetSlots,
      minSlots: minCustomerSlots,
      maxSlots: maxCustomerSlots,
      budget,
      pointValue: config?.commerce?.pointValue,
      diagnostics: {
        reason: "missing-config",
        issues: ["MISSING_CONFIG"],
      },
    });
  }

  if (!selectedValidation.valid) {
    return unavailableProposal({
      status: COMPOSER_BOX_PROPOSAL_STATUSES.INVALID_SELECTION,
      inputKey,
      selectedPerfumes: safeSelectedPerfumes,
      targetSlots: customerTargetSlots,
      minSlots: minCustomerSlots,
      maxSlots: maxCustomerSlots,
      budget,
      pointValue: config.commerce.pointValue,
      diagnostics: selectedValidation.diagnostics,
    });
  }

  if (safeSelectedPerfumes.length >= maxCustomerSlots) {
    return successfulProposal({
      status: COMPOSER_BOX_PROPOSAL_STATUSES.AT_MAX,
      inputKey,
      selectedPerfumes: safeSelectedPerfumes,
      proposedCollection: safeSelectedPerfumes,
      targetSlots: customerTargetSlots,
      minSlots: minCustomerSlots,
      maxSlots: maxCustomerSlots,
      budget,
      pointValue: config.commerce.pointValue,
      compositionResult: null,
      reasoningFacts: null,
      explanations: null,
      diagnostics: {
        reason: "customer-slots-full",
        issues: [],
      },
    });
  }

  if (safeSelectedPerfumes.length >= customerTargetSlots) {
    return successfulProposal({
      status: COMPOSER_BOX_PROPOSAL_STATUSES.ALREADY_COMPLETE,
      inputKey,
      selectedPerfumes: safeSelectedPerfumes,
      proposedCollection: safeSelectedPerfumes,
      targetSlots: customerTargetSlots,
      minSlots: minCustomerSlots,
      maxSlots: maxCustomerSlots,
      budget,
      pointValue: config.commerce.pointValue,
      compositionResult: null,
      reasoningFacts: null,
      explanations: null,
      diagnostics: {
        reason: "target-already-reached",
        issues: [],
      },
    });
  }

  const request = buildComposerRequestFromBuilderState({
    selectedPerfumes: safeSelectedPerfumes,
    config: {
      ...config,
      box: {
        ...config.box,
        minSelectableSlots: minCustomerSlots,
        maxSelectableSlots: maxCustomerSlots,
        defaultTargetSlots: customerTargetSlots,
      },
    },
    limit: customerTargetSlots - safeSelectedPerfumes.length,
    budget,
    strategy,
    preferences,
    excludedPerfumeIds: safeExcludedPerfumeIds,
  });
  const compositionResult = composeCollection({
    request: {
      ...request,
      minSlots: minCustomerSlots,
      maxSlots: maxCustomerSlots,
      targetSlots: customerTargetSlots,
    },
    catalog: safeCatalog,
    notes,
    config,
    mode: "best",
  });
  const reasoningFacts = deriveComposerReasoningFacts({
    compositionResult,
    catalog: safeCatalog,
    config,
  });
  const explanations = deriveComposerExplanations({ reasoningFacts });
  const proposalStatus = getProposalStatus(compositionResult.status);

  if (!compositionResult.composed || ["impossible", "failed"].includes(compositionResult.status)) {
    return unavailableProposal({
      status: proposalStatus,
      inputKey,
      selectedPerfumes: safeSelectedPerfumes,
      targetSlots: customerTargetSlots,
      minSlots: minCustomerSlots,
      maxSlots: maxCustomerSlots,
      budget,
      pointValue: config.commerce.pointValue,
      compositionResult,
      reasoningFacts,
      explanations,
      diagnostics: {
        reason: compositionResult.terminationReason || "composition-unavailable",
        issues: getViolationCodes(compositionResult.constraintResult),
      },
    });
  }

  const proposedCollection = mergePreservedThenAdded({
    selectedPerfumes: safeSelectedPerfumes,
    composerCollection: compositionResult.collection || [],
  });

  return successfulProposal({
    status: proposalStatus,
    inputKey,
    selectedPerfumes: safeSelectedPerfumes,
    proposedCollection,
    targetSlots: customerTargetSlots,
    minSlots: minCustomerSlots,
    maxSlots: maxCustomerSlots,
    budget,
    pointValue: config.commerce.pointValue,
    compositionResult,
    reasoningFacts,
    explanations,
    diagnostics: {
      reason: compositionResult.terminationReason || null,
      issues: getViolationCodes(compositionResult.constraintResult),
    },
  });
}

export function buildComposerProposalInputKey({
  selectedPerfumes = [],
  excludedPerfumeIds = [],
  strategy = "balanced",
  budget = null,
  targetSlots,
  minSlots,
  maxSlots,
  seasons = [],
  occasions = [],
  vibes = [],
  catalog = [],
  config,
} = {}) {
  return stableStringify({
    selectedPerfumeIds: uniqueIdsInOrder(
      (Array.isArray(selectedPerfumes) ? selectedPerfumes : []).map((perfume) => perfume?.id)
    ),
    excludedPerfumeIds: normalizeIdList(excludedPerfumeIds),
    strategy: typeof strategy === "string" ? strategy : "balanced",
    budget: normalizeBudgetValue(budget),
    targetSlots: normalizeNullableNumber(targetSlots),
    minSlots: normalizeNullableNumber(minSlots),
    maxSlots: normalizeNullableNumber(maxSlots),
    seasons: normalizeStringList(seasons),
    occasions: normalizeStringList(occasions),
    vibes: normalizeStringList(vibes),
    catalogIds: normalizeIdList(
      (Array.isArray(catalog) ? catalog : []).map((perfume) => perfume?.id)
    ),
    pointValue: normalizeNullableNumber(config?.commerce?.pointValue),
    maxSelectableSlots: normalizeNullableNumber(config?.box?.maxSelectableSlots),
    minSelectableSlots: normalizeNullableNumber(config?.box?.minSelectableSlots),
    defaultTargetSlots: normalizeNullableNumber(config?.box?.defaultTargetSlots),
  });
}

export function isComposerBoxProposalStale(proposal, inputKey) {
  return !proposal || !proposal.inputKey || proposal.inputKey !== inputKey;
}

function successfulProposal({
  status,
  inputKey,
  selectedPerfumes,
  proposedCollection,
  targetSlots,
  minSlots,
  maxSlots,
  budget,
  pointValue,
  compositionResult,
  reasoningFacts,
  explanations,
  diagnostics,
}) {
  const collection = uniquePerfumes(proposedCollection);
  const selectedIds = new Set(selectedPerfumes.map((perfume) => perfume.id));
  const preservedPerfumes = collection.filter((perfume) => selectedIds.has(perfume.id));
  const addedPerfumes = collection.filter((perfume) => !selectedIds.has(perfume.id));
  const totalPoints = roundNumber(
    collection.reduce((sum, perfume) => sum + normalizePoints(perfume.points), 0)
  );
  const computedPointValue = normalizePoints(
    compositionResult?.normalizedRequest?.pointValue || reasoningFacts?.summary?.pointValue || pointValue
  );
  const orderTotal = roundNumber(totalPoints * computedPointValue);
  const minimumReached = collection.length >= minSlots;
  const targetReached = collection.length >= targetSlots;
  const applyAvailable = minimumReached && collection.length <= maxSlots;

  return sanitizeSerializable({
    proposalAvailable: applyAvailable,
    status,
    inputKey,
    collection,
    collectionIds: collection.map((perfume) => perfume.id),
    addedPerfumes,
    preservedPerfumes,
    totalPoints,
    orderTotal,
    targetSlots,
    minSlots,
    maxSlots,
    minimumReached,
    targetReached,
    compositionResult,
    reasoningFacts,
    explanations,
    preview: {
      perfumeCount: collection.length,
      addedCount: addedPerfumes.length,
      preservedCount: preservedPerfumes.length,
      headline: explanations?.headline || null,
      strengths: explanations?.strengths || [],
      weaknesses: explanations?.weaknesses || [],
      recommendations: explanations?.recommendations || [],
      highlights: explanations?.highlights || [],
    },
    diagnostics: {
      ...diagnostics,
      budget: normalizeBudgetValue(budget),
      applyAvailable,
      noDuplicateIds: collection.length === new Set(collection.map((perfume) => perfume.id)).size,
      selectedIdsPreserved: selectedPerfumes.every((perfume) =>
        collection.some((item) => item.id === perfume.id)
      ),
    },
    apply: {
      available: applyAvailable,
      collectionIds: collection.map((perfume) => perfume.id),
    },
  });
}

function unavailableProposal({
  status,
  inputKey,
  selectedPerfumes,
  targetSlots,
  minSlots,
  maxSlots,
  budget,
  pointValue,
  compositionResult = null,
  reasoningFacts = null,
  explanations = null,
  diagnostics = {},
}) {
  const totalPoints = roundNumber(
    selectedPerfumes.reduce((sum, perfume) => sum + normalizePoints(perfume.points), 0)
  );

  return sanitizeSerializable({
    proposalAvailable: false,
    status,
    inputKey,
    collection: selectedPerfumes,
    collectionIds: selectedPerfumes.map((perfume) => perfume.id),
    addedPerfumes: [],
    preservedPerfumes: selectedPerfumes,
    totalPoints,
    orderTotal: roundNumber(
      totalPoints * normalizePoints(compositionResult?.normalizedRequest?.pointValue || pointValue)
    ),
    targetSlots,
    minSlots,
    maxSlots,
    minimumReached: selectedPerfumes.length >= minSlots,
    targetReached: selectedPerfumes.length >= targetSlots,
    compositionResult,
    reasoningFacts,
    explanations,
    preview: {
      perfumeCount: selectedPerfumes.length,
      addedCount: 0,
      preservedCount: selectedPerfumes.length,
      headline: explanations?.headline || null,
      strengths: explanations?.strengths || [],
      weaknesses: explanations?.weaknesses || [],
      recommendations: explanations?.recommendations || [],
      highlights: explanations?.highlights || [],
    },
    diagnostics: {
      ...diagnostics,
      budget: normalizeBudgetValue(budget),
      applyAvailable: false,
    },
    apply: {
      available: false,
      collectionIds: [],
    },
  });
}

function validateCurrentSelections({ selectedPerfumes, catalog, maxSlots }) {
  const catalogIds = new Set(catalog.map((perfume) => perfume.id));
  const selectedIds = selectedPerfumes.map((perfume) => perfume?.id);
  const missingIds = selectedIds.filter((id) => !catalogIds.has(id));
  const duplicateIds = selectedIds.filter((id, index) => selectedIds.indexOf(id) !== index);
  const issues = [];

  if (selectedPerfumes.length > maxSlots) {
    issues.push("CURRENT_SELECTIONS_EXCEED_MAX_SLOTS");
  }

  missingIds.forEach((id) => issues.push(`SELECTED_PERFUME_MISSING:${id}`));
  duplicateIds.forEach((id) => issues.push(`DUPLICATE_SELECTED_PERFUME:${id}`));

  return {
    valid: issues.length === 0,
    diagnostics: {
      reason: issues[0] || null,
      issues,
    },
  };
}

function mergePreservedThenAdded({ selectedPerfumes, composerCollection }) {
  const selectedIds = new Set(selectedPerfumes.map((perfume) => perfume.id));
  const addedPerfumes = (composerCollection || []).filter((perfume) => !selectedIds.has(perfume.id));

  return [...selectedPerfumes, ...addedPerfumes];
}

function getProposalStatus(composerStatus) {
  if (composerStatus === "completed") return COMPOSER_BOX_PROPOSAL_STATUSES.COMPLETED;
  if (composerStatus === "partial") return COMPOSER_BOX_PROPOSAL_STATUSES.PARTIAL;
  if (composerStatus === "impossible") return COMPOSER_BOX_PROPOSAL_STATUSES.IMPOSSIBLE;
  if (composerStatus === "failed") return COMPOSER_BOX_PROPOSAL_STATUSES.FAILED;
  return COMPOSER_BOX_PROPOSAL_STATUSES.FAILED;
}

function getViolationCodes(constraintResult) {
  return (constraintResult?.violations || []).map((violation) => violation.code).sort();
}

function uniquePerfumes(perfumes) {
  const seen = new Set();

  return (Array.isArray(perfumes) ? perfumes : []).filter((perfume) => {
    if (!Number.isInteger(perfume?.id) || seen.has(perfume.id)) {
      return false;
    }

    seen.add(perfume.id);
    return true;
  });
}

function normalizeIdList(values) {
  return [...new Set((Array.isArray(values) ? values : []).filter(Number.isInteger))].sort(
    (first, second) => first - second
  );
}

function uniqueIdsInOrder(values) {
  return [...new Set((Array.isArray(values) ? values : []).filter(Number.isInteger))];
}

function normalizeStringList(values) {
  return [
    ...new Set(
      (Array.isArray(values) ? values : [])
        .filter((value) => typeof value === "string")
        .map((value) => value.trim().toLowerCase())
        .filter(Boolean)
    ),
  ].sort();
}

function normalizeSlot(value, fallback) {
  return Number.isFinite(value) ? Math.trunc(value) : fallback;
}

function normalizeNullableNumber(value) {
  return Number.isFinite(value) ? value : null;
}

function normalizeBudgetValue(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  return Number.isFinite(value) ? value : null;
}

function normalizePoints(value) {
  return Number.isFinite(value) ? value : 0;
}

function roundNumber(value) {
  return Number.isFinite(value) ? Math.round(value * 10000) / 10000 : 0;
}

function stableStringify(value) {
  return JSON.stringify(value);
}

function sanitizeSerializable(value) {
  return JSON.parse(
    JSON.stringify(value, (_key, entry) => {
      if (entry === undefined) return null;
      if (typeof entry === "number" && !Number.isFinite(entry)) return null;
      return entry;
    })
  );
}
