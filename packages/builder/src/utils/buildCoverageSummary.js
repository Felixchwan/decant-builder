const TARGET_COVERAGE = {
  occasions: ["daily", "office", "casual", "date", "night", "formal"],
  seasons: ["spring", "summer", "fall", "winter"],
  vibes: ["fresh", "clean", "versatile", "elegant", "bold", "seductive"],
};

const GAP_TARGETS = {
  seasons: ["spring", "summer", "fall", "winter"],
};

export function buildCoverageSummary(boxSummary, perfumes = []) {
  const strengths = [];
  const gaps = [];
  const suggestions = [];
  const seasonalRecommendations = [];

  Object.entries(TARGET_COVERAGE).forEach(([category, targets]) => {
    targets.forEach((target) => {
      const count = getCoverageCount(boxSummary, category, target);
      const strongThreshold = category === "seasons" ? 16 : 3;
      const coveredThreshold = category === "seasons" ? 4 : 1;

      if (count >= strongThreshold) {
        strengths.push({
          category,
          target,
          label: `Strong ${formatLabel(target)} Coverage`,
          level: "strong",
          count,
        });
      }

      if (count >= coveredThreshold && count < strongThreshold) {
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

  Object.entries(GAP_TARGETS).forEach(([category, targets]) => {
    targets.forEach((target) => {
      const count = getCoverageCount(boxSummary, category, target);
      const gapThreshold = category === "seasons" ? 4 : 1;

      if (count < gapThreshold) {
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

        const recommendation = perfumes.find((perfume) =>
          category === "seasons"
            ? getSeasonWeight(perfume, target) >= 6
            : perfume[category]?.includes(target)
        );

        if (recommendation) {
          seasonalRecommendations.push({
            season: target,
            perfume: recommendation,
          });
        }
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

function getCoverageCount(boxSummary, category, target) {
  const countMapByCategory = {
    occasions: boxSummary.occasionCounts,
    seasons: boxSummary.seasonStrengths || boxSummary.seasonCounts,
    vibes: boxSummary.vibeCounts,
  };

  return countMapByCategory[category]?.[target] || 0;
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
