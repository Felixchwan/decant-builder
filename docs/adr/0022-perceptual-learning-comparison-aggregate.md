# ADR-0022: Perceptual Learning — Comparison as a Third Aggregate Root, Persisted Schema v2

**Status:** Accepted
**Related:** Extends ADR-0021 (Aurelian-owned Perceptual Learning, local anonymous identity, adapter persistence) — this ADR governs the specific domain/schema extension Phase 2 introduces on top of that foundation. Implements the domain/doctrine defined in `docs/domain/PERCEPTUAL_LEARNING_DOMAIN_MODEL.md` (frozen conceptual baseline v0.3) and `docs/AURELIAN_PHILOSOPHY.md`, extending it per the governance path that document's own §12 names ("una redefinición deliberada de una abstracción de dominio mayor... requiere un ADR").
**Evidence:** Adopted prospectively, ahead of implementation. Once merged, evidence is `apps/aurelian/src/perceptualLearning/comparison.js`, the schema-v2 changes in `perceptualLearningPersistence.js`, and `createComparisonWithEncounters.js`.

## Context
The frozen Perceptual Learning conceptual model (v0.3) defines exactly two Aggregate Roots: `Observation` (evidence about one encounter) and `EncounterInstance` (what Aurelian attempted to provoke). Phase 2's product goal — helping a Learner articulate the perceptual *difference* between two experiences, not just report on one — does not fit either existing aggregate without overloading `Observation`'s already-shipped, already-tested six-field contract with optional cross-referencing fields that would only apply to a fraction of records.

## Decision
A third Aggregate Root, `Comparison`, is introduced: `{comparisonId, learnerId, firstEncounterInstanceId, secondEncounterInstanceId, freeText, createdAt}`. It references two `EncounterInstance`s by id — never an `Observation`, never a raw `fragranceId` — because the thing being compared is the perceptual *experience* (the encounter), not whichever specific note happened to get written about it, and not an abstract catalog record. Order (`first`/`second`) is preserved as evidence of the sequence actually experienced, but carries no uniqueness constraint — the same pair, in either order, may be compared more than once, consistent with this context's existing "repeated/redundant evidence is not deduplicated" precedent.

Same-fragrance comparisons (both `EncounterInstance`s referencing the same `fragranceId`) are **not** a domain-level prohibition. The only hard invariant is `firstEncounterInstanceId !== secondEncounterInstanceId`, both belonging to the same `learnerId`. This is deliberate: the domain must remain capable of representing a genuine self-temporal comparison (the same fragrance, encountered separately, perceived differently) — a real instance of the metacognition axis `AURELIAN_PHILOSOPHY.md` §4 names. Steering the *ordinary* first-slice user journey toward two different fragrances is a UI-layer decision (Phase 2.1), not a domain rule.

The persisted schema evolves to `schemaVersion: 2`, adding a `comparisons` array alongside the existing `encounterInstances`/`observations`. This is implemented as a small, explicit, non-destructive migration inside the existing read path — not a general migration framework: a payload found with the legacy `schemaVersion: 1` is recognized, its existing fields validated exactly as before, and `comparisons` defaults to `[]` in memory. Nothing is written during a read. The next successful write persists the state under `schemaVersion: 2`, since a fresh write always stamps the current constant. The storage key itself (`aurelian-perceptual-learning-v1`) is unchanged — renaming it would orphan existing v1 data under a key nothing reads anymore, defeating the migration's purpose; the codebase already treats the storage-key string and the internal `schemaVersion` field as independent (see `builderPersistence.js`'s equivalent key, which has never incremented despite internal schema changes).

## Alternatives Considered
- **Add optional comparison fields to `Observation`** — rejected; conflates two different evidence shapes (single-encounter vs. cross-encounter), breaks `Observation`'s exact-key-set contract for records that don't use them, and was explicitly ruled out by the approved Phase 2 design.
- **Reference `Observation` ids instead of `EncounterInstance` ids** — rejected; would force a mandatory per-side `Observation` to exist before any comparison could be made, adding friction the product intent doesn't call for, and would make `Comparison` brittle to how many observations an encounter happens to have.
- **Hard-forbid same-fragrance comparisons at the domain layer** — rejected; would foreclose a legitimate future capability (self-temporal comparison) that the existing `EncounterInstance` model already supports (repeated encounters of the same fragrance are explicitly meaningful).
- **Bump the version and discard all v1 data on mismatch (no migration)** — rejected; would destroy every existing Phase 0/1 learner's real evidence the moment Phase 2 ships, for a purely additive schema change that doesn't require it.
- **Leave `schemaVersion` at 1 and add `comparisons` under the same version number indefinitely** — considered; simpler, but makes the version number progressively less meaningful as more additive fields accumulate across future phases. A small explicit migration was judged worth the modest extra code.

## Trade-offs
**Gains**
- `Comparison`'s invariants (two distinct owned encounters, non-blank freeText) are enforced at the same points (factory + persistence adapter) as the other two aggregates, with no new architectural pattern introduced.
- Existing Phase 0/1 evidence survives Phase 2's rollout unchanged and un-migrated-away; nothing is destructively rewritten until a learner's next real write.
- The domain stays capable of self-temporal comparison later without a breaking change now.

**Costs**
- A third Aggregate Root not enumerated in the frozen v0.3 conceptual document now exists in the implementation — this ADR is the record of that extension; the frozen document itself is left as-is per its own scope note (conceptual, not implementation-authorizing).
- `writePerceptualLearningState`'s validation now includes a referential-integrity check across records (a comparison's two referenced encounters must both exist in the same write and both belong to its `learnerId`) — a new kind of cross-record invariant this adapter didn't previously need, since `EncounterInstance`/`Observation` never referenced each other.

## Consequences
- Any future fourth aggregate or schema field should follow this same additive-with-explicit-migration pattern rather than a destructive version bump, unless a genuine breaking change is unavoidable.
- `createEncounterWithObservation.js` required a small, necessary fix (carrying `currentState.comparisons` forward into its constructed `nextState`) to avoid silently dropping a learner's existing comparisons on an ordinary Phase 1 write — noted here since it touches an already-shipped Phase 1 file for a real correctness reason, not a refactor.

## Revisit Criteria
Revisit if:
- A fourth Aggregate Root or another cross-record invariant is needed — check whether the referential-integrity pattern established here still fits before inventing a new one.
- Same-fragrance comparison is ever actually built (Phase 2.x/3) — confirm the domain-level permissiveness decided here still holds under real use.
- The frozen `PERCEPTUAL_LEARNING_DOMAIN_MODEL.md` is ever revised — reconcile it explicitly against the aggregate count this ADR and ADR-0021 have since established in implementation.
