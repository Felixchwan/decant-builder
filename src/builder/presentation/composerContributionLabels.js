const ACCORD_LABELS = {
  aquatic: "Adds aquatic freshness",
  aromatic: "Adds aromatic lift",
  amber: "Adds amber warmth",
  citrus: "Adds citrus brightness",
  fresh: "Adds fresh contrast",
  green: "Adds green freshness",
  leather: "Introduces leather",
  smoky: "Adds smoky depth",
  sweet: "Adds sweet contrast",
  woody: "Adds woody depth",
  "warm spicy": "Adds warm spicy depth",
  vanilla: "Adds vanilla warmth",
};

export function getComposerContributionLabel(reason = {}) {
  if (reason.type !== "contribution") {
    return "";
  }

  if (reason.contributionType === "coverage_contribution") {
    return getCoverageLabel(reason);
  }

  if (reason.contributionType === "accord_contribution") {
    return getAccordLabel(reason.contributionValue);
  }

  if (reason.contributionType === "diversity_contribution") {
    return "Adds scent-profile contrast";
  }

  if (reason.contributionType === "budget_contribution") {
    return "Helps reach target slots";
  }

  return "";
}

function getCoverageLabel(reason) {
  const value = formatValue(reason.contributionValue);

  if (reason.contributionCategory === "season") {
    return `Adds ${value} coverage`;
  }

  if (reason.contributionCategory === "occasion") {
    return `Expands ${value} options`;
  }

  if (reason.contributionCategory === "vibe") {
    return `Adds ${value} character`;
  }

  return `Adds ${value} coverage`;
}

function getAccordLabel(value) {
  return ACCORD_LABELS[value] || `Adds ${formatValue(value)} coverage`;
}

function formatValue(value) {
  return String(value)
    .split(/(?=[A-Z])|[-_\s]/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
