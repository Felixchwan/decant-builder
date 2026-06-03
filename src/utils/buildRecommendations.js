import { getPerfumeNoteIds } from "./noteUtils";

const SEASON_TARGETS = ["spring", "summer", "fall", "winter"];
const OCCASION_TARGETS = ["daily", "office", "casual", "date", "night", "formal"];
const VIBE_TARGETS = [
  "fresh",
  "clean",
  "versatile",
  "elegant",
  "bold",
  "seductive",
  "warm",
  "cozy",
];

const MAX_VISIBLE_REASONS = 4;

const DAILY_OCCASIONS = ["daily", "office", "casual"];

export function buildRecommendations({
  perfumes,
  selectedPerfumes,
  boxSummary,
  scentDna,
  limit = 3,
}) {
  const selectedIds = new Set(selectedPerfumes.map((perfume) => perfume.id));
  const candidates = perfumes.filter((perfume) => !selectedIds.has(perfume.id));
  const tierProfile = buildTierProfile(selectedPerfumes);
  const basedOnYourPicks = buildPreferenceRecommendations({
    candidates,
    selectedPerfumes,
    boxSummary,
    tierProfile,
    limit,
  });
  const basedOnYourPicksIds = new Set(
    basedOnYourPicks.map((recommendation) => recommendation.perfume.id)
  );
  const toBalanceYourBox = buildBalanceRecommendations({
    candidates: candidates.filter(
      (perfume) => !basedOnYourPicksIds.has(perfume.id)
    ),
    selectedPerfumes,
    boxSummary,
    scentDna,
    limit,
  });

  return {
    basedOnYourPicks,
    toBalanceYourBox,
  };
}

function buildBalanceRecommendations({
  candidates,
  selectedPerfumes,
  boxSummary,
  scentDna,
  limit,
}) {
  const selectedAccords = new Set(Object.keys(boxSummary.accordMap || {}));
  const selectedNotes = new Set(selectedPerfumes.flatMap(getPerfumeNoteIds));
  const boxContext = buildBoxContext(boxSummary);
  const tierProfile = buildTierProfile(selectedPerfumes);

  const rankedRecommendations = candidates
    .map((perfume) =>
      scoreRecommendation({
        perfume,
        boxSummary,
        scentDna,
        boxContext,
        selectedAccords,
        selectedNotes,
      })
    )
    .filter((recommendation) => recommendation.score > 0)
    .map((recommendation) =>
      applyTierAffinity(recommendation, tierProfile, boxSummary)
    )
    .sort(
      (a, b) =>
        b.finalScore - a.finalScore ||
        b.score - a.score ||
        a.perfume.points - b.perfume.points ||
        a.perfume.name.localeCompare(b.perfume.name)
    )
    .slice(0, limit);

  return diversifyRecommendationReasons(rankedRecommendations);
}

function scoreRecommendation({
  perfume,
  boxSummary,
  scentDna,
  boxContext,
  selectedAccords,
  selectedNotes,
}) {
  const reasonCandidates = [];
  const seasonScore = scoreCoverage({
    perfume,
    category: "seasons",
    targets: SEASON_TARGETS,
    counts: boxSummary.seasonCounts,
    missingWeight: 18,
    weakWeight: 9,
    maxScore: 30,
    getMissingReason: (target) => getSeasonReason(target, perfume, boxContext),
    getWeakReason: (target) => `Reinforces ${formatLabel(target)} coverage`,
    reasonCandidates,
  });

  const occasionScore = scoreCoverage({
    perfume,
    category: "occasions",
    targets: OCCASION_TARGETS,
    counts: boxSummary.occasionCounts,
    missingWeight: 8,
    weakWeight: 4,
    maxScore: 20,
    getMissingReason: (target) => getOccasionReason(target),
    getWeakReason: (target) => `Reinforces ${formatLabel(target)} use`,
    reasonCandidates,
  });

  const vibeScore = scoreCoverage({
    perfume,
    category: "vibes",
    targets: VIBE_TARGETS,
    counts: boxSummary.vibeCounts,
    missingWeight: 7,
    weakWeight: 3.5,
    maxScore: 20,
    getMissingReason: (target) => getVibeReason(target, perfume, boxContext),
    getWeakReason: (target) => getVibeSupportReason(target, perfume),
    reasonCandidates,
  });

  const newAccords = (perfume.accords || []).filter(
    (accord) => !selectedAccords.has(accord)
  );
  const accordScore = Math.min(15, newAccords.length * 5);

  if (newAccords.length > 0) {
    reasonCandidates.push({
      score: accordScore,
      label: getAccordReason(newAccords[0], boxContext),
    });
  }

  const newNotes = getPerfumeNoteIds(perfume).filter(
    (noteId) => !selectedNotes.has(noteId)
  );
  const noteScore = Math.min(15, newNotes.length * 1.5);

  if (newNotes.length > 0) {
    reasonCandidates.push({
      score: noteScore,
      label: "Broadens the fragrance palette",
    });
  }

  if (
    scentDna?.scores?.seasonBalance < 80 &&
    helpsWeakestSeason(perfume, boxSummary)
  ) {
    reasonCandidates.push({
      score: 12,
      label: "Improves Season Balance",
    });
  }

  const scoreBreakdown = {
    seasons: seasonScore,
    occasions: occasionScore,
    vibes: vibeScore,
    accordDiversity: accordScore,
    noteDiversity: noteScore,
  };
  const score = clampScore(
    Object.values(scoreBreakdown).reduce((sum, value) => sum + value, 0)
  );

  return {
    perfume,
    score,
    baseScore: score,
    reasons: getVisibleReasons(reasonCandidates),
    reasonCandidates,
    scoreBreakdown,
  };
}

