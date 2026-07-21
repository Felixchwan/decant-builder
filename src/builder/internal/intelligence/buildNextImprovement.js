const MAX_RECOMMENDATION_EXPLANATIONS = 3;

export function buildNextImprovementResult({
  intelligence,
  selectedPerfumes,
  balanceRecommendations,
  selectedCount,
  isBoxFull,
}) {
  const recommendations = Array.isArray(balanceRecommendations)
    ? balanceRecommendations
    : [];

  if (recommendations.length === 0 && selectedCount === 0) {
    return null;
  }

  const objectivePriorities = getObjectiveUrgencies({
    intelligence,
    selectedPerfumes,
    selectedCount,
  });
  const objectiveResult =
    getHighestPriorityObjectiveResult(objectivePriorities, recommendations) || {
      objectiveKey: objectivePriorities[0]?.objectiveKey || "contrast",
      urgency: objectivePriorities[0]?.urgency || 0,
      recommendations: [],
    };
  const primaryRecommendation = objectiveResult.recommendations[0];
  const guidance = buildNextImprovementGuidance({
    objectiveKey: objectiveResult.objectiveKey,
    mainGap: intelligence.mainGap,
    bestNextMove: intelligence.bestNextMove,
    profile: intelligence.dominantProfile,
    coverage: intelligence.strongestCoverage,
    recommendation: primaryRecommendation,
    selectedCount,
    isBoxFull,
  });

  if (!guidance) {
    return null;
  }

  return {
    objectiveKey: objectiveResult.objectiveKey,
    objectiveUrgency: objectiveResult.urgency,
    title: guidance.title,
    description: guidance.description,
    eyebrow: guidance.eyebrow,
    recommendations: objectiveResult.recommendations,
    primaryRecommendation,
  };
}

const OBJECTIVE_DEFINITIONS = {
  freshDaytime: {
    baseImportance: 74,
    signals: {
      accords: ["citrus", "fresh", "green", "marine", "aquatic", "aromatic"],
      vibes: ["fresh", "clean", "green", "bright", "sporty", "easy"],
      occasions: ["daily", "office", "casual"],
      seasons: ["spring", "summer"],
    },
    reasons: {
      accords: "Adds fresh daytime contrast",
      vibes: "Adds fresh daytime contrast",
      occasions: "Broadens daily rotation",
      seasons: "Improves warm-weather versatility",
    },
  },
  coldWeather: {
    baseImportance: 76,
    signals: {
      accords: ["warm spicy", "amber", "vanilla", "tobacco", "woody", "sweet", "smoky", "leather"],
      vibes: ["warm", "seductive", "cozy", "dark", "bold"],
      occasions: ["date", "night", "evening", "formal"],
      seasons: ["fall", "winter"],
    },
    reasons: {
      accords: "Adds warm evening depth",
      vibes: "Adds warm evening depth",
      occasions: "Adds evening range",
      seasons: "Strengthens cold-weather coverage",
    },
  },
  formal: {
    baseImportance: 68,
    signals: {
      accords: ["woody", "iris", "leather", "powdery", "aromatic"],
      vibes: ["elegant", "sophisticated", "classic", "smooth"],
      occasions: ["formal", "office", "special"],
      seasons: ["spring", "fall"],
    },
    reasons: {
      accords: "Adds polished formal range",
      vibes: "Adds polished formal range",
      occasions: "Improves dressed-up versatility",
      seasons: "Broadens formal-season range",
    },
  },
  evening: {
    baseImportance: 66,
    signals: {
      accords: ["amber", "vanilla", "warm spicy", "leather", "sweet", "smoky"],
      vibes: ["seductive", "bold", "dark", "warm", "intense"],
      occasions: ["date", "night", "evening", "club", "special"],
      seasons: ["fall", "winter"],
    },
    reasons: {
      accords: "Adds a stronger after-dark profile",
      vibes: "Adds a stronger after-dark profile",
      occasions: "Adds evening range",
      seasons: "Strengthens night-out seasonality",
    },
  },
  contrast: {
    baseImportance: 58,
    signals: {
      accords: ["woody", "leather", "green", "marine", "citrus", "amber", "iris"],
      vibes: ["unique", "bold", "fresh", "warm", "elegant", "artistic"],
      occasions: ["daily", "date", "formal", "special"],
      seasons: ["spring", "summer", "fall", "winter"],
    },
    reasons: {
      accords: "Adds a distinct scent direction",
      vibes: "Adds a distinct scent direction",
      occasions: "Expands wearable range",
      seasons: "Broadens seasonal range",
    },
  },
};

