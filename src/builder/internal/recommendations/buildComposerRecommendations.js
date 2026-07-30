import { composeCollection } from "../composer/composeCollection.js";
import { deriveComposerExplanations } from "../composer/deriveComposerExplanations.js";
import { deriveComposerReasoningFacts } from "../composer/deriveComposerReasoningFacts.js";
import { requireComposerConfig } from "../composer/requireComposerConfig.js";

const DEFAULT_LIMIT = 3;

export function buildComposerRecommendations({
  perfumes = [],
  selectedPerfumes = [],
  notes = {},
  config,
  limit = DEFAULT_LIMIT,
  budget = null,
} = {}) {
  const builderConfig = requireComposerConfig(config);
  const safePerfumes = Array.isArray(perfumes) ? perfumes : [];
  const safeSelectedPerfumes = Array.isArray(selectedPerfumes) ? selectedPerfumes : [];
  const selectedIds = new Set(safeSelectedPerfumes.map((perfume) => perfume.id));

  if (
    safePerfumes.length === 0 ||
    safeSelectedPerfumes.length >= builderConfig.box.maxSelectableSlots
  ) {
    return emptyRecommendations();
  }

  const basedOnYourPicks =
    safeSelectedPerfumes.length > 0
      ? buildComposerRecommendationLane({
          perfumes: safePerfumes,
          selectedPerfumes: safeSelectedPerfumes,
          selectedIds,
          notes,
          config: builderConfig,
          limit,
          budget,
          lane: "basedOnYourPicks",
          strategy: "signature",
          preferences: deriveSelectedPreferences(safeSelectedPerfumes),
          excludedPerfumeIds: [],
        })
      : [];
  const basedOnYourPicksIds = new Set(
    basedOnYourPicks.map((recommendation) => recommendation.perfume.id)
  );
  const toBalanceYourBox = buildComposerRecommendationLane({
    perfumes: safePerfumes,
    selectedPerfumes: safeSelectedPerfumes,
    selectedIds,
    notes,
    config: builderConfig,
    limit,
    budget,
    lane: "toBalanceYourBox",
    strategy: "balanced",
    preferences: {},
    excludedPerfumeIds: [...basedOnYourPicksIds],
  });

  return {
    basedOnYourPicks,
    toBalanceYourBox,
  };
}

function buildComposerRecommendationLane({
  perfumes,
  selectedPerfumes,
  selectedIds,
  notes,
  config,
  limit,
  budget,
  lane,
  strategy,
  preferences,
  excludedPerfumeIds,
}) {
  const request = buildComposerRequestFromBuilderState({
    selectedPerfumes,
    config,
    limit,
    budget,
    strategy,
    preferences,
    excludedPerfumeIds,
  });
  const compositionResult = composeCollection({
    request,
    catalog: perfumes,
    notes,
    config,
    mode: "best",
  });

  if (
    compositionResult.status === "impossible" ||
    compositionResult.status === "failed" ||
    !compositionResult.composed
  ) {
    return [];
  }

  const reasoningFacts = deriveComposerReasoningFacts({
    compositionResult,
    catalog: perfumes,
    config,
  });
  const explanations = deriveComposerExplanations({ reasoningFacts });

  if (!reasoningFacts.derivable || !explanations.explainable) {
    return [];
  }

  const moveScoreById = buildMoveScoreMap(compositionResult);

  return (compositionResult.collection || [])
    .filter((perfume) => !selectedIds.has(perfume.id))
    .filter((perfume) => !excludedPerfumeIds.includes(perfume.id))
    .map((perfume, index) =>
      buildRecommendation({
        perfume,
        lane,
        index,
        reasoningFacts,
        explanations,
        moveScore: moveScoreById.get(perfume.id),
      })
    )
    .filter((recommendation) => recommendation.explanations.length > 0)
    .sort(compareRecommendations)
    .slice(0, limit);
}

