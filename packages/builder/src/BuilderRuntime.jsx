import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getTierData } from "./utils/tierUtils";
import PerfumeCard from "./components/PerfumeCard";
import FilterBar from "./components/FilterBar";
import BuilderPanel from "./components/BuilderPanel";
import MetadataPreview from "./components/MetadataPreview";
import { buildScentDna } from "./utils/buildScentDna";
import { buildCatalogView } from "./builder/internal/catalog/buildCatalogView.js";
import { buildCollectionSummary } from "./builder/internal/intelligence/buildCollectionSummary.js";
import { deriveDefaultComposerBudget } from "./builder/internal/composer/deriveDefaultComposerBudget.js";
import {
  clearPersistedBuilderState,
  createBuilderPersistencePayload,
  hasMeaningfulBuilderPersistence,
  loadPersistedBuilderState as loadPersistedBuilderStateFromStorage,
  savePersistedBuilderState,
} from "./builder/internal/persistence/builderPersistence.js";
import {
  buildComposerBoxProposal,
  buildComposerProposalInputKey,
  isComposerBoxProposalStale,
  moveComposerProposalSlotAlternative,
} from "./builder/internal/composition/buildComposerBoxProposal.js";
import {
  buildComposerRecommendations,
  buildIntentRecommendations,
} from "./builder/internal/recommendations/buildComposerRecommendations.js";
import {
  brandAssets,
  metadataAssets,
} from "@discovery-box/catalog";
import { createTranslator } from "./i18n/createTranslator.js";
import { ANALYTICS_EVENTS } from "./analytics/events.js";
import { noopAnalytics } from "./analytics/noopAnalytics.js";
import { isCuratorBonusUnlocked } from "./builder/internal/curatorBonus/isCuratorBonusUnlocked.js";
import {
  buildBuilderThemeStyle,
  hasCustomBuilderTheme,
} from "./builder/theme/builderTheme.js";
import { useBuilderPortalRoot } from "./builder/internal/portal/useBuilderPortalRoot.js";
import {
  addSelectedPerfume,
  applyInitialFragranceIntent,
  canAddPerfume,
  removeSelectedPerfumeAtIndex,
  reorderSelectedPerfumes,
} from "./builder/internal/selection/selectionState.js";

const EMPTY_NOTES = {};

function getInitialFragranceIntentMessage(intent, translate) {
  if (!intent) {
    return "";
  }

  const messageKeys = {
    ready: intent.perfume?.warningMessage ? null : "app.initialFragranceAdded",
    duplicate: "app.initialFragranceAlreadySelected",
    capacity: "app.initialFragranceCapacity",
    unavailable: "app.initialFragranceUnavailable",
  };
  const key = messageKeys[intent.status];
  return key ? translate(key) : "";
}

