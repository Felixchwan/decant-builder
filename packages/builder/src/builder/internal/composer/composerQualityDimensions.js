import { buildCollectionCardSeasonRows } from "../collectionCard/buildCollectionCardViewModel.js";
import { buildBoxSummary } from "../../../utils/buildBoxSummary.js";
import { buildScentDna } from "../../../utils/buildScentDna.js";
import { getPerfumeNoteIds } from "../../../utils/noteUtils.js";
import {
  COMPOSER_PENALTY_IDS,
  COMPOSER_WEIGHTED_DIMENSION_IDS,
} from "./composerStrategyWeights.js";

const SEASON_IDS = Object.freeze(["spring", "summer", "fall", "winter"]);
const BUDGET_UNLIMITED_SCORE = 100;
const BUDGET_PLATEAU_START = 0.8;
const BUDGET_ACCEPTABLE_START = 0.6;
const BUDGET_ACCEPTABLE_SCORE = 70;
const MAX_REASONABLE_OCCASION_DOMAIN = 10;
const MAX_REASONABLE_VIBE_DOMAIN = 18;
const MAX_REASONABLE_ACCORD_DOMAIN = 24;
const MAX_REASONABLE_NOTE_DOMAIN = 90;
const TARGET_DOMINANT_RATIO = 0.34;
const MIN_COHERENT_DOMINANT_RATIO = 0.18;
const MAX_COHERENT_DOMINANT_RATIO = 0.58;
const REDUNDANT_SIMILARITY_THRESHOLD = 0.58;

export const COMPOSER_QUALITY_DIMENSION_IDS = COMPOSER_WEIGHTED_DIMENSION_IDS;
export const COMPOSER_QUALITY_PENALTY_IDS = COMPOSER_PENALTY_IDS;

export function evaluateComposerQualityDimensions({
  request,
  candidatePerfumes = [],
  catalog = [],
  notes = {},
} = {}) {
  const perfumes = stablePerfumes(candidatePerfumes);
  const catalogPerfumes = Array.isArray(catalog) ? catalog : [];
  const boxSummary = buildBoxSummary(perfumes, notes || {});
  const scentDna = buildScentDna(perfumes, boxSummary);
  const domainSizes = getDomainSizes(catalogPerfumes, perfumes);
  const context = {
    request,
    perfumes,
    catalog: catalogPerfumes,
    notes: notes || {},
    boxSummary,
    scentDna,
    domainSizes,
    selectedCount: perfumes.length,
  };
  const dimensions = {
    preferenceFit: getPreferenceFitDimension(context),
    coverage: getCoverageDimension(context),
    diversity: getDiversityDimension(context),
    versatility: getVersatilityDimension(context),
    coherence: getCoherenceDimension(context),
    budgetEfficiency: getBudgetEfficiencyDimension(context),
    signatureFocus: getSignatureFocusDimension(context),
  };
  const penalties = {
    redundancyPenalty: getRedundancyPenalty(context),
  };

  return {
    dimensions,
    penalties,
    diagnostics: {
      dimensionIds: [...COMPOSER_QUALITY_DIMENSION_IDS],
      penaltyIds: [...COMPOSER_QUALITY_PENALTY_IDS],
      evaluatedPerfumeIds: perfumes.map((perfume) => perfume.id),
      collectionSize: perfumes.length,
      domainSizes,
      scentDnaScores: { ...scentDna.scores },
    },
  };
}

function getPreferenceFitDimension({ request, perfumes }) {
  const domainDefinitions = [
    ["seasons", request?.preferredSeasons || [], getCollectionSet(perfumes, "seasons")],
    ["occasions", request?.preferredOccasions || [], getCollectionSet(perfumes, "occasions")],
    ["vibes", request?.preferredVibes || [], getCollectionSet(perfumes, "vibes")],
  ];
  const components = {};
  const diagnostics = {
    consideredDomains: [],
    omittedDomains: [],
    matched: {},
    missing: {},
  };

  domainDefinitions.forEach(([domain, preferences, collectionSet]) => {
    const uniquePreferences = uniqueNormalized(preferences);

    if (uniquePreferences.length === 0) {
      diagnostics.omittedDomains.push(domain);
      return;
    }

    const matched = uniquePreferences.filter((preference) => collectionSet.has(preference));
    const missing = uniquePreferences.filter((preference) => !collectionSet.has(preference));
    components[domain] = clampScore((matched.length / uniquePreferences.length) * 100);
    diagnostics.consideredDomains.push(domain);
    diagnostics.matched[domain] = matched;
    diagnostics.missing[domain] = missing;
  });

  const componentScores = Object.values(components);
  const score =
    componentScores.length === 0
      ? 100
      : clampScore(average(componentScores));

  return dimensionResult(score, components, diagnostics);
}

