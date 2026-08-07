# ADR-0003: Points as the Sole Value Abstraction

**Status:** Accepted (retroactive)
**Related:** An instance of the merchant-configuration mechanism established by ADR-0004 — that ADR covers *how* per-merchant values are represented in general; this one covers the specific decision to represent *commercial value* as `points × pointValue`. See also ADR-0018 (tier — a presentational concern deliberately kept independent of `points`).
**Evidence:** `packages/catalog/src/fragrances.js` stores a `points` number per fragrance (no price field); `commerce.pointValue: 100` in `src/merchants/discoveryDecants/config.js`; `evaluateComposerConstraints.js` computes `estimatedValue = totalPoints * pointValue`; `catalogPackageBoundary.test.js` explicitly forbids the catalog package from ever mentioning `pointValue`.

## Context
Fragrances need a price, and that price needs to work across at least two merchants with potentially different commercial terms. Rather than storing a currency price per fragrance, each fragrance carries an abstract `points` value, and each merchant config carries one scalar (`commerce.pointValue`) that converts points to money.

## Decision
Order value is always `totalPoints × merchant.commerce.pointValue`. The catalog package is structurally forbidden (by test) from knowing about pricing at all — `points` is data, `pointValue` is merchant configuration, and multiplying them is the builder's job, not the catalog's.

## Alternatives Considered
- **Per-fragrance, per-merchant price list** — most flexible, allows non-linear/SKU-level pricing differences between merchants; rejected as disproportionate complexity for two merchants sharing a proportional pricing relationship.
- **Per-fragrance price with a single global currency** — rejected because it can't represent a second merchant in a different market/currency without duplicating the entire catalog's prices.
- **Tier-derived pricing** (price purely a function of tier) — rejected; `points` is stored explicitly per fragrance rather than derived, allowing intra-tier price variation (tier is a separate, independently-derived concern — see ADR-0018).

## Trade-offs
**Gains**
- Onboarding a new merchant in a new currency/market is a one-line config change (`commerce.pointValue`), not a catalog rewrite.
- Keeps the catalog package genuinely reusable for non-commerce purposes (see ADR-0006).

**Costs**
- Can only express **proportional** pricing differences between merchants. A merchant needing SKU-level discounts or non-linear pricing can't be expressed without distorting `points` itself or introducing a second pricing layer.
- Nothing currently validates that `points` values are internally consistent with the tier a fragrance's ID implies (ADR-0018) — the two systems are independent by design but unchecked against each other.

## Consequences
- The Composer, curator bonus unlock rule, and every value/total displayed to the customer all derive from this one formula — changing it changes the entire commerce model in one place, by design.
- A merchant wanting item-level pricing control today has no supported path; it would require a new mechanism, not a config change.

## Revisit Criteria
Revisit if a merchant states a need for pricing that the linear `points × pointValue` relationship cannot express — e.g., a specific fragrance needing a different price than its `points` value implies for that merchant, or a promotional/regional discount that isn't uniform across the whole catalog. The trigger is a stated requirement, not a projected one; no such requirement has been observed yet.
