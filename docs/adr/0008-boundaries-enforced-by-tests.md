# ADR-0008: Architectural Boundaries Enforced by Automated Tests

**Status:** Accepted (retroactive)
**Related:** This is the enforcement *mechanism* that ADR-0006 (catalog purity), ADR-0007 (Composer purity), and ADR-0019 (environment-detection ownership) each rely on — those three ADRs describe *what* is protected; this one describes *how*. A fourth instance, analytics isolation from Composer/scoring modules, is enforced by `analyticsArchitecture.test.js` but does not have its own ADR — see that test directly, and ADR-0013, for the analytics contract it partially protects.
**Evidence:** `packages/builder/tests/boundaries/packageBoundary.test.js`, `packages/catalog/src/catalogPackageBoundary.test.js`, `packages/builder/src/builder/hostEnvironmentBoundary.test.js`, `packages/builder/src/builder/composerMerchantBoundary.test.js`, `src/analytics/analyticsArchitecture.test.js` — all read real source files at test time (via `readFileSync`/`readdirSync`) and assert regex/structural properties about them, rather than relying on lint rules or code review.

## Context
Every other ADR in this log describing a boundary (catalog agnosticism, Composer isolation, host/package separation, environment neutrality) needs some mechanism that actually stops a future change from violating it. This project chose tests over convention.

## Decision
For every architectural rule the team considers load-bearing, write a Vitest test that reads the actual source tree, greps for forbidden patterns (merchant names, environment globals, deep internal imports) or asserts exact export shapes, and fails the test suite — and therefore CI — if violated. These tests are explicitly about structure, not behavior.

## Alternatives Considered
- **ESLint custom rules** — would run faster and integrate with editor tooling, but wasn't chosen; regex-over-source-text in Vitest was simpler to write for one-off structural assertions like "no file under this directory contains this string."
- **Code review discipline alone** — rejected; the existence of five dedicated boundary test files indicates the team judged review-only enforcement insufficient for rules this easy to accidentally violate (e.g., one convenient import).
- **Dependency-cruiser or a similar architecture-linting tool** — not adopted; would be a more standard, more powerful tool for exactly this purpose, but introduces a new dependency and configuration language instead of reusing the existing test runner.

## Trade-offs
**Gains**
- A violation fails the build immediately and specifically (e.g., "Composer references Aurelian"), not months later in a design review.
- These tests are, today, the single most accurate and current description of the system's real contracts — more current than any prose documentation.

**Costs**
- Every legitimate structural change (a new export, a new shared file, a new environment global) requires updating the relevant boundary test in lockstep, or it fails for the wrong reason.
- The tests are unreadable as *orientation* material for a newcomer — they enforce contracts but don't explain why those contracts exist; a reader needs prose (like this ADR log) alongside them.

## Consequences
- This is the single biggest reason the implementation is more trustworthy than the documentation in this repository: the tests can't drift silently the way prose can.
- Any new package or host added to this monorepo should get its own boundary test from day one, following this established pattern, or its contracts will be undocumented and unenforced from day one.

## Revisit Criteria
Revisit if either is directly observed, not merely anticipated:
- A change is blocked by a boundary test's regex pattern in a way that isn't a real violation (a false positive), indicating the pattern-matching approach has started producing friction rather than signal — at that point compare hand-written regex assertions against a dedicated tool like dependency-cruiser for that specific case.
- A newcomer's onboarding is observed to be slowed specifically because the boundary tests have no accompanying prose — at that point, prioritize generating/maintaining documentation from the tests and config (as this ADR log already attempts) over adding more tests.
