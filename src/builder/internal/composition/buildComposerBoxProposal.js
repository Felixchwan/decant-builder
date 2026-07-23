import { composeCollection } from "../composer/composeCollection.js";
import { deriveComposerExplanations } from "../composer/deriveComposerExplanations.js";
import { deriveComposerReasoningFacts } from "../composer/deriveComposerReasoningFacts.js";
import { buildComposerRequestFromBuilderState } from "../recommendations/buildComposerRecommendations.js";
import { buildComposerSlotAlternatives } from "./buildComposerSlotAlternatives.js";
import { deriveProposalItemContributions } from "./deriveProposalItemContributions.js";
import {
  buildComposerContributionReasons,
  buildComposerProposalReason,
  buildComposerProposalReasons,
  uniqueComposerProposalReasons,
} from "./composerProposalReasons.js";

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
  collectionStyle = "balanced_mix",
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
    collectionStyle,
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
      catalog: safeCatalog,
      notes,
      config,
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
      catalog: safeCatalog,
      notes,
      config,
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
    collectionStyle,
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
    catalog: safeCatalog,
    notes,
    config,
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
  collectionStyle = "balanced_mix",
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
    collectionStyle: typeof collectionStyle === "string" ? collectionStyle : "balanced_mix",
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

export function moveComposerProposalSlotAlternative({
  proposal,
  slotId,
  direction = 1,
} = {}) {
  const slot = (proposal?.slotAlternatives || []).find((item) => item.slotId === slotId);

  if (!proposal || !slot || slot.alternatives.length <= 1) {
    return proposal;
  }

  const currentIndex = normalizeAlternativeIndex(
    slot.selectedAlternativeIndex,
    slot.alternatives.length
  );
  const selectedIdsOutsideSlot = getSelectedIdsOutsideSlot(proposal.slotAlternatives, slotId);
  let nextIndex = currentIndex;

  for (let attempt = 0; attempt < slot.alternatives.length; attempt += 1) {
    nextIndex =
      (nextIndex + direction + slot.alternatives.length) % slot.alternatives.length;

    if (!selectedIdsOutsideSlot.has(slot.alternatives[nextIndex].id)) {
      break;
    }
  }

  return selectComposerProposalSlotAlternative({
    proposal,
    slotId,
    selectedAlternativeIndex: nextIndex,
  });
}

export function selectComposerProposalSlotAlternative({
  proposal,
  slotId,
  selectedAlternativeIndex,
} = {}) {
  if (!proposal || !Array.isArray(proposal.slotAlternatives)) {
    return proposal;
  }

  const nextSlots = proposal.slotAlternatives.map((slot) => {
    if (slot.slotId !== slotId || slot.alternatives.length <= 1) {
      return slot;
    }

    const safeIndex = normalizeAlternativeIndex(
      selectedAlternativeIndex,
      slot.alternatives.length
    );
    const selectedAlternative = slot.alternatives[safeIndex];
    const selectedIdsOutsideSlot = getSelectedIdsOutsideSlot(
      proposal.slotAlternatives,
      slotId
    );

    if (selectedIdsOutsideSlot.has(selectedAlternative.id)) {
      return slot;
    }

    return {
      ...slot,
      selectedAlternativeIndex: safeIndex,
      selectedPerfumeId: selectedAlternative.id,
    };
  });

  return rebuildProposalWithSelectedAlternatives(proposal, nextSlots);
}

