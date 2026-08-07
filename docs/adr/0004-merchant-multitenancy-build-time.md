# ADR-0004: Per-Merchant Configuration Selected at Build Time

**Status:** Accepted (retroactive)
**Related:** Parent of ADR-0003 (value representation), ADR-0010 (locale), and ADR-0016 (curator bonus) — each is a specific field within the config mechanism this ADR establishes. Read this one first; the others assume it.
**Evidence:** `src/merchants/discoveryDecants/config.js` and `apps/aurelian/src/merchant/config.js`, both built via `createBuilderConfig`; each is imported and mounted by its own host application at build time; git history shows the extraction work (`refactor: extract builder workspace package`, `refactor: extract shared catalog package`, `refactor: use active config in composer`) predating `apps/aurelian`'s introduction (`feat: establish Aurelian web foundation`) — direct evidence the multi-tenant shape was built ahead of, not in response to, the second brand.

## Context
The product now serves two distinct brands (Discovery Decants, Aurelian) with different names, themes, locales, and WhatsApp copy, sharing the same underlying Builder engine and (currently) the same catalog. Something has to represent "which business is this."

## Decision
A "merchant" is a config object — brand identity, commerce terms, box rules, theme, locale, finalization copy — produced by `createBuilderConfig()` and chosen by whichever host application imports it, at build time. There is no runtime concept of "the current tenant" that a server or a URL resolves; each deployed application is permanently one merchant.

## Alternatives Considered
- **Runtime tenant resolution** (e.g., a single deployed app resolving merchant identity from a subdomain or request header) — rejected; would require a server to do the resolving, which contradicts ADR-0001.
- **Fully separate codebases per brand** (no shared package) — rejected; the git history evidence above shows deliberate extraction work specifically to avoid this, before Aurelian was even built.
- **A single hardcoded brand with theme-only variation** — rejected; the config surface covers box rules and commerce terms, not just visual theme, which a theme-only approach couldn't express.

## Trade-offs
**Gains**
- Onboarding a brand-identical merchant is a bounded, proven task: one config file, one catalog-availability list, one finalization adapter instantiation (done twice already).
- `createBuilderConfig`'s validation (ADR-0009's successor conventions, see `docs/engineering-conventions.md`) catches merchant misconfiguration at build/startup time, not at runtime in front of a customer.

**Costs**
- "Multi-tenant" here means multiple hardcoded config files chosen at build time, not runtime-selected tenants with isolated data. There is no authentication, authorization, or per-tenant data isolation — a real prerequisite for a vendor-dashboard or SaaS-mode future.
- A third merchant with a genuinely different commercial shape (different finalization channel, different pricing model) is unsupported by the current config surface, not just unconfigured (see ADR-0002, ADR-0003).

## Consequences
- Any future "vendor dashboard" or self-service merchant onboarding is a new system built on top of this pattern, not a natural extension of it — the config *shape* is reusable, the *build-time, developer-authored* nature of it is not.
- The two live merchants currently share an identical catalog-availability list (`discoveryDecantsAvailableIds` vs. `aurelianAvailableIds`) — the mechanism for divergence is proven structurally but has not yet been exercised for a real difference in assortment.

## Revisit Criteria
Revisit if:
- A third merchant is requested that is not a developer-authored config — e.g., a partner wanting to self-serve their own storefront.
- Two merchants need to be resolved at runtime from a single deployment (e.g., one domain serving multiple tenants).
- A merchant requirement surfaces that needs data isolation beyond configuration — e.g., separate customer records or separate order histories per merchant.
