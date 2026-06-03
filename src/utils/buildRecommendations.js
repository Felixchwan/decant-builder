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

export function buildRecommendations({
  perfumes,
  selectedPerfumes,
  boxSummary,
  scentDna,
  limit = 5,
}) {
  const selectedIds = new Set(selectedPerfumes.map((perfume) => perfume.id));
  const selectedAccords = new Set(Object.keys(boxSummary.accordMap || {}));
  const selectedNotes = new Set(selectedPerfumes.flatMap(getPerfumeNoteIds));
  const boxContext = buildBoxContext(boxSummary);

  const rankedRecommendations = perfumes
    .filter((perfume) => !selectedIds.has(perfume.id))
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
    .sort(
      (a, b) =>
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
    reasons: getVisibleReasons(reasonCandidates),
    reasonCandidates,
    scoreBreakdown,
  };
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
      reasons,
      scoreBreakdown: recommendation.scoreBreakdown,
    };
  });
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
