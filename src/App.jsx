import { useEffect, useMemo, useRef, useState } from "react";
import { perfumes } from "./data/perfumes";
import { buildFilterOptions } from "./utils/filterUtils";
import { notes } from "./data/notes";
import "./App.css";
import { getTierData } from "./utils/tierUtils";
import PerfumeCard from "./components/PerfumeCard";
import FilterBar from "./components/FilterBar";
import BuilderPanel from "./components/BuilderPanel";
import MetadataPreview from "./components/MetadataPreview";
import { buildBoxSummary } from "./utils/buildBoxSummary";
import { getPerfumeNoteIds } from "./utils/noteUtils";
import { buildCoverageSummary } from "./utils/buildCoverageSummary";
import { buildScentDna } from "./utils/buildScentDna";
import { buildRecommendations } from "./utils/buildRecommendations";
import { getMetadataAsset } from "./data/metadataAssets";
import { getBrandAsset } from "./data/brandAssets";
import {
  MIN_BOX_SLOTS,
  MAX_BOX_SLOTS,
  MAX_SELECTABLE_SLOTS,
  MIN_BOX_POINTS,
  BASE_DECANTS,
  POINT_VALUE,
} from "./constants/boxRules";

const PERFUME_IMAGE_FALLBACK =
  "/images/perfumes/placeholders/perfume-placeholder.svg";
const FRAGRANCE_DETAILS_HINT_KEY = "fragranceDetailsHintSeen";
const BUILDER_STORAGE_KEY = "decant-builder-v1";
const DEFAULT_CUSTOMER_INFO = {
  name: "",
  city: "",
  notes: "",
};
const DEFAULT_BUILDER_STATE = {
  selectedPerfumeIds: [],
  curatorBonusPreference: "complement",
  customerInfo: DEFAULT_CUSTOMER_INFO,
};