const OBJECTIVE_KEYS = ["freshDaytime", "coldWeather", "formal", "evening", "contrast"];
const OBJECTIVE_DIMINISHING_RETURNS = [1, 0.55, 0.25, 0.1, 0.05];
const OBJECTIVE_SIGNAL_WEIGHTS = {
  accords: 0.34,
  vibes: 0.28,
  occasions: 0.23,
  seasons: 0.15,
};
const OBJECTIVE_MIN_COMPATIBILITY = 0.45;
const OBJECTIVE_SWITCH_MARGIN = 4;

function getObjectiveUrgencies({ intelligence, selectedPerfumes, selectedCount }) {
  const strongestObjective = getObjectiveFromGap({
    mainGap: intelligence.mainGap,
    bestNextMove: intelligence.bestNextMove,
  });
  const objectiveCoverages = Object.fromEntries(
    OBJECTIVE_KEYS.map((objectiveKey) => [
      objectiveKey,
      getObjectiveCoverage(selectedPerfumes, OBJECTIVE_DEFINITIONS[objectiveKey]),
    ])
  );
  const warmCoverage = objectiveCoverages.coldWeather?.saturation || 0;
  const freshCoverage = objectiveCoverages.freshDaytime?.saturation || 0;
  const contextMultiplier = (objectiveKey) => {
    if (selectedCount === 0 && objectiveKey === "contrast") {
      return 1.9;
    }

    if (objectiveKey === "freshDaytime" && warmCoverage > freshCoverage + 0.18) {
      return 1.18;
    }

    if (objectiveKey === "coldWeather" && freshCoverage > warmCoverage + 0.18) {
      return 1.18;
    }

    if (objectiveKey === "formal" && selectedCount >= 3) {
      return 1.12;
    }

    if (objectiveKey === strongestObjective) {
      return 1.08;
    }

    return 1;
  };
  const urgencyByObjective = OBJECTIVE_KEYS.map((objectiveKey) => {
    const definition = OBJECTIVE_DEFINITIONS[objectiveKey];
    const coverage = objectiveCoverages[objectiveKey];
    const missingCoverage = 1 - coverage.saturation;
    const rawUrgency =
      definition.baseImportance *
      missingCoverage *
      contextMultiplier(objectiveKey);

    return {
      objectiveKey,
      coverage,
      missingCoverage,
      urgency: rawUrgency,
    };
  });

  return urgencyByObjective
    .map((objective) => ({
      ...objective,
      urgency: Math.max(0, Math.round(objective.urgency)),
    }))
    .sort((a, b) => b.urgency - a.urgency || a.objectiveKey.localeCompare(b.objectiveKey));
}

function getHighestPriorityObjectiveResult(objectivePriorities, recommendations) {
  const viableResults = objectivePriorities
    .map((objective) => {
      const result = getCompatibleRecommendationResult(
        objective.objectiveKey,
        recommendations,
        objective.urgency
      );

      return result
        ? {
            ...result,
            coverage: objective.coverage,
            missingCoverage: objective.missingCoverage,
            urgency: objective.urgency,
          }
        : null;
    })
    .filter(Boolean);

  return viableResults.sort((a, b) => {
    const urgencyDelta = b.urgency - a.urgency;

    if (Math.abs(urgencyDelta) > OBJECTIVE_SWITCH_MARGIN) {
      return urgencyDelta;
    }

    return (
      b.missingCoverage - a.missingCoverage ||
      b.recommendations[0].objectiveCompatibilityScore -
        a.recommendations[0].objectiveCompatibilityScore ||
      b.recommendations[0].finalScore - a.recommendations[0].finalScore ||
      a.objectiveKey.localeCompare(b.objectiveKey)
    );
  })[0];
}

