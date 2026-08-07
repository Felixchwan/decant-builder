# ADR-0001: No Application Backend or Shared Server Tier

**Status:** Accepted (retroactive)
**Related:** Parent of ADR-0002 (finalization channel) and ADR-0011 (local persistence) — both are decisions made *within* the constraint this ADR establishes; see those entries rather than re-deriving this reasoning. See ADR-0017 for the one place this ADR's scope must be read precisely against: Aurelian's Next.js app does render some routes server-side.
**Evidence:** no server framework, ORM, or database dependency in any `package.json`; no `fetch`/`axios` call in `src`, `packages/builder/src`, or `apps/aurelian/src`; persistence via `packages/builder/src/builder/internal/persistence/builderPersistence.js` targets `localStorage` only; both hosts deploy to Vercel with no separate application-server or database component (per `apps/aurelian/README.md`), each using its own framework's rendering pipeline rather than a shared backend.

## Context
Neither storefront depends on a shared application server, database, authentication provider, or payment processor — no such component exists anywhere in this system. This is a distinct claim from whether any *rendering* happens on a server: Aurelian's Next.js app does render some marketing routes server-side or statically as part of its own framework's request pipeline (ADR-0017), and Vercel may execute that rendering per request. That is a per-host, per-request templating capability of the hosting framework, not a shared backend the product's business logic runs on or calls into. The commerce logic itself — catalog data, box composition, the Composer optimizer, persistence, and order finalization — executes exclusively as client-side JavaScript, in the browser, on both hosts.

## Decision
No shared application backend, database, or business-logic API exists, and none is introduced by this decision. Each host may use its own framework's server-side rendering for markup (e.g., Aurelian's Next.js marketing pages) without that constituting a backend in the sense this ADR addresses — no business logic reads from or writes to a server process anywhere. All state lives in the browser (`localStorage`); all business behavior (validation, optimization, persistence, finalization) is implemented as pure JavaScript running on the customer's device, regardless of which host renders the surrounding page.

## Alternatives Considered
- **A thin API backend** (e.g., serverless functions for order capture) — would introduce infrastructure, deployment, and monitoring surface disproportionate to a single-operator, WhatsApp-fulfilled business.
- **A full commerce backend** (accounts, orders, payments) — the eventual SaaS-shape option; explicitly deferred rather than rejected, per the "Future Ideas" already on record.
- **Static site generation with no client interactivity** — rejected implicitly, since the Builder is inherently a stateful, interactive tool (selection, live scoring, persistence).

## Trade-offs
**Gains**
- Zero hosting cost beyond static/edge delivery; zero on-call burden; zero PCI/data-breach surface for anything beyond a browser's local storage.
- Deploys are trivial (static build artifacts); no server capacity planning exists because there is no server.

**Costs**
- No cross-device state, no order record, no revenue/fulfillment visibility except by reading WhatsApp threads by hand.
- Every future capability requiring shared state (accounts, saved boxes across devices, vendor dashboard, order management) requires building a backend from zero, not extending an existing one.

## Consequences
- All other ADRs in this log touching persistence or finalization inherit this constraint: none of them can assume a shared application server exists, regardless of whether the host they run in happens to render other pages server-side.
- The system's only source of durable business data today is a human reading WhatsApp — no other component of this architecture persists an order.

## Revisit Criteria
Revisit if any of the following is directly observed (not projected):
- Whoever handles WhatsApp fulfillment reports losing track of orders, missing messages, or falling behind — i.e., the manual process visibly strains, rather than a volume target being hit, since no such target is tracked anywhere in the system today.
- Cross-device or cross-session box recovery is raised as an actual, repeated customer request.
- Any roadmap item that depends on shared server state (vendor dashboard, accounts, SaaS mode) moves from idea to committed scope — at that point this ADR should be superseded, not amended, since it implies a new system rather than an extension.
