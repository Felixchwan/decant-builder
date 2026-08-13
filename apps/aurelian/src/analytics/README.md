# Aurelian Analytics Foundation

Mirrors Discovery Decants' own `src/analytics/` foundation (see ADR-0013).
Aurelian owns its own copy rather than importing the other host's, per the
established merchant-boundary discipline (ADR-0004/ADR-0007).

```js
analytics.track(eventName, payload)
```

Events and their per-event payload allowlists live centrally in the shared
`@discovery-box/builder/analytics` package (`events.js`). Payloads are
validated and guarded against personal fields here, before any provider
ever receives them.

## Status: no live provider configured

Live business analytics is intentionally paused -- the current priority for
this app is portfolio/engineering-learning value, not analytics rollout.
`BuilderExperience.jsx` always wires the console-only development logger
(`developmentAnalytics.js`) as the provider, which behaves as a no-op
unless a developer explicitly opts in locally via
`NEXT_PUBLIC_ANALYTICS_DEBUG=true` (see Debugging below). No pageview
tracking is wired either -- there is currently no component that calls a
vendor's script or global at all.

This is a deliberate end state, not an unfinished one: the validating
wrapper (`createAnalytics.js`) enforces the exact same event-name/payload
allowlist and prohibited-field rejection whether or not a real provider is
plugged in, so the privacy boundary this foundation exists to prove is
fully exercised today, with zero live vendor traffic. A real provider is a
deferred integration: adding one later means writing one adapter file that
implements `{ track(eventName, payload) }` and passing it as the
`provider` argument in `BuilderExperience.jsx` -- no change to
`createAnalytics.js`, the event contract, or any Builder call site.
Plausible was researched as a promising future candidate (see the
provider-decision investigation in project history) but no Plausible (or
any other vendor) code is wired into this app today.

## Privacy Rules

Never add customer name, city, notes, phone numbers, WhatsApp message
bodies, raw search text, URLs with user data, or raw error stacks to
analytics payloads. Search is represented only by derived metadata such as
query length and result count.

Perceptual Learning evidence (Observation freeText, Comparison freeText,
EncounterInstance identifiers, moments) must never reach analytics at all
-- not even in redacted form. No file under `perceptualLearning/`, and none
of the capture-flow/read-model components, import anything from this
directory. With pageview tracking currently deferred (see Status above),
Perceptual Learning routes generate zero analytics signal of any kind today.

## Debugging

Set `NEXT_PUBLIC_ANALYTICS_DEBUG=true` in local development to print
compact events through the console-only development provider. Debug
events are never persisted and no network requests are made.
