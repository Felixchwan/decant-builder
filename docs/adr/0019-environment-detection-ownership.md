# ADR-0019: Environment Detection Ownership Stays with the Host, Not Shared Code

**Status:** Accepted (retroactive)
**Related:** An instance of the enforcement mechanism ADR-0008 describes. Proven in practice by ADR-0017 (the two hosts this rule was validated against).
**Evidence:** `packages/builder/src/builder/hostEnvironmentBoundary.test.js` asserts three things: (1) the shared Builder-owned production surface (`BuilderRuntime.jsx` plus the `builder`, `components`, `utils`, `i18n`, `analytics` directories, explicitly excluding `AppErrorBoundary.jsx`) never matches `import\.meta(\.env)?|process\.env|VITE_|NODE_ENV`; (2) `src/app/DiscoveryDecantsApp.jsx` contains `isDevelopment={import.meta.env.DEV}`, `apps/aurelian/src/app/build-your-box/page.jsx` contains `process.env.NODE_ENV === "development"`, and `apps/aurelian/src/components/BuilderExperience.jsx` contains neither; (3) neither merchant config file (`discoveryDecants/config.js`, `aurelian/merchant/config.js`) references `isDevelopment`, `import.meta`, `process.env`, `VITE_`, or `NODE_ENV`.

## Context
Shared Builder code runs inside two different bundlers with mutually exclusive environment-variable idioms: Vite exposes `import.meta.env`, Next.js exposes `process.env` (differently on server vs. client). Code written against one idiom breaks or silently misbehaves under the other.

## Decision
The shared Builder package and all shared/common code never read environment variables or bundler-specific globals directly. Each host reads its own environment using its own idiom and passes the result down as a plain boolean prop (`isDevelopment`) into `DiscoveryBoxBuilder`. One narrow, explicitly named exception exists: `AppErrorBoundary.jsx`, which the test's own inline comment marks as "deliberately host-owned," retaining a direct Vite `DEV` diagnostic despite living in shared-looking directory structure.

## Alternatives Considered
- **A shared `isDev()` utility inside the Builder package that internally branches on bundler** — rejected; would require the shared package to know about every possible host bundler in advance, defeating the purpose of a host-agnostic core.
- **A runtime-injected global** (e.g., `window.__ENV__`) set by each host before mounting — not implemented; would require a bespoke setup step per host that prop injection already avoids.
- **Leave the idiom unenforced, trust each host to use the right one** — rejected; this is exactly what the boundary test exists to prevent, since a stray `import.meta.env` reference inside shared code fails unpredictably once bundled by a non-Vite tool.

## Trade-offs
**Gains**
- The shared Builder package can be handed to a future host on a different bundler entirely without auditing it for environment-detection landmines.
- The one exception (`AppErrorBoundary`) is named and tested, not an unexamined special case discovered by accident.

**Costs**
- Every host must compute and pass `isDevelopment` itself; there is no shared helper doing this consistently, so each host's own environment-detection code is duplicated per host rather than centralized.

## Consequences
- This is what let ADR-0017's two-framework decision work without the shared package needing any change when the second host was added — evidence this held under real, not hypothetical, stress.

## Revisit Criteria
Revisit if:
- A third host is added with yet another environment-detection idiom and the duplication is observed to cause a real inconsistency (e.g., a host shipping without `isDevelopment` wired correctly) — at that point, consider formalizing a documented prop contract, not shared code that reads environment itself.
- The single named exception (`AppErrorBoundary`) is asked to do more than a dev-flag diagnostic — its host-owned status should be re-examined deliberately at that point, not expanded silently.
