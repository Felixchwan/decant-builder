import {
  buildCollectionCardDnaItems,
  buildCollectionCardProfileTraits,
  buildCollectionCardSeasonRows,
} from "../collectionCard/buildCollectionCardViewModel.js";
import {
  buildDnaExplorerIndex,
  formatIntelligenceLabel,
  getPerfumeNoteLabels,
  getStrengthSegmentCount,
  getSupportingAccords,
  normalizeAccordLabel,
  selectDnaExplorerDetail,
} from "./buildDnaExplorerModel.js";
import { buildNextImprovementResult, getObjectiveCompatibilityScore } from "./buildNextImprovement.js";
import { buildCollectionMetrics } from "./collectionMetrics.js";
import { getSeasonStrengthLevel } from "./seasonalEvidence.js";

export {
  formatIntelligenceLabel,
  getObjectiveCompatibilityScore,
  getPerfumeNoteLabels,
  getStrengthSegmentCount,
  getSupportingAccords,
  normalizeAccordLabel,
  selectDnaExplorerDetail,
};

export function buildCollectionIntelligenceViewModel({
  selectedPerfumes = [],
  catalog = [],
  collectionSummary,
  coverageSummary,
  scentDna,
  recommendations,
  curatorBonus,
  config,
}) {
  const safeSelectedPerfumes = Array.isArray(selectedPerfumes) ? selectedPerfumes : [];
  const safeCatalog = Array.isArray(catalog) ? catalog : [];
  const summary = collectionSummary || {};
  const safeCoverageSummary = coverageSummary || { strengths: [], gaps: [] };
  const selectedCount = safeSelectedPerfumes.length;
  const selectedPerfumeIds = new Set(safeSelectedPerfumes.map((perfume) => perfume.id));
  // One set of numbers per box: the stars, the profile chips, Box Intelligence and its gap all read these.
  const metrics = buildCollectionMetrics({ selectedPerfumes: safeSelectedPerfumes, boxSummary: summary });
  const balanceRecommendations = recommendations?.toBalanceYourBox || [];
  const curatorRecommendations = curatorBonus?.recommendations || [];
  const curatorPreference = curatorBonus?.preference || "complement";
  const seasonRows = buildCollectionCardSeasonRows(
    summary.seasonStrengths || summary.seasonCounts || {},
    selectedCount
  );
  const hasProfileData =
    (summary.occasions || []).length > 0 ||
    (summary.seasons || []).length > 0 ||
    (summary.vibes || []).length > 0 ||
    Object.keys(summary.accordMap || {}).length > 0 ||
    (summary.notes || []).length > 0;
  const hasAnalysisData =
    (safeCoverageSummary.strengths || []).length > 0 ||
    (safeCoverageSummary.gaps || []).length > 0;
  const profileTraits = buildCollectionCardProfileTraits({
    selectedPerfumes: safeSelectedPerfumes,
    boxSummary: summary,
    coverageSummary: safeCoverageSummary,
  });
  const dnaItems = buildCollectionCardDnaItems({ boxSummary: summary, scentDna });
  const visibleDnaItems = dnaItems
    .map((item) => ({
      ...item,
      count: countSelectedPerfumesByAccord(safeSelectedPerfumes, item.label),
      displayLabel: formatIntelligenceLabel(item.label),
      normalizedKey: normalizeAccordLabel(item.label),
    }))
    .filter((item) => item.count > 0);
  const dnaExplorerIndex = buildDnaExplorerIndex({
    accordItems: visibleDnaItems,
    selectedPerfumes: safeSelectedPerfumes,
    catalogPerfumes: safeCatalog,
    selectedPerfumeIds,
    recommendations,
  });
  const balanceRows = buildCollectionBalanceRows({ metrics });
  const boxIntelligence = buildBoxIntelligence({
    boxSummary: summary,
    coverageSummary: safeCoverageSummary,
    metrics,
    selectedPerfumes: safeSelectedPerfumes,
  });
  const nextImprovement = buildNextImprovementResult({
    intelligence: boxIntelligence,
    selectedPerfumes: safeSelectedPerfumes,
    balanceRecommendations,
    selectedCount,
    isBoxFull: Boolean(config?.isBoxFull),
  });
  const curatorInsight = buildCuratorInsight({
    boxSummary: summary,
    coverageSummary: safeCoverageSummary,
    recommendations: curatorRecommendations,
    preference: curatorPreference,
    selectedCount,
  });

  return {
    profile: {
      traits: profileTraits,
      primaryTrait: profileTraits[0] || "",
      supportingTraits: profileTraits.slice(1),
      hasProfileData,
    },
    seasons: {
      rows: seasonRows,
      strongest: getSeasonBoundary(seasonRows, "strongest"),
      weakest: getSeasonBoundary(seasonRows, "weakest"),
    },
    dna: {
      descriptors: dnaItems,
      visibleItems: visibleDnaItems,
      accordIndex: dnaExplorerIndex,
    },
    balance: {
      rows: balanceRows,
    },
    boxIntelligence: {
      ...boxIntelligence,
      curatorInsight,
      hasAnalysisData,
    },
    nextImprovement,
  };
}

