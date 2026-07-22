const MAX_STRENGTHS = 6;
const MAX_WEAKNESSES = 6;
const MAX_RECOMMENDATIONS = 6;
const MAX_HIGHLIGHTS = 8;

export const COMPOSER_EXPLANATION_SEVERITIES = Object.freeze({
  POSITIVE: "positive",
  NEUTRAL: "neutral",
  NOTICE: "notice",
  WARNING: "warning",
});

export const COMPOSER_EXPLANATION_PRIORITIES = Object.freeze({
  HIGH: "high",
  MEDIUM: "medium",
  LOW: "low",
});

export const COMPOSER_HIGHLIGHT_REASONS = Object.freeze({
  COVERAGE_ANCHOR: "coverage_anchor",
  PREFERENCE_ANCHOR: "preference_anchor",
  VERSATILITY_ANCHOR: "versatility_anchor",
  SIGNATURE_ANCHOR: "signature_anchor",
  DIVERSITY_ANCHOR: "diversity_anchor",
  REDUNDANCY_DRIVER: "redundancy_driver",
});

export function deriveComposerExplanations({ reasoningFacts } = {}) {
  const facts = reasoningFacts || {};
  const explainable = Boolean(facts && typeof facts === "object" && facts.summary);
  const headline = deriveHeadline(facts, explainable);
  const strengths = explainable ? deriveStrengths(facts) : [];
  const weaknesses = explainable ? deriveWeaknesses(facts) : [];
  const tradeoffs = explainable ? deriveTradeoffExplanations(facts) : [];
  const recommendations = explainable ? deriveRecommendations(facts) : [];
  const highlights = explainable ? deriveHighlights(facts) : [];
  const diagnostics = deriveDiagnostics({
    facts,
    explainable,
    headline,
    strengths,
    weaknesses,
    tradeoffs,
    recommendations,
    highlights,
  });

  return sanitizeSerializable({
    explainable,
    headline,
    strengths,
    weaknesses,
    tradeoffs,
    recommendations,
    highlights,
    diagnostics,
  });
}

function deriveHeadline(facts, explainable) {
  if (!explainable) {
    return explanation("invalid_reasoning_facts", COMPOSER_EXPLANATION_SEVERITIES.WARNING, {});
  }

  if (facts.compositionStatus === "impossible") {
    return explanation("impossible_request", COMPOSER_EXPLANATION_SEVERITIES.WARNING, {
      status: facts.compositionStatus,
      warningCodes: getWarningCodes(facts),
    });
  }

  if (facts.compositionStatus === "failed") {
    return explanation("invalid_composition_result", COMPOSER_EXPLANATION_SEVERITIES.WARNING, {
      status: facts.compositionStatus,
      warningCodes: getWarningCodes(facts),
    });
  }

  if (facts.compositionStatus === "partial") {
    return explanation("valid_partial_collection", COMPOSER_EXPLANATION_SEVERITIES.NOTICE, {
      perfumeCount: facts.summary?.perfumeCount ?? null,
      targetSlots: facts.summary?.targetSlots ?? null,
      minimumReached: Boolean(facts.summary?.minimumReached),
    });
  }

  if (facts.compositionStatus === "completed") {
    return explanation("collection_completed", COMPOSER_EXPLANATION_SEVERITIES.POSITIVE, {
      perfumeCount: facts.summary?.perfumeCount ?? null,
      targetSlots: facts.summary?.targetSlots ?? null,
      qualityScore: facts.summary?.qualityScore ?? null,
    });
  }

  return explanation("composition_status_unknown", COMPOSER_EXPLANATION_SEVERITIES.NOTICE, {
    status: facts.compositionStatus || null,
  });
}

function deriveStrengths(facts) {
  if (!facts.derivable) {
    return [];
  }

  return uniqueByCode([
    preferenceStrength(facts),
    identityStrength(facts),
    strategyAlignmentStrength(facts),
    budgetStrength(facts),
    refinementStrength(facts),
    ...coverageStrengths(facts),
    diversityStrength(facts),
    coherenceStrength(facts),
  ])
    .filter(Boolean)
    .sort(compareExplanations)
    .slice(0, MAX_STRENGTHS);
}

function deriveWeaknesses(facts) {
  if (!facts.derivable) {
    return impossibleWeaknesses(facts);
  }

  return uniqueByCode([
    ...warningWeaknesses(facts),
    ...preferenceWeaknesses(facts),
    ...coverageWeaknesses(facts),
    redundancyWeakness(facts),
  ])
    .filter(Boolean)
    .sort(compareExplanations)
    .slice(0, MAX_WEAKNESSES);
}

