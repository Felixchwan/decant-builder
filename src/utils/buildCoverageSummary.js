const TARGET_COVERAGE = {
  occasions: ["daily", "office", "casual", "date", "night", "formal"],
  seasons: ["spring", "summer", "fall", "winter"],
  vibes: ["fresh", "clean", "versatile", "elegant", "bold", "seductive"],
};

export function buildCoverageSummary(boxSummary) {
  const strengths = [];
  const suggestions = [];

  Object.entries(TARGET_COVERAGE).forEach(([category, targets]) => {
    targets.forEach((target) => {
      const count = getCoverageCount(boxSummary, category, target);

      if (count >= 3) {
        strengths.push({
          category,
          label: `Strong ${formatLabel(target)} Coverage`,
          count,
        });
      }

      if (count >= 1 && count < 3) {
        strengths.push({
          category,
          label: `${formatLabel(target)} Covered`,
          count,
        });
      }

      if (count === 0) {
        suggestions.push({
          category,
          label: `Add ${formatLabel(target)} Coverage`,
        });
      }
    });
  });

  return {
    strengths,
    suggestions,
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

function formatLabel(value) {
  return value
    .split(/(?=[A-Z])|[-_\s]/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}