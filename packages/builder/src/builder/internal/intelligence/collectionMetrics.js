// Collection Intelligence metrics: the five scores behind the "Collection Balance" stars, plus the profile
// signals (fresh / warm lean, evening share) the profile chips and the Box Intelligence read.
//
// Every surface that talks about a box's character -- the stars, the profile chips, Box Intelligence, the
// season coverage list and the exported Collection Card -- takes these numbers from here, computed once per
// box, so they cannot disagree.
//
// This is deliberately separate from `scentDna.scores` (utils/buildScentDna.js). That object is an input to
// the Composer's quality scoring and is left exactly as it was; these metrics are what a person is shown.
//
// Design rules, in the order they matter:
//   - A score must use its whole 0-100 range on realistic boxes. Counting how many DIFFERENT tags a box has
//     saturates immediately (a handful of fragrances already touch every season, most occasions, many vibes),
//     so breadth is measured with the EFFECTIVE number of categories instead: the inverse Simpson index
//     (1 / sum of squared shares) of how the box's fragrances spread across them -- how many equally common
//     categories would spread the box as evenly as it really is. A repeated profile adds nothing, and one
//     stray tag moves the score a little rather than awarding a whole category (the inverse Simpson index
//     discounts rare categories more than entropy does: about a third less movement per stray tag).
//   - Nothing grows just because the box is bigger. Season levels are means, shares are per fragrance, and
//     signature is a mean over pairs.
//   - The anchors below are the observed 5th-95th percentile of those effective numbers across 600 random and
//     cohesive 4-12 fragrance boxes from the shared catalog, rounded: the low anchor is a narrow, repetitive
//     box and the high anchor is a genuinely broad one. (Notes are all of a fragrance's top, middle, base and
//     general notes, a median of 9 each.)

import { getPerfumeNoteIds } from "../../../utils/noteUtils.js";
import { computePerfumeSimilarity } from "../recommendations/buildAffinityRecommendations.js";
import { buildSeasonalEvidence, scoreToStars } from "./seasonalEvidence.js";

export const METRIC_ANCHORS = Object.freeze({
  occasions: [3.5, 7],
  vibes: [7, 15],
  accords: [6.5, 13.5],
  notes: [22, 45],
  // mean pairwise similarity of the box: unrelated fragrances ~0.15, near-twins ~0.42+
  coherence: [0.15, 0.42],
});

export const VERSATILITY_WEIGHTS = Object.freeze({ occasions: 0.5, vibes: 0.25, seasons: 0.25 });
export const BREADTH_WEIGHTS = Object.freeze({ accords: 0.55, notes: 0.45 });

// A fragrance counts as fully fresh / warm with this many fresh / warm signals; more adds nothing.
const SIGNALS_FOR_FULL_PROFILE = 3;
// Fresh and warm shares differ by at least this many points (0-100) for the box to lean one way.
const LEAN_MIN_DIFFERENCE = 25;
const EVENING_FOCUSED_SHARE = 0.5;
const MIN_FRAGRANCES_FOR_SIGNATURE = 3;

export const FRESH_VIBES = Object.freeze(["fresh", "clean"]);
export const FRESH_ACCORDS = Object.freeze(["fresh", "citrus", "marine", "aquatic", "green"]);
export const WARM_VIBES = Object.freeze(["warm", "cozy", "seductive", "dark"]);
export const WARM_ACCORDS = Object.freeze(["amber", "warm spicy", "smoky", "leather", "tobacco", "vanilla"]);
export const EVENING_OCCASIONS = Object.freeze(["date", "night", "evening"]);
export const DATE_NIGHT_OCCASIONS = Object.freeze(["date", "night"]);
export const EVERYDAY_OCCASIONS = Object.freeze(["office", "daily"]);

const EMPTY_SCORES = Object.freeze({
  versatility: 0,
  breadth: 0,
  freshness: 0,
  seasonBalance: 0,
  signature: 0,
});

export function buildCollectionMetrics({ selectedPerfumes = [], boxSummary = {} } = {}) {
  const perfumes = (Array.isArray(selectedPerfumes) ? selectedPerfumes : []).filter(Boolean);
  const selectedCount = perfumes.length;
  const seasonal = buildSeasonalEvidence({
    seasonStrengths: boxSummary.seasonStrengths || boxSummary.seasonCounts || {},
    selectedCount,
  });

  if (selectedCount === 0) {
    return {
      selectedCount,
      seasonal,
      scores: { ...EMPTY_SCORES },
      stars: toStars(EMPTY_SCORES, 0),
      profile: buildEmptyProfile(),
    };
  }

  const occasionCounts = boxSummary.occasionCounts || countTags(perfumes, "occasions");
  const vibeCounts = boxSummary.vibeCounts || countTags(perfumes, "vibes");
  const accordCounts = countTags(perfumes, "accords");
  const noteCounts = countNotes(perfumes);
  const profile = buildProfileSignals(perfumes);

  const versatility = Math.round(
    100 *
      (VERSATILITY_WEIGHTS.occasions * scaleBetween(effectiveNumber(occasionCounts), METRIC_ANCHORS.occasions) +
        VERSATILITY_WEIGHTS.vibes * scaleBetween(effectiveNumber(vibeCounts), METRIC_ANCHORS.vibes) +
        VERSATILITY_WEIGHTS.seasons * (seasonal.balanceScore / 100))
  );
  const breadth = Math.round(
    100 *
      (BREADTH_WEIGHTS.accords * scaleBetween(effectiveNumber(accordCounts), METRIC_ANCHORS.accords) +
        BREADTH_WEIGHTS.notes * scaleBetween(effectiveNumber(noteCounts), METRIC_ANCHORS.notes))
  );
  const signature =
    selectedCount < MIN_FRAGRANCES_FOR_SIGNATURE
      ? 0
      : Math.round(100 * scaleBetween(getBoxCoherence(perfumes), METRIC_ANCHORS.coherence));
  const scores = {
    versatility,
    breadth,
    freshness: profile.freshness,
    seasonBalance: seasonal.balanceScore,
    signature,
  };
  const stars = toStars(scores, selectedCount);

  return {
    selectedCount,
    seasonal: { ...seasonal, stars: stars.seasonBalance },
    scores,
    stars,
    profile: {
      ...profile,
      // "Balanced Rotation": the box serves every season and does it with some range of occasions.
      isBalancedRotation: seasonal.isBalanced && stars.versatility >= 3,
    },
  };
}

