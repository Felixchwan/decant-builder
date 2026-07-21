import { getTierData } from "../../../utils/tierUtils.js";

export function buildDnaExplorerIndex({
  accordItems = [],
  selectedPerfumes = [],
  catalogPerfumes = [],
  selectedPerfumeIds = new Set(),
  recommendations,
}) {
  return Object.fromEntries(
    accordItems.map((item) => [
      item.normalizedKey,
      buildDnaExplorerDetail({
        accord: item.label,
        accordItems,
        selectedPerfumes,
        catalogPerfumes,
        selectedPerfumeIds,
        recommendations,
      }),
    ])
  );
}

export function selectDnaExplorerDetail(viewModel, selectedKey) {
  if (!selectedKey) {
    return null;
  }

  return viewModel?.dna?.accordIndex?.[normalizeAccordLabel(selectedKey)] || null;
}

function buildDnaExplorerDetail({
  accord,
  accordItems,
  selectedPerfumes,
  catalogPerfumes,
  selectedPerfumeIds,
  recommendations,
}) {
  const matchingSelectedPerfumes = getSelectedPerfumesByAccord(selectedPerfumes, accord);
  const strength = getAccordStrength({
    accord,
    matchingCount: matchingSelectedPerfumes.length,
    selectedCount: selectedPerfumes.length,
  });

  return {
    accord,
    formattedAccord: formatLabel(accord),
    accordItems,
    matchingSelectedPerfumes,
    strength,
    mainContributors: matchingSelectedPerfumes.slice(0, 3),
    similarPicks: buildSimilarAccordPicks({
      accord,
      catalogPerfumes,
      selectedPerfumes,
      selectedPerfumeIds,
      recommendations,
    }),
  };
}

export function formatIntelligenceLabel(value) {
  return formatLabel(value);
}

function getSelectedPerfumesByAccord(selectedPerfumes, accord) {
  const normalizedAccord = normalizeAccordLabel(accord);

  return selectedPerfumes
    .map((perfume, index) => ({
      perfume,
      index,
      contributionScore: getAccordContributionScore(perfume, normalizedAccord),
    }))
    .filter(({ perfume }) =>
      (perfume.accords || []).some(
        (perfumeAccord) => normalizeAccordLabel(perfumeAccord) === normalizedAccord
      )
    )
    .sort(
      (a, b) =>
        b.contributionScore - a.contributionScore ||
        a.index - b.index
    );
}

function buildSimilarAccordPicks({
  accord,
  catalogPerfumes,
  selectedPerfumes,
  selectedPerfumeIds,
  recommendations,
}) {
  const normalizedAccord = normalizeAccordLabel(accord);
  const recommendationScores = buildRecommendationScoreMap(recommendations);
  const selectedSeasonSet = new Set(selectedPerfumes.flatMap((perfume) => perfume.seasons || []));
  const selectedOccasionSet = new Set(
    selectedPerfumes.flatMap((perfume) => perfume.occasions || [])
  );
  const selectedTierCounts = selectedPerfumes.reduce((counts, perfume) => {
    const tier = getTierData(perfume.id).name;
    counts[tier] = (counts[tier] || 0) + 1;
    return counts;
  }, {});
  const dominantTier = Object.entries(selectedTierCounts).sort(
    (a, b) => b[1] - a[1] || a[0].localeCompare(b[0])
  )[0]?.[0];

  return (catalogPerfumes || [])
    .filter(
      (perfume) =>
        perfume?.id &&
        !selectedPerfumeIds.has(perfume.id) &&
        (perfume.accords || []).some(
          (perfumeAccord) => normalizeAccordLabel(perfumeAccord) === normalizedAccord
        )
    )
    .map((perfume) => {
      const recommendationScore = recommendationScores.get(perfume.id) || 0;
      const contributionScore = getAccordContributionScore(perfume, normalizedAccord);
      const accordDepth = (perfume.accords || []).filter((perfumeAccord) =>
        isComplementaryAccord(normalizedAccord, normalizeAccordLabel(perfumeAccord))
      ).length;
      const seasonComplement = (perfume.seasons || []).filter(
        (season) => !selectedSeasonSet.has(season)
      ).length;
      const occasionComplement = (perfume.occasions || []).filter(
        (occasion) => !selectedOccasionSet.has(occasion)
      ).length;
      const tier = getTierData(perfume.id).name;
      const tierAffinity = dominantTier && tier === dominantTier ? 4 : 0;

      return {
        perfume,
        reason: getAccordExpansionReason({
          perfume,
          selectedSeasonSet,
          selectedOccasionSet,
          normalizedAccord,
          tier,
        }),
        score:
          80 +
          contributionScore * 14 +
          accordDepth * 7 +
          seasonComplement * 6 +
          occasionComplement * 5 +
          recommendationScore * 0.35 +
          tierAffinity -
          (selectedTierCounts[tier] || 0) * 2,
      };
    })
    .sort((a, b) => b.score - a.score || a.perfume.name.localeCompare(b.perfume.name))
    .slice(0, 6)
    .map(({ perfume, reason }) => ({ perfume, reason }));
}