function deriveTradeoffExplanations(facts) {
  return (facts.tradeoffs || []).map((tradeoff) =>
    explanation(`tradeoff_${tradeoff.type}`, COMPOSER_EXPLANATION_SEVERITIES.NOTICE, {
      type: tradeoff.type,
      gainedDimension: tradeoff.gainedDimension,
      sacrificedDimension: tradeoff.sacrificedDimension,
      strength: tradeoff.strength,
      evidence: tradeoff.evidence || {},
    })
  );
}

function deriveRecommendations(facts) {
  if (!facts.derivable) {
    return getWarningCodes(facts).includes("impossible_composition")
      ? [
          recommendation("relax_request_constraints", COMPOSER_EXPLANATION_PRIORITIES.HIGH, {
            warningCodes: getWarningCodes(facts),
          }),
        ]
      : [];
  }

  return uniqueByCode([
    ...seasonRecommendations(facts),
    ...occasionRecommendations(facts),
    ...preferenceRecommendations(facts),
    redundancyRecommendation(facts),
    partialRecommendation(facts),
  ])
    .filter(Boolean)
    .sort(compareRecommendations)
    .slice(0, MAX_RECOMMENDATIONS);
}

function deriveHighlights(facts) {
  if (!facts.derivable) {
    return [];
  }

  return uniqueHighlight([
    ...highlightFromContributorList(
      facts.contributors?.coverageLeaders,
      COMPOSER_HIGHLIGHT_REASONS.COVERAGE_ANCHOR
    ),
    ...highlightFromContributorList(
      facts.contributors?.preferenceLeaders,
      COMPOSER_HIGHLIGHT_REASONS.PREFERENCE_ANCHOR
    ),
    ...highlightFromContributorList(
      facts.contributors?.versatilityLeaders,
      COMPOSER_HIGHLIGHT_REASONS.VERSATILITY_ANCHOR
    ),
    ...highlightFromContributorList(
      facts.contributors?.signatureAnchors,
      COMPOSER_HIGHLIGHT_REASONS.SIGNATURE_ANCHOR
    ),
    ...highlightFromContributorList(
      facts.contributors?.diversityContributors,
      COMPOSER_HIGHLIGHT_REASONS.DIVERSITY_ANCHOR
    ),
    ...highlightFromContributorList(
      facts.contributors?.redundancyDrivers,
      COMPOSER_HIGHLIGHT_REASONS.REDUNDANCY_DRIVER
    ),
  ])
    .sort((a, b) => a.rank - b.rank || a.perfumeId - b.perfumeId || compareStrings(a.reason, b.reason))
    .slice(0, MAX_HIGHLIGHTS);
}

function preferenceStrength(facts) {
  const aggregate = facts.preferenceMatch?.aggregate || {};
  if (aggregate.requestedCount === 0 || aggregate.level === "none_requested") {
    return null;
  }

  if (aggregate.level === "complete") {
    return explanation("excellent_preference_match", COMPOSER_EXPLANATION_SEVERITIES.POSITIVE, {
      matchRatio: aggregate.overallMatchRatio,
      requestedCount: aggregate.requestedCount,
      matchedCount: aggregate.matchedCount,
    });
  }

  if (aggregate.level === "strong") {
    return explanation("strong_preference_match", COMPOSER_EXPLANATION_SEVERITIES.POSITIVE, {
      matchRatio: aggregate.overallMatchRatio,
      requestedCount: aggregate.requestedCount,
      matchedCount: aggregate.matchedCount,
    });
  }

  return null;
}

function identityStrength(facts) {
  const primaryTrait = facts.identity?.primaryTrait;
  const alignmentLevel = facts.identity?.alignment?.alignmentLevel;
  const evidence = {
    primaryTrait,
    requestedStrategy: facts.identity?.alignment?.requestedStrategy || null,
    alignmentLevel,
    identityStrength: facts.identity?.identityStrength ?? null,
  };

  if (primaryTrait === "balanced") {
    return explanation("balanced_identity", COMPOSER_EXPLANATION_SEVERITIES.POSITIVE, evidence);
  }
  if (primaryTrait === "versatile") {
    return explanation("versatile_identity", COMPOSER_EXPLANATION_SEVERITIES.POSITIVE, evidence);
  }
  if (primaryTrait === "exploratory") {
    return explanation("explorer_diversity", COMPOSER_EXPLANATION_SEVERITIES.POSITIVE, evidence);
  }
  if (primaryTrait === "signature_focused") {
    return explanation(
      alignmentLevel === "strong" ? "signature_aligned" : "signature_identity",
      COMPOSER_EXPLANATION_SEVERITIES.POSITIVE,
      evidence
    );
  }

  return null;
}

