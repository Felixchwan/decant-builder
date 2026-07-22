import { getObjectiveCompatibilityScore } from "../internal/intelligence/buildCollectionIntelligenceViewModel.js";

const MAX_RECOMMENDATION_EXPLANATIONS = 3;

const LOW_VALUE_RECOMMENDATION_REASON_PATTERNS = [
  /^fits your current box tier$/i,
  /^matches current tier$/i,
  /^similar to daily picks$/i,
  /^shares /i,
  /^good recommendation$/i,
  /^broadens the fragrance palette$/i,
  /^adds variety without changing the mood too much$/i,
];

const RECOMMENDATION_REASON_REWRITES = {
  "Adds high-impact coverage": "Improves multiple coverage gaps",
  "Adds contrast to the current collection": "Adds contrast to your current collection",
  "Expands Spring Coverage": "Expands spring versatility",
  "Expands Summer Coverage": "Expands warm-weather options",
  "Expands Fall Coverage": "Adds fall-season range",
  "Expands Winter Coverage": "Strengthens cold-weather coverage",
  "Improves Season Balance": "Improves seasonal balance",
  "Adds fresh everyday range": "Adds fresh daytime range",
  "Strengthens easy daily wear": "Broadens daily rotation",
  "Adds a useful scent mood": "Adds a distinct scent mood",
  "Adds contrast without changing the mood too much": "Adds contrast within your current style",
};

export function getRecommendationDisplayReasons({ recommendation, objectiveKey } = {}) {
  const explanationReasons = Array.isArray(recommendation?.explanations)
    ? recommendation.explanations
        .map((explanation) => createRecommendationExplanationOption(explanation))
        .filter(Boolean)
    : [];
  const reasons = Array.isArray(recommendation?.reasons) ? recommendation.reasons : [];
  const objectiveReasons = objectiveKey
    ? getObjectiveReasonOptions(recommendation, objectiveKey)
    : [];
  const reasonOptions = [
    ...objectiveReasons,
    ...explanationReasons,
    ...reasons.map((reason) => createRecommendationReasonOption(reason)),
    ...getFallbackRecommendationReasonOptions(recommendation),
  ]
    .filter(Boolean)
    .filter(
      ({ label }) =>
        !LOW_VALUE_RECOMMENDATION_REASON_PATTERNS.some((pattern) =>
          pattern.test(label)
        )
    );

  const selectedReasons = [];
  const seenLabels = new Set();
  const seenCategories = new Set();
  const seenConcepts = new Set();
  const prioritizedOptions = reasonOptions.sort(
    (a, b) => a.priority - b.priority || a.label.localeCompare(b.label)
  );

  prioritizedOptions.forEach((reason) => {
    if (selectedReasons.length >= MAX_RECOMMENDATION_EXPLANATIONS) {
      return;
    }

    const normalizedLabel = normalizeRecommendationReason(reason.label);
    if (seenLabels.has(normalizedLabel)) {
      return;
    }

    const concept = getRecommendationReasonConcept(reason.label);
    if (concept && seenConcepts.has(concept)) {
      return;
    }

    if (reason.category === "affinity" && seenCategories.has("affinity")) {
      return;
    }

    if (
      reason.category !== "objective" &&
      reason.topic &&
      [...seenCategories].some((category) => category === reason.topic)
    ) {
      return;
    }

    selectedReasons.push(reason.label);
    seenLabels.add(normalizedLabel);

    if (concept) {
      seenConcepts.add(concept);
    }

    seenCategories.add(reason.category);

    if (reason.topic) {
      seenCategories.add(reason.topic);
    }
  });

  return selectedReasons;
}

export function getRecommendationConfidence(recommendation) {
  const score = Number(recommendation?.finalScore ?? recommendation?.score ?? 0);

  if (score >= 75) {
    return "High";
  }

  if (score >= 45) {
    return "Medium";
  }

  return "Situational";
}