function getSelectedIdsOutsideSlot(slotAlternatives, slotId) {
  return new Set(
    (Array.isArray(slotAlternatives) ? slotAlternatives : [])
      .filter((slot) => slot.slotId !== slotId)
      .map((slot) => slot.alternatives?.[slot.selectedAlternativeIndex]?.id)
      .filter(Number.isInteger)
  );
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
  collectionStyle,
  pointValue,
  catalog,
  notes,
  config,
  compositionResult,
  reasoningFacts,
  explanations,
  diagnostics,
}) {
  const collection = uniquePerfumes(proposedCollection);
  const selectedIds = new Set(selectedPerfumes.map((perfume) => perfume.id));
  const preservedPerfumes = collection.filter((perfume) => selectedIds.has(perfume.id));
  const addedPerfumes = collection.filter((perfume) => !selectedIds.has(perfume.id));
  const proposalItems = buildProposalItems({
    collection,
    selectedIds,
    compositionResult,
  });
  const slotAlternativeResult = buildComposerSlotAlternatives({
    collection,
    selectedIds,
    request: compositionResult?.normalizedRequest || null,
    catalog,
    notes,
    config,
  });
  const slotAlternatives = slotAlternativeResult.slots.length > 0
    ? slotAlternativeResult.slots
    : buildSingleAlternativeSlots(proposalItems);
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
  const normalizedCollectionStyle =
    collectionStyle || compositionResult?.normalizedRequest?.collectionStyle?.id || "balanced_mix";

  return sanitizeSerializable({
    proposalAvailable: applyAvailable,
    status,
    inputKey,
    collection,
    collectionIds: collection.map((perfume) => perfume.id),
    addedPerfumes,
    preservedPerfumes,
    proposalItems,
    slotAlternatives,
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
      pointValue: computedPointValue,
      collectionStyle: normalizedCollectionStyle,
      applyAvailable,
      noDuplicateIds: collection.length === new Set(collection.map((perfume) => perfume.id)).size,
      selectedIdsPreserved: selectedPerfumes.every((perfume) =>
        collection.some((item) => item.id === perfume.id)
      ),
      alternativeDiagnostics: slotAlternativeResult.diagnostics,
    },
    apply: {
      available: applyAvailable,
      collectionIds: collection.map((perfume) => perfume.id),
    },
  });
}

function rebuildProposalWithSelectedAlternatives(proposal, slotAlternatives) {
  const initialCollection = slotAlternatives
    .map((slot) => slot.alternatives[slot.selectedAlternativeIndex]?.perfume)
    .filter(Boolean);
  const refreshedSlotAlternatives = refreshSelectedSlotReasons({
    slotAlternatives,
    proposal,
    collection: initialCollection,
  });
  const collection = refreshedSlotAlternatives
    .map((slot) => slot.alternatives[slot.selectedAlternativeIndex]?.perfume)
    .filter(Boolean);
  const collectionIds = collection.map((perfume) => perfume.id);
  const duplicateFree = collectionIds.length === new Set(collectionIds).size;
  const preservedPerfumes = refreshedSlotAlternatives
    .filter((slot) => slot.preserved)
    .map((slot) => slot.alternatives[slot.selectedAlternativeIndex]?.perfume)
    .filter(Boolean);
  const addedPerfumes = refreshedSlotAlternatives
    .filter((slot) => !slot.preserved)
    .map((slot) => slot.alternatives[slot.selectedAlternativeIndex]?.perfume)
    .filter(Boolean);
  const proposalItems = refreshedSlotAlternatives.map((slot) => {
    const alternative = slot.alternatives[slot.selectedAlternativeIndex];

    return {
      slotId: slot.slotId,
      id: alternative.id,
      perfume: alternative.perfume,
      preserved: slot.preserved,
      newlyAdded: !slot.preserved,
      reasons: alternative.reasons || [],
    };
  });
  const totalPoints = roundNumber(
    collection.reduce((sum, perfume) => sum + normalizePoints(perfume.points), 0)
  );
  const pointValue = normalizePoints(proposal.diagnostics?.pointValue);
  const orderTotal = roundNumber(totalPoints * pointValue);
  const minimumReached = collection.length >= proposal.minSlots;
  const targetReached = collection.length >= proposal.targetSlots;
  const withinSlots = collection.length <= proposal.maxSlots;
  const withinBudget =
    proposal.diagnostics?.budget === null ||
    !Number.isFinite(proposal.diagnostics?.budget) ||
    orderTotal <= proposal.diagnostics.budget;
  const applyAvailable =
    Boolean(proposal.proposalAvailable) &&
    minimumReached &&
    withinSlots &&
    withinBudget &&
    duplicateFree;

  return sanitizeSerializable({
    ...proposal,
    collection,
    collectionIds,
    addedPerfumes,
    preservedPerfumes,
    proposalItems,
    slotAlternatives: refreshedSlotAlternatives,
    totalPoints,
    orderTotal,
    minimumReached,
    targetReached,
    diagnostics: {
      ...proposal.diagnostics,
      applyAvailable,
      noDuplicateIds: duplicateFree,
      selectedAlternativeIds: collectionIds,
    },
    apply: {
      available: applyAvailable,
      collectionIds: applyAvailable ? collectionIds : [],
    },
  });
}