function buildPreferenceRecommendations({
  candidates,
  selectedPerfumes,
  boxSummary,
  tierProfile,
  limit,
}) {
  if (selectedPerfumes.length === 0) {
    return [];
  }

  const preferenceProfile = buildPreferenceProfile(
    selectedPerfumes,
    boxSummary,
    tierProfile
  );

  return candidates
    .map((perfume) => scorePreferenceRecommendation(perfume, preferenceProfile))
    .filter((recommendation) => recommendation.score > 0)
    .sort(
      (a, b) =>
        b.score - a.score ||
        Math.abs(a.perfume.points - preferenceProfile.averagePoints) -
          Math.abs(b.perfume.points - preferenceProfile.averagePoints) ||
        a.perfume.points - b.perfume.points ||
        a.perfume.name.localeCompare(b.perfume.name)
    )
    .slice(0, limit);
}

function buildPreferenceProfile(selectedPerfumes, boxSummary, tierProfile) {
  const accordCounts = Object.fromEntries(
    Object.entries(boxSummary.accordMap || {}).map(([accord, perfumes]) => [
      accord,
      perfumes.length,
    ])
  );
  const averagePoints =
    selectedPerfumes.reduce((sum, perfume) => sum + perfume.points, 0) /
    selectedPerfumes.length;

  return {
    accordCounts,
    vibeCounts: boxSummary.vibeCounts || {},
    occasionCounts: boxSummary.occasionCounts || {},
    seasonCounts: boxSummary.seasonCounts || {},
    tierProfile,
    averagePoints,
  };
}

function scorePreferenceRecommendation(perfume, preferenceProfile) {
  const sharedAccords = getSharedItems(perfume.accords, preferenceProfile.accordCounts);
  const sharedVibes = getSharedItems(perfume.vibes, preferenceProfile.vibeCounts);
  const sharedOccasions = getSharedItems(
    perfume.occasions,
    preferenceProfile.occasionCounts
  );
  const sharedSeasons = getSharedItems(perfume.seasons, preferenceProfile.seasonCounts);
  const candidateTierRank = getTierRank(perfume.id);
  const tierDistance = Math.abs(
    candidateTierRank - preferenceProfile.tierProfile.targetTierRank
  );
  const pointDistance = Math.abs(perfume.points - preferenceProfile.averagePoints);
  const tierSimilarity = getTierSimilarityScore(tierDistance, pointDistance);
  const scoreBreakdown = {
    sharedAccords: Math.min(30, sharedAccords.length * 6),
    sharedVibes: Math.min(24, sharedVibes.length * 6),
    sharedOccasions: Math.min(16, sharedOccasions.length * 4),
    sharedSeasons: Math.min(12, sharedSeasons.length * 3),
    tierSimilarity,
  };
  const score = clampScore(
    Object.values(scoreBreakdown).reduce((sum, value) => sum + value, 0)
  );

  return {
    perfume,
    score,
    baseScore: score,
    finalScore: score,
    reasons: getPreferenceReasons({
      perfume,
      sharedAccords,
      sharedVibes,
      sharedOccasions,
      sharedSeasons,
      tierSimilarity,
    }),
    scoreBreakdown,
  };
}

function getSharedItems(items = [], counts = {}) {
  return items
    .filter((item) => counts[item] > 0)
    .sort((a, b) => counts[b] - counts[a] || a.localeCompare(b));
}

