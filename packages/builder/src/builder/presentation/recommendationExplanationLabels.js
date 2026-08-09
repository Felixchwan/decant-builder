import { getObjectiveCompatibilityScore } from "../internal/intelligence/buildCollectionIntelligenceViewModel.js";
import { getObjectiveReasonLabel } from "./collectionIntelligenceLabels.js";

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

export function getRecommendationDisplayReasons({ recommendation, objectiveKey, translator } = {}) {
  const explanationReasons = Array.isArray(recommendation?.explanations)
    ? recommendation.explanations
        .map((explanation) => createRecommendationExplanationOption(explanation, translator))
        .filter(Boolean)
    : [];
  const reasons = Array.isArray(recommendation?.reasons) ? recommendation.reasons : [];
  const objectiveReasons = objectiveKey
    ? getObjectiveReasonOptions(recommendation, objectiveKey, translator)
    : [];
  const reasonOptions = [
    ...objectiveReasons,
    ...explanationReasons,
    ...reasons.map((reason) => createRecommendationReasonOption(reason, translator)),
    ...getFallbackRecommendationReasonOptions(recommendation, translator),
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

export function getRecommendationConfidenceLabel(recommendation, translator) {
  const confidence = getRecommendationConfidence(recommendation);
  return translator?.t?.(`recommendation.confidence.${confidence.toLowerCase()}`) || confidence;
}

function createRecommendationExplanationOption(explanation, translator) {
  const label = getRecommendationExplanationLabel(explanation, translator);

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

export function getRecommendationExplanationLabel(explanation = {}, translator) {
  const evidence = explanation.evidence || {};

  if (explanation.code === "expand_occasion_coverage" && evidence.missingOccasion) {
    return getOccasionRecommendationCopy(evidence.missingOccasion, translator);
  }

  if (explanation.code?.startsWith("expand_") && explanation.code?.endsWith("_coverage")) {
    const season =
      evidence.missingSeason ||
      explanation.code.replace(/^expand_/, "").replace(/_coverage$/, "");

    return getSeasonRecommendationCopy(season, translator);
  }

  if (explanation.code === "support_requested_preferences") {
    const firstPreference = evidence.unmatched?.[0];

    if (firstPreference?.domain === "seasons") {
      return getSeasonRecommendationCopy(firstPreference.preference, translator);
    }

    if (firstPreference?.domain === "occasions") {
      return getOccasionRecommendationCopy(firstPreference.preference, translator);
    }

    if (firstPreference?.domain === "vibes") {
      return getVibeRecommendationCopy(firstPreference.preference, translator);
    }

    return translator?.t?.("recommendation.supportsPreferences") || "Supports requested preferences";
  }

  if (explanation.code === "coverage_anchor") {
    return translator?.t?.("recommendation.coverageAnchor") || "Improves multiple coverage gaps";
  }

  if (explanation.code === "preference_anchor" || explanation.code === "composer_affinity_pick") {
    return translator?.t?.("recommendation.affinityAnchor") || "Complements your current scent direction";
  }

  if (explanation.code === "versatility_anchor") {
    return translator?.t?.("recommendation.versatilityAnchor") || "Adds practical versatility";
  }

  if (explanation.code === "signature_anchor") {
    return translator?.t?.("recommendation.signatureAnchor") || "Adds signature potential";
  }

  if (explanation.code === "diversity_anchor") {
    return translator?.t?.("recommendation.diversityAnchor") || "Adds a distinct scent direction";
  }

  if (explanation.code === "composer_balance_pick") {
    return translator?.t?.("recommendation.balancePick") || "Improves collection balance";
  }

  return "";
}

function getObjectiveReasonOptions(recommendation, objectiveKey, translator) {
  const compatibilityReasons = recommendation?.objectiveReasons || [];

  if (compatibilityReasons.length > 0) {
    return compatibilityReasons.map((reason) => ({
      label: getObjectiveReasonLabel(reason, translator),
      category: "objective",
      priority: 0,
      topic: objectiveKey,
    }));
  }

  return getObjectiveCompatibilityScore(objectiveKey, recommendation?.perfume).reasons.map(
    (reason) => ({
      label: getObjectiveReasonLabel(reason, translator),
      category: "objective",
      priority: 0,
      topic: objectiveKey,
    })
  );
}

function createRecommendationReasonOption(reason, translator) {
  const label = polishRecommendationReasonLabel(
    RECOMMENDATION_REASON_REWRITES[reason] || reason,
    translator
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

function polishRecommendationReasonLabel(reason, translator) {
  const missingDepthMatch = reason.match(/^Adds (.+) depth currently missing$/);

  if (missingDepthMatch) {
    return getAccordRecommendationCopy(missingDepthMatch[1].toLowerCase(), translator);
  }

  return getRewriteTranslation(reason, translator) || reason;
}

function getFallbackRecommendationReasonOptions(recommendation, translator) {
  const breakdown = recommendation?.scoreBreakdown || {};
  const perfume = recommendation?.perfume || {};
  const fallbackReasons = [];

  if (breakdown.seasons > 0) {
    const strongestSeason = getStrongestRecommendationSeason(perfume);
    fallbackReasons.push({
      label: strongestSeason
        ? getSeasonRecommendationCopy(strongestSeason, translator)
        : translator?.t?.("recommendation.balancePick") || "Improves seasonal balance",
      category: "coverage",
      priority: 1,
      topic: "season",
    });
  }

  if (breakdown.occasions > 0) {
    const occasion = getPreferredRecommendationOccasion(perfume);
    fallbackReasons.push({
      label: occasion
        ? getOccasionRecommendationCopy(occasion, translator)
        : translator?.t?.("recommendation.occasionFallback", { value: "occasion" }) || "Improves occasion coverage",
      category: "coverage",
      priority: 1,
      topic: "occasion",
    });
  }

  if (breakdown.vibes > 0) {
    const vibe = getPreferredRecommendationVibe(perfume);
    fallbackReasons.push({
      label: vibe ? getVibeRecommendationCopy(vibe, translator) : translator?.t?.("recommendation.diversityAnchor") || "Adds a distinct scent mood",
      category: "balance",
      priority: 2,
      topic: "vibe",
    });
  }

  if (breakdown.accordDiversity > 0 || breakdown.sharedAccords > 0) {
    const accord = perfume.accords?.[0];
    fallbackReasons.push({
      label: accord ? getAccordRecommendationCopy(accord, translator) : translator?.t?.("recommendation.newProfile") || "Adds a new scent profile",
      category: "balance",
      priority: 2,
      topic: "accord",
    });
  }

  if (breakdown.sharedOccasions > 0) {
    const occasion = getPreferredRecommendationOccasion(perfume);
    fallbackReasons.push({
      label: occasion
        ? getOccasionRecommendationCopy(occasion, translator)
        : translator?.t?.("recommendation.wearableOption") || "Adds another wearable option",
      category: "support",
      priority: 3,
      topic: "occasion",
    });
  }

  if (breakdown.sharedVibes > 0 || breakdown.sharedSeasons > 0) {
    const vibe = getPreferredRecommendationVibe(perfume);
    fallbackReasons.push({
      label: vibe ? getVibeRecommendationCopy(vibe, translator) : translator?.t?.("recommendation.compatibleProfile") || "Adds a compatible scent profile",
      category: "affinity",
      priority: 4,
      topic: "vibe",
    });
  }

  if (breakdown.noteDiversity > 0) {
    fallbackReasons.push({
      label: translator?.t?.("recommendation.notePalette") || "Expands the note palette",
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

function getSeasonRecommendationCopy(season, translator) {
  const copy = {
    spring: "Expands spring versatility",
    summer: "Expands warm-weather options",
    fall: "Adds fall-season range",
    winter: "Strengthens cold-weather coverage",
  };

  const displayValue = formatRecommendationLabel(season);
  return (
    translateRecommendationKey(translator, `recommendation.season.${toTranslationKey(season)}`) ||
    copy[season] ||
    translateRecommendationKey(translator, "recommendation.seasonFallback", { value: displayValue }) ||
    `Expands ${displayValue} coverage`
  );
}

function getOccasionRecommendationCopy(occasion, translator) {
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

  const displayValue = formatRecommendationLabel(occasion);
  return (
    translateRecommendationKey(translator, `recommendation.occasion.${toTranslationKey(occasion)}`) ||
    copy[occasion] ||
    translateRecommendationKey(translator, "recommendation.occasionFallback", { value: displayValue }) ||
    `Improves ${displayValue} coverage`
  );
}

function getVibeRecommendationCopy(vibe, translator) {
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

  const displayValue = formatRecommendationLabel(vibe);
  return (
    translateRecommendationKey(translator, `recommendation.vibe.${toTranslationKey(vibe)}`) ||
    copy[vibe] ||
    translateRecommendationKey(translator, "recommendation.vibeFallback", { value: displayValue }) ||
    `Adds ${displayValue} character`
  );
}

function getAccordRecommendationCopy(accord, translator) {
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

  const displayValue = formatRecommendationLabel(accord);
  return (
    translateRecommendationKey(translator, `recommendation.accord.${toTranslationKey(accord)}`) ||
    copy[accord] ||
    translateRecommendationKey(translator, "recommendation.accordFallback", { value: displayValue }) ||
    `Adds ${displayValue} character`
  );
}

function translateRecommendationKey(translator, key, values) {
  const translated = translator?.t?.(key, values);
  return translated && translated !== key ? translated : "";
}

function getRewriteTranslation(reason, translator) {
  const translations = {
    "Improves multiple coverage gaps": "recommendation.addsHighImpactCoverage",
    "Adds contrast to your current collection": "recommendation.currentContrast",
  };

  const key = translations[reason];
  return key ? translator?.t?.(key) : "";
}

function toTranslationKey(value = "") {
  return String(value).replace(/\s+/g, "_");
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