function strategyAlignmentStrength(facts) {
  if (
    facts.identity?.alignment?.requestedStrategy === "signature" &&
    facts.redundancy?.strategyContext === "strategy_aligned"
  ) {
    return explanation("signature_aligned", COMPOSER_EXPLANATION_SEVERITIES.POSITIVE, {
      requestedStrategy: "signature",
      redundancyStrategyContext: facts.redundancy.strategyContext,
      penaltyScore: facts.redundancy.penaltyScore,
    });
  }

  return null;
}

function budgetStrength(facts) {
  const budget = facts.budget || {};
  if (!budget.provided) {
    return null;
  }

  if (budget.assessment === "exact_limit" || budget.assessment === "near_limit") {
    return explanation("excellent_budget_efficiency", COMPOSER_EXPLANATION_SEVERITIES.POSITIVE, {
      assessment: budget.assessment,
      utilization: budget.utilization,
      spent: budget.spent,
      budget: budget.budget,
    });
  }

  if (budget.assessment === "efficient") {
    return explanation("efficient_budget_use", COMPOSER_EXPLANATION_SEVERITIES.POSITIVE, {
      assessment: budget.assessment,
      utilization: budget.utilization,
      spent: budget.spent,
      budget: budget.budget,
    });
  }

  return null;
}

function refinementStrength(facts) {
  const refinement = facts.refinement || {};
  if (refinement.status === "improved") {
    return explanation("refinement_improved_quality", COMPOSER_EXPLANATION_SEVERITIES.POSITIVE, {
      scoreImprovement: refinement.scoreImprovement,
      appliedSwapCount: refinement.appliedSwapCount,
      initialScore: refinement.initialScore,
      finalScore: refinement.finalScore,
    });
  }

  if (refinement.status === "unchanged") {
    return explanation("refinement_no_change", COMPOSER_EXPLANATION_SEVERITIES.NEUTRAL, {
      finalScore: refinement.finalScore,
      appliedSwapCount: refinement.appliedSwapCount,
    });
  }

  return null;
}

function coverageStrengths(facts) {
  return Object.entries(facts.coverage?.domains || {})
    .filter(([, domain]) => domain.level === "strong")
    .map(([domain, value]) =>
      explanation(`strong_${domain}_coverage`, COMPOSER_EXPLANATION_SEVERITIES.POSITIVE, {
        domain,
        breadth: value.breadth,
        strongest: value.strongest || [],
      })
    );
}

function diversityStrength(facts) {
  if (["high", "very_high"].includes(facts.diversity?.level)) {
    return explanation("strong_diversity", COMPOSER_EXPLANATION_SEVERITIES.POSITIVE, {
      score: facts.diversity.score,
      level: facts.diversity.level,
      uniqueAccordCount: facts.diversity.uniqueAccordCount,
    });
  }

  return null;
}

function coherenceStrength(facts) {
  if (["high", "very_high"].includes(facts.coherence?.level)) {
    return explanation("strong_coherence", COMPOSER_EXPLANATION_SEVERITIES.POSITIVE, {
      score: facts.coherence.score,
      level: facts.coherence.level,
      shape: facts.coherence.shape,
    });
  }

  return null;
}

function impossibleWeaknesses(facts) {
  if (facts.compositionStatus === "impossible") {
    return [
      explanation("impossible_request", COMPOSER_EXPLANATION_SEVERITIES.WARNING, {
        warningCodes: getWarningCodes(facts),
      }),
    ];
  }

  if (facts.compositionStatus === "failed") {
    return [
      explanation("invalid_composition_result", COMPOSER_EXPLANATION_SEVERITIES.WARNING, {
        warningCodes: getWarningCodes(facts),
      }),
    ];
  }

  return [];
}

function warningWeaknesses(facts) {
  return (facts.warnings || []).map((warning) =>
    explanation(warningCodeToExplanationCode(warning.code), severityFromWarning(warning), {
      warningCode: warning.code,
      warningSeverity: warning.severity,
      warningEvidence: warning.evidence || {},
    })
  );
}

