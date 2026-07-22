export const REASONING_THRESHOLD_POLICY_VERSION = "composer-reasoning-v1";

export const QUALITY_LEVELS = Object.freeze({
  VERY_LOW: "very_low",
  LOW: "low",
  MODERATE: "moderate",
  HIGH: "high",
  VERY_HIGH: "very_high",
});

export const MATCH_LEVELS = Object.freeze({
  NONE_REQUESTED: "none_requested",
  WEAK: "weak",
  PARTIAL: "partial",
  STRONG: "strong",
  COMPLETE: "complete",
});

export const COVERAGE_LEVELS = Object.freeze({
  MISSING: "missing",
  WEAK: "weak",
  PRESENT: "present",
  STRONG: "strong",
});

export const BUDGET_ASSESSMENTS = Object.freeze({
  UNLIMITED: "unlimited",
  UNDERUSED: "underused",
  EFFICIENT: "efficient",
  NEAR_LIMIT: "near_limit",
  EXACT_LIMIT: "exact_limit",
  INVALID: "invalid",
});

export const REFINEMENT_FACT_STATUSES = Object.freeze({
  NOT_REQUESTED: "not_requested",
  NOT_ELIGIBLE: "not_eligible",
  UNCHANGED: "unchanged",
  IMPROVED: "improved",
  ITERATION_LIMITED: "iteration_limited",
  FALLBACK_USED: "fallback_used",
});

export const COHERENCE_SHAPES = Object.freeze({
  FOCUSED: "focused",
  BALANCED: "balanced",
  VARIED: "varied",
  FRAGMENTED: "fragmented",
});

export const IDENTITY_TRAITS = Object.freeze({
  BALANCED: "balanced",
  VERSATILE: "versatile",
  EXPLORATORY: "exploratory",
  SIGNATURE_FOCUSED: "signature_focused",
});

export const DIRECTIONALITY = Object.freeze({
  HIGHER_IS_BETTER: "higher_is_better",
  LOWER_IS_BETTER: "lower_is_better",
});

// Policy thresholds classify existing measured scores. They never alter Composer scoring.
export const QUALITY_LEVEL_THRESHOLDS = Object.freeze({
  VERY_LOW_MAX: 19.9999,
  LOW_MAX: 39.9999,
  MODERATE_MAX: 69.9999,
  HIGH_MAX: 87.9999,
});

export const MATCH_LEVEL_THRESHOLDS = Object.freeze({
  WEAK_MAX: 0.3333,
  PARTIAL_MAX: 0.6666,
  STRONG_MAX: 0.9999,
});

export const COVERAGE_LEVEL_THRESHOLDS = Object.freeze({
  MISSING_MAX: 0,
  WEAK_MAX: 29.9999,
  PRESENT_MAX: 59.9999,
});

export const BUDGET_UTILIZATION_THRESHOLDS = Object.freeze({
  EFFICIENT_START: 0.6,
  NEAR_LIMIT_START: 0.9,
  EXACT_LIMIT_START: 0.9999,
});

export const REDUNDANCY_LEVEL_THRESHOLDS = Object.freeze({
  VERY_LOW_MAX: 15,
  LOW_MAX: 35,
  MODERATE_MAX: 60,
  HIGH_MAX: 80,
});

export const TRADEOFF_EVIDENCE_THRESHOLDS = Object.freeze({
  DIMENSION_GAP: 25,
  HIGH_CONCENTRATION: 0.58,
  LOW_BUDGET_UTILIZATION: 0.45,
});

export function classifyQualityScore(score) {
  if (!Number.isFinite(score)) return null;
  if (score <= QUALITY_LEVEL_THRESHOLDS.VERY_LOW_MAX) return QUALITY_LEVELS.VERY_LOW;
  if (score <= QUALITY_LEVEL_THRESHOLDS.LOW_MAX) return QUALITY_LEVELS.LOW;
  if (score <= QUALITY_LEVEL_THRESHOLDS.MODERATE_MAX) return QUALITY_LEVELS.MODERATE;
  if (score <= QUALITY_LEVEL_THRESHOLDS.HIGH_MAX) return QUALITY_LEVELS.HIGH;
  return QUALITY_LEVELS.VERY_HIGH;
}

export function classifyMatchRatio(ratio, requestedCount) {
  if (requestedCount === 0) return MATCH_LEVELS.NONE_REQUESTED;
  if (ratio >= 1) return MATCH_LEVELS.COMPLETE;
  if (ratio > MATCH_LEVEL_THRESHOLDS.PARTIAL_MAX) return MATCH_LEVELS.STRONG;
  if (ratio > MATCH_LEVEL_THRESHOLDS.WEAK_MAX) return MATCH_LEVELS.PARTIAL;
  return MATCH_LEVELS.WEAK;
}

export function classifyCoveragePercent(percent) {
  if (!Number.isFinite(percent) || percent <= COVERAGE_LEVEL_THRESHOLDS.MISSING_MAX) {
    return COVERAGE_LEVELS.MISSING;
  }
  if (percent <= COVERAGE_LEVEL_THRESHOLDS.WEAK_MAX) return COVERAGE_LEVELS.WEAK;
  if (percent <= COVERAGE_LEVEL_THRESHOLDS.PRESENT_MAX) return COVERAGE_LEVELS.PRESENT;
  return COVERAGE_LEVELS.STRONG;
}

export function classifyBudgetUtilization(utilization, budgetProvided, exceeded = false) {
  if (!budgetProvided) return BUDGET_ASSESSMENTS.UNLIMITED;
  if (!Number.isFinite(utilization) || utilization < 0 || exceeded) {
    return BUDGET_ASSESSMENTS.INVALID;
  }
  if (utilization >= BUDGET_UTILIZATION_THRESHOLDS.EXACT_LIMIT_START) {
    return BUDGET_ASSESSMENTS.EXACT_LIMIT;
  }
  if (utilization >= BUDGET_UTILIZATION_THRESHOLDS.NEAR_LIMIT_START) {
    return BUDGET_ASSESSMENTS.NEAR_LIMIT;
  }
  if (utilization >= BUDGET_UTILIZATION_THRESHOLDS.EFFICIENT_START) {
    return BUDGET_ASSESSMENTS.EFFICIENT;
  }
  return BUDGET_ASSESSMENTS.UNDERUSED;
}

export function classifyRedundancyMagnitude(magnitude) {
  if (!Number.isFinite(magnitude)) return null;
  if (magnitude <= REDUNDANCY_LEVEL_THRESHOLDS.VERY_LOW_MAX) return QUALITY_LEVELS.VERY_LOW;
  if (magnitude <= REDUNDANCY_LEVEL_THRESHOLDS.LOW_MAX) return QUALITY_LEVELS.LOW;
  if (magnitude <= REDUNDANCY_LEVEL_THRESHOLDS.MODERATE_MAX) return QUALITY_LEVELS.MODERATE;
  if (magnitude <= REDUNDANCY_LEVEL_THRESHOLDS.HIGH_MAX) return QUALITY_LEVELS.HIGH;
  return QUALITY_LEVELS.VERY_HIGH;
}