function refreshSelectedSlotReasons({ slotAlternatives, proposal, collection }) {
  const request = proposal.compositionResult?.normalizedRequest;

  if (!request) {
    return slotAlternatives;
  }

  const contributionResult = deriveProposalItemContributions({
    collection,
    selectedPreferences: request,
    collectionStyle: request.collectionStyle?.id,
    targetSlots: request.targetSlots,
  });

  return slotAlternatives.map((slot) => {
    const selectedAlternative = slot.alternatives[slot.selectedAlternativeIndex];
    const selectedReasons = buildReasonsWithContributions({
      perfume: selectedAlternative.perfume,
      preserved: slot.preserved,
      request,
      facts: contributionResult.byPerfumeId[selectedAlternative.id]?.facts,
    });
    const originalAlternative = slot.alternatives[0];
    const originalReasons =
      slot.selectedAlternativeIndex === 0
        ? selectedReasons
        : getOriginalAlternativeReasons({
            collection,
            slot,
            request,
            originalAlternative,
          });

    return {
      ...slot,
      alternatives: slot.alternatives.map((alternative, index) => {
        if (index !== slot.selectedAlternativeIndex) {
          return alternative;
        }

        return {
          ...alternative,
          reasons: selectedReasons,
          tradeoff: buildAlternativeTradeoff({
            selectedReasons,
            originalReasons,
            isOriginal: index === 0,
          }),
        };
      }),
    };
  });
}

function getOriginalAlternativeReasons({
  collection,
  slot,
  request,
  originalAlternative,
}) {
  const originalCollection = collection.map((perfume, index) =>
    index === slot.slotIndex ? originalAlternative.perfume : perfume
  );
  const contributionResult = deriveProposalItemContributions({
    collection: originalCollection,
    selectedPreferences: request,
    collectionStyle: request.collectionStyle?.id,
    targetSlots: request.targetSlots,
  });

  return buildReasonsWithContributions({
    perfume: originalAlternative.perfume,
    preserved: slot.preserved,
    request,
    facts: contributionResult.byPerfumeId[originalAlternative.id]?.facts,
  });
}

function buildReasonsWithContributions({
  perfume,
  preserved,
  request,
  facts,
}) {
  return uniqueComposerProposalReasons([
    ...buildComposerContributionReasons(facts),
    ...buildComposerProposalReasons({
      perfume,
      preserved,
      request,
    }),
  ]);
}

function buildAlternativeTradeoff({ selectedReasons, originalReasons, isOriginal }) {
  if (isOriginal) {
    return {
      gained: [],
      lost: [],
      unchanged: [],
    };
  }

  const selectedComparableReasons = getComparableTradeoffReasons(selectedReasons);
  const originalComparableReasons = getComparableTradeoffReasons(originalReasons);
  const selectedKeys = new Set(selectedComparableReasons.map(getReasonKey));
  const originalKeys = new Set(originalComparableReasons.map(getReasonKey));

  return {
    gained: selectedComparableReasons
      .filter((reason) => !originalKeys.has(getReasonKey(reason)))
      .map((reason) => buildTradeoffItem("gained", reason)),
    lost: originalComparableReasons
      .filter((reason) => !selectedKeys.has(getReasonKey(reason)))
      .map((reason) => buildTradeoffItem("lost", reason)),
    unchanged: selectedComparableReasons
      .filter((reason) => originalKeys.has(getReasonKey(reason)))
      .map((reason) => buildTradeoffItem("unchanged", reason)),
  };
}