function preferenceWeaknesses(facts) {
  const aggregate = facts.preferenceMatch?.aggregate || {};
  if (aggregate.requestedCount === 0) {
    return [];
  }

  if (aggregate.level === "partial") {
    return [
      explanation("partial_preference_match", COMPOSER_EXPLANATION_SEVERITIES.NOTICE, {
        matchRatio: aggregate.overallMatchRatio,
        requestedCount: aggregate.requestedCount,
        matchedCount: aggregate.matchedCount,
      }),
    ];
  }

  if (aggregate.level === "weak") {
    return [
      explanation("weak_preference_match", COMPOSER_EXPLANATION_SEVERITIES.WARNING, {
        matchRatio: aggregate.overallMatchRatio,
        requestedCount: aggregate.requestedCount,
        matchedCount: aggregate.matchedCount,
      }),
    ];
  }

  return [];
}

function coverageWeaknesses(facts) {
  const domains = facts.coverage?.domains || {};
  const seasonGaps = gapValues(domains.seasons).map((season) =>
    explanation("season_gap", COMPOSER_EXPLANATION_SEVERITIES.NOTICE, {
      season,
      count: domains.seasons?.counts?.[season] ?? 0,
    })
  );
  const occasionGaps = gapValues(domains.occasions).map((occasion) =>
    explanation("occasion_gap", COMPOSER_EXPLANATION_SEVERITIES.NOTICE, {
      occasion,
      count: domains.occasions?.counts?.[occasion] ?? 0,
    })
  );
  const vibeGaps = gapValues(domains.vibes).map((vibe) =>
    explanation("vibe_gap", COMPOSER_EXPLANATION_SEVERITIES.NOTICE, {
      vibe,
      count: domains.vibes?.counts?.[vibe] ?? 0,
    })
  );

  return [...seasonGaps, ...occasionGaps, ...vibeGaps];
}

function redundancyWeakness(facts) {
  if (facts.redundancy?.penaltyScore >= 70) {
    return explanation("high_redundancy", COMPOSER_EXPLANATION_SEVERITIES.NOTICE, {
      penaltyScore: facts.redundancy.penaltyScore,
      strategyContext: facts.redundancy.strategyContext,
      similarPairs: facts.redundancy.similarPairs || [],
    });
  }

  return null;
}

function seasonRecommendations(facts) {
  const seasons = gapValues(facts.coverage?.domains?.seasons);
  return seasons.map((season) =>
    recommendation(`expand_${season}_coverage`, priorityForGap(facts.coverage.domains.seasons, season), {
      missingSeason: season,
      domain: "seasons",
    })
  );
}

function occasionRecommendations(facts) {
  return gapValues(facts.coverage?.domains?.occasions).map((occasion) =>
    recommendation("expand_occasion_coverage", COMPOSER_EXPLANATION_PRIORITIES.MEDIUM, {
      missingOccasion: occasion,
      domain: "occasions",
    })
  );
}

function preferenceRecommendations(facts) {
  const unmatched = Object.entries(facts.preferenceMatch?.domains || {})
    .flatMap(([domain, value]) =>
      (value.unmatched || []).map((preference) => ({
        domain,
        preference,
      }))
    )
    .sort((a, b) => compareStrings(a.domain, b.domain) || compareStrings(a.preference, b.preference));

  if (unmatched.length === 0) {
    return [];
  }

  return [
    recommendation("support_requested_preferences", COMPOSER_EXPLANATION_PRIORITIES.HIGH, {
      unmatched,
    }),
  ];
}

function redundancyRecommendation(facts) {
  if (facts.redundancy?.penaltyScore >= 70 && facts.redundancy?.strategyContext !== "strategy_aligned") {
    return recommendation("reduce_redundancy", COMPOSER_EXPLANATION_PRIORITIES.MEDIUM, {
      penaltyScore: facts.redundancy.penaltyScore,
      similarPairs: facts.redundancy.similarPairs || [],
    });
  }

  return null;
}

function partialRecommendation(facts) {
  if (facts.compositionStatus === "partial" && facts.summary?.targetReached === false) {
    return recommendation("fill_remaining_slots", COMPOSER_EXPLANATION_PRIORITIES.MEDIUM, {
      perfumeCount: facts.summary.perfumeCount,
      targetSlots: facts.summary.targetSlots,
    });
  }

  return null;
}

function gapValues(domain) {
  if (!domain) {
    return [];
  }

  return [
    ...new Set([
      ...(domain.missing || []),
      ...(domain.weakest || [])
        .filter((item) => item.count < 30)
        .map((item) => item.value),
    ]),
  ].sort(compareStrings);
}

function priorityForGap(domain, value) {
  const count = domain?.counts?.[value] || 0;
  return count === 0
    ? COMPOSER_EXPLANATION_PRIORITIES.HIGH
    : COMPOSER_EXPLANATION_PRIORITIES.MEDIUM;
}