function buildRecommendationScoreMap(recommendations) {
  return [
    ...(recommendations?.basedOnYourPicks || []),
    ...(recommendations?.toBalanceYourBox || []),
  ].reduce((scoreMap, recommendation) => {
    if (recommendation?.perfume?.id) {
      scoreMap.set(
        recommendation.perfume.id,
        Math.max(scoreMap.get(recommendation.perfume.id) || 0, recommendation.score || 0)
      );
    }

    return scoreMap;
  }, new Map());
}

function getAccordStrength({ accord, matchingCount, selectedCount }) {
  const ratio = selectedCount > 0 ? matchingCount / selectedCount : 0;
  let level = "Emerging";

  if (matchingCount >= 7 || ratio >= 0.58) {
    level = "Defining";
  } else if (matchingCount >= 4 || ratio >= 0.36) {
    level = "Strong presence";
  } else if (matchingCount >= 2 || ratio >= 0.18) {
    level = "Present";
  }

  return {
    level,
    title: getAccordStrengthTitle(level),
    description: getAccordStrengthDescription(accord, level),
  };
}

function getAccordStrengthTitle(level) {
  const titles = {
    Emerging: "A subtle accent",
    Present: "A supporting role",
    "Strong presence": "A strong influence",
    Defining: "A defining pillar",
  };

  return titles[level] || "A supporting role";
}

export function getStrengthSegmentCount(level) {
  const segmentCounts = {
    Emerging: 1,
    Present: 2,
    "Strong presence": 4,
    Defining: 5,
  };

  return segmentCounts[level] || 2;
}

function getAccordStrengthDescription(accord, level) {
  const label = formatLabel(accord).toLowerCase();
  const descriptions = {
    aromatic: {
      Emerging: "Aromatic structure is beginning to add lift and easy versatility.",
      Present: "Aromatic structure adds freshness and flexibility across the collection.",
      "Strong presence":
        "Aromatic structure is a clear pillar, adding freshness and versatility across multiple situations.",
      Defining:
        "Aromatic structure defines this collection, giving it a polished, versatile backbone.",
    },
    citrus: {
      Emerging: "Citrus brightness is starting to shape the collection's opening energy.",
      Present: "Citrus adds clean lift and daytime clarity to the rotation.",
      "Strong presence":
        "Citrus is a strong driver here, keeping the collection bright, fresh, and easy to wear.",
      Defining:
        "Citrus defines the collection's personality with crisp brightness and warm-weather ease.",
    },
    woody: {
      Emerging: "Woody depth is beginning to ground the collection.",
      Present: "Woody texture gives the box structure and steady wearability.",
      "Strong presence":
        "Woody depth is one of the collection's anchors, adding structure and maturity.",
      Defining:
        "Woody depth defines the collection with a grounded, polished signature.",
    },
    amber: {
      Emerging: "Amber warmth is starting to add richness to the box.",
      Present: "Amber brings warmth and softness without overwhelming the rotation.",
      "Strong presence":
        "Amber is a strong contributor, adding warmth, depth, and after-dark texture.",
      Defining:
        "Amber defines the collection with rich warmth and a more enveloping character.",
    },
  };

  return (
    descriptions[normalizeAccordLabel(accord)]?.[level] ||
    `${formatLabel(accord)} gives this collection a ${level.toLowerCase()} ${label} thread without needing extra analysis.`
  );
}

