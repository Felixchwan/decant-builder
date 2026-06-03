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

  return perfumes
    .filter((perfume) => !selectedIds.has(perfume.id))
    .map((perfume) =>
      scoreRecommendation({
        perfume,
        boxSummary,
        scentDna,
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
}

function scoreRecommendation({
  perfume,
  boxSummary,
  scentDna,
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
    getMissingReason: (target) => `Improves ${formatLabel(target)} coverage`,
    getWeakReason: (target) => `Supports ${formatLabel(target)} coverage`,
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
    getMissingReason: (target) => `Adds ${formatLabel(target)} character`,
    getWeakReason: (target) => `Deepens ${formatLabel(target)} character`,
    reasonCandidates,
  });

  const newAccords = (perfume.accords || []).filter(
    (accord) => !selectedAccords.has(accord)
  );
  const accordScore = Math.min(15, newAccords.length * 5);

  if (newAccords.length > 0) {
    reasonCandidates.push({
      score: accordScore,
      label: `Adds ${formatLabel(newAccords[0])} depth`,
    });
  }

  const newNotes = getPerfumeNoteIds(perfume).filter(
    (noteId) => !selectedNotes.has(noteId)
  );
  const noteScore = Math.min(15, newNotes.length * 1.5);

  if (newNotes.length > 0) {
    reasonCandidates.push({
      score: noteScore,
      label: "Expands note diversity",
    });
  }

  if (
    scentDna?.scores?.seasonBalance < 80 &&
    helpsWeakestSeason(perfume, boxSummary)
  ) {
    reasonCandidates.push({
      score: 12,
      label: "Increases Season Balance",
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
  const reasons = getVisibleReasons(reasonCandidates);

  return {
    perfume,
    score,
    reasons,
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

function helpsWeakestSeason(perfume, boxSummary) {
  const weakestSeason = SEASON_TARGETS.reduce((weakest, season) => {
    const currentCount = boxSummary.seasonCounts?.[season] || 0;
    const weakestCount = boxSummary.seasonCounts?.[weakest] || 0;

    return currentCount < weakestCount ? season : weakest;
  }, SEASON_TARGETS[0]);

  return perfume.seasons?.includes(weakestSeason);
}

function getVisibleReasons(reasonCandidates) {
  const seenLabels = new Set();

  return reasonCandidates
    .sort((a, b) => b.score - a.score || a.label.localeCompare(b.label))
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
  if (target === "date" || target === "night") {
    return `Strengthens ${formatLabel(target)} profile`;
  }

  return `Improves ${formatLabel(target)} versatility`;
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