function createRecommendationExplanationOption(explanation) {
  const label = getRecommendationExplanationLabel(explanation);

  if (!label) {
    return null;
  }

  const category = getRecommendationReasonCategory(label);

  return {
    label,
    category,
    priority: getRecommendationReasonPriority(category),
    topic: getRecommendationReasonTopic(label),
  };
}

export function getRecommendationExplanationLabel(explanation = {}) {
  const evidence = explanation.evidence || {};

  if (explanation.code?.startsWith("expand_") && explanation.code?.endsWith("_coverage")) {
    const season =
      evidence.missingSeason ||
      explanation.code.replace(/^expand_/, "").replace(/_coverage$/, "");

    return getSeasonRecommendationCopy(season);
  }

  if (explanation.code === "expand_occasion_coverage" && evidence.missingOccasion) {
    return getOccasionRecommendationCopy(evidence.missingOccasion);
  }

  if (explanation.code === "support_requested_preferences") {
    const firstPreference = evidence.unmatched?.[0];

    if (firstPreference?.domain === "seasons") {
      return getSeasonRecommendationCopy(firstPreference.preference);
    }

    if (firstPreference?.domain === "occasions") {
      return getOccasionRecommendationCopy(firstPreference.preference);
    }

    if (firstPreference?.domain === "vibes") {
      return getVibeRecommendationCopy(firstPreference.preference);
    }

    return "Supports requested preferences";
  }

  if (explanation.code === "coverage_anchor") {
    return "Improves multiple coverage gaps";
  }

  if (explanation.code === "preference_anchor" || explanation.code === "composer_affinity_pick") {
    return "Complements your current scent direction";
  }

  if (explanation.code === "versatility_anchor") {
    return "Adds practical versatility";
  }

  if (explanation.code === "signature_anchor") {
    return "Adds signature potential";
  }

  if (explanation.code === "diversity_anchor") {
    return "Adds a distinct scent direction";
  }

  if (explanation.code === "composer_balance_pick") {
    return "Improves collection balance";
  }

  return "";
}

function getObjectiveReasonOptions(recommendation, objectiveKey) {
  const compatibilityReasons = recommendation?.objectiveReasons || [];

  if (compatibilityReasons.length > 0) {
    return compatibilityReasons.map((reason) => ({
      label: reason,
      category: "objective",
      priority: 0,
      topic: objectiveKey,
    }));
  }

  return getObjectiveCompatibilityScore(objectiveKey, recommendation?.perfume).reasons.map(
    (reason) => ({
      label: reason,
      category: "objective",
      priority: 0,
      topic: objectiveKey,
    })
  );
}

function createRecommendationReasonOption(reason) {
  const label = polishRecommendationReasonLabel(
    RECOMMENDATION_REASON_REWRITES[reason] || reason
  );

  if (!label) {
    return null;
  }

  const category = getRecommendationReasonCategory(label);

  return {
    label,
    category,
    priority: getRecommendationReasonPriority(category),
    topic: getRecommendationReasonTopic(label),
  };
}

function polishRecommendationReasonLabel(reason) {
  const missingDepthMatch = reason.match(/^Adds (.+) depth currently missing$/);

  if (missingDepthMatch) {
    return getAccordRecommendationCopy(missingDepthMatch[1].toLowerCase());
  }

  return reason;
}

