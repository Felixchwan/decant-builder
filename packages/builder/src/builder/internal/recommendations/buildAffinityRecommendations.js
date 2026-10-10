// "Based on your picks" -- recommends the perfumes MOST SIMILAR to what is already in the box.
//
// This is deliberately NOT the Composer. The Composer (and the "to balance your box" lane built on it)
// answers "what does this box still need?": coverage, range, contrast, balance. This answers "based on
// what I already chose, what am I most likely to enjoy?", so it uses ONLY taste-similarity signals from
// the catalog and none of the coverage / novelty / diversification ones:
//
//   notes      weighted overlap of the note-prominence maps (what the perfumes actually smell of)
//   accords    rank-weighted overlap of the accord lists (dominant accords count more)
//   vibes      overlap of the vibe tags
//   occasions  overlap of the occasion tags
//   seasons    overlap of the season-weight profiles (the same weather character, not "a missing season")
//
// Price/points are NOT a signal (that is value, not taste); they never enter a score and never break a tie.
//
// Aggregation across the box is a weighted top-k nearest-neighbour affinity: a candidate is scored by its
// similarity to the (up to) three selected perfumes it resembles most, weighted 0.5 / 0.3 / 0.2. So a
// candidate that sits close to several of the user's picks beats one close to a single pick, while an
// unrelated fragrance elsewhere in the box cannot pull a good match down (it is simply not one of its
// nearest neighbours), and a mixed box surfaces matches for each of its directions.
//
// Every explanation is derived from the catalog data of the candidate and the picks it was matched to.

export const AFFINITY_SIGNAL_WEIGHTS = Object.freeze({
  notes: 0.3,
  accords: 0.3,
  vibes: 0.15,
  occasions: 0.15,
  seasons: 0.1,
});

export const AFFINITY_NEIGHBOUR_WEIGHTS = Object.freeze([0.5, 0.3, 0.2]);

// A pair this similar is described as "very close to"; below it the nearest pick is not worth naming.
const CLOSE_PICK_MIN_SIMILARITY = 0.4;
// Raw affinity at/above which the 0-100 display score saturates.
const AFFINITY_SCORE_REFERENCE = 0.62;
const MAX_EXPLAINED_VALUES = 3;
const DEFAULT_LIMIT = 3;

export function buildAffinityRecommendations({
  perfumes = [],
  selectedPerfumes = [],
  limit = DEFAULT_LIMIT,
  excludedPerfumeIds = [],
} = {}) {
  const picks = (Array.isArray(selectedPerfumes) ? selectedPerfumes : []).filter(isUsablePerfume);

  if (picks.length === 0) {
    return [];
  }

  const selectedIds = new Set(picks.map((perfume) => perfume.id));
  const excludedIds = new Set(excludedPerfumeIds);
  const profiles = new Map();
  const profileOf = (perfume) => {
    if (!profiles.has(perfume.id)) profiles.set(perfume.id, buildSimilarityProfile(perfume));
    return profiles.get(perfume.id);
  };
  const pickProfiles = picks.map((perfume) => ({ perfume, profile: profileOf(perfume) }));

  return (Array.isArray(perfumes) ? perfumes : [])
    .filter(isUsablePerfume)
    .filter((perfume) => !selectedIds.has(perfume.id) && !excludedIds.has(perfume.id))
    .map((perfume) => scoreCandidate(perfume, profileOf(perfume), pickProfiles))
    .sort(
      (first, second) =>
        second.affinity - first.affinity || first.perfume.id - second.perfume.id
    )
    .slice(0, Math.max(0, limit))
    .map((candidate) => buildRecommendation(candidate, picks));
}

// Pairwise similarity, 0 (nothing in common) .. 1 (identical profile), plus the per-signal parts it was
// built from so reasons can name what actually matched.
export function computePerfumeSimilarity(candidate, pick) {
  return compareProfiles(buildSimilarityProfile(candidate), buildSimilarityProfile(pick));
}

export function aggregateBoxAffinity(similarities) {
  const ranked = [...similarities].sort((first, second) => second - first);
  const used = ranked.slice(0, AFFINITY_NEIGHBOUR_WEIGHTS.length);
  const weights = AFFINITY_NEIGHBOUR_WEIGHTS.slice(0, used.length);
  const weightSum = weights.reduce((sum, weight) => sum + weight, 0);

  return used.reduce((sum, similarity, index) => sum + similarity * weights[index], 0) / weightSum;
}

