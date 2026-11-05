import { TODAY_MAX_RECOMMENDATIONS, scoreTodayCandidates } from "./buildTodayRecommendations.js";
import { deriveTodayContext } from "./todayContext.js";

// "Para hoy" as a curated set rather than three similar high scorers: one pick for DAILY, one for DATE and one for the
// occasion that suits the moment. Merchant-neutral, deterministic, no model and no randomness.
//
// This layer sits ON TOP of the TodayScore (buildTodayRecommendations.js). It never re-weights or re-scores anything: every
// candidate arrives already scored over the same factors, and `score`, `factors` and `reasons` on a returned pick are exactly
// the base engine's. Only WHICH fragrances are returned, and the role each one stands for, are decided here.
//
//   RoleScore = TodayScore + roleMembershipBonus
//
//   roleMembershipBonus  the SAME constant for every candidate that carries the role's occasion, and 0 for one that does not.
//                        Occasions are categorical tags: a fragrance's `occasions` list says which occasions it supports, not how
//                        much, so nothing is read from the order of the list. Membership is REQUIRED (a fragrance without the
//                        occasion is not a candidate), so within one role the contextual TodayScore alone separates the
//                        candidates; the bonus only keeps RoleScore honest when roles are compared as a set.
//
// A candidate must also be sensible for the moment, so a role tag alone can never carry a fragrance in: it must earn at least
// ROLE_MIN_NORMALIZED_SCORE of the points available to it AND show some seasonal or temperature fit.
//
// The three picks are chosen TOGETHER, not one after another: every combination of the top candidates per role is compared and
// the best set wins (see compareAssignments), so taking the best Daily first can never cost the set a clearly better Date.
//
// The third role is derived from the moment (see resolveDynamicRole). It is always an existing occasion key.

export const TODAY_FIXED_ROLES = Object.freeze(["daily", "date"]);
export const TODAY_ROLE_SOURCES = Object.freeze({ fixed: "fixed", contextual: "contextual" });
// Added to the TodayScore of every candidate that carries the role's occasion. Constant: occasion tags are unranked.
export const ROLE_MEMBERSHIP_BONUS = 10;
// A role candidate needs this share of the points available to it, and this share of the seasonal (or temperature) factor.
export const ROLE_MIN_NORMALIZED_SCORE = 0.45;
export const ROLE_MIN_SEASONAL_FIT = 0.3;
// A stronger contextual occasion replaces the default only when its best candidate's TodayScore beats the default's by this much.
export const WEEKEND_VACATION_MARGIN = 6;
export const NIGHT_CLUB_MARGIN = 8;
// How many candidates per role take part in the combined assignment.
const POOL_DEPTH = 10;

export function buildTodayRoleRecommendations({ perfumes = [], context, limit = TODAY_MAX_RECOMMENDATIONS } = {}) {
  const todayContext = deriveTodayContext(context);
  const count = Math.max(0, Math.min(TODAY_MAX_RECOMMENDATIONS, Number.isInteger(limit) ? limit : TODAY_MAX_RECOMMENDATIONS));

  if (!todayContext || !Array.isArray(perfumes)) {
    return { context: todayContext, confidence: null, dynamicRole: null, recommendations: [] };
  }

  const scored = scoreTodayCandidates(perfumes, todayContext);
  const dynamicRole = scored.length > 0 ? resolveDynamicRole(todayContext, scored) : null;

  if (count === 0 || scored.length === 0) {
    return { context: todayContext, confidence: null, dynamicRole, recommendations: [] };
  }

  const roles = [
    ...TODAY_FIXED_ROLES.map((key) => ({ key, source: TODAY_ROLE_SOURCES.fixed })),
    { key: dynamicRole, source: TODAY_ROLE_SOURCES.contextual },
  ].slice(0, count);

  const pools = roles.map(({ key }) => buildRolePool(scored, key));
  const assigned = assignRoles(pools);
  const used = new Set(assigned.filter(Boolean).map(({ candidate }) => candidate.perfume.id));
  const houses = new Set(assigned.filter(Boolean).map(({ candidate }) => houseOf(candidate.perfume)));

  // A role with no sensible candidate takes the best unused pick of the plain Today ranking, and says so. Nothing here claims
  // the fragrance has the role's occasion: the pick carries `fallback: true` and presentation shows no role for it.
  const recommendations = roles.map((role, index) => {
    const pick = assigned[index];

    if (pick) {
      return { ...pick.candidate, roleScore: pick.roleScore, role: { key: role.key, source: role.source, fallback: false } };
    }

    const fallback =
      scored.find(({ perfume }) => !used.has(perfume.id) && !houses.has(houseOf(perfume))) ??
      scored.find(({ perfume }) => !used.has(perfume.id));

    if (!fallback) return null;

    used.add(fallback.perfume.id);
    houses.add(houseOf(fallback.perfume));

    return { ...fallback, roleScore: null, role: { key: role.key, source: role.source, fallback: true } };
  }).filter(Boolean);

  return {
    context: todayContext,
    // The set is only as sure as its weakest pick.
    confidence:
      recommendations.length === 0 ? null : recommendations.every(({ confidence }) => confidence === "high") ? "high" : "moderate",
    dynamicRole,
    recommendations,
  };
}

