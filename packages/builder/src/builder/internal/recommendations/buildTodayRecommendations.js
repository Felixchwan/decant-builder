import { deriveTodayContext } from "./todayContext.js";

// "Para hoy": up to three picks that suit the moment, ranked deterministically from catalog metadata alone. No model, no
// randomness, no network, and no knowledge of any city, language or merchant: a host hands in the context it derived
// (see todayContext.js) and gets back structured evidence, which presentation turns into words.
//
// The base model scores three factors, each only when the input it needs exists:
//
//   season      30   the fragrance's own season weight for the current season
//   timeOfDay   40   its occasions and vibes against morning/daytime or evening/night
//   dayContext  30   its occasions against a social night, a workday daytime or a weekend daytime -- and ONLY when the
//                    moment actually is one of those; an ordinary weekday evening has no day context to score
//
// Two more factors join ONLY when the host supplied the live input they need, and are simply absent otherwise:
//
//   temperature 20   (needs `temperatureBucket`) the fragrance's season weights blended for that temperature
//   weather     10   (needs a temperature bucket of hot/warm/cool/cold, or `weatherCondition: "rain"`) how well its accords and
//                    vibes match the thermal / rainy profile: fresh in the heat, warm and cozy when it is cool, cold or raining.
//                    Availability depends on the CONTEXT, never on the fragrance, so everyone is scored over the same factors.
//
// With neither input supplied the code path, the numbers and the output are exactly the base model's.
//
// Scores are compared over the factors that were available, so a moment with no day context is not quietly padded with
// points nobody could earn: `normalizedScore` is points / the maximum of the factors that applied. Everyone in one
// request is scored over the same factors, so the ranking is by points; `normalizedScore` and `coverage` only feed
// confidence (see TODAY_HIGH_CONFIDENCE_THRESHOLD).
//
// Price, tier, market segment and the box's current contents are never inputs.
//
// A factor is a function (perfume, context) -> { code, points, max, evidence } | null.

export const TODAY_FACTOR_MAX = Object.freeze({ season: 30, timeOfDay: 40, dayContext: 30 });
// The live factors. Together at most 30 of 130 points (23%): they add context to the season / time / day model, they do not
// outweigh it, and the season weights they read are the same ones the season factor reads.
export const TODAY_LIVE_FACTOR_MAX = Object.freeze({ temperature: 20, weather: 10 });
// What the base factors together can earn: the yardstick for how much of the model a moment could use.
export const TODAY_FULL_MAX = Object.values(TODAY_FACTOR_MAX).reduce((sum, max) => sum + max, 0);
export const TODAY_MAX_RECOMMENDATIONS = 3;
// Confidence. A pick is "high" only when BOTH hold:
//   - it earned at least this share of the points that were available to it (normalizedScore), and
//   - every factor was available (coverage 1): the moment had a day context as well as a season and a time of day.
// With less context than that (an ordinary weekday evening, a Sunday night) the evidence is thinner by construction, so
// the pick is "moderate" however well it fits what is known, and presentation frames it more modestly. When a temperature
// is supplied the yardstick for "every factor" includes the temperature factor, so a known temperature can never lower
// confidence; the weather factor is optional by design (a mild, dry day has no profile to match) and never counts against it.
export const TODAY_HIGH_CONFIDENCE_THRESHOLD = 0.75;
// A factor explains a pick only if it earned at least this share of its own maximum.
export const TODAY_REASON_MIN_RATIO = 0.6;

const NIGHT_OCCASIONS = Object.freeze(["night", "evening", "date", "club", "formal", "special"]);
const NIGHT_VIBES = Object.freeze(["seductive", "mysterious", "dark", "elegant", "bold", "sophisticated"]);
const DAY_OCCASIONS = Object.freeze(["daily", "office", "casual"]);
const DAY_VIBES = Object.freeze(["fresh", "clean", "bright", "energetic", "easy", "versatile"]);

// Reason priority when two factors earned the same points: the most specific first. The weather profile, when it explains a
// pick at all, always leads: it is the distinctive thing about today.
const REASON_ORDER = Object.freeze(["weather", "dayContext", "timeOfDay", "temperature", "season"]);