export function buildComposerRequestFromBuilderState({
  selectedPerfumes = [],
  config,
  limit = DEFAULT_LIMIT,
  budget = null,
  strategy = "balanced",
  collectionStyle = "balanced_mix",
  preferences = {},
  excludedPerfumeIds = [],
} = {}) {
  const builderConfig = requireComposerConfig(config);
  const safeSelectedPerfumes = Array.isArray(selectedPerfumes) ? selectedPerfumes : [];
  const maxSelectableSlots = builderConfig.box.maxSelectableSlots;
  const minSlots = builderConfig.box.minSelectableSlots;
  const targetSlots = Math.min(
    maxSelectableSlots,
    Math.max(minSlots, safeSelectedPerfumes.length + limit)
  );

  return {
    budget,
    minSlots,
    maxSlots: maxSelectableSlots,
    targetSlots,
    lockedPerfumeIds: uniqueSortedNumbers(safeSelectedPerfumes.map((perfume) => perfume.id)),
    excludedPerfumeIds: uniqueSortedNumbers(excludedPerfumeIds),
    preferredSeasons: preferences.preferredSeasons || [],
    preferredOccasions: preferences.preferredOccasions || [],
    preferredVibes: preferences.preferredVibes || [],
    strategy,
    collectionStyle,
  };
}

function buildRecommendation({
  perfume,
  lane,
  index,
  reasoningFacts,
  explanations,
  moveScore,
}) {
  const explanationObjects = derivePerfumeExplanationObjects({
    perfume,
    lane,
    reasoningFacts,
    explanations,
  });
  const score = getRecommendationScore({
    index,
    moveScore,
    reasoningFacts,
    explanationObjects,
  });

  return {
    perfume,
    score,
    baseScore: score,
    finalScore: score,
    reasons: [],
    explanations: explanationObjects,
    scoreBreakdown: buildScoreBreakdown(explanationObjects),
    composer: {
      lane,
      source: "composer",
      qualityScore: reasoningFacts.summary.qualityScore,
      compositionStatus: reasoningFacts.compositionStatus,
      recommendationCodes: explanationObjects.map((item) => item.code),
    },
  };
}

function derivePerfumeExplanationObjects({ perfume, lane, reasoningFacts, explanations }) {
  const highlightObjects = (explanations.highlights || [])
    .filter((highlight) => highlight.perfumeId === perfume.id)
    .map((highlight) => ({
      code: highlight.reason,
      severity: highlight.reason === "redundancy_driver" ? "notice" : "positive",
      evidence: highlight.evidence || {},
    }));
  const recommendationObjects = (explanations.recommendations || [])
    .filter((recommendation) => supportsRecommendation(perfume, recommendation))
    .map((recommendation) => ({
      code: recommendation.code,
      severity: recommendation.priority === "high" ? "positive" : "notice",
      evidence: recommendation.evidence || {},
    }));
  const laneObject = {
    code: lane === "basedOnYourPicks" ? "composer_affinity_pick" : "composer_balance_pick",
    severity: "positive",
    evidence: {
      lane,
      strategy: reasoningFacts.strategy,
    },
  };

  return uniqueExplanationObjects([
    ...recommendationObjects,
    ...highlightObjects,
    laneObject,
  ]).slice(0, 4);
}

function supportsRecommendation(perfume, recommendation) {
  const evidence = recommendation.evidence || {};

  if (evidence.missingSeason) {
    return getSeasonWeight(perfume, evidence.missingSeason) > 0;
  }

  if (evidence.missingOccasion) {
    return (perfume.occasions || []).includes(evidence.missingOccasion);
  }

  if (Array.isArray(evidence.unmatched)) {
    return evidence.unmatched.some((item) =>
      getPreferenceValues(perfume, item.domain).includes(item.preference)
    );
  }

  return false;
}

