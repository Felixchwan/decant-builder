import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "./App.css";
import { getTierData } from "./utils/tierUtils";
import PerfumeCard from "./components/PerfumeCard";
import FilterBar from "./components/FilterBar";
import BuilderPanel from "./components/BuilderPanel";
import MetadataPreview from "./components/MetadataPreview";
import { buildScentDna } from "./utils/buildScentDna";
import { buildCatalogView } from "./builder/internal/catalog/buildCatalogView.js";
import { buildCollectionSummary } from "./builder/internal/intelligence/buildCollectionSummary.js";
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
import { buildComposerRecommendations } from "./builder/internal/recommendations/buildComposerRecommendations.js";
import { getMetadataAsset } from "./data/metadataAssets";
import { getBrandAsset } from "./data/brandAssets";
import { createTranslator } from "./i18n/createTranslator.js";
import {
  addSelectedPerfume,
  canAddPerfume,
  removeSelectedPerfumeAtIndex,
  reorderSelectedPerfumes,
} from "./builder/internal/selection/selectionState.js";

const PERFUME_IMAGE_FALLBACK =
  "/images/perfumes/placeholders/perfume-placeholder.svg";
const EMPTY_NOTES = {};

function App({ catalog, notes: noteMetadata = EMPTY_NOTES, config }) {
  const builderConfig = config;
  const translator = useMemo(
    () => createTranslator(builderConfig.locale),
    [builderConfig.locale]
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
  const [selectedPerfumes, setSelectedPerfumes] = useState(
    persistedBuilderState.selectedPerfumes
  );
  const [curatorBonusPreference, setCuratorBonusPreference] = useState(
    persistedBuilderState.curatorBonusPreference
  );
  const [reviewCustomerInfo, setReviewCustomerInfo] = useState(
    persistedBuilderState.customerInfo
  );
  const [restoreMessage, setRestoreMessage] = useState(
    persistedBuilderState.wasRestored ? builderConfig.persistence.restoreMessage : ""
  );
  const [activeMobileTab, setActiveMobileTab] = useState("catalog");
  const [activeFilters, setActiveFilters] = useState({
    seasons: "",
    occasions: "",
    vibes: "",
  });
  const [composerSettings, setComposerSettings] = useState({
    strategy: "balanced",
    collectionStyle: "balanced_mix",
    budget: String(minimumComposerBudget),
    seasons: [],
    occasions: [],
    vibes: [],
  });
  const [composerProposal, setComposerProposal] = useState(null);
  const [isComposerGenerating, setIsComposerGenerating] = useState(false);
  const [composerStatusMessage, setComposerStatusMessage] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortOption, setSortOption] = useState("bestMatch");
  const [pendingPerfume, setPendingPerfume] = useState(null);
  const [detailPerfume, setDetailPerfume] = useState(null);
  const composerGenerationTimeoutRef = useRef(null);
  const composerGenerationIdRef = useRef(0);

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
const composerBudget = parseComposerBudget(composerSettings.budget);
const composerInputKey = useMemo(
  () =>
    buildComposerProposalInputKey({
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
      config: builderConfig,
    }),
  [
    selectedPerfumes,
    composerSettings,
    composerBudget,
    MAX_SELECTABLE_SLOTS,
    MIN_BOX_SLOTS,
    perfumes,
    builderConfig,
  ]
);
const isComposerProposalStale = isComposerBoxProposalStale(
  composerProposal,
  composerInputKey
);

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

  function handleFilterChange(category, value) {
    setActiveFilters((currentFilters) => ({
      ...currentFilters,
      [category]: value,
    }));
  }

  function handleComposerSettingChange(field, value) {
    const nextValue =
      field === "budget" && value !== "" && Number(value) < 0 ? "0" : value;

    setComposerSettings((currentSettings) => ({
      ...currentSettings,
      [field]: nextValue,
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
    composerGenerationIdRef.current = generationId;
    setComposerStatusMessage("");
    setIsComposerGenerating(true);
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
        });

        if (composerGenerationIdRef.current !== generationId) {
          return;
        }

        setComposerProposal(nextProposal);
      } catch (error) {
        if (composerGenerationIdRef.current !== generationId) {
          return;
        }

        if (import.meta.env.DEV) {
          console.error(error);
        }

        setComposerProposal(null);
        setComposerStatusMessage(t("app.recoverableActionError"));
      } finally {
        if (composerGenerationIdRef.current === generationId) {
          setIsComposerGenerating(false);
          composerGenerationTimeoutRef.current = null;
        }
      }
    }, 0);
  }

  function handleCancelComposerProposal() {
    setComposerProposal(null);
  }

  function handleMoveComposerProposalAlternative(slotId, direction) {
    setComposerProposal((currentProposal) =>
      moveComposerProposalSlotAlternative({
        proposal: currentProposal,
        slotId,
        direction,
      })
    );
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
  }

  const addPerfume = (perfume) => {
  const eligibility = canAddPerfume({
    selectedPerfumes,
    perfume,
    maxSelectableSlots: MAX_SELECTABLE_SLOTS,
  });

  if (!eligibility.allowed) {
    return;
  }

  if (perfume.warningMessage) {
    setPendingPerfume(perfume);
    return;
  }

  setSelectedPerfumes((prev) =>
    addSelectedPerfume({
      selectedPerfumes: prev,
      perfume,
      maxSelectableSlots: MAX_SELECTABLE_SLOTS,
    })
  );
};