// Which season weights stand for which temperature: a blend, since a mild day sits between two seasons.
const TEMPERATURE_SEASON_BLEND = Object.freeze({
  hot: { summer: 1 },
  warm: { summer: 0.6, spring: 0.4 },
  mild: { spring: 0.5, fall: 0.5 },
  cool: { fall: 0.6, winter: 0.4 },
  cold: { winter: 1 },
});
// Profiles. Fresh accords in the heat; warm accords and cozy vibes when it is cool, cold or raining. (Woody and aromatic
// are left out of the warm set on purpose: most of the catalog carries them, so they would match nearly everything.)
const FRESH_ACCORDS = Object.freeze(["citrus", "aquatic", "marine", "fresh", "green", "mineral"]);
const HEAT_VIBES = Object.freeze(["fresh", "bright", "clean", "energetic", "easy"]);
const WARM_ACCORDS = Object.freeze(["amber", "vanilla", "warm spicy", "leather", "tobacco", "smoky", "patchouli"]);
const COZY_VIBES = Object.freeze(["cozy", "warm", "calm", "relaxed", "soft", "smooth"]);

export function buildTodayRecommendations({ perfumes = [], context, limit = TODAY_MAX_RECOMMENDATIONS } = {}) {
  const todayContext = deriveTodayContext(context);
  const count = Math.max(0, Math.min(TODAY_MAX_RECOMMENDATIONS, Number.isInteger(limit) ? limit : TODAY_MAX_RECOMMENDATIONS));

  if (!todayContext || count === 0 || !Array.isArray(perfumes)) {
    return { context: todayContext, confidence: null, recommendations: [] };
  }

  const scored = scoreTodayCandidates(perfumes, todayContext);

  // At most one fragrance per house, keeping the best-scoring one of each.
  const houses = new Set();
  const recommendations = [];

  for (const candidate of scored) {
    const house = typeof candidate.perfume.brand === "string" && candidate.perfume.brand ? candidate.perfume.brand : `id:${candidate.perfume.id}`;

    if (houses.has(house)) continue;

    houses.add(house);
    recommendations.push(candidate);

    if (recommendations.length === count) break;
  }

  return {
    context: todayContext,
    // The set is only as sure as its weakest pick.
    confidence:
      recommendations.length === 0
        ? null
        : recommendations.every(({ confidence }) => confidence === "high")
          ? "high"
          : "moderate",
    recommendations,
  };
}

// Every usable fragrance scored for an already-derived context, best first (ties by id). The one place the base TodayScore is
// computed: the role layer (buildTodayRoleRecommendations.js) reads these candidates and never re-scores them.
export function scoreTodayCandidates(perfumes, todayContext) {
  return (Array.isArray(perfumes) ? perfumes : [])
    .filter(isUsablePerfume)
    .map((perfume) => scorePerfume(perfume, todayContext))
    .sort((first, second) => second.score - first.score || first.perfume.id - second.perfume.id);
}

function scorePerfume(perfume, context) {
  const factors = [
    scoreSeason(perfume, context),
    scoreTimeOfDay(perfume, context),
    scoreDayContext(perfume, context),
    scoreTemperature(perfume, context),
    scoreWeatherProfile(perfume, context),
  ].filter(Boolean);
  const score = round(factors.reduce((sum, factor) => sum + factor.points, 0));
  const maxScore = factors.reduce((sum, factor) => sum + factor.max, 0);
  const normalizedScore = maxScore > 0 ? round(score / maxScore, 3) : 0;
  const fullMax = TODAY_FULL_MAX + (context.temperatureBucket ? TODAY_LIVE_FACTOR_MAX.temperature : 0);
  const coverage = round(Math.min(1, maxScore / fullMax), 3);

  return {
    perfume,
    score,
    maxScore,
    normalizedScore,
    coverage,
    confidence: coverage >= 1 && normalizedScore >= TODAY_HIGH_CONFIDENCE_THRESHOLD ? "high" : "moderate",
    factors,
    reasons: buildReasons(factors),
  };
}

function scoreSeason(perfume, { season }) {
  const weight = clamp(getSeasonWeight(perfume, season), 0, 10);

  return {
    code: "season",
    points: round((TODAY_FACTOR_MAX.season * weight) / 10),
    max: TODAY_FACTOR_MAX.season,
    evidence: { season, weight },
  };
}

function scoreTimeOfDay(perfume, { time }) {
  const isNight = time === "evening" || time === "night";
  const occasions = matching(perfume.occasions, isNight ? NIGHT_OCCASIONS : DAY_OCCASIONS);
  const vibes = matching(perfume.vibes, isNight ? NIGHT_VIBES : DAY_VIBES);
  // 24 of the 40 for occasions (more matches, more of it), 16 for vibes.
  const occasionPoints = occasions.length === 0 ? 0 : 24 * Math.min(1, 0.6 + 0.2 * (occasions.length - 1));
  const vibePoints = vibes.length === 0 ? 0 : vibes.length === 1 ? 10 : 16;

  return {
    code: "timeOfDay",
    points: round(occasionPoints + vibePoints),
    max: TODAY_FACTOR_MAX.timeOfDay,
    evidence: { time, occasions, vibes },
  };
}