function getSeasonBoundary(seasonRows, type) {
  if (!Array.isArray(seasonRows) || seasonRows.length === 0) {
    return null;
  }

  return [...seasonRows].sort((a, b) =>
    type === "strongest"
      ? b.count - a.count || a.label.localeCompare(b.label)
      : a.count - b.count || a.label.localeCompare(b.label)
  )[0];
}

function countSelectedPerfumesByAccord(selectedPerfumes, accord) {
  const normalizedAccord = normalizeAccordLabel(accord);

  return selectedPerfumes.filter((perfume) =>
    (perfume.accords || []).some(
      (perfumeAccord) => normalizeAccordLabel(perfumeAccord) === normalizedAccord
    )
  ).length;
}

// The five "Collection Balance" rows. `score` is the 0-100 metric and `level` its 1-5 stars (equal 20-point
// bands). What each one means:
//   Versatility        how many different occasions, moods and seasons the box can serve
//   Breadth            how wide a spread of accords and notes the box covers (it measures variety of scent
//                      ingredients, not how dark or rich the scents are, hence "Breadth", not "Depth")
//   Freshness          how fresh (citrus, marine, green, clean) the fragrances are
//   Season Balance     how evenly the box serves the four seasons (shared with the radar and the season gaps)
//   Signature Coherence how strongly one recognisable olfactory thread runs through the box (mean pairwise
//                      similarity). High = a clear signature; low = an intentionally heterogeneous box. It is
//                      independent of Versatility: a repetitive box is coherent (high) and not versatile (low)
function buildCollectionBalanceRows({ metrics }) {
  const row = (label, key) => ({ label, level: metrics.stars[key], score: metrics.scores[key] });

  return [
    row("Versatility", "versatility"),
    row("Breadth", "breadth"),
    row("Freshness", "freshness"),
    row("Season Balance", "seasonBalance"),
    row("Signature Coherence", "signature"),
  ];
}

export function formatFiveStarRating(level) {
  return `${"★".repeat(level)}${"☆".repeat(5 - level)}`;
}


function buildCuratorInsight({
  boxSummary,
  coverageSummary,
  recommendations,
  preference,
  selectedCount,
}) {
  if (selectedCount === 0) {
    return {
      strengths: [],
      improvementGoals: [],
    };
  }

  const seasonalRows = buildCollectionCardSeasonRows(
    boxSummary.seasonStrengths || boxSummary.seasonCounts || {},
    selectedCount
  );
  const seasonalStrengths = seasonalRows
    .filter((season) => season.count >= 50)
    .map((season) => `${getSeasonStrengthLevel(season.count)} ${season.label} Coverage`);
  const seasonalOpportunities = seasonalRows
    .filter((season) => season.count < 50)
    .map((season) => `${getSeasonStrengthLevel(season.count)} ${season.label} Coverage`);
  const profileStrengths = getCollectionProfileStrengths(boxSummary);
  const profileOpportunities = getCollectionProfileOpportunities(boxSummary, seasonalRows);
  const strengths = uniqueStrings([
    ...seasonalStrengths,
    ...profileStrengths,
    ...(coverageSummary.strengths || []).map((item) => item.label),
  ]).slice(0, 3);
  const recommendationReasons = recommendations.flatMap(
    (recommendation) => recommendation.reasons || []
  );
  const improvementSources =
    preference === "complement"
      ? [
          ...seasonalOpportunities,
          ...profileOpportunities,
          ...(coverageSummary.gaps || []).map((item) => getGapLabel(item)),
          ...recommendationReasons,
        ]
      : [
          ...profileOpportunities,
          ...seasonalOpportunities,
          ...recommendationReasons,
        ];

  return {
    strengths,
    improvementGoals: uniqueStrings(improvementSources).slice(0, 3),
  };
}