function getTierSimilarityScore(tierDistance, pointDistance) {
  let tierScore = 0;

  if (tierDistance === 0) {
    tierScore = 6;
  } else if (tierDistance === 1) {
    tierScore = 4;
  } else if (tierDistance === 2) {
    tierScore = 2;
  }

  if (pointDistance <= 0.5) {
    return tierScore + 2;
  }

  if (pointDistance <= 1.5) {
    return tierScore + 1;
  }

  return tierScore;
}

function getPreferenceReasons({
  sharedAccords,
  sharedVibes,
  sharedOccasions,
  tierSimilarity,
}) {
  const reasons = [];

  if (sharedAccords.length >= 2) {
    reasons.push(
      `Shares ${formatLabel(sharedAccords[0])} and ${formatLabel(
        sharedAccords[1]
      )} accords`
    );
  } else if (sharedAccords.length === 1) {
    reasons.push(`Builds on your ${formatLabel(sharedAccords[0])}-forward selections`);
  }

  if (sharedVibes.includes("fresh") && sharedAccords.includes("aromatic")) {
    reasons.push("Matches your fresh aromatic direction");
  } else if (sharedVibes.includes("fresh") || sharedVibes.includes("clean")) {
    reasons.push("Fits your fresh everyday profile");
  }

  if (
    sharedVibes.includes("clean") &&
    sharedOccasions.some((occasion) => DAILY_OCCASIONS.includes(occasion))
  ) {
    reasons.push("Similar to your clean daily picks");
  } else if (sharedOccasions.some((occasion) => DAILY_OCCASIONS.includes(occasion))) {
    reasons.push("Matches your everyday wear pattern");
  }

  if (tierSimilarity >= 6) {
    reasons.push("Fits your current box tier");
  } else if (tierSimilarity >= 4) {
    reasons.push("Stays close to your current box tier");
  }

  return [...new Set(reasons)].slice(0, MAX_VISIBLE_REASONS);
}

function scoreCoverage({
  perfume,
  category,
  targets,
  counts,
  missingWeight,
  weakWeight,
  maxScore,
  getMissingReason,
  getWeakReason,
  reasonCandidates,
}) {
  const matches = targets.filter((target) => perfume[category]?.includes(target));
  let score = 0;

  matches.forEach((target) => {
    const count = counts?.[target] || 0;

    if (count === 0) {
      score += missingWeight;
      reasonCandidates.push({
        score: missingWeight,
        label: getMissingReason(target),
      });
    } else if (count < 2) {
      score += weakWeight;
      reasonCandidates.push({
        score: weakWeight,
        label: getWeakReason(target),
      });
    }
  });

  return Math.min(maxScore, score);
}

function diversifyRecommendationReasons(recommendations) {
  const usedLabels = new Map();

  return recommendations.map((recommendation) => {
    const reasons = getVisibleReasons(
      recommendation.reasonCandidates,
      usedLabels
    );

    reasons.forEach((reason) => {
      usedLabels.set(reason, (usedLabels.get(reason) || 0) + 1);
    });

    return {
      perfume: recommendation.perfume,
      score: recommendation.score,
      baseScore: recommendation.baseScore,
      finalScore: recommendation.finalScore,
      reasons,
      scoreBreakdown: recommendation.scoreBreakdown,
    };
  });
}

function applyTierAffinity(recommendation, tierProfile, boxSummary) {
  const candidateTierRank = getTierRank(recommendation.perfume.id);
  const tierDistance = Math.abs(candidateTierRank - tierProfile.targetTierRank);
  const tierAffinity = getTierAffinityScore(tierDistance, tierProfile);
  const premiumException = getPremiumExceptionScore(
    recommendation,
    boxSummary,
    candidateTierRank,
    tierProfile
  );
  const reasonCandidates = [
    ...recommendation.reasonCandidates,
    ...getTierReasonCandidates({
      recommendation,
      boxSummary,
      candidateTierRank,
      targetTierRank: tierProfile.targetTierRank,
      tierAffinity,
      premiumException,
    }),
  ];
  const finalScore = recommendation.baseScore + tierAffinity + premiumException;

  return {
    ...recommendation,
    finalScore,
    reasonCandidates,
    scoreBreakdown: {
      ...recommendation.scoreBreakdown,
      tierAffinity,
      premiumException,
    },
  };
}