function App() {
  const persistedBuilderState = useMemo(() => loadPersistedBuilderState(), []);
  const [selectedPerfumes, setSelectedPerfumes] = useState(() =>
    hydratePersistedPerfumes(persistedBuilderState.selectedPerfumeIds)
  );
  const [curatorBonusPreference, setCuratorBonusPreference] = useState(
    persistedBuilderState.curatorBonusPreference
  );
  const [reviewCustomerInfo, setReviewCustomerInfo] = useState(
    persistedBuilderState.customerInfo
  );
  const [restoreMessage, setRestoreMessage] = useState(
    persistedBuilderState.wasRestored ? "Your previous box has been restored." : ""
  );
  const [activeMobileTab, setActiveMobileTab] = useState("catalog");
  const [activeFilters, setActiveFilters] = useState({
    seasons: "",
    occasions: "",
    vibes: "",
  });
  const [searchQuery, setSearchQuery] = useState("");
  const [sortOption, setSortOption] = useState("bestMatch");
  const [pendingPerfume, setPendingPerfume] = useState(null);
  const [detailPerfume, setDetailPerfume] = useState(null);

  const totalSlots = selectedPerfumes.length;
  const totalPoints = selectedPerfumes.reduce(
    (sum, perfume) => sum + perfume.points,
    0
  );

  const estimatedValue = totalPoints * POINT_VALUE;
  const baseValue = BASE_DECANTS * POINT_VALUE;
  const upgradeValue = Math.max(0, estimatedValue - baseValue);
  const missingSlots = Math.max(0, MIN_BOX_SLOTS - totalSlots);
  const missingPoints = Math.max(0, MIN_BOX_POINTS - totalPoints);
  const isBoxReady = missingSlots === 0 && missingPoints === 0;
  const filterOptions = useMemo(() => buildFilterOptions(perfumes), []);

  const visiblePerfumes = useMemo(() => {
    const normalizedSearchQuery = searchQuery.trim().toLowerCase();
    const matchingPerfumes = perfumes.filter((perfume) => {
      const matchesSeason =
        !activeFilters.seasons ||
        perfume.seasons.includes(activeFilters.seasons);

      const matchesOccasion =
        !activeFilters.occasions ||
        perfume.occasions.includes(activeFilters.occasions);

      const matchesVibe =
        !activeFilters.vibes || perfume.vibes.includes(activeFilters.vibes);

      const matchesSearch =
        !normalizedSearchQuery ||
        getSearchText(perfume, notes).includes(normalizedSearchQuery);

      return matchesSeason && matchesOccasion && matchesVibe && matchesSearch;
    });

    return sortPerfumes(matchingPerfumes, sortOption, normalizedSearchQuery);
  }, [activeFilters, searchQuery, sortOption]);

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

const boxSummary = useMemo(() => {
  return buildBoxSummary(selectedPerfumes, notes);
}, [selectedPerfumes]);
const coverageSummary = useMemo(() => {
  return buildCoverageSummary(boxSummary, perfumes);
}, [boxSummary]);
const scentDna = useMemo(() => {
  return buildScentDna(selectedPerfumes, boxSummary);
}, [selectedPerfumes, boxSummary]);
const recommendations = useMemo(() => {
  return buildRecommendations({
    perfumes,
    selectedPerfumes,
    boxSummary,
    coverageSummary,
    scentDna,
  });
}, [selectedPerfumes, boxSummary, coverageSummary, scentDna]);

  useEffect(() => {
    const persistedState = {
      version: 1,
      selectedPerfumeIds: selectedPerfumes.map((perfume) => perfume.id),
      curatorBonusPreference,
      customerInfo: reviewCustomerInfo,
    };

    if (!hasMeaningfulPersistedProgress(persistedState)) {
      clearPersistedBuilderState();
      return;
    }

    savePersistedBuilderState(persistedState);
  }, [selectedPerfumes, curatorBonusPreference, reviewCustomerInfo]);

  useEffect(() => {
    if (!restoreMessage) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      setRestoreMessage("");
    }, 3200);

    return () => window.clearTimeout(timeoutId);
  }, [restoreMessage]);

  function handleFilterChange(category, value) {
    setActiveFilters((currentFilters) => ({
      ...currentFilters,
      [category]: value,
    }));
  }

  const addPerfume = (perfume) => {
  if (selectedPerfumes.length >= MAX_SELECTABLE_SLOTS) {
    return;
  }

  if (selectedPerfumes.some((selectedPerfume) => selectedPerfume.id === perfume.id)) {
    return;
  }

  if (perfume.warningMessage) {
    setPendingPerfume(perfume);
    return;
  }

  setSelectedPerfumes((prev) =>
    prev.some((selectedPerfume) => selectedPerfume.id === perfume.id)
      ? prev
      : [...prev, perfume]
  );
};

