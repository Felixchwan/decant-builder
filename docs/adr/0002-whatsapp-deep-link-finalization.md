# ADR-0002: WhatsApp Deep Link as the Sole Order-Finalization Channel

**Status:** Accepted (retroactive)
**Related:** Depends on ADR-0001 (no backend exists to run a payment/checkout flow instead). Coupled to ADR-0012, which covers *how* this channel is wired into the shared Builder package (an inversion-of-control pattern) — this ADR covers *which* channel was chosen, a separate, business-facing question.
**Evidence:** `packages/builder/src/finalization/createWhatsAppFinalizationAdapter.js` — builds `https://wa.me/{phoneNumber}?text={encoded message}`, opens it via `window.open`, and copies the message to the clipboard as a fallback; both merchant configs set `finalization.mode: "whatsapp"`.

## Context
Given no payment processor or order-management system exists (ADR-0001), the product still needs a way to hand a completed box off to the business. The implemented mechanism opens the customer's own WhatsApp client with a pre-filled message describing the box, and separately copies that same message to the clipboard in case the deep link is blocked (e.g., by a popup blocker or an environment without WhatsApp installed).

## Decision
Finalization is implemented as a `finalize(model) → { status, copied, manualUrl }` contract, with exactly one implementation: a `wa.me` deep link plus clipboard-copy fallback. No server-side order is created; the "order" is the message itself, sent by the customer through their own WhatsApp account to the business's number.

## Alternatives Considered
- **A real checkout/payment flow** (Stripe, etc.) — rejected for now; no payment library or checkout UI exists anywhere in the codebase.
- **A WhatsApp Business API integration** (server-mediated messaging) — rejected; the implementation is a client-only deep link, not an API call, which requires no server credentials or webhook handling.
- **Email or a generic contact form** — not implemented; WhatsApp is the sole channel in both merchant configs, consistent with a WhatsApp-native sales motion in the target market (both merchants are Mexico-based, per `commerce.currency: "MXN"` and the `+52` phone prefix).

## Trade-offs
**Gains**
- Zero integration cost, no messaging API credentials, no server dependency.
- Matches an existing, trusted customer behavior (chatting with a business on WhatsApp) rather than asking for a new one.
- The clipboard fallback keeps the flow usable even when the deep link is blocked.

**Costs**
- No structured order record survives past the message itself — nothing in this system tracks whether a WhatsApp order was ever actually sent, received, or fulfilled.
- Fulfillment, payment collection, and inventory decrement are entirely manual and off-system.
- The contract (`finalize`) is designed for exactly one channel in practice; `finalization.mode` is validated as effectively always `"whatsapp"` today (`validateBuilderConfig` only checks the WhatsApp-specific field), so a second channel is unproven, not just unbuilt.

## Consequences
- Every "order management" or "purchase export" future idea requires introducing a durable order record that does not exist today — this ADR is why that gap exists.
- The finalization adapter is host-injected (ADR-0012), which keeps this specific channel choice from leaking into shared Builder code — a second channel could be added without touching the Composer or persistence layers.

## Revisit Criteria
Revisit if:
- A merchant needs a fulfillment channel other than WhatsApp (e.g., a partner requiring real checkout) — observable directly as a stated merchant requirement, not a projection.
- The business asks for any reporting on order volume, conversion, or revenue — none of which is derivable from this system as built, and the request itself is the signal.
