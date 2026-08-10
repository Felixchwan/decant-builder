# ADR-0021: Perceptual Learning v1 — Aurelian-Owned, Local Anonymous Learner Identity and Persistence

**Status:** Accepted
**Related:** Depends on ADR-0001 (no backend) and ADR-0011 (local-only persistence — this ADR reuses and extends that pattern for a second, independently-keyed kind of state). Resolves the open question in `docs/architecture-gaps.md` ("No customer/user identity model") for this one feature, per that document's own instruction to resolve it "with an actual ADR reflecting the identity model chosen" once a real feature needs it. Applies ADR-0004/ADR-0007's "merchant-specific behavior belongs in host code" principle and ADR-0005's precedent of extracting shared packages only once a real second consumer exists. Implements infrastructure for the domain/doctrine defined in `docs/domain/PERCEPTUAL_LEARNING_DOMAIN_MODEL.md` (frozen conceptual baseline v0.3) and `docs/AURELIAN_PHILOSOPHY.md`.
**Evidence:** Adopted prospectively, ahead of implementation. Once merged, evidence is `apps/aurelian/src/perceptualLearning/*` and `apps/aurelian/src/perceptualLearningBoundary.test.js`.

## Context
Perceptual Learning needs durable, per-person evidence (Observations, EncounterInstances) that survives across visits, independent of Collection/box state. No customer or user identity concept exists anywhere in this system today; persistence is keyed per-merchant, not per-visitor (ADR-0011). Building this without deciding identity would either silently share one Learner's evidence across every visitor to the same browser profile, or require an account/backend system this codebase has explicitly deferred (ADR-0001). Separately, nothing in the frozen domain model claims Perceptual Learning is merchant-agnostic, reusable machinery the way Catalog/Composer are — it is presented throughout `AURELIAN_PHILOSOPHY.md` as Aurelian's own doctrine, and Discovery Decants has no equivalent mandate anywhere in this repository.

## Decision
Perceptual Learning v1 is Aurelian-owned host code (`apps/aurelian/src/perceptualLearning/`), not an addition to `@discovery-box/builder`. It is not extracted as a shared package, and Discovery Decants is not anticipated as a consumer. Nothing about it is exposed through `DiscoveryBoxBuilder`'s public props in this phase.

It introduces one new identity: an anonymous, local, per-device `learnerId`, generated lazily — on the first successful evidence write, not on page visit — and persisted under its own Aurelian-owned `localStorage` key, independent of and never nested inside Collection's existing `aurelian-builder-v1` key. This identity requires no authentication and correlates to no Customer record.

Perceptual Learning's evidence (EncounterInstance, Observation) is persisted locally via a small adapter, following the same schema-version + full-revalidate-on-read template ADR-0011 established for Collection persistence and explicitly named there as reusable for "a second kind of persisted state."

Reflective evidence captured by Perceptual Learning must not feed Composer or recommendation preferences in this decision's scope. Any future translation of learning evidence into Composer input is a separate product/doctrine decision, not an assumed consequence of this ADR.

## Alternatives Considered
- **Reuse Collection's existing storage key/identity model** — rejected; Collection has no per-visitor identity at all (ADR-0011's own gap), and nesting Learner evidence inside box state would couple two independent aggregate lifetimes for no reason.
- **Account-based identity (email/magic link)** — rejected for v1; requires a backend, explicitly out of scope per ADR-0001 and `ENGINEERING_GUIDE.md` §8 ("Add accounts... Not a PR — raise it first").
- **Reuse `customerInfo` (name/city) collected at finalization** — rejected; transient, never validated unique, never a lookup key, discarded whenever `localStorage` clears.
- **No identity at all (single implicit local Learner per device)** — rejected; indistinguishable from "no identity," contradicts the frozen domain model's `Learner` concept, and forecloses any reasoned future account migration.
- **Ship Perceptual Learning as shared/`@discovery-box/builder` code from day one** — rejected; no evidence anywhere in the frozen model or doctrine that this is meant to be merchant-agnostic, and ADR-0005's own precedent is to extract shared code only once a real second consumer exists, not speculatively.

## Trade-offs
**Gains**
- No new infrastructure, no account system, zero backend.
- Reuses a pattern this codebase already trusts (ADR-0011's template) rather than inventing a new one.
- `Learner.customerRef` (frozen model §3) stays available, unpopulated, for a future account-linking step without evidence ever needing to be re-owned — `learnerId` itself never changes.

**Costs**
- Evidence is device-local only; the same person on a second device is a second, unrelated Learner.
- If `localStorage` is cleared, all Perceptual Learning evidence for that device is gone, exactly like Collection persistence today.
- A second, independently-keyed local persistence surface now exists in Aurelian — deliberate, since Collection and Perceptual Learning are genuinely different aggregate lifetimes, but worth naming.

## Consequences
- This is the first concrete answer to the identity question `architecture-gaps.md` left open. Future features needing "the same person, recognized again" still require a real backend, but now have a working local-identity precedent to migrate from.
- If Perceptual Learning is ever proposed for a second merchant, this ADR's "Aurelian-owned, not shared" decision must be revisited explicitly then, not silently extended.

## Revisit Criteria
Revisit if:
- Cross-device recognition for this evidence specifically is requested as a real, repeated need.
- A second Aurelian-owned feature needs the same local-identity + adapter pattern.
- Perceptual Learning is proposed for a second merchant.
- A concrete, deliberately-reviewed decision is made to let learning evidence inform Composer/recommendations — at that point a new ADR governs that translation, not this one.
