# ADR-0010: Locale Bound to Merchant Identity at Config-Authoring Time

**Status:** Accepted (retroactive)
**Related:** An instance of ADR-0004's merchant-configuration mechanism, applied specifically to language.
**Evidence:** `packages/builder/src/i18n/createTranslator.js` (`SUPPORTED_LOCALES = ["en-US", "es-MX"]`, flat dictionary lookup + `{placeholder}` interpolation, English fallback); `discoveryDecantsConfig` is permanently built with `locale = "en-US"`, `aurelianConfig` with `locale = "es-MX"`; no language switcher exists in either host application.

## Context
Discovery Decants serves an English-speaking audience; Aurelian serves a Spanish-speaking one. Every piece of customer-facing copy (UI labels, WhatsApp message templates, onboarding text) needs to be in the right language for the right brand.

## Decision
Locale is a fixed property of a merchant config, resolved once via `buildLocalizedConfigOverrides(locale)` at config-authoring time and merged into that merchant's config object. Translation itself is a hand-rolled flat key→string dictionary per locale with simple `{placeholder}` interpolation and no pluralization rules — no i18n library (e.g., `react-intl`, `i18next`) is used.

## Alternatives Considered
- **A user-selectable runtime locale** — rejected; would require locale to be a visitor preference independent of merchant identity, which the current one-brand-one-language mapping doesn't need and which would require restructuring the config-merge model (ADR-0004) to separate "which brand" from "which language."
- **A full i18n library** — rejected as disproportionate for two locales and a small, fully in-house, stable string set; would add a dependency and a migration cost without a demonstrated need for pluralization, ICU message formatting, or more than two languages.
- **Duplicate merchant configs per language within one brand** — not needed today, and would be a misuse of the merchant concept (which is meant to mean "distinct business," not "distinct language" — see ADR-0004).

## Trade-offs
**Gains**
- Minimum complexity for the current reality: exactly two brands, exactly two languages, one-to-one.
- No runtime language-detection or locale-switching UI to build or test.

**Costs**
- If either brand ever needs to serve a genuinely bilingual audience, this model has no answer — locale is an attribute of the merchant, not the visitor.
- Number/currency formatting is not confirmed to go through `Intl.NumberFormat`; the translator is a plain string-interpolation system, which is a plausible (not confirmed) gap for `es-MX`-specific number formatting conventions.

## Consequences
- Every merchant config file is responsible for correctly layering `buildLocalizedConfigOverrides` output underneath its own business overrides (e.g., `commerce: {...localized.commerce, currency: "MXN"}`); this is manual merge discipline, not structurally guaranteed — a future merchant author could silently drop translated copy for a section they override.

## Revisit Criteria
Revisit if:
- A customer contact, support interaction, or direct feedback indicates a brand's actual audience is more linguistically mixed than its locale assumes — the trigger is a real observation of this kind, not a projection that it might happen.
- A third locale is needed for a new merchant.
- A merchant author unfamiliar with the codebase is being onboarded — at that point, the manual localized-copy merge discipline noted above should be hardened (e.g., a test flagging untranslated strings in a non-default-locale config) before, not after, that author's first config change.
