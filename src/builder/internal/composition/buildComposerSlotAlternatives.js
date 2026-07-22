import { discoveryDecantsConfig } from "../../config/index.js";
import { evaluateComposerConstraints } from "../composer/evaluateComposerConstraints.js";
import { evaluateCompositionQuality } from "../composer/evaluateCompositionQuality.js";
import { normalizeComposerRequest } from "../composer/normalizeComposerRequest.js";
import { buildComposerProposalReasons } from "./composerProposalReasons.js";

export const MAX_COMPOSER_SLOT_ALTERNATIVES = 3;

export function buildComposerSlotAlternatives({
  collection = [],
  selectedIds = new Set(),
  request,
  catalog = [],
  notes = {},
  config,
} = {}) {
  const builderConfig = config || discoveryDecantsConfig;
  const normalizedRequest = isNormalizedComposerRequest(request)
    ? request
    : normalizeComposerRequest(request, { config: builderConfig });
  const safeCollection = stableCollection(collection);
  const safeCatalog = stableCollection(catalog);
  const preservedIds = selectedIds instanceof Set ? selectedIds : new Set(selectedIds || []);
  const lockedIds = new Set(normalizedRequest.lockedPerfumeIds || []);
  const diagnostics = {
    candidateEvaluations: 0,
    retainedAlternatives: 0,
    worstSlotAlternativeCount: 0,
    maxAlternativesPerSlot: MAX_COMPOSER_SLOT_ALTERNATIVES,
  };
  const originalConstraintResult = evaluateComposerConstraints({
    request: normalizedRequest,
    candidatePerfumes: safeCollection,
    catalog: safeCatalog,
    config: builderConfig,
  });
  const originalQualityResult = evaluateCompositionQuality({
    request: normalizedRequest,
    candidatePerfumes: safeCollection,
    catalog: safeCatalog,
    notes,
    config: builderConfig,
    constraintResult: originalConstraintResult,
  });
  const originalScore = originalQualityResult?.overallScore;

  const slots = safeCollection.map((perfume, slotIndex) => {
    const preserved = preservedIds.has(perfume.id);
    const slotId = `slot-${slotIndex + 1}`;
    const originalReasons = buildComposerProposalReasons({
      perfume,
      preserved,
      request: normalizedRequest,
    });

    if (preserved || lockedIds.has(perfume.id)) {
      const originalAlternative = buildAlternative({
        perfume,
        reasons: originalReasons,
        qualityResult: originalQualityResult,
        originalScore,
        roleScore: 0,
      });

      diagnostics.retainedAlternatives += 1;
      diagnostics.worstSlotAlternativeCount = Math.max(
        diagnostics.worstSlotAlternativeCount,
        1
      );

      return buildSlot({
        slotId,
        slotIndex,
        perfume,
        preserved,
        alternatives: [originalAlternative],
      });
    }

    const otherIds = new Set(
      safeCollection
        .filter((_, index) => index !== slotIndex)
        .map((item) => item.id)
    );
    const originalReasonKeys = getRoleReasonKeys(originalReasons);
    const evaluatedAlternatives = [];

    safeCatalog.forEach((candidate) => {
      if (!Number.isInteger(candidate?.id) || otherIds.has(candidate.id)) {
        return;
      }

      if (normalizedRequest.excludedPerfumeIds.includes(candidate.id)) {
        return;
      }

      diagnostics.candidateEvaluations += 1;

      const candidateCollection = safeCollection.map((item, index) =>
        index === slotIndex ? candidate : item
      );
      const constraintResult = evaluateComposerConstraints({
        request: normalizedRequest,
        candidatePerfumes: candidateCollection,
        catalog: safeCatalog,
        config: builderConfig,
      });

      if (!constraintResult.valid) {
        return;
      }

      const qualityResult = evaluateCompositionQuality({
        request: normalizedRequest,
        candidatePerfumes: candidateCollection,
        catalog: safeCatalog,
        notes,
        config: builderConfig,
        constraintResult,
      });

      if (!qualityResult.evaluable) {
        return;
      }

      const reasons = buildComposerProposalReasons({
        perfume: candidate,
        preserved: false,
        request: normalizedRequest,
      });

      evaluatedAlternatives.push(
        buildAlternative({
          perfume: candidate,
          reasons,
          qualityResult,
          originalScore,
          roleScore: getRoleSimilarityScore({
            originalReasonKeys,
            candidateReasons: reasons,
            originalPerfume: perfume,
            candidate,
          }),
        })
      );
    });

    const alternatives = selectAlternatives(evaluatedAlternatives, perfume.id);
    diagnostics.retainedAlternatives += alternatives.length;
    diagnostics.worstSlotAlternativeCount = Math.max(
      diagnostics.worstSlotAlternativeCount,
      alternatives.length
    );

    return buildSlot({
      slotId,
      slotIndex,
      perfume,
      preserved,
      alternatives,
    });
  });

  return sanitizeSerializable({
    slots,
    diagnostics,
  });
}

function buildSlot({
  slotId,
  slotIndex,
  perfume,
  preserved,
  alternatives,
}) {
  const safeAlternatives = alternatives.length > 0
    ? alternatives
    : [
        buildAlternative({
          perfume,
          reasons: buildComposerProposalReasons({ perfume }),
          qualityResult: null,
          originalScore: null,
          roleScore: 0,
        }),
      ];

  return {
    slotId,
    slotIndex,
    selectedAlternativeIndex: 0,
    selectedPerfumeId: safeAlternatives[0].id,
    preserved,
    newlyAdded: !preserved,
    alternatives: safeAlternatives,
  };
}