function getCoverageDimension({ perfumes, boxSummary, domainSizes, selectedCount }) {
  const seasonRows = buildCollectionCardSeasonRows(
    boxSummary.seasonStrengths || boxSummary.seasonCounts || {},
    selectedCount
  );
  const components = {
    seasons: clampScore(average(seasonRows.map((season) => season.percent))),
    occasions: coverageRatio(boxSummary.occasions.length, domainSizes.occasions),
    vibes: coverageRatio(boxSummary.vibes.length, domainSizes.vibes),
    accords: coverageRatio(Object.keys(boxSummary.accordMap || {}).length, domainSizes.accords),
  };
  const score = clampScore(
    components.seasons * 0.32 +
      components.occasions * 0.24 +
      components.vibes * 0.2 +
      components.accords * 0.24
  );

  return dimensionResult(score, components, {
    uniqueCounts: {
      seasons: boxSummary.seasons.length,
      occasions: boxSummary.occasions.length,
      vibes: boxSummary.vibes.length,
      accords: Object.keys(boxSummary.accordMap || {}).length,
      perfumes: perfumes.length,
    },
  });
}

function getDiversityDimension({ perfumes, boxSummary, selectedCount }) {
  const accordCounts = countValues(perfumes, "accords");
  const vibeCounts = boxSummary.vibeCounts || {};
  const occasionCounts = boxSummary.occasionCounts || {};
  const tierCounts = countTiers(perfumes);
  const components = {
    accords: entropyScore(accordCounts),
    vibes: entropyScore(vibeCounts),
    occasions: entropyScore(occasionCounts),
    tiers: selectedCount > 1 ? entropyScore(tierCounts) : 0,
  };
  const score = clampScore(
    components.accords * 0.45 +
      components.vibes * 0.25 +
      components.occasions * 0.15 +
      components.tiers * 0.15
  );

  return dimensionResult(score, components, {
    accordCount: Object.keys(accordCounts).length,
    tierCount: Object.keys(tierCounts).length,
  });
}

function getVersatilityDimension({ boxSummary, scentDna, domainSizes, selectedCount }) {
  const occasionBreadth = coverageRatio(boxSummary.occasions.length, domainSizes.occasions);
  const dailyPracticality = getPracticalOccasionScore(boxSummary.occasionCounts || {}, selectedCount);
  const components = {
    dnaVersatility: scentDna.scores.versatility,
    seasonBalance: scentDna.scores.seasonBalance,
    occasionBreadth,
    dailyPracticality,
  };
  const score = clampScore(
    components.dnaVersatility * 0.34 +
      components.seasonBalance * 0.28 +
      components.occasionBreadth * 0.22 +
      components.dailyPracticality * 0.16
  );

  return dimensionResult(score, components, {});
}

function getCoherenceDimension({ perfumes, boxSummary, scentDna, selectedCount }) {
  const accordCounts = countValues(perfumes, "accords");
  const dominantAccordRatio = getDominantRatio(accordCounts);
  const dominantAccordShape = getDominantAccordShapeScore(dominantAccordRatio);
  const pairSimilarity = getAveragePairSimilarity(perfumes);
  const controlledSimilarity = getControlledSimilarityScore(pairSimilarity);
  const profileCoverage = getProfileCoverageScore(boxSummary, selectedCount);
  const components = {
    dominantAccordShape,
    controlledSimilarity,
    profileCoverage,
    seasonBalance: scentDna.scores.seasonBalance,
  };
  const score = clampScore(
    components.dominantAccordShape * 0.3 +
      components.controlledSimilarity * 0.26 +
      components.profileCoverage * 0.22 +
      components.seasonBalance * 0.22
  );

  return dimensionResult(score, components, {
    dominantAccordRatio: roundNumber(dominantAccordRatio),
    averagePairSimilarity: roundNumber(pairSimilarity),
  });
}

