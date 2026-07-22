import { buildCollectionCardSeasonRows } from "../collectionCard/buildCollectionCardViewModel.js";
import { buildBoxSummary } from "../../../utils/buildBoxSummary.js";
import { buildScentDna } from "../../../utils/buildScentDna.js";
import { getPerfumeNoteIds } from "../../../utils/noteUtils.js";
import {
  BUDGET_ASSESSMENTS,
  COHERENCE_SHAPES,
  DIRECTIONALITY,
  IDENTITY_TRAITS,
  MATCH_LEVELS,
  REASONING_THRESHOLD_POLICY_VERSION,
  REFINEMENT_FACT_STATUSES,
  TRADEOFF_EVIDENCE_THRESHOLDS,
  classifyBudgetUtilization,
  classifyCoveragePercent,
  classifyMatchRatio,
  classifyQualityScore,
  classifyRedundancyMagnitude,
} from "./composerReasoningLevels.js";

const SEASON_IDS = Object.freeze(["spring", "summer", "fall", "winter"]);
const PREFERENCE_DOMAINS = Object.freeze(["seasons", "occasions", "vibes"]);
const COVERAGE_DOMAINS = Object.freeze(["seasons", "occasions", "vibes", "accords"]);
const POSITIVE_DIMENSION_IDS = Object.freeze([
  "preferenceFit",
  "coverage",
  "diversity",
  "versatility",
  "coherence",
  "budgetEfficiency",
  "signatureFocus",
]);
const PENALTY_DIMENSION_IDS = Object.freeze(["redundancyPenalty"]);
const MAX_SIMILAR_PAIRS = 5;
const MAX_CONTRIBUTORS = 5;
const MAX_TRADEOFFS = 4;
const MAX_WARNINGS = 8;

export function deriveComposerReasoningFacts({
  compositionResult,
  catalog = [],
  config = {},
} = {}) {
  const result = compositionResult || {};
  const request = result.normalizedRequest || {};
  const collection = stablePerfumes(result.collection || []);
  const catalogPerfumes = Array.isArray(catalog) ? catalog : [];
  const catalogById = buildCatalogById(catalogPerfumes);
  const unknownIds = collection
    .map((perfume) => perfume.id)
    .filter((id) => catalogPerfumes.length > 0 && !catalogById.has(id))
    .sort((a, b) => a - b);
  const qualityResult = result.qualityResult || null;
  const constraintResult = result.constraintResult || null;
  const derivable = isDerivable(result, qualityResult, constraintResult);
  const context = buildReasoningContext({
    result,
    request,
    collection,
    catalogPerfumes,
    config,
    qualityResult,
    constraintResult,
    derivable,
  });
  const summary = deriveSummaryFacts(context);
  const preferenceMatch = derivable ? derivePreferenceFacts(context) : emptyPreferenceFacts();
  const coverage = derivable ? deriveCoverageFacts(context) : emptyCoverageFacts();
  const diversity = derivable ? deriveDiversityFacts(context) : emptyDiversityFacts();
  const versatility = derivable ? deriveVersatilityFacts(context) : emptyVersatilityFacts();
  const coherence = derivable ? deriveCoherenceFacts(context) : emptyCoherenceFacts();
  const budget = deriveBudgetFacts(context);
  const redundancy = derivable ? deriveRedundancyFacts(context) : emptyRedundancyFacts();
  const identity = derivable ? deriveIdentityFacts(context) : emptyIdentityFacts(request);
  const refinement = deriveRefinementFacts(context);
  const contributors = derivable
    ? deriveContributorFacts(context, preferenceMatch, coverage, redundancy, identity)
    : emptyContributorFacts();
  const tradeoffs = derivable
    ? deriveTradeoffFacts(context, diversity, coherence, budget, preferenceMatch)
    : [];
  const warnings = deriveWarnings({
    context,
    preferenceMatch,
    coverage,
    budget,
    redundancy,
    refinement,
  });
  const diagnostics = deriveDiagnostics({
    context,
    preferenceMatch,
    coverage,
    tradeoffs,
    warnings,
    unknownIds,
    derivable,
  });

  return sanitizeSerializable({
    derivable,
    compositionStatus: result.status || null,
    strategy: request.strategy?.id || result.diagnostics?.normalizedStrategyId || null,
    mode: result.mode || result.diagnostics?.mode || null,
    summary,
    preferenceMatch,
    coverage,
    diversity,
    versatility,
    coherence,
    budget,
    redundancy,
    identity,
    refinement,
    contributors,
    tradeoffs,
    warnings,
    diagnostics,
  });
}

function buildReasoningContext({
  result,
  request,
  collection,
  catalogPerfumes,
  config,
  qualityResult,
  constraintResult,
  derivable,
}) {
  const boxSummary = derivable ? buildBoxSummary(collection, {}) : null;
  const scentDna = derivable && boxSummary ? buildScentDna(collection, boxSummary) : null;
  const seasonRows = derivable
    ? buildCollectionCardSeasonRows(
        boxSummary?.seasonStrengths || boxSummary?.seasonCounts || {},
        collection.length
      )
    : [];
  const pointValue =
    safeNumber(request.pointValue) || safeNumber(config?.commerce?.pointValue) || 100;
  const dimensions = qualityResult?.dimensions || {};
  const penalties = qualityResult?.penalties || {};
  const qualityDiagnostics = qualityResult?.diagnostics?.quality || {};
  const metrics = constraintResult?.metrics || {};

  return {
    result,
    request,
    collection,
    catalogPerfumes,
    config,
    qualityResult,
    constraintResult,
    derivable,
    boxSummary,
    scentDna,
    seasonRows,
    pointValue,
    dimensions,
    penalties,
    qualityDiagnostics,
    metrics,
  };
}

function isDerivable(result, qualityResult, constraintResult) {
  return Boolean(
    result &&
      result.composed &&
      (result.status === "completed" || result.status === "partial") &&
      constraintResult?.valid &&
      qualityResult?.evaluable
  );
}

function deriveSummaryFacts({ result, request, collection, qualityResult, metrics }) {
  const perfumeCount = collection.length;
  const totalPoints = finiteOrZero(metrics.totalPoints, sumNumbers(collection.map((p) => p.points)));
  const estimatedValue = finiteOrZero(
    metrics.estimatedValue,
    totalPoints * (request.pointValue || 100)
  );

  return {
    perfumeCount,
    totalPoints: roundNumber(totalPoints),
    estimatedValue: roundNumber(estimatedValue),
    targetSlots: finiteOrNull(request.targetSlots),
    minimumSlots: finiteOrNull(request.minSlots),
    maximumSlots: finiteOrNull(request.maxSlots),
    targetReached: perfumeCount >= (request.targetSlots || 0),
    minimumReached: perfumeCount >= (request.minSlots || 0),
    budgetProvided: request.budget !== null && request.budget !== undefined,
    strategyId: request.strategy?.id || null,
    mode: result.mode || null,
    composed: Boolean(result.composed),
    status: result.status || null,
    qualityScore: finiteOrNull(qualityResult?.overallScore),
  };
}

