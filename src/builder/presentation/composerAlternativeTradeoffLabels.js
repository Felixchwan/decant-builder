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

export function getComposerProposalItemReasonLabel(reason = {}) {
  if (reason.type === "preserved") {
    return "Already in your box";
  }

  if (reason.type === "preference_match" && reason.preferenceValue) {
    return formatReasonValue(reason.preferenceValue);
  }

  if (reason.type === "contribution") {
    return getComposerContributionLabel(reason);
  }

  if (reason.type === "strategy_contribution") {
    const strategyId = reason.evidence?.strategyId;
    const strategyLabel = STRATEGY_LABELS[strategyId] || formatReasonValue(strategyId || "");

    return strategyLabel
      ? `Supports ${strategyLabel} strategy`
      : "Supports strategy";
  }

  return "";
}

export function getComposerProposalItemReasonLabels(reasons = [], { max = 3 } = {}) {
  const safeReasons = Array.isArray(reasons) ? reasons : [];
  const concreteReasons = safeReasons
    .filter((reason) => reason.type !== "strategy_contribution")
    .sort(compareReasons);
  const displayReasons = concreteReasons;
  const seen = new Set();

  return displayReasons
    .map(getComposerProposalItemReasonLabel)
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

export function getComposerTradeoffLabel(tradeoff = {}) {
  return getComposerProposalItemReasonLabel(tradeoff.reason || tradeoff);
}

export function getComposerOptionPositionLabel(position, count) {
  return `Option ${position} of ${count}`;
}

function formatReasonValue(value) {
  return String(value)
    .split(/(?=[A-Z])|[-_\s]/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
import { getComposerContributionLabel } from "./composerContributionLabels.js";