function getFallbackRecommendationReasonOptions(recommendation) {
  const breakdown = recommendation?.scoreBreakdown || {};
  const perfume = recommendation?.perfume || {};
  const fallbackReasons = [];

  if (breakdown.seasons > 0) {
    const strongestSeason = getStrongestRecommendationSeason(perfume);
    fallbackReasons.push({
      label: strongestSeason
        ? getSeasonRecommendationCopy(strongestSeason)
        : "Improves seasonal balance",
      category: "coverage",
      priority: 1,
      topic: "season",
    });
  }

  if (breakdown.occasions > 0) {
    const occasion = getPreferredRecommendationOccasion(perfume);
    fallbackReasons.push({
      label: occasion
        ? getOccasionRecommendationCopy(occasion)
        : "Improves occasion coverage",
      category: "coverage",
      priority: 1,
      topic: "occasion",
    });
  }

  if (breakdown.vibes > 0) {
    const vibe = getPreferredRecommendationVibe(perfume);
    fallbackReasons.push({
      label: vibe ? getVibeRecommendationCopy(vibe) : "Adds a distinct scent mood",
      category: "balance",
      priority: 2,
      topic: "vibe",
    });
  }

  if (breakdown.accordDiversity > 0 || breakdown.sharedAccords > 0) {
    const accord = perfume.accords?.[0];
    fallbackReasons.push({
      label: accord ? getAccordRecommendationCopy(accord) : "Adds a new scent profile",
      category: "balance",
      priority: 2,
      topic: "accord",
    });
  }

  if (breakdown.sharedOccasions > 0) {
    const occasion = getPreferredRecommendationOccasion(perfume);
    fallbackReasons.push({
      label: occasion
        ? getOccasionRecommendationCopy(occasion)
        : "Adds another wearable option",
      category: "support",
      priority: 3,
      topic: "occasion",
    });
  }

  if (breakdown.sharedVibes > 0 || breakdown.sharedSeasons > 0) {
    const vibe = getPreferredRecommendationVibe(perfume);
    fallbackReasons.push({
      label: vibe ? getVibeRecommendationCopy(vibe) : "Adds a compatible scent profile",
      category: "affinity",
      priority: 4,
      topic: "vibe",
    });
  }

  if (breakdown.noteDiversity > 0) {
    fallbackReasons.push({
      label: "Expands the note palette",
      category: "balance",
      priority: 2,
      topic: "note",
    });
  }

  return fallbackReasons;
}

function getStrongestRecommendationSeason(perfume) {
  const weights = perfume.seasonWeights || {};
  const weightedSeason = Object.entries(weights)
    .filter(([, weight]) => weight > 0)
    .sort(([, weightA], [, weightB]) => weightB - weightA)[0]?.[0];

  return weightedSeason || perfume.seasons?.[0] || "";
}

function getPreferredRecommendationOccasion(perfume) {
  const priority = ["formal", "office", "date", "night", "evening", "daily", "casual"];

  return (
    priority.find((occasion) => perfume.occasions?.includes(occasion)) ||
    perfume.occasions?.[0] ||
    ""
  );
}

function getPreferredRecommendationVibe(perfume) {
  const priority = [
    "warm",
    "dark",
    "seductive",
    "elegant",
    "fresh",
    "clean",
    "energetic",
    "cozy",
    "tropical",
  ];

  return priority.find((vibe) => perfume.vibes?.includes(vibe)) || perfume.vibes?.[0] || "";
}

function getSeasonRecommendationCopy(season) {
  const copy = {
    spring: "Expands spring versatility",
    summer: "Expands warm-weather options",
    fall: "Adds fall-season range",
    winter: "Strengthens cold-weather coverage",
  };

  return copy[season] || `Expands ${formatRecommendationLabel(season)} coverage`;
}

function getOccasionRecommendationCopy(occasion) {
  const copy = {
    office: "Broadens office rotation",
    formal: "Strengthens formal versatility",
    date: "Adds date-night range",
    night: "Adds a darker evening profile",
    evening: "Adds evening versatility",
    daily: "Broadens daily rotation",
    casual: "Adds easy casual wear",
    club: "Adds a stronger night-out option",
    vacation: "Adds a relaxed travel option",
    special: "Adds special-occasion polish",
  };

  return copy[occasion] || `Improves ${formatRecommendationLabel(occasion)} coverage`;
}

function getVibeRecommendationCopy(vibe) {
  const copy = {
    fresh: "Adds fresh brightness",
    clean: "Adds clean versatility",
    warm: "Adds warmth",
    cozy: "Adds cozy depth",
    seductive: "Adds a seductive evening profile",
    dark: "Adds a darker profile",
    elegant: "Adds polished character",
    energetic: "Adds energetic lift",
    tropical: "Adds tropical brightness",
    aquatic: "Brings marine freshness",
    luxurious: "Adds luxury character",
    confident: "Adds confident presence",
    playful: "Adds playful contrast",
    romantic: "Adds romantic softness",
  };

  return copy[vibe] || `Adds ${formatRecommendationLabel(vibe)} character`;
}

