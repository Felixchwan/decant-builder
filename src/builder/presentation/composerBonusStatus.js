export function deriveCuratorBonusThreshold(config = {}) {
  const targetPoints = normalizePositiveNumber(config.curatorBonus?.targetPoints, 0);
  const pointValue = normalizePositiveNumber(config.commerce?.pointValue, 0);
  const monetaryThreshold = roundNumber(targetPoints * pointValue);

  return {
    targetPoints,
    pointValue,
    monetaryThreshold,
    currencySymbol: config.commerce?.currencySymbol || "$",
  };
}

export function buildComposerBudgetBonusFeedback({ budget, config } = {}) {
  const threshold = deriveCuratorBonusThreshold(config);

  if (!threshold.targetPoints || !threshold.pointValue) {
    return {
      state: "unavailable",
      label: "",
      threshold,
    };
  }

  if (budget === null || budget === undefined || budget === "") {
    return {
      state: "no_limit",
      label: `Bonus unlocks at ${formatPoints(threshold.targetPoints)} points.`,
      threshold,
    };
  }

  if (!Number.isFinite(budget)) {
    return {
      state: "invalid",
      label: "",
      threshold,
    };
  }

  if (budget >= threshold.monetaryThreshold) {
    return {
      state: "eligible",
      label: "Bonus-eligible budget.",
      threshold,
    };
  }

  return {
    state: "below_threshold",
    label: `${formatMoney(threshold.monetaryThreshold - budget, threshold)} to Bonus eligibility.`,
    threshold,
  };
}

export function buildComposerProposalBonusStatus({ totalPoints, config } = {}) {
  const threshold = deriveCuratorBonusThreshold(config);
  const safePoints = normalizeNumber(totalPoints, 0);

  if (!threshold.targetPoints) {
    return {
      state: "unavailable",
      label: "",
      value: "",
      threshold,
    };
  }

  if (safePoints >= threshold.targetPoints) {
    return {
      state: "unlocked",
      label: "Curator Bonus unlocked.",
      value: "Unlocked",
      threshold,
    };
  }

  return {
    state: "progress",
    label: `${formatPoints(safePoints)} / ${formatPoints(threshold.targetPoints)} points toward Curator Bonus.`,
    value: `${formatPoints(safePoints)} / ${formatPoints(threshold.targetPoints)} pts`,
    threshold,
  };
}

function formatMoney(value, threshold) {
  return `${threshold.currencySymbol}${Math.max(0, Math.round(value))}`;
}

function formatPoints(value) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function normalizePositiveNumber(value, fallback) {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? value
    : fallback;
}

function normalizeNumber(value, fallback) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function roundNumber(value) {
  return Number.isFinite(value) ? Math.round(value * 10000) / 10000 : 0;
}