function buildBoxIntelligence({
  boxSummary,
  coverageSummary,
  metrics,
  selectedPerfumes,
}) {
  const selectedCount = selectedPerfumes.length;

  if (selectedCount === 0) {
    return {
      isEarly: false,
      items: [],
      mainGap: null,
      bestNextMove: "",
      dominantProfile: "",
      strongestCoverage: "",
    };
  }

  const seasonRows = buildCollectionCardSeasonRows(
    boxSummary.seasonStrengths || boxSummary.seasonCounts || {},
    selectedCount
  );
  const occasionCounts = boxSummary.occasionCounts || {};
  const vibeCounts = boxSummary.vibeCounts || {};
  const accordCounts = getAccordCounts(boxSummary);
  const profileSignals = getBoxProfileSignals({
    occasionCounts,
    vibeCounts,
    accordCounts,
  });
  const dominantProfile = getDominantBoxProfile({
    profileSignals,
    metrics,
    selectedCount,
  });
  const strongestCoverage = getStrongestBoxCoverage({
    seasonRows,
    occasionCounts,
    selectedCount,
  });
  const mostImportantGap = getMostImportantBoxGap({
    coverageSummary,
    metrics,
    occasionCounts,
    accordCounts,
    selectedCount,
  });
  const bestNextMove = getBestBoxNextMove({
    gap: mostImportantGap,
    metrics,
    occasionCounts,
    accordCounts,
  });

  return {
    isEarly: selectedCount < 3,
    mainGap: mostImportantGap,
    bestNextMove,
    dominantProfile,
    strongestCoverage,
    items: uniqueInsightItems([
      {
        type: "profile",
        label: selectedCount < 3 ? "Early profile" : "Dominant profile",
        value: dominantProfile,
      },
      {
        type: "coverage",
        label: "Strongest coverage",
        value: strongestCoverage,
      },
    ]).slice(0, 2),
  };
}

// Fresh vs warm is decided once, per fragrance, in collectionMetrics (the profile chips use the same lean). These
// two character signals have no counterpart there, so they stay tag counts.
function getBoxProfileSignals({ occasionCounts, vibeCounts, accordCounts }) {
  const sweetSeductive =
    (vibeCounts.seductive || 0) +
    (accordCounts.sweet || 0) +
    (accordCounts.vanilla || 0) +
    (accordCounts.amber || 0);
  const woodySophisticated =
    (accordCounts.woody || 0) +
    (accordCounts.leather || 0) +
    (accordCounts.iris || 0) +
    (accordCounts.powdery || 0) +
    (occasionCounts.formal || 0) +
    (vibeCounts.elegant || 0);

  return {
    sweetSeductive,
    woodySophisticated,
  };
}

