# ADR-0017: Two Separate Frontend Frameworks/Hosts, One per Brand

**Status:** Accepted (retroactive)
**Related:** Builds on ADR-0005 (the package split that makes this possible without duplicating logic) and ADR-0019 (the environment-detection-ownership rule this decision was proven against, since it's what let the shared package work correctly under two different bundlers).
**Evidence:** root app (`src/`, `vite.config.js`) is React 19 + Vite 8, a client-only SPA with no server-rendered routes; `apps/aurelian` is Next.js 15 (App Router), with server-rendered/static marketing routes (`/`, `/catalogo`, `/como-funciona`, `/contacto`) and a client-only (`ssr:false`) Builder mount at `/build-your-box`; both consume the same `@discovery-box/builder` and `@discovery-box/catalog` packages.

## Context
Discovery Decants is the original product: a builder-only single-page app with no separate marketing site. Aurelian needed a proper marketing presence (homepage, "how it works," contact) in addition to the builder — a materially different page-composition need.

## Decision
Keep Discovery Decants as a pure Vite SPA (the Builder *is* the whole app), and build Aurelian as a Next.js application where the Builder is one client-only route among several server-rendered marketing pages, rather than migrating Discovery Decants to Next.js or building Aurelian's marketing pages as another Vite SPA bolted alongside the builder.

## Alternatives Considered
- **Migrate everything to Next.js** — rejected (or at least not yet done); would require rebuilding Discovery Decants' hosting/build pipeline for no functional gain, since it has no marketing-page needs today.
- **Build Aurelian's marketing pages as static Vite pages alongside its builder route** — rejected; Next.js's App Router (SSR/SSG per route, `robots.js`/`sitemap.js` conventions already present) is a better fit for a real marketing site with SEO needs than a client-only SPA would be.
- **Duplicate the Aurelian marketing site as a wholly separate project** outside the monorepo — rejected; would forfeit the shared-package benefits (ADR-0005) that make Aurelian's builder route trivial to keep in sync with Discovery Decants.

## Trade-offs
**Gains**
- Each host uses the framework suited to its actual page-composition need (SPA for a builder-only tool, SSR/SSG hybrid for a marketing site) instead of forcing one framework choice onto both.
- The shared packages are proven framework-agnostic by this very fact — the same `@discovery-box/builder` renders correctly inside a plain Vite SPA and inside a Next.js `"use client"` boundary with `next/dynamic({ssr:false})`.

**Costs**
- Two different build systems, two different dev-mode idioms (`import.meta.env.DEV` vs. `process.env.NODE_ENV`, per ADR-0019), and two different deployment configurations to maintain.
- A third host with yet another framework need would add a third build system to reason about, though the shared-package boundary (ADR-0006, ADR-0007, ADR-0008) means the *domain logic* wouldn't need to change.

## Consequences
- This is direct, working proof that the shared packages' environment-neutrality (ADR-0019) isn't theoretical — it's already been exercised across two genuinely different rendering environments.

## Revisit Criteria
Revisit if:
- Discovery Decants is asked to grow marketing pages of its own — at that point, either add them within Vite (if simple) or reconsider aligning it with Aurelian's Next.js structure (if SEO/SSR needs grow to match).
- Someone maintaining both hosts directly reports that a fix applied to one host's environment-detection or build configuration was missed or forgotten in the other — the concrete symptom of duplicated-effort cost becoming real rather than theoretical.
