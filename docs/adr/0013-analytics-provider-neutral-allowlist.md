# ADR-0013: Analytics as a Provider-Neutral Contract with an Explicit Payload Allowlist

**Status:** Accepted (retroactive)
**Related:** none directly parent/child; touches ADR-0007 indirectly (`analyticsArchitecture.test.js` keeps analytics out of Composer Core, alongside the merchant-boundary rule ADR-0007 describes).
**Evidence:** `packages/builder/src/analytics/events.js` (`ANALYTICS_EVENTS`, `EVENT_PAYLOAD_KEYS` per-event allowlist, `PROHIBITED_ANALYTICS_KEYS`, `COMMON_CONTEXT_KEYS`) and `packages/builder/src/analytics/noopAnalytics.js` — both shared, package-owned. The validating wrapper itself (`isValidAnalyticsEvent`, `containsProhibitedAnalyticsKey`, `createAnalytics`) is **host-owned, not shared** — Discovery Decants' own copy lives at `src/analytics/createAnalytics.js` (repo-root `src/`, a sibling app directory, not `packages/builder/`), and Aurelian's equivalent copy lives at `apps/aurelian/src/analytics/createAnalytics.js`. This corrects an earlier, imprecise version of this line that cited the root-level path as if it were shared; see "Ownership Boundary" below.

## Context
The product wants usage analytics (funnel steps, Composer usage, errors) without risking customer PII (name, city, WhatsApp message bodies, raw search text) reaching a third-party analytics vendor, and without hardcoding which vendor that is.

## Decision
Define a fixed, closed list of event names and, per event, a fixed allowlist of payload keys. `track(eventName, payload)` validates against both lists and against a separate prohibited-key list (covering PII-shaped fields like `name`, `phone`, `whatsappMessage`, `searchQuery`, `errorStack`) before forwarding anything to a pluggable `provider.track()`. No provider is wired by default (`noopAnalytics`); a real vendor integration is left to whoever composes the host app.

### Ownership Boundary
The shared `@discovery-box/builder` package owns only the vocabulary and the safe default: the event names, the per-event payload allowlist, the prohibited-key list, the common-context allowlist, and `noopAnalytics`. It does **not** own a validating wrapper implementation. Each host is expected to own its own validating `createAnalytics({ provider, commonContext })` wrapper — built against the shared vocabulary above — and its own provider adapter(s). Discovery Decants and Aurelian each implement an equivalent, independently-owned wrapper this way (deliberately duplicated rather than cross-imported, consistent with ADR-0004/ADR-0007's merchant-boundary discipline: one host's `src/` is never imported by another host). Provider-specific code (e.g. a vendor SDK call) must stay entirely inside a host's own adapter file — never inside the shared package, and never spread across host components.

## Alternatives Considered
- **Pass events through unvalidated to whatever provider is configured** — rejected; would put the privacy guarantee entirely on provider-side configuration/discipline rather than enforcing it in code before the payload ever leaves this system.
- **A generic `track(name, anyPayload)` with no allowlist** — rejected; the allowlist is what makes "never send raw search text" an enforced invariant rather than a written guideline (see `src/analytics/README.md`'s privacy rules, which this validator implements in code).
- **Bake in a specific vendor SDK** — rejected; the contract is vendor-neutral by design (`{ track(eventName, payload) }`), so swapping or adding a provider doesn't touch event-emission call sites anywhere in the Builder.

## Trade-offs
**Gains**
- A privacy violation (accidentally including a customer's name in an event payload) is rejected in code, not caught later in a data audit.
- Swapping analytics vendors, or running none at all, requires zero changes to instrumentation call sites.

**Costs**
- Every new analytics event or payload field requires updating `EVENT_PAYLOAD_KEYS` centrally — a small but real friction cost that is the deliberate trade for the allowlist guarantee.

## Consequences
- Any future real analytics provider (e.g., a production vendor SDK) can be added purely at the host composition layer (`createAnalytics({ provider })`), with the privacy guarantees this ADR describes staying intact automatically.

## Observed Gap — Retired
Aurelian previously passed `analytics={noopAnalytics}` unconditionally, with no validating wrapper of its own, unlike Discovery Decants. The wrapper gap is closed: Aurelian now owns its own validating wrapper (`apps/aurelian/src/analytics/createAnalytics.js`, mirroring Discovery Decants' pattern per the Ownership Boundary above), and `BuilderExperience.jsx` injects it into the Builder on every render — so the allowlist/prohibited-field enforcement this ADR describes now runs on every Aurelian analytics call, not just Discovery Decants'.

No live vendor provider is wired for either host today. Aurelian's composition point currently always selects a console-only development logger (disabled by default, opt-in via `NEXT_PUBLIC_ANALYTICS_DEBUG`) — functionally equivalent to `noopAnalytics` unless a developer explicitly turns it on locally. This is a deliberate, current-priority decision (portfolio/engineering-learning focus over live business analytics), not an unfinished integration: see `apps/aurelian/src/analytics/README.md`. A real vendor was researched (Plausible, as a promising candidate) but deferred; wiring one in later requires only a new adapter file passed as `provider` at the existing composition point, per the Ownership Boundary above — no change to the vocabulary, the wrapper, or any Builder call site.

## Revisit Criteria
Revisit if:
- A new feature needs an analytics event whose natural payload doesn't fit the existing allowlist pattern — that's a signal to reconsider the field before adding it, not to bypass the allowlist.
- A host's validating wrapper meaningfully diverges from the shared vocabulary's intent (e.g. starts allowing an unvalidated passthrough) — that would need its own review, since the allowlist guarantee depends on every host's wrapper enforcing it.
- A real analytics provider is wired in for either host — at that point the "no live vendor" note above should be updated to reflect the new default.