const confirmAddPerfume = () => {
  if (!pendingPerfume) return;

  setSelectedPerfumes((prev) =>
    addSelectedPerfume({
      selectedPerfumes: prev,
      perfume: pendingPerfume,
      maxSelectableSlots: MAX_SELECTABLE_SLOTS,
    })
  );

  setPendingPerfume(null);
};

  const cancelAddPerfume = () => {
  setPendingPerfume(null);
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
    setSelectedPerfumes((current) =>
      removeSelectedPerfumeAtIndex({
        selectedPerfumes: current,
        index: indexToRemove,
      })
    );
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
  }

  return (
    <>
    <main className="app">
      {restoreMessage && (
        <p className="builder-restore-message" role="status">
          {restoreMessage}
        </p>
      )}

      <section className="hero">
        <h1>{builderConfig.copy.heroTitle}</h1>
        <p>
          {formatConfigCopy(builderConfig.copy.heroDescription, {
            maxSelectableSlots: MAX_SELECTABLE_SLOTS,
          })}
        </p>
      </section>

      <nav className="mobile-builder-tabs" aria-label={t("app.mobileTabs")}>
        <button
          type="button"
          className={activeMobileTab === "catalog" ? "is-active" : ""}
          onClick={() => setActiveMobileTab("catalog")}
          aria-controls="catalog-panel"
          aria-selected={activeMobileTab === "catalog"}
        >
          {t("general.catalog")}
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

      <section className="layout">
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
            </div>

            <div className="catalog-controls">
              <input
                type="search"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder={t("app.searchPlaceholder")}
              />
            </div>

            <FilterBar
              translator={translator}
              filterOptions={filterOptions}
              activeFilters={activeFilters}
              handleFilterChange={handleFilterChange}
              sortOption={sortOption}
              setSortOption={setSortOption}
            />

            <div className="catalog-grid">
              {visiblePerfumes.map((perfume) => {
                const tierData = getTierData(perfume.id);

                return (
                  <PerfumeCard
                    key={perfume.id}
                    perfume={perfume}
                    tierData={tierData}
                    onAddToBox={addPerfume}
                    onOpenDetails={setDetailPerfume}
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
        </div>

        <div
          id="my-box-panel"
          className={`mobile-tab-panel ${
            activeMobileTab === "box" ? "is-active" : ""
          }`}
        >
          <BuilderPanel
            builderConfig={builderConfig}
            totalSlots={totalSlots}
            maxSlots={MAX_BOX_SLOTS}
            maxSelectableSlots={MAX_SELECTABLE_SLOTS}
            totalPoints={totalPoints}
            estimatedValue={estimatedValue}
            selectedPerfumes={selectedPerfumes}
            catalogPerfumes={perfumes}
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
            onComposerPreferenceToggle={handleComposerPreferenceToggle}
            onComposerPreferenceClear={handleComposerPreferenceClear}
            onComposeMyBox={handleComposeMyBox}
            onApplyComposerProposal={handleApplyComposerProposal}
            onMoveComposerProposalAlternative={handleMoveComposerProposalAlternative}
            onCancelComposerProposal={handleCancelComposerProposal}
            curatorBonusPreference={curatorBonusPreference}
            onCuratorBonusPreferenceChange={setCuratorBonusPreference}
            reviewCustomerInfo={reviewCustomerInfo}
            onReviewCustomerInfoChange={setReviewCustomerInfo}
          />
        </div>
      </section>
    </main>
    {detailPerfume && (
      <PerfumeDetailsModal
        key={detailPerfume.id}
        builderConfig={builderConfig}
        perfume={detailPerfume}
        notes={notes}
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
    </>
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

function formatConfigCopy(template, values = {}) {
  return Object.entries(values).reduce(
    (copy, [key, value]) => copy.replaceAll(`{${key}}`, String(value)),
    template
  );
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
  translator,
  perfume,
  notes,
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
  const brandAsset = getBrandAsset(perfume.brand);

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
                    event.currentTarget.src = PERFUME_IMAGE_FALLBACK;
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

          <DetailTagGroup translator={translator} label={t("details.seasons")} values={perfume.seasons || []} assetType="seasons" />
          <DetailTagGroup translator={translator} label={t("details.occasions")} values={perfume.occasions || []} assetType="occasions" />
          <DetailTagGroup translator={translator} label={t("details.vibes")} values={perfume.vibes || []} assetType="vibes" />
        </section>

        <section className="perfume-details-section">
          <h4>{t("details.accords")}</h4>
          <DetailTagGroup translator={translator} label={t("details.accords")} values={perfume.accords || []} assetType="accords" />
        </section>

        <section className="perfume-details-section">
          <h4>{t("details.notes")}</h4>

          {usesGeneralNotes ? (
            <DetailNoteGroup
              title={t("details.generalNotes")}
              noteIds={perfume.generalNotes || []}
              notes={notes}
            />
          ) : hasPyramidNotes ? (
            <>
              <DetailNoteGroup
                title={t("details.topNotes")}
                noteIds={perfume.topNotes || []}
                notes={notes}
              />
              <DetailNoteGroup
                title={t("details.middleNotes")}
                noteIds={perfume.middleNotes || []}
                notes={notes}
              />
              <DetailNoteGroup
                title={t("details.baseNotes")}
                noteIds={perfume.baseNotes || []}
                notes={notes}
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

function DetailTagGroup({ translator, label, values, assetType }) {
  const t = translator?.t || ((key) => key);
  return (
    <div className="detail-profile-group">
      <span>{label}</span>

      <div className="details-tag-row">
        {values.length > 0 ? (
          values.map((value) => (
            <DetailMetadataChip key={value} translator={translator} value={value} assetType={assetType} />
          ))
        ) : (
          <p>{t("details.noData")}</p>
        )}
      </div>
    </div>
  );
}

function DetailMetadataChip({ translator, value, assetType }) {
  const asset = assetType ? getMetadataAsset(assetType, value) : null;
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

function DetailNoteGroup({ title, noteIds, notes }) {
  if (noteIds.length === 0) {
    return null;
  }

  return (
    <div className="detail-note-group">
      <span>{title}</span>

      <div className="details-tag-row">
        {noteIds.map((noteId) => (
          <DetailNotePill key={noteId} note={notes[noteId]} noteId={noteId} />
        ))}
      </div>
    </div>
  );
}

function DetailNotePill({ note, noteId }) {
  const noteName = note?.name || formatLabel(noteId);
  const noteImage = note?.noteImage || note?.image;

  if (!noteImage) {
    return <span>{noteName}</span>;
  }

  return (
    <MetadataPreview title={noteName} image={noteImage}>
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