function derivePreferenceFacts({ request, collection, dimensions }) {
  const domains = {
    seasons: derivePreferenceDomainFacts({
      requested: request.preferredSeasons || [],
      collection,
      field: "seasons",
    }),
    occasions: derivePreferenceDomainFacts({
      requested: request.preferredOccasions || [],
      collection,
      field: "occasions",
    }),
    vibes: derivePreferenceDomainFacts({
      requested: request.preferredVibes || [],
      collection,
      field: "vibes",
    }),
  };
  const requestedCount = PREFERENCE_DOMAINS.reduce(
    (sum, domain) => sum + domains[domain].requested.length,
    0
  );
  const matchedCount = PREFERENCE_DOMAINS.reduce(
    (sum, domain) => sum + domains[domain].matched.length,
    0
  );
  const overallMatchRatio = requestedCount > 0 ? roundRatio(matchedCount / requestedCount) : 1;

  return {
    domains,
    aggregate: {
      requestedCount,
      matchedCount,
      overallMatchRatio,
      level: classifyMatchRatio(overallMatchRatio, requestedCount),
      strongestDomain: getPreferenceExtremeDomain(domains, "strongest"),
      weakestDomain: getPreferenceExtremeDomain(domains, "weakest"),
      measuredScore: finiteOrNull(dimensions.preferenceFit?.score),
      direction: DIRECTIONALITY.HIGHER_IS_BETTER,
    },
  };
}

function derivePreferenceDomainFacts({ requested, collection, field }) {
  const requestedValues = stableStrings(requested);
  const contributorMap = buildContributorMap(collection, field, requestedValues);
  const matched = requestedValues.filter((value) => contributorMap[value]?.length > 0);
  const unmatched = requestedValues.filter((value) => !matched.includes(value));
  const matchRatio = requestedValues.length > 0 ? roundRatio(matched.length / requestedValues.length) : 1;

  return {
    requested: requestedValues,
    matched,
    unmatched,
    matchRatio,
    level: classifyMatchRatio(matchRatio, requestedValues.length),
    perfumeContributors: Object.fromEntries(
      matched.map((value) => [value, contributorMap[value]])
    ),
  };
}

function deriveCoverageFacts({ collection, boxSummary, seasonRows, catalogPerfumes, dimensions }) {
  const catalogDomains = getCatalogDomainValues(catalogPerfumes.length ? catalogPerfumes : collection);
  const seasonCounts = Object.fromEntries(
    seasonRows.map((row) => [row.id, row.strength])
  );
  const seasonRatios = Object.fromEntries(
    seasonRows.map((row) => [row.id, roundRatio(row.percent / 100)])
  );
  const domains = {
    seasons: deriveCoverageDomain({
      counts: seasonCounts,
      coveredValues: seasonRows.filter((row) => row.strength > 0).map((row) => row.id),
      universe: SEASON_IDS,
      ratios: seasonRatios,
    }),
    occasions: deriveCoverageDomain({
      counts: boxSummary.occasionCounts || {},
      coveredValues: boxSummary.occasions || [],
      universe: catalogDomains.occasions,
    }),
    vibes: deriveCoverageDomain({
      counts: boxSummary.vibeCounts || {},
      coveredValues: boxSummary.vibes || [],
      universe: catalogDomains.vibes,
    }),
    accords: deriveCoverageDomain({
      counts: getAccordCountsFromCollection(collection),
      coveredValues: Object.keys(boxSummary.accordMap || {}),
      universe: catalogDomains.accords,
    }),
  };

  return {
    domains,
    measuredScore: finiteOrNull(dimensions.coverage?.score),
    direction: DIRECTIONALITY.HIGHER_IS_BETTER,
  };
}

function deriveCoverageDomain({ counts, coveredValues, universe, ratios }) {
  const covered = stableStrings(coveredValues);
  const knownUniverse = stableStrings(universe);
  const missing = knownUniverse.filter((value) => !covered.includes(value));
  const safeCounts = sortCountObject(counts);
  const strongest = rankCountEntries(safeCounts).slice(0, 3);
  const weakest = knownUniverse
    .map((value) => ({
      value,
      count: roundNumber(safeCounts[value] || 0),
      ratio: ratios?.[value] ?? null,
    }))
    .sort((a, b) => a.count - b.count || compareStrings(a.value, b.value))
    .slice(0, 3);
  const breadth = knownUniverse.length > 0 ? roundRatio(covered.length / knownUniverse.length) : 1;
  const percent = breadth * 100;

  return {
    covered,
    missing,
    counts: safeCounts,
    ratios: ratios || Object.fromEntries(knownUniverse.map((value) => [value, breadthForValue(value, safeCounts)])),
    strongest,
    weakest,
    breadth,
    level: classifyCoveragePercent(percent),
  };
}

function deriveDiversityFacts({ collection, boxSummary, dimensions }) {
  const accordCounts = getAccordCountsFromCollection(collection);
  const seasonCounts = boxSummary.seasonStrengths || boxSummary.seasonCounts || {};
  const occasionCounts = boxSummary.occasionCounts || {};
  const vibeCounts = boxSummary.vibeCounts || {};
  const similarPairs = getSimilarPairs(collection);
  const dominantAccordShare = getDominantShare(accordCounts);
  const dominantSeasonShare = getDominantShare(seasonCounts);

  return {
    score: finiteOrNull(dimensions.diversity?.score),
    level: classifyQualityScore(dimensions.diversity?.score),
    direction: DIRECTIONALITY.HIGHER_IS_BETTER,
    accordSpread: entropyLikeSpread(accordCounts),
    seasonSpread: entropyLikeSpread(seasonCounts),
    occasionSpread: entropyLikeSpread(occasionCounts),
    vibeSpread: entropyLikeSpread(vibeCounts),
    dominantAccordShare,
    dominantSeasonShare,
    uniqueAccordCount: Object.keys(accordCounts).length,
    repeatedProfiles: getRepeatedProfiles(collection),
    mostSimilarPairs: similarPairs,
  };
}