function scoreCandidate(perfume, profile, pickProfiles) {
  const comparisons = pickProfiles
    .map(({ perfume: pick, profile: pickProfile }) => ({
      pick,
      ...compareProfiles(profile, pickProfile),
    }))
    .sort((first, second) => second.similarity - first.similarity || first.pick.id - second.pick.id);

  return {
    perfume,
    comparisons,
    affinity: aggregateBoxAffinity(comparisons.map(({ similarity }) => similarity)),
  };
}

function compareProfiles(first, second) {
  const parts = {
    notes: weightedJaccard(first.notes, second.notes),
    accords: weightedJaccard(first.accords, second.accords),
    vibes: weightedJaccard(first.vibes, second.vibes),
    occasions: weightedJaccard(first.occasions, second.occasions),
    seasons: weightedJaccard(first.seasons, second.seasons),
  };
  const similarity = Object.entries(AFFINITY_SIGNAL_WEIGHTS).reduce(
    (sum, [signal, weight]) => sum + parts[signal] * weight,
    0
  );

  return { similarity, parts };
}

function buildSimilarityProfile(perfume) {
  return {
    notes: buildNoteVector(perfume),
    accords: new Map(
      (perfume.accords || []).map((accord, index) => [accord, Math.max(0.2, 1 - index * 0.2)])
    ),
    vibes: toPresenceVector(perfume.vibes),
    occasions: toPresenceVector(perfume.occasions),
    seasons: buildSeasonVector(perfume),
  };
}

function buildNoteVector(perfume) {
  const prominence = perfume.noteProminence;

  if (prominence && Object.keys(prominence).length > 0) {
    return new Map(Object.entries(prominence).filter(([, weight]) => weight > 0));
  }

  return toPresenceVector([
    ...(perfume.topNotes || []),
    ...(perfume.middleNotes || []),
    ...(perfume.baseNotes || []),
  ]);
}

function buildSeasonVector(perfume) {
  if (perfume.seasonWeights && Object.keys(perfume.seasonWeights).length > 0) {
    return new Map(Object.entries(perfume.seasonWeights).filter(([, weight]) => weight > 0));
  }

  return toPresenceVector(perfume.seasons);
}

function toPresenceVector(values) {
  return new Map((values || []).map((value) => [value, 1]));
}

function weightedJaccard(first, second) {
  let intersection = 0;
  let union = 0;

  for (const key of new Set([...first.keys(), ...second.keys()])) {
    const a = first.get(key) || 0;
    const b = second.get(key) || 0;
    intersection += Math.min(a, b);
    union += Math.max(a, b);
  }

  return union === 0 ? 0 : intersection / union;
}

function buildRecommendation({ perfume, comparisons, affinity }, picks) {
  const explanations = deriveAffinityExplanations({ perfume, comparisons, picks });
  const score = Math.max(1, Math.min(100, Math.round((affinity / AFFINITY_SCORE_REFERENCE) * 100)));

  return {
    perfume,
    score,
    baseScore: score,
    finalScore: score,
    // The generic display fallback turns these into coverage/range copy; this lane explains
    // similarity only, from `explanations`, so there is nothing for it to fall back to.
    reasons: [],
    explanations,
    scoreBreakdown: {},
    affinity: {
      value: affinity,
      nearestPickIds: comparisons.slice(0, AFFINITY_NEIGHBOUR_WEIGHTS.length).map(({ pick }) => pick.id),
    },
    composer: {
      lane: "basedOnYourPicks",
      source: "affinity",
      recommendationCodes: explanations.map((item) => item.code),
    },
  };
}