function getAccordRecommendationCopy(accord) {
  const copy = {
    citrus: "Adds citrus brightness",
    fresh: "Adds fresh brightness",
    marine: "Brings marine freshness",
    aquatic: "Brings aquatic freshness",
    green: "Increases green freshness",
    woody: "Introduces woody depth",
    aromatic: "Expands aromatic lift",
    "fresh spicy": "Expands fresh-spicy variety",
    "warm spicy": "Expands warm-spicy depth",
    leather: "Adds leather depth",
    smoky: "Adds smoky depth",
    incense: "Adds incense depth",
    amber: "Adds amber warmth",
    vanilla: "Introduces a sweeter direction",
    sweet: "Introduces a sweeter direction",
    powdery: "Adds powdery elegance",
    musky: "Adds musky softness",
    iris: "Adds iris polish",
    floral: "Adds floral lift",
    fruity: "Adds fruity brightness",
    coffee: "Adds roasted depth",
    oud: "Adds niche woody depth",
    tobacco: "Adds tobacco depth",
    mineral: "Adds mineral contrast",
    ozonic: "Adds airy freshness",
    salty: "Adds salty freshness",
  };

  return copy[accord] || `Adds ${formatRecommendationLabel(accord)} character`;
}

function getRecommendationReasonCategory(reason) {
  if (
    /\b(matches|builds on|complements your|stays close|current|preferences|direction|style)\b/i.test(
      reason
    )
  ) {
    return "affinity";
  }

  if (
    /\b(coverage|season|spring|summer|fall|winter|occasion|office|formal|date|night|evening|daily|everyday|wear|versatility|range)\b/i.test(
      reason
    )
  ) {
    return "coverage";
  }

  if (
    /\b(balance|balances|contrast|depth|warmth|warm|cold|missing|underrepresented|diversity|variety|profile|dimension|polish|presence|comfort)\b/i.test(
      reason
    )
  ) {
    return "balance";
  }

  return "support";
}

function getRecommendationReasonPriority(category) {
  if (category === "coverage") {
    return 1;
  }

  if (category === "balance") {
    return 2;
  }

  if (category === "support") {
    return 3;
  }

  return 4;
}

function getRecommendationReasonTopic(reason) {
  if (/\b(spring|summer|fall|winter|season|coverage)\b/i.test(reason)) {
    return "season";
  }

  if (/\b(office|formal|date|night|evening|daily|everyday|occasion|wear)\b/i.test(reason)) {
    return "occasion";
  }

  if (/\b(vibe|mood|profile|direction|style)\b/i.test(reason)) {
    return "vibe";
  }

  if (/\b(accord|woody|aromatic|citrus|fresh|spicy|leather|sweet)\b/i.test(reason)) {
    return "accord";
  }

  if (/\b(note|palette)\b/i.test(reason)) {
    return "note";
  }

  return "";
}

function normalizeRecommendationReason(reason) {
  return reason.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function getRecommendationReasonConcept(reason) {
  if (/\b(citrus|fresh|marine|aquatic|green|airy|salty|warm-weather)\b/i.test(reason)) {
    return "freshness";
  }

  if (/\b(warm|amber|cold-weather|winter|cozy)\b/i.test(reason)) {
    return "warmth";
  }

  if (/\b(date|night|evening|night-out|seductive|darker)\b/i.test(reason)) {
    return "evening";
  }

  if (/\b(office|formal|polished|polish)\b/i.test(reason)) {
    return "polish";
  }

  if (/\b(woody|leather|smoky|incense|oud|roasted|depth)\b/i.test(reason)) {
    return "depth";
  }

  return "";
}

function formatRecommendationLabel(value = "") {
  return value
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}
