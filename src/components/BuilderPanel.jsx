import { forwardRef, useEffect, useMemo, useRef, useState } from "react";
import { createPortal, flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { toBlob } from "html-to-image";
import { getCollectionIdentityProfile } from "../utils/collectionIdentityEngine";
import {
  buildCollectionCardSeasonRows,
  buildCollectionCardViewModel,
} from "../builder/internal/collectionCard/buildCollectionCardViewModel.js";
import {
  buildCollectionIntelligenceViewModel,
  formatFiveStarRating,
  formatIntelligenceLabel,
  getObjectiveCompatibilityScore,
  getPerfumeNoteLabels,
  getStrengthSegmentCount,
  getSupportingAccords,
  normalizeAccordLabel,
  selectDnaExplorerDetail,
} from "../builder/internal/intelligence/buildCollectionIntelligenceViewModel.js";
import { buildFinalizationModel } from "../builder/internal/finalization/buildFinalizationModel.js";
import { getTierData } from "../utils/tierUtils";
import CollectionCard from "./CollectionCard";

const EMPTY_RECOMMENDATIONS = [];
const PERFUME_IMAGE_FALLBACK =
  "/images/perfumes/placeholders/perfume-placeholder.svg";
function BuilderPanel({
  builderConfig,
  totalSlots,
  maxSlots,
  maxSelectableSlots,
  totalPoints,
  estimatedValue,
  selectedPerfumes,
  catalogPerfumes,
  boxSummary,
  onClearBox,
  onRemovePerfume,
  onReorderPerfumes,
  minSlots,
  missingSlots,
  missingPoints,
  coverageSummary,
  recommendations,
  scentDna,
  isBoxReady,
  onAddPerfume,
  curatorBonusPreference,
  onCuratorBonusPreferenceChange,
  reviewCustomerInfo,
  onReviewCustomerInfoChange,
}) {
    const [hasSeenDiscoveryIntro, setHasSeenDiscoveryIntro] = useState(() => {
      if (typeof window === "undefined") {
        return true;
      }

      return window.localStorage.getItem(builderConfig.persistence.discoveryIntroSeenKey) === "true";
    });
    const [isDiscoveryIntroOpen, setIsDiscoveryIntroOpen] = useState(false);
    const [isNotesModalOpen, setIsNotesModalOpen] = useState(false);
    const [isFinalSummaryOpen, setIsFinalSummaryOpen] = useState(false);
    const [isCollectionCardPreviewOpen, setIsCollectionCardPreviewOpen] = useState(false);
    const [isCollectionSnapshotOpen, setIsCollectionSnapshotOpen] = useState(false);
    const [selectedDnaAccord, setSelectedDnaAccord] = useState(null);
    const previousCuratorBonusUnlockedRef = useRef(false);
    const curatorBonusModuleRef = useRef(null);
    const [isCuratorBonusAnimating, setIsCuratorBonusAnimating] = useState(false);
    const [shareStatus, setShareStatus] = useState("");
    const [activeShareAction, setActiveShareAction] = useState("");
    const [isShareTooltipOpen, setIsShareTooltipOpen] = useState(false);
    const [isBalanceLaneEmphasized, setIsBalanceLaneEmphasized] = useState(false);
    const shareStatusTimeoutRef = useRef(null);
    const balanceLaneRef = useRef(null);
    const balanceLaneEmphasisTimeoutRef = useRef(null);
    const sortedNotes = [...boxSummary.notes].sort();
    const selectedPerfumeIds = useMemo(
      () => new Set(selectedPerfumes.map((perfume) => perfume.id)),
      [selectedPerfumes]
    );
    const basedOnYourPicks = recommendations?.basedOnYourPicks || EMPTY_RECOMMENDATIONS;
    const toBalanceYourBox = recommendations?.toBalanceYourBox || EMPTY_RECOMMENDATIONS;
    const curatorBonusLane =
      curatorBonusPreference === "similar" ? basedOnYourPicks : toBalanceYourBox;
    const hiddenCuratorPicks = useMemo(
      () => buildHiddenCuratorPicks(curatorBonusLane, selectedPerfumeIds),
      [curatorBonusLane, selectedPerfumeIds]
    );
    const collectionIntelligence = useMemo(
      () =>
        buildCollectionIntelligenceViewModel({
          selectedPerfumes,
          catalog: catalogPerfumes,
          collectionSummary: boxSummary,
          coverageSummary,
          scentDna,
          recommendations,
          curatorBonus: {
            recommendations: curatorBonusLane,
            preference: curatorBonusPreference,
          },
          config: {
            isBoxFull: totalSlots >= maxSelectableSlots,
          },
        }),
      [
        selectedPerfumes,
        catalogPerfumes,
        boxSummary,
        coverageSummary,
        scentDna,
        recommendations,
        curatorBonusLane,
        curatorBonusPreference,
        totalSlots,
        maxSelectableSlots,
      ]
    );
    const curatorInsight = collectionIntelligence.boxIntelligence.curatorInsight;
    const boxIntelligence = collectionIntelligence.boxIntelligence;
    const nextImprovementResult = collectionIntelligence.nextImprovement;
    const collectionIdentityProfile = useMemo(
      () => getCollectionIdentityProfile(boxSummary),
      [boxSummary]
    );
    const isCuratorBonusUnlocked =
      totalPoints >= builderConfig.curatorBonus.targetPoints && totalSlots >= minSlots;
    const collectionCardViewModel = useMemo(
      () =>
        buildCollectionCardViewModel({
          selectedPerfumes,
          totalPoints,
          estimatedValue,
          boxSummary,
          coverageSummary,
          scentDna,
          collectionIdentity: collectionIdentityProfile,
          curatorBonus: {
            isUnlocked: isCuratorBonusUnlocked,
          },
          config: builderConfig,
          maxSlots,
          maxSelectableSlots,
        }),
      [
        selectedPerfumes,
        totalPoints,
        estimatedValue,
        boxSummary,
        coverageSummary,
        scentDna,
        collectionIdentityProfile,
        isCuratorBonusUnlocked,
        builderConfig,
        maxSlots,
        maxSelectableSlots,
      ]
    );
    const reviewRequirementText = [
      missingSlots > 0
        ? `${missingSlots} more fragrance${missingSlots === 1 ? "" : "s"}`
        : null,
      missingPoints > 0
        ? `${missingPoints.toFixed(1)} more point${missingPoints === 1 ? "" : "s"}`
        : null,
    ]
      .filter(Boolean)
      .join(" and ");
    const shouldShowDiscoveryIntro =
      selectedPerfumes.length === 0 &&
      (!hasSeenDiscoveryIntro || isDiscoveryIntroOpen);
    const canNativeShareCard =
      typeof window !== "undefined" &&
      typeof navigator.share === "function" &&
      typeof navigator.canShare === "function" &&
      typeof window.File !== "undefined" &&
      navigator.canShare({
        files: [new File([""], collectionCardViewModel.export.defaultFilename, { type: "image/png" })],
      });
    const isShareGenerating = Boolean(activeShareAction);
    const nextAvailableSlotIndex = getNextAvailableSlotIndex(
      selectedPerfumes,
      maxSelectableSlots
    );

    const showBalanceLaneEmphasis = () => {
      setIsBalanceLaneEmphasized(true);

      if (balanceLaneEmphasisTimeoutRef.current) {
        window.clearTimeout(balanceLaneEmphasisTimeoutRef.current);
      }

      balanceLaneEmphasisTimeoutRef.current = window.setTimeout(() => {
        setIsBalanceLaneEmphasized(false);
        balanceLaneEmphasisTimeoutRef.current = null;
      }, 1100);
    };

    const focusBalanceLane = () => {
      const firstCard = balanceLaneRef.current?.querySelector(".recommendation-card");
      const heading = balanceLaneRef.current?.querySelector("h4");
      const focusTarget = firstCard || heading;

      if (focusTarget) {
        focusTarget.focus({ preventScroll: true });
      }
    };

    const handleNextSlotRecommendation = () => {
      if (!balanceLaneRef.current) {
        return;
      }

      balanceLaneRef.current.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
      showBalanceLaneEmphasis();
      window.setTimeout(focusBalanceLane, 420);
    };

    const dismissDiscoveryIntro = () => {
      if (typeof window !== "undefined") {
        window.localStorage.setItem(builderConfig.persistence.discoveryIntroSeenKey, "true");
      }

      setHasSeenDiscoveryIntro(true);
      setIsDiscoveryIntroOpen(false);
    };
    const showShareStatus = (message) => {
      setShareStatus(message);

      if (shareStatusTimeoutRef.current) {
        window.clearTimeout(shareStatusTimeoutRef.current);
      }

      shareStatusTimeoutRef.current = window.setTimeout(() => {
        setShareStatus("");
        shareStatusTimeoutRef.current = null;
      }, 2400);
    };

    const collectionCardExportProps = collectionCardViewModel.cardProps;

    const createShareImageBlob = () => renderCollectionCardPng(collectionCardExportProps);

    const handleDownloadShareImage = async () => {
      if (isShareGenerating) {
        return;
      }

      setActiveShareAction("download");
      try {
        const blob = await createShareImageBlob();
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = collectionCardViewModel.export.filename;
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.setTimeout(() => URL.revokeObjectURL(url), 1000);
        showShareStatus(builderConfig.collectionCard.downloadedStatus);
      } catch (error) {
        console.error("Unable to download Collection Card", error);
        showShareStatus(
          error?.message?.startsWith("The Collection Card could not be rendered")
            ? builderConfig.collectionCard.renderFailureStatus
            : builderConfig.collectionCard.createFailureStatus
        );
      } finally {
        setActiveShareAction("");
      }
    };

    const handleNativeShareCard = async () => {
      if (!canNativeShareCard || isShareGenerating) {
        return;
      }

      setActiveShareAction("share");
      try {
        const blob = await createShareImageBlob();
        const file = new File([blob], collectionCardViewModel.export.filename, {
          type: "image/png",
        });

        if (!navigator.canShare({ files: [file] })) {
          showShareStatus(builderConfig.collectionCard.unavailableShareStatus);
          return;
        }

        await navigator.share({
          title: collectionCardViewModel.export.shareTitle,
          text: collectionCardViewModel.export.shareText,
          files: [file],
        });
        showShareStatus(builderConfig.collectionCard.sharedStatus);
      } catch (error) {
        if (error?.name !== "AbortError") {
          console.error("Unable to share Collection Card", error);
          showShareStatus(builderConfig.collectionCard.unavailableShareFallbackStatus);
        }
      } finally {
        setActiveShareAction("");
      }
    };

    useEffect(() => {
      let animationTimeout;

      if (isCuratorBonusUnlocked && !previousCuratorBonusUnlockedRef.current) {
        setIsCuratorBonusAnimating(true);
        window.requestAnimationFrame(() => {
          curatorBonusModuleRef.current?.scrollIntoView({
            behavior: "smooth",
            block: "center",
          });
        });
        animationTimeout = window.setTimeout(() => {
          setIsCuratorBonusAnimating(false);
        }, 1600);
      }

      if (!isCuratorBonusUnlocked) {
        animationTimeout = window.setTimeout(() => {
          setIsCuratorBonusAnimating(false);
        }, 0);
      }

      previousCuratorBonusUnlockedRef.current = isCuratorBonusUnlocked;

      return () => {
        if (animationTimeout) {
          window.clearTimeout(animationTimeout);
        }
      };
    }, [isCuratorBonusUnlocked]);

    useEffect(
      () => () => {
        if (shareStatusTimeoutRef.current) {
          window.clearTimeout(shareStatusTimeoutRef.current);
        }

        if (balanceLaneEmphasisTimeoutRef.current) {
          window.clearTimeout(balanceLaneEmphasisTimeoutRef.current);
        }
      },
      []
    );
  return (
    <aside className="builder-panel">
      <div className="panel-header">
        <div>
          <div className="panel-title-row">
            <h2>{builderConfig.copy.boxPanelTitle}</h2>
            <button
              className="info-button"
              type="button"
              onClick={() => setIsDiscoveryIntroOpen(true)}
              aria-label={builderConfig.copy.introButtonAriaLabel}
            >
              i
            </button>
          </div>
          <p>
            {totalSlots}/{maxSelectableSlots} selected slots used
          </p>
        </div>

        <button className="ghost-button" onClick={onClearBox}>
          {builderConfig.copy.clearBuilderLabel}
        </button>
      </div>

      {shouldShowDiscoveryIntro && (
        <DiscoveryBoxCoachmark builderConfig={builderConfig} onDismiss={dismissDiscoveryIntro} />
      )}

      <div className="box-summary-card" aria-label="Box summary">
        <div className="box-summary-metric">
          <strong>{totalSlots} / {maxSelectableSlots}</strong>
          <span>Slots</span>
        </div>

        <div className="box-summary-metric">
          <strong>{totalPoints.toFixed(1)}</strong>
          <span>Points</span>
        </div>

        <div className="box-summary-metric box-summary-total">
          <strong>${estimatedValue.toFixed(0)}</strong>
          <span>Estimated Total</span>
        </div>
      </div>

      <BoxSlotTray
        selectedPerfumes={selectedPerfumes}
        maxSlots={maxSlots}
        maxSelectableSlots={maxSelectableSlots}
        isCuratorBonusUnlocked={isCuratorBonusUnlocked}
        nextAvailableSlotIndex={nextAvailableSlotIndex}
        onNextSlotRecommendation={handleNextSlotRecommendation}
        onRemovePerfume={onRemovePerfume}
        onReorderPerfumes={onReorderPerfumes}
      />

      <div className="share-box-actions">
        <div className="share-box-toolbar">
          <span className="share-box-label">Collection Card</span>

          <span className="share-info-wrap">
            <button
              type="button"
              className="share-info-button"
              aria-label="About Collection Card"
              aria-describedby="share-box-tooltip"
              aria-expanded={isShareTooltipOpen}
              onClick={() => setIsShareTooltipOpen((isOpen) => !isOpen)}
              onBlur={() => setIsShareTooltipOpen(false)}
            >
              i
            </button>
            <span
              id="share-box-tooltip"
              className={`share-box-tooltip ${
                isShareTooltipOpen ? "is-visible" : ""
              }`}
              role="tooltip"
            >
              {builderConfig.collectionCard.tooltip}
            </span>
          </span>
        </div>

        <div className="share-box-buttons" aria-busy={isShareGenerating}>
          <button
            type="button"
            onClick={handleDownloadShareImage}
            disabled={isShareGenerating}
          >
            {activeShareAction === "download" ? builderConfig.collectionCard.generatingLabel : builderConfig.collectionCard.downloadLabel}
          </button>
          {canNativeShareCard && (
            <button
              type="button"
              onClick={handleNativeShareCard}
              disabled={isShareGenerating}
            >
              {activeShareAction === "share" ? builderConfig.collectionCard.generatingLabel : builderConfig.collectionCard.shareLabel}
            </button>
          )}
          {import.meta.env.DEV && (
            <button
              type="button"
              onClick={() => setIsCollectionCardPreviewOpen(true)}
              disabled={isShareGenerating}
            >
              {builderConfig.collectionCard.previewLabel}
            </button>
          )}
        </div>

        {shareStatus && (
          <p className="share-box-status" aria-live="polite">
            {shareStatus}
          </p>
        )}
      </div>

      <div className="slot-bar">
        <div
          className="slot-progress"
          style={{
            width: `${Math.min((totalSlots / maxSelectableSlots) * 100, 100)}%`,
          }}
        />
      </div>

      <CuratorBonusModule
        ref={curatorBonusModuleRef}
        builderConfig={builderConfig}
        totalPoints={totalPoints}
        totalSlots={totalSlots}
        minSlots={minSlots}
        isUnlocked={isCuratorBonusUnlocked}
        isAnimating={isCuratorBonusAnimating}
        preference={curatorBonusPreference}
        onPreferenceChange={onCuratorBonusPreferenceChange}
        hiddenCuratorPicks={hiddenCuratorPicks}
      />

      <div className={`review-action ${isBoxReady ? "is-ready" : "is-incomplete"}`}>
        <button
          type="button"
          className={`review-box-button ${
            isCuratorBonusUnlocked ? "is-unlocked" : ""
          }`}
          disabled={!isBoxReady}
          onClick={() => setIsFinalSummaryOpen(true)}
        >
          {builderConfig.copy.reviewButtonLabel}
        </button>

        {!isBoxReady && (
          <p>{builderConfig.copy.reviewIncompletePrefix} {reviewRequirementText || builderConfig.copy.reviewIncompleteFallback} to review.</p>
        )}
      </div>


      <CollectionSnapshot
        builderConfig={builderConfig}
        boxSummary={boxSummary}
        coverageSummary={coverageSummary}
        selectedPerfumes={selectedPerfumes}
        intelligence={collectionIntelligence}
        isBoxFull={totalSlots >= maxSelectableSlots}
        isExpanded={isCollectionSnapshotOpen}
        selectedDnaAccord={selectedDnaAccord}
        onToggle={() => setIsCollectionSnapshotOpen((isOpen) => !isOpen)}
        onOpenScentLibrary={() => setIsNotesModalOpen(true)}
        onOpenDnaAccord={setSelectedDnaAccord}
        onCloseDnaAccord={() => setSelectedDnaAccord(null)}
        onAddPerfume={onAddPerfume}
        onRemovePerfume={onRemovePerfume}
      />

      <BoxIntelligenceSummary intelligence={boxIntelligence} />

      <div className="coverage-panel">
    <h3>Box Analysis</h3>
    <p className="analysis-subtitle">
    Coverage strengths and collection gaps
    </p>

    {coverageSummary.strengths.length > 0 ? (
    coverageSummary.strengths.slice(0, 6).map((item) => (
        <p key={`${item.category}-${item.label}`} className="coverage-strength">
        ✓ {item.label}
        </p>
    ))
    ) : (
    <p>No strong coverage yet</p>
    )}

    {coverageSummary.strengths.length > 6 && (
    <p className="coverage-more">
        +{coverageSummary.strengths.length - 6} more strengths
    </p>
    )}
    </div>

    {coverageSummary.gaps.length > 0 && (
  <div className="seasonal-gaps">
    <h4>Seasonal Gaps</h4>

    {coverageSummary.gaps.map((item) => (
      <p
    key={`${item.category}-${item.target}`}
    style={{ color: item.seasonColor }}
    >
    {getSeasonIcon(item.target)} {item.label}
    </p>
    ))}
  </div>
    )}

    {(basedOnYourPicks.length > 0 || toBalanceYourBox.length > 0) && (
    <div className="recommendations">
    <RecommendationLane
      title="Based On Your Picks"
      recommendations={basedOnYourPicks}
      selectedPerfumeIds={selectedPerfumeIds}
      isBoxFull={totalSlots >= maxSelectableSlots}
      onAddPerfume={onAddPerfume}
    />

    <NextImprovementSection
      result={nextImprovementResult}
      selectedPerfumeIds={selectedPerfumeIds}
      isBoxFull={totalSlots >= maxSelectableSlots}
      onAddPerfume={onAddPerfume}
      sectionRef={balanceLaneRef}
      isEmphasized={isBalanceLaneEmphasized}
    />
    </div>
    )}

      <div className="summary-panel">
        <h3>Box Profile</h3>

        <div>
          <span>Occasions</span>
          <div className="summary-tags">
            {boxSummary.occasions.length > 0 ? (
              boxSummary.occasions.map((item) => (
                <span key={item}>{item}</span>
              ))
            ) : (
              <p>No data yet</p>
            )}
          </div>
        </div>

        <div>
          <span>Seasons</span>
          <div className="summary-tags">
            {boxSummary.seasons.length > 0 ? (
              boxSummary.seasons.map((item) => <span key={item}>{item}</span>)
            ) : (
              <p>No data yet</p>
            )}
          </div>
        </div>

        <div>
          <span>Vibes</span>
          <div className="summary-tags">
            {boxSummary.vibes.length > 0 ? (
              boxSummary.vibes.map((item) => <span key={item}>{item}</span>)
            ) : (
              <p>No data yet</p>
            )}
          </div>
        </div>

        <div>
          <span>Scent Palette</span>

          <div className="summary-tags">
            {Object.entries(boxSummary.accordMap).length > 0 ? (
              Object.entries(boxSummary.accordMap).map(
                ([accord, perfumeNames]) => (
                  <span className="accord-tooltip" key={accord}>
                    {accord} ×{perfumeNames.length}

                    <div className="tooltip-box">
                      <strong>{accord}</strong>
                      {perfumeNames.map((name) => (
                        <p key={name}>{name}</p>
                      ))}
                    </div>
                  </span>
                )
              )
            ) : (
              <p>No data yet</p>
            )}
          </div>
        </div>

        <div>
  <span>Notes</span>

  {boxSummary.notes.length > 0 ? (
    <>
      <p>{boxSummary.notes.length} unique notes covered</p>

      <button
        className="details-button"
        onClick={() => setIsNotesModalOpen(true)}
      >
        View Details
      </button>
    </>
  ) : (
    <p>No data yet</p>
  )}
</div>
      </div>
      {isNotesModalOpen && (
        <ScentLibraryModal
          notes={sortedNotes}
          onClose={() => setIsNotesModalOpen(false)}
        />
      )}
      {isFinalSummaryOpen && (
        <DiscoveryBoxReviewModal
          builderConfig={builderConfig}
          selectedPerfumes={selectedPerfumes}
          totalPoints={totalPoints}
          estimatedValue={estimatedValue}
          boxSummary={boxSummary}
          coverageSummary={coverageSummary}
          isBoxReady={isBoxReady}
          isCuratorBonusUnlocked={isCuratorBonusUnlocked}
          curatorBonusPreference={curatorBonusPreference}
          curatorInsight={curatorInsight}
          hiddenCuratorPicks={hiddenCuratorPicks}
          customerInfo={reviewCustomerInfo}
          onCustomerInfoChange={onReviewCustomerInfoChange}
          onClose={() => setIsFinalSummaryOpen(false)}
        />
      )}
      {isCollectionCardPreviewOpen && (
        <CollectionCardPreviewModal
          cardProps={collectionCardViewModel.cardProps}
          onClose={() => setIsCollectionCardPreviewOpen(false)}
        />
      )}
    </aside>
  );
}

function CollectionCardPreviewModal({
  cardProps,
  onClose,
}) {
  return createPortal(
    <div className="modal-overlay final-summary-overlay" onClick={onClose}>
      <div
        className="collection-card-preview-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="collection-card-preview-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal-header collection-card-preview-header">
          <div>
            <span>Development Preview</span>
            <h3 id="collection-card-preview-title">Collection Card</h3>
          </div>

          <button type="button" onClick={onClose}>Close</button>
        </div>

        <CollectionCard {...cardProps} />
      </div>
    </div>,
    document.body
  );
}

function DiscoveryBoxCoachmark({ builderConfig, onDismiss }) {
  return (
    <section className="discovery-coachmark" aria-label={builderConfig.copy.introAriaLabel}>
      <span className="coachmark-pointer" aria-hidden="true" />

      <div>
        <span>{builderConfig.copy.introTitle}</span>
        <p>Build your collection by selecting fragrances from the catalog.</p>
        <p>{builderConfig.copy.introDescription}</p>
        <p>
          As your box grows, we'll analyze your coverage, strengths and
          collection identity.
        </p>
      </div>

      <button type="button" onClick={onDismiss}>
        Got it
      </button>
    </section>
  );
}

function CollectionSnapshot({
  builderConfig,
  boxSummary,
  coverageSummary,
  intelligence,
  isBoxFull,
  isExpanded,
  selectedDnaAccord,
  onToggle,
  onOpenScentLibrary,
  onOpenDnaAccord,
  onCloseDnaAccord,
  onAddPerfume,
  onRemovePerfume,
}) {
  const dnaTriggerRefs = useRef(new Map());
  const seasonRows = intelligence.seasons.rows;
  const hasProfileData = intelligence.profile.hasProfileData;
  const hasAnalysisData = intelligence.boxIntelligence.hasAnalysisData;
  const collectionProfileTraits = intelligence.profile.traits;
  const visibleCollectionDna = intelligence.dna.visibleItems;
  const selectedDnaItem = selectDnaExplorerDetail(intelligence, selectedDnaAccord);
  const balanceRows = intelligence.balance.rows;
  const handleOpenDnaAccord = (accord) => {
    onOpenDnaAccord(accord);
  };
  const handleSelectDnaAccord = (accord) => {
    onOpenDnaAccord(accord);
  };
  const handleCloseDnaAccord = () => {
    const accordToRestore = selectedDnaAccord;
    onCloseDnaAccord();
    window.setTimeout(() => {
      dnaTriggerRefs.current.get(accordToRestore)?.focus();
    }, 0);
  };

  return (
    <section className={`collection-snapshot ${isExpanded ? "is-expanded" : ""}`}>
      <div className="collection-snapshot-header">
        <h3>Collection Intelligence</h3>
        <button type="button" onClick={onToggle} aria-expanded={isExpanded}>
          {isExpanded ? "Hide Full Analysis" : "View Full Analysis"}
        </button>
      </div>

      <div className="collection-profile-summary">
        <span>Collection Profile</span>

        {collectionProfileTraits.length > 0 ? (
          <div className="collection-profile-chips">
            {collectionProfileTraits.map((trait) => (
              <span key={trait}>{trait}</span>
            ))}
          </div>
        ) : (
          <p className="collection-empty-message">
            Add fragrances to reveal the collection profile.
          </p>
        )}
      </div>

      <div className="collection-snapshot-overview">
        <span>Season Coverage</span>

        <div className="season-coverage-bars">
          {seasonRows.map((season) => (
            <div className="season-coverage-row" key={season.id}>
              <span>{season.label}</span>
              <div className="season-coverage-track" aria-label={`${season.label} coverage`}>
                <i style={{ width: `${season.percent}%` }} />
              </div>
              <strong>{season.count}</strong>
            </div>
          ))}
        </div>
      </div>

      <div className="collection-dna-summary">
        <span>Collection DNA</span>

        {visibleCollectionDna.length > 0 ? (
          <p className="collection-dna-helper">
            <span className="collection-dna-helper-desktop">Select an accord to explore</span>
            <span className="collection-dna-helper-mobile">Tap an accord to explore</span>
          </p>
        ) : null}

        {visibleCollectionDna.length > 0 ? (
          <div className="collection-dna-chips">
            {visibleCollectionDna.map((item) => (
              <button
                ref={(node) => {
                  if (node) {
                    dnaTriggerRefs.current.set(item.label, node);
                  } else {
                    dnaTriggerRefs.current.delete(item.label);
                  }
                }}
                type="button"
                className={`collection-dna-chip ${
                  normalizeAccordLabel(selectedDnaAccord) === normalizeAccordLabel(item.label)
                    ? "is-active"
                    : ""
                }`}
                key={item.label}
                onClick={() => handleOpenDnaAccord(item.label)}
                aria-current={
                  normalizeAccordLabel(selectedDnaAccord) === normalizeAccordLabel(item.label)
                    ? "true"
                    : undefined
                }
                aria-label={`View ${item.count} ${item.displayLabel.toLowerCase()} fragrance${
                  item.count === 1 ? "" : "s"
                } in your box`}
              >
                <span className="collection-dna-label">{item.displayLabel}</span>
                <strong>{item.count}</strong>
                <span className="collection-dna-chevron" aria-hidden="true">
                  &rsaquo;
                </span>
              </button>
            ))}
          </div>
        ) : (
          <p className="collection-empty-message">
            Dominant accords appear as the box takes shape.
          </p>
        )}
      </div>

      {selectedDnaItem && (
        <CollectionDnaPanel
          accord={selectedDnaItem.accord}
          detail={selectedDnaItem}
          isBoxFull={isBoxFull}
          onSelectAccord={handleSelectDnaAccord}
          onClose={handleCloseDnaAccord}
          onAddPerfume={onAddPerfume}
          onRemovePerfume={onRemovePerfume}
        />
      )}

      <div className="collection-balance-summary">
        <span>Collection Balance</span>

        <div className="collection-balance-list">
          {balanceRows.map((row) => (
            <div className="collection-balance-row" key={row.label}>
              <span>{row.label}</span>
              <strong aria-label={`${row.label}: ${row.level} out of 5`}>
                {formatFiveStarRating(row.level)}
              </strong>
            </div>
          ))}
        </div>
      </div>

      <div className="collection-snapshot-details" aria-hidden={!isExpanded}>
        <div className="summary-panel">
          <h3>Box Profile</h3>

          {hasProfileData ? (
            <>
              <ProfileSummaryGroup label="Occasions" values={boxSummary.occasions} />
              <ProfileSummaryGroup label="Seasons" values={boxSummary.seasons} />
              <ProfileSummaryGroup label="Vibes" values={boxSummary.vibes} />

              {Object.entries(boxSummary.accordMap).length > 0 && (
                <div>
                  <span>Dominant Accords</span>

                  <div className="summary-tags">
                    {Object.entries(boxSummary.accordMap).map(
                      ([accord, perfumeNames]) => (
                        <span className="accord-tooltip" key={accord}>
                          {accord} x{perfumeNames.length}

                          <div className="tooltip-box">
                            <strong>{accord}</strong>
                            {perfumeNames.map((name) => (
                              <p key={name}>{name}</p>
                            ))}
                          </div>
                        </span>
                      )
                    )}
                  </div>
                </div>
              )}

              {boxSummary.notes.length > 0 && (
                <div>
                  <span>{builderConfig.finalization.customerFieldLabels.notes}</span>

                  <p>{boxSummary.notes.length} unique notes covered</p>

                  <button
                    className="details-button"
                    type="button"
                    onClick={onOpenScentLibrary}
                  >
                    View Details
                  </button>
                </div>
              )}
            </>
          ) : (
            <p className="collection-empty-message">
              Build your collection to reveal its profile.
            </p>
          )}
        </div>

        <div className="coverage-panel">
          <h3>Box Analysis</h3>
          <p className="analysis-subtitle">
            Coverage strengths and collection gaps
          </p>

          {hasAnalysisData ? (
            <>
              {coverageSummary.strengths.slice(0, 6).map((item) => (
                <p key={`${item.category}-${item.label}`} className="coverage-strength">
                  {item.label}
                </p>
              ))}

              {coverageSummary.strengths.length > 6 && (
                <p className="coverage-more">
                  +{coverageSummary.strengths.length - 6} more strengths
                </p>
              )}
            </>
          ) : (
            <p className="collection-empty-message">
              Select fragrances to generate collection insights.
            </p>
          )}
        </div>

        {coverageSummary.gaps.length > 0 && (
          <div className="seasonal-gaps">
            <h4>Seasonal Gaps</h4>

            {coverageSummary.gaps.map((item) => (
              <p
                key={`${item.category}-${item.target}`}
                style={{ color: item.seasonColor }}
              >
                {getSeasonIcon(item.target)} {item.label}
              </p>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function CollectionDnaPanel({
  accord,
  detail,
  isBoxFull,
  onSelectAccord,
  onClose,
  onAddPerfume,
  onRemovePerfume,
}) {
  const [activeQuickDetailId, setActiveQuickDetailId] = useState(null);
  const [activeQuickDetailSource, setActiveQuickDetailSource] = useState(null);
  const closeButtonRef = useRef(null);
  const modalRef = useRef(null);
  const previousAccordRef = useRef(accord);
  const formattedAccord = detail.formattedAccord;
  const accordItems = detail.accordItems;
  const matchingSelectedPerfumes = detail.matchingSelectedPerfumes;
  const strength = detail.strength;
  const mainContributors = detail.mainContributors;
  const similarPicks = detail.similarPicks;

  useEffect(() => {
    closeButtonRef.current?.focus();
  }, []);

  useEffect(() => {
    if (previousAccordRef.current !== accord) {
      setActiveQuickDetailId(null);
      setActiveQuickDetailSource(null);
      modalRef.current?.scrollTo({ top: 0, behavior: "auto" });
      previousAccordRef.current = accord;
    }
  }, [accord]);

  const visibleQuickDetailId =
    activeQuickDetailId &&
    [...matchingSelectedPerfumes, ...similarPicks].some(
      (item) => item.perfume.id === activeQuickDetailId
    )
      ? activeQuickDetailId
      : null;
  const visibleQuickDetailSource = visibleQuickDetailId
    ? activeQuickDetailSource
    : null;

  const handleSetActiveQuickDetailId = (perfumeId, source = "row") => {
    setActiveQuickDetailId((currentId) => {
      if (currentId === perfumeId && activeQuickDetailSource === source) {
        setActiveQuickDetailSource(null);
        return null;
      }

      setActiveQuickDetailSource(source);
      return perfumeId;
    });
  };

  const handleSelectAccord = (nextAccord) => {
    if (normalizeAccordLabel(nextAccord) === normalizeAccordLabel(accord)) {
      return;
    }

    setActiveQuickDetailId(null);
    setActiveQuickDetailSource(null);
    onSelectAccord(nextAccord);
  };

  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === "Escape") {
        if (visibleQuickDetailId) {
          setActiveQuickDetailId(null);
          setActiveQuickDetailSource(null);
          return;
        }

        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, visibleQuickDetailId]);

  const handleOverlayClick = (event) => {
    if (event.target === event.currentTarget) {
      onClose();
    }
  };

  const handleModalClick = (event) => {
    if (
      visibleQuickDetailId &&
      !event.target.closest(".dna-quick-detail") &&
      !event.target.closest(".dna-row-detail-trigger")
    ) {
      setActiveQuickDetailId(null);
      setActiveQuickDetailSource(null);
    }
  };

  return createPortal(
    <div
      className="modal-overlay dna-modal-overlay"
      role="presentation"
      onClick={handleOverlayClick}
    >
      <section
        ref={modalRef}
        className="dna-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="dna-modal-title"
        onClick={handleModalClick}
      >
        <div className="dna-modal-header">
          <div>
            <span>{formattedAccord} in your box</span>
            <h3 id="dna-modal-title">{strength.title}</h3>
            <p>
              These fragrances currently shape the {formattedAccord.toLowerCase()} character
              of your collection.
            </p>
          </div>

          <button
            ref={closeButtonRef}
            type="button"
            className="dna-modal-close"
            onClick={onClose}
          >
            Close
          </button>
        </div>

        <div className="dna-accord-switcher" aria-label="Browse collection DNA accords">
          {accordItems.map((item) => {
            const isActive =
              normalizeAccordLabel(item.label) === normalizeAccordLabel(accord);

            return (
              <button
                type="button"
                key={item.label}
                className={isActive ? "is-active" : ""}
                onClick={() => handleSelectAccord(item.label)}
                aria-current={isActive ? "true" : undefined}
              >
                {item.displayLabel || formatIntelligenceLabel(item.label)}
                <strong>{item.count}</strong>
              </button>
            );
          })}
        </div>

        <div className="dna-accord-content" key={accord}>
        <div className="dna-strength-card">
            <div className="dna-strength-heading">
              <span>{formattedAccord}</span>
              <div>
                <DnaStrengthMeter strength={strength} />
                <strong>{strength.level}</strong>
              </div>
            </div>
            <p>{strength.description}</p>

            {mainContributors.length > 0 && (
              <div
                className="dna-main-contributors"
                aria-label={`Main ${formattedAccord} contributors`}
              >
                {mainContributors.map(({ perfume }) => {
                  const detailId = `dna-summary-detail-${perfume.id}`;
                  const isDetailOpen =
                    visibleQuickDetailId === perfume.id &&
                    visibleQuickDetailSource === "summary";

                  return (
                    <div key={perfume.id}>
                      <button
                        type="button"
                        className="dna-contributor-trigger dna-row-detail-trigger"
                        onClick={() => handleSetActiveQuickDetailId(perfume.id, "summary")}
                        aria-label={`View details for ${perfume.name}`}
                        aria-expanded={isDetailOpen}
                        aria-controls={isDetailOpen ? detailId : undefined}
                      >
                        <img
                          src={perfume.image || PERFUME_IMAGE_FALLBACK}
                          alt=""
                          aria-hidden="true"
                          onError={(event) => {
                            event.currentTarget.onerror = null;
                            event.currentTarget.src = PERFUME_IMAGE_FALLBACK;
                          }}
                        />
                        <span>{perfume.shortName || perfume.name}</span>
                      </button>
                      {isDetailOpen && (
                        <DnaQuickDetail
                          id={detailId}
                          accord={accord}
                          perfume={perfume}
                          tierName={getTierData(perfume.id).name}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

        <div className="dna-modal-section">
          <span>Selected Matches</span>

          {matchingSelectedPerfumes.length > 0 ? (
            <div className="dna-match-list">
              {matchingSelectedPerfumes.map(({ perfume, index }) => (
                <DnaPerfumeRow
                  key={`${perfume.id}-${index}`}
                  accord={accord}
                  perfume={perfume}
                  actionLabel="Remove"
                  supportingAccords={getSupportingAccords(perfume, accord)}
                  isDetailOpen={
                    visibleQuickDetailId === perfume.id &&
                    visibleQuickDetailSource === "row"
                  }
                  onToggleDetail={() => handleSetActiveQuickDetailId(perfume.id, "row")}
                  onAction={() => onRemovePerfume(index)}
                />
              ))}
            </div>
          ) : (
            <p className="dna-empty-message">
              No selected fragrances currently contribute to this accord.
            </p>
          )}
        </div>

        <div className="dna-modal-section">
          <span>Expand this accord</span>
          <p className="dna-section-helper">
            Recommended additions that reinforce this character while introducing new facets.
          </p>

          {similarPicks.length > 0 ? (
            <div className="dna-match-list">
              {similarPicks.map(({ perfume, reason }) => (
                <DnaPerfumeRow
                  key={perfume.id}
                  accord={accord}
                  perfume={perfume}
                  actionLabel={isBoxFull ? "Box full" : "Add to box"}
                  supportingAccords={getSupportingAccords(perfume, accord)}
                  recommendationReason={reason}
                  isDetailOpen={
                    visibleQuickDetailId === perfume.id &&
                    visibleQuickDetailSource === "row"
                  }
                  onToggleDetail={() => handleSetActiveQuickDetailId(perfume.id, "row")}
                  onAction={() => onAddPerfume(perfume)}
                  isActionDisabled={isBoxFull}
                />
              ))}
            </div>
          ) : (
            <p className="dna-empty-message">
              No additional catalog options currently match this accord.
            </p>
          )}
        </div>
        </div>
      </section>
    </div>,
    document.body
  );
}

function DnaPerfumeRow({
  accord,
  perfume,
  actionLabel,
  supportingAccords,
  recommendationReason,
  isDetailOpen,
  onToggleDetail,
  onAction,
  isActionDisabled = false,
}) {
  const tierData = getTierData(perfume.id);
  const detailId = `dna-detail-${perfume.id}`;

  return (
    <article className={`dna-perfume-row ${isDetailOpen ? "is-detail-open" : ""}`}>
      <button
        type="button"
        className="dna-row-image-button dna-row-detail-trigger"
        onClick={onToggleDetail}
        aria-label={`Inspect ${perfume.name} bottle`}
        aria-expanded={isDetailOpen}
        aria-controls={isDetailOpen ? detailId : undefined}
      >
        <img
          src={perfume.image || PERFUME_IMAGE_FALLBACK}
          alt=""
          aria-hidden="true"
          onError={(event) => {
            event.currentTarget.onerror = null;
            event.currentTarget.src = PERFUME_IMAGE_FALLBACK;
          }}
        />
      </button>

      <div>
        <button
          type="button"
          className="dna-row-name-button dna-row-detail-trigger"
          onClick={onToggleDetail}
          aria-label={`Inspect ${perfume.name} details`}
          aria-expanded={isDetailOpen}
          aria-controls={isDetailOpen ? detailId : undefined}
        >
          {perfume.name}
        </button>
        {perfume.subtitle && (
          <span className="selected-subtitle">
            {perfume.subtitle
              .toLowerCase()
              .replace(/\b\w/g, (char) => char.toUpperCase())}
          </span>
        )}
        <span>{perfume.brand}</span>
        <p>
          {tierData.name} · {perfume.points} pt
          {supportingAccords.length > 0
            ? ` · ${supportingAccords.map(formatIntelligenceLabel).join(", ")}`
            : ""}
        </p>
      </div>

      <button type="button" onClick={onAction} disabled={isActionDisabled}>
        {actionLabel}
      </button>

      {recommendationReason && (
        <p className="dna-recommendation-reason">{recommendationReason}</p>
      )}

      {isDetailOpen && (
        <DnaQuickDetail
          id={detailId}
          accord={accord}
          perfume={perfume}
          tierName={tierData.name}
        />
      )}
    </article>
  );
}

function DnaStrengthMeter({ strength }) {
  const filledSegments = getStrengthSegmentCount(strength.level);

  return (
    <span
      className="dna-strength-meter"
      aria-label={`${strength.level} accord strength, ${filledSegments} of 5`}
    >
      {Array.from({ length: 5 }, (_, index) => (
        <i
          aria-hidden="true"
          className={index < filledSegments ? "is-filled" : ""}
          key={index}
        />
      ))}
    </span>
  );
}

function DnaQuickDetail({ id, accord, perfume, tierName }) {
  const activeAccord = normalizeAccordLabel(accord);
  const topNotes = getPerfumeNoteLabels(perfume).slice(0, 5);
  const occasions = (perfume.occasions || []).slice(0, 3);
  const seasonsOrVibes = [
    ...(perfume.seasons || []).slice(0, 3),
    ...(perfume.vibes || []).slice(0, 3),
  ].slice(0, 4);

  return (
    <div className="dna-quick-detail" id={id}>
      <div>
        <strong>{perfume.name}</strong>
        <span>
          {perfume.brand} · {tierName}
        </span>
      </div>

      <div className="dna-quick-detail-tags">
        {(perfume.accords || []).slice(0, 5).map((item) => {
          const isActive = normalizeAccordLabel(item) === activeAccord;
          return (
            <span className={isActive ? "is-active" : ""} key={item}>
              {formatIntelligenceLabel(item)}
            </span>
          );
        })}
      </div>

      {topNotes.length > 0 && (
        <p>
          <span>Notes</span> {topNotes.join(", ")}
        </p>
      )}
      {occasions.length > 0 && (
        <p>
          <span>Occasions</span> {occasions.map(formatIntelligenceLabel).join(", ")}
        </p>
      )}
      {seasonsOrVibes.length > 0 && (
        <p>
          <span>Profile</span> {seasonsOrVibes.map(formatIntelligenceLabel).join(", ")}
        </p>
      )}
    </div>
  );
}

function getAccordCounts(boxSummary) {
  return Object.fromEntries(
    Object.entries(boxSummary.accordMap || {}).map(([accord, perfumeNames]) => [
      accord,
      perfumeNames.length,
    ])
  );
}

function ProfileSummaryGroup({ label, values }) {
  if (values.length === 0) {
    return null;
  }

  return (
    <div>
      <span>{label}</span>
      <div className="summary-tags">
        {values.map((item) => <span key={item}>{item}</span>)}
      </div>
    </div>
  );
}

function ScentLibraryModal({ notes, onClose }) {
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  return createPortal(
    <div className="modal-overlay scent-library-overlay" onClick={onClose}>
      <div
        className="modal-content scent-library-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="scent-library-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal-header">
          <h3 id="scent-library-title">Scent Library</h3>

          <button type="button" onClick={onClose} aria-label="Close Scent Library">
            X
          </button>
        </div>

        <div className="notes-grid">
          {notes.map((note) => (
            <span key={note} className="note-pill">
              {note}
            </span>
          ))}
        </div>
      </div>
    </div>,
    document.body
  );
}

function buildHiddenCuratorPicks(recommendations, selectedPerfumeIds) {
  const availableRecommendations = recommendations.filter(
    (recommendation) => !selectedPerfumeIds.has(recommendation.perfume.id)
  );
  const bronzePicks = availableRecommendations
    .filter((recommendation) => getTierData(recommendation.perfume.id).name === "Bronze")
    .slice(0, 2);

  if (bronzePicks.length >= 2) {
    return bronzePicks.map((recommendation) => recommendation.perfume);
  }

  const goldPick = availableRecommendations.find(
    (recommendation) => getTierData(recommendation.perfume.id).name === "Gold"
  );

  if (goldPick) {
    return [goldPick.perfume];
  }

  return availableRecommendations
    .slice(0, 1)
    .map((recommendation) => recommendation.perfume);
}

const CuratorBonusModule = forwardRef(function CuratorBonusModule(
  {
    builderConfig,
    totalPoints,
    totalSlots,
    minSlots,
    isUnlocked,
    isAnimating,
    preference,
    onPreferenceChange,
    hiddenCuratorPicks,
  },
  ref
) {
  const DISCOVERY_BONUS_TARGET_POINTS = builderConfig.curatorBonus.targetPoints;
  const CURATOR_BONUS_PREFERENCES = builderConfig.curatorBonus.preferences;
  const preferenceData = CURATOR_BONUS_PREFERENCES[preference];
  const hiddenPickCount = hiddenCuratorPicks.length;
  const progressValue = Math.min(totalPoints, DISCOVERY_BONUS_TARGET_POINTS);
  const progressPercent =
    (progressValue / DISCOVERY_BONUS_TARGET_POINTS) * 100;
  const pointsAway = Math.max(
    DISCOVERY_BONUS_TARGET_POINTS - totalPoints,
    0
  );
  const fragrancesAway = Math.max(minSlots - totalSlots, 0);
  const hasRequiredPoints = totalPoints >= DISCOVERY_BONUS_TARGET_POINTS;
  const hasRequiredFragrances = totalSlots >= minSlots;
  const lockedMessage = !hasRequiredPoints
    ? `${pointsAway.toFixed(1)} point${
        pointsAway === 1 ? "" : "s"
      } away from unlocking your Curator Bonus`
    : `Need ${fragrancesAway} more fragrance${
        fragrancesAway === 1 ? "" : "s"
      } to unlock your Curator Bonus`;

  return (
    <section
      ref={ref}
      className={`discovery-bonus-panel curator-bonus-section ${
        isUnlocked ? "unlocked" : "locked"
      } ${isAnimating ? "is-unlocking" : ""}`}
    >
      <div className="discovery-progress-header">
        <div>
          <span>{builderConfig.curatorBonus.label}</span>
          <strong>Progress & Reward</strong>
        </div>

        <span className="discovery-bonus-state">
          {isUnlocked ? "Unlocked" : "Locked"}
        </span>
      </div>

      <div className="discovery-progress-bar" aria-hidden="true">
        <div style={{ width: `${progressPercent}%` }} />
      </div>

      <div className="discovery-requirements">
        <RequirementLine
          isMet={hasRequiredPoints}
          value={`${progressValue.toFixed(1)} / ${DISCOVERY_BONUS_TARGET_POINTS} Points`}
        />
        <RequirementLine
          isMet={hasRequiredFragrances}
          value={`${Math.min(totalSlots, minSlots)} / ${minSlots} Fragrances`}
        />
      </div>

      <p className="discovery-progress-copy">
        {isUnlocked ? builderConfig.curatorBonus.progressCopy.unlocked : lockedMessage}
      </p>

      {isAnimating && (
        <div className="curator-unlock-confirmation" role="status">
          {builderConfig.curatorBonus.progressCopy.unlocked}
        </div>
      )}

      {(!isUnlocked || isAnimating) && (
        <div className="curator-lock-visual" aria-hidden="true">
          <span />
        </div>
      )}

      <div className="curator-bonus-card">
        <div className="curator-bonus-copy">
          {!isUnlocked && <strong>{builderConfig.curatorBonus.progressCopy.lockedCompletion}</strong>}
          <p>
            {isUnlocked
              ? `${preferenceData.label} selected. Your curator pick${
                  hiddenPickCount === 1 ? "" : "s"
                } will stay wrapped until reveal.`
              : builderConfig.curatorBonus.progressCopy.lockedStrategy}
          </p>
        </div>

        {isUnlocked ? (
          <div className="curator-preference-control">
            <label htmlFor="curator-bonus-preference">
              {builderConfig.curatorBonus.label} Style
            </label>

            <select
              id="curator-bonus-preference"
              value={preference}
              onChange={(event) => onPreferenceChange(event.target.value)}
            >
              {Object.entries(CURATOR_BONUS_PREFERENCES).map(
                ([value, option]) => (
                  <option key={value} value={value}>
                    {option.label}
                  </option>
                )
              )}
            </select>

            <p>{preferenceData.description}</p>
          </div>
        ) : (
          <div className="curator-style-locked" aria-disabled="true">
            <span>{builderConfig.curatorBonus.label} Style</span>
            <strong>Unlock to choose curator style</strong>
          </div>
        )}

        <div className={`curator-pick-slot ${isUnlocked ? "active" : ""}`}>
          <span>Curator Pick</span>
          <strong>{builderConfig.curatorBonus.rewardLabel}</strong>
          <p>{builderConfig.curatorBonus.progressCopy.pickValue}</p>
          {isUnlocked && (
            <p>
              {preference === "similar"
                ? builderConfig.curatorBonus.progressCopy.similarSelected
                : builderConfig.curatorBonus.progressCopy.complementSelected}
            </p>
          )}
        </div>
      </div>
    </section>
  );
});

function RequirementLine({ isMet, value }) {
  return (
    <p className={`discovery-requirement ${isMet ? "met" : "missing"}`}>
      <span aria-hidden="true" />
      {value}
    </p>
  );
}

function BoxIntelligenceSummary({ intelligence }) {
  if (!intelligence?.items?.length) {
    return null;
  }

  return (
    <section className="box-intelligence" aria-label="Box Intelligence">
      <div className="box-intelligence-header">
        <h3>Box Intelligence</h3>
        {intelligence.isEarly && <span>Early read</span>}
      </div>

      <div className="box-intelligence-grid">
        {intelligence.items.map((item) => (
          <div className="box-intelligence-item" key={item.type}>
            <span>{item.label}</span>
            <strong>{item.value}</strong>
          </div>
        ))}
      </div>
    </section>
  );
}

function DiscoveryBoxReviewModal({
  builderConfig,
  selectedPerfumes,
  totalPoints,
  estimatedValue,
  boxSummary,
  coverageSummary,
  isBoxReady,
  isCuratorBonusUnlocked,
  curatorBonusPreference,
  curatorInsight,
  hiddenCuratorPicks,
  customerInfo,
  onCustomerInfoChange,
  onClose,
}) {
  const [finalizeStatus, setFinalizeStatus] = useState("");
  const [fallbackWhatsAppUrl, setFallbackWhatsAppUrl] = useState("");
  const collectionIdentity = getCollectionIdentity(boxSummary);
  const curatorPreferenceLabel =
    builderConfig.curatorBonus.preferences[curatorBonusPreference]?.label;
  const seasonRows = buildCollectionCardSeasonRows(
    boxSummary.seasonStrengths || boxSummary.seasonCounts || {},
    selectedPerfumes.length
  );
  const collectionReview = buildCuratedCollectionReview({
    boxSummary,
    coverageSummary,
    selectedPerfumes,
    seasonRows,
    collectionIdentity,
    curatorInsight,
  });
  const strengths = collectionReview.strengths;
  const opportunities = collectionReview.opportunities;
  const assessmentBadge = collectionReview.assessmentBadge;
  const assessmentSummary = collectionReview.assessmentSummary;
  const curatorRewardLabel =
    hiddenCuratorPicks.length > 1
      ? builderConfig.curatorBonus.rewardPluralLabel
      : builderConfig.curatorBonus.rewardLabel;
  const finalizationModel = useMemo(
    () =>
      buildFinalizationModel({
        selectedPerfumes,
        totalPoints,
        estimatedValue,
        isCollectionReady: isBoxReady,
        customerInfo,
        curatorBonus: {
          isUnlocked: isCuratorBonusUnlocked,
          preferenceLabel: curatorPreferenceLabel,
          rewardLabel: curatorRewardLabel,
        },
        config: builderConfig,
      }),
    [
      selectedPerfumes,
      totalPoints,
      estimatedValue,
      isBoxReady,
      customerInfo,
      isCuratorBonusUnlocked,
      curatorPreferenceLabel,
      curatorRewardLabel,
      builderConfig,
    ]
  );
  const canFinalize = finalizationModel.readiness.isReady;

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  function handleCustomerInfoChange(field, value) {
    onCustomerInfoChange((currentInfo) => ({
      ...currentInfo,
      [field]: value,
    }));
  }

  async function handleFinalizeBox() {
    if (!canFinalize) {
      setFinalizeStatus("Enter customer name and city before finalizing.");
      return;
    }

    const whatsappMessage = finalizationModel.message;
    const whatsappUrl = `https://wa.me/${builderConfig.finalization.whatsappNumber}?text=${encodeURIComponent(
      whatsappMessage
    )}`;
    const openedWindow = window.open(whatsappUrl, "_blank");
    if (openedWindow) {
      openedWindow.opener = null;
    }
    const didCopy = await copyText(whatsappMessage);

    if (!openedWindow) {
      setFallbackWhatsAppUrl(whatsappUrl);
      setFinalizeStatus(
        didCopy
          ? builderConfig.finalization.whatsapp.blockedCopied
          : builderConfig.finalization.whatsapp.blockedManual
      );
      return;
    }

    setFallbackWhatsAppUrl("");
    setFinalizeStatus(
      didCopy
        ? formatConfigCopy(builderConfig.finalization.whatsapp.openingCopied, {
            businessName: builderConfig.brand.businessName,
          })
        : formatConfigCopy(builderConfig.finalization.whatsapp.opening, {
            businessName: builderConfig.brand.businessName,
          })
    );
  }

  return createPortal(
    <div className="modal-overlay final-summary-overlay" onClick={onClose}>
      <div
        className="final-summary-modal discovery-review-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="discovery-review-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal-header">
          <div>
            <h3 id="discovery-review-title">Your personalized fragrance collection is ready.</h3>
          </div>

          <button type="button" onClick={onClose}>Close</button>
        </div>

        <section className="final-summary-section review-overview-section">
          <div className="review-section-heading">
            <span>Curator Assessment</span>
            <h4>{collectionIdentity.name}</h4>
            <strong className="review-assessment-badge">{assessmentBadge}</strong>
            <p>{assessmentSummary}</p>
          </div>

          <h5>Season Coverage</h5>

          <div className="season-coverage-bars">
            {seasonRows.map((season) => (
              <div className="season-coverage-row" key={season.id}>
                <span>{season.label}</span>
                <div className="season-coverage-track" aria-label={`${season.label} coverage`}>
                  <i style={{ width: `${season.percent}%` }} />
                </div>
                <strong>{season.count}</strong>
              </div>
            ))}
          </div>
        </section>

        <section className="final-summary-section review-insight-section">
          <div>
            <h4>Collection Strengths</h4>

            {strengths.length > 0 ? (
              <ul className="review-list review-list-check">
                {strengths.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            ) : (
              <p>Your collection is ready, with more detail appearing as it gains variety.</p>
            )}
          </div>

          <div>
            <h4>Opportunities</h4>

            {opportunities.length > 0 ? (
              <ul className="review-list review-list-bullet">
                {opportunities.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            ) : (
              <p>No major opportunities detected. This box has a well-rounded profile.</p>
            )}
          </div>
        </section>

        <section className="final-summary-section review-curator-note-section">
          <div className="review-section-heading">
            <span>Curator Notes</span>
            <h4>Closing Notes</h4>
          </div>

          <p>{collectionReview.curatorNote}</p>
        </section>

        <section className="final-summary-section review-curator-section">
          <h4>{builderConfig.curatorBonus.label}</h4>

          <div className="review-curator-grid">
            <div>
              <span>Curator Style</span>
              <strong>{curatorPreferenceLabel}</strong>
            </div>

            <div>
              <span>Curator Reward</span>
              <strong>{curatorRewardLabel}</strong>
              <p>
                {isCuratorBonusUnlocked
                  ? builderConfig.copy.reviewCuratorUnlockedCopy
                  : builderConfig.copy.reviewCuratorLockedCopy}
              </p>
            </div>
          </div>
        </section>

        <section className="final-summary-section review-order-section">
          <h4>Order Summary</h4>

          <section className="final-summary-stats review-order-stats">
            <SummaryStat label="Fragrances" value={finalizationModel.order.totalSlots} />
            <SummaryStat
              label="Total Points"
              value={finalizationModel.order.totalPoints.toFixed(1)}
            />
            <SummaryStat
              label="Order Total"
              value={`$${finalizationModel.order.monetaryTotal.toFixed(0)}`}
            />
            <SummaryStat
              label={builderConfig.curatorBonus.label}
              value={finalizationModel.order.curatorBonus.isUnlocked ? "Unlocked" : "Locked"}
            />
          </section>
        </section>

        <section className="final-summary-section review-customer-section">
          <h4>Finalize Details</h4>

          <div className="review-customer-form">
            <label>
              <span>{builderConfig.finalization.customerFieldLabels.name}</span>
              <input
                type="text"
                value={customerInfo.name}
                onChange={(event) =>
                  handleCustomerInfoChange("name", event.target.value)
                }
                placeholder="Required"
              />
            </label>

            <label>
              <span>{builderConfig.finalization.customerFieldLabels.city}</span>
              <input
                type="text"
                value={customerInfo.city}
                onChange={(event) =>
                  handleCustomerInfoChange("city", event.target.value)
                }
                placeholder="Required"
              />
            </label>

            <label className="review-notes-field">
              <span>Notes</span>
              <textarea
                value={customerInfo.notes}
                onChange={(event) =>
                  handleCustomerInfoChange("notes", event.target.value)
                }
                placeholder="Optional preferences or delivery notes"
                rows={2}
              />
            </label>
          </div>
        </section>

        <div className="review-modal-footer">
          <button type="button" className="secondary" onClick={onClose}>
            Continue Editing
          </button>

          <button type="button" onClick={handleFinalizeBox} disabled={!canFinalize}>
            Finalize Box
          </button>
        </div>

        {finalizeStatus && <p className="review-finalize-status">{finalizeStatus}</p>}

        {fallbackWhatsAppUrl && (
          <a
            className="review-whatsapp-fallback"
            href={fallbackWhatsAppUrl}
            target="_blank"
            rel="noreferrer"
          >
            {builderConfig.finalization.whatsapp.manualOpenLabel}
          </a>
        )}
      </div>
    </div>,
    document.body
  );
}

function buildCuratedCollectionReview({
  boxSummary,
  coverageSummary,
  selectedPerfumes,
  seasonRows,
  collectionIdentity,
  curatorInsight,
}) {
  const selectedCount = selectedPerfumes.length;
  const occasionCounts = boxSummary.occasionCounts || {};
  const vibeCounts = boxSummary.vibeCounts || {};
  const accordCounts = getAccordCounts(boxSummary);
  const seasonScores = Object.fromEntries(
    seasonRows.map((season) => [season.id, season.count])
  );
  const dailySignals =
    (occasionCounts.daily || 0) +
    (occasionCounts.office || 0) +
    (occasionCounts.casual || 0);
  const eveningSignals =
    (occasionCounts.date || 0) +
    (occasionCounts.night || 0) +
    (occasionCounts.evening || 0);
  const formalSignals = (occasionCounts.formal || 0) + (occasionCounts.office || 0);
  const freshSignals =
    (vibeCounts.fresh || 0) +
    (vibeCounts.clean || 0) +
    (accordCounts.citrus || 0) +
    (accordCounts.fresh || 0) +
    (accordCounts.green || 0);
  const warmSignals =
    (vibeCounts.warm || 0) +
    (vibeCounts.cozy || 0) +
    (vibeCounts.seductive || 0) +
    (accordCounts.amber || 0) +
    (accordCounts.vanilla || 0) +
    (accordCounts["warm spicy"] || 0) +
    (accordCounts.tobacco || 0);
  const darkSignals =
    (vibeCounts.dark || 0) +
    (vibeCounts.bold || 0) +
    (accordCounts.smoky || 0) +
    (accordCounts.leather || 0) +
    (accordCounts.oud || 0);
  const polishedSignals =
    (vibeCounts.elegant || 0) +
    (vibeCounts.sophisticated || 0) +
    (vibeCounts.classic || 0) +
    (accordCounts.iris || 0) +
    (accordCounts.powdery || 0);
  const activeSeasonCount = Object.values(seasonScores).filter((score) => score >= 35).length;
  const minSeasonScore = Math.min(...Object.values(seasonScores));
  const maxSeasonScore = Math.max(...Object.values(seasonScores));
  const seasonBalance = maxSeasonScore > 0 ? minSeasonScore / maxSeasonScore : 0;
  const uniqueOccasionCount = Object.values(occasionCounts).filter((count) => count > 0).length;
  const reviewSignals = {
    selectedCount,
    occasionCounts,
    vibeCounts,
    accordCounts,
    dailySignals,
    eveningSignals,
    formalSignals,
    freshSignals,
    warmSignals,
    darkSignals,
    polishedSignals,
    activeSeasonCount,
    seasonBalance,
    uniqueOccasionCount,
  };
  const strengthItems = getCollectionStrengths(reviewSignals, curatorInsight);
  const opportunityItems = getGrowthOpportunities(
    reviewSignals,
    curatorInsight,
    coverageSummary,
    strengthItems
  );
  const assessmentBadge = getAssessmentBadge({
    collectionIdentity,
    ...reviewSignals,
    strengthKeys: strengthItems.map((item) => item.key),
    opportunityCount: opportunityItems.length,
  });
  const assessmentSummary = getAssessmentSummary({
    collectionIdentity,
    strengths: strengthItems,
    opportunities: opportunityItems,
    ...reviewSignals,
  });
  const curatorNote = buildCuratorNote({
    collectionIdentity,
    strengths: strengthItems,
    primaryOpportunity: opportunityItems[0],
    ...reviewSignals,
  });
  const semanticAudit = {
    identity: collectionIdentity.name,
    badge: assessmentBadge,
    strengthKeys: strengthItems.map((item) => item.key),
    opportunityKeys: opportunityItems.map((item) => item.key),
    curatorNoteOpportunityKey: opportunityItems[0]?.key || "none",
  };

  return {
    semanticAudit,
    assessmentBadge,
    assessmentSummary: normalizeSentence(assessmentSummary),
    strengths:
      strengthItems.length > 0
        ? strengthItems.map((item) => normalizeListItem(item.text))
        : ["A clear collection profile is beginning to take shape"],
    opportunities: opportunityItems.map((item) => normalizeListItem(item.text)),
    curatorNote: normalizeParagraph(curatorNote),
  };
}

function getAssessmentBadge({
  collectionIdentity,
  selectedCount,
  dailySignals,
  eveningSignals,
  seasonBalance,
  uniqueOccasionCount,
  freshSignals,
  warmSignals,
  darkSignals,
  polishedSignals,
  strengthKeys,
  opportunityCount,
}) {
  if (selectedCount < 4) {
    return "Developing Collection";
  }

  if (/evening/i.test(collectionIdentity.name) && eveningSignals >= 3) {
    return warmSignals + darkSignals >= freshSignals
      ? "Confident Evening Character"
      : "Versatile After-Dark Profile";
  }

  if (/fresh|daily|versatile/i.test(collectionIdentity.name) && dailySignals >= 4) {
    return polishedSignals >= 3 ? "Refined Daily Wear" : "Strong Daily Rotation";
  }

  if (/balanced/i.test(collectionIdentity.name) && seasonBalance >= 0.58 && uniqueOccasionCount >= 4) {
    return "Excellent Balance";
  }

  if (strengthKeys.includes("dailyVersatility")) {
    return "Highly Versatile";
  }

  if (polishedSignals >= 4 || darkSignals >= 3) {
    return "Distinctive Character";
  }

  if (uniqueOccasionCount >= 4) {
    return "Highly Versatile";
  }

  if (seasonBalance >= 0.62 && uniqueOccasionCount >= 5 && opportunityCount <= 1) {
    return "Excellent Balance";
  }

  return "Well Rounded";
}

function getAssessmentSummary({
  collectionIdentity,
  freshSignals,
  warmSignals,
  polishedSignals,
  eveningSignals,
  dailySignals,
  uniqueOccasionCount,
  strengths,
}) {
  const character = getCollectionCharacterPhrase({
    freshSignals,
    warmSignals,
    polishedSignals,
    eveningSignals,
  });
  const performance =
    dailySignals >= 4 && eveningSignals >= 2
      ? "moving comfortably from daytime wear into evening use"
      : dailySignals >= 4
        ? "built for reliable everyday wear"
        : eveningSignals >= 3
          ? "with a clear after-dark point of view"
          : uniqueOccasionCount >= 4
            ? "with enough range for varied settings"
            : "with a focused but still flexible profile";
  const strengthPhrase = strengths[0]
    ? ` The strongest impression is ${lowercaseFirst(strengths[0].text)}.`
    : "";

  return `${sentenceCase(`${getArticle(collectionIdentity.name)} ${collectionIdentity.name.toLowerCase()}`)} with ${character}, ${performance}.${strengthPhrase}`;
}

function getCollectionStrengths(signals, curatorInsight) {
  const {
    selectedCount,
    dailySignals,
    formalSignals,
    eveningSignals,
    freshSignals,
    warmSignals,
    darkSignals,
    polishedSignals,
    activeSeasonCount,
    seasonBalance,
    uniqueOccasionCount,
  } = signals;
  const candidates = [
    selectedCount >= 6 && dailySignals >= Math.max(4, selectedCount * 0.65)
      ? createReviewItem("dailyVersatility", "Excellent everyday versatility", 96)
      : null,
    selectedCount >= 5 && dailySignals >= 3 && formalSignals >= 2
      ? createReviewItem("officeWear", "Strong office and casual rotation", 88)
      : null,
    selectedCount >= 6 && seasonBalance >= 0.55
      ? createReviewItem("warmCoolBalance", "Balanced warm and cool weather selection", 84)
      : null,
    selectedCount >= 6 && activeSeasonCount >= 3
      ? createReviewItem("seasonalBalance", "Wide seasonal flexibility", 78)
      : null,
    uniqueOccasionCount >= 4
      ? createReviewItem("occasionRange", "Covers most daily situations confidently", 82)
      : null,
    polishedSignals >= 4
      ? createReviewItem("signaturePotential", "Great signature scent potential", 80)
      : null,
    eveningSignals >= 3 && darkSignals + warmSignals >= 4
      ? createReviewItem("eveningDepth", "Confident evening presence", 92)
      : null,
    freshSignals >= 4 && polishedSignals >= 2
      ? createReviewItem("freshContrast", "Refined fresh-clean character", 76)
      : null,
    ...(curatorInsight?.strengths || []).map((strength) =>
      rewriteReviewStrength(strength)
    ),
  ];

  return removeSimilarReviewItems(
    candidates.filter(Boolean).filter(
      (strength) => !isSeasonChartRestatement(strength.text)
    )
  )
    .sort((first, second) => second.score - first.score)
    .slice(0, 4);
}

function getGrowthOpportunities(signals, curatorInsight, coverageSummary, strengths = []) {
  const {
    accordCounts,
    darkSignals,
    eveningSignals,
    warmSignals,
    freshSignals,
    polishedSignals,
    formalSignals,
  } = signals;
  const candidates = [
    darkSignals < 2
      ? createReviewItem("earthyDepth", "Could benefit from darker earthy or smoky depth", 84)
      : null,
    eveningSignals < 2 || warmSignals < 2
      ? createReviewItem("eveningDepth", "Could use richer evening character", 82)
      : null,
    (accordCounts["warm spicy"] || 0) < 1 && warmSignals < 4
      ? createReviewItem("spicyWarmth", "Limited spicy warmth", 76)
      : null,
    (accordCounts.green || 0) < 1 && freshSignals < 4
      ? createReviewItem("greenFreshness", "A greener aromatic profile would add freshness", 72)
      : null,
    polishedSignals < 2 && formalSignals < 2
      ? createReviewItem("formalElegance", "Could benefit from more formal elegance", 74)
      : null,
    (accordCounts.citrus || 0) < 1 && freshSignals < 3
      ? createReviewItem("freshContrast", "A brighter citrus profile would add contrast", 78)
      : null,
    ...(curatorInsight?.improvementGoals || []).map((opportunity) =>
      rewriteReviewOpportunity(opportunity)
    ),
    ...(coverageSummary.gaps || []).map((gap) => rewriteCoverageGap(gap)),
  ];

  return removeSimilarReviewItems(
    candidates.filter(Boolean).filter(
      (opportunity) =>
        !isSeasonChartRestatement(opportunity.text) &&
        !doesOpportunityConflictWithStrength(opportunity, strengths)
    )
  )
    .sort((first, second) => second.score - first.score)
    .slice(0, 3);
}

function rewriteReviewStrength(strength) {
  const safeStrength = toSafeString(strength);
  const normalized = safeStrength.toLowerCase();

  if (/daily|versatility|everyday/.test(normalized)) {
    return createReviewItem("dailyVersatility", "Excellent everyday versatility", 70);
  }

  if (/evening|date|night/.test(normalized)) {
    return createReviewItem("eveningDepth", "Confident evening presence", 70);
  }

  if (/fresh/.test(normalized)) {
    return createReviewItem("freshContrast", "Refined fresh-clean character", 68);
  }

  if (/cold|winter|warm/.test(normalized)) {
    return createReviewItem("warmCoolBalance", "Strong cool-weather depth", 66);
  }

  if (/formal|office/.test(normalized)) {
    return createReviewItem("officeWear", "Strong office and dressed-up rotation", 66);
  }

  return createReviewItem(getReviewItemTopic(safeStrength), sentenceCase(safeStrength), 50);
}

function rewriteReviewOpportunity(opportunity) {
  const safeOpportunity = toSafeString(opportunity);
  const normalized = safeOpportunity.toLowerCase();

  if (/adds?\s+(.+?)\s+depth currently missing/i.test(safeOpportunity)) {
    const match = safeOpportunity.match(/adds?\s+(.+?)\s+depth currently missing/i);
    const phrase = formatPhrase(match?.[1] || "");
    return createReviewItem(
      `${phrase || "textural"}Depth`,
      `Could benefit from greater ${phrase} depth`,
      64
    );
  }

  if (/cold|winter|warm/.test(normalized)) {
    return createReviewItem("spicyWarmth", "Could use richer evening warmth", 62);
  }

  if (/summer|fresh/.test(normalized)) {
    return createReviewItem("freshContrast", "Could use brighter fresh contrast", 66);
  }

  if (/evening|date|night/.test(normalized)) {
    return createReviewItem("eveningDepth", "Could use richer evening character", 62);
  }

  if (/woody|leather|earth/.test(normalized)) {
    return createReviewItem("earthyDepth", "Could benefit from darker earthy depth", 62);
  }

  if (/formal|office/.test(normalized)) {
    return createReviewItem("formalElegance", "Could benefit from more formal elegance", 62);
  }

  return createReviewItem(getReviewItemTopic(safeOpportunity), sentenceCase(safeOpportunity), 45);
}

function rewriteCoverageGap(gap) {
  if (gap.category === "seasons") {
    const copy = {
      spring: createReviewItem("greenFreshness", "Could use more green aromatic lift", 46),
      summer: createReviewItem("freshContrast", "Could use brighter fresh contrast", 48),
      fall: createReviewItem("spicyWarmth", "Could use richer textured warmth", 46),
      winter: createReviewItem("earthyDepth", "Could use deeper cold-weather character", 48),
    };

    return copy[gap.target] || null;
  }

  return rewriteReviewOpportunity(gap.label);
}

function buildCuratorNote({
  strengths = [],
  primaryOpportunity = null,
  eveningSignals,
  dailySignals,
  uniqueOccasionCount,
  selectedCount,
}) {
  const opening =
    selectedCount >= 10
      ? "This is the kind of box that should feel satisfying over repeated wear, with enough range to avoid becoming predictable."
      : selectedCount >= 6
        ? "This box should feel easy to live with, giving you several reliable moods without asking you to overthink the choice."
        : "This box should feel like a clear starting point, with enough personality to make each wear feel intentional.";
  const performance =
    dailySignals >= 4 && eveningSignals >= 2
      ? "You will likely reach for it across office, casual and date-night situations, which is where its range starts to show."
      : dailySignals >= 4
        ? "Its most natural strength is day-to-day wear: polished, dependable and easy to return to."
        : eveningSignals >= 3
          ? "It will feel most at home after dark, where texture and presence matter more than simple freshness."
          : uniqueOccasionCount >= 4
            ? "There is enough flexibility here to move across several settings while still feeling considered."
            : "It remains focused for now, which gives future additions a clear role rather than adding noise.";
  const texture =
    strengths[0]?.text && selectedCount >= 6
      ? ` The collection's quiet advantage is ${lowercaseFirst(strengths[0].text)}.`
      : "";
  const opportunitySentence =
    primaryOpportunity
      ? getOpportunitySentence(primaryOpportunity)
      : "Future additions can be chosen for personal taste rather than correcting a major gap.";

  return `${opening} ${performance}${texture} ${opportunitySentence}`;
}

function getCollectionCharacterPhrase({
  freshSignals,
  warmSignals,
  polishedSignals,
  eveningSignals,
}) {
  if (freshSignals >= warmSignals + 2 && polishedSignals >= 2) {
    return "a polished fresh character and clean versatility";
  }

  if (warmSignals >= freshSignals + 2 && eveningSignals >= 2) {
    return "warm texture, evening depth and a confident signature";
  }

  if (polishedSignals >= 4) {
    return "refined structure, elegance and signature-scent potential";
  }

  if (eveningSignals >= 3) {
    return "a clear evening character and enough depth for after-dark wear";
  }

  if (freshSignals >= warmSignals + 1) {
    return "freshness, clarity and easy daily wear";
  }

  return "balanced freshness and warmth";
}

function getOpportunitySentence(opportunity) {
  const normalized = getReviewItemText(opportunity).toLowerCase();

  if (["freshContrast", "greenFreshness"].includes(opportunity?.key)) {
    return "For future growth, a brighter fresh fragrance would add lift and keep the rotation from feeling too concentrated.";
  }

  if (["spicyWarmth", "earthyDepth"].includes(opportunity?.key)) {
    return "For future growth, a richer textured fragrance would add shadow and make the wardrobe feel more dimensional.";
  }

  if (opportunity?.key === "formalElegance") {
    return "For future growth, a more formal fragrance would add polish for dinners, events and dressed-up occasions.";
  }

  if (/citrus|fresh|green/.test(normalized)) {
    return "For future growth, a brighter fresh fragrance would add lift and keep the rotation from feeling too concentrated.";
  }

  return "For future growth, one more contrasting fragrance would broaden the wardrobe without disturbing its current mood.";
}

function removeSimilarReviewItems(items) {
  const seenTopics = new Set();

  return items.filter((item) => {
    const topic = getReviewItemTopic(getReviewItemText(item) || item?.key);

    if (seenTopics.has(topic)) {
      return false;
    }

    seenTopics.add(topic);
    return true;
  });
}

function createReviewItem(key, text, score = 50) {
  return {
    key: toSafeString(key) || "general",
    text: normalizeListItem(text),
    score,
  };
}

function doesOpportunityConflictWithStrength(opportunity, strengths) {
  const strengthKeys = new Set((strengths || []).map((strength) => strength?.key));
  const directConflicts = {
    dailyVersatility: ["dailyVersatility", "officeWear"],
    officeWear: ["officeWear", "dailyVersatility"],
    eveningDepth: ["eveningDepth"],
    seasonalBalance: ["seasonalBalance", "warmCoolBalance"],
    warmCoolBalance: ["warmCoolBalance", "seasonalBalance"],
    signaturePotential: ["signaturePotential"],
    formalElegance: ["formalElegance", "officeWear"],
    freshContrast: ["freshContrast"],
  };

  return (directConflicts[opportunity?.key] || []).some((key) => strengthKeys.has(key));
}

function getReviewItemText(item) {
  if (!item) {
    return "";
  }

  if (typeof item === "string") {
    return item;
  }

  return toSafeString(item.text);
}

function getReviewItemTopic(item) {
  const normalized = toSafeString(item).toLowerCase();

  if (/season|warm and cool|seasonal|weather/.test(normalized)) return "seasonal-range";
  if (/daily|office|casual|everyday/.test(normalized)) return "daily-range";
  if (/evening|date|night|after-dark/.test(normalized)) return "evening-range";
  if (/formal|elegance|polished|signature/.test(normalized)) return "polish";
  if (/fresh|citrus|green/.test(normalized)) return "freshness";
  if (/warm|spicy|smoky|earthy|depth/.test(normalized)) return "depth";

  return normalized.replace(/[^a-z0-9]+/g, "-");
}

function getArticle(phrase) {
  return /^[aeiou]/i.test(toSafeString(phrase).trim()) ? "an" : "a";
}

function lowercaseFirst(value) {
  const safeValue = toSafeString(value);
  return safeValue
    ? `${safeValue.charAt(0).toLowerCase()}${safeValue.slice(1)}`
    : "";
}

function sentenceCase(value) {
  const cleaned = cleanGeneratedCopy(value);
  return cleaned ? `${cleaned.charAt(0).toUpperCase()}${cleaned.slice(1)}` : "";
}

function formatPhrase(value) {
  return toSafeString(value)
    .trim()
    .replace(/[-_]+/g, " ")
    .toLowerCase();
}

function normalizeSentence(value) {
  const cleaned = cleanGeneratedCopy(value);

  if (!cleaned) {
    return "";
  }

  const withoutTrailingRepeats = cleaned.replace(/[.!?]+$/, "");
  const punctuated = `${withoutTrailingRepeats}.`;
  return sentenceCase(punctuated);
}

function normalizeParagraph(value) {
  return cleanGeneratedCopy(value)
    .split(/(?<=[.!?])\s+/)
    .map(normalizeSentence)
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .replace(/([.!?]){2,}/g, "$1")
    .replace(/,{2,}/g, ",")
    .trim();
}

function normalizeListItem(value) {
  return sentenceCase(cleanGeneratedCopy(value).replace(/[.!?]+$/, ""));
}

function cleanGeneratedCopy(value) {
  return toSafeString(value)
    .replace(/\s+/g, " ")
    .replace(/\s+([,.;:!?])/g, "$1")
    .replace(/([,.;:!?])\1+/g, "$1")
    .replace(/\s+,/g, ",")
    .trim();
}

function toSafeString(value) {
  return typeof value === "string" ? value : "";
}

function isSeasonChartRestatement(value) {
  const safeValue = toSafeString(value);
  return /\b(strong|weak|limited|covered|coverage)\s+(spring|summer|fall|winter)\b/i.test(
    safeValue
  ) || /\b(spring|summer|fall|winter)\s+(covered|coverage)\b/i.test(safeValue);
}

async function copyText(text) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Fall back to a temporary textarea for browsers without clipboard permission.
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.top = "-9999px";
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  textarea.setSelectionRange(0, text.length);

  try {
    return document.execCommand("copy");
  } finally {
    document.body.removeChild(textarea);
  }
}

function NextImprovementSection({
  result,
  selectedPerfumeIds,
  isBoxFull,
  onAddPerfume,
  sectionRef,
  isEmphasized = false,
}) {
  if (!result || result.recommendations.length === 0) {
    return null;
  }

  return (
    <section
      ref={sectionRef}
      className={`next-improvement-section ${isEmphasized ? "is-emphasized" : ""}`}
      aria-label="Next improvement"
    >
      <div className="next-improvement-copy">
        <span>{result.eyebrow}</span>
        <h4 tabIndex={-1}>{result.title}</h4>
        <p>{result.description}</p>
      </div>

      <RecommendationLane
        title="Recommended Next Pick"
        recommendations={result.recommendations}
        selectedPerfumeIds={selectedPerfumeIds}
        isBoxFull={isBoxFull}
        onAddPerfume={onAddPerfume}
        objectiveKey={result.objectiveKey}
      />
    </section>
  );
}

function RecommendationLane(props) {
  const { recommendations, objectiveKey } = props;
  const recommendationSignature = recommendations
    .map((recommendation) => recommendation.perfume.id)
    .join("-");

  return (
    <RecommendationLaneContent
      key={`${objectiveKey || "default"}-${recommendationSignature}`}
      {...props}
    />
  );
}

function RecommendationLaneContent({
  title,
  recommendations,
  selectedPerfumeIds,
  isBoxFull,
  onAddPerfume,
  sectionRef,
  isEmphasized = false,
  objectiveKey,
}) {
  const [activeIndex, setActiveIndex] = useState(0);

  if (recommendations.length === 0) {
    return null;
  }

  const activeRecommendation = recommendations[activeIndex];
  const hasMultipleRecommendations = recommendations.length > 1;
  const goToPrevious = () => {
    setActiveIndex((currentIndex) =>
      currentIndex === 0 ? recommendations.length - 1 : currentIndex - 1
    );
  };
  const goToNext = () => {
    setActiveIndex((currentIndex) =>
      currentIndex === recommendations.length - 1 ? 0 : currentIndex + 1
    );
  };

  return (
    <section
      ref={sectionRef}
      className={`recommendation-lane ${isEmphasized ? "is-emphasized" : ""}`}
    >
      <div className="recommendation-lane-header">
        <h4 tabIndex={-1}>{title}</h4>

        <div className="recommendation-carousel-controls" aria-label={`${title} recommendations`}>
          <button
            type="button"
            onClick={goToPrevious}
            disabled={!hasMultipleRecommendations}
            aria-label={`Previous ${title} recommendation`}
          >
            &lt;
          </button>

          <span>
            {activeIndex + 1} / {recommendations.length}
          </span>

          <button
            type="button"
            onClick={goToNext}
            disabled={!hasMultipleRecommendations}
            aria-label={`Next ${title} recommendation`}
          >
            &gt;
          </button>
        </div>
      </div>

      <div className="recommendation-carousel-card">
        <RecommendationCard
          key={activeRecommendation.perfume.id}
          recommendation={activeRecommendation}
          rank={activeIndex + 1}
          isAdded={selectedPerfumeIds.has(activeRecommendation.perfume.id)}
          isBoxFull={isBoxFull}
          onAddPerfume={onAddPerfume}
          isFocusable
          objectiveKey={objectiveKey}
        />
      </div>
    </section>
  );
}

function RecommendationCard({
  recommendation,
  rank,
  isAdded,
  isBoxFull,
  onAddPerfume,
  isFocusable = false,
  objectiveKey,
}) {
  const { perfume, score } = recommendation;
  const explanations = getRecommendationExplanations(recommendation, objectiveKey);
  const confidence = getRecommendationConfidence(recommendation);
  const imageFallback = "/images/perfumes/placeholders/perfume-placeholder.svg";
  const isAddDisabled = isAdded || isBoxFull;
  const addButtonLabel = isAdded ? "Added" : isBoxFull ? "Box full" : "Add to Box";

  return (
    <article className="recommendation-card" tabIndex={isFocusable ? -1 : undefined}>
      <div className="recommendation-card-header">
        <div className="recommendation-title-group">
          <span className="recommendation-rank">#{rank}</span>

          <div className="recommendation-image">
            <img
              src={perfume.image || imageFallback}
              alt={`${perfume.name} bottle`}
              onError={(event) => {
                event.currentTarget.onerror = null;
                event.currentTarget.src = imageFallback;
              }}
            />
          </div>

          <div>
            <strong>{perfume.name}</strong>
            <span>
              {perfume.brand} · {perfume.points} pt
            </span>
          </div>
        </div>

        <span className="recommendation-score">{score}</span>
      </div>

      <div className="recommendation-intelligence">
        <div className="recommendation-intelligence-header">
          <span>Why this fits</span>
          <span
            className={`recommendation-confidence recommendation-confidence-${confidence
              .toLowerCase()
              .replace(/\s+/g, "-")}`}
          >
            {confidence}
          </span>
        </div>

        <div className="recommendation-reasons">
          {explanations.map((reason) => (
            <p key={reason}>{reason}</p>
          ))}
        </div>
      </div>

      <div className="recommendation-actions">
        <button
          type="button"
          onClick={() => onAddPerfume(perfume)}
          disabled={isAddDisabled}
        >
          {addButtonLabel}
        </button>
      </div>
    </article>
  );
}

const MAX_RECOMMENDATION_EXPLANATIONS = 3;

const LOW_VALUE_RECOMMENDATION_REASON_PATTERNS = [
  /^fits your current box tier$/i,
  /^matches current tier$/i,
  /^similar to daily picks$/i,
  /^shares /i,
  /^good recommendation$/i,
  /^broadens the fragrance palette$/i,
  /^adds variety without changing the mood too much$/i,
];

const RECOMMENDATION_REASON_REWRITES = {
  "Adds high-impact coverage": "Improves multiple coverage gaps",
  "Adds contrast to the current collection": "Adds contrast to your current collection",
  "Expands Spring Coverage": "Expands spring versatility",
  "Expands Summer Coverage": "Expands warm-weather options",
  "Expands Fall Coverage": "Adds fall-season range",
  "Expands Winter Coverage": "Strengthens cold-weather coverage",
  "Improves Season Balance": "Improves seasonal balance",
  "Adds fresh everyday range": "Adds fresh daytime range",
  "Strengthens easy daily wear": "Broadens daily rotation",
  "Adds a useful scent mood": "Adds a distinct scent mood",
  "Adds contrast without changing the mood too much": "Adds contrast within your current style",
};

function getRecommendationExplanations(recommendation, objectiveKey) {
  const reasons = Array.isArray(recommendation.reasons)
    ? recommendation.reasons
    : [];
  const objectiveReasons = objectiveKey
    ? getObjectiveReasonOptions(recommendation, objectiveKey)
    : [];
  const reasonOptions = [
    ...objectiveReasons,
    ...reasons.map((reason) => createRecommendationReasonOption(reason)),
    ...getFallbackRecommendationReasonOptions(recommendation),
  ]
    .filter(Boolean)
    .filter(
      ({ label }) =>
        !LOW_VALUE_RECOMMENDATION_REASON_PATTERNS.some((pattern) =>
          pattern.test(label)
        )
    );

  const selectedReasons = [];
  const seenLabels = new Set();
  const seenCategories = new Set();
  const seenConcepts = new Set();
  const prioritizedOptions = reasonOptions.sort(
    (a, b) => a.priority - b.priority || a.label.localeCompare(b.label)
  );

  prioritizedOptions.forEach((reason) => {
    if (selectedReasons.length >= MAX_RECOMMENDATION_EXPLANATIONS) {
      return;
    }

    const normalizedLabel = normalizeRecommendationReason(reason.label);
    if (seenLabels.has(normalizedLabel)) {
      return;
    }

    const concept = getRecommendationReasonConcept(reason.label);
    if (concept && seenConcepts.has(concept)) {
      return;
    }

    if (reason.category === "affinity" && seenCategories.has("affinity")) {
      return;
    }

    if (
      reason.category !== "objective" &&
      reason.topic &&
      [...seenCategories].some((category) => category === reason.topic)
    ) {
      return;
    }

    selectedReasons.push(reason.label);
    seenLabels.add(normalizedLabel);

    if (concept) {
      seenConcepts.add(concept);
    }

    seenCategories.add(reason.category);

    if (reason.topic) {
      seenCategories.add(reason.topic);
    }
  });

  return selectedReasons.length > 0
    ? selectedReasons
    : [];
}

function getObjectiveReasonOptions(recommendation, objectiveKey) {
  const compatibilityReasons = recommendation.objectiveReasons || [];

  if (compatibilityReasons.length > 0) {
    return compatibilityReasons.map((reason) => ({
      label: reason,
      category: "objective",
      priority: 0,
      topic: objectiveKey,
    }));
  }

  return getObjectiveCompatibilityScore(objectiveKey, recommendation.perfume).reasons.map(
    (reason) => ({
      label: reason,
      category: "objective",
      priority: 0,
      topic: objectiveKey,
    })
  );
}

function createRecommendationReasonOption(reason) {
  const label = polishRecommendationReasonLabel(
    RECOMMENDATION_REASON_REWRITES[reason] || reason
  );

  if (!label) {
    return null;
  }

  const category = getRecommendationReasonCategory(label);

  return {
    label,
    category,
    priority: getRecommendationReasonPriority(category),
    topic: getRecommendationReasonTopic(label),
  };
}

function polishRecommendationReasonLabel(reason) {
  const missingDepthMatch = reason.match(/^Adds (.+) depth currently missing$/);

  if (missingDepthMatch) {
    return getAccordRecommendationCopy(missingDepthMatch[1].toLowerCase());
  }

  return reason;
}

function getFallbackRecommendationReasonOptions(recommendation) {
  const breakdown = recommendation.scoreBreakdown || {};
  const perfume = recommendation.perfume || {};
  const fallbackReasons = [];

  if (breakdown.seasons > 0) {
    const strongestSeason = getStrongestRecommendationSeason(perfume);
    fallbackReasons.push({
      label: strongestSeason
        ? getSeasonRecommendationCopy(strongestSeason)
        : "Improves seasonal balance",
      category: "coverage",
      priority: 1,
      topic: "season",
    });
  }

  if (breakdown.occasions > 0) {
    const occasion = getPreferredRecommendationOccasion(perfume);
    fallbackReasons.push({
      label: occasion
        ? getOccasionRecommendationCopy(occasion)
        : "Improves occasion coverage",
      category: "coverage",
      priority: 1,
      topic: "occasion",
    });
  }

  if (breakdown.vibes > 0) {
    const vibe = getPreferredRecommendationVibe(perfume);
    fallbackReasons.push({
      label: vibe
        ? getVibeRecommendationCopy(vibe)
        : "Adds a distinct scent mood",
      category: "balance",
      priority: 2,
      topic: "vibe",
    });
  }

  if (breakdown.accordDiversity > 0 || breakdown.sharedAccords > 0) {
    const accord = perfume.accords?.[0];
    fallbackReasons.push({
      label: accord
        ? getAccordRecommendationCopy(accord)
        : "Adds a new scent profile",
      category: "balance",
      priority: 2,
      topic: "accord",
    });
  }

  if (breakdown.sharedOccasions > 0) {
    const occasion = getPreferredRecommendationOccasion(perfume);
    fallbackReasons.push({
      label: occasion
        ? getOccasionRecommendationCopy(occasion)
        : "Adds another wearable option",
      category: "support",
      priority: 3,
      topic: "occasion",
    });
  }

  if (breakdown.sharedVibes > 0 || breakdown.sharedSeasons > 0) {
    const vibe = getPreferredRecommendationVibe(perfume);
    fallbackReasons.push({
      label: vibe
        ? getVibeRecommendationCopy(vibe)
        : "Adds a compatible scent profile",
      category: "affinity",
      priority: 4,
      topic: "vibe",
    });
  }

  if (breakdown.noteDiversity > 0) {
    fallbackReasons.push({
      label: "Expands the note palette",
      category: "balance",
      priority: 2,
      topic: "note",
    });
  }

  return fallbackReasons;
}

function getStrongestRecommendationSeason(perfume) {
  const weights = perfume.seasonWeights || {};
  const weightedSeason = Object.entries(weights)
    .filter(([, weight]) => weight > 0)
    .sort(([, weightA], [, weightB]) => weightB - weightA)[0]?.[0];

  return weightedSeason || perfume.seasons?.[0] || "";
}

function getPreferredRecommendationOccasion(perfume) {
  const priority = ["formal", "office", "date", "night", "evening", "daily", "casual"];

  return priority.find((occasion) => perfume.occasions?.includes(occasion)) || perfume.occasions?.[0] || "";
}

function getPreferredRecommendationVibe(perfume) {
  const priority = [
    "warm",
    "dark",
    "seductive",
    "elegant",
    "fresh",
    "clean",
    "energetic",
    "cozy",
    "tropical",
  ];

  return priority.find((vibe) => perfume.vibes?.includes(vibe)) || perfume.vibes?.[0] || "";
}

function getSeasonRecommendationCopy(season) {
  const copy = {
    spring: "Expands spring versatility",
    summer: "Expands warm-weather options",
    fall: "Adds fall-season range",
    winter: "Strengthens cold-weather coverage",
  };

  return copy[season] || `Expands ${formatRecommendationLabel(season)} coverage`;
}

function getOccasionRecommendationCopy(occasion) {
  const copy = {
    office: "Broadens office rotation",
    formal: "Strengthens formal versatility",
    date: "Adds date-night range",
    night: "Adds a darker evening profile",
    evening: "Adds evening versatility",
    daily: "Broadens daily rotation",
    casual: "Adds easy casual wear",
    club: "Adds a stronger night-out option",
    vacation: "Adds a relaxed travel option",
    special: "Adds special-occasion polish",
  };

  return copy[occasion] || `Improves ${formatRecommendationLabel(occasion)} coverage`;
}

function getVibeRecommendationCopy(vibe) {
  const copy = {
    fresh: "Adds fresh brightness",
    clean: "Adds clean versatility",
    warm: "Adds warmth",
    cozy: "Adds cozy depth",
    seductive: "Adds a seductive evening profile",
    dark: "Adds a darker profile",
    elegant: "Adds polished character",
    energetic: "Adds energetic lift",
    tropical: "Adds tropical brightness",
    aquatic: "Brings marine freshness",
    luxurious: "Adds luxury character",
    confident: "Adds confident presence",
    playful: "Adds playful contrast",
    romantic: "Adds romantic softness",
  };

  return copy[vibe] || `Adds ${formatRecommendationLabel(vibe)} character`;
}

function getAccordRecommendationCopy(accord) {
  const copy = {
    citrus: "Adds citrus brightness",
    fresh: "Adds fresh brightness",
    marine: "Brings marine freshness",
    aquatic: "Brings aquatic freshness",
    green: "Increases green freshness",
    woody: "Introduces woody depth",
    aromatic: "Expands aromatic lift",
    "fresh spicy": "Expands fresh-spicy variety",
    "warm spicy": "Expands warm-spicy depth",
    leather: "Adds leather depth",
    smoky: "Adds smoky depth",
    incense: "Adds incense depth",
    amber: "Adds amber warmth",
    vanilla: "Introduces a sweeter direction",
    sweet: "Introduces a sweeter direction",
    powdery: "Adds powdery elegance",
    musky: "Adds musky softness",
    iris: "Adds iris polish",
    floral: "Adds floral lift",
    fruity: "Adds fruity brightness",
    coffee: "Adds roasted depth",
    oud: "Adds niche woody depth",
    tobacco: "Adds tobacco depth",
    mineral: "Adds mineral contrast",
    ozonic: "Adds airy freshness",
    salty: "Adds salty freshness",
  };

  return copy[accord] || `Adds ${formatRecommendationLabel(accord)} character`;
}

function getRecommendationReasonCategory(reason) {
  if (
    /\b(matches|builds on|complements your|stays close|current|preferences|direction|style)\b/i.test(
      reason
    )
  ) {
    return "affinity";
  }

  if (
    /\b(coverage|season|spring|summer|fall|winter|occasion|office|formal|date|night|evening|daily|everyday|wear|versatility|range)\b/i.test(
      reason
    )
  ) {
    return "coverage";
  }

  if (
    /\b(balance|balances|contrast|depth|warmth|warm|cold|missing|underrepresented|diversity|variety|profile|dimension|polish|presence|comfort)\b/i.test(
      reason
    )
  ) {
    return "balance";
  }

  return "support";
}

function getRecommendationReasonPriority(category) {
  if (category === "coverage") {
    return 1;
  }

  if (category === "balance") {
    return 2;
  }

  if (category === "support") {
    return 3;
  }

  return 4;
}

function getRecommendationReasonTopic(reason) {
  if (/\b(spring|summer|fall|winter|season|coverage)\b/i.test(reason)) {
    return "season";
  }

  if (/\b(office|formal|date|night|evening|daily|everyday|occasion|wear)\b/i.test(reason)) {
    return "occasion";
  }

  if (/\b(vibe|mood|profile|direction|style)\b/i.test(reason)) {
    return "vibe";
  }

  if (/\b(accord|woody|aromatic|citrus|fresh|spicy|leather|sweet)\b/i.test(reason)) {
    return "accord";
  }

  if (/\b(note|palette)\b/i.test(reason)) {
    return "note";
  }

  return "";
}

function normalizeRecommendationReason(reason) {
  return reason.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function getRecommendationReasonConcept(reason) {
  if (/\b(citrus|fresh|marine|aquatic|green|airy|salty|warm-weather)\b/i.test(reason)) {
    return "freshness";
  }

  if (/\b(warm|amber|cold-weather|winter|cozy)\b/i.test(reason)) {
    return "warmth";
  }

  if (/\b(date|night|evening|night-out|seductive|darker)\b/i.test(reason)) {
    return "evening";
  }

  if (/\b(office|formal|polished|polish)\b/i.test(reason)) {
    return "polish";
  }

  if (/\b(woody|leather|smoky|incense|oud|roasted|depth)\b/i.test(reason)) {
    return "depth";
  }

  return "";
}

function getRecommendationConfidence(recommendation) {
  const score = Number(recommendation.finalScore ?? recommendation.score ?? 0);

  if (score >= 75) {
    return "High";
  }

  if (score >= 45) {
    return "Medium";
  }

  return "Situational";
}

function formatRecommendationLabel(value = "") {
  return value
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function SummaryStat({ label, value }) {
  return (
    <div className="final-stat-card">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function getCollectionIdentity(boxSummary) {
  const profile = getCollectionIdentityProfile(boxSummary);
  return {
    name: profile.title,
    description: profile.subtitle,
  };
}

async function renderCollectionCardPng(collectionCardProps) {
  if (typeof document === "undefined") {
    throw new Error("Collection Card export requires a browser document.");
  }

  const exportStage = document.createElement("div");
  exportStage.className = "collection-card-export-stage";
  exportStage.setAttribute("aria-hidden", "true");
  document.body.appendChild(exportStage);

  const root = createRoot(exportStage);
  let exportCardNode = null;

  try {
    flushSync(() => {
      root.render(
        <CollectionCard
          {...collectionCardProps}
          exportMode
          ref={(node) => {
            exportCardNode = node;
          }}
        />
      );
    });
    await waitForFonts();
    await waitForImages(exportStage);
    await waitForNextFrames(2);
    await waitForPaintDelay(90);
    validateCollectionCardExportNode(exportStage, exportCardNode, collectionCardProps.title);

    const blob = await toBlob(exportCardNode, {
      pixelRatio: 1,
      cacheBust: true,
      backgroundColor: "#020605",
    });

    if (!blob) {
      throw new Error("Collection Card capture returned an empty image.");
    }

    await validateCollectionCardBlob(blob);

    return blob;
  } finally {
    root.unmount();
    exportStage.remove();
  }
}

function validateCollectionCardExportNode(exportStage, card, expectedTitle) {
  const stageRect = exportStage.getBoundingClientRect();
  const cardRect = card?.getBoundingClientRect();
  const stageStyle = window.getComputedStyle(exportStage);
  const cardStyle = card ? window.getComputedStyle(card) : null;
  const paintedElement = document.elementFromPoint(100, 100);
  const diagnostics = {
    nodeTag: exportStage.tagName,
    nodeClassName: exportStage.className,
    boundingRect: rectToDiagnostics(stageRect),
    scrollWidth: exportStage.scrollWidth,
    scrollHeight: exportStage.scrollHeight,
    computedWidth: stageStyle.width,
    computedHeight: stageStyle.height,
    display: stageStyle.display,
    visibility: stageStyle.visibility,
    opacity: stageStyle.opacity,
    transform: stageStyle.transform,
    position: stageStyle.position,
    childCount: exportStage.childElementCount,
    textContentPreview: exportStage.textContent?.trim().slice(0, 220) || "",
    card: card
      ? {
          nodeTag: card.tagName,
          nodeClassName: card.className,
          boundingRect: rectToDiagnostics(cardRect),
          computedWidth: cardStyle.width,
          computedHeight: cardStyle.height,
          display: cardStyle.display,
          visibility: cardStyle.visibility,
          opacity: cardStyle.opacity,
          transform: cardStyle.transform,
          position: cardStyle.position,
          childCount: card.childElementCount,
          textContentPreview: card.textContent?.trim().slice(0, 220) || "",
        }
      : null,
    elementFromPoint: paintedElement
      ? {
          tagName: paintedElement.tagName,
          className: paintedElement.className,
          textContentPreview: paintedElement.textContent?.trim().slice(0, 120) || "",
        }
      : null,
  };

  if (
    !card ||
    cardRect.width <= 0 ||
    cardRect.height <= 0 ||
    exportStage.childElementCount === 0 ||
    !card.textContent?.includes(expectedTitle)
  ) {
    throw new Error(`Collection Card export node is not ready: ${JSON.stringify(diagnostics)}`);
  }

  const isCardContained =
    cardRect.left >= stageRect.left &&
    cardRect.top >= stageRect.top &&
    cardRect.right <= stageRect.right &&
    cardRect.bottom <= stageRect.bottom;

  if (!isCardContained) {
    throw new Error(`Collection Card is outside the export stage: ${JSON.stringify(diagnostics)}`);
  }

  if (!card.contains(paintedElement) && paintedElement !== card) {
    throw new Error(`Collection Card export node is not painted: ${JSON.stringify(diagnostics)}`);
  }
}

function rectToDiagnostics(rect) {
  return {
    x: Math.round(rect.x),
    y: Math.round(rect.y),
    width: Math.round(rect.width),
    height: Math.round(rect.height),
    top: Math.round(rect.top),
    right: Math.round(rect.right),
    bottom: Math.round(rect.bottom),
    left: Math.round(rect.left),
  };
}

async function validateCollectionCardBlob(blob) {
  if (blob.type !== "image/png" || blob.size < 50000) {
    throw new Error("The Collection Card could not be rendered. Please try again.");
  }

  const image = await createImageBitmap(blob);
  const canvas = document.createElement("canvas");
  const sampleWidth = 180;
  const sampleHeight = 320;
  canvas.width = sampleWidth;
  canvas.height = sampleHeight;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(image, 0, 0, sampleWidth, sampleHeight);
  image.close?.();

  const { data } = ctx.getImageData(0, 0, sampleWidth, sampleHeight);
  let minLuma = 255;
  let maxLuma = 0;
  let minRed = 255;
  let maxRed = 0;
  let minGreen = 255;
  let maxGreen = 0;
  let minBlue = 255;
  let maxBlue = 0;
  const distinctColors = new Set();

  for (let index = 0; index < data.length; index += 4) {
    const red = data[index];
    const green = data[index + 1];
    const blue = data[index + 2];
    const luma = red * 0.2126 + green * 0.7152 + blue * 0.0722;

    minLuma = Math.min(minLuma, luma);
    maxLuma = Math.max(maxLuma, luma);
    minRed = Math.min(minRed, red);
    maxRed = Math.max(maxRed, red);
    minGreen = Math.min(minGreen, green);
    maxGreen = Math.max(maxGreen, green);
    minBlue = Math.min(minBlue, blue);
    maxBlue = Math.max(maxBlue, blue);
    distinctColors.add(
      `${Math.floor(red / 8)}-${Math.floor(green / 8)}-${Math.floor(blue / 8)}`
    );
  }

  const luminanceSpread = maxLuma - minLuma;
  const colorSpread = maxRed - minRed + (maxGreen - minGreen) + (maxBlue - minBlue);

  if (distinctColors.size < 32 || (luminanceSpread < 24 && colorSpread < 90)) {
    throw new Error("The Collection Card could not be rendered. Please try again.");
  }
}

async function waitForFonts() {
  if (document.fonts?.ready) {
    await document.fonts.ready;
  }
}

async function waitForImages(node) {
  const images = [...node.querySelectorAll("img")];

  if (images.length === 0) {
    return;
  }

  await Promise.race([
    Promise.all(
      images.map(
        (image) =>
          new Promise((resolve) => {
            if (image.complete) {
              resolve();
              return;
            }

            image.addEventListener("load", resolve, { once: true });
            image.addEventListener("error", resolve, { once: true });
          })
      )
    ),
    new Promise((resolve) => window.setTimeout(resolve, 2800)),
  ]);
}

function waitForNextFrames(count = 1) {
  return new Promise((resolve) => {
    const wait = (remaining) => {
      if (remaining <= 0) {
        resolve();
        return;
      }

      window.requestAnimationFrame(() => wait(remaining - 1));
    };

    wait(count);
  });
}

function waitForPaintDelay(delayMs = 90) {
  return new Promise((resolve) => window.setTimeout(resolve, delayMs));
}

function formatConfigCopy(template, values = {}) {
  return Object.entries(values).reduce(
    (copy, [key, value]) => copy.replaceAll(`{${key}}`, String(value)),
    template
  );
}

function getNextAvailableSlotIndex(selectedPerfumes, maxSelectableSlots) {
  if (selectedPerfumes.length >= maxSelectableSlots) {
    return null;
  }

  return selectedPerfumes.length;
}

function BoxSlotTray({
  selectedPerfumes,
  maxSlots,
  maxSelectableSlots,
  isCuratorBonusUnlocked,
  nextAvailableSlotIndex,
  onNextSlotRecommendation,
  onRemovePerfume,
  onReorderPerfumes,
}) {
  const [activeSlotIndex, setActiveSlotIndex] = useState(null);
  const [draggingIndex, setDraggingIndex] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);
  const longPressTimerRef = useRef(null);
  const didLongPressRef = useRef(false);
  const didDragRef = useRef(false);
  const lastPointerTypeRef = useRef(null);
  const rowCount = Math.ceil(maxSlots / 2);
  const rows = Array.from({ length: rowCount }, (_, rowIndex) => ({
    leftIndex: rowIndex * 2,
    rightIndex: rowIndex * 2 + 1,
  }));
  const clearLongPressTimer = () => {
    if (longPressTimerRef.current) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };
  const reorderSlot = (fromIndex, toIndex) => {
    const targetIndex = Math.min(toIndex, selectedPerfumes.length - 1);

    if (fromIndex !== targetIndex && targetIndex >= 0) {
      onReorderPerfumes(fromIndex, targetIndex);
    }
  };
  const handleDragStart = (event, index) => {
    setDraggingIndex(index);
    setActiveSlotIndex(null);
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", String(index));
  };
  const handleDrop = (event, index) => {
    event.preventDefault();
    const fromIndex = Number(event.dataTransfer.getData("text/plain"));

    reorderSlot(fromIndex, index);
    setDraggingIndex(null);
    setDragOverIndex(null);
  };
  const handlePointerDown = (event, index, hasPerfume) => {
    didLongPressRef.current = false;
    didDragRef.current = false;
    lastPointerTypeRef.current = event.pointerType;

    if (!hasPerfume) {
      return;
    }

    if (event.pointerType === "mouse") {
      didLongPressRef.current = true;
      setDraggingIndex(index);
      setActiveSlotIndex(null);
      return;
    }

    clearLongPressTimer();
    longPressTimerRef.current = window.setTimeout(() => {
      didLongPressRef.current = true;
      setDraggingIndex(index);
      setActiveSlotIndex(null);
    }, 360);
  };
  const handlePointerUp = (index) => {
    clearLongPressTimer();

    if (draggingIndex !== null) {
      reorderSlot(draggingIndex, index);
      setDraggingIndex(null);
      setDragOverIndex(null);
      return;
    }

    if (!didLongPressRef.current && selectedPerfumes[index]) {
      setActiveSlotIndex((currentIndex) => (currentIndex === index ? null : index));
    }
  };
  const handleSlotClick = (index) => {
    if (lastPointerTypeRef.current === "mouse" && !didDragRef.current && selectedPerfumes[index]) {
      setActiveSlotIndex((currentIndex) => (currentIndex === index ? null : index));
    }
  };
  const handleRemove = (index) => {
    onRemovePerfume(index);
    setActiveSlotIndex(null);
    setDraggingIndex(null);
    setDragOverIndex(null);
  };

  return (
    <div className="box-slot-tray interactive-box-slot-tray" aria-label="Interactive Discovery Box slots">
      <div className="box-column">
        {rows.map(({ leftIndex }) => (
            <BoxVialSlot
              key={`left-slot-${leftIndex}`}
              index={leftIndex}
              perfume={selectedPerfumes[leftIndex]}
              isReserved={leftIndex >= maxSelectableSlots}
              isCuratorBonusUnlocked={isCuratorBonusUnlocked}
              isNextAvailable={leftIndex === nextAvailableSlotIndex}
              isActive={activeSlotIndex === leftIndex}
              isDragging={draggingIndex === leftIndex}
              isDragTarget={dragOverIndex === leftIndex}
              onNextSlotRecommendation={onNextSlotRecommendation}
              onRemove={handleRemove}
              onDragStart={handleDragStart}
              onDragOver={(event) => {
                event.preventDefault();
                setDragOverIndex(leftIndex);
              }}
              onDrop={handleDrop}
              onPointerDown={handlePointerDown}
              onPointerEnter={() => {
                if (draggingIndex !== null) {
                  didDragRef.current = draggingIndex !== leftIndex;
                  setDragOverIndex(leftIndex);
                }
              }}
              onPointerUp={handlePointerUp}
              onClick={handleSlotClick}
            />
        ))}
      </div>

      <div className="box-center-channel" aria-hidden="true" />

      <div className="box-column">
        {rows.map(({ rightIndex }) =>
          rightIndex < maxSlots ? (
            <BoxVialSlot
              key={`right-slot-${rightIndex}`}
              index={rightIndex}
              perfume={selectedPerfumes[rightIndex]}
              isReserved={rightIndex >= maxSelectableSlots}
              isCuratorBonusUnlocked={isCuratorBonusUnlocked}
              isNextAvailable={rightIndex === nextAvailableSlotIndex}
              isActive={activeSlotIndex === rightIndex}
              isDragging={draggingIndex === rightIndex}
              isDragTarget={dragOverIndex === rightIndex}
              onNextSlotRecommendation={onNextSlotRecommendation}
              onRemove={handleRemove}
              onDragStart={handleDragStart}
              onDragOver={(event) => {
                event.preventDefault();
                setDragOverIndex(rightIndex);
              }}
              onDrop={handleDrop}
              onPointerDown={handlePointerDown}
              onPointerEnter={() => {
                if (draggingIndex !== null) {
                  didDragRef.current = draggingIndex !== rightIndex;
                  setDragOverIndex(rightIndex);
                }
              }}
              onPointerUp={handlePointerUp}
              onClick={handleSlotClick}
            />
          ) : null
        )}
      </div>
    </div>
  );
}

function BoxVialSlot({
  perfume,
  index,
  isReserved,
  isCuratorBonusUnlocked,
  isNextAvailable,
  isActive,
  isDragging,
  isDragTarget,
  onNextSlotRecommendation,
  onRemove,
  onDragStart,
  onDragOver,
  onDrop,
  onPointerDown,
  onPointerEnter,
  onPointerUp,
  onClick,
}) {
  if (isReserved) {
    return (
      <div
        className={`box-vial bonus-reserved ${
          isCuratorBonusUnlocked ? "bonus-unlocked" : "bonus-locked"
        }`}
        data-slot-index={index}
        aria-label={`Curator Bonus reserved slot ${index + 1}`}
      >
        <span className="vial-cap" />
        <span className="vial-body">
          <span className="bonus-slot-icon" aria-hidden="true" />
        </span>
      </div>
    );
  }

  if (!perfume) {
    const EmptySlotElement = isNextAvailable ? "button" : "div";
    const handleNextSlotKeyDown = (event) => {
      if (!isNextAvailable || (event.key !== "Enter" && event.key !== " ")) {
        return;
      }

      event.preventDefault();
      onNextSlotRecommendation?.();
    };

    return (
      <EmptySlotElement
        className={`box-vial empty ${isNextAvailable ? "next-available" : "passive-empty"} ${isDragTarget ? "drag-target" : ""}`}
        data-slot-index={index}
        aria-label={isNextAvailable ? "View recommendations for the next box slot" : `Empty slot ${index + 1}`}
        type={isNextAvailable ? "button" : undefined}
        onClick={isNextAvailable ? onNextSlotRecommendation : undefined}
        onKeyDown={isNextAvailable ? handleNextSlotKeyDown : undefined}
        onDragOver={onDragOver}
        onDrop={(event) => onDrop(event, index)}
        onPointerEnter={onPointerEnter}
        onPointerUp={() => onPointerUp(index)}
      >
        <span className="vial-cap" />
        <span className="vial-body">
          <span className="empty-slot-add" aria-hidden="true">+</span>
        </span>
      </EmptySlotElement>
    );
  }

  const tierData = getTierData(perfume.id);
  const slotLabel = perfume.shortName || getShortPerfumeName(perfume.name);
  const hasCuratedShortName = Boolean(perfume.shortName);

  return (
    <div
      className={`box-vial filled ${isActive ? "is-active" : ""} ${
        isDragging ? "is-dragging" : ""
      } ${isDragTarget ? "drag-target" : ""}`}
      data-slot-index={index}
      aria-label={`Filled slot ${index + 1}: ${perfume.name}`}
      title={perfume.name}
      draggable
      onDragStart={(event) => onDragStart(event, index)}
      onDragEnd={() => onDrop({ preventDefault() {}, dataTransfer: { getData: () => index } }, index)}
      onDragOver={onDragOver}
      onDrop={(event) => onDrop(event, index)}
      onPointerDown={(event) => onPointerDown(event, index, true)}
      onPointerEnter={onPointerEnter}
      onPointerUp={() => onPointerUp(index)}
      onClick={() => onClick(index)}
      style={{
        "--tier-color": tierData.color,
        "--tier-background": tierData.background,
        "--glass-tint-mid": tierData.glassTintMid,
        "--glass-tint-edge": tierData.glassTintEdge,
      }}
    >
      <span className="vial-cap" />
      <span className="vial-body">
        <span className={`vial-label ${hasCuratedShortName ? "has-short-name" : ""}`}>
          <strong>{slotLabel}</strong>
        </span>
        <button
          type="button"
          className="slot-remove-button"
          onClick={(event) => {
            event.stopPropagation();
            onRemove(index);
          }}
          aria-label={`Remove ${perfume.name}`}
        >
          ×
        </button>
      </span>
      {isActive && (
        <div className="slot-action-popover">
          <button type="button" onClick={() => onRemove(index)}>
            Remove
          </button>
          <span>Long press and drag to reorder</span>
        </div>
      )}
    </div>
  );
}

function getShortPerfumeName(name) {
  return name
    .replace(/\b(Eau de Parfum|Pour Homme|for Men|EDT|EDP)\b/gi, "")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .join(" ");
}

function getSeasonIcon(season) {
  const icons = {
    spring: "🌸",
    summer: "☀️",
    fall: "🍂",
    winter: "❄️",
  };

  return icons[season] || "•";
}

export default BuilderPanel;
