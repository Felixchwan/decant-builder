# Engineering Conventions

Unlike `docs/adr/`, this document tracks **internal implementation conventions** — choices that operate inside boundaries the ADR log already establishes, rather than choices that shape system structure or capability themselves. Demoted from ADR status on governance review; see `docs/adr/0009-handrolled-config-validation.md` for the retirement note.

## Validation strategy: hand-written assertions, no schema library

**Where it applies:** `packages/builder/src/builder/config/validateBuilderConfig.js` (merchant config), `packages/builder/src/builder/internal/persistence/builderPersistence.js` (persisted box state), `src/analytics/createAnalytics.js` (`isValidAnalyticsEvent`, `containsProhibitedAnalyticsKey`).

**Convention:** validate runtime data with plain functions using explicit `assertPath`/`isValidX`-style checks and specific, path-qualified error messages (e.g., `"Invalid builder config at box.minSelectableSlots: must be less than or equal to box.maxSelectableSlots"`), rather than a schema-definition library (Zod, Yup, io-ts, etc.). No such library appears in either `package.json`. The codebase is plain JavaScript/JSX throughout — no `.ts`/`.tsx` production files exist; `@types/react` is present only for editor support, not compile-time checking.

**Why:**
- Zero new dependencies; validation logic is fully readable without knowing a schema DSL.
- Consistent style across three different validation surfaces (config, persistence, analytics) makes the codebase's error-handling philosophy predictable.
- Runtime validation is necessary regardless of any future TypeScript adoption, since config, persisted state, and analytics payloads all cross an untyped boundary (merchant authors, `localStorage`, an external analytics provider) that static types alone can't guard.

**Costs of this convention:**
- `validateBuilderConfig` grows by roughly one assertion per new overridable config field — a real, ongoing maintenance cost as the config surface expands (e.g., future tax rules, shipping zones, payment channels).
- No automatically-derived TypeScript types or parsing/coercion — every consumer must trust the validated shape rather than have it enforced by the type system.

**When to reconsider this convention** (not a trigger for architectural revisit — an engineering-judgment call for whoever maintains this code):
- If hand-written assertions in any of the three surfaces become genuinely hard to read or reason about in a single pass — this is a subjective, code-review-time judgment, not a line-count threshold, since no evidence exists today for where such a threshold should sit.
- If the team adopts TypeScript project-wide for other reasons — at that point, schema-library-derived static types would offer compounding value beyond what hand-rolled runtime checks provide alone, and revisiting this convention becomes a natural part of that larger change rather than a standalone decision.