const confirmAddPerfume = () => {
  if (!pendingPerfume) return;

  setSelectedPerfumes((prev) =>
    prev.length >= MAX_SELECTABLE_SLOTS ||
    prev.some((perfume) => perfume.id === pendingPerfume.id)
      ? prev
      : [...prev, pendingPerfume]
  );

  setPendingPerfume(null);
};

  const cancelAddPerfume = () => {
  setPendingPerfume(null);
};

  function navigateDetailPerfume(direction) {
    setDetailPerfume((currentPerfume) =>
      getAdjacentVisiblePerfume(currentPerfume, visiblePerfumes, direction)
    );
  }

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
  }, [detailPerfume, visiblePerfumes]);

  function removePerfume(indexToRemove) {
    setSelectedPerfumes((current) =>
      current.filter((_, index) => index !== indexToRemove)
    );
  }

  function reorderPerfumes(fromIndex, toIndex) {
    setSelectedPerfumes((current) => {
      if (
        fromIndex === toIndex ||
        fromIndex < 0 ||
        toIndex < 0 ||
        fromIndex >= current.length ||
        toIndex >= current.length
      ) {
        return current;
      }

      const reordered = [...current];
      const [movedPerfume] = reordered.splice(fromIndex, 1);
      reordered.splice(toIndex, 0, movedPerfume);

      return reordered;
    });
  }

  function clearBox() {
    setSelectedPerfumes([]);
    setCuratorBonusPreference("complement");
    setReviewCustomerInfo(DEFAULT_CUSTOMER_INFO);
    clearPersistedBuilderState();
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
        <h1>Build your fragrance box</h1>
        <p>
          Select up to {MAX_SELECTABLE_SLOTS} decants, explore different moods, and see the
          value of your box update in real time.
        </p>
      </section>

      <nav className="mobile-builder-tabs" aria-label="Builder sections">
        <button
          type="button"
          className={activeMobileTab === "catalog" ? "is-active" : ""}
          onClick={() => setActiveMobileTab("catalog")}
          aria-controls="catalog-panel"
          aria-selected={activeMobileTab === "catalog"}
        >
          Catalog
        </button>

        <button
          type="button"
          className={activeMobileTab === "box" ? "is-active" : ""}
          onClick={() => setActiveMobileTab("box")}
          aria-controls="my-box-panel"
          aria-selected={activeMobileTab === "box"}
        >
          My Box <span>{totalSlots}</span>
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
                <h2>Catalog</h2>
                <p>{visiblePerfumes.length} perfumes available</p>
              </div>
            </div>

            <div className="catalog-controls">
              <input
                type="search"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search name, brand, accord, note, vibe"
              />
            </div>

            <FilterBar
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
            totalSlots={totalSlots}
            maxSlots={MAX_BOX_SLOTS}
            maxSelectableSlots={MAX_SELECTABLE_SLOTS}
            totalPoints={totalPoints}
            estimatedValue={estimatedValue}
            upgradeValue={upgradeValue}
            selectedPerfumes={selectedPerfumes}
            catalogPerfumes={perfumes}
            boxSummary={boxSummary}
            onClearBox={clearBox}
            onRemovePerfume={removePerfume}
            onReorderPerfumes={reorderPerfumes}
            minSlots={MIN_BOX_SLOTS}
            minPoints={MIN_BOX_POINTS}
            missingSlots={missingSlots}
            missingPoints={missingPoints}
            coverageSummary={coverageSummary}
            recommendations={recommendations}
            scentDna={scentDna}
            isBoxReady={isBoxReady}
            onAddPerfume={addPerfume}
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
        perfume={detailPerfume}
        notes={notes}
        tierData={getTierData(detailPerfume.id)}
        isAddDisabled={
          totalSlots >= MAX_SELECTABLE_SLOTS ||
          selectedPerfumes.some((perfume) => perfume.id === detailPerfume.id)
        }
        addButtonLabel={
          selectedPerfumes.some((perfume) => perfume.id === detailPerfume.id)
            ? "Added"
            : totalSlots >= MAX_SELECTABLE_SLOTS
              ? "Box full"
              : "Add to Box"
        }
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
  <div className="modal-overlay">
    <div className="warning-modal">
      <h2>Rare Selection</h2>

      <h3>{pendingPerfume.name}</h3>

      <p>{pendingPerfume.warningMessage}</p>

      <p className="warning-footer">
      ☠ Proceed with caution.
      </p>

      <div className="modal-actions">
        <button onClick={confirmAddPerfume}>
          Add to Box
        </button>

        <button onClick={cancelAddPerfume}>
          Cancel
        </button>
      </div>
    </div>
  </div>
)}
    </>
  );
}

function loadPersistedBuilderState() {
  if (typeof window === "undefined" || !window.localStorage) {
    return DEFAULT_BUILDER_STATE;
  }

  try {
    const rawValue = window.localStorage.getItem(BUILDER_STORAGE_KEY);

    if (!rawValue) {
      return DEFAULT_BUILDER_STATE;
    }

    const parsedValue = JSON.parse(rawValue);
    const validatedState = validatePersistedBuilderState(parsedValue);

    return validatedState
      ? { ...validatedState, wasRestored: validatedState.selectedPerfumeIds.length > 0 }
      : DEFAULT_BUILDER_STATE;
  } catch {
    return DEFAULT_BUILDER_STATE;
  }
}

function validatePersistedBuilderState(value) {
  if (!value || typeof value !== "object" || value.version !== 1) {
    return null;
  }

  const selectedPerfumeIds = Array.isArray(value.selectedPerfumeIds)
    ? value.selectedPerfumeIds
        .filter((id) => Number.isInteger(id) && perfumes.some((perfume) => perfume.id === id))
        .slice(0, MAX_SELECTABLE_SLOTS)
    : [];
  const curatorBonusPreference =
    value.curatorBonusPreference === "similar" ||
    value.curatorBonusPreference === "complement"
      ? value.curatorBonusPreference
      : DEFAULT_BUILDER_STATE.curatorBonusPreference;
  const customerInfo = validatePersistedCustomerInfo(value.customerInfo);

  return {
    selectedPerfumeIds: [...new Set(selectedPerfumeIds)],
    curatorBonusPreference,
    customerInfo,
  };
}

