# ADR-0011: Persistence Is Local-Only, Schema-Versioned, Unsynced

**Status:** Accepted (retroactive)
**Related:** Depends on ADR-0001 (no backend exists to sync to). See `docs/architecture-gaps.md` for why "no customer identity" is documented as a gap rather than a related ADR — cross-device sync would require identity, which this decision does not establish or preclude on its own.
**Evidence:** `packages/builder/src/builder/internal/persistence/builderPersistence.js` — reads/writes `localStorage` keyed by `config.persistence.storageKey` (`decant-builder-v1` for Discovery Decants, `aurelian-builder-v1` for Aurelian), versioned by `config.persistence.schemaVersion`, with full validation on read (`validatePersistedBuilderState`) that discards and clears any state that doesn't match the current schema version or references catalog IDs no longer available.

## Context
A customer building a box across multiple visits (or an accidental page reload) shouldn't lose their selection. Given no backend (ADR-0001), the only available storage is the browser itself.

## Decision
Persist the full box-building state — selected fragrance IDs, curator bonus preference, customer info — to `localStorage`, under a per-merchant key, tagged with a schema version. On load, validate the stored payload against the current catalog and config; if it fails validation (wrong version, unknown IDs, malformed shape), silently discard it and start fresh rather than surface an error.

## Alternatives Considered
- **`sessionStorage`** — rejected; would lose state on tab close, which defeats the purpose of persistence for a considered, multi-visit purchase decision like a fragrance box.
- **A cookie-based approach** — rejected; smaller storage limits and unnecessary network-header overhead for data that's purely client-consumed.
- **Cloud sync** — the natural evolution once accounts exist, not implemented; would require a backend and a customer identity, neither of which exists yet (see `docs/architecture-gaps.md`).

## Trade-offs
**Gains**
- Zero infrastructure; works offline; no account needed; strong default privacy posture (nothing leaves the device until finalization).
- Schema versioning plus full re-validation on load means a stale or corrupted stored payload degrades gracefully (silently reset) rather than crashing the app — confirmed by the dedicated recovery UI (`AppErrorBoundary`, `recovery.title`/`clearSavedLabel` copy in the config).

**Costs**
- State is invisible across devices, browsers, or after cache/storage is cleared — "saved boxes" only means "saved in this one browser."
- There is no customer identity anywhere in the system to eventually attach cloud-synced state to; adding cross-device persistence later means building an identity system first, not just swapping the storage backend.

## Consequences
- This is the concrete implementation behind the "saved boxes" Future Idea already being half-true today, in a browser-scoped way — worth stating precisely so the roadmap doesn't overestimate how close "real" saved boxes are.
- The schema-version + full-revalidation pattern here is a reusable template if/when a second kind of persisted state (e.g., a customer profile) is introduced.

## Revisit Criteria
Revisit if:
- Cross-device or cross-session box recovery is raised as an actual, repeated customer request (the same observable trigger as ADR-0001's revisit criteria, specific here to persistence rather than infrastructure generally).
- A customer identity concept is introduced for any other reason — at that point, migrating persistence to sync through that identity becomes a contained, low-cost change rather than a redesign.
