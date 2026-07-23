const ACCORD_LABELS = {
  aquatic: "Aquatic freshness",
  aromatic: "Aromatic lift",
  amber: "Amber warmth",
  citrus: "Citrus brightness",
  fresh: "Fresh contrast",
  floral: "Floral notes",
  green: "Green freshness",
  incense: "Introduces incense",
  iris: "Introduces iris",
  leather: "Introduces leather",
  marine: "Marine freshness",
  musky: "Musky softness",
  powdery: "Powdery softness",
  smoky: "Smoky depth",
  sweet: "Sweet contrast",
  woody: "Woody depth",
  "warm spicy": "Warm spicy depth",
  vanilla: "Vanilla warmth",
};

const OCCASION_LABELS = {
  casual: "Easy Casual wear",
  club: "Great for Club nights",
  date: "Excellent for Date nights",
  day: "Great for Daytime",
  evening: "Great for Evenings",
  formal: "Great for Formal wear",
  gym: "Great for Gym",
  night: "Great for Nights",
  office: "Great for Office",
  special: "Great for Special occasions",
  vacation: "Great for Vacation",
};

const VIBE_LABELS = {
  bold: "Bold personality",
  bright: "Bright impression",
  classic: "Classic style",
  clean: "Clean impression",
  confident: "Confident profile",
  cozy: "Cozy warmth",
  dark: "Darker profile",
  elegant: "Elegant style",
  fresh: "Fresh impression",
  luxurious: "Luxury feel",
  modern: "Modern feel",
  mysterious: "Mysterious profile",
  playful: "Playful twist",
  relaxed: "Relaxed feel",
  seductive: "Seductive mood",
  soft: "Soft impression",
  sporty: "Sporty vibe",
  tropical: "Tropical brightness",
  unique: "Distinctive profile",
  warm: "Warm feel",
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
    return "Adds contrast";
  }

  if (reason.contributionType === "budget_contribution") {
    return "Supports full-box variety";
  }

  return "";
}

function getCoverageLabel(reason) {
  const value = formatValue(reason.contributionValue);

  if (reason.contributionCategory === "season") {
    return `Adds ${value} versatility`;
  }

  if (reason.contributionCategory === "occasion") {
    return OCCASION_LABELS[reason.contributionValue] || `Great for ${value}`;
  }

  if (reason.contributionCategory === "vibe") {
    return VIBE_LABELS[reason.contributionValue] || `${value} profile`;
  }

  return `Adds ${value}`;
}

function getAccordLabel(value) {
  return ACCORD_LABELS[value] || `Adds ${formatValue(value)}`;
}

function formatValue(value) {
  return String(value)
    .split(/(?=[A-Z])|[-_\s]/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