function deriveVersatilityFacts({ collection, scentDna, dimensions }) {
  const dnaScores = scentDna?.scores || {};
  const contributorRows = collection
    .map((perfume) => ({
      perfumeId: perfume.id,
      contributionScore: getPerfumeVersatilityContribution(perfume),
    }))
    .sort((a, b) => b.contributionScore - a.contributionScore || a.perfumeId - b.perfumeId);

  return {
    score: finiteOrNull(dimensions.versatility?.score),
    level: classifyQualityScore(dimensions.versatility?.score),
    direction: DIRECTIONALITY.HIGHER_IS_BETTER,
    collectionAverage: finiteOrNull(dnaScores.versatility),
    highestContributorIds: contributorRows.slice(0, 3).map((item) => item.perfumeId),
    lowestContributorIds: [...contributorRows]
      .sort((a, b) => a.contributionScore - b.contributionScore || a.perfumeId - b.perfumeId)
      .slice(0, 3)
      .map((item) => item.perfumeId),
    seasonBalance: finiteOrNull(dnaScores.seasonBalance),
    occasionBreadth: finiteOrNull(dimensions.versatility?.components?.occasionBreadth),
    practicalCoverage: finiteOrNull(dimensions.versatility?.components?.dailyPracticality),
    missingDataCounts: {
      missingSeasonWeights: collection.filter((perfume) => !perfume.seasonWeights).length,
      missingOccasions: collection.filter((perfume) => !Array.isArray(perfume.occasions)).length,
      missingVibes: collection.filter((perfume) => !Array.isArray(perfume.vibes)).length,
    },
  };
}

function deriveCoherenceFacts({ collection, dimensions, boxSummary }) {
  const accordCounts = getAccordCountsFromCollection(collection);
  const dominantAccords = rankCountEntries(accordCounts).slice(0, 3);
  const supportingAccords = rankCountEntries(accordCounts).slice(3, 7);
  const averageSimilarity = finiteOrZero(
    dimensions.coherence?.diagnostics?.averagePairSimilarity,
    getAveragePairSimilarity(collection)
  );
  const concentration = finiteOrZero(
    dimensions.coherence?.diagnostics?.dominantAccordRatio,
    getDominantShare(accordCounts)
  );

  return {
    score: finiteOrNull(dimensions.coherence?.score),
    level: classifyQualityScore(dimensions.coherence?.score),
    direction: DIRECTIONALITY.HIGHER_IS_BETTER,
    dominantAccords,
    supportingAccords,
    outlierPerfumeIds: getOutlierPerfumeIds(collection, dominantAccords.map((item) => item.value)),
    focalPerfumeIds: getFocalPerfumeIds(collection, boxSummary),
    concentration: roundRatio(concentration),
    averagePairSimilarity: roundRatio(averageSimilarity),
    shape: classifyCoherenceShape({ concentration, averageSimilarity }),
  };
}

function deriveBudgetFacts({ request, metrics, dimensions }) {
  const provided = request.budget !== null && request.budget !== undefined;
  const budget = provided ? finiteOrNull(request.budget) : null;
  const spent = finiteOrZero(metrics.estimatedValue, 0);
  const remaining = provided ? roundNumber((budget || 0) - spent) : null;
  const utilization =
    provided && budget > 0
      ? roundRatio(spent / budget)
      : provided && budget === 0 && spent === 0
        ? 1
        : null;
  const exceeded = provided && budget !== null && spent > budget;

  return {
    provided,
    budget,
    spent: roundNumber(spent),
    remaining,
    utilization,
    efficiencyScore: finiteOrNull(dimensions.budgetEfficiency?.score),
    assessment: classifyBudgetUtilization(utilization, provided, exceeded),
    reachedEfficientBand:
      provided && Number.isFinite(utilization) ? utilization >= 0.6 && !exceeded : null,
    exceeded,
    direction: DIRECTIONALITY.HIGHER_IS_BETTER,
  };
}

function deriveRedundancyFacts({ collection, penalties, request, boxSummary }) {
  const penalty = penalties.redundancyPenalty || {};
  const accordCounts = getAccordCountsFromCollection(collection);
  const seasonCounts = boxSummary.seasonStrengths || boxSummary.seasonCounts || {};
  const magnitude = finiteOrNull(penalty.magnitude);

  return {
    penaltyScore: magnitude,
    level: classifyRedundancyMagnitude(magnitude),
    direction: DIRECTIONALITY.LOWER_IS_BETTER,
    dominantAccordConcentration: roundRatio(
      finiteOrZero(penalty.diagnostics?.dominantAccordRatio, getDominantShare(accordCounts))
    ),
    dominantSeasonConcentration: roundRatio(
      finiteOrZero(penalty.diagnostics?.seasonConcentration, getDominantShare(seasonCounts))
    ),
    similarPairs: getSimilarPairs(collection),
    repeatedAccords: rankCountEntries(accordCounts).filter((item) => item.count > 1),
    repeatedProfiles: getRepeatedProfiles(collection),
    avoidable: request.strategy?.id !== "signature" && (magnitude || 0) >= 60,
    strategyContext: getRedundancyExpectedness(request.strategy?.id, magnitude),
  };
}

function deriveIdentityFacts({ collection, request, dimensions, boxSummary }) {
  const measuredPrimaryTrait = getMeasuredIdentityTrait(dimensions, request.strategy?.id);
  const anchorPerfumeIds = getFocalPerfumeIds(collection, boxSummary);
  const requestedStrategy = request.strategy?.id || null;

  return {
    strategyId: requestedStrategy,
    primaryTrait: measuredPrimaryTrait,
    secondaryTraits: getSecondaryIdentityTraits(dimensions, measuredPrimaryTrait),
    signatureFocus: finiteOrNull(dimensions.signatureFocus?.score),
    explorationLevel: classifyQualityScore(dimensions.diversity?.score),
    practicalityLevel: classifyQualityScore(dimensions.versatility?.score),
    balanceLevel: classifyQualityScore(dimensions.coverage?.score),
    identityStrength: finiteOrNull(getIdentityStrength(dimensions, measuredPrimaryTrait)),
    anchorPerfumeIds,
    alignment: {
      requestedStrategy,
      measuredPrimaryTrait,
      alignmentLevel: classifyIdentityAlignment(requestedStrategy, measuredPrimaryTrait, dimensions),
    },
  };
}

