const SEASON_TARGETS = ["spring", "summer", "fall", "winter"];

export function buildScentDna(selectedPerfumes, boxSummary) {
  const totalPerfumes = selectedPerfumes.length || 1;
  const accordCounts = selectedPerfumes.reduce((counts, perfume) => {
    (perfume.accords || []).forEach((accord) => {
      counts[accord] = (counts[accord] || 0) + 1;
    });

    return counts;
  }, {});

  const topAccords = buildRankedMetrics(accordCounts, totalPerfumes, 5);
  const topVibes = buildRankedMetrics(boxSummary.vibeCounts, totalPerfumes, 5);
  const seasonCoverage = SEASON_TARGETS.map((season) => {
    const count = boxSummary.seasonCounts[season] || 0;

    return {
      label: season,
      count,
      percent: Math.round((count / totalPerfumes) * 100),
    };
  });

  const uniqueOccasions = boxSummary.occasions.length;
  const uniqueSeasons = boxSummary.seasons.length;
  const uniqueVibes = boxSummary.vibes.length;
  const uniqueAccords = Object.keys(accordCounts).length;
  const uniqueNotes = boxSummary.notes.length;

  const versatilityScore = clampScore(
    uniqueSeasons * 18 + uniqueOccasions * 7 + uniqueVibes * 4
  );
  const depthScore = clampScore(uniqueAccords * 7 + uniqueNotes * 0.9);
  const seasonBalanceScore = getSeasonBalanceScore(seasonCoverage);

  return {
    scores: {
      versatility: versatilityScore,
      depth: depthScore,
      seasonBalance: seasonBalanceScore,
    },
    topAccords,
    topVibes,
    seasonCoverage,
  };
}

function buildRankedMetrics(counts, totalPerfumes, limit) {
  return Object.entries(counts || {})
    .map(([label, count]) => ({
      label,
      count,
      percent: Math.round((count / totalPerfumes) * 100),
    }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
    .slice(0, limit);
}

function getSeasonBalanceScore(seasonCoverage) {
  const activeSeasons = seasonCoverage.filter((item) => item.count > 0);

  if (activeSeasons.length === 0) {
    return 0;
  }

  const counts = activeSeasons.map((item) => item.count);
  const max = Math.max(...counts);
  const min = Math.min(...counts);
  const spreadPenalty = max === 0 ? 0 : ((max - min) / max) * 35;
  const coverageScore = activeSeasons.length * 25;

  return clampScore(coverageScore - spreadPenalty);
}

function clampScore(value) {
  return Math.max(0, Math.min(100, Math.round(value)));
}
