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

  const versatilityScore = getVersatilityScore({
    uniqueSeasons,
    uniqueOccasions,
    uniqueVibes,
  });
  const depthScore = getDepthScore({ uniqueAccords, uniqueNotes });
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

function getVersatilityScore({ uniqueSeasons, uniqueOccasions, uniqueVibes }) {
  const seasonCoverage = uniqueSeasons / 4;
  const occasionCoverage = Math.min(uniqueOccasions / 10, 1);
  const vibeCoverage = Math.min(uniqueVibes / 18, 1);

  return clampScore(
    seasonCoverage * 35 +
      occasionCoverage * 35 +
      Math.sqrt(vibeCoverage) * 30
  );
}

function getDepthScore({ uniqueAccords, uniqueNotes }) {
  const accordCoverage = Math.min(uniqueAccords / 24, 1);
  const noteDepth = Math.min(uniqueNotes / 90, 1);

  return clampScore(
    Math.sqrt(accordCoverage) * 60 + Math.sqrt(noteDepth) * 40
  );
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

  const totalSeasonTags = seasonCoverage.reduce(
    (sum, item) => sum + item.count,
    0
  );

  if (totalSeasonTags === 0) {
    return 0;
  }

  const idealShare = totalSeasonTags / 4;
  const totalDistanceFromIdeal = seasonCoverage.reduce(
    (sum, item) => sum + Math.abs(item.count - idealShare),
    0
  );
  const imbalance = totalDistanceFromIdeal / totalSeasonTags;

  return clampScore(
    (activeSeasons.length / 4) * 45 + (1 - imbalance) * 55
  );
}

function clampScore(value) {
  return Math.max(0, Math.min(100, Math.round(value)));
}
