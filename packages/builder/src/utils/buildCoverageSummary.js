import { buildSeasonalEvidence } from "../builder/internal/intelligence/seasonalEvidence.js";

const TARGET_COVERAGE = {
  occasions: ["daily", "office", "casual", "date", "night", "formal"],
  seasons: ["spring", "summer", "fall", "winter"],
  vibes: ["fresh", "clean", "versatile", "elegant", "bold", "seductive"],
};

const GAP_TARGETS = {
  seasons: ["spring", "summer", "fall", "winter"],
};

// Coverage is relative to the box, never an absolute count:
//   - seasons use the shared seasonal levels (mean season strength, as a percentage): strong from 50, covered
//     from 30, a gap below 30 -- the same lines the radar, the stars and Box Intelligence use;
//   - occasions and vibes use the SHARE of the box's fragrances that carry the tag: strong when at least a
//     third of the box does (and at least two fragrances), covered from a tenth.
// So the same profile gets the same label in a 6-fragrance box and in a 12-fragrance one.
const TAG_STRONG_MIN_SHARE = 0.3;
const TAG_STRONG_MIN_COUNT = 2;
const TAG_COVERED_MIN_SHARE = 0.1;

export function buildCoverageSummary(boxSummary, perfumes = []) {
  const strengths = [];
  const gaps = [];
  const suggestions = [];
  const seasonalRecommendations = [];
  const selectedCount = getSelectedCount(boxSummary);
  const seasonal = buildSeasonalEvidence({
    seasonStrengths: boxSummary.seasonStrengths || boxSummary.seasonCounts || {},
    selectedCount,
  });

  Object.entries(TARGET_COVERAGE).forEach(([category, targets]) => {
    targets.forEach((target) => {
      const { count, level } = getCoverage({ boxSummary, seasonal, category, target, selectedCount });

      if (level === "strong") {
        strengths.push({
          category,
          target,
          label: `Strong ${formatLabel(target)} Coverage`,
          level: "strong",
          count,
        });
      }

      if (level === "covered") {
        strengths.push({
          category,
          target,
          label: `${formatLabel(target)} Covered`,
          level: "covered",
          count,
        });
      }
    });
  });

  // Seasons are the only category with gaps, and a gap is exactly a season below the covered line (so an
  // empty box has four).
  Object.entries(GAP_TARGETS).forEach(([category, targets]) => {
    targets.forEach((target) => {
      if (seasonal.bands[target] !== "gap") {
        return;
      }

      gaps.push({
        category,
        target,
        label: `${formatLabel(target)} fragrance recommended`,
        seasonColor: getSeasonColor(target),
      });

      suggestions.push({
        category,
        target,
        label: `Add ${formatLabel(target)} Coverage`,
      });

      const recommendation = perfumes.find((perfume) => getSeasonWeight(perfume, target) >= 6);

      if (recommendation) {
        seasonalRecommendations.push({
          season: target,
          perfume: recommendation,
        });
      }
    });
  });

  return {
    strengths,
    gaps,
    suggestions,
    seasonalRecommendations,
  };
}

// `count` is the season's level (percent) for seasons, and the number of fragrances for occasions / vibes.
function getCoverage({ boxSummary, seasonal, category, target, selectedCount }) {
  if (category === "seasons") {
    return { count: seasonal.levels[target] || 0, level: seasonal.bands[target] };
  }

  const count = (category === "occasions" ? boxSummary.occasionCounts : boxSummary.vibeCounts)?.[target] || 0;
  const share = selectedCount > 0 ? count / selectedCount : 0;

  if (count >= TAG_STRONG_MIN_COUNT && share >= TAG_STRONG_MIN_SHARE) {
    return { count, level: "strong" };
  }

  return { count, level: count >= 1 && share >= TAG_COVERED_MIN_SHARE ? "covered" : "none" };
}

// The box summary carries its size; a hand-built one (tests, older callers) is sized by its busiest tag.
function getSelectedCount(boxSummary) {
  if (Number.isFinite(boxSummary.selectedCount)) {
    return boxSummary.selectedCount;
  }

  return Math.max(
    0,
    ...Object.values(boxSummary.occasionCounts || {}),
    ...Object.values(boxSummary.vibeCounts || {}),
    ...Object.values(boxSummary.seasonCounts || {})
  );
}

function getSeasonColor(season) {
  const seasonColors = {
    spring: "rgba(196,181,253,0.70)",
    summer: "rgba(253,230,138,0.60)",
    fall: "rgba(251,146,60,0.60)",
    winter: "rgba(147,197,253,0.60)",
  };

  return seasonColors[season] || "rgba(216,180,254,0.70)";
}

function formatLabel(value) {
  return value
    .split(/(?=[A-Z])|[-_\s]/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function getSeasonWeight(perfume, season) {
  if (perfume.seasonWeights?.[season] !== undefined) {
    return perfume.seasonWeights[season];
  }

  return perfume.seasons?.includes(season) ? 6 : 0;
}
