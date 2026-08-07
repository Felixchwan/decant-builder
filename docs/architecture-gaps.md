# Architecture Gaps (Outside the ADR Log)

`docs/adr/` documents decisions with evidence of deliberate weighing among real alternatives. This document is different: it tracks capabilities the system **lacks**, where investigation found no evidence the absence was itself a considered decision — as opposed to something that simply never came up, as a natural side effect of decisions made for other reasons.

Per the governance review that produced this document: an absent capability doesn't automatically earn an ADR just because the capability is missing. It earns one only if the implementation or history shows the absence was actually decided. Where that evidence doesn't exist, it belongs here instead.

## No customer / user identity model

**What was checked:**
- Persistence keying (`docs/adr/0011-local-only-persistence.md`) — scoped by **merchant** (`decant-builder-v1`, `aurelian-builder-v1`), not by customer. Every visitor to a given merchant's site on a given browser shares the same storage key; nothing distinguishes one visitor from another.
- Analytics flow IDs (`src/analytics/createAnalytics.js`, `createAnalyticsFlowId()`) — generates a `flow_${randomUUID}` value, but it's a fresh default parameter evaluated wherever `createAnalytics()` is called (effectively per app mount), never persisted or read back on a later visit. It cannot function as a returning-visitor identifier even incidentally.
- Customer info collection (`customerInfo: { name, city, notes }`) — collected only transiently, at the finalization step, purely to compose the WhatsApp message body. It is never used as a lookup key, never hashed or stored independently of that one box's persisted state, and is discarded the moment `localStorage` for that box is cleared.
- No cookie, device fingerprint, or "returning visitor" detection of any kind was found anywhere in `src/`, `packages/builder/src`, or `apps/aurelian/src`.
- No comment, test, or config field anywhere frames "no identity" as a considered-and-rejected question.

**Conclusion:** the absence is total and uniform, and consistent with a system that never needed to distinguish visitors because nothing downstream of that distinction exists yet (no accounts, no cross-device sync, no CRM) — a natural consequence of `docs/adr/0001-fully-client-side-architecture.md` and `docs/adr/0011-local-only-persistence.md`. But consequence is not the same as decision: nothing in the evidence indicates identity was itself weighed as its own question (e.g., "should we assign an anonymous local identity even without accounts?") and rejected. It looks like it simply never arose. Per the constraint on this review, that means it is documented here as a gap, not written up as an affirmative "local-first anonymous identity" ADR — doing so would fabricate a deliberateness the evidence doesn't support.

**Why it matters:** every future capability requiring "the same person, recognized again" — saved boxes across devices, a vendor/CRM dashboard, personalized recommendations informed by past orders, even basic fraud/abuse prevention on a future checkout — is blocked equally by this gap, regardless of which specific feature is requested first.

**What would need to be decided (not yet decided, not this document's job to decide):**
- Whether identity should be anonymous/local-first (e.g., a persisted device or browser UUID, no account required) or account-based (email/magic-link, requiring a backend) or deferred until a backend exists for other reasons.
- Whether identity is something the shared Builder package should ever model, or purely a future host/backend-layer concern layered on top of it — consistent with how ADR-0004 keeps merchant identity itself external to Composer Core (`docs/adr/0007-composer-core-merchant-agnostic.md`).

**When to revisit:** the same observable triggers as `docs/adr/0001` and `docs/adr/0011` — a real, repeated request for cross-device box recovery, or any roadmap item (accounts, vendor dashboard) moving from idea to committed scope. At that point, this gap should be resolved with an actual ADR reflecting the identity model chosen, not retroactively back-filled as though it had already been decided.