function highlightFromContributorList(items = [], reason) {
  return (items || []).map((item) => ({
    perfumeId: item.perfumeId,
    reason,
    rank: item.rank || MAX_HIGHLIGHTS,
    evidence: item.evidence || {},
  }));
}

function warningCodeToExplanationCode(code) {
  return {
    partial_collection: "valid_partial_collection",
    minimum_only: "minimum_only_collection",
    unmatched_preferences: "unmatched_preferences",
    weak_season_coverage: "season_gap",
    weak_occasion_coverage: "occasion_gap",
    high_redundancy: "high_redundancy",
    low_budget_utilization: "low_budget_utilization",
    refinement_iteration_limit: "refinement_iteration_limit",
    refinement_fallback: "refinement_fallback",
    missing_catalog_data: "missing_catalog_data",
    impossible_composition: "impossible_request",
    invalid_composition_result: "invalid_composition_result",
  }[code] || "unclassified_warning";
}

function severityFromWarning(warning) {
  if (warning.severity === "warning") return COMPOSER_EXPLANATION_SEVERITIES.WARNING;
  if (warning.severity === "notice") return COMPOSER_EXPLANATION_SEVERITIES.NOTICE;
  return COMPOSER_EXPLANATION_SEVERITIES.NEUTRAL;
}

function deriveDiagnostics({
  facts,
  explainable,
  headline,
  strengths,
  weaknesses,
  tradeoffs,
  recommendations,
  highlights,
}) {
  return {
    explainable,
    sourceDerivable: Boolean(facts.derivable),
    sourceCompositionStatus: facts.compositionStatus || null,
    sourceMode: facts.mode || null,
    sourceStrategy: facts.strategy || null,
    headlineCode: headline.code,
    strengthCount: strengths.length,
    weaknessCount: weaknesses.length,
    tradeoffCount: tradeoffs.length,
    recommendationCount: recommendations.length,
    highlightCount: highlights.length,
    generatedSections: [
      "headline",
      "strengths",
      "weaknesses",
      "tradeoffs",
      "recommendations",
      "highlights",
    ],
    unsupportedActionCount: 0,
    serializationSafe: true,
    maxItems: {
      strengths: MAX_STRENGTHS,
      weaknesses: MAX_WEAKNESSES,
      recommendations: MAX_RECOMMENDATIONS,
      highlights: MAX_HIGHLIGHTS,
    },
  };
}

function explanation(code, severity, evidence) {
  return {
    code,
    severity,
    evidence,
  };
}

function recommendation(code, priority, evidence) {
  return {
    code,
    priority,
    evidence,
  };
}

function uniqueByCode(items) {
  const seen = new Set();
  return items.filter((item) => {
    if (!item || seen.has(item.code)) {
      return false;
    }

    seen.add(item.code);
    return true;
  });
}

function uniqueHighlight(items) {
  const seen = new Set();
  return items.filter((item) => {
    const key = `${item.perfumeId}:${item.reason}`;
    if (!Number.isInteger(item.perfumeId) || seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function compareExplanations(first, second) {
  return (
    explanationRank(first.code) - explanationRank(second.code) ||
    severityRank(first.severity) - severityRank(second.severity) ||
    compareStrings(first.code, second.code)
  );
}

function compareRecommendations(first, second) {
  return priorityRank(first.priority) - priorityRank(second.priority) || compareStrings(first.code, second.code);
}

function severityRank(severity) {
  return {
    positive: 0,
    warning: 1,
    notice: 2,
    neutral: 3,
  }[severity] ?? 4;
}

function priorityRank(priority) {
  return {
    high: 0,
    medium: 1,
    low: 2,
  }[priority] ?? 3;
}

function explanationRank(code) {
  return {
    collection_completed: 0,
    valid_partial_collection: 0,
    impossible_request: 0,
    invalid_composition_result: 0,
    excellent_preference_match: 1,
    strong_preference_match: 1,
    partial_preference_match: 1,
    weak_preference_match: 1,
    signature_aligned: 2,
    balanced_identity: 2,
    versatile_identity: 2,
    explorer_diversity: 2,
    signature_identity: 2,
    refinement_improved_quality: 3,
    refinement_no_change: 3,
    excellent_budget_efficiency: 4,
    efficient_budget_use: 4,
  }[code] ?? 10;
}

function getWarningCodes(facts) {
  return (facts.warnings || []).map((warning) => warning.code).sort(compareStrings);
}

function compareStrings(first, second) {
  if (first < second) return -1;
  if (first > second) return 1;
  return 0;
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
