// Display copy for the "based on your picks" (similarity) lane. Every reason here says how a perfume
// RESEMBLES what is already in the box; none of it talks about coverage, range, balance or gaps -- that
// vocabulary belongs to the opportunity / balance recommendation (recommendationExplanationLabels.js).

const AFFINITY_REASON_COPY = {
  affinity_closest_pick: {
    key: "recommendation.affinity.closestPick",
    fallback: "Very close to {name} in your box",
  },
  affinity_shared_notes: {
    key: "recommendation.affinity.sharedNotes",
    fallback: "Shares key notes with your box: {notes}",
  },
  affinity_repeated_accords: {
    key: "recommendation.affinity.repeatedAccords",
    fallback: "Follows the {accords} profile you keep choosing",
  },
  affinity_shared_accords: {
    key: "recommendation.affinity.sharedAccords",
    fallback: "Shares accords with your box: {accords}",
  },
  affinity_shared_occasions: {
    key: "recommendation.affinity.sharedOccasions",
    fallback: "Suits the same occasions: {occasions}",
  },
  affinity_shared_vibes: {
    key: "recommendation.affinity.sharedVibes",
    fallback: "Shares the {vibes} character of your picks",
  },
  affinity_shared_seasons: {
    key: "recommendation.affinity.sharedSeasons",
    fallback: "Shines in the same seasons: {seasons}",
  },
};

export function isAffinityRecommendation(recommendation) {
  return recommendation?.composer?.source === "affinity";
}

export function getAffinityDisplayReasons({ recommendation, translator, limit = 3 } = {}) {
  return (Array.isArray(recommendation?.explanations) ? recommendation.explanations : [])
    .map((explanation) => getAffinityExplanationLabel(explanation, translator))
    .filter(Boolean)
    .slice(0, limit);
}

export function getAffinityExplanationLabel(explanation = {}, translator) {
  const copy = AFFINITY_REASON_COPY[explanation.code];

  if (!copy) {
    return "";
  }

  const evidence = explanation.evidence || {};
  const values = {
    name: evidence.pickName || "",
    notes: joinLabels(evidence.notes, "notes", translator),
    accords: joinLabels(evidence.accords, "accords", translator),
    occasions: joinLabels(evidence.occasions, "occasions", translator),
    vibes: joinLabels(evidence.vibes, "vibes", translator),
    seasons: joinLabels(evidence.seasons, "seasons", translator),
  };
  const translated = translator?.t?.(copy.key, values);

  return translated && translated !== copy.key ? translated : interpolate(copy.fallback, values);
}

function joinLabels(values, type, translator) {
  const labels = (Array.isArray(values) ? values : [])
    .map((value) => (translator?.label ? translator.label(type, value, humanize(value)) : humanize(value)))
    .map((label) => String(label).toLowerCase());

  if (labels.length <= 1) {
    return labels.join("");
  }

  const conjunction = translator?.t?.("recommendation.affinity.and");
  const word = conjunction && conjunction !== "recommendation.affinity.and" ? conjunction : "and";

  return `${labels.slice(0, -1).join(", ")} ${word} ${labels[labels.length - 1]}`;
}

function humanize(value = "") {
  return String(value)
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[-_]/g, " ");
}

function interpolate(template, values) {
  return Object.entries(values).reduce(
    (copy, [key, value]) => copy.replaceAll(`{${key}}`, value),
    template
  );
}