function getBudgetEfficiencyDimension({ request, perfumes }) {
  const budget = request?.budget;
  const pointValue = request?.pointValue;

  if (typeof pointValue !== "number" || !Number.isFinite(pointValue) || pointValue <= 0) {
    throw new Error("Composer quality evaluation requires normalized request pointValue.");
  }
  const totalValue = perfumes.reduce((sum, perfume) => sum + perfume.points * pointValue, 0);
  const utilization = budget && budget > 0 ? totalValue / budget : 0;

  if (budget === null || budget === undefined) {
    return dimensionResult(BUDGET_UNLIMITED_SCORE, {}, {
      utilization: null,
      neutral: true,
      reason: "unlimited-budget",
    });
  }

  if (budget === 0) {
    return dimensionResult(totalValue === 0 ? 100 : 0, {}, {
      utilization: 0,
      neutral: totalValue === 0,
      reason: "zero-budget",
    });
  }

  return dimensionResult(getBudgetUtilizationScore(utilization), {}, {
    utilization: roundNumber(utilization),
    plateauStart: BUDGET_PLATEAU_START,
  });
}

function getSignatureFocusDimension({ perfumes, boxSummary, scentDna, selectedCount }) {
  const points = perfumes
    .map((perfume) => perfume.points)
    .filter((pointValue) => typeof pointValue === "number" && Number.isFinite(pointValue))
    .sort((a, b) => b - a);
  const anchorPoints = points.slice(0, Math.min(2, points.length));
  const anchorScore = clampScore((average(anchorPoints) / 4) * 100);
  const premiumPresence = clampScore(
    (perfumes.filter((perfume) => perfume.points >= 2).length / Math.max(1, selectedCount)) * 100
  );
  const accordFocus = getDominantAccordShapeScore(getDominantRatio(countValues(perfumes, "accords")));
  const components = {
    anchorStrength: anchorScore,
    premiumPresence,
    scentDepth: scentDna.scores.depth,
    accordFocus,
  };
  const score = clampScore(
    components.anchorStrength * 0.36 +
      components.premiumPresence * 0.2 +
      components.scentDepth * 0.24 +
      components.accordFocus * 0.2
  );

  return dimensionResult(score, components, {
    topPoints: anchorPoints,
    uniqueAccords: Object.keys(boxSummary.accordMap || {}).length,
  });
}

function getRedundancyPenalty({ perfumes, boxSummary, selectedCount }) {
  if (selectedCount <= 1) {
    return penaltyResult(0, {
      dominantAccordRatio: 0,
      seasonConcentration: 0,
      averagePairSimilarity: 0,
    });
  }

  const dominantAccordRatio = getDominantRatio(countValues(perfumes, "accords"));
  const seasonConcentration = getDominantRatio(boxSummary.seasonStrengths || {});
  const averagePairSimilarity = getAveragePairSimilarity(perfumes);
  const components = {
    dominantAccordConcentration: excessRatioScore(dominantAccordRatio, MAX_COHERENT_DOMINANT_RATIO),
    seasonConcentration: excessRatioScore(seasonConcentration, 0.72),
    pairSimilarity: excessRatioScore(averagePairSimilarity, REDUNDANT_SIMILARITY_THRESHOLD),
  };
  const magnitude = clampScore(
    components.dominantAccordConcentration * 0.38 +
      components.seasonConcentration * 0.24 +
      components.pairSimilarity * 0.38
  );

  return penaltyResult(magnitude, components, {
    dominantAccordRatio: roundNumber(dominantAccordRatio),
    seasonConcentration: roundNumber(seasonConcentration),
    averagePairSimilarity: roundNumber(averagePairSimilarity),
  });
}

function getDomainSizes(catalog, perfumes) {
  const source = catalog.length > 0 ? catalog : perfumes;

  return {
    seasons: SEASON_IDS.length,
    occasions: Math.min(
      MAX_REASONABLE_OCCASION_DOMAIN,
      Math.max(1, getCollectionSet(source, "occasions").size)
    ),
    vibes: Math.min(
      MAX_REASONABLE_VIBE_DOMAIN,
      Math.max(1, getCollectionSet(source, "vibes").size)
    ),
    accords: Math.min(
      MAX_REASONABLE_ACCORD_DOMAIN,
      Math.max(1, getCollectionSet(source, "accords").size)
    ),
    notes: Math.min(
      MAX_REASONABLE_NOTE_DOMAIN,
      Math.max(1, new Set(source.flatMap((perfume) => getPerfumeNoteIds(perfume))).size)
    ),
  };
}