function buildAlternative({
  perfume,
  reasons,
  qualityResult,
  originalScore,
  roleScore,
}) {
  const overallScore = qualityResult?.overallScore;
  const qualityDelta =
    Number.isFinite(overallScore) && Number.isFinite(originalScore)
      ? roundNumber(overallScore - originalScore)
      : null;

  return {
    id: perfume.id,
    perfume,
    points: normalizePoints(perfume.points),
    reasons,
    qualityDelta,
    applicable: true,
    tradeoff: {
      gained: [],
      lost: [],
      unchanged: [],
    },
    diagnostics: {
      roleScore: normalizePoints(roleScore),
      overallScore: Number.isFinite(overallScore) ? overallScore : null,
    },
  };
}

function selectAlternatives(evaluatedAlternatives, originalPerfumeId) {
  const byId = new Map();

  evaluatedAlternatives.forEach((alternative) => {
    if (!byId.has(alternative.id)) {
      byId.set(alternative.id, alternative);
    }
  });

  const originalAlternative = byId.get(originalPerfumeId);
  const rankedAlternatives = [...byId.values()]
    .filter((alternative) => alternative.id !== originalPerfumeId)
    .sort(compareAlternatives)
    .slice(0, MAX_COMPOSER_SLOT_ALTERNATIVES - 1);

  return [
    originalAlternative,
    ...rankedAlternatives,
  ]
    .filter(Boolean)
    .map((alternative) => addTradeoffAgainstOriginal(alternative, originalAlternative));
}

function addTradeoffAgainstOriginal(alternative, originalAlternative) {
  if (!alternative || !originalAlternative || alternative.id === originalAlternative.id) {
    return {
      ...alternative,
      tradeoff: {
        gained: [],
        lost: [],
        unchanged: [],
      },
    };
  }

  const originalReasons = getComparableReasons(originalAlternative.reasons);
  const alternativeReasons = getComparableReasons(alternative.reasons);
  const originalReasonKeys = new Set(originalReasons.map(getReasonKey));
  const alternativeReasonKeys = new Set(alternativeReasons.map(getReasonKey));

  return {
    ...alternative,
    tradeoff: {
      gained: alternativeReasons
        .filter((reason) => !originalReasonKeys.has(getReasonKey(reason)))
        .map((reason) => buildTradeoffItem("gained", reason)),
      lost: originalReasons
        .filter((reason) => !alternativeReasonKeys.has(getReasonKey(reason)))
        .map((reason) => buildTradeoffItem("lost", reason)),
      unchanged: alternativeReasons
        .filter((reason) => originalReasonKeys.has(getReasonKey(reason)))
        .map((reason) => buildTradeoffItem("unchanged", reason)),
    },
  };
}

function getComparableReasons(reasons) {
  return (Array.isArray(reasons) ? reasons : []).filter((reason) =>
    reason.type === "preference_match" || reason.type === "strategy_contribution"
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

function compareAlternatives(first, second) {
  return (
    compareDescending(first.diagnostics.roleScore, second.diagnostics.roleScore) ||
    compareDescending(first.diagnostics.overallScore, second.diagnostics.overallScore) ||
    compareAscending(first.qualityDelta, second.qualityDelta) ||
    compareAscending(first.points, second.points) ||
    compareAscending(first.id, second.id)
  );
}

function getRoleSimilarityScore({
  originalReasonKeys,
  candidateReasons,
  originalPerfume,
  candidate,
}) {
  const candidateReasonKeys = getRoleReasonKeys(candidateReasons);
  const preservedReasonCount = [...originalReasonKeys].filter((key) =>
    candidateReasonKeys.has(key)
  ).length;
  const pointDistance = Math.abs(
    normalizePoints(originalPerfume.points) - normalizePoints(candidate.points)
  );

  return roundNumber(preservedReasonCount * 10 - pointDistance);
}

function getRoleReasonKeys(reasons) {
  return new Set(
    getComparableReasons(reasons).map(getReasonKey)
  );
}

function getReasonKey(reason) {
  return `${reason.type}:${reason.preferenceType || ""}:${reason.preferenceValue || reason.evidence?.strategyId || ""}`;
}

function stableCollection(perfumes) {
  return (Array.isArray(perfumes) ? perfumes : [])
    .filter((perfume) => perfume && typeof perfume === "object" && Number.isInteger(perfume.id))
    .slice();
}

function isNormalizedComposerRequest(request) {
  return (
    request &&
    typeof request === "object" &&
    Array.isArray(request.lockedPerfumeIds) &&
    Array.isArray(request.excludedPerfumeIds) &&
    Array.isArray(request.inputIssues) &&
    typeof request.minSlots === "number" &&
    typeof request.maxSlots === "number" &&
    typeof request.maxPoints === "number"
  );
}

function compareDescending(first, second) {
  const safeFirst = Number.isFinite(first) ? first : -Infinity;
  const safeSecond = Number.isFinite(second) ? second : -Infinity;

  return safeSecond - safeFirst;
}

function compareAscending(first, second) {
  const safeFirst = Number.isFinite(first) ? first : Infinity;
  const safeSecond = Number.isFinite(second) ? second : Infinity;

  return safeFirst - safeSecond;
}

function normalizePoints(value) {
  return Number.isFinite(value) ? value : 0;
}

function roundNumber(value) {
  return Number.isFinite(value) ? Math.round(value * 10000) / 10000 : null;
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