function deriveRefinementFacts({ result }) {
  const diagnostics = result.diagnostics || {};
  const refinementResult = result.refinementResult || null;
  const requested = result.mode === "best";
  const invoked = Boolean(refinementResult);
  const fallbackUsed = Boolean(diagnostics.fallbackUsed);

  return {
    requested,
    eligible: Boolean(diagnostics.refinementEligible),
    invoked,
    status: getRefinementFactStatus({ requested, invoked, fallbackUsed, refinementResult }),
    appliedSwapCount: refinementResult?.appliedMoves?.length || 0,
    initialScore: finiteOrNull(refinementResult?.initialQuality?.overallScore),
    finalScore: finiteOrNull(refinementResult?.qualityResult?.overallScore),
    scoreImprovement: finiteOrNull(refinementResult?.diagnostics?.scoreImprovement),
    improved: (refinementResult?.diagnostics?.scoreImprovement || 0) > 0,
    fallbackUsed,
    fallbackReason: diagnostics.fallbackReason || null,
    swaps: (refinementResult?.appliedMoves || []).map((move, index) => ({
      index,
      removePerfumeId: move.removePerfumeId,
      addPerfumeId: move.addPerfumeId,
      beforeScore: finiteOrNull(move.beforeScore),
      afterScore: finiteOrNull(move.afterScore),
      scoreDelta:
        Number.isFinite(move.beforeScore) && Number.isFinite(move.afterScore)
          ? roundNumber(move.afterScore - move.beforeScore)
          : null,
      dimensionChanges: {
        preferenceFit: {
          direction: DIRECTIONALITY.HIGHER_IS_BETTER,
          after: finiteOrNull(move.preferenceFit),
        },
        redundancyPenalty: {
          direction: DIRECTIONALITY.LOWER_IS_BETTER,
          after: finiteOrNull(move.redundancyPenalty),
        },
      },
    })),
  };
}

function deriveContributorFacts(context, preferenceMatch, coverage, redundancy, identity) {
  return {
    preferenceLeaders: rankPreferenceContributors(context.collection, preferenceMatch),
    coverageLeaders: rankCoverageContributors(context.collection, coverage),
    versatilityLeaders: rankVersatilityContributors(context.collection),
    signatureAnchors: identity.anchorPerfumeIds.map((perfumeId, index) => ({
      perfumeId,
      rank: index + 1,
      contributions: ["signature_anchor"],
      evidence: {
        points: context.collection.find((perfume) => perfume.id === perfumeId)?.points || 0,
        locked: (context.request.lockedPerfumeIds || []).includes(perfumeId),
      },
    })),
    diversityContributors: rankDiversityContributors(context.collection),
    redundancyDrivers: rankRedundancyDrivers(context.collection, redundancy),
  };
}

function deriveTradeoffFacts(context, diversity, coherence, budget, preferenceMatch) {
  const tradeoffs = [];
  const dimensionScores = context.qualityResult?.diagnostics?.rawDimensionScores || {};
  const gap = (first, second) => Math.abs((dimensionScores[first] || 0) - (dimensionScores[second] || 0));

  if (
    (dimensionScores.coverage || 0) >= 70 &&
    (dimensionScores.coherence || 0) <= 45 &&
    gap("coverage", "coherence") >= TRADEOFF_EVIDENCE_THRESHOLDS.DIMENSION_GAP
  ) {
    tradeoffs.push(tradeoff("coverage_vs_coherence", "coverage", "coherence", gap("coverage", "coherence"), {
      coverageScore: finiteOrNull(dimensionScores.coverage),
      coherenceScore: finiteOrNull(dimensionScores.coherence),
    }));
  }

  if (
    (dimensionScores.diversity || 0) >= 70 &&
    (dimensionScores.signatureFocus || 0) <= 45
  ) {
    tradeoffs.push(tradeoff("diversity_vs_signature_focus", "diversity", "signatureFocus", gap("diversity", "signatureFocus"), {
      diversityScore: finiteOrNull(dimensionScores.diversity),
      signatureFocusScore: finiteOrNull(dimensionScores.signatureFocus),
    }));
  }

  if (
    preferenceMatch.aggregate.requestedCount > 0 &&
    preferenceMatch.aggregate.overallMatchRatio < 1 &&
    (dimensionScores.coverage || 0) >= 65
  ) {
    tradeoffs.push(tradeoff("preference_fit_vs_balance", "coverage", "preferenceFit", roundNumber((1 - preferenceMatch.aggregate.overallMatchRatio) * 100), {
      unmatchedPreferenceCount:
        preferenceMatch.aggregate.requestedCount - preferenceMatch.aggregate.matchedCount,
      coverageScore: finiteOrNull(dimensionScores.coverage),
    }));
  }

  if (
    budget.provided &&
    budget.assessment === BUDGET_ASSESSMENTS.UNDERUSED &&
    (context.qualityResult?.overallScore || 0) < 60
  ) {
    tradeoffs.push(tradeoff("budget_vs_quality", "budgetEfficiency", "quality", roundNumber((1 - (budget.utilization || 0)) * 100), {
      utilization: budget.utilization,
      qualityScore: finiteOrNull(context.qualityResult?.overallScore),
    }));
  }

  return tradeoffs
    .sort((a, b) => b.strength - a.strength || compareStrings(a.type, b.type))
    .slice(0, MAX_TRADEOFFS);
}

