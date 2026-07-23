const STRATEGY_LABELS = {
  balanced: "Balanced",
  versatile: "Versatile",
  explorer: "Explorer",
  signature: "Signature",
};

const REASON_DISPLAY_PRIORITY = {
  season: 1,
  occasion: 2,
  vibe: 3,
  strategy_contribution: 5,
};

export function getComposerProposalItemReasonLabel(reason = {}, translator) {
  if (reason.type === "preserved") {
    return translator?.t?.("composer.reason.alreadyInBox") || "Already in your box";
  }

  if (reason.type === "preference_match" && reason.preferenceValue) {
    return translator?.label?.(reason.preferenceType, reason.preferenceValue) || formatReasonValue(reason.preferenceValue);
  }

  if (reason.type === "contribution") {
    return getComposerContributionLabel(reason, translator);
  }

  if (reason.type === "strategy_contribution") {
    const strategyId = reason.evidence?.strategyId;
    const strategyLabel =
      translator?.t?.(`composer.strategy.${strategyId}`) ||
      STRATEGY_LABELS[strategyId] ||
      formatReasonValue(strategyId || "");

    return strategyLabel
      ? translator?.t?.("composer.reason.supportsStrategy", { strategy: strategyLabel }) || `Supports ${strategyLabel} strategy`
      : translator?.t?.("composer.reason.supportsStrategyFallback") || "Supports strategy";
  }

  return "";
}

export function getComposerProposalItemReasonLabels(reasons = [], { max = 3, translator } = {}) {
  const safeReasons = Array.isArray(reasons) ? reasons : [];
  const concreteReasons = safeReasons
    .filter((reason) => reason.type !== "strategy_contribution")
    .sort(compareReasons);
  const displayReasons = concreteReasons;
  const seen = new Set();

  return displayReasons
    .map((reason) => getComposerProposalItemReasonLabel(reason, translator))
    .filter(Boolean)
    .filter((label) => {
      if (seen.has(label)) {
        return false;
      }

      seen.add(label);
      return true;
    })
    .slice(0, max);
}

function compareReasons(first, second) {
  return getReasonPriority(first) - getReasonPriority(second);
}

function getReasonPriority(reason) {
  if (reason.type === "contribution") {
    return getContributionReasonPriority(reason);
  }

  if (reason.type === "strategy_contribution") {
    return REASON_DISPLAY_PRIORITY.strategy_contribution;
  }

  return REASON_DISPLAY_PRIORITY[reason.preferenceType] || 4;
}

function getContributionReasonPriority(reason) {
  if (reason.contributionStrength === "unique") {
    return 0;
  }

  if (reason.contributionStrength === "strong") {
    return 0.5;
  }

  if (reason.contributionType === "accord_contribution") {
    return 2.5;
  }

  return 4;
}

export function getComposerTradeoffLabel(tradeoff = {}, translator) {
  return getComposerProposalItemReasonLabel(tradeoff.reason || tradeoff, translator);
}

export function getComposerOptionPositionLabel(position, count, translator) {
  return translator?.t?.("composer.optionPosition", { position, count }) || `Option ${position} of ${count}`;
}

function formatReasonValue(value) {
  return String(value)
    .split(/(?=[A-Z])|[-_\s]/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
import { getComposerContributionLabel } from "./composerContributionLabels.js";
