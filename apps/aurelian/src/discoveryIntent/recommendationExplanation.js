// Aurelian-owned presentation concern — turns real Composer explanation
// evidence into a short, honest reason line for the "Recomendado para ti"
// cards. This is a separate, sibling concern from
// intentRecommendationPolicy.js (which decides what Composer should
// compute); this file only ever narrates what Composer actually returned.
//
// Deliberately NOT branched by which Discovery Intent is active: the
// matched vibes/occasions read below only exist because the active
// intent's own preferences (owned entirely by intentRecommendationPolicy.js)
// were fed to Composer, so the evidence is already intent-flavored by
// construction. This function just describes whatever real match exists.
//
// Evidence rule (deliberately conservative): a reason is only ever shown
// when the evidence itself names the property being claimed. Only
// `preference_anchor` (real matched vibes/occasions) and `versatility_anchor`
// (real breadth counts, above a threshold) ever produce copy. Every other
// code — including the always-present generic `composer_balance_pick` —
// describes the collection's needs, not this fragrance's own character, and
// never produces a reason on its own. Nothing here claims gift-safety,
// accessibility, "personality," or mass appeal, because no explanation code
// carries evidence for those. Never mentions perceptual learning, teaching,
// or development — this is a v1 describing fit, not claiming capability.

// Reuses the same Spanish vibe labels already shipped in the shared
// Builder's es-MX locale (the taxonomy.* keys) — no new copy system, just
// a short phrase built from the labels the evidence names.
const VIBE_LABELS = Object.freeze({
  fresh: "Fresco",
  clean: "Limpio",
  approachable: "Accesible",
  easy: "Fácil",
  seductive: "Seductor",
  confident: "Seguro",
  elegant: "Elegante",
  sophisticated: "Sofisticado",
  warm: "Cálido",
});

// Ordered most-specific-first; each entry only fires when the occasion(s)
// it names are actually present in this recommendation's own evidence.
const OCCASION_PHRASES = Object.freeze([
  { allOf: ["night", "date"], phrase: "Pensado para noche y citas." },
  { anyOf: ["night", "evening"], phrase: "Pensado para la noche." },
  { anyOf: ["date"], phrase: "Pensado para citas." },
  { anyOf: ["daily", "day"], phrase: "Versátil para uso diario." },
  { anyOf: ["special"], phrase: "Pensado para ocasiones especiales." },
]);

// Conservative, first-iteration thresholds (out of 4 real season tags and
// 12 real occasion tags in the catalog taxonomy) — revisit with real usage
// data rather than treating these as settled.
const VERSATILITY_SEASON_THRESHOLD = 3;
const VERSATILITY_OCCASION_THRESHOLD = 4;
const VERSATILITY_PHRASE = "Versátil: funciona en distintas ocasiones.";

function findExplanation(recommendation, code) {
  return (recommendation?.explanations || []).find((item) => item.code === code) || null;
}

function lowercaseFirst(word) {
  return word.charAt(0).toLowerCase() + word.slice(1);
}

function buildVibePhrase(matchedVibes) {
  const labels = matchedVibes.map((vibe) => VIBE_LABELS[vibe]).filter(Boolean).slice(0, 3);

  if (labels.length === 0) {
    return null;
  }

  if (labels.length === 1) {
    return `${labels[0]}.`;
  }

  // Only the first word is capitalized mid-sentence, matching natural
  // Spanish (e.g. "Fresco, limpio y accesible." not "Fresco, Limpio y Accesible.").
  const [first, ...restLabels] = labels;
  const lowered = restLabels.map(lowercaseFirst);
  const last = lowered[lowered.length - 1];
  const middle = lowered.slice(0, -1);
  return [first, ...middle].join(", ") + ` y ${last}.`;
}

function buildOccasionPhrase(matchedOccasions) {
  const matchedSet = new Set(matchedOccasions);

  for (const entry of OCCASION_PHRASES) {
    if (entry.allOf && entry.allOf.every((occasion) => matchedSet.has(occasion))) {
      return entry.phrase;
    }

    if (entry.anyOf && entry.anyOf.some((occasion) => matchedSet.has(occasion))) {
      return entry.phrase;
    }
  }

  return null;
}

export function explainRecommendation(recommendation) {
  const preferenceAnchor = findExplanation(recommendation, "preference_anchor");

  if (preferenceAnchor) {
    const vibePhrase = buildVibePhrase(preferenceAnchor.evidence?.matchedVibes || []);
    if (vibePhrase) {
      return vibePhrase;
    }

    const occasionPhrase = buildOccasionPhrase(preferenceAnchor.evidence?.matchedOccasions || []);
    if (occasionPhrase) {
      return occasionPhrase;
    }
  }

  const versatilityAnchor = findExplanation(recommendation, "versatility_anchor");

  if (versatilityAnchor) {
    const { seasonCount = 0, occasionCount = 0 } = versatilityAnchor.evidence || {};
    if (seasonCount >= VERSATILITY_SEASON_THRESHOLD || occasionCount >= VERSATILITY_OCCASION_THRESHOLD) {
      return VERSATILITY_PHRASE;
    }
  }

  return null;
}