function getDominantBoxProfile({ profileSignals, metrics, selectedCount }) {
  const { profile } = metrics;

  // The same "Balanced Rotation" the profile chip shows: every season served, with range.
  if (selectedCount >= 4 && profile.isBalancedRotation) {
    return "Balanced and versatile";
  }

  if (profile.lean === "warm") {
    return "Warm and evening-oriented";
  }

  if (profile.lean === "fresh") {
    return "Fresh-heavy";
  }

  const [topSignal, topScore] =
    Object.entries(profileSignals).sort(([, scoreA], [, scoreB]) => scoreB - scoreA)[0] || ["balanced", 0];

  // A character signal only names the box when it runs through it (about one tag per fragrance or more).
  if (topScore >= selectedCount && selectedCount > 0) {
    if (topSignal === "sweetSeductive") {
      return "Sweet and seductive";
    }

    if (topSignal === "woodySophisticated") {
      return "Woody and sophisticated";
    }
  }

  // Never "Balanced and versatile" here: that is only said of a box that is balanced across the seasons (above).
  return selectedCount < 3 ? "Still taking shape" : "Mixed character";
}

function getStrongestBoxCoverage({ seasonRows, occasionCounts, selectedCount }) {
  const seasonCandidates = seasonRows
    .filter((season) => season.count >= 30)
    .map((season) => ({
      score: season.count,
      label: `${getSeasonStrengthLevel(season.count)} ${season.label.toLowerCase()} coverage`,
    }));
  const occasionCandidates = [
    {
      score: getOccasionCoverageScore(occasionCounts, ["office"], selectedCount),
      label: "Strong office versatility",
    },
    {
      score: getOccasionCoverageScore(occasionCounts, ["date", "night", "evening"], selectedCount),
      label: "Strong date-night profile",
    },
    {
      score: getOccasionCoverageScore(occasionCounts, ["daily", "casual"], selectedCount),
      label: "Strong daily versatility",
    },
    {
      score: getOccasionCoverageScore(occasionCounts, ["formal"], selectedCount),
      label: "Strong formal coverage",
    },
  ].filter((candidate) => candidate.score >= 50);
  const topCandidate = [...seasonCandidates, ...occasionCandidates].sort(
    (a, b) => b.score - a.score || a.label.localeCompare(b.label)
  )[0];

  return topCandidate?.label || "Profile still developing";
}

function getMostImportantBoxGap({
  coverageSummary,
  metrics,
  occasionCounts,
  accordCounts,
  selectedCount,
}) {
  const formalCount = occasionCounts.formal || 0;
  const eveningCount =
    (occasionCounts.date || 0) + (occasionCounts.night || 0) + (occasionCounts.evening || 0);
  const accordDiversity = Object.keys(accordCounts).length;
  const gapCandidate = (coverageSummary.gaps || [])[0];
  // The same season the coverage list calls a gap: the weakest one below the covered line.
  const weakestSeason = metrics.seasonal.gaps[0];

  if (weakestSeason === "fall" || weakestSeason === "winter") {
    return {
      type: "winter",
      label: "Limited winter depth",
    };
  }

  if (weakestSeason && selectedCount >= 3) {
    return {
      type: "summer",
      label: "Limited warm-weather freshness",
    };
  }

  if (formalCount === 0 && selectedCount >= 3) {
    return {
      type: "formal",
      label: "Weak formal coverage",
    };
  }

  if (eveningCount < 2 && selectedCount >= 3) {
    return {
      type: "evening",
      label: "Limited evening versatility",
    };
  }

  if (metrics.profile.lean === "fresh") {
    return {
      type: "warmth",
      label: "Missing warm or smoky character",
    };
  }

  if (accordDiversity < Math.min(5, selectedCount + 2)) {
    return {
      type: "diversity",
      label: "Low accord diversity",
    };
  }

  if (gapCandidate) {
    return {
      type: gapCandidate.category || "coverage",
      label: getGapLabel(gapCandidate),
    };
  }

  return {
    type: "contrast",
    label: "Missing a clear contrast profile",
  };
}

function getBestBoxNextMove({ gap, metrics, occasionCounts, accordCounts }) {
  if (gap.type === "winter" || gap.type === "warmth") {
    return "Add one warm evening fragrance";
  }

  if (gap.type === "formal") {
    return "Add a formal woody option";
  }

  if (gap.type === "summer") {
    return "Add a fresh daytime fragrance";
  }

  if (gap.type === "evening") {
    return "Add a stronger evening fragrance";
  }

  if (gap.type === "diversity") {
    return "Add a contrasting profile for more diversity";
  }

  if (!accordCounts.woody && (occasionCounts.formal || 0) === 0) {
    return "Add a polished woody fragrance";
  }

  if (metrics.profile.lean === "warm") {
    return "Add a fresh daytime fragrance";
  }

  return "Add a clear contrast fragrance";
}

