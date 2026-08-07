# ADR-0005: Monorepo Split into Independent Builder and Catalog Packages

**Status:** Accepted (retroactive)
**Related:** Parent of ADR-0006, ADR-0007, and ADR-0008 — this ADR establishes *that* the codebase is split into independently-boundaried packages; those cover what each boundary specifically protects and how.
**Evidence:** `package.json` `workspaces: ["packages/*", "apps/*"]`; `packages/builder/package.json` (`@discovery-box/builder`) and `packages/catalog/package.json` (`@discovery-box/catalog`) as separate, independently versioned workspace packages; git history shows this split (`refactor: extract builder workspace package`, `refactor: extract shared catalog package`) predates the second host application (`apps/aurelian`).

## Context
Originally (per the now-superseded `README.md`) this was a single-package Vite app with `src/components`, `src/data`, `src/utils`. It is now a monorepo with two independently-exported libraries consumed by two separate host applications.

## Decision
Split the codebase into `@discovery-box/catalog` (pure fragrance/note/brand data and data-shaping functions) and `@discovery-box/builder` (the box-building UI, Composer, and business logic), each with its own `package.json`, its own explicit `exports` map, and its own boundary test asserting what it may and may not contain. Host applications (`src/`, `apps/aurelian/src`) consume both only through their public subpaths. Workspace linking is done via native npm workspaces, not a dedicated monorepo tool (pnpm workspaces, Turborepo, Nx).

## Alternatives Considered
- **Single package, shared via relative imports** — the prior, documented state (the stale `README.md`'s "Project Structure" section describes exactly this flat layout); rejected once a second host (Aurelian) needed to consume the same logic without depending on the first host's internal file layout.
- **Publish to a private npm registry** — rejected (or at least not yet done); packages are `"private": true` and consumed via npm workspace linking, which is simpler for a single-repository, single-team setup.
- **Duplicate the builder logic into `apps/aurelian`** — rejected; would have immediately diverged the two brands' business logic, defeating the purpose of one shared engine.
- **A dedicated monorepo tool** (pnpm workspaces, Turborepo, Nx) for build orchestration/caching — not adopted; native npm workspaces plus per-package `vite build` scripts were sufficient for two packages and two apps, at the cost of no shared build-caching or task-graph orchestration.

## Trade-offs
**Gains**
- A second host application was addable without forking business logic — proven, not hypothetical.
- Each package's `exports` map is a real, enforced contract (see ADR-0008), not just a folder convention.

**Costs**
- Two more `package.json` files, two more build configs (`packages/builder/vite.config.js`), and a `predev`/`prebuild` asset-sync step (see ADR-0014) that every host must remember to wire in.
- Workspace-internal changes to `@discovery-box/builder` require a package build step (`dist/`) before host apps pick them up in production mode, adding a build-order dependency that a single-package app wouldn't have.
- No shared build cache or task graph across packages — each package/app builds independently, which is simple but doesn't scale build times as gracefully as a dedicated monorepo tool would.

## Consequences
- This split is the structural precondition for ADR-0004 (merchant multi-tenancy) and ADR-0006/0007 (agnostic packages) — none of those would be enforceable without independently boundaried packages to enforce them on.
- Any third host application follows the same pattern for free.

## Revisit Criteria
Revisit if:
- The packages need to be consumed outside this monorepo (e.g., licensed to an external partner) — at that point, private workspace linking stops being sufficient and real publishing (private registry or public npm) becomes necessary.
- Build or CI times, or the number of packages/apps, grow to a point where the team notices repeated, avoidable rebuild work — the specific signal to watch for is engineers observing and reporting that builds are redundant or slow, not a predefined package count.