// Reasons are chosen from what the candidate really shares with the picks it was matched to (its nearest
// neighbours), most informative first: the closest pick, then the signals with the strongest overlap.
function deriveAffinityExplanations({ perfume, comparisons, picks }) {
  const neighbours = comparisons.slice(0, AFFINITY_NEIGHBOUR_WEIGHTS.length);
  const neighbourPerfumes = neighbours.map(({ pick }) => pick);
  const explanations = [];
  const closest = neighbours[0];

  if (closest && closest.similarity >= CLOSE_PICK_MIN_SIMILARITY) {
    explanations.push({
      code: "affinity_closest_pick",
      severity: "positive",
      evidence: { pickId: closest.pick.id, pickName: closest.pick.name },
    });
  }

  const candidates = [];
  const sharedNotes = sharedKeys(
    buildNoteVector(perfume),
    neighbourPerfumes.map(buildNoteVector),
    (candidateWeight, pickWeight) => Math.min(candidateWeight, pickWeight)
  );
  const repeatedAccords = sharedAccords(perfume, picks);
  const sharedOccasions = sharedValues(perfume.occasions, neighbourPerfumes, "occasions");
  const sharedVibes = sharedValues(perfume.vibes, neighbourPerfumes, "vibes");
  const sharedSeasons = sharedSeasonValues(perfume, neighbourPerfumes);

  if (sharedNotes.length > 0) {
    candidates.push({
      strength: bestPart(neighbours, "notes"),
      explanation: {
        code: "affinity_shared_notes",
        severity: "positive",
        evidence: { notes: sharedNotes.slice(0, MAX_EXPLAINED_VALUES) },
      },
    });
  }

  if (repeatedAccords.accords.length > 0) {
    candidates.push({
      strength: bestPart(neighbours, "accords"),
      explanation: {
        code: repeatedAccords.repeated ? "affinity_repeated_accords" : "affinity_shared_accords",
        severity: "positive",
        evidence: { accords: repeatedAccords.accords.slice(0, 2) },
      },
    });
  }

  if (sharedOccasions.length > 0) {
    candidates.push({
      strength: bestPart(neighbours, "occasions"),
      explanation: {
        code: "affinity_shared_occasions",
        severity: "positive",
        evidence: { occasions: sharedOccasions.slice(0, MAX_EXPLAINED_VALUES) },
      },
    });
  }

  if (sharedVibes.length > 0) {
    candidates.push({
      strength: bestPart(neighbours, "vibes"),
      explanation: {
        code: "affinity_shared_vibes",
        severity: "positive",
        evidence: { vibes: sharedVibes.slice(0, MAX_EXPLAINED_VALUES) },
      },
    });
  }

  if (sharedSeasons.length > 0) {
    candidates.push({
      strength: bestPart(neighbours, "seasons"),
      explanation: {
        code: "affinity_shared_seasons",
        severity: "notice",
        evidence: { seasons: sharedSeasons },
      },
    });
  }

  candidates
    .sort((first, second) => second.strength - first.strength)
    .forEach(({ explanation }) => explanations.push(explanation));

  return explanations.slice(0, 4);
}

function bestPart(neighbours, signal) {
  return Math.max(...neighbours.map(({ parts }) => parts[signal] * AFFINITY_SIGNAL_WEIGHTS[signal]));
}

// Notes both the candidate and at least one nearest pick carry prominently, strongest first.
function sharedKeys(candidateVector, pickVectors, combine) {
  const strength = new Map();

  for (const pickVector of pickVectors) {
    for (const [key, pickWeight] of pickVector) {
      if (!candidateVector.has(key)) continue;
      const shared = combine(candidateVector.get(key), pickWeight);
      strength.set(key, Math.max(strength.get(key) || 0, shared));
    }
  }

  return [...strength.entries()]
    .sort(([firstKey, firstWeight], [secondKey, secondWeight]) =>
      secondWeight - firstWeight || (firstKey < secondKey ? -1 : 1)
    )
    .map(([key]) => key);
}

// Accords the candidate shares with the box, strongest first. "Repeated" only when a shared accord is
// present in at least two of the picks, so "the profile you keep choosing" is never claimed for one pick.
function sharedAccords(perfume, picks) {
  const candidateAccords = perfume.accords || [];
  const counts = new Map();

  for (const pick of picks) {
    for (const accord of pick.accords || []) {
      if (candidateAccords.includes(accord)) {
        counts.set(accord, (counts.get(accord) || 0) + 1);
      }
    }
  }

  const ordered = candidateAccords
    .filter((accord) => counts.has(accord))
    .sort((first, second) => counts.get(second) - counts.get(first));
  const repeated = ordered.filter((accord) => counts.get(accord) >= 2);

  return repeated.length > 0
    ? { repeated: true, accords: repeated }
    : { repeated: false, accords: ordered };
}

function sharedValues(candidateValues, neighbourPerfumes, field) {
  const counts = new Map();

  for (const pick of neighbourPerfumes) {
    for (const value of pick[field] || []) {
      if ((candidateValues || []).includes(value)) {
        counts.set(value, (counts.get(value) || 0) + 1);
      }
    }
  }

  return (candidateValues || [])
    .filter((value) => counts.has(value))
    .sort((first, second) => counts.get(second) - counts.get(first));
}

// Seasons where BOTH the candidate and a nearest pick are genuinely at home (a strong season weight),
// so this describes a shared weather character rather than a season the box lacks.
function sharedSeasonValues(perfume, neighbourPerfumes) {
  const strong = (item, season) => (buildSeasonVector(item).get(season) || 0) >= 7;

  return ["spring", "summer", "fall", "winter"].filter(
    (season) =>
      strong(perfume, season) && neighbourPerfumes.some((pick) => strong(pick, season))
  );
}

function isUsablePerfume(perfume) {
  return Boolean(perfume) && typeof perfume === "object" && Number.isInteger(perfume.id);
}