function App({
  catalog,
  notes: noteMetadata = EMPTY_NOTES,
  config,
  analytics = noopAnalytics,
  finalizationAdapter,
  initialFragranceId = null,
  initialRecommendationHint = null,
  explainRecommendation,
  assetResolver,
  isDevelopment = false,
  stickySummaryPortalTarget = null,
  // Generic, opt-in, request-level lower aggregate-points bound for the
  // "Compose my box" action. null/absent preserves today's behavior exactly
  // (see buildComposerBoxProposal.js's own minimumPoints doc comment) --
  // only a host that opts in by passing a value ever changes what counts as
  // a completed proposal.
  composerMinimumPoints = null,
  // Generic host capability for the Builder's own shared hero section (the
  // title + description above the catalog). Defaults to true, preserving
  // existing Builder behavior for any host that doesn't pass this -- a host
  // renders it unless it explicitly opts out because it has its own intro
  // presentation above the Builder (see DiscoveryBoxBuilder.jsx's doc
  // comment). Purely a render switch: the Builder holds no preference state
  // of its own here, and never reads storage for it.
  showBuilderHero = true,
  // Opt-in desktop capability: renders a full-height collapse rail at the
  // left edge of the box panel column, letting the catalog reclaim that
  // width when collapsed (see DiscoveryBoxBuilder.jsx's doc comment).
  // false/absent renders the box panel column exactly as it always has --
  // no rail, no extra wrapper, no grid-track changes.
  enablePanelCollapse = false,
  // Generic, opt-in presentation hook for the catalog heading row: absent
  // by default, which renders the row exactly as it always has -- no
  // button, no extra DOM. A host that wants a compact affordance there
  // (e.g. to restore its own dismissed intro presentation) passes a
  // handler; the Builder never interprets what the click means, only
  // renders the control and relays the click, same as explainRecommendation.
  onCatalogInfoRequest,
}) {
  const builderConfig = config;
  const builderThemeStyle = useMemo(
    () => buildBuilderThemeStyle(builderConfig.theme),
    [builderConfig.theme]
  );
  const isCustomBuilderTheme = hasCustomBuilderTheme(builderConfig.theme);
  const builderThemeClassName = isCustomBuilderTheme
    ? "builder-theme-root builder-scope builder-theme-root--custom"
    : "builder-theme-root builder-scope";
  const {
    builderRootRef,
    instanceId: builderInstanceId,
    portalRoot,
  } = useBuilderPortalRoot({
    themeStyle: builderThemeStyle,
    isCustomTheme: isCustomBuilderTheme,
  });
  const translator = useMemo(
    () => createTranslator(builderConfig.locale, builderConfig.taxonomyLabels),
    [builderConfig.locale, builderConfig.taxonomyLabels]
  );
  const { t } = translator;
  const perfumes = catalog;
  const notes = useMemo(() => noteMetadata || EMPTY_NOTES, [noteMetadata]);
  const MIN_BOX_SLOTS = builderConfig.box.minSelectableSlots;
  const MAX_BOX_SLOTS = builderConfig.box.totalPhysicalSlots;
  const MAX_SELECTABLE_SLOTS = builderConfig.box.maxSelectableSlots;
  const DEFAULT_CUSTOMER_INFO = builderConfig.finalization.customerDefaults;
  const minimumComposerBudget = useMemo(
    () =>
      deriveMinimumComposerBudget({
        catalog: perfumes,
        minSlots: MIN_BOX_SLOTS,
        pointValue: builderConfig.commerce.pointValue,
      }),
    [perfumes, MIN_BOX_SLOTS, builderConfig]
  );
  const DEFAULT_BUILDER_STATE = useMemo(() => ({
    selectedPerfumeIds: [],
    curatorBonusPreference: builderConfig.curatorBonus.defaultPreference,
    customerInfo: DEFAULT_CUSTOMER_INFO,
  }), [builderConfig, DEFAULT_CUSTOMER_INFO]);
  const persistedBuilderState = useMemo(
    () =>
      loadPersistedBuilderState({
        builderConfig,
        perfumes,
        defaultBuilderState: DEFAULT_BUILDER_STATE,
      }),
    [builderConfig, perfumes, DEFAULT_BUILDER_STATE]
  );
  const initialSelectionState = useMemo(
    () =>
      applyInitialFragranceIntent({
        initialFragranceId,
        catalog: perfumes,
        selectedPerfumes: persistedBuilderState.selectedPerfumes,
        maxSelectableSlots: MAX_SELECTABLE_SLOTS,
      }),
    [initialFragranceId, MAX_SELECTABLE_SLOTS, perfumes, persistedBuilderState.selectedPerfumes]
  );
  const initialFragranceIntent = initialSelectionState.intent;
  const [selectedPerfumes, setSelectedPerfumes] = useState(initialSelectionState.selectedPerfumes);
  const [curatorBonusPreference, setCuratorBonusPreference] = useState(
    persistedBuilderState.curatorBonusPreference
  );
  const [reviewCustomerInfo, setReviewCustomerInfo] = useState(
    persistedBuilderState.customerInfo
  );
  const [restoreMessage, setRestoreMessage] = useState(() =>
    getInitialFragranceIntentMessage(initialFragranceIntent, t) ||
    (persistedBuilderState.wasRestored ? builderConfig.persistence.restoreMessage : "")
  );
  const [activeMobileTab, setActiveMobileTab] = useState(
    initialFragranceIntent && initialFragranceIntent.status !== "unavailable" ? "box" : "catalog"
  );
  // Local, non-persisted -- resets every mount, same as BuilderPanel's own
  // isSummaryCollapsed. Only meaningful when enablePanelCollapse is true;
  // the rail/collapsible wrapper below don't render at all otherwise, so
  // this has zero effect for a host that never opts in.
  const [isPanelCollapsed, setIsPanelCollapsed] = useState(false);
  const panelRowRef = useRef(null);
  const [panelStickyTop, setPanelStickyTop] = useState(0);
  const [activeFilters, setActiveFilters] = useState({
    seasons: "",
    occasions: "",
    vibes: "",
  });
  const hasCustomizedComposerBudgetRef = useRef(false);
  const [composerSettings, setComposerSettings] = useState(() => {
    const initialSelectedPerfumes = initialSelectionState.selectedPerfumes;
    const initialTotalPoints = initialSelectedPerfumes.reduce(
      (sum, perfume) => sum + perfume.points,
      0
    );
    const initialMissingSlots = Math.max(0, MIN_BOX_SLOTS - initialSelectedPerfumes.length);
    const initialMissingPoints = Math.max(
      0,
      (builderConfig.box.minPoints || 0) - initialTotalPoints
    );

    const completionAwareDefault = deriveDefaultComposerBudget({
      catalog: perfumes,
      missingSlots: initialMissingSlots,
      missingPoints: initialMissingPoints,
      pointValue: builderConfig.commerce.pointValue,
    });

    return {
      strategy: "balanced",
      collectionStyle: "balanced_mix",
      // Never below the permissive gate (minimumComposerBudget): missingSlots
      // is state-aware and can be smaller than the static slot-count floor
      // the gate uses once the box already has some progress, which could
      // otherwise produce a default the gate itself would reject.
      budget: String(
        Number.isFinite(minimumComposerBudget)
          ? Math.max(completionAwareDefault, minimumComposerBudget)
          : completionAwareDefault
      ),
      seasons: [],
      occasions: [],
      vibes: [],
    };
  });
  const [composerProposal, setComposerProposal] = useState(null);
  const [isComposerGenerating, setIsComposerGenerating] = useState(false);
  const [composerStatusMessage, setComposerStatusMessage] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortOption, setSortOption] = useState("bestMatch");
  const [pendingPerfume, setPendingPerfume] = useState(
    initialFragranceIntent?.status === "ready" && initialFragranceIntent.perfume.warningMessage
      ? initialFragranceIntent.perfume
      : null
  );
  const [detailPerfume, setDetailPerfume] = useState(null);
  const intentRecommendationsRef = useRef(null);
  const fullCatalogRef = useRef(null);
  const composerGenerationTimeoutRef = useRef(null);
  const composerGenerationIdRef = useRef(0);
  const hasTrackedAppLoadRef = useRef(false);
  const hasTrackedCuratorBonusUnlockedRef = useRef(false);
  const pendingPerfumeSourceRef = useRef(pendingPerfume ? "initial-intent" : "manual");

  const collectionSummary = useMemo(
    () =>
      buildCollectionSummary({
        selectedPerfumes,
        catalog: perfumes,
        notes,
        config: builderConfig,
      }),
    [selectedPerfumes, perfumes, notes, builderConfig]
  );
  const totalSlots = collectionSummary.counts.selected;
  const totalPoints = collectionSummary.points.total;
  const estimatedValue = collectionSummary.money.total;
  const missingSlots = collectionSummary.counts.minimumRemaining;
  const missingPoints = collectionSummary.points.remaining;
  const isBoxReady = collectionSummary.readiness.isReady;
  const boxSummary = collectionSummary.boxSummary;
  const coverageSummary = collectionSummary.coverageSummary;
  const catalogView = useMemo(
    () =>
      buildCatalogView({
        catalog: perfumes,
        notes,
        searchQuery,
        activeFilters,
        sortOption,
      }),
    [activeFilters, perfumes, notes, searchQuery, sortOption]
  );
  const filterOptions = catalogView.filterOptions;
  const visiblePerfumes = catalogView.visiblePerfumes;

  const detailPerfumeIndex = detailPerfume
    ? visiblePerfumes.findIndex((perfume) => perfume.id === detailPerfume.id)
    : -1;
  const canNavigateDetails = visiblePerfumes.length > 1;
  const previousDetailPerfume =
    detailPerfumeIndex >= 0 && visiblePerfumes.length > 0
      ? visiblePerfumes[
          (detailPerfumeIndex - 1 + visiblePerfumes.length) %
            visiblePerfumes.length
        ]
      : null;
  const nextDetailPerfume =
    detailPerfumeIndex >= 0 && visiblePerfumes.length > 0
      ? visiblePerfumes[(detailPerfumeIndex + 1) % visiblePerfumes.length]
      : null;