function buildNextImprovementGuidance({
  objectiveKey,
  mainGap,
  bestNextMove,
  profile,
  coverage,
  recommendation,
  selectedCount,
  isBoxFull,
}) {
  if (isBoxFull) {
    return {
      eyebrow: "NEXT IMPROVEMENT",
      title: "Box complete",
      description:
        "Your Discovery Box is full. Use the recommendation below only as a comparison point for future swaps.",
    };
  }

  if (selectedCount === 0) {
    return {
      eyebrow: "STARTER DIRECTION",
      title: "Start with a versatile anchor",
      description:
        "Choose a first fragrance that gives the box a clear center. The recommendation below is a strong opening pick.",
    };
  }

  const recommendationName = recommendation?.perfume?.shortName || recommendation?.perfume?.name;
  const moveTitle = getObjectiveTitle(objectiveKey, bestNextMove, mainGap);
  const profilePhrase =
    selectedCount < 3
      ? getEarlyProfilePhrase(profile)
      : getProfileGuidancePhrase(profile, coverage);
  const improvementPhrase = getImprovementGuidancePhrase(
    objectiveKey,
    mainGap,
    bestNextMove,
    recommendationName
  );

  return {
    eyebrow: selectedCount < 3 ? "EARLY OPPORTUNITY" : "NEXT IMPROVEMENT",
    title: moveTitle,
    description: `${profilePhrase} ${improvementPhrase}`,
  };
}

function getObjectiveFromGap({ mainGap, bestNextMove }) {
  if (mainGap?.type === "winter" || mainGap?.type === "warmth") {
    return "coldWeather";
  }

  if (mainGap?.type === "formal") {
    return "formal";
  }

  if (mainGap?.type === "summer") {
    return "freshDaytime";
  }

  if (mainGap?.type === "evening") {
    return "evening";
  }

  if (/fresh daytime/i.test(bestNextMove || "")) {
    return "freshDaytime";
  }

  if (/warm|winter|cold/i.test(bestNextMove || "")) {
    return "coldWeather";
  }

  if (/formal|woody/i.test(bestNextMove || "")) {
    return "formal";
  }

  if (mainGap?.type === "diversity") {
    return "contrast";
  }

  return "contrast";
}

function getCompatibleRecommendationResult(objectiveKey, recommendations, urgency = 0) {
  const compatibleRecommendations = recommendations
    .map((recommendation) => ({
      recommendation,
      compatibility: getObjectiveCompatibilityScore(
        objectiveKey,
        recommendation.perfume
      ),
    }))
    .filter(({ compatibility }) => compatibility.normalizedScore >= OBJECTIVE_MIN_COMPATIBILITY)
    .sort(
      (a, b) =>
        b.compatibility.normalizedScore * Math.max(1, urgency / 20) -
          a.compatibility.normalizedScore * Math.max(1, urgency / 20) ||
        b.recommendation.finalScore - a.recommendation.finalScore ||
        b.recommendation.score - a.recommendation.score ||
        a.recommendation.perfume.name.localeCompare(b.recommendation.perfume.name)
    )
    .map(({ recommendation, compatibility }) =>
      applyObjectiveRecommendationReasons(recommendation, objectiveKey, compatibility)
    );

  if (compatibleRecommendations.length === 0) {
    return null;
  }

  return {
    objectiveKey,
    urgency,
    recommendations: compatibleRecommendations,
  };
}

export function getObjectiveCompatibilityScore(objectiveKey, perfume) {
  const definition = OBJECTIVE_DEFINITIONS[objectiveKey] || OBJECTIVE_DEFINITIONS.contrast;
  const signalMatch = getObjectiveSignalMatch(perfume, definition);
  const reasons = [];

  signalMatch.groups.forEach((group) => {
    const reason = definition.reasons[group];

    if (reason) {
      reasons.push(reason);
    }
  });

  return {
    score: Math.round(signalMatch.normalizedScore * 10),
    normalizedScore: signalMatch.normalizedScore,
    reasons: uniqueStrings(reasons).slice(0, MAX_RECOMMENDATION_EXPLANATIONS),
  };
}

function getObjectiveCoverage(selectedPerfumes, definition) {
  const matches = (selectedPerfumes || [])
    .map((perfume) => getObjectiveSignalMatch(perfume, definition))
    .filter((match) => match.normalizedScore > 0)
    .sort((a, b) => b.normalizedScore - a.normalizedScore);
  const weightedContribution = matches.reduce((sum, match, index) => {
    const weight =
      OBJECTIVE_DIMINISHING_RETURNS[
        Math.min(index, OBJECTIVE_DIMINISHING_RETURNS.length - 1)
      ];

    return sum + match.normalizedScore * weight;
  }, 0);
  const matchedGroups = new Set(matches.flatMap((match) => match.groups));
  const matchedSignals = new Set(matches.flatMap((match) => match.signals));
  const diversityBonus = Math.min(
    0.14,
    matchedGroups.size * 0.03 + matchedSignals.size * 0.004
  );
  const saturation = clamp01(weightedContribution * 0.68 + diversityBonus);

  return {
    saturation,
    weightedContribution,
    diversityBonus,
    matchedGroups: [...matchedGroups],
    matchedSignals: [...matchedSignals],
  };
}