function validatePersistedCustomerInfo(value) {
  if (!value || typeof value !== "object") {
    return DEFAULT_CUSTOMER_INFO;
  }

  return {
    name: typeof value.name === "string" ? value.name : "",
    city: typeof value.city === "string" ? value.city : "",
    notes: typeof value.notes === "string" ? value.notes : "",
  };
}

function hydratePersistedPerfumes(selectedPerfumeIds) {
  return (selectedPerfumeIds || [])
    .map((id) => perfumes.find((perfume) => perfume.id === id))
    .filter(Boolean);
}

function savePersistedBuilderState(value) {
  if (typeof window === "undefined" || !window.localStorage) {
    return;
  }

  try {
    window.localStorage.setItem(BUILDER_STORAGE_KEY, JSON.stringify(value));
  } catch {
    // Persistence is a convenience; storage failures should not block the builder.
  }
}

function hasMeaningfulPersistedProgress(value) {
  const customerInfo = validatePersistedCustomerInfo(value.customerInfo);
  const selectedPerfumeIds = Array.isArray(value.selectedPerfumeIds)
    ? value.selectedPerfumeIds
    : [];

  return (
    selectedPerfumeIds.length > 0 ||
    value.curatorBonusPreference !== DEFAULT_BUILDER_STATE.curatorBonusPreference ||
    Boolean(customerInfo.name.trim()) ||
    Boolean(customerInfo.city.trim()) ||
    Boolean(customerInfo.notes.trim())
  );
}

function clearPersistedBuilderState() {
  if (typeof window === "undefined" || !window.localStorage) {
    return;
  }

  try {
    window.localStorage.removeItem(BUILDER_STORAGE_KEY);
  } catch {
    // Ignore localStorage failures so the visible reset can still complete.
  }
}

function PerfumeDetailsModal({
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

      return window.localStorage.getItem(FRAGRANCE_DETAILS_HINT_KEY) !== "true";
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
    setAddFeedback("");
  }, [perfume.id]);

  useEffect(() => {
    if (!showNavigationHint) {
      return undefined;
    }

    const hintSeenTimer = window.setTimeout(() => {
      markNavigationHintSeen();
    }, 800);
    const hintRemovalTimer = window.setTimeout(() => {
      setShowNavigationHint(false);
    }, 2800);

    return () => {
      window.clearTimeout(hintSeenTimer);
      window.clearTimeout(hintRemovalTimer);
    };
  }, [showNavigationHint]);

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

    setAddFeedback("Added to Box");
    addFeedbackTimeoutRef.current = window.setTimeout(() => {
      setAddFeedback("");
    }, 1600);
  }

  function markNavigationHintSeen() {
    if (!showNavigationHint) {
      return;
    }

    try {
      window.localStorage.setItem(FRAGRANCE_DETAILS_HINT_KEY, "true");
    } catch {
      // The hint is decorative; storage failures should not affect browsing.
    }
  }

  function handleClose() {
    markNavigationHintSeen();
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
            aria-label="Close fragrance details"
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
                      ? `Previous: ${previousPerfume.name}`
                      : "Previous perfume"
                  }
                  aria-label="Previous fragrance"
                >
                  &lt;
                </button>
                <img
                  src={perfume.image}
                  alt={`${perfume.name} bottle`}
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
                  title={nextPerfume ? `Next: ${nextPerfume.name}` : "Next perfume"}
                  aria-label="Next fragrance"
                >
                  &gt;
                </button>

                {showNavigationHint && (
                  <p className="perfume-details-nav-hint">
                    <span className="nav-hint-desktop">
                      Use &larr; &rarr; arrow keys to browse
                    </span>
                    <span className="nav-hint-mobile">Swipe sideways to browse</span>
                  </p>
                )}
              </div>
            </div>
          </>
        )}

        <section className="perfume-details-section">
          <h4>Profile</h4>

          <DetailTagGroup label="Seasons" values={perfume.seasons || []} assetType="seasons" />
          <DetailTagGroup label="Occasions" values={perfume.occasions || []} assetType="occasions" />
          <DetailTagGroup label="Vibes" values={perfume.vibes || []} assetType="vibes" />
        </section>

        <section className="perfume-details-section">
          <h4>Accords</h4>
          <DetailTagGroup label="Accords" values={perfume.accords || []} assetType="accords" />
        </section>

        <section className="perfume-details-section">
          <h4>Notes</h4>

          {usesGeneralNotes ? (
            <DetailNoteGroup
              title="General Notes"
              noteIds={perfume.generalNotes || []}
              notes={notes}
            />
          ) : hasPyramidNotes ? (
            <>
              <DetailNoteGroup
                title="Top Notes"
                noteIds={perfume.topNotes || []}
                notes={notes}
              />
              <DetailNoteGroup
                title="Middle Notes"
                noteIds={perfume.middleNotes || []}
                notes={notes}
              />
              <DetailNoteGroup
                title="Base Notes"
                noteIds={perfume.baseNotes || []}
                notes={notes}
              />
            </>
          ) : (
            <p className="details-empty">No notes listed yet.</p>
          )}
        </section>

      </div>
    </div>
  );
}