function buildTierProfile(selectedPerfumes) {
  if (selectedPerfumes.length === 0) {
    return {
      averageTierRank: 0,
      dominantTierRank: 0,
      targetTierRank: 0,
    };
  }

  const tierRanks = selectedPerfumes.map((perfume) => getTierRank(perfume.id));
  const averageTierRank =
    tierRanks.reduce((sum, rank) => sum + rank, 0) / tierRanks.length;
  const tierCounts = tierRanks.reduce((counts, rank) => {
    counts[rank] = (counts[rank] || 0) + 1;
    return counts;
  }, {});
  const dominantTierRank = Number(
    Object.entries(tierCounts).sort(
      ([rankA, countA], [rankB, countB]) =>
        countB - countA || Number(rankA) - Number(rankB)
    )[0][0]
  );

  return {
    averageTierRank,
    dominantTierRank,
    targetTierRank: dominantTierRank,
  };
}

function getTierRank(id) {
  if (id < 100) return 0;
  if (id < 200) return 1;
  if (id < 300) return 2;
  if (id < 400) return 3;
  if (id < 500) return 4;
  return 5;
}

function getTierAffinityScore(tierDistance, tierProfile) {
  if (tierProfile.dominantTierRank === 0 && tierDistance >= 3) {
    const bronzeHeavyAffinityByDistance = {
      3: -14,
      4: -22,
      5: -30,
    };

    return bronzeHeavyAffinityByDistance[tierDistance] ?? -30;
  }

  const affinityByDistance = {
    0: 10,
    1: 6,
    2: 0,
    3: -8,
    4: -14,
    5: -22,
  };

  return affinityByDistance[tierDistance] ?? -22;
}

function getPremiumExceptionScore(
  recommendation,
  boxSummary,
  candidateTierRank,
  tierProfile
) {
  const targetTierRank = tierProfile.targetTierRank;

  if (candidateTierRank <= targetTierRank) {
    return 0;
  }

  let score = 0;

  if (solvesMissingSeason(recommendation.perfume, boxSummary)) {
    score += 6;
  }

  if (solvesPremiumOccasionGap(recommendation.perfume, boxSummary)) {
    score += 4;
  }

  if (
    recommendation.scoreBreakdown.accordDiversity >= 15 &&
    recommendation.scoreBreakdown.noteDiversity >= 12
  ) {
    score += 4;
  }

  if (
    recommendation.reasonCandidates.some(
      (reason) => reason.label === "Improves Season Balance"
    )
  ) {
    score += 4;
  }

  if (tierProfile.dominantTierRank === 0) {
    const tierDistance = Math.abs(candidateTierRank - targetTierRank);

    if (tierDistance >= 2 && recommendation.baseScore < 80) {
      return Math.min(6, score);
    }
  }

  return score;
}

function getTierReasonCandidates({
  recommendation,
  boxSummary,
  candidateTierRank,
  targetTierRank,
  tierAffinity,
  premiumException,
}) {
  const reasons = [];

  if (candidateTierRank === targetTierRank && tierAffinity > 0) {
    reasons.push({
      score: 9,
      label: "Fits your current box tier",
    });
  }

  if (candidateTierRank > targetTierRank && premiumException >= 8) {
    reasons.push({
      score: 8,
      label: "Premium pick with strong coverage impact",
    });
  }

  if (
    candidateTierRank > targetTierRank &&
    (boxSummary.seasonCounts?.winter || 0) === 0 &&
    recommendation.perfume.seasons?.includes("winter")
  ) {
    reasons.push({
      score: 7,
      label: "Worth the upgrade for Winter coverage",
    });
  }

  return reasons;
}

function solvesMissingSeason(perfume, boxSummary) {
  return SEASON_TARGETS.some(
    (season) =>
      (boxSummary.seasonCounts?.[season] || 0) === 0 &&
      perfume.seasons?.includes(season)
  );
}

function solvesPremiumOccasionGap(perfume, boxSummary) {
  return ["date", "night", "formal"].some(
    (occasion) =>
      (boxSummary.occasionCounts?.[occasion] || 0) === 0 &&
      perfume.occasions?.includes(occasion)
  );
}

function helpsWeakestSeason(perfume, boxSummary) {
  const weakestSeason = SEASON_TARGETS.reduce((weakest, season) => {
    const currentCount = boxSummary.seasonCounts?.[season] || 0;
    const weakestCount = boxSummary.seasonCounts?.[weakest] || 0;

    return currentCount < weakestCount ? season : weakest;
  }, SEASON_TARGETS[0]);

  return perfume.seasons?.includes(weakestSeason);
}

function getVisibleReasons(reasonCandidates, usedLabels = new Map()) {
  const seenLabels = new Set();

  return reasonCandidates
    .sort((a, b) => {
      const aAdjustedScore = a.score - (usedLabels.get(a.label) || 0) * 4;
      const bAdjustedScore = b.score - (usedLabels.get(b.label) || 0) * 4;

      return bAdjustedScore - aAdjustedScore || a.label.localeCompare(b.label);
    })
    .filter((reason) => {
      if (seenLabels.has(reason.label)) {
        return false;
      }

      seenLabels.add(reason.label);
      return true;
    })
    .slice(0, MAX_VISIBLE_REASONS)
    .map((reason) => reason.label);
}