function deriveWarnings({ context, preferenceMatch, coverage, budget, redundancy, refinement }) {
  const warnings = [];
  const add = (code, severity, evidence = {}) => {
    if (!warnings.some((warning) => warning.code === code)) {
      warnings.push({ code, severity, evidence });
    }
  };

  if (!context.derivable) {
    add(
      context.result.status === "impossible" ? "impossible_composition" : "invalid_composition_result",
      "warning",
      {
        status: context.result.status || null,
        violations: context.constraintResult?.violations || [],
      }
    );
    return warnings;
  }

  if (context.result.status === "partial") {
    add("partial_collection", "notice", {
      perfumeCount: context.collection.length,
      targetSlots: context.request.targetSlots,
    });
  }

  if (context.collection.length === context.request.minSlots) {
    add("minimum_only", "info", {
      perfumeCount: context.collection.length,
      minimumSlots: context.request.minSlots,
    });
  }

  if (preferenceMatch.aggregate.requestedCount > preferenceMatch.aggregate.matchedCount) {
    add("unmatched_preferences", "notice", {
      unmatchedCount:
        preferenceMatch.aggregate.requestedCount - preferenceMatch.aggregate.matchedCount,
    });
  }

  const weakSeasonCount = coverage.domains.seasons.weakest.filter(
    (item) => item.count > 0 && item.count < 30
  ).length;
  if (weakSeasonCount > 0) {
    add("weak_season_coverage", "notice", {
      weakValues: coverage.domains.seasons.weakest
        .filter((item) => item.count > 0 && item.count < 30)
        .map((item) => item.value),
    });
  }

  if (
    coverage.domains.occasions.covered.length > 0 &&
    coverage.domains.occasions.breadth < 0.35
  ) {
    add("weak_occasion_coverage", "notice", {
      breadth: coverage.domains.occasions.breadth,
    });
  }

  if (redundancy.penaltyScore >= 70 && redundancy.strategyContext !== "strategy_aligned") {
    add("high_redundancy", "notice", {
      penaltyScore: redundancy.penaltyScore,
    });
  }

  if (budget.provided && budget.assessment === BUDGET_ASSESSMENTS.UNDERUSED) {
    add("low_budget_utilization", "info", {
      utilization: budget.utilization,
    });
  }

  if (refinement.status === REFINEMENT_FACT_STATUSES.ITERATION_LIMITED) {
    add("refinement_iteration_limit", "notice", {
      appliedSwapCount: refinement.appliedSwapCount,
    });
  }

  if (refinement.fallbackUsed) {
    add("refinement_fallback", "notice", {
      fallbackReason: refinement.fallbackReason,
    });
  }

  const missingData = context.collection.filter(
    (perfume) =>
      !Array.isArray(perfume.accords) ||
      !Array.isArray(perfume.occasions) ||
      !Array.isArray(perfume.vibes) ||
      !Array.isArray(perfume.seasons)
  );
  if (missingData.length > 0) {
    add("missing_catalog_data", "notice", {
      perfumeIds: missingData.map((perfume) => perfume.id).sort((a, b) => a - b),
    });
  }

  return warnings.slice(0, MAX_WARNINGS);
}

function deriveDiagnostics({
  context,
  preferenceMatch,
  tradeoffs,
  warnings,
  unknownIds,
  derivable,
}) {
  const sections = [
    "summary",
    "preferenceMatch",
    "coverage",
    "diversity",
    "versatility",
    "coherence",
    "budget",
    "redundancy",
    "identity",
    "refinement",
    "contributors",
    "tradeoffs",
    "warnings",
  ];

  return {
    derivable,
    sourceCompositionStatus: context.result.status || null,
    sourceMode: context.result.mode || null,
    sourceStrategy: context.request.strategy?.id || null,
    sourceFinalCollectionIds: context.collection.map((perfume) => perfume.id),
    sourceQualityScore: finiteOrNull(context.qualityResult?.overallScore),
    catalogRecordsMatched: context.collection.length - unknownIds.length,
    catalogRecordsMissing: unknownIds.length,
    requestedPreferenceCounts: {
      seasons: preferenceMatch.domains.seasons.requested.length,
      occasions: preferenceMatch.domains.occasions.requested.length,
      vibes: preferenceMatch.domains.vibes.requested.length,
    },
    derivedSectionNames: derivable ? sections : ["summary", "budget", "refinement", "warnings"],
    unavailableSectionNames: derivable
      ? []
      : sections.filter((section) => !["summary", "budget", "refinement", "warnings"].includes(section)),
    thresholdPolicyVersion: REASONING_THRESHOLD_POLICY_VERSION,
    contributorRankingRules: {
      primary: "measured_metadata_count",
      tieBreak: "lower_perfume_id",
      maxItems: MAX_CONTRIBUTORS,
    },
    tradeoffCandidatesEvaluated: 4,
    tradeoffsEmitted: tradeoffs.length,
    warningsEmitted: warnings.length,
    serializationSafe: true,
    unknownIds,
    missingDataCounts: {
      missingSeasonWeights: context.collection.filter((perfume) => !perfume.seasonWeights).length,
      missingAccords: context.collection.filter((perfume) => !Array.isArray(perfume.accords)).length,
      missingNotes: context.collection.filter((perfume) => getPerfumeNoteIds(perfume).length === 0).length,
    },
    coverageDomains: COVERAGE_DOMAINS,
    positiveDimensionIds: POSITIVE_DIMENSION_IDS,
    penaltyDimensionIds: PENALTY_DIMENSION_IDS,
  };
}

function emptyPreferenceFacts() {
  const emptyDomain = () => ({
    requested: [],
    matched: [],
    unmatched: [],
    matchRatio: 1,
    level: MATCH_LEVELS.NONE_REQUESTED,
    perfumeContributors: {},
  });

  return {
    domains: {
      seasons: emptyDomain(),
      occasions: emptyDomain(),
      vibes: emptyDomain(),
    },
    aggregate: {
      requestedCount: 0,
      matchedCount: 0,
      overallMatchRatio: 1,
      level: MATCH_LEVELS.NONE_REQUESTED,
      strongestDomain: null,
      weakestDomain: null,
      measuredScore: null,
      direction: DIRECTIONALITY.HIGHER_IS_BETTER,
    },
  };
}

function emptyCoverageFacts() {
  const emptyDomain = () => ({
    covered: [],
    missing: [],
    counts: {},
    ratios: {},
    strongest: [],
    weakest: [],
    breadth: 0,
    level: null,
  });

  return {
    domains: {
      seasons: emptyDomain(),
      occasions: emptyDomain(),
      vibes: emptyDomain(),
      accords: emptyDomain(),
    },
    measuredScore: null,
    direction: DIRECTIONALITY.HIGHER_IS_BETTER,
  };
}

function emptyDiversityFacts() {
  return {
    score: null,
    level: null,
    direction: DIRECTIONALITY.HIGHER_IS_BETTER,
    accordSpread: null,
    seasonSpread: null,
    occasionSpread: null,
    vibeSpread: null,
    dominantAccordShare: null,
    dominantSeasonShare: null,
    uniqueAccordCount: 0,
    repeatedProfiles: [],
    mostSimilarPairs: [],
  };
}

function emptyVersatilityFacts() {
  return {
    score: null,
    level: null,
    direction: DIRECTIONALITY.HIGHER_IS_BETTER,
    collectionAverage: null,
    highestContributorIds: [],
    lowestContributorIds: [],
    seasonBalance: null,
    occasionBreadth: null,
    practicalCoverage: null,
    missingDataCounts: {
      missingSeasonWeights: 0,
      missingOccasions: 0,
      missingVibes: 0,
    },
  };
}

function emptyCoherenceFacts() {
  return {
    score: null,
    level: null,
    direction: DIRECTIONALITY.HIGHER_IS_BETTER,
    dominantAccords: [],
    supportingAccords: [],
    outlierPerfumeIds: [],
    focalPerfumeIds: [],
    concentration: null,
    averagePairSimilarity: null,
    shape: null,
  };
}

