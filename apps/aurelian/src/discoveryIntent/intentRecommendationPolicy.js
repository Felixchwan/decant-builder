import { aurelianCatalog } from "../merchant/catalog.js";

// Aurelian-owned. Translates a Discovery Intent choice into Composer's own
// request vocabulary (strategy/preferredOccasions/preferredVibes/
// excludedPerfumeIds) — nothing downstream of this file ever sees an intent
// id, a Spanish label, or any Aurelian-specific concept. This is a first
// production policy, not permanent domain truth: the specific strategy and
// preference values below were chosen from two empirical experiments run
// against the real Aurelian catalog (see project history), not derived from
// any new catalog metadata or scoring change.

// Derived from existing data, never hardcoded to a specific fragrance id —
// if the catalog's warningMessage flag ever moves to a different fragrance,
// this list moves with it automatically.
const WARNING_MESSAGE_EXCLUDED_IDS = Object.freeze(
  aurelianCatalog.filter((perfume) => Boolean(perfume.warningMessage)).map((perfume) => perfume.id),
);

const INTENT_RECOMMENDATION_POLICIES = Object.freeze({
  // "Fresco y cotidiano" — empirically, of the four strategies tested
  // (balanced/versatile/explorer/signature), "signature" gave the best
  // preference-anchor coverage (2 of 8 results explicitly tied to these
  // preferences) while matching "balanced"'s best-observed cross-intent
  // differentiation (2 of 8 fragrances shared with the "Noche" set under the
  // matching strategy pairing) — "versatile" scored equally well on
  // preference coverage but produced the worst differentiation (4 of 8
  // shared) because it converges toward the same broadly-wearable
  // fragrances regardless of the preferences fed into it.
  fresh_everyday: Object.freeze({
    strategy: "signature",
    preferredOccasions: Object.freeze(["daily", "day"]),
    preferredVibes: Object.freeze(["fresh", "clean", "approachable", "easy"]),
    excludedPerfumeIds: WARNING_MESSAGE_EXCLUDED_IDS,
  }),

  // "Noche con intención" — same reasoning as above: "signature" matched
  // "balanced" on cross-intent differentiation while being no worse on
  // preference coverage, and pairing it with "Fresco" also using
  // "signature" keeps the two intents' differentiation grounded in the same
  // measured configuration rather than an untested mix. No warningMessage
  // exclusion here: nothing in the existing add-to-box safety gate (the
  // "Rare Selection" confirmation in BuilderRuntime) requires excluding a
  // warningMessage fragrance from being *recommended* — only from being
  // added without confirmation — and the two production recommendation
  // lanes (basedOnYourPicks/toBalanceYourBox) already surface
  // warningMessage fragrances today without issue.
  intentional_evening: Object.freeze({
    strategy: "signature",
    preferredOccasions: Object.freeze(["night", "date", "evening"]),
    preferredVibes: Object.freeze(["seductive", "confident", "elegant", "sophisticated", "warm"]),
    excludedPerfumeIds: Object.freeze([]),
  }),

  // "Es un regalo" — fixed per the accepted product decision: strategy
  // "versatile", with the catalog's closest existing occasion tag as a soft
  // (non-restrictive) preference, plus the one real, data-derived exclusion
  // available (warningMessage).
  //
  // Documented residual limitation, accepted rather than papered over: the
  // "versatile" strategy measures collection-level breadth (does the
  // composed set cover many occasions/seasons), not any individual
  // fragrance's personal risk of being polarizing. Empirically, with this
  // exact configuration, a bold-but-unflagged fragrance (Armaf Club de Nuit
  // Intense Man — vibes: bold, confident, versatile — no warningMessage)
  // still ranked #1 with a perfect score when no secondary preference was
  // supplied. Adding preferredOccasions:["special"] measurably improved
  // this (that fragrance no longer appeared in the top 10), which is why it
  // stays here as a soft preference — but this is not a guarantee. No vibe
  // blacklist was introduced to close this gap: "bold"/"edgy"/"dark"/
  // "unique"/"intense" are not equivalent to "unsuitable as a gift," and
  // treating them as such would recreate the exact intent-as-eligibility
  // mistake this policy exists to remove.
  gift: Object.freeze({
    strategy: "versatile",
    preferredOccasions: Object.freeze(["special"]),
    excludedPerfumeIds: WARNING_MESSAGE_EXCLUDED_IDS,
  }),

  // "Quiero explorar todo" — no policy: enters the full catalog directly,
  // with no recommendation intermediary.
  explore_freely: null,
});

export function getIntentRecommendationHint(intentId) {
  return INTENT_RECOMMENDATION_POLICIES[intentId] || null;
}
