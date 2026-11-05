import { TODAY_REASON_MIN_RATIO } from "./buildTodayRecommendations.js";

// Which (at most two) lines explain a "Para hoy" pick, as structured evidence. Words are never made here: presentation turns each
// entry's code and evidence into a sentence (todayRecommendationLabels.js), so a line can only say what its evidence holds.
//
// The base engine's own reasons stay exactly as they were (they describe the MOMENT: "Buena opción para la noche"). This adds the
// other half, why THIS fragrance suits it, by pairing the moment with the fragrance's own catalog metadata:
//
//   profileWeather   the weather factor scored >= 60% of its maximum: its evidence already names the accords and vibes that matched
//                    the thermal / rainy profile (fresh in the heat, warm and cozy when cool, cold or raining)
//   profileTime      the time-of-day factor scored >= 60% of its maximum AND it matched at least one vibe of that part of the day
//   profileRole      the pick fills a role from real metadata (not a fallback), carries that occasion, and has at least one vibe the
//                    role's profile names; it says what the profile adds, never just the role's name (the pill says that)
//
// Every descriptor in a profile entry is something the factor itself found in the fragrance's accords or vibes: nothing is inferred
// from the fragrance's name, brand, price or position in a list, and nothing here describes projection, longevity or any
// characteristic the catalog does not carry.
//
// Lines are chosen in this order, then filled up to MAX_TODAY_EXPLANATION_LINES from the base reasons:
//   1. profile + weather / temperature     2. profile + time of day     3. profile + role     4. the base reasons
// The base reasons that a profile line already covers (weather, temperature, the time of day) are dropped, so two lines never
// say the same thing; the day-context and season reasons remain as fillers.

export const MAX_TODAY_EXPLANATION_LINES = 2;

// Vibes that make a role's profile mean something beyond the occasion's name. A role absent here gets no profile line.
const ROLE_VIBES = Object.freeze({
  daily: Object.freeze(["versatile", "easy", "clean", "fresh", "approachable", "relaxed"]),
  date: Object.freeze(["seductive", "elegant", "sophisticated", "mysterious", "warm"]),
  office: Object.freeze(["clean", "fresh", "classic", "sophisticated", "elegant"]),
  casual: Object.freeze(["easy", "relaxed", "fresh", "clean", "versatile"]),
  night: Object.freeze(["seductive", "mysterious", "dark", "elegant", "bold", "sophisticated"]),
});

const PROFILE_CODES = Object.freeze(["profileWeather", "profileTime", "profileRole"]);

// The lines for a whole set of picks, in card order. Each card gets its own best two lines (below); then, so a set does not repeat
// one sentence card after card, a PROFILE line that an earlier card already shows verbatim (same code, same evidence) is swapped for
// another profile line of the same fragrance that is not yet on screen, when it has one. A line is never swapped for a plainer one,
// and when two fragrances really share their strongest evidence they keep the same wording: truthfulness before variety.
export function deriveTodayExplanations(picks = []) {
  const shown = new Set();

  return picks.map((pick) => {
    const candidates = rankTodayExplanations(pick);
    const lines = candidates.slice(0, MAX_TODAY_EXPLANATION_LINES);

    lines.forEach((line, index) => {
      if (!isProfile(line) || !shown.has(lineKey(line))) return;

      const alternative = candidates.find((other) => isProfile(other) && !lines.includes(other) && !shown.has(lineKey(other)));

      if (alternative) lines[index] = alternative;
    });
    lines.forEach((line) => shown.add(lineKey(line)));

    return lines;
  });
}

// One pick on its own: its best (at most two) lines.
export function deriveTodayExplanation(pick) {
  return rankTodayExplanations(pick).slice(0, MAX_TODAY_EXPLANATION_LINES);
}

const isProfile = ({ code }) => PROFILE_CODES.includes(code);
const lineKey = ({ code, evidence }) => `${code}:${JSON.stringify(evidence)}`;

// Every line the evidence supports for one pick, best first (see the order above). `pick` is a scored candidate carrying its
// `factors`, `reasons`, `perfume` and (optionally) its assigned `role`.
function rankTodayExplanations({ factors = [], reasons = [], perfume, role } = {}) {
  const factor = (code) => factors.find((item) => item.code === code);
  const strong = (item) => Boolean(item) && item.points > 0 && item.points / item.max >= TODAY_REASON_MIN_RATIO;
  const profiles = [];

  const weather = factor("weather");

  if (strong(weather) && weather.evidence.accords.length + weather.evidence.vibes.length > 0) {
    profiles.push({
      code: "profileWeather",
      evidence: {
        profile: weather.evidence.profile,
        ...(weather.evidence.temperatureBucket ? { temperatureBucket: weather.evidence.temperatureBucket } : {}),
        ...(weather.evidence.weatherCondition ? { weatherCondition: weather.evidence.weatherCondition } : {}),
        accords: [...weather.evidence.accords],
        vibes: [...weather.evidence.vibes],
      },
    });
  }

  const time = factor("timeOfDay");

  if (strong(time) && time.evidence.vibes.length > 0) {
    profiles.push({ code: "profileTime", evidence: { time: time.evidence.time, vibes: [...time.evidence.vibes] } });
  }

  const roleVibes = role && !role.fallback ? ROLE_VIBES[role.key] : undefined;
  const ownVibes = Array.isArray(perfume?.vibes) ? perfume.vibes : [];
  const ownOccasions = Array.isArray(perfume?.occasions) ? perfume.occasions : [];

  if (roleVibes && ownOccasions.includes(role.key)) {
    const vibes = roleVibes.filter((vibe) => ownVibes.includes(vibe));

    if (vibes.length > 0) profiles.push({ code: "profileRole", evidence: { role: role.key, vibes } });
  }

  const covered = new Set();

  if (profiles.some(({ code }) => code === "profileWeather")) {
    covered.add("weather");
    covered.add("temperature");
  }

  if (profiles.some(({ code }) => code === "profileTime")) covered.add("timeOfDay");

  const fillers = reasons.filter(({ code }) => !covered.has(code));

  return [...profiles, ...fillers];
}