function getObjectiveSignalMatch(perfume, definition) {
  const groups = [];
  const signals = [];
  const weightedScore = Object.entries(OBJECTIVE_SIGNAL_WEIGHTS).reduce(
    (sum, [group, weight]) => {
      const perfumeValues = new Set(perfume?.[group] || []);
      const definitionValues = definition.signals[group] || [];
      const matches = definitionValues.filter((value) => perfumeValues.has(value));

      if (matches.length === 0) {
        return sum;
      }

      groups.push(group);
      signals.push(...matches);

      const density = Math.min(1, matches.length / Math.min(3, definitionValues.length));
      return sum + weight * (0.72 + density * 0.28);
    },
    0
  );

  return {
    normalizedScore: clamp01(weightedScore),
    groups,
    signals: uniqueStrings(signals),
  };
}

function clamp01(value) {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
}

function applyObjectiveRecommendationReasons(recommendation, objectiveKey, compatibility) {
  return {
    ...recommendation,
    objectiveKey,
    objectiveCompatibilityScore: compatibility.score,
    objectiveReasons: compatibility.reasons,
  };
}

function getObjectiveTitle(objectiveKey, bestNextMove, mainGap) {
  const normalizedMove = bestNextMove
    ?.replace(/^Add one\s+/i, "")
    .replace(/^Add a\s+/i, "")
    .replace(/^Add an\s+/i, "")
    .replace(/^Add\s+/i, "")
    .trim();

  if (objectiveKey === getObjectiveFromGap({ mainGap, bestNextMove }) && normalizedMove) {
    return `Add ${normalizedMove.charAt(0).toLowerCase()}${normalizedMove.slice(1)}`;
  }

  if (objectiveKey === "coldWeather") {
    return "Add warm evening depth";
  }

  if (objectiveKey === "formal") {
    return "Expand formal versatility";
  }

  if (objectiveKey === "freshDaytime") {
    return "Add fresh daytime contrast";
  }

  if (objectiveKey === "evening") {
    return "Add a stronger evening profile";
  }

  if (objectiveKey === "contrast") {
    return "Add a contrasting profile";
  }

  return "Add a clearer contrast";
}

function getEarlyProfilePhrase(profile) {
  if (!profile || profile === "Still taking shape") {
    return "Your box is just beginning to form a profile.";
  }

  return `Your box is beginning to lean ${profile.toLowerCase()}.`;
}

function getProfileGuidancePhrase(profile, coverage) {
  if (profile === "Balanced and versatile") {
    return `Your box already reads balanced, with ${coverage.toLowerCase()}.`;
  }

  if (profile) {
    return `Your box is currently strongest as ${profile.toLowerCase()}.`;
  }

  return "Your box has a clear starting point.";
}

function getImprovementGuidancePhrase(
  objectiveKey,
  mainGap,
  bestNextMove,
  recommendationName
) {
  const recommendationCopy = recommendationName
    ? `${recommendationName} is the pick that best answers that opportunity.`
    : "The next recommendation is chosen to answer that opportunity.";

  if (objectiveKey === "coldWeather") {
    return `A warmer evening addition would add depth and improve cold-weather range. ${recommendationCopy}`;
  }

  if (objectiveKey === "formal") {
    return `A polished formal fragrance would make the box more useful for dressed-up occasions. ${recommendationCopy}`;
  }

  if (objectiveKey === "freshDaytime") {
    return `A brighter daytime fragrance would add contrast and improve warm-weather versatility. ${recommendationCopy}`;
  }

  if (objectiveKey === "evening") {
    return `A stronger evening profile would make the box feel more complete after dark. ${recommendationCopy}`;
  }

  if (objectiveKey === "contrast") {
    return `A contrasting scent direction would prevent the box from feeling too similar. ${recommendationCopy}`;
  }

  if (/fresh daytime/i.test(bestNextMove || "")) {
    return `A brighter daytime fragrance would add contrast and improve versatility. ${recommendationCopy}`;
  }

  return `A clearer contrast would make the box more versatile without changing its core style. ${recommendationCopy}`;
}


function uniqueStrings(values) {
  return [...new Set(values.filter(Boolean))];
}
