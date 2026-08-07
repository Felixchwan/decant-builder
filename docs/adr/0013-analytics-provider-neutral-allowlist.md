# ADR-0013: Analytics as a Provider-Neutral Contract with an Explicit Payload Allowlist

**Status:** Accepted (retroactive)
**Related:** none directly parent/child; touches ADR-0007 indirectly (`analyticsArchitecture.test.js` keeps analytics out of Composer Core, alongside the merchant-boundary rule ADR-0007 describes).
**Evidence:** `packages/builder/src/analytics/events.js` (`ANALYTICS_EVENTS`, `EVENT_PAYLOAD_KEYS` per-event allowlist, `PROHIBITED_ANALYTICS_KEYS`); `src/analytics/createAnalytics.js` (`isValidAnalyticsEvent`, `containsProhibitedAnalyticsKey`, rejects unknown events/keys rather than passing them through); `noopAnalytics` as the default provider.

## Context
The product wants usage analytics (funnel steps, Composer usage, errors) without risking customer PII (name, city, WhatsApp message bodies, raw search text) reaching a third-party analytics vendor, and without hardcoding which vendor that is.

## Decision
Define a fixed, closed list of event names and, per event, a fixed allowlist of payload keys. `track(eventName, payload)` validates against both lists and against a separate prohibited-key list (covering PII-shaped fields like `name`, `phone`, `whatsappMessage`, `searchQuery`, `errorStack`) before forwarding anything to a pluggable `provider.track()`. No provider is wired by default (`noopAnalytics`); a real vendor integration is left to whoever composes the host app.

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

## Observed Gap (not a consequence of this decision)
Aurelian's `BuilderExperience.jsx` currently passes `analytics={noopAnalytics}` unconditionally, unlike Discovery Decants, which wires `createAnalytics` with a dev-only debug provider. This means Aurelian has **no usage visibility at all** today. This is an integration gap in how the two hosts happen to be wired, not a consequence of the provider-neutral contract itself — the contract would support a real Aurelian provider exactly as easily as it supports Discovery Decants' dev provider. Flagged here for visibility, not treated as a trade-off of this ADR's decision.

## Revisit Criteria
Revisit if:
- Aurelian is given real usage analytics, closing the gap noted above — at that point this note should be removed and the observed-gap section retired.
- A new feature needs an analytics event whose natural payload doesn't fit the existing allowlist pattern — that's a signal to reconsider the field before adding it, not to bypass the allowlist.
