const OBJECTIVE_REASON_KEYS = {
  "Adds fresh daytime contrast": "collectionIntelligence.reason.freshDaytimeContrast",
  "Broadens daily rotation": "collectionIntelligence.reason.broadensDailyRotation",
  "Improves warm-weather versatility": "collectionIntelligence.reason.warmWeatherVersatility",
  "Adds warm evening depth": "collectionIntelligence.reason.warmEveningDepth",
  "Adds evening range": "collectionIntelligence.reason.eveningRange",
  "Strengthens cold-weather coverage": "collectionIntelligence.reason.coldWeatherCoverage",
  "Adds polished formal range": "collectionIntelligence.reason.polishedFormalRange",
  "Improves dressed-up versatility": "collectionIntelligence.reason.dressedUpVersatility",
  "Broadens formal-season range": "collectionIntelligence.reason.formalSeasonRange",
  "Adds a stronger after-dark profile": "collectionIntelligence.reason.afterDarkProfile",
  "Strengthens night-out seasonality": "collectionIntelligence.reason.nightOutSeasonality",
  "Adds a distinct scent direction": "collectionIntelligence.reason.distinctScentDirection",
  "Expands wearable range": "collectionIntelligence.reason.wearableRange",
  "Broadens seasonal range": "collectionIntelligence.reason.seasonalRange",
};

// buildNextImprovement.js's getObjectiveTitle() has one branch (no titleCode,
// see that file) that echoes the gap-detection system's own raw English text
// because that same text is also regex-matched internally as an engine
// signal. Translating the display copy there without first decoupling the
// engine's matching logic from its display text would risk silently breaking
// that matching, so it intentionally stays untranslated for this sprint —
// known localization debt, not an oversight. Every other titleCode below is
// a clean, static fallback with no such coupling.
const OBJECTIVE_TITLE_KEYS = {
  warmEveningDepth: "collectionIntelligence.title.warmEveningDepth",
  expandFormalVersatility: "collectionIntelligence.title.expandFormalVersatility",
  freshDaytimeContrast: "collectionIntelligence.title.freshDaytimeContrast",
  strongerEveningProfile: "collectionIntelligence.title.strongerEveningProfile",
  contrastingProfile: "collectionIntelligence.title.contrastingProfile",
  clearerContrast: "collectionIntelligence.title.clearerContrast",
  boxComplete: "collectionIntelligence.title.boxComplete",
  starterAnchor: "collectionIntelligence.title.starterAnchor",
};

const NEXT_IMPROVEMENT_EYEBROW_KEYS = {
  nextImprovement: "collectionIntelligence.eyebrow.nextImprovement",
  starterDirection: "collectionIntelligence.eyebrow.starterDirection",
  earlyOpportunity: "collectionIntelligence.eyebrow.earlyOpportunity",
};

const DOMINANT_PROFILE_KEYS = {
  "Balanced and versatile": "collectionIntelligence.profile.balancedVersatile",
  "Warm and evening-oriented": "collectionIntelligence.profile.warmEveningOriented",
  "Sweet and seductive": "collectionIntelligence.profile.sweetSeductive",
  "Woody and sophisticated": "collectionIntelligence.profile.woodySophisticated",
  "Fresh-heavy": "collectionIntelligence.profile.freshHeavy",
  "Still taking shape": "collectionIntelligence.profile.stillTakingShape",
};

const SEASON_STRENGTH_LEVEL_KEYS = {
  dominant: "collectionIntelligence.strengthLevel.dominant",
  excellent: "collectionIntelligence.strengthLevel.excellent",
  strong: "collectionIntelligence.strengthLevel.strong",
  moderate: "collectionIntelligence.strengthLevel.moderate",
  weak: "collectionIntelligence.strengthLevel.weak",
};

const SEASON_NAME_KEYS = {
  spring: "collectionIntelligence.season.spring",
  summer: "collectionIntelligence.season.summer",
  fall: "collectionIntelligence.season.fall",
  winter: "collectionIntelligence.season.winter",
};