function getAccordContributionScore(perfume, normalizedAccord) {
  const accords = (perfume.accords || []).map(normalizeAccordLabel);
  const position = accords.indexOf(normalizedAccord);
  if (position < 0) {
    return 0;
  }

  const positionScore = Math.max(1, 5 - position);
  const familySupport = accords.filter((accord) =>
    isComplementaryAccord(normalizedAccord, accord)
  ).length;
  const profileSupport = [
    ...(perfume.vibes || []),
    ...(perfume.occasions || []),
    ...(perfume.seasons || []),
  ].filter((item) =>
    supportsAccordContext(normalizedAccord, normalizeAccordLabel(item))
  ).length;

  return positionScore * 2 + familySupport + profileSupport * 0.6;
}

function supportsAccordContext(targetAccord, value) {
  const supportMap = {
    aromatic: ["fresh", "clean", "office", "daily", "spring", "summer", "green"],
    citrus: ["fresh", "bright", "summer", "spring", "daily", "vacation", "clean"],
    "fresh spicy": ["fresh", "energetic", "office", "daily", "spring"],
    woody: ["formal", "office", "fall", "winter", "sophisticated", "masculine"],
    amber: ["evening", "night", "date", "winter", "fall", "warm", "cozy"],
  };

  return supportMap[targetAccord]?.includes(value) || false;
}

function getAccordExpansionReason({
  perfume,
  selectedSeasonSet,
  selectedOccasionSet,
  normalizedAccord,
  tier,
}) {
  const newSeasons = (perfume.seasons || []).filter(
    (season) => !selectedSeasonSet.has(season)
  );
  const newOccasions = (perfume.occasions || []).filter(
    (occasion) => !selectedOccasionSet.has(occasion)
  );
  const accords = (perfume.accords || []).map(normalizeAccordLabel);

  if (accords.includes("marine")) {
    return "Adds marine freshness";
  }

  if (accords.includes("green")) {
    return "Introduces green contrast";
  }

  if (accords.includes("woody") && normalizedAccord !== "woody") {
    return "Brings woody depth";
  }

  if (newOccasions.includes("formal") || newOccasions.includes("office")) {
    return "Adds formal versatility";
  }

  if (newSeasons.includes("summer")) {
    return "Improves summer coverage";
  }

  if (["Gold", "Platinum", "Diamond", "Mythic"].includes(tier)) {
    return `Premium ${formatLabel(normalizedAccord).toLowerCase()} option`;
  }

  return `Reinforces ${formatLabel(normalizedAccord).toLowerCase()} character`;
}

export function getPerfumeNoteLabels(perfume) {
  return [
    ...(perfume.topNotes || []),
    ...(perfume.middleNotes || []),
    ...(perfume.baseNotes || []),
  ]
    .map((note) => formatLabel(note))
    .filter(Boolean);
}

export function getSupportingAccords(perfume, selectedAccord) {
  const normalizedSelectedAccord = normalizeAccordLabel(selectedAccord);

  return (perfume.accords || [])
    .filter((accord) => normalizeAccordLabel(accord) !== normalizedSelectedAccord)
    .filter((accord, index, accords) => accords.indexOf(accord) === index)
    .slice(0, 3);
}

function isComplementaryAccord(targetAccord, candidateAccord) {
  if (targetAccord === candidateAccord) {
    return true;
  }

  const families = {
    aromatic: ["fresh spicy", "woody", "green", "citrus", "lavender"],
    citrus: ["fresh", "aromatic", "green", "marine", "fresh spicy"],
    "fresh spicy": ["citrus", "aromatic", "woody", "green"],
    woody: ["aromatic", "fresh spicy", "leather", "amber", "citrus"],
    amber: ["vanilla", "warm spicy", "sweet", "woody", "tobacco"],
  };

  return families[targetAccord]?.includes(candidateAccord) || false;
}

export function normalizeAccordLabel(value) {
  return String(value || "").trim().toLowerCase().replace(/\s+/g, " ");
}



function formatLabel(value) {
  return String(value || "")
    .split(/(?=[A-Z])|[-_\s]/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