function getOccasionReason(target) {
  if (target === "date") {
    return "Strengthens Date Night coverage";
  }

  if (target === "night") {
    return "Strengthens evening versatility";
  }

  if (target === "office") {
    return "Supports office-friendly wear";
  }

  if (target === "daily" || target === "casual") {
    return "Improves everyday versatility";
  }

  if (target === "formal") {
    return "Adds formal-leaning polish";
  }

  return `Improves ${formatLabel(target)} versatility`;
}

function getSeasonReason(target, perfume, boxContext) {
  if (target === "winter") {
    return "Expands Winter coverage";
  }

  if (boxContext.isFreshHeavy && addsWarmContrast(perfume)) {
    return "Balances a fresh-heavy profile";
  }

  return "Expands seasonal coverage";
}

function getVibeReason(target, perfume, boxContext) {
  if (target === "warm" || target === "cozy") {
    return "Strengthens cold-weather versatility";
  }

  if (target === "seductive" || target === "bold") {
    return "Strengthens evening versatility";
  }

  if (target === "clean" || target === "versatile") {
    return "Supports office-friendly wear";
  }

  if (target === "elegant") {
    return "Adds polished versatility";
  }

  if (boxContext.isSweetFocused && addsFreshOrWoodyContrast(perfume)) {
    return "Adds contrast to a sweet-focused box";
  }

  if (target === "fresh") {
    return "Adds fresh everyday range";
  }

  return `Adds ${formatLabel(target)} dimension`;
}

function getVibeSupportReason(target, perfume) {
  if (target === "warm" || target === "cozy") {
    return "Deepens cold-weather comfort";
  }

  if (target === "seductive" || target === "bold") {
    return "Reinforces evening presence";
  }

  if (target === "clean" || target === "versatile") {
    return "Reinforces easy daily wear";
  }

  if (addsWarmContrast(perfume)) {
    return "Adds contrast to the current profile";
  }

  return `Deepens ${formatLabel(target)} character`;
}

function getAccordReason(accord, boxContext) {
  if (boxContext.isSweetFocused && isContrastAccord(accord)) {
    return "Adds contrast to a sweet-focused box";
  }

  if (boxContext.isFreshHeavy && isWarmAccord(accord)) {
    return "Balances a fresh-heavy profile";
  }

  return `Introduces ${formatLabel(accord)} depth missing from the collection`;
}

function buildBoxContext(boxSummary) {
  const accordCounts = Object.fromEntries(
    Object.entries(boxSummary.accordMap || {}).map(([accord, perfumes]) => [
      accord,
      perfumes.length,
    ])
  );
  const freshSignals =
    (boxSummary.vibeCounts?.fresh || 0) +
    (boxSummary.vibeCounts?.clean || 0) +
    (accordCounts.fresh || 0) +
    (accordCounts.citrus || 0) +
    (accordCounts.marine || 0);
  const warmSignals =
    (boxSummary.vibeCounts?.warm || 0) +
    (boxSummary.vibeCounts?.cozy || 0) +
    (accordCounts["warm spicy"] || 0) +
    (accordCounts.amber || 0) +
    (accordCounts.vanilla || 0);
  const sweetSignals =
    (boxSummary.vibeCounts?.sweet || 0) +
    (accordCounts.sweet || 0) +
    (accordCounts.vanilla || 0) +
    (accordCounts.caramel || 0);

  return {
    isFreshHeavy: freshSignals >= 5 && freshSignals > warmSignals,
    isSweetFocused: sweetSignals >= 4,
  };
}

function addsWarmContrast(perfume) {
  return (
    perfume.seasons?.includes("winter") ||
    perfume.vibes?.some((vibe) => ["warm", "cozy", "seductive"].includes(vibe)) ||
    perfume.accords?.some(isWarmAccord)
  );
}

function addsFreshOrWoodyContrast(perfume) {
  return perfume.accords?.some(isContrastAccord);
}

function isWarmAccord(accord) {
  return ["amber", "vanilla", "warm spicy", "smoky", "leather"].includes(
    accord
  );
}

function isContrastAccord(accord) {
  return ["woody", "fresh", "citrus", "aromatic", "green", "marine"].includes(
    accord
  );
}

function clampScore(value) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function formatLabel(value) {
  return value
    .split(/(?=[A-Z])|[-_\s]/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
