// The one seasonal model behind every Collection Intelligence surface.
//
// The radar, its text conclusion, the "Season Balance" stars, the season coverage strengths and gaps, the
// profile chips ("Spring/Summer Specialist", "Balanced Rotation"), the Box Intelligence gap and the exported
// Collection Card all answer the same question about the same box, so they all read the evidence built here
// and nothing recomputes it.
//
// Evidence: a season's LEVEL is how strongly the box serves it -- the mean of the fragrances' 0-10 season
// weights, as a percentage (so it already ignores box size). That is exactly the value the radar plots.
//
//   "Season Balance" = how evenly the box can serve the four seasons.
//
// It is the weakest season relative to the strongest, so it responds to the whole strength distribution and
// cannot be bought with a token amount of the missing season: a box strong in two seasons and near zero in
// the other two scores low however many fragrances carry a small non-zero weight for them.
//
//   score = 100 * min(1, (weakest level / strongest level) / SEASON_BALANCE_FULL_RATIO)
//
// A ratio of 1 (identical levels) is unreachable with real fragrances, which each peak in one or two
// seasons: in a sample of random and cohesive 4-12 fragrance boxes from the shared catalog, the most even
// boxes reach about 0.85. That ratio is therefore treated as "fully balanced"; below it the score falls
// linearly to 0.

export const SEASON_IDS = Object.freeze(["spring", "summer", "fall", "winter"]);

// A fragrance's season weight runs 0-10.
export const MAX_SEASON_WEIGHT = 10;

// Shared level bands (percent). Strong and covered/gap are the same lines wherever a season is described:
// "Strong X coverage", "X covered", a seasonal gap, and the Box Intelligence gap.
export const SEASON_LEVEL_BANDS = Object.freeze({
  dominant: 90,
  excellent: 70,
  strong: 50,
  moderate: 30,
});

export const SEASON_BALANCE_FULL_RATIO = 0.85;

// 1-5 stars are equal 20-point bands (score 1-20 = 1 star ... 81-100 = 5 stars), so 4+ stars starts at 61.
export const STAR_BAND_WIDTH = 20;

export function scoreToStars(score) {
  const value = Number(score);

  if (!Number.isFinite(value) || value <= 0) {
    return 0;
  }

  return Math.min(5, Math.ceil(value / STAR_BAND_WIDTH));
}

// "Balanced across seasons" is exactly the 4-5 star band of the season balance score.
export const SEASON_BALANCED_MIN_SCORE = 3 * STAR_BAND_WIDTH + 1;

// Two adjacent seasons read as a pair ("leans Spring and Summer") when the second is at least this close to the first.
const SEASON_PAIR_MIN_RATIO = 0.85;

export function buildSeasonalEvidence({ seasonStrengths = {}, selectedCount = 0 } = {}) {
  const count = Math.max(0, Number(selectedCount) || 0);
  const levels = Object.fromEntries(
    SEASON_IDS.map((season) => {
      const strength = Number(seasonStrengths?.[season]) || 0;
      const level = count > 0 ? (strength / (count * MAX_SEASON_WEIGHT)) * 100 : 0;

      return [season, Math.max(0, Math.min(100, Math.round(level)))];
    })
  );

  return describeSeasonalLevels(levels, count);
}

// Everything derived from the four levels. Also used on already-built radar rows (see seasonProfileViewModel),
// which carry the same rounded levels, so the text and the stars can never disagree.
export function describeSeasonalLevels(levels, selectedCount = 0) {
  const values = SEASON_IDS.map((season) => levels[season] || 0);
  const strongestLevel = Math.max(...values);
  const weakestLevel = Math.min(...values);
  const isEmpty = strongestLevel <= 0;
  const ratio = isEmpty ? 0 : weakestLevel / strongestLevel;
  const balanceScore = isEmpty
    ? 0
    : Math.round(100 * Math.min(1, ratio / SEASON_BALANCE_FULL_RATIO));
  const ranked = [...SEASON_IDS].sort(
    (first, second) =>
      (levels[second] || 0) - (levels[first] || 0) ||
      SEASON_IDS.indexOf(first) - SEASON_IDS.indexOf(second)
  );
  const isBalanced = !isEmpty && balanceScore >= SEASON_BALANCED_MIN_SCORE;

  return {
    selectedCount,
    isEmpty,
    levels: { ...levels },
    strongest: isEmpty ? null : ranked[0],
    weakest: isEmpty ? null : ranked[ranked.length - 1],
    ratio,
    balanceScore,
    stars: scoreToStars(balanceScore),
    isBalanced,
    shape: describeSeasonShape({ levels, ranked, isEmpty, isBalanced }),
    bands: Object.fromEntries(SEASON_IDS.map((season) => [season, getSeasonCoverageBand(levels[season] || 0)])),
    gaps: ranked
      .filter((season) => getSeasonCoverageBand(levels[season] || 0) === "gap")
      .reverse(),
  };
}

function describeSeasonShape({ levels, ranked, isEmpty, isBalanced }) {
  if (isEmpty) {
    return { kind: "empty", seasons: [] };
  }

  if (isBalanced) {
    return { kind: "balanced", seasons: [...SEASON_IDS] };
  }

  const [top, second] = ranked;
  const topLevel = levels[top] || 0;
  const isPair =
    areAdjacentSeasons(top, second) &&
    (levels[second] || 0) >= topLevel * SEASON_PAIR_MIN_RATIO;

  return isPair
    ? { kind: "pair", seasons: [top, second].sort((a, b) => SEASON_IDS.indexOf(a) - SEASON_IDS.indexOf(b)) }
    : { kind: "single", seasons: [top] };
}

// strong / covered / gap: the three states a season's coverage can be in.
export function getSeasonCoverageBand(level) {
  if (level >= SEASON_LEVEL_BANDS.strong) return "strong";
  if (level >= SEASON_LEVEL_BANDS.moderate) return "covered";
  return "gap";
}

// Finer wording for the same levels: Dominant / Excellent / Strong / Moderate / Weak.
export function getSeasonStrengthLevel(level) {
  if (level >= SEASON_LEVEL_BANDS.dominant) return "Dominant";
  if (level >= SEASON_LEVEL_BANDS.excellent) return "Excellent";
  if (level >= SEASON_LEVEL_BANDS.strong) return "Strong";
  if (level >= SEASON_LEVEL_BANDS.moderate) return "Moderate";
  return "Weak";
}

// Spring-Summer-Fall-Winter run as a cycle, so winter and spring are neighbours.
export function areAdjacentSeasons(firstSeason, secondSeason) {
  const firstIndex = SEASON_IDS.indexOf(firstSeason);
  const secondIndex = SEASON_IDS.indexOf(secondSeason);

  if (firstIndex === -1 || secondIndex === -1 || firstIndex === secondIndex) {
    return false;
  }

  const distance = Math.abs(firstIndex - secondIndex);

  return distance === 1 || distance === SEASON_IDS.length - 1;
}
