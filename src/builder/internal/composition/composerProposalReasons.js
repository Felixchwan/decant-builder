export function buildComposerProposalReasons({
  perfume,
  preserved = false,
  request = {},
} = {}) {
  return uniqueComposerProposalReasons([
    preserved ? buildComposerProposalReason("preserved_selection", "preserved", {}) : null,
    ...buildPreferenceReasons({
      perfume,
      preferenceType: "season",
      preferenceValues: request.preferredSeasons,
      perfumeValues: perfume?.seasons,
    }),
    ...buildPreferenceReasons({
      perfume,
      preferenceType: "occasion",
      preferenceValues: request.preferredOccasions,
      perfumeValues: perfume?.occasions,
    }),
    ...buildPreferenceReasons({
      perfume,
      preferenceType: "vibe",
      preferenceValues: request.preferredVibes,
      perfumeValues: perfume?.vibes,
    }),
    buildStrategyReason(request.strategy?.id),
  ]).slice(0, 4);
}

export function buildComposerProposalReason(code, type, evidence = {}) {
  return {
    type,
    code,
    labelKey: code,
    preferenceType: evidence.preferenceType || null,
    preferenceValue: evidence.preferenceValue || null,
    evidence,
  };
}

export function buildComposerContributionReasons(facts = []) {
  return (Array.isArray(facts) ? facts : [])
    .map((fact) => ({
      type: "contribution",
      code: getContributionCode(fact),
      labelKey: getContributionCode(fact),
      preferenceType: null,
      preferenceValue: null,
      contributionType: fact.type,
      contributionCategory: fact.category,
      contributionValue: fact.value,
      contributionStrength: fact.strength,
      evidence: fact.evidence || {},
    }))
    .sort(compareContributionReasons);
}

export function uniqueComposerProposalReasons(reasons) {
  const seen = new Set();

  return (Array.isArray(reasons) ? reasons : []).filter((reason) => {
    if (!reason) {
      return false;
    }

    const key = `${reason.code}:${reason.preferenceValue || ""}`;
    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function buildPreferenceReasons({
  preferenceType,
  preferenceValues,
  perfumeValues,
}) {
  const perfumeValueSet = new Set(normalizeStringList(perfumeValues));

  return normalizeStringList(preferenceValues)
    .filter((preferenceValue) => perfumeValueSet.has(preferenceValue))
    .map((preferenceValue) =>
      buildComposerProposalReason(`${preferenceType}_preference_match`, "preference_match", {
        preferenceType,
        preferenceValue,
      })
    );
}

function buildStrategyReason(strategyId) {
  if (!strategyId) {
    return null;
  }

  return buildComposerProposalReason(`strategy_${strategyId}`, "strategy_contribution", {
    strategyId,
  });
}

function normalizeStringList(values) {
  return [
    ...new Set(
      (Array.isArray(values) ? values : [])
        .filter((value) => typeof value === "string")
        .map((value) => value.trim().toLowerCase())
        .filter(Boolean)
    ),
  ].sort();
}

function compareContributionReasons(first, second) {
  return getContributionPriority(first) - getContributionPriority(second);
}

function getContributionPriority(reason) {
  const strengthOffset = getStrengthPriority(reason.contributionStrength);

  if (reason.contributionType === "coverage_contribution") {
    return 10 + strengthOffset;
  }

  if (reason.contributionType === "accord_contribution") {
    return 20 + strengthOffset;
  }

  if (reason.contributionType === "diversity_contribution") {
    return 30 + strengthOffset;
  }

  if (reason.contributionType === "budget_contribution") {
    return 60 + strengthOffset;
  }

  return 90 + strengthOffset;
}

function getStrengthPriority(strength) {
  if (strength === "unique") {
    return 0;
  }

  if (strength === "strong") {
    return 1;
  }

  return 2;
}

function getContributionCode(fact) {
  return `${fact.type}_${fact.category}_${fact.value}_${fact.strength}`;
}
