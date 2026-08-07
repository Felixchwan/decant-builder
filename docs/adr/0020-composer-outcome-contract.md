# ADR-0020: Composer Reports a Three-Layer Outcome Contract, Not a Success/Failure Flag

**Status:** Accepted (retroactive)
**Related:** Depends on ADR-0007 (Composer Core's merchant-agnostic purity keeps this contract's shape identical regardless of which merchant calls it) and ADR-0015 (the algorithm this contract reports the outcome of).
**Evidence:** `packages/builder/src/builder/internal/composer/composeCollection.js` returns `{ composed, mode, status, terminationReason, normalizedRequest, collection, collectionIds, constraintResult, qualityResult, greedyResult, refinementResult, diagnostics }`; `COMPOSER_STATUSES = { COMPLETED, PARTIAL, IMPOSSIBLE, FAILED }`; `COMPOSER_TERMINATION_REASONS` defines 11 named values (e.g., `REQUEST_INFEASIBLE`, `MINIMUM_UNREACHABLE`, `REFINEMENT_LOCAL_OPTIMUM`); `diagnostics` exposes both greedy- and refinement-stage internals plus derived flags (`lockedIdsPreserved`, `excludedIdsAbsent`, `targetSlotsReached`, `minimumSlotsReached`).

## Context
Composer can fail to fully satisfy a request in several structurally different ways: an infeasible request (e.g., locked items exceed budget), a catalog too small to reach the minimum, a valid-but-incomplete partial result, or a fully satisfied proposal. Callers — the UI, analytics — need to react differently to each, not treat them as one undifferentiated failure.

## Decision
Composer never returns a bare success/failure. It returns a three-layer outcome: a boolean `composed` flag (did we get a usable result at all), a `status` enum (`COMPLETED`/`PARTIAL`/`IMPOSSIBLE`/`FAILED`), and a specific `terminationReason` drawn from an 11-value enum, plus a `diagnostics` object exposing both the greedy and refinement stages' internals for deeper introspection (analytics, debugging).

## Alternatives Considered
- **Return the collection, or `null`/throw on failure** — rejected; this is not the shape most functions in this codebase use for fallible operations, and it would collapse "infeasible request," "catalog too small," and "refinement produced something worse than greedy" into one undifferentiated failure, losing exactly the information the `COMPOSER_GENERATION_FAILED` analytics event's `errorCategory` field needs.
- **A simple `{ success: boolean, result }` shape** — rejected as insufficiently granular; doesn't distinguish `PARTIAL` (usable but incomplete) from `IMPOSSIBLE` (nothing usable), which matters for how the UI should respond (offer a partial box vs. ask the customer to loosen constraints).
- **Expose only the final decision, discard greedy/refinement intermediate state** — rejected; the dual exposure of `greedyResult` and `refinementResult` side by side is what lets `selectBestModeCollection`'s fallback behavior (refinement loses to greedy if it scores worse) be independently verified after the fact rather than trusted blindly.

## Trade-offs
**Gains**
- Every Composer outcome is self-explaining without needing to re-derive "why" from timing or side effects.
- This is what makes `COMPOSER_GENERATION_FAILED` (ADR-0013's analytics contract) able to carry a specific `errorCategory` rather than a generic failure flag.

**Costs**
- The `diagnostics` object duplicates some fields already present at the top level (e.g., final collection IDs appear both as `collectionIds` and again inside `diagnostics.finalCollectionIds`) — a minor internal-consistency cost, not a functional one.

## Consequences
- Any future consumer of Composer (a new UI surface, or a future server-side/worker execution context per ADR-0015's revisit criteria) inherits this contract as-is.
- The contract's richness is what would let a future "explain why we couldn't build your box" customer-facing message be written directly from `terminationReason`, without new plumbing.

## Revisit Criteria
Revisit if:
- A caller is observed consistently collapsing this contract back down to a simple success/failure in its own code — a sign the granularity isn't earning its complexity in practice for that consumer.
- The top-level/`diagnostics` field duplication noted above is ever the direct cause of a real bug (the two disagreeing), rather than remaining harmless redundancy.
