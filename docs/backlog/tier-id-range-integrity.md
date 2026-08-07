# Backlog: Tier/Points Consistency Has No Integrity Check

**Type:** Data-integrity backlog note (not an ADR). Demoted from ADR status on governance review; see `docs/adr/0018-tier-derived-from-id-range.md` for the retirement note.

## What exists today
`packages/builder/src/utils/tierUtils.js`'s `getTierData(id)` derives a fragrance's displayed tier (Bronze/Silver/Gold/Platinum/Diamond/Mythic — name, emoji, color, glass-tint styling) purely from which numeric band its catalog `id` falls into (`id < 100` → Bronze, `< 200` → Silver, `< 300` → Gold, `< 400` → Platinum, `< 500` → Diamond, else Mythic). Pricing (`points`, see `docs/adr/0003-points-as-value-abstraction.md`) is stored independently, per fragrance, in `packages/catalog/src/fragrances.js` — it is not derived from the ID band or from tier.

## Why this isn't an ADR
There's no evidence this was a decision weighed against real alternatives — no comment, test, or design note frames it as a considered trade-off. It reads as a convention that fell out of an ID-numbering scheme presumably established for other reasons (batch/import ordering), applied consistently since. It doesn't shape system structure and affects only presentation of a single field.

## The actual gap
Nothing checks that a fragrance's ID band and its `points` value are consistent with each other. A future catalog import, merge, or manual addition that assigns an ID outside the current convention — or that assigns `points` inconsistent with the tier its ID implies — would silently produce a customer-visible mismatch (e.g., a "Gold"-badged item priced as Bronze), with no test catching it. This is the one piece of catalog data with comparable risk to what the boundary tests protect elsewhere (exact fragrance/note/brand-asset counts, unique IDs) but with no equivalent guard.

## Suggested fix (small, low-risk, not yet done)
Add an integrity test — alongside the existing `catalogPackageBoundary.test.js` / `catalogIdentityBaseline.test.js` assertions — that checks each fragrance's `id` band and `points` value fall within an expected relationship. This doesn't require changing the derivation itself (ADR-driven redesign is not warranted here), just adding the missing guard.

## When to act on this
- Before any catalog import, merge, or bulk-edit process is introduced that doesn't hand-assign IDs following the current convention.
- Immediately, if a tier/price mismatch is ever observed in the live catalog.