function DetailTagGroup({ label, values, assetType }) {
  return (
    <div className="detail-profile-group">
      <span>{label}</span>

      <div className="details-tag-row">
        {values.length > 0 ? (
          values.map((value) => (
            <DetailMetadataChip key={value} value={value} assetType={assetType} />
          ))
        ) : (
          <p>No data yet</p>
        )}
      </div>
    </div>
  );
}

function DetailMetadataChip({ value, assetType }) {
  const asset = assetType ? getMetadataAsset(assetType, value) : null;

  if (!asset) {
    return <span>{value}</span>;
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
      <span>{value}</span>
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

function getSearchText(perfume, notes) {
  const noteIds = getPerfumeNoteIds(perfume);
  const noteNames = noteIds
    .map((noteId) => notes[noteId]?.name)
    .filter(Boolean);

  return [
    perfume.name,
    perfume.brand,
    ...(perfume.accords || []),
    ...(perfume.vibes || []),
    ...noteIds,
    ...noteNames,
  ]
    .join(" ")
    .toLowerCase();
}

function sortPerfumes(perfumesToSort, sortOption, searchQuery) {
  return [...perfumesToSort].sort((a, b) => {
    if (sortOption === "pointsAsc") {
      return a.points - b.points || compareNames(a, b);
    }

    if (sortOption === "pointsDesc") {
      return b.points - a.points || compareNames(a, b);
    }

    if (sortOption === "brandAsc") {
      return (
        a.brand.localeCompare(b.brand) ||
        compareNames(a, b)
      );
    }

    if (sortOption === "tier") {
      return getTierRank(a.id) - getTierRank(b.id) || a.points - b.points || compareNames(a, b);
    }

    if (sortOption === "alphabetical") {
      return compareNames(a, b);
    }

    if (searchQuery) {
      return getBestMatchRank(a, searchQuery) - getBestMatchRank(b, searchQuery) || compareNames(a, b);
    }

    return 0;
  });
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

function getBestMatchRank(perfume, searchQuery) {
  if (perfume.name.toLowerCase().includes(searchQuery)) {
    return 0;
  }

  if (perfume.brand.toLowerCase().includes(searchQuery)) {
    return 1;
  }

  const accordOrVibeMatch = [
    ...(perfume.accords || []),
    ...(perfume.vibes || []),
  ].some((item) => item.toLowerCase().includes(searchQuery));

  if (accordOrVibeMatch) {
    return 2;
  }

  return 3;
}

function getTierRank(id) {
  if (id < 100) return 0;
  if (id < 200) return 1;
  if (id < 300) return 2;
  if (id < 400) return 3;
  if (id < 500) return 4;
  return 5;
}

function compareNames(a, b) {
  return a.name.localeCompare(b.name);
}

function formatLabel(value) {
  return value
    .split(/(?=[A-Z])|[-_\s]/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export default App;
