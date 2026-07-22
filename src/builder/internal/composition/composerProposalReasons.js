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
