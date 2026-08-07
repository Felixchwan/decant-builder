# ADR-0015: Composer Uses Greedy Construction + Optional Local-Search Refinement, Executed Client-Side

**Status:** Accepted (retroactive)
**Related:** Depends on ADR-0007 (Composer Core's merchant-agnostic purity is what would make moving this execution off-client a contained change rather than a rewrite, if that's ever needed). See also ADR-0020 (the outcome contract this algorithm produces).
**Evidence:** `packages/builder/src/builder/internal/composer/composeCollection.js` — always runs `composeCollectionGreedy` first; in `"best"` mode (the default, per `DEFAULT_COMPOSER_MODE`), and only if the greedy result is eligible, follows with `refineCollection` (candidate-move generation + iterative local search), falling back to the greedy result if refinement produces an invalid or lower-scoring collection. No server-side compute path exists anywhere for this — it runs wherever `DiscoveryBoxBuilder` is mounted, i.e., the customer's browser.

## Context
"Composer" needs to turn a customer's preferences (budget, seasons, occasions, vibes, a chosen strategy) into a complete, valid box proposal from the catalog (84 fragrances today), evaluated against multiple weighted quality dimensions and hard constraints (slot counts, budget, locked/excluded items).

## Decision
Implement this as a two-phase algorithm: a fast greedy constructor that always runs, optionally followed by iterative local-search refinement (candidate moves scored and applied one at a time, up to an iteration cap) when the mode is `"best"` and the greedy result is eligible for improvement. Run the entire thing synchronously in the browser, with no server-side or worker-thread execution path.

## Alternatives Considered
- **A global/exhaustive or ILP-style optimal solver** — rejected as unnecessary complexity; the two-phase heuristic approach with named termination reasons (see ADR-0020) gives explainable, "good enough" results at interactive speed, which matters more for a live UI than provable optimality.
- **A server-side or ML-based recommender** — rejected; would require a backend (contradicting ADR-0001) and training/maintaining a model for a curated, currently 84-item catalog where hand-tuned constraint/quality rules are more explainable and directly tunable by the team.
- **Fast mode always, no refinement** — rejected as the default; `"best"` mode (with refinement) is the default (`DEFAULT_COMPOSER_MODE`), trading some compute time for a better proposal, with `"fast"` available as an explicit opt-out.

## Trade-offs
**Gains**
- Instant, free, no infrastructure; every Composer run is fully explainable via `diagnostics` and a specific `terminationReason` (ADR-0020) rather than being a black box.
- The refinement step is self-correcting: it never returns a worse result than the greedy baseline (`selectBestModeCollection` falls back to greedy if refinement's score is lower or its result is invalid).

**Costs**
- `evaluateComposerConstraints` and `generateCandidateMoves` both iterate the full catalog per candidate move, and refinement repeats this across iterations — fine at the catalog's current size, but this is genuine client-side CPU cost that would grow as the catalog grows, with no server escape valve today if it ever becomes a problem on lower-end devices.

## Consequences
- Because Composer Core is merchant-agnostic and takes/returns plain data (ADR-0007), moving this computation to a server endpoint or a Web Worker later is a contained migration, not a rewrite — the algorithm itself wouldn't need to change, only where it runs.

## Revisit Criteria
Revisit if:
- A merchant's catalog is provisioned at a scale materially larger than today's 84 items, such that per-candidate constraint evaluation across the full catalog becomes a real per-interaction cost — the concrete signal to watch for is Composer generation becoming subjectively slow during ordinary manual use, since no telemetry currently exists to measure this automatically (standing up such telemetry would itself be a prerequisite for a data-driven version of this trigger).