const OCCASION_COVERAGE_KEYS = {
  "Strong office versatility": "collectionIntelligence.coverage.officeVersatility",
  "Strong date-night profile": "collectionIntelligence.coverage.dateNightProfile",
  "Strong daily versatility": "collectionIntelligence.coverage.dailyVersatility",
  "Strong formal coverage": "collectionIntelligence.coverage.formalCoverage",
  "Profile still developing": "collectionIntelligence.coverage.stillDeveloping",
};

const COVERAGE_STRENGTH_STRONG = "collectionIntelligence.coverageStrength.strong";
const COVERAGE_STRENGTH_COVERED = "collectionIntelligence.coverageStrength.covered";
const COVERAGE_SUGGESTION_ADD = "collectionIntelligence.coverageSuggestion.add";
const COVERAGE_GAP_RECOMMENDED = "collectionIntelligence.coverageGap.recommended";

const BALANCE_DIMENSION_KEYS = {
  Versatility: "collectionIntelligence.balance.versatility",
  Depth: "collectionIntelligence.balance.depth",
  Freshness: "collectionIntelligence.balance.freshness",
  "Season Balance": "collectionIntelligence.balance.seasonBalance",
  "Signature Potential": "collectionIntelligence.balance.signaturePotential",
};

export function getBalanceDimensionLabel(label, translator) {
  const key = BALANCE_DIMENSION_KEYS[label];
  return key ? translate(translator, key, undefined, label) : label;
}

const IMPROVEMENT_PHRASE_KEYS = {
  coldWeather: "collectionIntelligence.improvement.coldWeather",
  formal: "collectionIntelligence.improvement.formal",
  freshDaytime: "collectionIntelligence.improvement.freshDaytime",
  evening: "collectionIntelligence.improvement.evening",
  contrast: "collectionIntelligence.improvement.contrast",
};

function translate(translator, key, values, fallback) {
  const translated = translator?.t?.(key, values);
  return translated && translated !== key ? translated : fallback;
}

export function getObjectiveReasonLabel(reason, translator) {
  const key = OBJECTIVE_REASON_KEYS[reason];
  return key ? translate(translator, key, undefined, reason) : reason;
}

export function getDominantProfileLabel(profile, translator) {
  const key = DOMINANT_PROFILE_KEYS[profile];
  return key ? translate(translator, key, undefined, profile) : profile;
}

export function getStrongestCoverageLabel(coverage, translator) {
  const directKey = OCCASION_COVERAGE_KEYS[coverage];
  if (directKey) {
    return translate(translator, directKey, undefined, coverage);
  }

  const seasonMatch = /^(Dominant|Excellent|Strong|Moderate|Weak) (spring|summer|fall|winter) coverage$/.exec(
    coverage
  );

  if (!seasonMatch) {
    return coverage;
  }

  const [, strengthWord, seasonWord] = seasonMatch;
  const strengthLabel = translate(
    translator,
    SEASON_STRENGTH_LEVEL_KEYS[strengthWord.toLowerCase()],
    undefined,
    strengthWord
  );
  const seasonLabel = translate(translator, SEASON_NAME_KEYS[seasonWord], undefined, seasonWord);
  const composed = translate(
    translator,
    "collectionIntelligence.coverage.seasonTemplate",
    { strength: strengthLabel, season: seasonLabel },
    null
  );

  return composed || coverage;
}

export function getBoxIntelligenceProfileLabel(isEarly, translator) {
  const key = isEarly
    ? "collectionIntelligence.field.earlyProfile"
    : "collectionIntelligence.field.dominantProfile";
  return translate(translator, key, undefined, isEarly ? "Early profile" : "Dominant profile");
}

export function getBoxIntelligenceCoverageLabel(translator) {
  return translate(
    translator,
    "collectionIntelligence.field.strongestCoverage",
    undefined,
    "Strongest coverage"
  );
}