function getOccasionCoverageScore(occasionCounts, targets, selectedCount) {
  const count = targets.reduce((sum, target) => sum + (occasionCounts[target] || 0), 0);

  if (selectedCount === 0) {
    return 0;
  }

  return Math.round((count / selectedCount) * 100);
}

function uniqueInsightItems(items) {
  const seenValues = new Set();

  return items.filter((item) => {
    const normalizedValue = item.value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

    if (seenValues.has(normalizedValue)) {
      return false;
    }

    seenValues.add(normalizedValue);
    return true;
  });
}

function getCollectionProfileStrengths(boxSummary) {
  const strengths = [];
  const occasionCounts = boxSummary.occasionCounts || {};
  const vibeCounts = boxSummary.vibeCounts || {};
  const accordCounts = getAccordCounts(boxSummary);

  if ((occasionCounts.daily || 0) + (occasionCounts.office || 0) >= 3) {
    strengths.push("Strong Daily Versatility");
  }

  if ((occasionCounts.date || 0) + (occasionCounts.night || 0) >= 3) {
    strengths.push("Strong Evening Variety");
  }

  if ((vibeCounts.fresh || 0) + (accordCounts.fresh || 0) + (accordCounts.citrus || 0) >= 4) {
    strengths.push("Fresh-forward Profile");
  }

  if ((vibeCounts.warm || 0) + (vibeCounts.cozy || 0) + (accordCounts.amber || 0) >= 4) {
    strengths.push("Strong Cold-weather Depth");
  }

  return strengths;
}

function getCollectionProfileOpportunities(boxSummary, seasonalRows) {
  const opportunities = [];
  const occasionCounts = boxSummary.occasionCounts || {};
  const vibeCounts = boxSummary.vibeCounts || {};
  const accordCounts = getAccordCounts(boxSummary);
  const winterScore = seasonalRows.find((season) => season.id === "winter")?.count || 0;
  const summerScore = seasonalRows.find((season) => season.id === "summer")?.count || 0;
  const freshSignals =
    (vibeCounts.fresh || 0) + (vibeCounts.clean || 0) + (accordCounts.citrus || 0);
  const warmSignals =
    (vibeCounts.warm || 0) +
    (vibeCounts.cozy || 0) +
    (accordCounts.amber || 0) +
    (accordCounts["warm spicy"] || 0);

  if (winterScore < 50 && warmSignals < freshSignals) {
    opportunities.push("Limited Cold-weather Depth");
  }

  if (summerScore < 30) {
    opportunities.push("Limited Warm-weather Freshness");
  }

  if ((occasionCounts.date || 0) + (occasionCounts.night || 0) < 2) {
    opportunities.push("Missing Evening Variety");
  }

  if (!accordCounts.woody) {
    opportunities.push("Underrepresented Woody Fragrances");
  }

  if (!accordCounts.leather && (occasionCounts.date || 0) + (occasionCounts.night || 0) < 3) {
    opportunities.push("Missing Leather Depth");
  }

  if (freshSignals >= warmSignals + 3) {
    opportunities.push("Fresh-heavy Profile");
  }

  return opportunities;
}

function getGapLabel(item) {
  if (item.category === "seasons") {
    return `Weak ${formatLabel(item.target)} Coverage`;
  }

  return `Limited ${formatLabel(item.target)} Variety`;
}

function getAccordCounts(boxSummary) {
  return Object.fromEntries(
    Object.entries(boxSummary.accordMap || {}).map(([accord, perfumeNames]) => [
      accord,
      perfumeNames.length,
    ])
  );
}

function uniqueStrings(values) {
  return [...new Set(values.filter(Boolean))];
}


function formatLabel(value) {
  return String(value || "")
    .split(/(?=[A-Z])|[-_\s]/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