function getBudgetUtilizationScore(utilization) {
  if (!Number.isFinite(utilization) || utilization <= 0) {
    return 0;
  }

  if (utilization >= BUDGET_PLATEAU_START) {
    return 100;
  }

  if (utilization >= BUDGET_ACCEPTABLE_START) {
    return (
      BUDGET_ACCEPTABLE_SCORE +
      ((utilization - BUDGET_ACCEPTABLE_START) /
        (BUDGET_PLATEAU_START - BUDGET_ACCEPTABLE_START)) *
        (100 - BUDGET_ACCEPTABLE_SCORE)
    );
  }

  return (utilization / BUDGET_ACCEPTABLE_START) * BUDGET_ACCEPTABLE_SCORE;
}

function getPracticalOccasionScore(occasionCounts, selectedCount) {
  if (selectedCount === 0) {
    return 0;
  }

  const practicalCount =
    (occasionCounts.daily || 0) +
    (occasionCounts.office || 0) +
    (occasionCounts.casual || 0) +
    (occasionCounts.day || 0);

  return clampScore((practicalCount / Math.max(1, selectedCount * 2)) * 100);
}

function getProfileCoverageScore(boxSummary, selectedCount) {
  if (selectedCount === 0) {
    return 0;
  }

  const accordCount = Object.keys(boxSummary.accordMap || {}).length;
  const occasionCount = boxSummary.occasions.length;
  const vibeCount = boxSummary.vibes.length;

  return clampScore(
    coverageRatio(accordCount, Math.min(MAX_REASONABLE_ACCORD_DOMAIN, selectedCount * 3)) * 0.42 +
      coverageRatio(occasionCount, Math.min(MAX_REASONABLE_OCCASION_DOMAIN, selectedCount + 2)) *
        0.28 +
      coverageRatio(vibeCount, Math.min(MAX_REASONABLE_VIBE_DOMAIN, selectedCount * 2)) * 0.3
  );
}

function getDominantAccordShapeScore(ratio) {
  if (!Number.isFinite(ratio) || ratio <= 0) {
    return 0;
  }

  if (ratio < MIN_COHERENT_DOMINANT_RATIO) {
    return clampScore((ratio / MIN_COHERENT_DOMINANT_RATIO) * 70);
  }

  if (ratio <= MAX_COHERENT_DOMINANT_RATIO) {
    const distance = Math.abs(ratio - TARGET_DOMINANT_RATIO);
    return clampScore(100 - (distance / (MAX_COHERENT_DOMINANT_RATIO - TARGET_DOMINANT_RATIO)) * 22);
  }

  return clampScore(78 - ((ratio - MAX_COHERENT_DOMINANT_RATIO) / 0.42) * 78);
}

function getControlledSimilarityScore(similarity) {
  if (!Number.isFinite(similarity)) {
    return 0;
  }

  if (similarity < 0.12) {
    return clampScore((similarity / 0.12) * 78);
  }

  if (similarity <= 0.46) {
    return 100;
  }

  return clampScore(100 - ((similarity - 0.46) / 0.54) * 100);
}

function getAveragePairSimilarity(perfumes) {
  if (perfumes.length <= 1) {
    return 0;
  }

  let total = 0;
  let count = 0;

  for (let firstIndex = 0; firstIndex < perfumes.length; firstIndex += 1) {
    for (let secondIndex = firstIndex + 1; secondIndex < perfumes.length; secondIndex += 1) {
      total += getPerfumeSimilarity(perfumes[firstIndex], perfumes[secondIndex]);
      count += 1;
    }
  }

  return count > 0 ? total / count : 0;
}

function getPerfumeSimilarity(firstPerfume, secondPerfume) {
  const first = uniqueNormalized([
    ...(firstPerfume.accords || []).map((value) => `accord:${value}`),
    ...(firstPerfume.vibes || []).map((value) => `vibe:${value}`),
    ...(firstPerfume.occasions || []).map((value) => `occasion:${value}`),
    ...(firstPerfume.seasons || []).map((value) => `season:${value}`),
  ]);
  const second = uniqueNormalized([
    ...(secondPerfume.accords || []).map((value) => `accord:${value}`),
    ...(secondPerfume.vibes || []).map((value) => `vibe:${value}`),
    ...(secondPerfume.occasions || []).map((value) => `occasion:${value}`),
    ...(secondPerfume.seasons || []).map((value) => `season:${value}`),
  ]);

  return jaccardScore(first, second);
}