export function getCoverageStrengthLabel({ category, target, level }, translator) {
  const targetLabel = translator?.label ? translator.label(category, target) : target;
  const key = level === "strong" ? COVERAGE_STRENGTH_STRONG : COVERAGE_STRENGTH_COVERED;
  return translate(translator, key, { target: targetLabel }, null);
}

export function getCoverageSuggestionLabel({ category, target }, translator) {
  const targetLabel = translator?.label ? translator.label(category, target) : target;
  return translate(translator, COVERAGE_SUGGESTION_ADD, { target: targetLabel }, null);
}

export function getCoverageGapLabel({ category, target }, translator) {
  const targetLabel = translator?.label ? translator.label(category, target) : target;
  return translate(translator, COVERAGE_GAP_RECOMMENDED, { target: targetLabel }, null);
}

function getProfilePhraseLabel(profilePhraseCode, profile, coverage, translator) {
  const profileLabel = getDominantProfileLabel(profile, translator).toLowerCase();
  const coverageLabel = coverage ? getStrongestCoverageLabel(coverage, translator).toLowerCase() : "";

  if (profilePhraseCode === "earlyForming") {
    return translate(
      translator,
      "collectionIntelligence.profilePhrase.earlyForming",
      undefined,
      null
    );
  }

  if (profilePhraseCode === "earlyLeaning") {
    return translate(
      translator,
      "collectionIntelligence.profilePhrase.earlyLeaning",
      { profile: profileLabel },
      null
    );
  }

  if (profilePhraseCode === "balancedAlready") {
    return translate(
      translator,
      "collectionIntelligence.profilePhrase.balancedAlready",
      { coverage: coverageLabel },
      null
    );
  }

  if (profilePhraseCode === "currentlyStrongest") {
    return translate(
      translator,
      "collectionIntelligence.profilePhrase.currentlyStrongest",
      { profile: profileLabel },
      null
    );
  }

  return translate(translator, "collectionIntelligence.profilePhrase.clearStart", undefined, null);
}

function getImprovementPhraseLabel(objectiveKey, recommendationName, translator) {
  const key = IMPROVEMENT_PHRASE_KEYS[objectiveKey];

  if (!key) {
    return null;
  }

  const recommendationCopy = recommendationName
    ? translate(
        translator,
        "collectionIntelligence.improvement.recommendationCopy",
        { name: recommendationName },
        null
      )
    : translate(translator, "collectionIntelligence.improvement.genericCopy", undefined, null);

  if (!recommendationCopy) {
    return null;
  }

  const opportunity = translate(translator, key, undefined, null);
  return opportunity ? `${opportunity} ${recommendationCopy}` : null;
}

export function getNextImprovementCopy(result, translator) {
  const eyebrow = result?.eyebrowCode
    ? translate(
        translator,
        NEXT_IMPROVEMENT_EYEBROW_KEYS[result.eyebrowCode],
        undefined,
        result.eyebrow
      )
    : result?.eyebrow;

  const title = result?.titleCode
    ? translate(translator, OBJECTIVE_TITLE_KEYS[result.titleCode], undefined, result.title)
    : result?.title;

  let description = result?.description;

  if (result?.descriptionCode === "boxFull") {
    description = translate(
      translator,
      "collectionIntelligence.description.boxFull",
      undefined,
      description
    );
  } else if (result?.descriptionCode === "starter") {
    description = translate(
      translator,
      "collectionIntelligence.description.starter",
      undefined,
      description
    );
  } else if (result?.descriptionCode === "objective" && result.descriptionParams) {
    const { profile, coverage, profilePhraseCode, objectiveKey, recommendationName } =
      result.descriptionParams;
    const profilePhrase = getProfilePhraseLabel(profilePhraseCode, profile, coverage, translator);
    const improvementPhrase = getImprovementPhraseLabel(objectiveKey, recommendationName, translator);

    if (profilePhrase && improvementPhrase) {
      description = `${profilePhrase} ${improvementPhrase}`;
    }
  }

  return { eyebrow, title, description };
}
