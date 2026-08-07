# ADR-0012: Finalization Channel Injected by Host, Not Imported by Shared Package

**Status:** Accepted (retroactive)
**Related:** Coupled to ADR-0002 (WhatsApp is the channel this pattern currently wires); this ADR covers the software design pattern (inversion of control), ADR-0002 covers the business decision of which channel. Read together, but kept separate since either could change independently — the pattern could stay even if the channel changed, and vice versa.
**Evidence:** `packages/builder/src/BuilderRuntime.jsx` receives `finalizationAdapter` as a prop and only ever calls `finalizationAdapter.finalize(...)`; both `src/app/DiscoveryDecantsApp.jsx` and `apps/aurelian/src/components/BuilderExperience.jsx` import `createWhatsAppFinalizationAdapter` from `@discovery-box/builder/finalization` themselves and construct the instance before rendering `DiscoveryBoxBuilder`; `packageBoundary.test.js` explicitly asserts `finalization/createWhatsAppFinalizationAdapter.js` does not exist anywhere under host `src/`.

## Context
Finalization (ADR-0002) needs a phone number and message copy that are merchant-specific. The shared Builder runtime needs to trigger finalization without hardcoding which merchant, or which channel, it's talking to.

## Decision
`@discovery-box/builder/finalization` exports a factory (`createWhatsAppFinalizationAdapter`); each host imports that factory, supplies its own `phoneNumber`, and passes the resulting adapter instance into `DiscoveryBoxBuilder` as a prop. The shared runtime (`BuilderRuntime`) depends only on the `finalize(model)` shape, never on the concrete WhatsApp implementation.

## Alternatives Considered
- **Import the adapter directly inside `BuilderRuntime`, read the phone number from config** — rejected; would make the shared runtime depend on a specific channel implementation, foreclosing a future second finalization mode without touching shared code.
- **A finalization "mode" switch inside the Builder package itself** (`if (config.finalization.mode === "whatsapp") ...`) — not implemented; the current inversion-of-control (host supplies a ready-made adapter) achieves the same flexibility without the Builder package needing to know about every possible channel.

## Trade-offs
**Gains**
- Adding a second finalization channel (e.g., email, a future checkout API) requires a new factory function and a host choosing which one to instantiate — no change to `BuilderRuntime` itself.
- The dependency direction stays clean: hosts depend on the Builder package's public contract, never the reverse.

**Costs**
- Each host is individually responsible for correctly instantiating and injecting the adapter; nothing currently enforces that a host actually provides one, beyond `DiscoveryBoxBuilder`'s prop being used when finalization runs.
- This pattern (factory exported, instance injected) is the *only* inversion-of-control seam in an otherwise directly-imported package — worth documenting precisely so it isn't "rediscovered" as an inconsistency later.

## Consequences
- This is the specific mechanism that makes ADR-0002 (WhatsApp-only today) cheap to extend later — the extension point already exists and is proven by two working instantiations (Discovery Decants, Aurelian), even though both currently use the same channel.

## Revisit Criteria
Revisit if:
- A second finalization channel is actually requested — at that point, add `createXAdapter` alongside the existing WhatsApp one, following this same pattern, rather than restructuring it.
- A host is observed to have failed to wire a finalization adapter correctly and the failure wasn't caught until runtime — at that point, add validation that a finalization adapter is present when finalization is enabled.
