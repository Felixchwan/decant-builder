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

// Hosts that speak money to customers (commerce.priceDisplay === "price") get the
// bonus threshold and progress worded as amounts instead of points. Same numbers
// (points x pointValue), same state machine -- only the wording differs.
function formatCustomerAmount(value, threshold, config) {
  const locale = config?.commerce?.locale || "en-US";
  return `${threshold.currencySymbol}${Math.max(0, Math.round(value)).toLocaleString(locale)}`;
}

export function buildComposerBudgetBonusFeedback({ budget, config } = {}) {
  const threshold = deriveCuratorBonusThreshold(config);
  const t = config?.translator?.t;
  const isPriceDisplay = config?.commerce?.priceDisplay === "price";

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
      label: isPriceDisplay
        ? t?.("composer.bonus.noLimitAmount", {
            amount: formatCustomerAmount(threshold.monetaryThreshold, threshold, config),
          }) || `Bonus unlocks at ${formatCustomerAmount(threshold.monetaryThreshold, threshold, config)}.`
        : t?.("composer.bonus.noLimit", { points: formatPoints(threshold.targetPoints) }) ||
          `Bonus unlocks at ${formatPoints(threshold.targetPoints)} points.`,
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
      label: t?.("composer.bonus.eligible") || "Bonus-eligible budget.",
      threshold,
    };
  }

  return {
    state: "below_threshold",
    label:
      t?.("composer.bonus.below", {
        amount: formatMoney(threshold.monetaryThreshold - budget, threshold),
      }) ||
      `${formatMoney(threshold.monetaryThreshold - budget, threshold)} to Bonus eligibility.`,
    threshold,
  };
}

export function buildComposerProposalBonusStatus({ totalPoints, config } = {}) {
  const threshold = deriveCuratorBonusThreshold(config);
  const safePoints = normalizeNumber(totalPoints, 0);
  const t = config?.translator?.t;
  const isPriceDisplay = config?.commerce?.priceDisplay === "price";

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
      label: t?.("composer.bonus.unlocked") || "Curator Bonus unlocked.",
      value: t?.("general.unlocked") || "Unlocked",
      threshold,
    };
  }

  if (isPriceDisplay) {
    const current = formatCustomerAmount(safePoints * threshold.pointValue, threshold, config);
    const target = formatCustomerAmount(threshold.monetaryThreshold, threshold, config);

    return {
      state: "progress",
      label: t?.("composer.bonus.progressAmount", { current, target }) || `${current} / ${target} toward Curator Bonus.`,
      value: t?.("composer.bonus.valueProgressAmount", { current, target }) || `${current} / ${target}`,
      threshold,
    };
  }

  return {
    state: "progress",
    label:
      t?.("composer.bonus.progress", {
        current: formatPoints(safePoints),
        target: formatPoints(threshold.targetPoints),
      }) ||
      `${formatPoints(safePoints)} / ${formatPoints(threshold.targetPoints)} points toward Curator Bonus.`,
    value:
      t?.("composer.bonus.valueProgress", {
        current: formatPoints(safePoints),
        target: formatPoints(threshold.targetPoints),
      }) ||
      `${formatPoints(safePoints)} / ${formatPoints(threshold.targetPoints)} pts`,
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