function emptyRedundancyFacts() {
  return {
    penaltyScore: null,
    level: null,
    direction: DIRECTIONALITY.LOWER_IS_BETTER,
    dominantAccordConcentration: null,
    dominantSeasonConcentration: null,
    similarPairs: [],
    repeatedAccords: [],
    repeatedProfiles: [],
    avoidable: false,
    strategyContext: null,
  };
}

function emptyIdentityFacts(request) {
  return {
    strategyId: request?.strategy?.id || null,
    primaryTrait: null,
    secondaryTraits: [],
    signatureFocus: null,
    explorationLevel: null,
    practicalityLevel: null,
    balanceLevel: null,
    identityStrength: null,
    anchorPerfumeIds: [],
    alignment: {
      requestedStrategy: request?.strategy?.id || null,
      measuredPrimaryTrait: null,
      alignmentLevel: null,
    },
  };
}

function emptyContributorFacts() {
  return {
    preferenceLeaders: [],
    coverageLeaders: [],
    versatilityLeaders: [],
    signatureAnchors: [],
    diversityContributors: [],
    redundancyDrivers: [],
  };
}

function buildContributorMap(collection, field, requestedValues) {
  return Object.fromEntries(
    requestedValues.map((value) => [
      value,
      collection
        .filter((perfume) => (perfume[field] || []).map(normalizeLabel).includes(value))
        .map((perfume) => perfume.id)
        .sort((a, b) => a - b),
    ])
  );
}

function getCatalogDomainValues(perfumes) {
  return {
    seasons: SEASON_IDS,
    occasions: stableStrings(perfumes.flatMap((perfume) => perfume.occasions || [])),
    vibes: stableStrings(perfumes.flatMap((perfume) => perfume.vibes || [])),
    accords: stableStrings(perfumes.flatMap((perfume) => perfume.accords || [])),
  };
}

function getAccordCountsFromCollection(collection) {
  return sortCountObject(
    collection.reduce((counts, perfume) => {
      (perfume.accords || []).forEach((accord) => {
        const key = normalizeLabel(accord);
        counts[key] = (counts[key] || 0) + 1;
      });
      return counts;
    }, {})
  );
}

function rankPreferenceContributors(collection, preferenceMatch) {
  return collection
    .map((perfume) => {
      const matchedSeasons = getMatchedValues(perfume.seasons, preferenceMatch.domains.seasons.matched);
      const matchedOccasions = getMatchedValues(perfume.occasions, preferenceMatch.domains.occasions.matched);
      const matchedVibes = getMatchedValues(perfume.vibes, preferenceMatch.domains.vibes.matched);
      const count = matchedSeasons.length + matchedOccasions.length + matchedVibes.length;

      return {
        perfumeId: perfume.id,
        rankScore: count,
        contributions: count > 0 ? ["preference_match"] : [],
        evidence: {
          matchedSeasons,
          matchedOccasions,
          matchedVibes,
        },
      };
    })
    .filter((item) => item.rankScore > 0)
    .sort(compareContributor)
    .slice(0, MAX_CONTRIBUTORS)
    .map(addRank);
}

function rankCoverageContributors(collection, coverage) {
  const weakestValues = new Set(
    Object.values(coverage.domains)
      .flatMap((domain) => domain.weakest || [])
      .map((item) => item.value)
  );

  return collection
    .map((perfume) => {
      const seasons = getMatchedValues(perfume.seasons, [...weakestValues]);
      const occasions = getMatchedValues(perfume.occasions, [...weakestValues]);
      const vibes = getMatchedValues(perfume.vibes, [...weakestValues]);
      const accords = getMatchedValues(perfume.accords, [...weakestValues]);
      const rankScore = seasons.length + occasions.length + vibes.length + accords.length;

      return {
        perfumeId: perfume.id,
        rankScore,
        contributions: rankScore > 0 ? ["coverage_support"] : [],
        evidence: {
          seasons,
          occasions,
          vibes,
          accords,
        },
      };
    })
    .filter((item) => item.rankScore > 0)
    .sort(compareContributor)
    .slice(0, MAX_CONTRIBUTORS)
    .map(addRank);
}

function rankVersatilityContributors(collection) {
  return collection
    .map((perfume) => ({
      perfumeId: perfume.id,
      rankScore: getPerfumeVersatilityContribution(perfume),
      contributions: ["versatility"],
      evidence: {
        seasonCount: (perfume.seasons || []).length,
        occasionCount: (perfume.occasions || []).length,
        vibeCount: (perfume.vibes || []).length,
        seasonWeightTotal: sumNumbers(Object.values(perfume.seasonWeights || {})),
      },
    }))
    .filter((item) => item.rankScore > 0)
    .sort(compareContributor)
    .slice(0, MAX_CONTRIBUTORS)
    .map(addRank);
}

function rankDiversityContributors(collection) {
  const accordCounts = getAccordCountsFromCollection(collection);

  return collection
    .map((perfume) => {
      const rareAccords = (perfume.accords || [])
        .map(normalizeLabel)
        .filter((accord) => accordCounts[accord] === 1)
        .sort();

      return {
        perfumeId: perfume.id,
        rankScore: rareAccords.length,
        contributions: rareAccords.length > 0 ? ["unique_accords"] : [],
        evidence: {
          accords: rareAccords,
        },
      };
    })
    .filter((item) => item.rankScore > 0)
    .sort(compareContributor)
    .slice(0, MAX_CONTRIBUTORS)
    .map(addRank);
}

function rankRedundancyDrivers(collection, redundancy) {
  const pairCounts = {};
  redundancy.similarPairs.forEach((pair) => {
    pair.perfumeIds.forEach((id) => {
      pairCounts[id] = (pairCounts[id] || 0) + 1;
    });
  });

  return Object.entries(pairCounts)
    .map(([perfumeId, count]) => ({
      perfumeId: Number(perfumeId),
      rankScore: count,
      contributions: ["similar_pairs"],
      evidence: {
        similarityCount: count,
      },
    }))
    .sort(compareContributor)
    .slice(0, MAX_CONTRIBUTORS)
    .map(addRank);
}

function compareContributor(first, second) {
  return second.rankScore - first.rankScore || first.perfumeId - second.perfumeId;
}

function addRank(item, index) {
  const publicItem = { ...item };
  delete publicItem.rankScore;

  return {
    ...publicItem,
    rank: index + 1,
  };
}