function scoreDayContext(perfume, { dayContext }) {
  if (!dayContext) return null;

  const max = TODAY_FACTOR_MAX.dayContext;
  const relevant = {
    social_night: ["date", "night", "club"],
    workday_daytime: ["office", "daily"],
    weekend_daytime: ["casual", "daily", "vacation"],
  }[dayContext];
  const occasions = matching(perfume.occasions, relevant);
  let points;

  if (dayContext === "social_night") {
    // A date occasion and a going-out occasion each earn 18; both reach the 30.
    const date = occasions.includes("date") ? 18 : 0;
    const out = occasions.includes("night") || occasions.includes("club") ? 18 : 0;
    points = Math.min(max, date + out);
  } else if (dayContext === "workday_daytime") {
    points = occasions.includes("office") ? max : occasions.includes("daily") ? 18 : 0;
  } else {
    points = occasions.length >= 2 ? max : occasions.length === 1 ? 18 : 0;
  }

  return { code: "dayContext", points: round(points), max, evidence: { dayContext, occasions } };
}

function scoreTemperature(perfume, { temperatureBucket }) {
  if (!temperatureBucket) return null;

  const blend = TEMPERATURE_SEASON_BLEND[temperatureBucket];
  const weight = clamp(
    Object.entries(blend).reduce((sum, [season, share]) => sum + share * clamp(getSeasonWeight(perfume, season), 0, 10), 0),
    0,
    10
  );

  return {
    code: "temperature",
    points: round((TODAY_LIVE_FACTOR_MAX.temperature * weight) / 10),
    max: TODAY_LIVE_FACTOR_MAX.temperature,
    evidence: { temperatureBucket, weight: round(weight, 1) },
  };
}

// heat (hot or warm) wins, then rain, then a cool or cold day; a mild dry day, or a cloudy one, has no profile to match.
function resolveWeatherProfile({ temperatureBucket, weatherCondition }) {
  if (temperatureBucket === "hot" || temperatureBucket === "warm") return "heat";
  if (weatherCondition === "rain") return "rain";
  if (temperatureBucket === "cool" || temperatureBucket === "cold") return "cool";

  return null;
}

function scoreWeatherProfile(perfume, context) {
  const profile = resolveWeatherProfile(context);

  if (!profile) return null;

  const isHeat = profile === "heat";
  const accords = matching(perfume.accords, isHeat ? FRESH_ACCORDS : WARM_ACCORDS);
  const vibes = matching(perfume.vibes, isHeat ? HEAT_VIBES : COZY_VIBES);
  // 6 of the 10 for accords (two matches, the whole 6; one, half), 4 for vibes.
  const accordPoints = accords.length >= 2 ? 6 : accords.length === 1 ? 3 : 0;
  const vibePoints = vibes.length >= 1 ? 4 : 0;

  return {
    code: "weather",
    points: round(accordPoints + vibePoints),
    max: TODAY_LIVE_FACTOR_MAX.weather,
    evidence: {
      profile,
      ...(context.temperatureBucket ? { temperatureBucket: context.temperatureBucket } : {}),
      ...(context.weatherCondition ? { weatherCondition: context.weatherCondition } : {}),
      accords,
      vibes,
    },
  };
}

// Reasons come ONLY from factors that actually scored, and carry the evidence that earned them: presentation can say what
// the evidence supports and nothing else. A factor that earned too little to explain the pick contributes no reason.
function buildReasons(factors) {
  return factors
    .filter(({ points, max }) => points > 0 && points / max >= TODAY_REASON_MIN_RATIO)
    .sort((first, second) => {
      // the weather profile leads whenever it explains the pick; everything else by the points it earned
      if ((first.code === "weather") !== (second.code === "weather")) return first.code === "weather" ? -1 : 1;

      return second.points - first.points || REASON_ORDER.indexOf(first.code) - REASON_ORDER.indexOf(second.code);
    })
    .map(({ code, evidence }) => ({ code, evidence }));
}

function getSeasonWeight(perfume, season) {
  const weight = perfume.seasonWeights?.[season];

  if (typeof weight === "number" && Number.isFinite(weight)) {
    return weight;
  }

  // The same fallback the Composer uses where a fragrance carries no weight: declared seasons count as 6.
  return Array.isArray(perfume.seasons) && perfume.seasons.includes(season) ? 6 : 0;
}

function matching(values, allowed) {
  return Array.isArray(values) ? allowed.filter((value) => values.includes(value)) : [];
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function round(value, digits = 2) {
  const factor = 10 ** digits;

  return Math.round(value * factor) / factor;
}

function isUsablePerfume(perfume) {
  return Boolean(perfume) && typeof perfume === "object" && Number.isInteger(perfume.id);
}
