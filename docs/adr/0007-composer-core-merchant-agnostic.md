# ADR-0007: Composer Core Kept Merchant-Agnostic and Isolated from Builder-Core

**Status:** Accepted (retroactive)
**Related:** An instance of ADR-0005's package split, protected by the enforcement mechanism ADR-0008 describes. Sibling to ADR-0006 (same kind of purity decision, applied to the Catalog package instead of an internal Builder subsystem). Parent of ADR-0015 (Composer's algorithm and execution location) and ADR-0020 (Composer's outcome contract) — both assume this isolation holds.
**Evidence:** `packages/builder/src/builder/composerMerchantBoundary.test.js` asserts every production module under `internal/composer/` and `internal/composition/` never matches `/merchantId|businessName|discovery-decants|Aurelian/`; `src/analytics/analyticsArchitecture.test.js` separately keeps analytics out of "Composer Core and scoring modules."

## Context
The Composer (`composeCollection` and its supporting modules — strategies, constraints, quality scoring, refinement) is the most algorithmically complex part of the system. It sits inside `@discovery-box/builder`, which *is* allowed to know about merchants elsewhere (e.g., `builder/config`) — so this boundary is an internal one, not the package-level boundary from ADR-0006.

## Decision
Even though Composer Core lives inside the merchant-aware `@discovery-box/builder` package, its own modules are held to the same brand-neutrality standard as the catalog package: no merchant identifiers, no brand strings, no analytics calls. It receives `catalog`, `request`, and `config` as plain arguments and returns plain data — it has no way to know or care which merchant invoked it.

## Alternatives Considered
- **Let Composer read merchant identity from config directly** (e.g., branch behavior per brand) — rejected; would make the optimizer's behavior merchant-specific and untestable in isolation from a real merchant config.
- **Move Composer into its own package**, mirroring the catalog split — not done; the boundary test achieves the same isolation guarantee without the build/versioning overhead of a fourth workspace package.
- **Trust code review to keep Composer clean** — rejected implicitly, same reasoning as ADR-0008.

## Trade-offs
**Gains**
- The Composer's correctness (constraint satisfaction, scoring, refinement convergence) can be reasoned about and tested purely as an algorithm, independent of any brand's rules.
- A future third merchant automatically gets the same Composer behavior with no risk of accidentally-merchant-specific logic leaking in.

**Costs**
- Every Composer input that *does* vary by merchant (box size limits, point values, strategy weights) must be threaded through explicitly as config/request parameters rather than looked up ambiently — more verbose call sites, in exchange for testability.

## Consequences
- This is what makes the Composer a candidate for extraction to a server-side or worker-thread execution context later (ADR-0015) without a rewrite — it already takes plain data in and returns plain data out.
- Any bug fix or quality-dimension change to the Composer benefits every merchant simultaneously and identically — there is no per-merchant Composer behavior to diverge.

## Revisit Criteria
Revisit if:
- A merchant states a need for Composer behavior that isn't expressible as configuration (e.g., a fundamentally different scoring philosophy, not just different weights).
- Composer execution needs to move off the main thread or off the client (see ADR-0015) — this boundary is precisely what makes that move cheap when it's needed, and its continued cleanliness should be checked before that migration begins.
