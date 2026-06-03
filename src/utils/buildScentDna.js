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
    uniqueSeasons * 12 + uniqueOccasions * 5 + uniqueVibes * 2.5
  );
  const depthScore = clampScore(uniqueAccords * 4.5 + uniqueNotes * 0.45);
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
  const totalSeasonTags = seasonCoverage.reduce(
    (sum, item) => sum + item.count,
    0
  );
  const spreadPenalty = max === 0 ? 0 : ((max - min) / max) * 45;
  const coverageScore = activeSeasons.length * 18;
  const densityBonus = Math.min(20, totalSeasonTags * 1.2);

  return clampScore(coverageScore + densityBonus - spreadPenalty);
}

function clampScore(value) {
  return Math.max(0, Math.min(100, Math.round(value)));
}