// The occasion the third pick stands for, from the moment alone (plus, for two upgrades, the catalog's own evidence):
//
//   workday daytime                    office
//   weekend daytime                    casual, or vacation when the moment is summery or warm and a vacation fragrance clearly
//                                      outscores the best casual one that is not itself a vacation fragrance
//   Friday / Saturday evening, night   night, or club when it is night-time and a fragrance that is both club and night
//                                      clearly outscores the best night one that is not a club fragrance
//   ordinary weekday evening or night  night   (also a Sunday night, the small hours)
//   anything else                      casual
//
// Weather is never an input: it can neither produce nor remove a role, it only moves the scores the roles compete on.
export function resolveDynamicRole(todayContext, scored) {
  const { dayContext, time, season, temperatureBucket } = todayContext;
  // The best TodayScore among a role's sensible candidates that also pass `include`, or null when there are none.
  const best = (key, include = () => true) => {
    const top = buildRolePool(scored, key).find(({ candidate }) => include(candidate.perfume));

    return top ? top.candidate.score : null;
  };

  if (dayContext === "workday_daytime") return "office";

  if (dayContext === "weekend_daytime") {
    // Vacation needs the moment to support it (summer, or a warm / hot reading) AND a vacation fragrance that clearly outscores
    // the best casual fragrance that is not itself a vacation one (otherwise the same bottle would be compared with itself).
    const supportsVacation = season === "summer" || temperatureBucket === "hot" || temperatureBucket === "warm";
    const vacation = supportsVacation ? best("vacation") : null;
    const casual = best("casual", (perfume) => !hasOccasion(perfume, "vacation"));

    return vacation !== null && (casual === null || vacation >= casual + WEEKEND_VACATION_MARGIN) ? "vacation" : "casual";
  }

  if (dayContext === "social_night" || time === "evening" || time === "night") {
    // Club only in the night proper of a social night, with a fragrance that is both club and night, and only when it clearly
    // outscores the best night fragrance that is not a club one.
    if (dayContext === "social_night" && time === "night") {
      const club = best("club", (perfume) => hasOccasion(perfume, "night"));
      const night = best("night", (perfume) => !hasOccasion(perfume, "club"));

      if (club !== null && (night === null || club >= night + NIGHT_CLUB_MARGIN)) return "club";
    }

    return "night";
  }

  return "casual";
}

// The sensible candidates for one role, best RoleScore first (ties by id, ascending).
export function buildRolePool(scored, key) {
  return scored
    .filter((candidate) => hasOccasion(candidate.perfume, key) && isSensibleForMoment(candidate))
    .map((candidate) => ({ candidate, roleScore: round(candidate.score + roleMembershipBonus(candidate.perfume, key)) }))
    .sort((first, second) => second.roleScore - first.roleScore || first.candidate.perfume.id - second.candidate.perfume.id);
}

export function roleMembershipBonus(perfume, key) {
  return hasOccasion(perfume, key) ? ROLE_MEMBERSHIP_BONUS : 0;
}

function hasOccasion(perfume, key) {
  return Array.isArray(perfume?.occasions) && perfume.occasions.includes(key);
}

// Enough of the available points, and not seasonally or thermally wrong: the better of the calendar season and (when the host
// supplied one) the temperature must show some fit.
function isSensibleForMoment({ normalizedScore, factors }) {
  const seasonal = factors
    .filter(({ code }) => code === "season" || code === "temperature")
    .map(({ points, max }) => (max > 0 ? points / max : 0));

  return normalizedScore >= ROLE_MIN_NORMALIZED_SCORE && Math.max(0, ...seasonal) >= ROLE_MIN_SEASONAL_FIT;
}

// Every combination of the top candidates per role (or no candidate for a role), compared as a whole. 11^3 combinations at most.
function assignRoles(pools) {
  const options = pools.map((pool) => [...pool.slice(0, POOL_DEPTH), null]);
  let best = null;

  const visit = (index, chosen) => {
    if (index === options.length) {
      const summary = summarize(chosen);

      if (!best || compareAssignments(summary, best) < 0) best = summary;

      return;
    }

    for (const option of options[index]) {
      if (option && chosen.some((taken) => taken && taken.candidate.perfume.id === option.candidate.perfume.id)) continue;

      visit(index + 1, [...chosen, option]);
    }
  };

  visit(0, []);

  return best ? best.chosen : pools.map(() => null);
}

function summarize(chosen) {
  const filled = chosen.filter(Boolean);
  const houses = filled.map(({ candidate }) => houseOf(candidate.perfume));

  return {
    chosen,
    filled: filled.length,
    sharedHouses: houses.length - new Set(houses).size,
    total: round(filled.reduce((sum, { roleScore }) => sum + roleScore, 0)),
    scores: chosen.map((pick) => (pick ? pick.roleScore : Number.NEGATIVE_INFINITY)),
    ids: chosen.map((pick) => (pick ? pick.candidate.perfume.id : Number.POSITIVE_INFINITY)),
  };
}

// Negative when `first` is the better set: more roles filled, then fewer shared houses, then the higher combined RoleScore, then
// the higher RoleScore role by role (Daily first), then the lower ids role by role. A total order, so the result never depends on iteration order.
function compareAssignments(first, second) {
  if (first.filled !== second.filled) return second.filled - first.filled;
  if (first.sharedHouses !== second.sharedHouses) return first.sharedHouses - second.sharedHouses;
  if (first.total !== second.total) return second.total - first.total;

  // Equal totals (common: occasion tags are unranked, so interchangeable fragrances swap roles at no cost to the sum): the earlier
  // role gets the stronger contextual pick, Daily first.
  for (let index = 0; index < first.scores.length; index++) {
    if (first.scores[index] !== second.scores[index]) return second.scores[index] - first.scores[index];
  }

  for (let index = 0; index < first.ids.length; index++) {
    if (first.ids[index] !== second.ids[index]) return first.ids[index] < second.ids[index] ? -1 : 1;
  }

  return 0;
}

function houseOf(perfume) {
  return typeof perfume.brand === "string" && perfume.brand ? perfume.brand : `id:${perfume.id}`;
}

function round(value, digits = 2) {
  const factor = 10 ** digits;

  return Math.round(value * factor) / factor;
}
