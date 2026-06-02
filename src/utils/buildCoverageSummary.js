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

      if (count >= 3) {
        strengths.push({
          category,
          target,
          label: `Strong ${formatLabel(target)} Coverage`,
          count,
        });
      }

      if (count >= 1 && count < 3) {
        strengths.push({
          category,
          target,
          label: `${formatLabel(target)} Covered`,
          count,
        });
      }
    });
  });

  Object.entries(GAP_TARGETS).forEach(([category, targets]) => {
    targets.forEach((target) => {
      const count = getCoverageCount(boxSummary, category, target);

      if (count === 0) {
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
          perfume[category]?.includes(target)
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
    seasons: boxSummary.seasonCounts,
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