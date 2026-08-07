# Discovery Builder — Domain Model

*Living architecture documentation · derived from implemented business behavior*

Entities, Value Objects, Domain Services, Policies, Invariants, Aggregates, and Domain Events, built by reading catalog data, selection state, the Composer subsystem, persistence, finalization, curator bonus, and collection-intelligence code directly. Companion documents: [`../adr/README.md`](../adr/README.md) (why each structural decision was made) and [`../architecture/C4.md`](../architecture/C4.md) (where each concept lives and which package/host boundary owns it).

Where a concept below is inferred from naming or call-site evidence rather than a fully-read function body, that is stated at the point it's introduced, not smoothed over. See [Known gaps and caveats](#known-gaps-and-caveats) for a consolidated list.

## Contents

- [Bounded contexts (framing)](#bounded-contexts-framing)
- [Entities](#entities)
- [Value Objects](#value-objects)
- [Domain Services](#domain-services)
- [Policies](#policies)
- [Invariants](#invariants)
- [Aggregates](#aggregates)
- [Domain Events](#domain-events)
- [Known gaps and caveats](#known-gaps-and-caveats)

## Bounded contexts (framing)

Every concept below sits in one of four contexts already documented in the ADR log and C4 model: **Catalog** (fragrance/note reference data, merchant-agnostic), **Collection/Builder** (the box being assembled), **Composer** (proposal generation, merchant-agnostic), **Finalization** (order handoff). This document is organized by DDD category, not by context, but the owning context is noted per concept since it matters for the aggregate reasoning below.

## Entities

Entities have identity that persists independent of attribute values, and are referenced by that identity elsewhere.

| Entity | Identity | Context | Evidence |
|---|---|---|---|
| **Fragrance** | `id` (integer) | Catalog | `packages/catalog/src/fragrances.js`. Attributes: `name`, `shortName`, `brand`, `points`, `imageAssetKey`, `accords[]`, `seasons[]`, `occasions[]`, `vibes[]`, `topNotes[]`, `middleNotes[]`, `baseNotes[]`; optionally `seasonWeights`, `warningMessage` (referenced in `selectionState.js`). Referenced by id from Collection, Composer requests (`lockedPerfumeIds`/`excludedPerfumeIds`), and recommendations. |
| **Note** | string key (e.g. `"lime"`) | Catalog | `packages/catalog/src/notes.js`. Attributes: `name`, `family`, `noteImageAssetKey`. Referenced by id from `Fragrance.topNotes/middleNotes/baseNotes`. |

Both are **reference entities**: identity-bearing and referenced by id from elsewhere, but nothing in the running system creates, updates, or deletes them — they're loaded once as static data. This is called out precisely rather than defaulting to Value Object, because other structures *do* hold onto their id as a durable reference independent of the record's content (a `lockedPerfumeIds` entry means "this specific fragrance," not "any fragrance with these attributes").

**Merchant** is a borderline case, addressed under Value Objects below rather than here — see that entry for the reasoning.

## Value Objects

Defined entirely by their attributes, no identity, recomputed fresh rather than looked up.

| Value Object | Shape | Context | Evidence |
|---|---|---|---|
| **CustomerInfo** | `{ name, city, notes }`, trimmed/length-capped | Collection / Finalization | `buildFinalizationModel.js::normalizeCustomerInfo`; persisted as part of Collection state (`builderPersistence.js`). |
| **CuratorBonusPreference** | enum: `complement` \| `similar` | Collection | `defaultBuilderConfig.curatorBonus.preferences`, `isCuratorBonusUnlocked.js` context. |
| **Tier** | `{ name, emoji, color, background, glassTintMid, glassTintEdge }` | Catalog (presentation) | `tierUtils.js::getTierData(id)` — pure function of `Fragrance.id`, not stored. |
| **BoxRules** | `{ minSelectableSlots, maxSelectableSlots, totalPhysicalSlots, bonusSlotCount, minPoints }` | Merchant config | `defaultBuilderConfig.box`, validated by `validateBuilderConfig.js`. Parameters of the Discovery Box Eligibility Policy, below. |
| **BoxSummary** | `{ occasions[], seasons[], notes[], vibes[], accordMap, occasionCounts, seasonCounts, seasonStrengths, vibeCounts }` | Collection (derived) | `buildBoxSummary.js` — computed from a set of selected Fragrances + Notes. Reused by both the live Collection-intelligence panel *and* Composer's quality scoring (`evaluateComposerQualityDimensions.js` calls it directly) — one shared derived VO, not two separate implementations. |
| **CoverageSummary** | derived from `BoxSummary` + full catalog | Collection (derived) | `buildCoverageSummary.js` (referenced by `buildCollectionSummary.js`; not read in full — inferred from call site and PROJECT_STATE.md's "coverage analysis" feature). |
| **ScentDna** | derived profile from `BoxSummary` | Collection (derived) | `buildScentDna.js` (referenced by both `BuilderRuntime.jsx` and `evaluateComposerQualityDimensions.js`; not read in full). |
| **CollectionReadiness** | `{ hasMinimumSlots, hasMinimumPoints, isReady, blockers[] }` | Collection | `buildCollectionSummary.js`. `blockers` is a closed set: `"minimum-slots"`, `"minimum-points"`. |
| **FinalizationReadiness** | `{ hasCustomerName, hasCustomerCity, isCollectionReady, isReady, blockers[] }` | Finalization | `buildFinalizationModel.js::validateFinalization`. Wraps `CollectionReadiness.isReady` and adds two more blockers: `"customer-name-required"`, `"customer-city-required"`. |
| **Order** | `{ items[{id,name,brand,points}], totalSlots, totalPoints, monetaryTotal, currency, curatorBonus }` | Finalization | `buildFinalizationModel.js::buildOrderModel`. `items` is a **snapshot** — id/name/brand/points copied at finalization time, decoupled from any later catalog change. Never persisted; reconstructed fresh each time finalization is opened. |
| **FinalizationModel** | `{ customer, order, readiness, message }` | Finalization | `buildFinalizationModel.js` top-level return — the composite handed to the WhatsApp adapter. |
| **ComposerStrategy** | `{ id, label, description }`, one of `balanced` \| `versatile` \| `explorer` \| `signature` | Composer | `composerStrategies.js`. Governs *scoring weights* (see Policies). |
| **ComposerCollectionStyle** | `{ id, label }`, one of `premium_focus` \| `balanced_mix` \| `more_variety` | Composer | `composerCollectionStyles.js`. A **second, independent** selectable axis from Strategy — easy to conflate, kept distinct in the code. |
| **ComposerRequest** | `{ budget, currency, pointValue, maxPoints, minSlots, maxSlots, targetSlots, lockedPerfumeIds[], excludedPerfumeIds[], preferredSeasons[]/Occasions[]/Vibes[], strategy, collectionStyle, inputIssues[], lockedExcludedConflicts[] }` | Composer | `normalizeComposerRequest.js`. |
| **ConstraintResult** | `{ valid, violations[], metrics }` | Composer | `evaluateComposerConstraints.js`. `violations` codes form a closed enum (`BUDGET_EXCEEDED`, `MIN_SLOTS_NOT_MET`, `LOCKED_PERFUME_MISSING`, etc.). |
| **QualityResult** | `{ evaluable, overallScore, dimensions, penalties, weightedDimensions, weightedPenalties, diagnostics }` | Composer | `evaluateCompositionQuality.js`. |
| **Objective** | `{ baseImportance, signals:{accords,vibes,occasions,seasons}, reasons }`, one of `freshDaytime` \| `coldWeather` \| `formal` \| `evening` \| `contrast` | Collection intelligence | `buildNextImprovement.js::OBJECTIVE_DEFINITIONS`. A named, static coverage target. |
| **ObjectiveCoverage** | `{ saturation, weightedContribution, diversityBonus, matchedGroups[], matchedSignals[] }` | Collection intelligence (derived) | `buildNextImprovement.js::getObjectiveCoverage`. |
| **CompositionResult** ("Proposal") | `{ composed, mode, status, terminationReason, collection[], collectionIds[], constraintResult, qualityResult, diagnostics, ... }` | Composer | `composeCollection.js` — documented in depth as ADR-0020. |

**Merchant** (the `createBuilderConfig` output) is classified here, with a caveat: it has an implicit identity (`analytics.merchantId`) and represents "a distinct business," which argues for Entity status conceptually. But nothing in the running system creates, updates, or deletes a Merchant — it's assembled once at build time and deep-frozen (`createBuilderConfig.js`), consistent with ADR-0004. Judged strictly by *implemented behavior* rather than conceptual intent, it behaves as an immutable Value Object: no domain operation in this codebase mutates a Merchant's state. This is called out explicitly rather than picked silently — see [Known gaps and caveats](#known-gaps-and-caveats).

## Domain Services

Stateless operations that don't naturally belong to one entity.

| Service | Signature (informal) | Evidence |
|---|---|---|
| **Composer** | `(ComposerRequest, Catalog, Notes, Config, mode) → CompositionResult` | `composeCollection.js`, orchestrating `composeCollectionGreedy`, `refineCollection`, `evaluateComposerConstraints`, `evaluateCompositionQuality`. The system's most substantial domain service — see ADR-0015, ADR-0020. |
| **Recommendation Service** | `(Catalog, selected Fragrances, Config) → { basedOnYourPicks[], toBalanceYourBox[] }` | `buildComposerRecommendations.js`. **Not a separate algorithm** — it calls Composer internally twice, once with `strategy: "signature"` and preferences derived from the current selection, once with `strategy: "balanced"` excluding whatever the first lane already returned. |
| **Collection Readiness / Summary Service** | `(selected Fragrances, Catalog, Notes, Config) → { counts, points, money, readiness: CollectionReadiness, boxSummary, coverageSummary }` | `buildCollectionSummary.js`, composing `buildBoxSummary` + `buildCoverageSummary`. |
| **Next-Improvement Advisor** | `(intelligence, selected Fragrances, recommendations) → guidance` | `buildNextImprovement.js`. Scores five `Objective`s by unmet-need "urgency," picks the highest-priority one with a compatible existing recommendation, and produces a single explained suggestion. The most algorithmically dense service outside Composer itself. |
| **Curator Bonus Policy Service** | `({totalPoints, totalSlots, targetPoints, minSlots}) → boolean` | `isCuratorBonusUnlocked.js` — small, but a real, separately-testable domain rule. |
| **Finalization Service** | `(selected Fragrances, totals, CustomerInfo, curatorBonus, Config) → FinalizationModel` | `buildFinalizationModel.js`. |
| **Tier Classification** | `(Fragrance.id) → Tier` | `tierUtils.js::getTierData`. |

## Policies

Named business rules that decide or constrain an outcome, as distinct from services that compute a result.

1. **Selection Admission Policy** — a Fragrance may be added only if the Collection is below `maxSelectableSlots` and the Fragrance isn't already selected. (`selectionState.js::canAddPerfume`)
2. **Discovery Box Eligibility Policy** — a Collection is "ready" only if `selectedCount ≥ minSelectableSlots` and `totalPoints ≥ minPoints`. (`buildCollectionSummary.js`)
3. **Curator Bonus Unlock Policy** — bonus slots unlock only if `totalPoints ≥ targetPoints` AND `totalSlots ≥ minSlots` (both, not either). (`isCuratorBonusUnlocked.js`)
4. **Finalization Admission Policy** — finalization is blocked unless the Collection is ready (Policy 2) **and** customer name **and** city are present. **Precise observation:** this is hardcoded in `validateFinalization` — it does not read `config.finalization.requiredFields` at runtime, even though that config field exists and is validated for shape at config-build time (`validateBuilderConfig.js`). The two are consistent today only because every merchant's `requiredFields` happens to equal `["name", "city"]`. A merchant configuring different required fields would have no actual effect on this policy.
5. **Points-to-Value Conversion Policy** — `monetaryValue = totalPoints × merchant.commerce.pointValue`. (ADR-0003; applied in `buildCollectionSummary.js`, `evaluateComposerConstraints.js`, `buildFinalizationModel.js`)
6. **Composer Feasibility Policy** — a candidate collection is valid only if it violates none of a closed set of constraint codes (budget, slot count, locked/excluded presence, duplicate ids, unknown ids). (`evaluateComposerConstraints.js`)
7. **Composer Quality Policy** — a valid collection is scored across seven weighted dimensions (`preferenceFit`, `coverage`, `diversity`, `versatility`, `coherence`, `budgetEfficiency`, `signatureFocus`) minus at least one penalty (`redundancyPenalty`), with weights varying by `ComposerStrategy`. (`composerQualityDimensions.js`, `composerStrategyWeights.js`)
8. **Refinement Acceptance Policy** — a refined collection replaces the greedy one only if it's still constraint-valid and does not score lower than the greedy baseline; otherwise the greedy result is kept. (`composeCollection.js::selectBestModeCollection` — ADR-0020's contract in policy form.)
9. **Tier Classification Policy** — `Fragrance.id` bucketed into six contiguous ranges → Tier name. (`tierUtils.js`; the unguarded id/points consistency gap is tracked at [`../backlog/tier-id-range-integrity.md`](../backlog/tier-id-range-integrity.md).)

## Invariants

Hard constraints, distinguished from Policies above by being non-negotiable rather than scored/advisory.

- A Collection never exceeds `maxSelectableSlots` (enforced at the point of mutation, not after the fact — `canAddPerfume` refuses the add).
- A Collection never contains the same Fragrance id twice (same enforcement point).
- `minSelectableSlots ≤ maxSelectableSlots ≤ totalPhysicalSlots` — enforced once, at Merchant construction (`validateBuilderConfig.js`), **not** re-checked against any live Collection, since it's an invariant on the Policy parameters, not on selection state.
- Every Fragrance id in the canonical catalog is unique (`createMerchantCatalog.js` throws on duplicates).
- Every id in a merchant's `availableIds` list must exist in the canonical catalog (`createMerchantCatalog.js` throws on unknown ids).
- Persisted Collection state is trusted only if its `schemaVersion` matches the current config and every persisted Fragrance id still exists in the current catalog — otherwise the entire persisted state is discarded, not partially repaired (`builderPersistence.js::validatePersistedBuilderState`).
- In a `ComposerRequest`, `minSlots ≤ maxSlots` always holds after normalization — if the raw input violates this, `minSlots` is clamped down and an `inputIssue` is recorded rather than the request being rejected outright (`normalizeComposerRequest.js`).
- A fragrance id cannot be simultaneously locked and excluded in a `ComposerRequest` — if both are supplied, the exclusion is silently dropped (`lockedExcludedConflicts`), locking wins.

## Aggregates

**Collection** is the one aggregate justified by implemented behavior, not convention:

- **Root:** the ordered list of selected Fragrance references.
- **Members inside the consistency boundary:** `CuratorBonusPreference`, `CustomerInfo`.
- **Why these three together, not separately:** they are read and written as a single unit everywhere that matters — `createBuilderPersistencePayload({ selectedPerfumes, curatorBonusPreference, customerInfo })` persists all three under one storage key in one write, and `hydrateBuilderPersistence`/`loadPersistedBuilderState` restore all three together or none at all (an invalid persisted blob discards the whole thing, not just the invalid field). That's the concrete signal of an aggregate: one transactional unit, not three coincidentally-related pieces of state.
- **What's referenced by id, not owned:** Fragrances themselves live in the Catalog context; the Collection holds ids (persisted form) / hydrated references (runtime form), never a private copy it could diverge from the catalog's own data — aggregates reference other aggregates by identity, holding exactly here.
- **Invariants protected by this boundary:** the Selection Admission Policy (capacity, no duplicates) — every mutation path (`addSelectedPerfume`, `removeSelectedPerfumeAtIndex`, `reorderSelectedPerfumes`, `applyInitialFragranceIntent`) goes through the same small set of functions, so the invariant can't be bypassed by a different entry point.

**Deliberately not modeled as an aggregate, and why:**
- **Catalog** — no runtime operation enforces a cross-fragrance invariant as a transactional unit. The boundary tests (`catalogPackageBoundary.test.js`, exact-count assertions) protect data integrity at CI time, which is a repository/build-time concern, not an aggregate-consistency concern the running software enforces during use.
- **Merchant** — constructed once, frozen, never mutated again. Aggregates exist to protect invariants *across mutations*; a value that never mutates after construction doesn't need an aggregate boundary, it needs the validate-then-freeze pattern it already has (see `docs/engineering-conventions.md`).
- **CompositionResult / Order** — both are one-shot computed outputs with no identity and no lifecycle to protect. Nothing ever looks one up by id or mutates one after creation; they're Value Objects, not aggregates, even though they're structurally rich.

## Domain Events

**Precise framing first:** this codebase has no event bus and no internal pub/sub — "events" here are the `ANALYTICS_EVENTS` catalog (`packages/builder/src/analytics/events.js`), which are event-*shaped* (named, payload-carrying, fired at state transitions) but consumed only by an external analytics provider, never by other domain logic. Calling them "Domain Events" without that caveat would overstate what's actually implemented. They're split below by whether they correspond to a genuine domain-model state transition (per this document) or are UI/navigation telemetry.

**Actual — domain-significant** (each corresponds to a state transition on Collection, CompositionResult, or FinalizationModel as modeled above):

| Event | Domain transition |
|---|---|
| `PERFUME_ADDED` / `PERFUME_REMOVED` | Collection mutated via Selection Admission Policy |
| `BOX_CLEARED` | Collection reset to empty |
| `PROPOSAL_APPLIED` | Collection replaced wholesale by a `CompositionResult.collection` |
| `CURATOR_BONUS_UNLOCKED` | Curator Bonus Unlock Policy transitioned false → true |
| `COMPOSER_PROPOSAL_GENERATED` / `COMPOSER_GENERATION_FAILED` | Composer produced a `CompositionResult` |
| `ORDER_FINALIZATION_STARTED` / `_SUCCEEDED` / `_FAILED` | Finalization lifecycle transition |
| `PERSISTENCE_RECOVERY_USED` | Collection state discarded and reset per the persistence invariant above |

**Actual — UI/telemetry only** (real, implemented, but not a domain-model state transition — navigation and interaction tracking): `APP_LOADED`, `MERCHANT_EXPERIENCE_LOADED`, `SEARCH_PERFORMED`, `FILTER_CHANGED`, `SORT_CHANGED`, `FRAGRANCE_DETAILS_OPENED`, `COMPOSER_OPENED`, `COMPOSER_GENERATION_STARTED`, `PROPOSAL_ALTERNATIVE_VIEWED`, `PROPOSAL_DISMISSED`, `REVIEW_OPENED`, `REVIEW_VALIDATION_FAILED`, `ONBOARDING_PATH_SELECTED`, `ONBOARDING_DISMISSED`, `RUNTIME_ERROR_BOUNDARY_SHOWN`.

**Potential** (natural given the model above, not currently named or emitted anywhere):
- *Collection became ready / became not-ready* — `CollectionReadiness.isReady` flipping is currently only derivable by recomputing `buildCollectionSummary` after any mutation; no event marks the transition itself, even though `CURATOR_BONUS_UNLOCKED` shows the pattern already exists for a sibling threshold.
- *Refinement fell back to greedy* — `selectBestModeCollection`'s fallback (Policy 8 above) is visible today only inside `diagnostics.fallbackReason`; it's a real, named outcome (`REFINEMENT_FALLBACK_INVALID_RESULT`, `REFINEMENT_FALLBACK_LOWER_SCORE`) that never becomes an emitted event, unlike its sibling `COMPOSER_GENERATION_FAILED`.
- *Finalization readiness blocked on a specific field* — a `FINALIZATION_VALIDATION_FAILED` would mirror `REVIEW_VALIDATION_FAILED`'s existing shape but for the finalization step specifically; today a blocked finalization attempt isn't distinguished from one that never started.

## Known gaps and caveats

Consolidated from the inline caveats above — each restates something already stated at its point of introduction, not new analysis:

- **Merchant's classification is a judgment call, not a clean fit.** Conceptually identity-bearing, but implemented and behaves as an immutable Value Object because nothing in the running system mutates a Merchant at runtime. See [Value Objects](#value-objects).
- **The Finalization Admission Policy doesn't read `config.finalization.requiredFields`.** The runtime check hardcodes name + city regardless of what a merchant's config declares as required. See Policy 4 under [Policies](#policies).
- **The Tier Classification Policy has no consistency guard.** Nothing checks that a Fragrance's `points` value is consistent with the tier its `id` band implies. See Policy 9 under [Policies](#policies) and [`../backlog/tier-id-range-integrity.md`](../backlog/tier-id-range-integrity.md).
- **Two derived Value Objects were not read in full.** `CoverageSummary` (`buildCoverageSummary.js`) and `ScentDna` (`buildScentDna.js`) are attributed by call-site evidence and naming, not by reading their complete bodies. See [Value Objects](#value-objects).
- **"Domain Events" in this codebase are not true domain events.** There is no event bus or internal pub/sub; the "actual" events are the analytics catalog, consumed only externally. See [Domain Events](#domain-events).

---

*Discovery Builder domain model · derived exclusively from source inspection · treat as current until the underlying code changes, not until this document is rewritten*