function getMeasuredIdentityTrait(dimensions, strategyId) {
  const scores = {
    balanced: average([
      dimensions.coverage?.score,
      dimensions.coherence?.score,
      dimensions.versatility?.score,
    ]),
    versatile: dimensions.versatility?.score || 0,
    exploratory: dimensions.diversity?.score || 0,
    signature_focused: dimensions.signatureFocus?.score || 0,
  };
  const strategyTrait = strategyToTrait(strategyId);
  const ranked = Object.entries(scores).sort(
    ([firstTrait, firstScore], [secondTrait, secondScore]) =>
      secondScore - firstScore || traitPriority(firstTrait, strategyTrait) - traitPriority(secondTrait, strategyTrait)
  );

  return ranked[0]?.[0] || IDENTITY_TRAITS.BALANCED;
}

function getSecondaryIdentityTraits(dimensions, primaryTrait) {
  return [
    [IDENTITY_TRAITS.BALANCED, average([dimensions.coverage?.score, dimensions.coherence?.score])],
    [IDENTITY_TRAITS.VERSATILE, dimensions.versatility?.score || 0],
    [IDENTITY_TRAITS.EXPLORATORY, dimensions.diversity?.score || 0],
    [IDENTITY_TRAITS.SIGNATURE_FOCUSED, dimensions.signatureFocus?.score || 0],
  ]
    .filter(([trait]) => trait !== primaryTrait)
    .sort((a, b) => b[1] - a[1] || compareStrings(a[0], b[0]))
    .slice(0, 2)
    .map(([trait]) => trait);
}

function getIdentityStrength(dimensions, primaryTrait) {
  if (primaryTrait === IDENTITY_TRAITS.BALANCED) {
    return average([dimensions.coverage?.score, dimensions.coherence?.score, dimensions.versatility?.score]);
  }
  if (primaryTrait === IDENTITY_TRAITS.VERSATILE) return dimensions.versatility?.score || 0;
  if (primaryTrait === IDENTITY_TRAITS.EXPLORATORY) return dimensions.diversity?.score || 0;
  if (primaryTrait === IDENTITY_TRAITS.SIGNATURE_FOCUSED) return dimensions.signatureFocus?.score || 0;
  return null;
}

function classifyIdentityAlignment(requestedStrategy, measuredPrimaryTrait, dimensions) {
  const requestedTrait = strategyToTrait(requestedStrategy);

  if (!requestedTrait || !measuredPrimaryTrait) return null;
  if (requestedTrait === measuredPrimaryTrait) return "strong";

  const requestedScore = getIdentityStrength(dimensions, requestedTrait);
  const measuredScore = getIdentityStrength(dimensions, measuredPrimaryTrait);
  if ((measuredScore || 0) - (requestedScore || 0) <= 10) return "partial";
  return "weak";
}

function strategyToTrait(strategyId) {
  return {
    balanced: IDENTITY_TRAITS.BALANCED,
    versatile: IDENTITY_TRAITS.VERSATILE,
    explorer: IDENTITY_TRAITS.EXPLORATORY,
    signature: IDENTITY_TRAITS.SIGNATURE_FOCUSED,
  }[strategyId];
}

function traitPriority(trait, strategyTrait) {
  return trait === strategyTrait ? 0 : 1;
}

function getRefinementFactStatus({ requested, invoked, fallbackUsed, refinementResult }) {
  if (!requested) return REFINEMENT_FACT_STATUSES.NOT_REQUESTED;
  if (fallbackUsed) return REFINEMENT_FACT_STATUSES.FALLBACK_USED;
  if (!invoked) return REFINEMENT_FACT_STATUSES.NOT_ELIGIBLE;
  if (refinementResult?.status === "refined") return REFINEMENT_FACT_STATUSES.IMPROVED;
  if (refinementResult?.status === "iteration_limit") return REFINEMENT_FACT_STATUSES.ITERATION_LIMITED;
  return REFINEMENT_FACT_STATUSES.UNCHANGED;
}

function getPreferenceExtremeDomain(domains, type) {
  const candidates = PREFERENCE_DOMAINS
    .map((domain) => ({
      domain,
      requestedCount: domains[domain].requested.length,
      matchRatio: domains[domain].matchRatio,
    }))
    .filter((item) => item.requestedCount > 0);

  if (candidates.length === 0) return null;

  return candidates.sort((a, b) =>
    type === "strongest"
      ? b.matchRatio - a.matchRatio || compareStrings(a.domain, b.domain)
      : a.matchRatio - b.matchRatio || compareStrings(a.domain, b.domain)
  )[0].domain;
}

function getSimilarPairs(collection) {
  const pairs = [];
  for (let firstIndex = 0; firstIndex < collection.length; firstIndex += 1) {
    for (let secondIndex = firstIndex + 1; secondIndex < collection.length; secondIndex += 1) {
      const first = collection[firstIndex];
      const second = collection[secondIndex];
      const similarity = getPerfumeSimilarity(first, second);
      if (similarity > 0) {
        pairs.push({
          perfumeIds: [Math.min(first.id, second.id), Math.max(first.id, second.id)],
          similarity: roundRatio(similarity),
        });
      }
    }
  }

  return pairs
    .sort((a, b) => b.similarity - a.similarity || a.perfumeIds[0] - b.perfumeIds[0] || a.perfumeIds[1] - b.perfumeIds[1])
    .slice(0, MAX_SIMILAR_PAIRS);
}

function getPerfumeSimilarity(firstPerfume, secondPerfume) {
  const first = new Set(getSimilarityValues(firstPerfume));
  const second = new Set(getSimilarityValues(secondPerfume));
  const union = new Set([...first, ...second]);

  if (union.size === 0) return 0;

  let intersection = 0;
  first.forEach((value) => {
    if (second.has(value)) intersection += 1;
  });

  return intersection / union.size;
}

function getSimilarityValues(perfume) {
  return stableStrings([
    ...(perfume.accords || []).map((value) => `accord:${value}`),
    ...(perfume.vibes || []).map((value) => `vibe:${value}`),
    ...(perfume.occasions || []).map((value) => `occasion:${value}`),
    ...(perfume.seasons || []).map((value) => `season:${value}`),
  ]);
}

function getAveragePairSimilarity(collection) {
  const pairs = getSimilarPairs(collection);
  return pairs.length > 0 ? average(pairs.map((pair) => pair.similarity)) : 0;
}

function getOutlierPerfumeIds(collection, dominantAccords) {
  if (dominantAccords.length === 0) return [];
  return collection
    .filter(
      (perfume) =>
        !getMatchedValues(perfume.accords, dominantAccords).length &&
        getAverageSimilarityToOthers(perfume, collection) < 0.2
    )
    .map((perfume) => perfume.id)
    .sort((a, b) => a - b);
}

