# ADR-0014: Catalog Assets Referenced by Abstract Key, Resolved by Host-Supplied Function

**Status:** Accepted (retroactive)
**Related:** A specific sub-decision within the boundary ADR-0006 establishes (catalog stays host-agnostic); this ADR is the concrete mechanism for images specifically.
**Evidence:** `packages/catalog/src/fragrances.js` records carry `imageAssetKey` (e.g., `"perfumes/bronze/batch-01/acqua-di-gio-edt.png"`), never a resolved URL (enforced by `catalogPackageBoundary.test.js`: `expect(perfume).not.toHaveProperty("image")`); `packages/catalog/src/createCatalogAssetResolver.js` maps a key to a host-relative URL under a configurable `basePath`; `packages/catalog/bin/catalog-sync-assets.js` is a Node CLI, run via each host's `predev`/`prebuild` npm script, that copies `packages/catalog/assets/` into that host's `public/catalog-assets/` (both directories gitignored, regenerated per build) with symlink, path-traversal, and case-collision protections.

## Context
Catalog data (ADR-0006) must stay host-and-hosting-agnostic, but images still need to end up somewhere a browser can load them, and today that "somewhere" differs between a Vite-built SPA and a Next.js app.

## Decision
Fragrance and note records carry an abstract asset key, not a URL. Each host application supplies an `assetResolver` function (`imageAssetKey → URL`) to `DiscoveryBoxBuilder`, and separately runs a build-time sync script that physically copies the shared `assets/` directory into that host's own static-file location before the app builds.

## Alternatives Considered
- **Store resolved URLs directly on fragrance records** — rejected; would hardcode a specific hosting path into shared data, breaking the moment a second host with a different static-asset convention (Vite's `public/` vs. Next's `public/`, potentially a future CDN) needs the same data.
- **A real CDN/object-storage integration today** — not implemented; the current mechanism is a local file copy with real security precautions (symlink rejection, traversal checks, case-collision detection), appropriate for exactly two known, local build targets.
- **Each host maintains its own copy of the asset files** — rejected; would risk the two hosts' images drifting out of sync with the shared catalog data referencing them.

## Trade-offs
**Gains**
- Catalog data never needs to change when hosting infrastructure changes — only the `assetResolver` implementation does.
- The sync script's safety checks (no symlinks, no path traversal, no case-insensitive collisions) make the file-copy approach robust despite its simplicity.

**Costs**
- The sync mechanism doesn't scale cleanly to N independently-deployed third-party hosts, each needing their own wiring for the sync step — appropriate today (two known hosts), not indefinitely.

## Consequences
- This is a clean example of an abstraction earning its cost: the resolver-function indirection looks unnecessary for exactly two hosts, but it's precisely what makes a future CDN migration a contained change instead of a data migration.

## Revisit Criteria
Revisit if:
- A third host — especially one outside this team's direct control — needs these assets; the local-copy sync mechanism should be replaced with a CDN/object-storage-backed resolver at that point, without needing to touch catalog data.
- Anyone on the team directly observes build time or repository size becoming a real friction point attributable to the asset-sync step, rather than this being anticipated in the abstract.