function buildEmptyProfile() {
  return {
    freshness: 0,
    warmth: 0,
    lean: "mixed",
    eveningShare: 0,
    everydayShare: 0,
    dateNightShare: 0,
    dateNightCount: 0,
    isBalancedRotation: false,
  };
}

// Per-fragrance signals, summarised as shares of the box (so the same profile reads the same at 6 or 12).
function buildProfileSignals(perfumes) {
  const count = perfumes.length;
  const share = (predicate) => perfumes.filter(predicate).length / count;
  const meanIntensity = (vibes, accords) =>
    Math.round(
      (100 *
        perfumes.reduce((sum, perfume) => sum + getSignalIntensity(perfume, vibes, accords), 0)) /
        count
    );
  const freshness = meanIntensity(FRESH_VIBES, FRESH_ACCORDS);
  const warmth = meanIntensity(WARM_VIBES, WARM_ACCORDS);
  const difference = freshness - warmth;

  return {
    freshness,
    warmth,
    lean:
      difference >= LEAN_MIN_DIFFERENCE ? "fresh" : difference <= -LEAN_MIN_DIFFERENCE ? "warm" : "mixed",
    eveningShare: share((perfume) => hasAny(perfume.occasions, EVENING_OCCASIONS)),
    everydayShare: share((perfume) => hasAny(perfume.occasions, EVERYDAY_OCCASIONS)),
    dateNightShare: share((perfume) => hasAny(perfume.occasions, DATE_NIGHT_OCCASIONS)),
    dateNightCount: perfumes.filter((perfume) => hasAny(perfume.occasions, DATE_NIGHT_OCCASIONS)).length,
  };
}

export function isEveningFocused(profile) {
  return profile.eveningShare >= EVENING_FOCUSED_SHARE || profile.lean === "warm";
}

function getSignalIntensity(perfume, vibes, accords) {
  const signals =
    (perfume.vibes || []).filter((vibe) => vibes.includes(vibe)).length +
    (perfume.accords || []).filter((accord) => accords.includes(accord)).length;

  return Math.min(1, signals / SIGNALS_FOR_FULL_PROFILE);
}

// How alike the box's fragrances are to each other: the mean similarity over every pair (notes, accords,
// vibes, occasions and seasons -- the same measure behind "Afinidad"). It is a mean, so box size does not
// inflate it; a box built around one thread scores high, a scattered one low.
function getBoxCoherence(perfumes) {
  let total = 0;
  let pairs = 0;

  for (let first = 0; first < perfumes.length; first += 1) {
    for (let second = first + 1; second < perfumes.length; second += 1) {
      total += computePerfumeSimilarity(perfumes[first], perfumes[second]).similarity;
      pairs += 1;
    }
  }

  return pairs === 0 ? 0 : total / pairs;
}

// Inverse Simpson index of a {category: count} map: the number of equally common categories that would spread
// the box as evenly as it is actually spread (1 for a box that is all one category).
export function effectiveNumber(counts) {
  const values = Object.values(counts || {}).filter((value) => value > 0);
  const total = values.reduce((sum, value) => sum + value, 0);

  if (total === 0) {
    return 0;
  }

  return 1 / values.reduce((sum, value) => sum + (value / total) ** 2, 0);
}

function scaleBetween(value, [low, high]) {
  return Math.max(0, Math.min(1, (value - low) / (high - low)));
}

// 1-5 stars per metric. A box with fragrances in it never shows an empty rating (0 stars reads as "not
// computed"); the one exception is Signature, which needs a few fragrances to compare before it can say anything.
function toStars(scores, selectedCount) {
  return Object.fromEntries(
    Object.entries(scores).map(([key, score]) => {
      const stars = scoreToStars(score);
      const canBeEmpty = selectedCount === 0 || (key === "signature" && selectedCount < MIN_FRAGRANCES_FOR_SIGNATURE);

      return [key, canBeEmpty ? stars : Math.max(1, stars)];
    })
  );
}

function hasAny(values, targets) {
  return (values || []).some((value) => targets.includes(value));
}

function countTags(perfumes, field) {
  return perfumes.reduce((counts, perfume) => {
    new Set(perfume[field] || []).forEach((tag) => {
      counts[tag] = (counts[tag] || 0) + 1;
    });

    return counts;
  }, {});
}

function countNotes(perfumes) {
  return perfumes.reduce((counts, perfume) => {
    new Set(getPerfumeNoteIds(perfume)).forEach((noteId) => {
      counts[noteId] = (counts[noteId] || 0) + 1;
    });

    return counts;
  }, {});
}
