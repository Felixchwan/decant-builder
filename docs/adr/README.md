# Architecture Decision Records — Decant Builder

These records were **reconstructed from the current implementation**, not transcribed from prior design discussions — no ADR log existed before this one. Each entry documents a decision already live in the codebase, derived from source and test inspection. "Alternatives Considered" and "Trade-offs" are reconstructed judgment calls about what the implementation implies was weighed, not a record of an actual discussion, except where an entry cites specific evidence of intent (e.g., git history) — that distinction is called out per entry, not assumed.

This log went through one governance revision after initial authoring: two ADRs (0006, 0008) had weak or vague content strengthened; several ADRs had revisit criteria tightened to be observable rather than speculative; two ADRs (0009, 0018) were demoted out of the log entirely; two ADRs (0019, 0020) were added for decisions the original pass missed; and one candidate ADR (customer identity) was investigated and deliberately *not* added — see `docs/architecture-gaps.md`.

A subsequent semantic pass renamed ADR-0004 to avoid describing build-time merchant configuration as runtime multi-tenancy, tightened ADR-0001's terminology to distinguish "no shared application backend" from a host framework's own server-rendering capability (relevant given ADR-0017's Next.js host), and reclassified the ownership of ADR-0002 (WhatsApp finalization) and ADR-0010 (merchant-bound locale) from Domain to Application/Host-integration and Application/Presentation-policy respectively, on the grounds that both are business-motivated policies realized entirely through host wiring and configuration rather than core domain objects.

## Status vocabulary
- **Accepted (retroactive)** — decision already implemented; documented after the fact. Every entry below carries this status.
- **Accepted** — reserved for a future decision documented prospectively, before implementation.
- **Superseded by ADR-XXXX** — reserved for when a later ADR explicitly replaces this one. No entry currently carries this status.
- **Demoted** — moved out of the ADR log to a different document type; the number is retired, not reused, and the stub file explains where the content went.

## Active ADRs

| ADR | Decision | Owner | Related |
|---|---|---|---|
| [0001](0001-fully-client-side-architecture.md) | No application backend or shared server tier | Infrastructure | Parent of 0002, 0011 |
| [0002](0002-whatsapp-deep-link-finalization.md) | WhatsApp deep link as the sole order-finalization channel | Application / Host integration | Depends on 0001; coupled to 0012 |
| [0003](0003-points-as-value-abstraction.md) | Points as the sole value abstraction (points × pointValue) | Domain | Instance of 0004; see 0018 (demoted) |
| [0004](0004-merchant-multitenancy-build-time.md) | Per-merchant configuration selected at build time | Domain | Parent of 0003, 0010, 0016 |
| [0005](0005-monorepo-package-split.md) | Monorepo split into independent builder and catalog packages | Application | Parent of 0006, 0007, 0008 |
| [0006](0006-catalog-package-agnostic.md) | Catalog package kept commerce- and brand-agnostic | Application | Instance of 0005; sibling of 0007; parent of 0014 |
| [0007](0007-composer-core-merchant-agnostic.md) | Composer Core kept merchant-agnostic and isolated from Builder-core | Application | Instance of 0005; sibling of 0006; parent of 0015, 0020 |
| [0008](0008-boundaries-enforced-by-tests.md) | Architectural boundaries enforced by automated tests | Application (process) | Mechanism for 0006, 0007, 0019 |
| [0010](0010-locale-bound-to-merchant.md) | Locale bound to merchant identity at config-authoring time | Application / Presentation policy | Instance of 0004 |
| [0011](0011-local-only-persistence.md) | Persistence is local-only (localStorage), schema-versioned, unsynced | Application | Depends on 0001; see architecture-gaps.md |
| [0012](0012-finalization-injected-by-host.md) | Finalization channel injected by host, not imported by shared package | Application / Host integration | Coupled to 0002 |
| [0013](0013-analytics-provider-neutral-allowlist.md) | Analytics as a provider-neutral contract with an explicit payload allowlist | Application | — |
| [0014](0014-catalog-assets-by-abstract-key.md) | Catalog assets referenced by abstract key, resolved by host-supplied function | Application / Infrastructure | Instance of 0006 |
| [0015](0015-composer-greedy-plus-refinement.md) | Composer uses greedy construction + optional local-search refinement, client-side | Application / Infrastructure | Depends on 0007; see 0020 |
| [0016](0016-curator-bonus-reserved-slots.md) | Curator Bonus modeled as reserved physical slots, config-driven | Domain | Instance of 0004 |
| [0017](0017-two-frontend-frameworks-per-brand.md) | Two separate frontend frameworks/hosts, one per brand | Infrastructure / Host integration | Builds on 0005, 0019 |
| [0019](0019-environment-detection-ownership.md) | Environment detection ownership stays with the host, not shared code | Application / Host integration | Mechanism instance of 0008; proven by 0017 |
| [0020](0020-composer-outcome-contract.md) | Composer reports a three-layer outcome contract, not a success/failure flag | Application | Depends on 0007, 0015 |
| [0021](0021-perceptual-learning-local-identity-and-persistence.md) | Perceptual Learning v1 is Aurelian-owned, with a local anonymous Learner identity and adapter-based persistence | Application / Host integration | Depends on 0001, 0011; resolves the identity gap in `docs/architecture-gaps.md` |
| [0022](0022-perceptual-learning-comparison-aggregate.md) | Comparison is a third Perceptual Learning Aggregate Root; persisted schema evolves to v2 with a non-destructive v1 migration | Domain | Extends 0021 |

## Demoted

| Former ADR | Now lives at | Why demoted |
|---|---|---|
| ~~0009~~ | [`docs/engineering-conventions.md`](../engineering-conventions.md) | Hand-rolled validation is an internal implementation convention operating inside boundaries 0004/0011/0013 already establish — it doesn't shape system structure or capability. |
| ~~0018~~ | [`docs/backlog/tier-id-range-integrity.md`](../backlog/tier-id-range-integrity.md) | Tier-from-ID-range shows no evidence of being weighed among real alternatives; it reads as an accreted convention, not a decision. Reframed as a data-integrity backlog item. |

Both numbers are retired (stub files remain at their original paths explaining the move) and must not be reused.

## Investigated, not added

| Candidate | Disposition | Where |
|---|---|---|
| "No customer/user identity model" | **Not added as an ADR.** Investigated persistence keying, analytics flow-ID generation, and transient customer-info handling for evidence of a deliberate anonymous/local-first identity decision. Found none — the absence is total and uniform but never appears to have been weighed as its own question, only as a consequence of ADR-0001 and ADR-0011. Writing it up as an affirmative "local-first identity" decision would fabricate deliberateness the evidence doesn't support. | [`docs/architecture-gaps.md`](../architecture-gaps.md) |

This is the one case in this revision where evidence was insufficient to reconstruct an ADR honestly. No other candidate decision in this set had that problem — the weak points found elsewhere (0006's original alternatives, several vague revisit criteria) were quality issues, fixed in place, not evidence gaps about whether a decision happened at all.
