# ADR-0006: Catalog Package Kept Commerce- and Brand-Agnostic

**Status:** Accepted (retroactive)
**Related:** An instance of ADR-0005's package split, protected by the enforcement mechanism ADR-0008 describes. Sibling to ADR-0007 (same kind of purity decision, applied to Composer instead of Catalog — kept as a separate ADR because the two protect different subsystems with different consequences: this one enables catalog reuse/licensing, ADR-0007 enables Composer execution-context migration). ADR-0014 (asset resolution) is a specific sub-decision within the boundary this ADR establishes.
**Evidence:** `packages/catalog/src/catalogPackageBoundary.test.js` asserts the package's source never matches `/Aurelian|Discovery Decants|discoveryDecants/i`, `/React|window|document|navigator|localStorage/`, or `/persistence|analytics|finalization|inventory|stock|pointValue/i`; catalog assets are exposed as `imageAssetKey` strings, never resolved URLs.

## Context
Fragrance, note, and brand data (`fragrances.js`, `notes.js`, `brandAssets.js`, `metadataAssets.js`) is shared across every merchant and every host application. Nothing about "what a fragrance is" should depend on which brand is selling it or which framework is rendering it.

## Decision
`@discovery-box/catalog` may contain only data and pure, environment-independent functions. It is structurally forbidden — by an executable test, not just convention — from referencing React, browser globals, merchant identifiers, or commerce/analytics/persistence vocabulary. Image assets are referenced by abstract key (`imageAssetKey`), resolved elsewhere (see ADR-0014).

## Alternatives Considered
- **Store a resolved default price per fragrance, with per-merchant overrides layered elsewhere** — a real hybrid design that was not taken; rejected because it would create two sources of truth for price (a catalog default and a merchant override), whereas keeping the catalog fully silent on price means there is exactly one place (`points × pointValue`, ADR-0003) where value is computed.
- **Let fragrance records carry optional merchant-scoped fields** (e.g., a merchant-specific description or availability flag directly on the record) — rejected in favor of the external projection approach (`createMerchantCatalog`), which keeps every catalog record identical regardless of which merchant is asking, and pushes merchant-specific shaping to a separate, explicit function.
- **Skip the boundary test, rely on code review** — rejected implicitly, consistent with ADR-0008's general reasoning for test-based enforcement over review-only discipline.

## Trade-offs
**Gains**
- The catalog is provably reusable for something that isn't this specific commerce product — e.g., a pure fragrance-discovery or quiz experience could consume the same package.
- Catalog changes (new fragrances, corrected notes) can never accidentally introduce a merchant- or framework-specific regression.

**Costs**
- Every consumer (builder package, host apps) must do their own commerce/environment wiring around catalog data — the catalog will never do it for them, even when that would be more convenient in a given call site.
- The boundary test itself must be maintained as new commerce/environment vocabulary emerges, or it stops catching real violations.

## Consequences
- `inventory`/`stock` are explicitly named as forbidden vocabulary in this test even though inventory tracking doesn't exist anywhere yet — the boundary already anticipated where that concern must *not* live, without yet deciding where it *should*.
- This is the foundation that makes "sell the catalog data as a separate product" a real, not aspirational, possibility.

## Revisit Criteria
Revisit if:
- Inventory or stock tracking is introduced — this ADR implies it must live in a new layer, not inside `@discovery-box/catalog`.
- A consumer states an actual need for catalog data to vary by merchant beyond availability filtering (e.g., merchant-specific descriptions or notes) — at that point, extend the projection layer (`createMerchantCatalog`) rather than the catalog data itself.
