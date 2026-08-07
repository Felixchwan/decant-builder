# Discovery Builder — Engineering Guide

This is operational guidance, not architecture documentation. Decisions and their reasoning live in `docs/adr/`; this guide exists to make those decisions fast to apply day-to-day. If this guide and an ADR ever disagree, the ADR wins — open an issue against this file, don't quietly follow the guide.

## 1. Purpose

This guide exists to help engineers extend Discovery Builder without violating established architecture. It does not introduce new rules — everything in it is already decided elsewhere (an ADR, a boundary test, or the domain model) and restated here only as a pointer, not a re-derivation.

## 2. Read first

- [`docs/adr/README.md`](adr/README.md) — the 18 active architecture decisions and why each was made.
- [`docs/architecture/C4.md`](architecture/C4.md) — C4 architecture document (System Context → Container → Component → Code).
- [`docs/domain/DOMAIN_MODEL.md`](domain/DOMAIN_MODEL.md) — entities, value objects, domain services, policies, invariants, aggregates, and domain events, derived from implemented behavior.
- [`docs/architecture-gaps.md`](architecture-gaps.md) — capabilities the system deliberately doesn't have yet, and why that's not the same as an oversight.
- [`docs/backlog/tier-id-range-integrity.md`](backlog/tier-id-range-integrity.md) — a known, unguarded data-integrity gap, kept out of the ADR log on purpose (see ADR-0018's retirement note).

## 3. Product philosophy

- **Discovery Builder sells discovery, not fragrance inventory.** The product's job is helping someone find fragrances worth trying, not maximizing catalog throughput. Features that increase choice without increasing discovery value are the wrong trade.
- **Prefer customer discovery value over feature count or technical novelty.** A smaller feature that sharpens recommendation quality beats a larger one that just adds surface area.
- **Aurelian and Discovery Decants are hosts/merchant experiences; Builder remains reusable software.** Nothing about either brand belongs in `packages/builder` or `packages/catalog` — see ADR-0004 and ADR-0007. If a change only makes sense for one brand, it belongs in that brand's host code, not in shared code with a conditional.

## 4. Mental model

```
                    imports                          imports
     Hosts  ───────────────────►   Builder core   ───────────────►   Catalog
 (Discovery Decants Vite app,     (Composer, Selection,          (fragrance + note data —
  Aurelian Next.js app)            Config, Persistence,           merchant- and
                                    Analytics/Finalization          host-agnostic)
                                    contracts)

 Each host owns: its own merchant config, its own environment
 detection, its own finalization adapter instantiation.

 Nothing imports back up this chain. Composer never imports
 merchant identity, even though it lives inside Builder core.
```

- Catalog ← Builder ← Hosts.
- Catalog never imports Builder.
- Builder never imports a host.
- Composer never imports merchant identity.
- Hosts own merchant config, environment detection, and finalization integration.
- No application backend or shared server tier currently exists (ADR-0001) — a per-host framework rendering a page server-side is not the same thing.

## 5. Engineering principles

| Principle | Grounded in |
|---|---|
| Prefer configuration over merchant-specific branching | ADR-0004 |
| Protect dependency direction | ADR-0005, ADR-0006, ADR-0007, ADR-0008 |
| Keep domain behavior separate from host concerns | ADR-0012, ADR-0019 |
| Do not add abstractions without demonstrated need | `docs/engineering-conventions.md` |
| Boundary tests are executable architecture | ADR-0008 |
| Shared code must remain host/environment neutral | ADR-0019 |
| Architecture decisions belong in ADRs | `docs/adr/README.md` |
| Enterprise-quality does not mean enterprise-complexity | `docs/engineering-conventions.md` (hand-rolled validation over a schema library; npm workspaces over a dedicated monorepo tool — deliberate, not accidental, simplicity) |

## 6. Before writing code

Ask, in order:

1. Is this **Domain**, **Application**, **Infrastructure**, or **Host integration**? (The ADR index tags every decision with one of these — find the nearest match before deciding where new code goes.)
2. Does an ADR already govern this? Check `docs/adr/README.md` before assuming it's undecided.
3. Is this shared behavior or merchant-specific behavior? If merchant-specific, it's a config change (ADR-0004), not a code change.
4. Does this change a business invariant? If so, it likely changes the domain model, not just an implementation detail — treat it with the weight of section 10 below, not as a routine edit.

## 7. Machine-enforced guardrails

| Test | Refuses |
|---|---|
| `packageBoundary.test.js` | Deep imports into `@discovery-box/builder/src/...` from a host; an unapproved top-level export; a second file carrying `"use client"` |
| `catalogPackageBoundary.test.js` | React, browser globals, merchant names, or commerce vocabulary (`pointValue`, `analytics`, `inventory`) inside `@discovery-box/catalog` |
| `hostEnvironmentBoundary.test.js` | `import.meta.env` / `process.env` anywhere in shared code except the one named exception (`AppErrorBoundary`) |
| `composerMerchantBoundary.test.js` | `merchantId`, `businessName`, or a brand name anywhere under `internal/composer` or `internal/composition` |
| `analyticsArchitecture.test.js` | Analytics calls inside Composer/scoring modules; payload keys not on the allowlist in `events.js` |

**When one of these fails, the first assumption should be that the code is in the wrong place — not that the test is obsolete.** These tests encode ADR-0006, ADR-0007, ADR-0008, and ADR-0019 directly; changing the test is changing the architecture, and that decision doesn't belong in a feature PR.

## 8. Common tasks

| "I need to..." | Goes in | Governed by |
|---|---|---|
| Add a fragrance | `packages/catalog/src/fragrances.js` | Keep the id in the right tier band, or flag it — nothing checks this automatically (§9) |
| Change a business rule (slot counts, points, curator bonus threshold) | The **merchant's `config.js`**, not shared code | ADR-0004 |
| Add a new merchant | New `config.js` + `catalog.js` + finalization adapter instantiation + mount `DiscoveryBoxBuilder` | ADR-0004, ADR-0005 |
| Change Composer scoring/strategy | `internal/composer/composerQualityDimensions.js` / `composerStrategyWeights.js` | ADR-0007 |
| Add a finalization channel other than WhatsApp | New adapter factory in `finalization/`; host chooses and instantiates it | ADR-0012 |
| Add an analytics event | `events.js` first (name + payload allowlist), then emit it | ADR-0013 |
| Add dev-only or environment-specific behavior | Host code, passed down as a prop | ADR-0019 |
| Add a feature to only one brand | That host's own files, not `packages/builder` | ADR-0004, ADR-0007 |
| Add accounts, cross-device sync, or anything needing a server | Not a PR — raise it first | ADR-0001, `docs/architecture-gaps.md` |

## 9. Automated boundaries cannot protect business intent

Two known gaps exist that no test currently catches. Neither is an architecture decision — both are unguarded implementation gaps, tracked outside the ADR log on purpose:

- **`finalization.requiredFields` exists in config and is validated for shape, but the runtime check is hardcoded to name + city.** Changing a merchant's `requiredFields` today has no actual effect on what finalization requires.
- **Tier is derived from a fragrance's id band, with no test checking that a fragrance's `points` value is consistent with the tier its id implies.** See `docs/backlog/tier-id-range-integrity.md`.

If you're working anywhere near either of these, verify the actual runtime behavior directly — don't trust the config surface to reflect it.

## 10. When to write an ADR

**Write one when:**
- A package or runtime boundary changes.
- Dependency direction changes.
- The persistence model changes.
- A shared integration strategy changes (e.g., a new finalization channel, a new analytics provider pattern).
- A new backend or runtime is introduced.
- A major domain abstraction or business capability is deliberately redefined.

**Do not write one for:**
- CSS/layout changes.
- Routine refactors.
- Helper naming.
- One-off implementation details.
- Accidental current-state absences (that's `docs/architecture-gaps.md` or a backlog note — see ADR-0018's and ADR-0009's retirement for the precedent).

## 11. Change checklist

Before opening a PR or committing:

- [ ] Relevant unit/integration tests pass.
- [ ] Boundary tests pass (§7) — don't skip these because "it's just a small change."
- [ ] Lint passes.
- [ ] Build passes.
- [ ] Merchant-specific behavior checked where applicable (does this behave correctly for both Discovery Decants and Aurelian, not just the one you tested against?).
- [ ] Update an ADR **only if a decision actually changed** — not for every touch of a file an ADR references.
- [ ] Update the Domain Model **only if the modeled business concepts changed** — not for implementation-only edits.

## 12. One habit that matters most

Before "cleaning up" something that looks odd — an injected adapter instead of a direct import, a config field that seems unused, two similar-looking validation functions that don't quite share code — **read the relevant ADR first.** Several things in this codebase that look like oversights are documented, deliberate trade-offs solving a problem that isn't visible from the diff alone.