const scentDna = useMemo(() => {
  return buildScentDna(selectedPerfumes, boxSummary);
}, [selectedPerfumes, boxSummary]);
const recommendations = useMemo(() => {
  return buildComposerRecommendations({
    perfumes,
    selectedPerfumes,
    notes,
    config: builderConfig,
  });
}, [perfumes, selectedPerfumes, notes, builderConfig]);
const intentRecommendations = useMemo(() => {
  if (!initialRecommendationHint) {
    return [];
  }

  return buildIntentRecommendations({
    perfumes,
    selectedPerfumes,
    notes,
    config: builderConfig,
    limit: 10,
    strategy: initialRecommendationHint.strategy,
    preferredSeasons: initialRecommendationHint.preferredSeasons,
    preferredOccasions: initialRecommendationHint.preferredOccasions,
    preferredVibes: initialRecommendationHint.preferredVibes,
    excludedPerfumeIds: initialRecommendationHint.excludedPerfumeIds,
  });
}, [initialRecommendationHint, perfumes, selectedPerfumes, notes, builderConfig]);
const hasIntentRecommendations = intentRecommendations.length > 0;
const composerBudget = parseComposerBudget(composerSettings.budget);
// Individually adding (or removing) one of THIS proposal's own suggestions
// is expected consumption, not a context change -- it must not be treated
// the same as a genuinely invalidating edit (changing composer settings, the
// catalog, or the box's pre-existing preserved contents). Composer's own
// addedPerfumes already tracks exactly "this proposal's current suggestion
// ids" (recomputed live as the user cycles alternatives -- see
// buildComposerBoxProposal.js's rebuildProposalWithSelectedAlternatives), so
// stripping those ids out of the live box before building the comparison key
// makes the key invariant to individual add/remove of the proposal's own
// suggestions, while any other selection change (an unrelated manual add, or
// removing a preserved item) still changes the key and is still caught as
// stale. This key is used only for the staleness comparison below --
// handleComposeMyBox generates new proposals from the raw, unfiltered
// selectedPerfumes, exactly as before.
const composerProposalAddedIds = useMemo(
  () => new Set((composerProposal?.addedPerfumes || []).map((perfume) => perfume.id)),
  [composerProposal]
);
const selectedPerfumesForComposerStaleCheck = useMemo(
  () => selectedPerfumes.filter((perfume) => !composerProposalAddedIds.has(perfume.id)),
  [selectedPerfumes, composerProposalAddedIds]
);
const composerInputKey = useMemo(
  () =>
    buildComposerProposalInputKey({
      selectedPerfumes: selectedPerfumesForComposerStaleCheck,
      excludedPerfumeIds: [],
      strategy: composerSettings.strategy,
      collectionStyle: composerSettings.collectionStyle,
      budget: composerBudget,
      targetSlots: MAX_SELECTABLE_SLOTS,
      minSlots: MIN_BOX_SLOTS,
      maxSlots: MAX_SELECTABLE_SLOTS,
      seasons: composerSettings.seasons,
      occasions: composerSettings.occasions,
      vibes: composerSettings.vibes,
      catalog: perfumes,
      config: builderConfig,
      minimumPoints: composerMinimumPoints,
    }),
  [
    selectedPerfumesForComposerStaleCheck,
    composerSettings,
    composerBudget,
    MAX_SELECTABLE_SLOTS,
    MIN_BOX_SLOTS,
    perfumes,
    builderConfig,
    composerMinimumPoints,
  ]
);
const isComposerProposalStale = isComposerBoxProposalStale(
  composerProposal,
  composerInputKey
);

  useEffect(() => {
    if (hasTrackedAppLoadRef.current) {
      return;
    }

    hasTrackedAppLoadRef.current = true;
    analytics.track(ANALYTICS_EVENTS.APP_LOADED, {
      selectedSlotCount: selectedPerfumes.length,
      source: "system",
    });
    analytics.track(ANALYTICS_EVENTS.MERCHANT_EXPERIENCE_LOADED, {
      source: "system",
    });

    if (persistedBuilderState.wasRestored) {
      analytics.track(ANALYTICS_EVENTS.PERSISTENCE_RECOVERY_USED, {
        slotCount: selectedPerfumes.length,
        curatorBonusPreference,
        source: "system",
      });
    }
  }, [analytics, curatorBonusPreference, persistedBuilderState.wasRestored, selectedPerfumes.length]);

  useEffect(() => {
    const curatorBonusUnlocked = isCuratorBonusUnlocked({
      totalPoints,
      totalSlots,
      targetPoints: builderConfig.curatorBonus.targetPoints,
      minSlots: MIN_BOX_SLOTS,
    });

    if (curatorBonusUnlocked && !hasTrackedCuratorBonusUnlockedRef.current) {
      hasTrackedCuratorBonusUnlockedRef.current = true;
      analytics.track(ANALYTICS_EVENTS.CURATOR_BONUS_UNLOCKED, {
        slotCount: totalSlots,
        totalPoints,
        preference: curatorBonusPreference,
        source: "system",
      });
    }

    if (!curatorBonusUnlocked) {
      hasTrackedCuratorBonusUnlockedRef.current = false;
    }
  }, [analytics, builderConfig, curatorBonusPreference, MIN_BOX_SLOTS, totalPoints, totalSlots]);

  useEffect(() => {
    const persistedState = createBuilderPersistencePayload({
      selectedPerfumes,
      curatorBonusPreference,
      customerInfo: reviewCustomerInfo,
    });

    if (!hasMeaningfulBuilderPersistence(persistedState, DEFAULT_BUILDER_STATE, DEFAULT_CUSTOMER_INFO)) {
      clearStoredBuilderState(builderConfig);
      return;
    }

    saveStoredBuilderState(
      {
        selectedPerfumes,
        curatorBonusPreference,
        customerInfo: reviewCustomerInfo,
      },
      builderConfig
    );
  }, [selectedPerfumes, curatorBonusPreference, reviewCustomerInfo, builderConfig, DEFAULT_BUILDER_STATE, DEFAULT_CUSTOMER_INFO]);

  useEffect(() => {
    if (!restoreMessage) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      setRestoreMessage("");
    }, 3200);

    return () => window.clearTimeout(timeoutId);
  }, [restoreMessage]);

  useEffect(() => {
    return () => {
      if (composerGenerationTimeoutRef.current) {
        window.clearTimeout(composerGenerationTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!enablePanelCollapse) {
      return undefined;
    }
    const rowElement = panelRowRef.current;
    if (!rowElement) {
      return undefined;
    }

    // Raw, unclamped bottom-lock geometry -- CSS applies min() against
    // --builder-panel-header-offset (see styles.css) so a short panel isn't
    // pushed down by this value; this effect only ever supplies the number
    // a tall panel actually needs. Negative for any panel taller than the
    // viewport (by design: the panel scrolls naturally until its own bottom
    // is bottomGap px above the viewport's bottom edge, then holds there).
    // No scroll listener -- position:sticky owns the actual scroll-driven
    // positioning; this only recomputes the target when the panel's own
    // height or the viewport's height changes.
    const bottomGap = 12;

    function recomputeStickyTop() {
      const panelHeight = rowElement.getBoundingClientRect().height;
      setPanelStickyTop(window.innerHeight - panelHeight - bottomGap);
    }

    recomputeStickyTop();

    const resizeObserver = new ResizeObserver(recomputeStickyTop);
    resizeObserver.observe(rowElement);
    window.addEventListener("resize", recomputeStickyTop);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", recomputeStickyTop);
    };
  }, [enablePanelCollapse]);

  function scrollToRef(ref) {
    ref.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function handleFilterChange(category, value) {
    const nextFilters = {
      ...activeFilters,
      [category]: value,
    };
    setActiveFilters((currentFilters) => ({
      ...currentFilters,
      [category]: value,
    }));
    analytics.track(ANALYTICS_EVENTS.FILTER_CHANGED, {
      category,
      value,
      isCleared: !value,
      resultsCount: getCatalogResultsCount({
        catalog: perfumes,
        notes,
        searchQuery,
        activeFilters: nextFilters,
        sortOption,
      }),
      source: "manual",
    });
  }

  function handleSearchChange(value) {
    setSearchQuery(value);
    analytics.track(ANALYTICS_EVENTS.SEARCH_PERFORMED, {
      queryLength: value.length,
      resultsCount: getCatalogResultsCount({
        catalog: perfumes,
        notes,
        searchQuery: value,
        activeFilters,
        sortOption,
      }),
      activeFilterCount: Object.values(activeFilters).filter(Boolean).length,
      sortOption,
      source: "manual",
    });
  }

  function handleSortChange(value) {
    setSortOption(value);
    analytics.track(ANALYTICS_EVENTS.SORT_CHANGED, {
      sortOption: value,
      resultsCount: getCatalogResultsCount({
        catalog: perfumes,
        notes,
        searchQuery,
        activeFilters,
        sortOption: value,
      }),
      source: "manual",
    });
  }

  function openPerfumeDetails(perfume, source) {
    setDetailPerfume(perfume);
    analytics.track(ANALYTICS_EVENTS.FRAGRANCE_DETAILS_OPENED, {
      perfumeId: perfume.id,
      visibleIndex: visiblePerfumes.findIndex((item) => item.id === perfume.id),
      visibleCount: visiblePerfumes.length,
      source,
    });
  }

  function handleComposerSettingChange(field, value) {
    const nextValue =
      field === "budget" && value !== "" && Number(value) < 0 ? "0" : value;

    if (field === "budget") {
      hasCustomizedComposerBudgetRef.current = true;
    }

    setComposerSettings((currentSettings) => ({
      ...currentSettings,
      [field]: nextValue,
    }));
  }

  // Called right before the Composer setup modal opens. If the customer has
  // never touched the budget field, refresh it to the current completion-aware
  // default rather than leaving whatever was true when the component first
  // mounted — the box may have gained or lost items since then. Once the
  // customer has typed their own value (including clearing it for "no limit"),
  // that choice is preserved and never overwritten here.
  function refreshComposerBudgetDefault() {
    if (hasCustomizedComposerBudgetRef.current) {
      return;
    }

    const completionAwareDefault = deriveDefaultComposerBudget({
      catalog: perfumes,
      missingSlots,
      missingPoints,
      pointValue: builderConfig.commerce.pointValue,
    });
    const freshDefault = Number.isFinite(minimumComposerBudget)
      ? Math.max(completionAwareDefault, minimumComposerBudget)
      : completionAwareDefault;

    setComposerSettings((currentSettings) => ({
      ...currentSettings,
      budget: String(freshDefault),
    }));
  }

  function handleComposerPreferenceToggle(field, value) {
    setComposerSettings((currentSettings) => {
      const currentValues = Array.isArray(currentSettings[field])
        ? currentSettings[field]
        : [];
      const nextValues = currentValues.includes(value)
        ? currentValues.filter((item) => item !== value)
        : [...currentValues, value];

      return {
        ...currentSettings,
        [field]: nextValues,
      };
    });
  }

  function handleComposerPreferenceClear(field) {
    setComposerSettings((currentSettings) => ({
      ...currentSettings,
      [field]: [],
    }));
  }

  function handleComposeMyBox() {
    if (
      isComposerGenerating ||
      isComposerBudgetBelowMinimum(composerBudget, minimumComposerBudget)
    ) {
      return;
    }

    const generationId = composerGenerationIdRef.current + 1;
    const generationStartedAt = nowMs();
    composerGenerationIdRef.current = generationId;
    setComposerStatusMessage("");
    setIsComposerGenerating(true);
    analytics.track(ANALYTICS_EVENTS.COMPOSER_GENERATION_STARTED, {
      requestedBudgetPoints: composerBudget,
      requestedStyle: composerSettings.collectionStyle,
      selectedSeasons: composerSettings.seasons,
      selectedOccasions: composerSettings.occasions,
      selectedVibes: composerSettings.vibes,
      slotCountBefore: selectedPerfumes.length,
      totalPointsBefore: totalPoints,
      source: "composer",
    });
    composerGenerationTimeoutRef.current = window.setTimeout(() => {
      try {
        const nextProposal = buildComposerBoxProposal({
          selectedPerfumes,
          excludedPerfumeIds: [],
          strategy: composerSettings.strategy,
          collectionStyle: composerSettings.collectionStyle,
          budget: composerBudget,
          targetSlots: MAX_SELECTABLE_SLOTS,
          minSlots: MIN_BOX_SLOTS,
          maxSlots: MAX_SELECTABLE_SLOTS,
          seasons: composerSettings.seasons,
          occasions: composerSettings.occasions,
          vibes: composerSettings.vibes,
          catalog: perfumes,
          notes,
          config: builderConfig,
          minimumPoints: composerMinimumPoints,
        });

        if (composerGenerationIdRef.current !== generationId) {
          return;
        }

        setComposerProposal(nextProposal);
        analytics.track(ANALYTICS_EVENTS.COMPOSER_PROPOSAL_GENERATED, {
          requestedBudgetPoints: composerBudget,
          requestedStyle: composerSettings.collectionStyle,
          selectedSeasons: composerSettings.seasons,
          selectedOccasions: composerSettings.occasions,
          selectedVibes: composerSettings.vibes,
          proposalPerfumeIds: nextProposal.collection.map((perfume) => perfume.id),
          proposalSlotCount: nextProposal.collection.length,
          proposalPoints: nextProposal.totalPoints,
          isPartial: !nextProposal.targetReached,
          alternativeCount: getProposalAlternativeCount(nextProposal),
          durationMs: Math.round(nowMs() - generationStartedAt),
          source: "composer",
        });
      } catch (error) {
        if (composerGenerationIdRef.current !== generationId) {
          return;
        }

        if (isDevelopment) {
          console.error(error);
        }

        setComposerProposal(null);
        setComposerStatusMessage(t("app.recoverableActionError"));
        analytics.track(ANALYTICS_EVENTS.COMPOSER_GENERATION_FAILED, {
          errorCategory: "proposal_generation_failed",
          durationMs: Math.round(nowMs() - generationStartedAt),
          source: "composer",
        });
      } finally {
        if (composerGenerationIdRef.current === generationId) {
          setIsComposerGenerating(false);
          composerGenerationTimeoutRef.current = null;
        }
      }
    }, 0);
  }

  function handleCancelComposerProposal() {
    if (composerProposal) {
      analytics.track(ANALYTICS_EVENTS.PROPOSAL_DISMISSED, {
        proposalPerfumeIds: composerProposal.collection.map((perfume) => perfume.id),
        proposalSlotCount: composerProposal.collection.length,
        source: "composer",
      });
    }

    setComposerProposal(null);
  }

  function handleMoveComposerProposalAlternative(slotId, direction) {
    const nextProposal = moveComposerProposalSlotAlternative({
      proposal: composerProposal,
      slotId,
      direction,
    });
    const viewedAlternative = getViewedProposalAlternative(nextProposal, slotId);

    if (viewedAlternative) {
      analytics.track(ANALYTICS_EVENTS.PROPOSAL_ALTERNATIVE_VIEWED, {
        slotId,
        slotIndex: viewedAlternative.slotIndex,
        direction,
        alternativeIndex: viewedAlternative.alternativeIndex,
        alternativeCount: viewedAlternative.alternativeCount,
        perfumeId: viewedAlternative.perfumeId,
        source: "composer",
      });
    }

    setComposerProposal(nextProposal);
  }

  function handleApplyComposerProposal() {
    if (
      !composerProposal?.apply?.available ||
      isComposerBoxProposalStale(composerProposal, composerInputKey)
    ) {
      return;
    }

    const catalogById = new Map(perfumes.map((perfume) => [perfume.id, perfume]));
    const nextSelectedPerfumes = composerProposal.apply.collectionIds
      .map((perfumeId) => catalogById.get(perfumeId))
      .filter(Boolean);

    if (nextSelectedPerfumes.length !== composerProposal.apply.collectionIds.length) {
      return;
    }

    setSelectedPerfumes(nextSelectedPerfumes);
    setComposerProposal(null);
    setActiveMobileTab("box");
    analytics.track(ANALYTICS_EVENTS.PROPOSAL_APPLIED, {
      proposalPerfumeIds: nextSelectedPerfumes.map((perfume) => perfume.id),
      replacedPerfumeIds: selectedPerfumes
        .filter((perfume) => !nextSelectedPerfumes.some((item) => item.id === perfume.id))
        .map((perfume) => perfume.id),
      slotCountAfter: nextSelectedPerfumes.length,
      totalPointsAfter: getTotalPoints(nextSelectedPerfumes),
      source: "composer",
    });
  }

  const addPerfume = (perfume, source = "manual") => {
  const eligibility = canAddPerfume({
    selectedPerfumes,
    perfume,
    maxSelectableSlots: MAX_SELECTABLE_SLOTS,
  });

  if (!eligibility.allowed) {
    return;
  }

  if (perfume.warningMessage) {
    pendingPerfumeSourceRef.current = source;
    setPendingPerfume(perfume);
    return;
  }

  const nextSelectedPerfumes = addSelectedPerfume({
    selectedPerfumes,
    perfume,
    maxSelectableSlots: MAX_SELECTABLE_SLOTS,
  });

  setSelectedPerfumes(nextSelectedPerfumes);
  analytics.track(ANALYTICS_EVENTS.PERFUME_ADDED, {
    perfumeId: perfume.id,
    points: perfume.points,
    source,
    slotCountAfter: nextSelectedPerfumes.length,
    totalPointsAfter: getTotalPoints(nextSelectedPerfumes),
  });
};

const confirmAddPerfume = () => {
  if (!pendingPerfume) return;

  const nextSelectedPerfumes = addSelectedPerfume({
    selectedPerfumes,
    perfume: pendingPerfume,
    maxSelectableSlots: MAX_SELECTABLE_SLOTS,
  });

  setSelectedPerfumes(nextSelectedPerfumes);
  analytics.track(ANALYTICS_EVENTS.PERFUME_ADDED, {
    perfumeId: pendingPerfume.id,
    points: pendingPerfume.points,
    source: pendingPerfumeSourceRef.current,
    slotCountAfter: nextSelectedPerfumes.length,
    totalPointsAfter: getTotalPoints(nextSelectedPerfumes),
  });

  setPendingPerfume(null);
  pendingPerfumeSourceRef.current = "manual";
};

  const cancelAddPerfume = () => {
  setPendingPerfume(null);
  pendingPerfumeSourceRef.current = "manual";
};


  const navigateDetailPerfume = useCallback((direction) => {
    setDetailPerfume((currentPerfume) =>
      getAdjacentVisiblePerfume(currentPerfume, visiblePerfumes, direction)
    );
  }, [visiblePerfumes]);

  useEffect(() => {
    if (!detailPerfume) {
      return undefined;
    }

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        setDetailPerfume(null);
        return;
      }

      if (event.key === "ArrowRight") {
        event.preventDefault();
        navigateDetailPerfume(1);
      }

      if (event.key === "ArrowLeft") {
        event.preventDefault();
        navigateDetailPerfume(-1);
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [detailPerfume, navigateDetailPerfume]);

  useEffect(() => {
    if (!pendingPerfume) {
      return undefined;
    }

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        setPendingPerfume(null);
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [pendingPerfume]);

  function removePerfume(indexToRemove) {
    const perfume = selectedPerfumes[indexToRemove];
    const nextSelectedPerfumes = removeSelectedPerfumeAtIndex({
      selectedPerfumes,
      index: indexToRemove,
    });

    setSelectedPerfumes(nextSelectedPerfumes);

    if (perfume) {
      analytics.track(ANALYTICS_EVENTS.PERFUME_REMOVED, {
        perfumeId: perfume.id,
        source: "manual",
        slotCountAfter: nextSelectedPerfumes.length,
        totalPointsAfter: getTotalPoints(nextSelectedPerfumes),
      });
    }
  }

  function reorderPerfumes(fromIndex, toIndex) {
    setSelectedPerfumes((current) =>
      reorderSelectedPerfumes({
        selectedPerfumes: current,
        fromIndex,
        toIndex,
      })
    );
  }

  function clearBox() {
    if (selectedPerfumes.length === 0) {
      return;
    }

    if (composerGenerationTimeoutRef.current) {
      window.clearTimeout(composerGenerationTimeoutRef.current);
      composerGenerationTimeoutRef.current = null;
    }

    composerGenerationIdRef.current += 1;
    setIsComposerGenerating(false);
    setComposerProposal(null);
    setComposerStatusMessage("");
    setSelectedPerfumes([]);
    setCuratorBonusPreference(builderConfig.curatorBonus.defaultPreference);
    setReviewCustomerInfo(DEFAULT_CUSTOMER_INFO);
    clearStoredBuilderState(builderConfig);
    setRestoreMessage("");
    try {
      analytics.track(ANALYTICS_EVENTS.BOX_CLEARED, {
        slotCountBefore: selectedPerfumes.length,
        totalPointsBefore: totalPoints,
        curatorBonusUnlockedBefore:
          totalPoints >= builderConfig.curatorBonus.targetPoints &&
          totalSlots >= MIN_BOX_SLOTS,
        source: "manual",
      });
    } catch {
      // Analytics must never block clearing the user's box.
    }
  }

  function renderCatalogCard(perfume) {
    const tierData = getTierData(perfume.id);

    return (
      <PerfumeCard
        key={perfume.id}
        perfume={perfume}
        assetResolver={assetResolver}
        tierData={tierData}
        onAddToBox={addPerfume}
        onOpenDetails={(perfume) => openPerfumeDetails(perfume, "manual")}
        isDisabled={totalSlots >= MAX_SELECTABLE_SLOTS}
        labels={{
          add: t("general.add"),
          addToBox: t("general.addToBox"),
          viewDetails: t("details.view"),
        }}
      />
    );
  }

  const boxPanel = (
    <BuilderPanel
      builderConfig={builderConfig}
      assetResolver={assetResolver}
      portalRoot={portalRoot}
      totalSlots={totalSlots}
      maxSlots={MAX_BOX_SLOTS}
      maxSelectableSlots={MAX_SELECTABLE_SLOTS}
      totalPoints={totalPoints}
      estimatedValue={estimatedValue}
      selectedPerfumes={selectedPerfumes}
      catalogPerfumes={perfumes}
      notes={notes}
      boxSummary={boxSummary}
      onClearBox={clearBox}
      onRemovePerfume={removePerfume}
      onReorderPerfumes={reorderPerfumes}
      minSlots={MIN_BOX_SLOTS}
      missingSlots={missingSlots}
      missingPoints={missingPoints}
      coverageSummary={coverageSummary}
      recommendations={recommendations}
      scentDna={scentDna}
      isBoxReady={isBoxReady}
      onAddPerfume={addPerfume}
      composerSettings={composerSettings}
      composerOptions={filterOptions}
      minimumComposerBudget={minimumComposerBudget}
      composerProposal={composerProposal}
      isComposerGenerating={isComposerGenerating}
      composerStatusMessage={composerStatusMessage}
      isComposerProposalStale={isComposerProposalStale}
      onComposerSettingChange={handleComposerSettingChange}
      onRefreshComposerBudgetDefault={refreshComposerBudgetDefault}
      onComposerPreferenceToggle={handleComposerPreferenceToggle}
      onComposerPreferenceClear={handleComposerPreferenceClear}
      onComposeMyBox={handleComposeMyBox}
      onApplyComposerProposal={handleApplyComposerProposal}
      onMoveComposerProposalAlternative={handleMoveComposerProposalAlternative}
      onCancelComposerProposal={handleCancelComposerProposal}
      analytics={analytics}
      finalizationAdapter={finalizationAdapter}
      curatorBonusPreference={curatorBonusPreference}
      onCuratorBonusPreferenceChange={setCuratorBonusPreference}
      reviewCustomerInfo={reviewCustomerInfo}
      onReviewCustomerInfoChange={setReviewCustomerInfo}
      onMobileTabChange={setActiveMobileTab}
      stickySummaryPortalTarget={stickySummaryPortalTarget}
    />
  );

  return (
    <div
      ref={builderRootRef}
      className={builderThemeClassName}
      style={builderThemeStyle}
      data-builder-instance={builderInstanceId}
    >
    <main className="app">
      {restoreMessage && (
        <p className="builder-restore-message" role="status">
          {restoreMessage}
        </p>
      )}

      {showBuilderHero && (
        <section className="hero">
          <h1>{builderConfig.copy.heroTitle}</h1>
          <p>
            {formatConfigCopy(builderConfig.copy.heroDescription, {
              maxSelectableSlots: MAX_SELECTABLE_SLOTS,
            })}
          </p>
        </section>
      )}

      <nav className="mobile-builder-tabs" aria-label={t("app.mobileTabs")}>
        <button
          type="button"
          className={activeMobileTab === "catalog" ? "is-active" : ""}
          onClick={() => setActiveMobileTab("catalog")}
          aria-controls="catalog-panel"
          aria-selected={activeMobileTab === "catalog"}
        >
          {t("app.mobileExploreTab")}
        </button>

        <button
          type="button"
          className={activeMobileTab === "box" ? "is-active" : ""}
          onClick={() => setActiveMobileTab("box")}
          aria-controls="my-box-panel"
          aria-selected={activeMobileTab === "box"}
        >
          {t("general.myBox")} <span>{totalSlots}</span>
        </button>
      </nav>

      <section
        className={`layout${
          enablePanelCollapse
            ? ` layout--panel-collapsible${isPanelCollapsed ? " layout--panel-collapsed" : ""}`
            : ""
        }`}
      >
        <div
          id="catalog-panel"
          className={`mobile-tab-panel ${
            activeMobileTab === "catalog" ? "is-active" : ""
          }`}
        >
          <section className="catalog-section">
            <div className="panel-header">
              <div className="catalog-title-group">
                <h2>{t("general.catalog")}</h2>
                <p>{t("general.perfumesAvailable", { count: visiblePerfumes.length })}</p>
              </div>

              {onCatalogInfoRequest && (
                <div className="panel-header-actions">
                  <button
                    type="button"
                    className="catalog-info-button"
                    aria-label={t("general.catalogInfoAria")}
                    onClick={onCatalogInfoRequest}
                  >
                    i
                  </button>
                </div>
              )}
            </div>

            {hasIntentRecommendations && (
              <section className="intent-recommendations" ref={intentRecommendationsRef}>
                <div className="intent-recommendations__header">
                  <h3>{t("app.intentRecommendationsTitle")}</h3>
                  <div className="intent-recommendations__nav">
                    <button type="button" onClick={() => scrollToRef(intentRecommendationsRef)}>
                      {t("app.intentRecommendationsNav")}
                    </button>
                    <button type="button" onClick={() => scrollToRef(fullCatalogRef)}>
                      {t("app.viewFullCatalogNav", { count: perfumes.length })}
                    </button>
                  </div>
                </div>

                <div className="catalog-grid">
                  {intentRecommendations.map((recommendation) => {
                    const { perfume } = recommendation;
                    const tierData = getTierData(perfume.id);

                    return (
                      <PerfumeCard
                        key={perfume.id}
                        perfume={perfume}
                        assetResolver={assetResolver}
                        tierData={tierData}
                        reason={explainRecommendation?.(recommendation)}
                        onAddToBox={(addedPerfume) => addPerfume(addedPerfume, "intent_recommendation")}
                        onOpenDetails={(perfume) => openPerfumeDetails(perfume, "intent_recommendation")}
                        isDisabled={totalSlots >= MAX_SELECTABLE_SLOTS}
                        labels={{
                          add: t("general.add"),
                          addToBox: t("general.addToBox"),
                          viewDetails: t("details.view"),
                        }}
                      />
                    );
                  })}
                </div>
              </section>
            )}

            <div className="catalog-controls" ref={fullCatalogRef}>
              {hasIntentRecommendations && (
                <div className="intent-recommendations__nav intent-recommendations__nav--catalog">
                  <button type="button" onClick={() => scrollToRef(intentRecommendationsRef)}>
                    {t("app.intentRecommendationsNav")}
                  </button>
                </div>
              )}
              <input
                type="search"
                value={searchQuery}
                onChange={(event) => handleSearchChange(event.target.value)}
                placeholder={t("app.searchPlaceholder")}
              />
            </div>

            <FilterBar
              translator={translator}
              filterOptions={filterOptions}
              activeFilters={activeFilters}
              handleFilterChange={handleFilterChange}
              sortOption={sortOption}
              setSortOption={handleSortChange}
            />

            <div className="catalog-grid">
              {visiblePerfumes.map(renderCatalogCard)}
            </div>
          </section>
        </div>

        <div
          id="my-box-panel"
          className={`mobile-tab-panel ${
            activeMobileTab === "box" ? "is-active" : ""
          }`}
        >
          {enablePanelCollapse ? (
            <div
              ref={panelRowRef}
              className="builder-panel-collapsible-row"
              style={{ "--builder-panel-sticky-top": `${panelStickyTop}px` }}
            >
              <button
                type="button"
                className="builder-panel-collapse-rail"
                onClick={() => setIsPanelCollapsed((collapsed) => !collapsed)}
                aria-expanded={!isPanelCollapsed}
                aria-label={
                  isPanelCollapsed ? t("builder.expandPanel") : t("builder.collapsePanel")
                }
              >
                <span aria-hidden="true">{isPanelCollapsed ? "◂" : "▸"}</span>
              </button>

              <div className="builder-panel-column" inert={isPanelCollapsed}>
                {boxPanel}
              </div>
            </div>
          ) : (
            boxPanel
          )}
        </div>
      </section>
    </main>
    {detailPerfume && (
      <PerfumeDetailsModal
        key={detailPerfume.id}
        builderConfig={builderConfig}
        assetResolver={assetResolver}
        perfume={detailPerfume}
        notes={notes}
        portalRoot={portalRoot}
        tierData={getTierData(detailPerfume.id)}
        isAddDisabled={
          totalSlots >= MAX_SELECTABLE_SLOTS ||
          selectedPerfumes.some((perfume) => perfume.id === detailPerfume.id)
        }
        addButtonLabel={
          selectedPerfumes.some((perfume) => perfume.id === detailPerfume.id)
            ? t("general.added")
            : totalSlots >= MAX_SELECTABLE_SLOTS
              ? t("general.boxFull")
              : t("general.addToBox")
        }
        translator={translator}
        onAddToBox={addPerfume}
        onPrevious={() => navigateDetailPerfume(-1)}
        onNext={() => navigateDetailPerfume(1)}
        previousPerfume={previousDetailPerfume}
        nextPerfume={nextDetailPerfume}
        canNavigate={canNavigateDetails}
        onClose={() => setDetailPerfume(null)}
      />
    )}
    {pendingPerfume && (
  <div className="modal-overlay" onClick={cancelAddPerfume}>
    <div
      className="warning-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="rare-selection-title"
      onClick={(event) => event.stopPropagation()}
    >
      <h2>Rare Selection</h2>

      <h3 id="rare-selection-title">{pendingPerfume.name}</h3>

      <p>{pendingPerfume.warningMessage}</p>

      <p className="warning-footer">
      ☠ Proceed with caution.
      </p>

      <div className="modal-actions">
        <button type="button" onClick={confirmAddPerfume}>
          {t("general.addToBox")}
        </button>

        <button type="button" onClick={cancelAddPerfume}>
          {t("general.cancel")}
        </button>
      </div>
    </div>
  </div>
)}
    </div>
  );
}

function formatConfigCopy(template, values = {}) {
  return Object.entries(values).reduce(
    (copy, [key, value]) => copy.replaceAll(`{${key}}`, String(value)),
    template
  );
}

function loadPersistedBuilderState({ builderConfig, perfumes, defaultBuilderState }) {
  return loadPersistedBuilderStateFromStorage({
    storage: getBuilderStorage(),
    storageKey: builderConfig.persistence.storageKey,
    catalog: perfumes,
    config: builderConfig,
    defaultBuilderState,
  });
}

function parseComposerBudget(value) {
  if (value === "" || value === null || value === undefined) {
    return null;
  }

  const parsedValue = Number(value);
  return Number.isFinite(parsedValue) ? parsedValue : null;
}

function deriveMinimumComposerBudget({ catalog, minSlots, pointValue }) {
  const minimumPerfumePoints = (Array.isArray(catalog) ? catalog : [])
    .map((perfume) => perfume?.points)
    .filter((points) => Number.isFinite(points) && points > 0)
    .sort((first, second) => first - second)[0];

  if (
    !Number.isFinite(minimumPerfumePoints) ||
    !Number.isFinite(minSlots) ||
    !Number.isFinite(pointValue)
  ) {
    return "";
  }

  return Math.round(minimumPerfumePoints * minSlots * pointValue);
}

function getCatalogResultsCount({ catalog, notes, searchQuery, activeFilters, sortOption }) {
  return buildCatalogView({
    catalog,
    notes,
    searchQuery,
    activeFilters,
    sortOption,
  }).visiblePerfumes.length;
}

function getTotalPoints(perfumes) {
  return perfumes.reduce((sum, perfume) => sum + perfume.points, 0);
}

function getProposalAlternativeCount(proposal) {
  return (proposal.slotAlternatives || []).reduce(
    (count, slot) => count + Math.max(0, (slot.alternatives || []).length - 1),
    0
  );
}

function getViewedProposalAlternative(proposal, slotId) {
  const slot = (proposal?.slotAlternatives || []).find((item) => item.slotId === slotId);

  if (!slot) {
    return null;
  }

  const alternativeIndex = slot.selectedAlternativeIndex || 0;
  const alternative = slot.alternatives?.[alternativeIndex];

  return {
    slotIndex: slot.slotIndex,
    alternativeIndex,
    alternativeCount: slot.alternatives?.length || 0,
    perfumeId: alternative?.perfume?.id,
  };
}

function nowMs() {
  if (typeof performance !== "undefined" && typeof performance.now === "function") {
    return performance.now();
  }

  return Date.now();
}

function isComposerBudgetBelowMinimum(budget, minimumBudget) {
  return (
    Number.isFinite(budget) &&
    Number.isFinite(minimumBudget) &&
    budget < minimumBudget
  );
}

function markFragranceDetailsHintSeen(builderConfig) {
  try {
    window.localStorage.setItem(builderConfig.persistence.fragranceDetailsHintKey, "true");
  } catch {
    // The hint is decorative; storage failures should not affect browsing.
  }
}

function saveStoredBuilderState(value, builderConfig) {
  savePersistedBuilderState({
    storage: getBuilderStorage(),
    storageKey: builderConfig.persistence.storageKey,
    value,
  });
}

function clearStoredBuilderState(builderConfig) {
  clearPersistedBuilderState({
    storage: getBuilderStorage(),
    storageKey: builderConfig.persistence.storageKey,
  });
}

function getBuilderStorage() {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function PerfumeDetailsModal({
  builderConfig,
  assetResolver,
  translator,
  perfume,
  notes,
  portalRoot,
  tierData,
  isAddDisabled,
  addButtonLabel,
  onAddToBox,
  onPrevious,
  onNext,
  previousPerfume,
  nextPerfume,
  canNavigate,
  onClose,
}) {
  const t = translator?.t || ((key) => key);
  const touchStartRef = useRef(null);
  const touchCurrentRef = useRef(null);
  const swipeFeedbackTimeoutRef = useRef(null);
  const addFeedbackTimeoutRef = useRef(null);
  const [swipeFeedback, setSwipeFeedback] = useState("");
  const [addFeedback, setAddFeedback] = useState("");
  const [showNavigationHint, setShowNavigationHint] = useState(() => {
    try {
      if (typeof window === "undefined" || !window.localStorage) {
        return true;
      }

      return window.localStorage.getItem(builderConfig.persistence.fragranceDetailsHintKey) !== "true";
    } catch {
      return true;
    }
  });
  const usesGeneralNotes = (perfume.generalNotes || []).length > 0;
  const hasPyramidNotes =
    (perfume.topNotes || []).length > 0 ||
    (perfume.middleNotes || []).length > 0 ||
    (perfume.baseNotes || []).length > 0;
  const brandAssetKey = brandAssets[perfume.brand] || "";
  const brandAsset = brandAssetKey ? assetResolver(brandAssetKey) : "";
  const perfumeImageFallback = perfume.imageFallback;

  useEffect(() => {
    return () => {
      if (swipeFeedbackTimeoutRef.current) {
        window.clearTimeout(swipeFeedbackTimeoutRef.current);
      }

      if (addFeedbackTimeoutRef.current) {
        window.clearTimeout(addFeedbackTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!showNavigationHint) {
      return undefined;
    }

    const hintSeenTimer = window.setTimeout(() => {
      markFragranceDetailsHintSeen(builderConfig);
    }, 800);
    const hintRemovalTimer = window.setTimeout(() => {
      setShowNavigationHint(false);
    }, 2800);

    return () => {
      window.clearTimeout(hintSeenTimer);
      window.clearTimeout(hintRemovalTimer);
    };
  }, [builderConfig, showNavigationHint]);

  function showSwipeFeedback(direction) {
    if (swipeFeedbackTimeoutRef.current) {
      window.clearTimeout(swipeFeedbackTimeoutRef.current);
    }

    setSwipeFeedback(direction);
    swipeFeedbackTimeoutRef.current = window.setTimeout(() => {
      setSwipeFeedback("");
    }, 180);
  }

  function handleTouchStart(event) {
    const touch = event.touches[0];

    touchStartRef.current = {
      x: touch.clientX,
      y: touch.clientY,
    };
    touchCurrentRef.current = touchStartRef.current;
  }

  function handleTouchMove(event) {
    if (!touchStartRef.current) {
      return;
    }

    const touch = event.touches[0];
    touchCurrentRef.current = {
      x: touch.clientX,
      y: touch.clientY,
    };
  }

  function handleTouchEnd() {
    if (!touchStartRef.current || !touchCurrentRef.current || !canNavigate) {
      touchStartRef.current = null;
      touchCurrentRef.current = null;
      return;
    }

    const deltaX = touchCurrentRef.current.x - touchStartRef.current.x;
    const deltaY = touchCurrentRef.current.y - touchStartRef.current.y;
    const absX = Math.abs(deltaX);
    const absY = Math.abs(deltaY);
    const isHorizontalSwipe = absX >= 56 && absX > absY * 1.25;

    touchStartRef.current = null;
    touchCurrentRef.current = null;

    if (!isHorizontalSwipe) {
      return;
    }

    if (deltaX < 0) {
      showSwipeFeedback("next");
      onNext();
      return;
    }

    showSwipeFeedback("previous");
    onPrevious();
  }

  function handleAddToBox() {
    if (isAddDisabled) {
      return;
    }

    onAddToBox(perfume);

    if (perfume.warningMessage) {
      return;
    }

    if (addFeedbackTimeoutRef.current) {
      window.clearTimeout(addFeedbackTimeoutRef.current);
    }

    setAddFeedback(t("details.addedFeedback"));
    addFeedbackTimeoutRef.current = window.setTimeout(() => {
      setAddFeedback("");
    }, 1600);
  }

  function handleClose() {
    markFragranceDetailsHintSeen(builderConfig);
    onClose();
  }

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div
        className={`perfume-details-modal ${
          swipeFeedback ? `is-swipe-${swipeFeedback}` : ""
        }`}
        onClick={(event) => event.stopPropagation()}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={() => {
          touchStartRef.current = null;
          touchCurrentRef.current = null;
        }}
      >
        <div className="modal-header">
          <button
            type="button"
            className="perfume-details-close"
            onClick={handleClose}
            aria-label={t("details.close")}
          >
            X
          </button>

          <div className="perfume-details-title">
            <h3>{perfume.name}</h3>
            <p>{perfume.brand}</p>
          </div>

        </div>

        <div className="perfume-details-meta">
          <div
            className="tier-badge"
            style={{
              borderColor: tierData.color,
              backgroundColor: tierData.background,
              color: tierData.color,
            }}
          >
            <span>{tierData.emoji}</span>
            {tierData.name}
          </div>

          <strong>{perfume.points} pt</strong>

          <button
            className="perfume-details-meta-add"
            onClick={handleAddToBox}
            disabled={isAddDisabled}
          >
            {addButtonLabel}
          </button>
        </div>

        <div className={`perfume-details-add-feedback ${addFeedback ? "is-visible" : ""}`} role="status">
          {addFeedback}
        </div>

        {perfume.image && (
          <>
            <div className="perfume-details-image-panel">
              <div className="perfume-details-image-stage">
                {brandAsset && (
                  <span className="perfume-details-brand-badge" aria-hidden="true">
                    <img
                      src={brandAsset}
                      alt=""
                      loading="lazy"
                      onError={(event) => {
                        event.currentTarget.closest(".perfume-details-brand-badge")?.remove();
                      }}
                    />
                  </span>
                )}

                <button
                  type="button"
                  className="perfume-image-nav previous"
                  onClick={onPrevious}
                  disabled={!canNavigate}
                  title={
                    previousPerfume
                      ? t("details.previousTitle", { name: previousPerfume.name })
                      : t("details.previousFallback")
                  }
                  aria-label={t("details.previous")}
                >
                  &lt;
                </button>
                <img
                  src={perfume.image}
                  alt={t("details.bottleAlt", { name: perfume.name })}
                  onError={(event) => {
                    event.currentTarget.onerror = null;
                    event.currentTarget.src = perfumeImageFallback;
                  }}
                />
                <button
                  type="button"
                  className="perfume-image-nav next"
                  onClick={onNext}
                  disabled={!canNavigate}
                  title={nextPerfume ? t("details.nextTitle", { name: nextPerfume.name }) : t("details.nextFallback")}
                  aria-label={t("details.next")}
                >
                  &gt;
                </button>

                {showNavigationHint && (
                  <p className="perfume-details-nav-hint">
                    <span className="nav-hint-desktop">
                      {t("details.navHintDesktop")}
                    </span>
                    <span className="nav-hint-mobile">{t("details.navHintMobile")}</span>
                  </p>
                )}
              </div>
            </div>
          </>
        )}

        <section className="perfume-details-section">
          <h4>{t("details.profile")}</h4>

          <DetailTagGroup assetResolver={assetResolver} translator={translator} label={t("details.seasons")} values={perfume.seasons || []} assetType="seasons" />
          <DetailTagGroup assetResolver={assetResolver} translator={translator} label={t("details.occasions")} values={perfume.occasions || []} assetType="occasions" />
          <DetailTagGroup assetResolver={assetResolver} translator={translator} label={t("details.vibes")} values={perfume.vibes || []} assetType="vibes" />
        </section>

        <section className="perfume-details-section">
          <h4>{t("details.accords")}</h4>
          <DetailTagGroup assetResolver={assetResolver} translator={translator} values={perfume.accords || []} assetType="accords" />
        </section>

        <section className="perfume-details-section">
          <h4>{t("details.notes")}</h4>

          {usesGeneralNotes ? (
            <DetailNoteGroup
              title={t("details.generalNotes")}
              noteIds={perfume.generalNotes || []}
              notes={notes}
              translator={translator}
              portalRoot={portalRoot}
            />
          ) : hasPyramidNotes ? (
            <>
              <DetailNoteGroup
                title={t("details.topNotes")}
                noteIds={perfume.topNotes || []}
                notes={notes}
                translator={translator}
                portalRoot={portalRoot}
              />
              <DetailNoteGroup
                title={t("details.middleNotes")}
                noteIds={perfume.middleNotes || []}
                notes={notes}
                translator={translator}
                portalRoot={portalRoot}
              />
              <DetailNoteGroup
                title={t("details.baseNotes")}
                noteIds={perfume.baseNotes || []}
                notes={notes}
                translator={translator}
                portalRoot={portalRoot}
              />
            </>
          ) : (
            <p className="details-empty">{t("details.noNotes")}</p>
          )}
        </section>

      </div>
    </div>
  );
}

function DetailTagGroup({ assetResolver, translator, label, values, assetType }) {
  const t = translator?.t || ((key) => key);
  return (
    <div className="detail-profile-group">
      {label && <span>{label}</span>}

      <div className="details-tag-row">
        {values.length > 0 ? (
          values.map((value) => (
            <DetailMetadataChip key={value} assetResolver={assetResolver} translator={translator} value={value} assetType={assetType} />
          ))
        ) : (
          <p>{t("details.noData")}</p>
        )}
      </div>
    </div>
  );
}

function DetailMetadataChip({ assetResolver, translator, value, assetType }) {
  const assetKey = assetType ? metadataAssets[assetType]?.[value] || null : null;
  const asset = assetKey ? assetResolver(assetKey) : null;
  const displayValue = translator?.label?.(assetType, value) || value;

  if (!asset) {
    return <span>{displayValue}</span>;
  }

  return (
    <span className="detail-asset-chip" tabIndex={0}>
      <img
        src={asset}
        alt=""
        loading="lazy"
        onError={(event) => {
          event.currentTarget.remove();
          event.currentTarget.parentElement?.classList.remove("detail-asset-chip");
        }}
      />
      <span>{displayValue}</span>
    </span>
  );
}

function DetailNoteGroup({ title, noteIds, notes, translator, portalRoot }) {
  if (noteIds.length === 0) {
    return null;
  }

  return (
    <div className="detail-note-group">
      <span>{title}</span>

      <div className="details-tag-row">
        {noteIds.map((noteId) => (
          <DetailNotePill
            key={noteId}
            note={notes[noteId]}
            noteId={noteId}
            translator={translator}
            portalRoot={portalRoot}
          />
        ))}
      </div>
    </div>
  );
}

function DetailNotePill({ note, noteId, translator, portalRoot }) {
  // Note display names resolve through the same shared taxonomy label lookup
  // already used for accords/seasons/occasions/vibes (see
  // DetailMetadataChip), keyed by the note's canonical id -- this package
  // carries no note/accord vocabulary of its own, just the lookup mechanism
  // and its fallback. A host can supply its own display labels via
  // createBuilderConfig's `taxonomyLabels`; absent that, `label()`'s third
  // argument gives it the note's own catalog name (already good English)
  // as the fallback, instead of the raw camelCase id.
  const noteFallback = note?.name || formatLabel(noteId);
  const noteName = translator?.label?.("notes", noteId, noteFallback) || noteFallback;
  const noteImage = note?.noteImage;

  if (!noteImage) {
    return <span>{noteName}</span>;
  }

  return (
    <MetadataPreview title={noteName} image={noteImage} portalRoot={portalRoot}>
      <span className="detail-note-pill has-note-image">
        <img
          src={noteImage}
          alt=""
          loading="lazy"
          onError={(event) => {
            event.currentTarget.remove();
          }}
        />
        <span>{noteName}</span>
      </span>
    </MetadataPreview>
  );
}

function getAdjacentVisiblePerfume(currentPerfume, visiblePerfumes, direction) {
  if (!currentPerfume || visiblePerfumes.length === 0) {
    return currentPerfume;
  }

  const currentIndex = visiblePerfumes.findIndex(
    (perfume) => perfume.id === currentPerfume.id
  );

  if (currentIndex === -1) {
    return direction > 0
      ? visiblePerfumes[0]
      : visiblePerfumes[visiblePerfumes.length - 1];
  }

  const nextIndex =
    (currentIndex + direction + visiblePerfumes.length) %
    visiblePerfumes.length;

  return visiblePerfumes[nextIndex];
}

function formatLabel(value) {
  return value
    .split(/(?=[A-Z])|[-_\s]/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export default App;