function buildScoreBreakdown(explanationObjects) {
  return explanationObjects.reduce(
    (breakdown, explanation) => {
      if (explanation.code.includes("coverage")) {
        breakdown.seasons += 12;
      } else if (explanation.code.includes("occasion")) {
        breakdown.occasions += 8;
      } else if (explanation.code.includes("preference") || explanation.code.includes("affinity")) {
        breakdown.sharedVibes += 8;
      } else if (explanation.code.includes("diversity")) {
        breakdown.accordDiversity += 8;
      } else {
        breakdown.noteDiversity += 4;
      }

      return breakdown;
    },
    {
      seasons: 0,
      occasions: 0,
      vibes: 0,
      accordDiversity: 0,
      noteDiversity: 0,
      sharedAccords: 0,
      sharedVibes: 0,
      sharedOccasions: 0,
      sharedSeasons: 0,
    }
  );
}

function getRecommendationScore({
  index,
  moveScore,
  reasoningFacts,
  explanationObjects,
}) {
  const evidenceScore = explanationObjects.reduce((score, explanation) => {
    if (explanation.severity === "positive") return score + 10;
    if (explanation.severity === "notice") return score + 6;
    return score + 2;
  }, 0);
  const qualityScore = Number.isFinite(moveScore)
    ? moveScore
    : reasoningFacts.summary.qualityScore || 0;

  return Math.max(
    1,
    Math.min(100, Math.round(qualityScore * 0.72 + evidenceScore - index))
  );
}

function buildMoveScoreMap(compositionResult) {
  const scoreMap = new Map();

  (compositionResult.greedyResult?.moveHistory || []).forEach((move) => {
    if (Number.isInteger(move.perfumeId) && Number.isFinite(move.qualityScore)) {
      scoreMap.set(move.perfumeId, move.qualityScore);
    }
  });

  (compositionResult.refinementResult?.appliedMoves || []).forEach((move) => {
    if (Number.isInteger(move.addPerfumeId) && Number.isFinite(move.afterScore)) {
      scoreMap.set(move.addPerfumeId, move.afterScore);
    }
  });

  return scoreMap;
}

function deriveSelectedPreferences(selectedPerfumes) {
  return {
    preferredSeasons: topValues(selectedPerfumes.flatMap((perfume) => perfume.seasons || []), 4),
    preferredOccasions: topValues(
      selectedPerfumes.flatMap((perfume) => perfume.occasions || []),
      6
    ),
    preferredVibes: topValues(selectedPerfumes.flatMap((perfume) => perfume.vibes || []), 6),
  };
}

function topValues(values, limit) {
  const counts = values.reduce((map, value) => {
    map[value] = (map[value] || 0) + 1;
    return map;
  }, {});

  return Object.entries(counts)
    .sort(([firstValue, firstCount], [secondValue, secondCount]) =>
      secondCount - firstCount || compareStrings(firstValue, secondValue)
    )
    .slice(0, limit)
    .map(([value]) => value);
}

function uniqueSortedNumbers(values) {
  return [...new Set((values || []).filter(Number.isInteger))].sort((first, second) => first - second);
}

function getPreferenceValues(perfume, domain) {
  if (domain === "seasons") return perfume.seasons || [];
  if (domain === "occasions") return perfume.occasions || [];
  if (domain === "vibes") return perfume.vibes || [];
  return [];
}

function getSeasonWeight(perfume, season) {
  if (perfume.seasonWeights?.[season] !== undefined) {
    return perfume.seasonWeights[season];
  }

  return perfume.seasons?.includes(season) ? 6 : 0;
}

function uniqueExplanationObjects(explanations) {
  const seen = new Set();

  return explanations.filter((explanation) => {
    const key = `${explanation.code}:${JSON.stringify(explanation.evidence)}`;
    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function compareRecommendations(first, second) {
  return (
    second.finalScore - first.finalScore ||
    first.perfume.points - second.perfume.points ||
    first.perfume.id - second.perfume.id
  );
}

function compareStrings(first, second) {
  if (first < second) return -1;
  if (first > second) return 1;
  return 0;
}

function emptyRecommendations() {
  return {
    basedOnYourPicks: [],
    toBalanceYourBox: [],
  };
}