function getAverageSimilarityToOthers(perfume, collection) {
  const others = collection.filter((item) => item.id !== perfume.id);
  return others.length > 0
    ? average(others.map((other) => getPerfumeSimilarity(perfume, other)))
    : 0;
}

function getFocalPerfumeIds(collection, boxSummary) {
  const accordCounts = getAccordCountsFromCollection(collection);
  const dominantAccords = rankCountEntries(accordCounts).slice(0, 3).map((item) => item.value);
  const vibeCounts = boxSummary?.vibeCounts || {};
  const dominantVibes = rankCountEntries(vibeCounts).slice(0, 3).map((item) => item.value);

  return collection
    .map((perfume) => ({
      perfumeId: perfume.id,
      score:
        (perfume.points || 0) * 10 +
        getMatchedValues(perfume.accords, dominantAccords).length * 8 +
        getMatchedValues(perfume.vibes, dominantVibes).length * 4,
    }))
    .sort((a, b) => b.score - a.score || a.perfumeId - b.perfumeId)
    .slice(0, 3)
    .map((item) => item.perfumeId);
}

function getRepeatedProfiles(collection) {
  const profileCounts = {};
  collection.forEach((perfume) => {
    const key = stableStrings([
      ...(perfume.accords || []).slice(0, 3),
      ...(perfume.vibes || []).slice(0, 2),
    ]).join("|");
    if (key) {
      profileCounts[key] = profileCounts[key] || [];
      profileCounts[key].push(perfume.id);
    }
  });

  return Object.entries(profileCounts)
    .filter(([, ids]) => ids.length > 1)
    .map(([profileKey, ids]) => ({
      profileKey,
      perfumeIds: ids.sort((a, b) => a - b),
      count: ids.length,
    }))
    .sort((a, b) => b.count - a.count || compareStrings(a.profileKey, b.profileKey));
}

function getPerfumeVersatilityContribution(perfume) {
  return roundNumber(
    (perfume.seasons || []).length * 6 +
      (perfume.occasions || []).length * 4 +
      (perfume.vibes || []).length * 2 +
      sumNumbers(Object.values(perfume.seasonWeights || {})) * 0.5
  );
}

function classifyCoherenceShape({ concentration, averageSimilarity }) {
  if (concentration >= 0.58 && averageSimilarity >= 0.42) return COHERENCE_SHAPES.FOCUSED;
  if (concentration >= 0.24 && concentration <= 0.5 && averageSimilarity >= 0.16) {
    return COHERENCE_SHAPES.BALANCED;
  }
  if (averageSimilarity < 0.12 && concentration < 0.24) return COHERENCE_SHAPES.FRAGMENTED;
  return COHERENCE_SHAPES.VARIED;
}

function getRedundancyExpectedness(strategyId, magnitude) {
  if (!Number.isFinite(magnitude)) return null;
  if (strategyId === "signature" && magnitude <= 70) return "strategy_aligned";
  if (magnitude <= 55) return "acceptable";
  return "unexpected";
}

function tradeoff(type, gainedDimension, sacrificedDimension, strength, evidence) {
  return {
    type,
    gainedDimension,
    sacrificedDimension,
    strength: roundNumber(strength),
    evidence,
  };
}

function breadthForValue(value, counts) {
  const total = sumNumbers(Object.values(counts));
  return total > 0 ? roundRatio((counts[value] || 0) / total) : 0;
}

function entropyLikeSpread(counts) {
  const values = Object.values(counts || {}).filter((value) => value > 0);
  if (values.length <= 1) return 0;
  const total = sumNumbers(values);
  const entropy = values.reduce((sum, count) => {
    const probability = count / total;
    return sum - probability * Math.log2(probability);
  }, 0);
  return roundNumber((entropy / Math.log2(values.length)) * 100);
}

function getDominantShare(counts) {
  const values = Object.values(counts || {}).filter((value) => value > 0);
  const total = sumNumbers(values);
  return total > 0 ? roundRatio(Math.max(...values) / total) : 0;
}

function rankCountEntries(counts) {
  return Object.entries(counts || {})
    .map(([value, count]) => ({ value, count: roundNumber(count) }))
    .sort((a, b) => b.count - a.count || compareStrings(a.value, b.value));
}

function sortCountObject(counts) {
  return Object.fromEntries(
    Object.entries(counts || {})
      .map(([key, value]) => [normalizeLabel(key), roundNumber(value)])
      .filter(([, value]) => Number.isFinite(value))
      .sort(([first], [second]) => compareStrings(first, second))
  );
}

function getMatchedValues(values, targets) {
  const targetSet = new Set(stableStrings(targets));
  return stableStrings(values).filter((value) => targetSet.has(value));
}

function buildCatalogById(catalog) {
  return catalog.reduce((map, perfume) => {
    if (Number.isInteger(perfume?.id) && !map.has(perfume.id)) {
      map.set(perfume.id, perfume);
    }
    return map;
  }, new Map());
}

function stablePerfumes(perfumes) {
  return Array.isArray(perfumes)
    ? [...perfumes]
        .filter((perfume) => perfume && typeof perfume === "object" && Number.isInteger(perfume.id))
        .sort((a, b) => a.id - b.id)
    : [];
}

function stableStrings(values) {
  return [...new Set((values || []).map(normalizeLabel).filter(Boolean))].sort();
}

function compareStrings(first, second) {
  if (first < second) return -1;
  if (first > second) return 1;
  return 0;
}

function normalizeLabel(value) {
  return String(value || "").trim().toLowerCase().replace(/\s+/g, " ");
}

function average(values) {
  const finiteValues = values.filter((value) => Number.isFinite(value));
  return finiteValues.length > 0 ? sumNumbers(finiteValues) / finiteValues.length : 0;
}

function sumNumbers(values) {
  return values
    .filter((value) => Number.isFinite(value))
    .reduce((sum, value) => sum + value, 0);
}

function finiteOrNull(value) {
  return Number.isFinite(value) ? roundNumber(value) : null;
}

function finiteOrZero(value, fallback = 0) {
  return Number.isFinite(value) ? value : fallback;
}

function safeNumber(value) {
  return Number.isFinite(value) ? value : null;
}

function roundRatio(value) {
  return Number.isFinite(value) ? Math.round(value * 10000) / 10000 : null;
}

function roundNumber(value) {
  return Number.isFinite(value) ? Math.round(value * 100) / 100 : value;
}

function sanitizeSerializable(value) {
  return JSON.parse(
    JSON.stringify(value, (_key, entry) => {
      if (entry === undefined) return null;
      if (typeof entry === "number" && !Number.isFinite(entry)) return null;
      return entry;
    })
  );
}
