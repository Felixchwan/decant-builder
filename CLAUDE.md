# CLAUDE.md

Durable working rules for this repo. Phase-specific instructions belong in the
conversation, not here — only add a rule once it's proven durable across
multiple phases.

## Validation gate

Run in this order before considering any change done. Do not skip steps or
declare done on a partial run.

1. Focused tests for the files you touched.
2. Any established slice-specific or boundary/architecture test gate relevant
   to the change (e.g. an `*Architecture.test.js`/`*Boundary.test.js` file),
   run explicitly even though it's also covered by step 3.
3. Full monorepo suite: `npx vitest run`.
4. If `buildComposerBoxProposal.test.js` times out, see "Known flake" below
   before treating it as a regression.
5. `eslint .`
6. `npm run build` (Discovery Decants) and `npm run build:aurelian`.
7. `git diff --check` and `git status --porcelain -uall`.

## ADR discipline

Architectural decisions live in `docs/adr/`, one file per decision, following
the existing Context / Decision / Alternatives / Trade-offs / Consequences /
Revisit Criteria shape (see `docs/adr/README.md` and any existing ADR as the
template). Add or amend an ADR when a change alters an architectural decision
— not for routine feature work. Narrow corrections to an existing ADR are
preferred over rewriting it wholesale.

## Merchant / host / shared-package boundaries

`packages/builder` and `packages/catalog` are merchant-agnostic — no
Aurelian- or Discovery-Decants-specific code, vocabulary, or config belongs
there. Each host (`apps/aurelian`, root `src/` for Discovery Decants) owns
its own composition, environment reads, and provider wiring; hosts never
import from another host's `src/`. See ADR-0004, ADR-0007, ADR-0019.

## Perceptual Learning boundaries

No file under `apps/aurelian/src/perceptualLearning/`, and none of its
capture/view components, may import analytics. Learner-authored evidence
(Observation/Comparison freeText) never enters analytics or any external
telemetry, in any form, redacted or not. EncounterInstance IDs are never
learner-facing identity/prose and never an analytics payload field; opaque,
explicitly-designed internal routing use (e.g. deep-link resolution) is
permitted. See ADR-0021, ADR-0022.

## Analytics / privacy boundary

Each host owns its own validating `createAnalytics` wrapper (shared package
owns only event vocabulary + `noopAnalytics`). Unknown events, non-
allowlisted payload keys, and prohibited keys (checked recursively,
including nested objects/arrays) are rejected before reaching any provider.
Provider exceptions are swallowed and never affect product behavior.
Aurelian currently wires no live vendor — default is a disabled
console-only logger. See ADR-0013 and `apps/aurelian/src/analytics/README.md`.

## Staging, commit, and push approval

Never run `git add`, `git commit`, or `git push` unless explicitly
instructed in that same turn, including the exact commit message when one
is given. Implementation, validation, and browser acceptance all happen
freely without this approval; only the git actions themselves require it.

## Known flake: `buildComposerBoxProposal.test.js`

A timing-sensitive timeout can appear on this file under full-suite
parallel load. Before treating it as a regression, re-run the file in
isolation (`npx vitest run packages/builder/src/builder/internal/composition/buildComposerBoxProposal.test.js`).
If it passes clean alone, it's the known flake, not a real failure.

## Browser-acceptance expectations

UI or runtime-behavior changes require real interaction in a browser, not
just a passing build. If a check depends on an external account/service
that isn't available (e.g. no live analytics provider), verify what can be
verified locally (a controlled spy, a source-level guard), name exactly
what still needs manual external setup, and stop short of claiming full
acceptance.

## Scope discipline

Implement only the requested slice. If you notice an unrelated issue,
name it rather than fixing it inline — do not bundle unrelated cleanup,
refactors, or fixes into an approved change.