function getComparableTradeoffReasons(reasons) {
  return (Array.isArray(reasons) ? reasons : []).filter((reason) =>
    ["preference_match", "strategy_contribution", "contribution"].includes(reason.type)
  );
}

function buildTradeoffItem(type, reason) {
  return {
    type,
    code: `${type}_${reason.code}`,
    reason,
    evidence: reason.evidence || {},
  };
}

function getReasonKey(reason) {
  if (reason.type === "contribution") {
    return `${reason.type}:${reason.contributionType}:${reason.contributionCategory}:${reason.contributionValue}:${reason.contributionStrength}`;
  }

  return `${reason.type}:${reason.preferenceType || ""}:${reason.preferenceValue || reason.evidence?.strategyId || ""}`;
}

function unavailableProposal({
  status,
  inputKey,
  selectedPerfumes,
  targetSlots,
  minSlots,
  maxSlots,
  budget,
  collectionStyle,
  pointValue,
  compositionResult = null,
  reasoningFacts = null,
  explanations = null,
  diagnostics = {},
}) {
  const totalPoints = roundNumber(
    selectedPerfumes.reduce((sum, perfume) => sum + normalizePoints(perfume.points), 0)
  );
  const normalizedCollectionStyle =
    collectionStyle || compositionResult?.normalizedRequest?.collectionStyle?.id || "balanced_mix";

  return sanitizeSerializable({
    proposalAvailable: false,
    status,
    inputKey,
    collection: selectedPerfumes,
    collectionIds: selectedPerfumes.map((perfume) => perfume.id),
    addedPerfumes: [],
    preservedPerfumes: selectedPerfumes,
    proposalItems: selectedPerfumes.map((perfume) => ({
      id: perfume.id,
      perfume,
      preserved: true,
      newlyAdded: false,
      reasons: [buildComposerProposalReason("preserved_selection", "preserved", {})],
    })),
    slotAlternatives: buildSingleAlternativeSlots(
      selectedPerfumes.map((perfume, index) => ({
        id: perfume.id,
        perfume,
        preserved: true,
        newlyAdded: false,
        reasons: [buildComposerProposalReason("preserved_selection", "preserved", {})],
        slotId: `slot-${index + 1}`,
      }))
    ),
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
      collectionStyle: normalizedCollectionStyle,
      applyAvailable: false,
    },
    apply: {
      available: false,
      collectionIds: [],
    },
  });
}

function buildProposalItems({ collection, selectedIds, compositionResult }) {
  const request = compositionResult?.normalizedRequest || {};

  return collection.map((perfume, index) => {
    const preserved = selectedIds.has(perfume.id);
    const reasons = buildComposerProposalReasons({
      perfume,
      preserved,
      request,
    });

    return {
      slotId: `slot-${index + 1}`,
      id: perfume.id,
      perfume,
      preserved,
      newlyAdded: !preserved,
      reasons,
    };
  });
}

function buildSingleAlternativeSlots(proposalItems) {
  return (Array.isArray(proposalItems) ? proposalItems : []).map((item, index) => ({
    slotId: item.slotId || `slot-${index + 1}`,
    slotIndex: index,
    selectedAlternativeIndex: 0,
    selectedPerfumeId: item.perfume.id,
    preserved: Boolean(item.preserved),
    newlyAdded: Boolean(item.newlyAdded),
    alternatives: [
      {
        id: item.perfume.id,
        perfume: item.perfume,
        points: normalizePoints(item.perfume.points),
        reasons: item.reasons || [],
        qualityDelta: null,
        applicable: true,
        diagnostics: {
          roleScore: null,
          overallScore: null,
        },
      },
    ],
  }));
}

function normalizeAlternativeIndex(index, length) {
  if (!Number.isInteger(index) || length <= 0) {
    return 0;
  }

  return Math.max(0, Math.min(index, length - 1));
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
