export function deriveProposalItemContributions({
  collection = [],
  selectedPreferences = {},
} = {}) {
  const safeCollection = normalizeCollection(collection);
  const preferences = {
    season: normalizeStringList(selectedPreferences.preferredSeasons),
    occasion: normalizeStringList(selectedPreferences.preferredOccasions),
    vibe: normalizeStringList(selectedPreferences.preferredVibes),
  };
  const allCounts = {
    season: countValues(safeCollection, "seasons"),
    occasion: countValues(safeCollection, "occasions"),
    vibe: countValues(safeCollection, "vibes"),
    accord: countValues(safeCollection, "accords"),
  };
  const byPerfumeId = {};

  safeCollection.forEach((perfume) => {
    const facts = [];

    addPreferenceFacts({ facts, perfume, preferences, allCounts });
    addCoverageFacts({ facts, perfume, allCounts });
    addAccordFacts({ facts, perfume, allCounts });
    addDiversityFacts({ facts, perfume, allCounts });

    byPerfumeId[perfume.id] = {
      perfumeId: perfume.id,
      facts: uniqueFacts(facts),
    };
  });

  return {
    byPerfumeId,
    diagnostics: {
      itemComparisons: safeCollection.length,
      qualityEvaluationRequired: false,
      reasoningFactsReused: false,
    },
  };
}

function addPreferenceFacts({ facts, perfume, preferences, allCounts }) {
  [
    ["season", "seasons"],
    ["occasion", "occasions"],
    ["vibe", "vibes"],
  ].forEach(([category, perfumeField]) => {
    const perfumeValues = normalizeStringList(perfume[perfumeField]);

    preferences[category]
      .filter((value) => perfumeValues.includes(value))
      .forEach((value) => {
        facts.push({
          type: "preference_match",
          category,
          value,
          strength: getStrength((allCounts[category].get(value) || 0) - 1),
          evidence: {
            selectedPreference: true,
            remainingProviders: Math.max(0, (allCounts[category].get(value) || 0) - 1),
          },
        });
      });
  });
}

function addCoverageFacts({ facts, perfume, allCounts }) {
  [
    ["season", "seasons"],
    ["occasion", "occasions"],
    ["vibe", "vibes"],
  ].forEach(([category, perfumeField]) => {
    normalizeStringList(perfume[perfumeField]).forEach((value) => {
      const remainingProviders = Math.max(0, (allCounts[category].get(value) || 0) - 1);

      if (remainingProviders > 1) {
        return;
      }

      facts.push({
        type: "coverage_contribution",
        category,
        value,
        strength: getStrength(remainingProviders),
        evidence: {
          remainingProviders,
        },
      });
    });
  });
}

function addAccordFacts({ facts, perfume, allCounts }) {
  normalizeStringList(perfume.accords).forEach((value) => {
    const remainingProviders = Math.max(0, (allCounts.accord.get(value) || 0) - 1);

    if (remainingProviders > 1) {
      return;
    }

    facts.push({
      type: "accord_contribution",
      category: "accord",
      value,
      strength: getStrength(remainingProviders),
      evidence: {
        remainingProviders,
      },
    });
  });
}

function addDiversityFacts({ facts, perfume, allCounts }) {
  const scarceAccordCount = normalizeStringList(perfume.accords).filter(
    (value) => Math.max(0, (allCounts.accord.get(value) || 0) - 1) <= 1
  ).length;

  if (scarceAccordCount >= 2) {
    facts.push({
      type: "diversity_contribution",
      category: "profile",
      value: "distinct",
      strength: scarceAccordCount >= 3 ? "strong" : "supporting",
      evidence: {
        scarceAccordCount,
      },
    });
  }
}

function countValues(collection, field) {
  const counts = new Map();

  collection.forEach((perfume) => {
    normalizeStringList(perfume[field]).forEach((value) => {
      counts.set(value, (counts.get(value) || 0) + 1);
    });
  });

  return counts;
}

function getStrength(remainingProviders) {
  if (remainingProviders === 0) {
    return "unique";
  }

  if (remainingProviders === 1) {
    return "strong";
  }

  return "supporting";
}

function uniqueFacts(facts) {
  const seen = new Set();

  return facts.filter((fact) => {
    const key = `${fact.type}:${fact.category}:${fact.value}:${fact.strength}`;

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function normalizeCollection(collection) {
  return (Array.isArray(collection) ? collection : []).filter(
    (perfume) => perfume && typeof perfume === "object" && Number.isInteger(perfume.id)
  );
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