function coverageRatio(count, denominator) {
  return clampScore((count / Math.max(1, denominator)) * 100);
}

function entropyScore(countMap) {
  const counts = Object.values(countMap || {}).filter(
    (value) => typeof value === "number" && Number.isFinite(value) && value > 0
  );
  const total = counts.reduce((sum, count) => sum + count, 0);

  if (counts.length <= 1 || total <= 0) {
    return 0;
  }

  const entropy = counts.reduce((sum, count) => {
    const probability = count / total;
    return sum - probability * Math.log2(probability);
  }, 0);
  const maxEntropy = Math.log2(counts.length);

  return clampScore((entropy / maxEntropy) * 100);
}

function excessRatioScore(ratio, threshold) {
  if (!Number.isFinite(ratio) || ratio <= threshold) {
    return 0;
  }

  return clampScore(((ratio - threshold) / (1 - threshold)) * 100);
}

function getDominantRatio(countMap) {
  const counts = Object.values(countMap || {}).filter(
    (value) => typeof value === "number" && Number.isFinite(value) && value > 0
  );
  const total = counts.reduce((sum, count) => sum + count, 0);

  if (total <= 0) {
    return 0;
  }

  return Math.max(...counts) / total;
}

function countValues(perfumes, field) {
  return perfumes.reduce((counts, perfume) => {
    (perfume[field] || []).forEach((value) => {
      const key = normalizeLabel(value);
      counts[key] = (counts[key] || 0) + 1;
    });

    return counts;
  }, {});
}

function countTiers(perfumes) {
  return perfumes.reduce((counts, perfume) => {
    const key = getTierKey(perfume);
    counts[key] = (counts[key] || 0) + 1;
    return counts;
  }, {});
}

function getTierKey(perfume) {
  if (perfume.tier) {
    return normalizeLabel(perfume.tier);
  }

  if (perfume.id < 100) return "bronze";
  if (perfume.id < 200) return "silver";
  if (perfume.id < 300) return "gold";
  if (perfume.id < 400) return "platinum";
  if (perfume.id < 500) return "diamond";
  return "mythic";
}

function getCollectionSet(perfumes, field) {
  return new Set(
    (Array.isArray(perfumes) ? perfumes : [])
      .flatMap((perfume) => perfume?.[field] || [])
      .map(normalizeLabel)
      .filter(Boolean)
  );
}

function jaccardScore(firstValues, secondValues) {
  const firstSet = new Set(firstValues);
  const secondSet = new Set(secondValues);
  const union = new Set([...firstSet, ...secondSet]);

  if (union.size === 0) {
    return 0;
  }

  let intersectionSize = 0;
  firstSet.forEach((value) => {
    if (secondSet.has(value)) {
      intersectionSize += 1;
    }
  });

  return intersectionSize / union.size;
}

function stablePerfumes(perfumes) {
  return Array.isArray(perfumes)
    ? [...perfumes].sort((a, b) => (a?.id || 0) - (b?.id || 0))
    : [];
}

function dimensionResult(score, components, diagnostics) {
  return Object.freeze({
    score: clampScore(score),
    components: freezePlainObject(roundObject(components)),
    diagnostics: freezePlainObject(diagnostics),
  });
}

function penaltyResult(magnitude, components, diagnostics = {}) {
  return Object.freeze({
    magnitude: clampScore(magnitude),
    components: freezePlainObject(roundObject(components)),
    diagnostics: freezePlainObject(diagnostics),
  });
}

function uniqueNormalized(values) {
  return [...new Set((values || []).map(normalizeLabel).filter(Boolean))];
}

function normalizeLabel(value) {
  return String(value || "").trim().toLowerCase().replace(/\s+/g, " ");
}

function average(values) {
  const finiteValues = values.filter((value) => Number.isFinite(value));

  return finiteValues.length > 0
    ? finiteValues.reduce((sum, value) => sum + value, 0) / finiteValues.length
    : 0;
}

function clampScore(value) {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.min(100, roundNumber(value)));
}

function roundNumber(value) {
  if (!Number.isFinite(value)) {
    return value;
  }

  return Math.round(value * 100) / 100;
}

function roundObject(value) {
  return Object.fromEntries(
    Object.entries(value || {}).map(([key, entry]) => [
      key,
      typeof entry === "number" ? roundNumber(entry) : entry,
    ])
  );
}

function freezePlainObject(value) {
  return Object.freeze({ ...(value || {}) });
}
