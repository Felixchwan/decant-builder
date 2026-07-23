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
  getPerfumeNoteLabels,
  getStrengthSegmentCount,
  getSupportingAccords,
  normalizeAccordLabel,
  selectDnaExplorerDetail,
} from "../builder/internal/intelligence/buildCollectionIntelligenceViewModel.js";
import {
  getRecommendationConfidence,
  getRecommendationConfidenceLabel,
  getRecommendationDisplayReasons,
} from "../builder/presentation/recommendationExplanationLabels.js";
import {
  getComposerProposalExplanationLabel,
  getLocalizedComposerProposalStatusLabel,
} from "../builder/presentation/composerProposalLabels.js";
import {
  getComposerOptionPositionLabel,
  getComposerProposalItemReasonLabels,
  getComposerTradeoffLabel,
} from "../builder/presentation/composerAlternativeTradeoffLabels.js";
import {
  buildComposerBudgetBonusFeedback,
  buildComposerProposalBonusStatus,
} from "../builder/presentation/composerBonusStatus.js";
import { buildFinalizationModel } from "../builder/internal/finalization/buildFinalizationModel.js";
import { getTierData } from "../utils/tierUtils";
import CollectionCard from "./CollectionCard";
import { createTranslator } from "../i18n/createTranslator.js";
import { ANALYTICS_EVENTS } from "../analytics/events.js";
import { noopAnalytics } from "../analytics/noopAnalytics.js";

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
  composerSettings,
  composerOptions,
  minimumComposerBudget,
  composerProposal,
  isComposerGenerating = false,
  composerStatusMessage = "",
  isComposerProposalStale,
  onComposerSettingChange,
  onComposerPreferenceToggle,
  onComposerPreferenceClear,
  onComposeMyBox,
  onApplyComposerProposal,
  onMoveComposerProposalAlternative,
  onCancelComposerProposal,
  curatorBonusPreference,
  onCuratorBonusPreferenceChange,
  reviewCustomerInfo,
  onReviewCustomerInfoChange,
  analytics = noopAnalytics,
}) {
    const translator = useMemo(
      () => createTranslator(builderConfig.locale),
      [builderConfig.locale]
    );
    const { t } = translator;
    const [hasSeenDiscoveryIntro, setHasSeenDiscoveryIntro] = useState(() => {
      if (typeof window === "undefined") {
        return true;
      }

      try {
        return window.localStorage.getItem(builderConfig.persistence.discoveryIntroSeenKey) === "true";
      } catch {
        return true;
      }
    });
    const [isDiscoveryIntroOpen, setIsDiscoveryIntroOpen] = useState(false);
    const [isNotesModalOpen, setIsNotesModalOpen] = useState(false);
    const [isFinalSummaryOpen, setIsFinalSummaryOpen] = useState(false);
    const [isCollectionCardPreviewOpen, setIsCollectionCardPreviewOpen] = useState(false);
    const [isComposerSetupOpen, setIsComposerSetupOpen] = useState(false);
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
        ? t("builder.moreFragrances", {
            count: missingSlots,
            plural: missingSlots === 1 ? "" : "s",
          })
        : null,
      missingPoints > 0
        ? t("builder.morePoints", {
            count: missingPoints.toFixed(1),
            plural: missingPoints === 1 ? "" : "s",
          })
        : null,
    ]
      .filter(Boolean)
      .join(" and ");
    const shouldShowDiscoveryIntro =
      selectedPerfumes.length === 0 &&
      (!hasSeenDiscoveryIntro || isDiscoveryIntroOpen);
    const canNativeShareCard = canUseNativeShare(collectionCardViewModel.export.defaultFilename);
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

    const handleOpenComposerSetup = () => {
      analytics.track(ANALYTICS_EVENTS.COMPOSER_OPENED, {
        slotCount: totalSlots,
        totalPoints,
        requestedBudgetPoints: parseNumericAnalyticsValue(composerSettings.budget),
        requestedStyle: composerSettings.collectionStyle,
        source: "composer",
      });
      setIsComposerSetupOpen(true);
    };

    const handleOpenReview = () => {
      analytics.track(ANALYTICS_EVENTS.REVIEW_OPENED, {
        slotCount: totalSlots,
        totalPoints,
        orderTotal: estimatedValue,
        curatorBonusUnlocked: isCuratorBonusUnlocked,
        source: "manual",
      });
      setIsFinalSummaryOpen(true);
    };

    const dismissDiscoveryIntro = () => {
      if (typeof window !== "undefined") {
        try {
          window.localStorage.setItem(builderConfig.persistence.discoveryIntroSeenKey, "true");
        } catch {
          // Onboarding dismissal should not block the Builder in private browsing modes.
        }
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
            {t("builder.selectedSlotsUsed", {
              total: totalSlots,
              max: maxSelectableSlots,
            })}
          </p>
        </div>

        <button className="ghost-button" onClick={onClearBox}>
          {builderConfig.copy.clearBuilderLabel}
        </button>
      </div>

      {shouldShowDiscoveryIntro && (
        <DiscoveryBoxCoachmark builderConfig={builderConfig} onDismiss={dismissDiscoveryIntro} />
      )}

      <div className="box-summary-card" aria-label={t("builder.boxSummary")}>
        <div className="box-summary-metric">
          <strong>{totalSlots} / {maxSelectableSlots}</strong>
          <span>{t("general.slots")}</span>
        </div>

        <div className="box-summary-metric">
          <strong>{totalPoints.toFixed(1)}</strong>
          <span>{t("general.points")}</span>
        </div>

        <div className="box-summary-metric box-summary-total">
          <strong>${estimatedValue.toFixed(0)}</strong>
          <span>{builderConfig.commerce.totalLabel}</span>
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
          <span className="share-box-label">{t("collectionCard.label")}</span>

          <span className="share-info-wrap">
            <button
              type="button"
              className="share-info-button"
              aria-label={t("collectionCard.tooltip")}
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

      <ComposeMyBoxPanel
        builderConfig={builderConfig}
        isBoxFull={totalSlots >= maxSelectableSlots}
        isGenerating={isComposerGenerating}
        statusMessage={composerStatusMessage}
        onOpenSetup={handleOpenComposerSetup}
      />

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
          onClick={handleOpenReview}
        >
          {builderConfig.copy.reviewButtonLabel}
        </button>

        {!isBoxReady && (
          <p>{builderConfig.copy.reviewIncompletePrefix} {reviewRequirementText || builderConfig.copy.reviewIncompleteFallback} {builderConfig.copy.reviewIncompleteSuffix || "to review."}</p>
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

      <BoxIntelligenceSummary intelligence={boxIntelligence} translator={translator} />

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
      translator={translator}
    />

    <NextImprovementSection
      result={nextImprovementResult}
      selectedPerfumeIds={selectedPerfumeIds}
      isBoxFull={totalSlots >= maxSelectableSlots}
      onAddPerfume={onAddPerfume}
      sectionRef={balanceLaneRef}
      isEmphasized={isBalanceLaneEmphasized}
      translator={translator}
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
          translator={translator}
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
          analytics={analytics}
        />
      )}
      {composerProposal && (
        <ComposerProposalModal
          builderConfig={builderConfig}
          proposal={composerProposal}
          isStale={isComposerProposalStale}
          onApply={onApplyComposerProposal}
          onMoveAlternative={onMoveComposerProposalAlternative}
          onCancel={onCancelComposerProposal}
          onBack={() => {
            handleOpenComposerSetup();
            onCancelComposerProposal();
          }}
        />
      )}
      {isComposerSetupOpen && (
        <ComposerSetupModal
          builderConfig={builderConfig}
          settings={composerSettings}
          options={composerOptions}
          minimumComposerBudget={minimumComposerBudget}
          isGenerating={isComposerGenerating}
          onSettingChange={onComposerSettingChange}
          onPreferenceToggle={onComposerPreferenceToggle}
          onPreferenceClear={onComposerPreferenceClear}
          onCancel={() => setIsComposerSetupOpen(false)}
          onGenerate={() => {
            onComposeMyBox();
            setIsComposerSetupOpen(false);
          }}
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

const COMPOSER_STRATEGY_OPTIONS = [
  { value: "balanced", labelKey: "composer.strategy.balanced" },
  { value: "versatile", labelKey: "composer.strategy.versatile" },
  { value: "explorer", labelKey: "composer.strategy.explorer" },
  { value: "signature", labelKey: "composer.strategy.signature" },
];

const COMPOSER_COLLECTION_STYLE_OPTIONS = [
  { value: "premium_focus", labelKey: "composer.style.premium_focus" },
  { value: "balanced_mix", labelKey: "composer.style.balanced_mix" },
  { value: "more_variety", labelKey: "composer.style.more_variety" },
];

function ComposeMyBoxPanel({
  builderConfig,
  isBoxFull,
  isGenerating,
  statusMessage,
  onOpenSetup,
}) {
  const translator = createTranslator(builderConfig.locale);
  const { t } = translator;

  return (
    <section
      className="compose-box-panel compose-box-panel-compact"
      aria-busy={isGenerating}
      aria-label={t("composer.eyebrow")}
    >
      <div className="compose-box-header">
        <div>
          <span>{t("composer.eyebrow")}</span>
          <h3>{t("composer.panelTitle")}</h3>
        </div>

        <button type="button" onClick={onOpenSetup} disabled={isGenerating}>
          {isGenerating ? t("composer.composing") : isBoxFull ? t("composer.reviewProposal") : t("composer.composeMyBox")}
        </button>
      </div>
      {isGenerating && (
        <p className="composer-busy-status" role="status">
          {t("composer.busy")}
        </p>
      )}
      {statusMessage && !isGenerating && (
        <p className="composer-busy-status composer-error-status" role="status">
          {statusMessage}
        </p>
      )}
    </section>
  );
}

function ComposerSetupModal({
  builderConfig,
  settings,
  options,
  minimumComposerBudget,
  isGenerating,
  onSettingChange,
  onPreferenceToggle,
  onPreferenceClear,
  onCancel,
  onGenerate,
}) {
  const translator = createTranslator(builderConfig.locale);
  const { t } = translator;
  const safeSettings = settings || {};
  const safeOptions = options || {};
  const budgetValue = safeSettings.budget || "";
  const numericBudget = budgetValue === "" ? null : Number(budgetValue);
  const isBudgetBelowMinimum =
    Number.isFinite(numericBudget) &&
    Number.isFinite(minimumComposerBudget) &&
    numericBudget < minimumComposerBudget;
  const budgetBonusFeedback = buildComposerBudgetBonusFeedback({
    budget: numericBudget,
    config: { ...builderConfig, translator },
  });

  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === "Escape") {
        onCancel();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onCancel]);

  return createPortal(
    <div className="modal-overlay final-summary-overlay" onClick={onCancel}>
      <div
        className="final-summary-modal composer-setup-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="composer-setup-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal-header">
          <div>
            <span>{t("composer.eyebrow")}</span>
            <h3 id="composer-setup-title">{t("composer.setupTitle")}</h3>
          </div>

          <button type="button" onClick={onCancel}>{t("general.close")}</button>
        </div>

        <div className="composer-setup-body">
          <p className="composer-setup-intro">
            {t("composer.setupIntro")}
          </p>

          <div className="compose-box-controls composer-setup-controls">
            <div className="composer-setup-field-row">
              <label className="composer-setup-field">
                <span>{t("composer.strategy")}</span>
                <select
                  value={safeSettings.strategy || "balanced"}
                  onChange={(event) => onSettingChange("strategy", event.target.value)}
                >
                  {COMPOSER_STRATEGY_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {t(option.labelKey)}
                    </option>
                  ))}
                </select>
                <small className="composer-field-helper" aria-hidden="true">&nbsp;</small>
              </label>

              <label className="composer-setup-field">
                <span>{t("composer.budget")}</span>
                <input
                  type="number"
                  min={Number.isFinite(minimumComposerBudget) ? minimumComposerBudget : 0}
                  step="100"
                  inputMode="decimal"
                  value={budgetValue}
                  onChange={(event) => onSettingChange("budget", event.target.value)}
                  placeholder={t("composer.noLimit")}
                />
                <span className="composer-field-helper">
                  {isBudgetBelowMinimum && (
                    <small className="composer-budget-warning">
                      {t("composer.minimumBudget", { amount: minimumComposerBudget })}
                    </small>
                  )}
                  {budgetBonusFeedback.label && (
                    <small className={`composer-budget-bonus composer-budget-bonus-${budgetBonusFeedback.state}`}>
                      {budgetBonusFeedback.label}
                    </small>
                  )}
                </span>
              </label>
            </div>

            <div className="compose-preference-group composer-style-control">
              <div className="compose-preference-heading">
                <span>{t("composer.collectionStyle")}</span>
              </div>

              <div className="compose-preference-chips" role="radiogroup" aria-label={t("composer.collectionStyle")}>
                {COMPOSER_COLLECTION_STYLE_OPTIONS.map((option) => {
                  const isSelected =
                    (safeSettings.collectionStyle || "balanced_mix") === option.value;

                  return (
                    <button
                      key={option.value}
                      type="button"
                      className={isSelected ? "is-selected" : ""}
                      role="radio"
                      aria-checked={isSelected}
                      onClick={() => onSettingChange("collectionStyle", option.value)}
                    >
                      {t(option.labelKey)}
                    </button>
                  );
                })}
              </div>
            </div>

            <ComposePreferenceGroup
              translator={createTranslator(builderConfig.locale)}
              label={t("composer.season")}
              field="seasons"
              values={safeSettings.seasons}
              options={safeOptions.seasons}
              onToggle={onPreferenceToggle}
              onClear={onPreferenceClear}
            />

            <ComposePreferenceGroup
              translator={createTranslator(builderConfig.locale)}
              label={t("composer.occasion")}
              field="occasions"
              values={safeSettings.occasions}
              options={safeOptions.occasions}
              onToggle={onPreferenceToggle}
              onClear={onPreferenceClear}
            />

            <ComposePreferenceGroup
              translator={createTranslator(builderConfig.locale)}
              label={t("composer.vibe")}
              field="vibes"
              values={safeSettings.vibes}
              options={safeOptions.vibes}
              onToggle={onPreferenceToggle}
              onClear={onPreferenceClear}
            />
          </div>
        </div>

        <div className="review-modal-footer composer-setup-footer">
          <button type="button" className="secondary" onClick={onCancel}>
            {t("general.cancel")}
          </button>
          <button type="button" onClick={onGenerate} disabled={isBudgetBelowMinimum || isGenerating}>
            {isGenerating ? t("composer.composing") : t("composer.generateProposal")}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

function ComposePreferenceGroup({
  translator,
  label,
  field,
  values,
  options,
  onToggle,
  onClear,
  density = "wrap",
}) {
  const t = translator?.t || ((key) => key);
  const selectedValues = Array.isArray(values) ? values : [];
  const availableOptions = Array.isArray(options) ? options : [];
  const selectedSummary =
    selectedValues.length > 0 ? t("composer.selectedCount", { count: selectedValues.length }) : t("composer.any");

  return (
    <div className={`compose-preference-group compose-preference-${density}`}>
      <div className="compose-preference-heading">
        <span>
          {label} <em>{selectedSummary}</em>
        </span>
        {selectedValues.length > 0 && (
          <button type="button" onClick={() => onClear(field)}>
            {t("composer.clear")}
          </button>
        )}
      </div>

      <div className="compose-preference-chips">
        {availableOptions.map((option) => {
          const isSelected = selectedValues.includes(option);

          return (
            <button
              key={option}
              type="button"
              className={isSelected ? "is-selected" : ""}
              aria-pressed={isSelected}
              onClick={() => onToggle(field, option)}
            >
              {translator?.label?.(field, option) || option}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ComposerProposalModal({
  builderConfig,
  proposal,
  isStale,
  onApply,
  onMoveAlternative,
  onCancel,
  onBack,
}) {
  const translator = createTranslator(builderConfig.locale);
  const { t } = translator;
  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === "Escape") {
        onCancel();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onCancel]);

  const statusLabel = getLocalizedComposerProposalStatusLabel(proposal.status, translator);
  const isProposalAvailable = Boolean(proposal.proposalAvailable);
  const explanationLabels = [
    proposal.preview?.headline,
    ...(proposal.preview?.strengths || []),
    ...(proposal.preview?.weaknesses || []),
    ...(proposal.preview?.recommendations || []),
  ]
    .map((explanation) => getComposerProposalExplanationLabel(explanation, translator))
    .filter(Boolean)
    .slice(0, 4);
  const canApply = proposal.apply.available && !isStale;
  const failureMessage = t("composer.failure");
  const failureRecommendation =
    t("composer.failureHelp");
  const budgetLimitedPartial =
    isProposalAvailable &&
    !proposal.targetReached &&
    proposal.diagnostics?.collectionStyle === "more_variety" &&
    Number.isFinite(proposal.diagnostics?.budget) &&
    proposal.compositionResult?.constraintResult?.metrics?.remainingBudget === 0;
  const proposalBonusStatus = buildComposerProposalBonusStatus({
    totalPoints: proposal.totalPoints,
    config: { ...builderConfig, translator },
  });
  const proposalItems =
    buildVisibleProposalItems(proposal) ||
    proposal.collection.map((perfume) => ({
      slotId: `slot-${perfume.id}`,
      id: perfume.id,
      perfume,
      preserved: proposal.preservedPerfumes.some((item) => item.id === perfume.id),
      newlyAdded: proposal.addedPerfumes.some((item) => item.id === perfume.id),
      reasons: [],
    }));

  return createPortal(
    <div className="modal-overlay final-summary-overlay" onClick={onCancel}>
      <div
        className="final-summary-modal composer-proposal-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="composer-proposal-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal-header">
          <div>
            <span>{statusLabel}</span>
            <h3 id="composer-proposal-title">{t("composer.proposalTitle")}</h3>
          </div>

          <div className="composer-proposal-header-actions">
            <button type="button" className="secondary" onClick={onBack}>
              {t("general.back")}
            </button>
            <button type="button" onClick={onCancel}>{t("general.close")}</button>
          </div>
        </div>

        {isStale && (
          <p className="composer-proposal-alert" role="status">
            {t("composer.proposalStale")}
          </p>
        )}

        {budgetLimitedPartial && (
          <p className="composer-proposal-alert" role="status">
            {t("composer.budgetLimitedPartial")}
          </p>
        )}

        {isProposalAvailable ? (
          <>
            <section className="final-summary-section composer-proposal-summary">
              <h4>{t("composer.proposalSummary")}</h4>
              <div className="summary-grid">
                <SummaryStat label={t("general.slots")} value={`${proposal.collection.length} / ${proposal.targetSlots}`} />
                <SummaryStat label={t("general.points")} value={proposal.totalPoints.toFixed(1)} />
                <SummaryStat label={builderConfig.commerce.totalLabel} value={`$${proposal.orderTotal.toFixed(0)}`} />
                <SummaryStat label={t("composer.newPicks")} value={proposal.addedPerfumes.length} />
                <SummaryStat label={builderConfig.curatorBonus.label} value={proposalBonusStatus.value} />
              </div>
              {proposalBonusStatus.label && (
                <p className={`composer-proposal-bonus composer-proposal-bonus-${proposalBonusStatus.state}`}>
                  {proposalBonusStatus.label}
                </p>
              )}
            </section>

            <section className="final-summary-section">
              <h4>{t("composer.proposedFragrances")}</h4>

              <div className="composer-proposal-list">
                {proposalItems.map((item) => {
                  const perfume = item.perfume;
                  const reasonLabels = getComposerProposalItemReasonLabels(item.reasons, {
                    max: 3,
                    translator,
                  });
                  const hasAlternatives =
                    item.newlyAdded && item.alternatives && item.alternatives.length > 1;
                  const currentPosition = item.selectedAlternativeIndex + 1;
                  const alternativeCount = item.alternatives?.length || 1;
                  const slotNumber = item.slotIndex + 1;
                  const isComposerPick = item.selectedAlternativeIndex === 0;
                  const tradeoff = item.alternatives?.[item.selectedAlternativeIndex]?.tradeoff;
                  const gainedLabels = (tradeoff?.gained || [])
                    .map((item) => getComposerTradeoffLabel(item, translator))
                    .filter(Boolean)
                    .slice(0, 3);
                  const lostLabels = (tradeoff?.lost || [])
                    .map((item) => getComposerTradeoffLabel(item, translator))
                    .filter(Boolean)
                    .slice(0, 3);
                  const hasTradeoff =
                    !isComposerPick && (gainedLabels.length > 0 || lostLabels.length > 0);

                  return (
                    <div key={item.slotId || perfume.id} className="composer-proposal-item">
                      {hasAlternatives && (
                        <button
                          type="button"
                          className="composer-proposal-alt-button"
                          aria-label={t("composer.previousAlternative", { slot: slotNumber })}
                          onClick={() => onMoveAlternative?.(item.slotId, -1)}
                        >
                          ‹
                        </button>
                      )}

                      <div className="composer-proposal-item-body">
                        <strong>{perfume.name}</strong>
                        <span>{perfume.brand} - {perfume.points} pt</span>
                        {reasonLabels.length > 0 && (
                          <div className="composer-proposal-item-reasons">
                            {reasonLabels.map((label) => (
                              <span key={`${item.slotId}-${label}`}>
                                {label}
                              </span>
                            ))}
                          </div>
                        )}
                        {hasAlternatives && (
                          <span className="composer-proposal-alt-position">
                            {getComposerOptionPositionLabel(currentPosition, alternativeCount, translator)}
                          </span>
                        )}
                        {hasTradeoff && (
                          <div className="composer-proposal-tradeoff">
                            {gainedLabels.length > 0 && (
                              <div>
                                <span>{t("composer.gain")}</span>
                                <div>
                                  {gainedLabels.map((label) => (
                                    <em key={`gain-${item.slotId}-${label}`}>{label}</em>
                                  ))}
                                </div>
                              </div>
                            )}
                            {lostLabels.length > 0 && (
                              <div>
                                <span>{t("composer.lose")}</span>
                                <div>
                                  {lostLabels.map((label) => (
                                    <em key={`loss-${item.slotId}-${label}`}>{label}</em>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {hasAlternatives && (
                        <button
                          type="button"
                          className="composer-proposal-alt-button"
                          aria-label={t("composer.nextAlternative", { slot: slotNumber })}
                          onClick={() => onMoveAlternative?.(item.slotId, 1)}
                        >
                          ›
                        </button>
                      )}

                      <span className="composer-proposal-item-state">
                        {item.preserved ? t("composer.preserved") : isComposerPick ? t("composer.newComposerPick") : t("composer.newAlternative")}
                      </span>
                    </div>
                  );
                })}
              </div>
            </section>
          </>
        ) : (
          <section className="final-summary-section composer-proposal-failure">
            <h4>{statusLabel}</h4>
            <p>{failureMessage}</p>
            <p>{failureRecommendation}</p>
          </section>
        )}

        {isProposalAvailable && explanationLabels.length > 0 && (
          <section className="final-summary-section">
            <h4>{t("composer.whyThisBox")}</h4>
            <div className="composer-proposal-reasons">
              {explanationLabels.map((label) => (
                <p key={label}>{label}</p>
              ))}
            </div>
          </section>
        )}

        <div className="review-modal-footer">
          <button type="button" className="secondary" onClick={onCancel}>
            {t("composer.keepCurrentBox")}
          </button>
          {isProposalAvailable && (
            <button type="button" onClick={onApply} disabled={!canApply}>
              {t("composer.applyProposal")}
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

function buildVisibleProposalItems(proposal) {
  if (!Array.isArray(proposal?.slotAlternatives) || proposal.slotAlternatives.length === 0) {
    return null;
  }

  return proposal.slotAlternatives
    .map((slot) => {
      const selectedIndex = Number.isInteger(slot.selectedAlternativeIndex)
        ? slot.selectedAlternativeIndex
        : 0;
      const selectedAlternative = slot.alternatives?.[selectedIndex];

      if (!selectedAlternative?.perfume) {
        return null;
      }

      return {
        slotId: slot.slotId,
        slotIndex: slot.slotIndex,
        id: selectedAlternative.id,
        perfume: selectedAlternative.perfume,
        preserved: Boolean(slot.preserved),
        newlyAdded: !slot.preserved,
        reasons: (selectedAlternative.reasons || []).slice(0, 3),
        alternatives: slot.alternatives || [],
        selectedAlternativeIndex: selectedIndex,
      };
    })
    .filter(Boolean);
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
  const { t } = createTranslator(builderConfig.locale);
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
    ? t("curator.pointsAway", {
        count: pointsAway.toFixed(1),
        plural: pointsAway === 1 ? "" : "s",
      })
    : t("curator.fragrancesAway", {
        count: fragrancesAway,
        plural: fragrancesAway === 1 ? "" : "s",
      });

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
          <strong>{t("curator.progressReward")}</strong>
        </div>

        <span className="discovery-bonus-state">
          {isUnlocked ? t("general.unlocked") : t("general.locked")}
        </span>
      </div>

      <div className="discovery-progress-bar" aria-hidden="true">
        <div style={{ width: `${progressPercent}%` }} />
      </div>

      <div className="discovery-requirements">
        <RequirementLine
          isMet={hasRequiredPoints}
          value={`${progressValue.toFixed(1)} / ${DISCOVERY_BONUS_TARGET_POINTS} ${t("general.points")}`}
        />
        <RequirementLine
          isMet={hasRequiredFragrances}
          value={`${Math.min(totalSlots, minSlots)} / ${minSlots} ${t("general.fragrances")}`}
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
              ? t("curator.selectedWrapped", {
                  style: preferenceData.label,
                  plural: hiddenPickCount === 1 ? "" : "s",
                })
              : builderConfig.curatorBonus.progressCopy.lockedStrategy}
          </p>
        </div>

        {isUnlocked ? (
          <div className="curator-preference-control">
            <label htmlFor="curator-bonus-preference">
              {t("curator.style")}
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
            <span>{t("curator.style")}</span>
            <strong>{t("curator.unlockStyle")}</strong>
          </div>
        )}

        <div className={`curator-pick-slot ${isUnlocked ? "active" : ""}`}>
          <span>{t("curator.pick")}</span>
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
  translator,
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
  analytics = noopAnalytics,
}) {
  const t = translator?.t || ((key) => key);
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
      setFinalizeStatus(t("review.requireCustomer"));
      analytics.track(ANALYTICS_EVENTS.REVIEW_VALIDATION_FAILED, {
        failedFields: finalizationModel.readiness.blockers,
        source: "manual",
      });
      return;
    }

    if (!builderConfig.features.whatsappFinalization) {
      setFinalizeStatus(t("app.recoverableActionError"));
      analytics.track(ANALYTICS_EVENTS.ORDER_FINALIZATION_FAILED, {
        slotCount: finalizationModel.order.totalSlots,
        totalPoints: finalizationModel.order.totalPoints,
        orderTotal: finalizationModel.order.monetaryTotal,
        curatorBonusUnlocked: finalizationModel.order.curatorBonus.isUnlocked,
        channel: "whatsapp",
        errorCategory: "channel_unavailable",
        copiedToClipboard: false,
        source: "manual",
      });
      return;
    }

    const whatsappMessage = finalizationModel.message;
    const whatsappUrl = `https://wa.me/${builderConfig.finalization.whatsappNumber}?text=${encodeURIComponent(
      whatsappMessage
    )}`;
    analytics.track(ANALYTICS_EVENTS.ORDER_FINALIZATION_STARTED, {
      slotCount: finalizationModel.order.totalSlots,
      totalPoints: finalizationModel.order.totalPoints,
      orderTotal: finalizationModel.order.monetaryTotal,
      curatorBonusUnlocked: finalizationModel.order.curatorBonus.isUnlocked,
      channel: "whatsapp",
      source: "manual",
    });
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
      analytics.track(ANALYTICS_EVENTS.ORDER_FINALIZATION_FAILED, {
        slotCount: finalizationModel.order.totalSlots,
        totalPoints: finalizationModel.order.totalPoints,
        orderTotal: finalizationModel.order.monetaryTotal,
        curatorBonusUnlocked: finalizationModel.order.curatorBonus.isUnlocked,
        channel: "whatsapp",
        errorCategory: "popup_blocked",
        copiedToClipboard: didCopy,
        source: "manual",
      });
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
    analytics.track(ANALYTICS_EVENTS.ORDER_FINALIZATION_SUCCEEDED, {
      slotCount: finalizationModel.order.totalSlots,
      totalPoints: finalizationModel.order.totalPoints,
      orderTotal: finalizationModel.order.monetaryTotal,
      curatorBonusUnlocked: finalizationModel.order.curatorBonus.isUnlocked,
      channel: "whatsapp",
      copiedToClipboard: didCopy,
      source: "manual",
    });
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
            <h3 id="discovery-review-title">{t("review.title")}</h3>
          </div>

          <button type="button" onClick={onClose}>{t("general.close")}</button>
        </div>

        <section className="final-summary-section review-overview-section">
          <div className="review-section-heading">
            <span>{t("review.curatorAssessment")}</span>
            <h4>{collectionIdentity.name}</h4>
            <strong className="review-assessment-badge">{assessmentBadge}</strong>
            <p>{assessmentSummary}</p>
          </div>

          <h5>{t("review.seasonCoverage")}</h5>

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
            <h4>{t("review.collectionStrengths")}</h4>

            {strengths.length > 0 ? (
              <ul className="review-list review-list-check">
                {strengths.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            ) : (
              <p>{t("review.noStrengths")}</p>
            )}
          </div>

          <div>
            <h4>{t("review.opportunities")}</h4>

            {opportunities.length > 0 ? (
              <ul className="review-list review-list-bullet">
                {opportunities.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            ) : (
              <p>{t("review.noOpportunities")}</p>
            )}
          </div>
        </section>

        <section className="final-summary-section review-curator-note-section">
          <div className="review-section-heading">
            <span>{t("review.curatorNotes")}</span>
            <h4>{t("review.closingNotes")}</h4>
          </div>

          <p>{collectionReview.curatorNote}</p>
        </section>

        <section className="final-summary-section review-curator-section">
          <h4>{builderConfig.curatorBonus.label}</h4>

          <div className="review-curator-grid">
            <div>
              <span>{t("review.curatorStyle")}</span>
              <strong>{curatorPreferenceLabel}</strong>
            </div>

            <div>
              <span>{t("review.curatorReward")}</span>
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
          <h4>{t("review.orderSummary")}</h4>

          <section className="final-summary-stats review-order-stats">
            <SummaryStat label={t("general.fragrances")} value={finalizationModel.order.totalSlots} />
            <SummaryStat
              label={t("review.totalPoints")}
              value={finalizationModel.order.totalPoints.toFixed(1)}
            />
            <SummaryStat
              label={builderConfig.commerce.totalLabel}
              value={`$${finalizationModel.order.monetaryTotal.toFixed(0)}`}
            />
            <SummaryStat
              label={builderConfig.curatorBonus.label}
              value={finalizationModel.order.curatorBonus.isUnlocked ? t("general.unlocked") : t("general.locked")}
            />
          </section>
        </section>

        <section className="final-summary-section review-customer-section">
          <h4>{t("review.finalizeDetails")}</h4>

          <div className="review-customer-form">
            <label>
              <span>{builderConfig.finalization.customerFieldLabels.name}</span>
              <input
                type="text"
                value={customerInfo.name}
                onChange={(event) =>
                  handleCustomerInfoChange("name", event.target.value)
                }
                placeholder={t("review.requiredPlaceholder")}
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
                placeholder={t("review.requiredPlaceholder")}
              />
            </label>

            <label className="review-notes-field">
              <span>{builderConfig.finalization.customerFieldLabels.notes}</span>
              <textarea
                value={customerInfo.notes}
                onChange={(event) =>
                  handleCustomerInfoChange("notes", event.target.value)
                }
                placeholder={t("general.optionalNotes")}
                rows={2}
              />
            </label>
          </div>
        </section>

        <div className="review-modal-footer">
          <button type="button" className="secondary" onClick={onClose}>
            {t("review.continueEditing")}
          </button>

          <button type="button" onClick={handleFinalizeBox} disabled={!canFinalize}>
            {t("review.finalizeBox")}
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
  } catch {
    return false;
  } finally {
    document.body.removeChild(textarea);
  }
}

function canUseNativeShare(filename) {
  if (
    typeof window === "undefined" ||
    typeof navigator.share !== "function" ||
    typeof navigator.canShare !== "function" ||
    typeof window.File === "undefined"
  ) {
    return false;
  }

  try {
    return navigator.canShare({
      files: [new File([""], filename, { type: "image/png" })],
    });
  } catch {
    return false;
  }
}

function NextImprovementSection({
  result,
  selectedPerfumeIds,
  isBoxFull,
  onAddPerfume,
  sectionRef,
  isEmphasized = false,
  translator,
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
        translator={translator}
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
  translator,
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
          translator={translator}
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
  translator,
}) {
  const { perfume, score } = recommendation;
  const explanations = getRecommendationDisplayReasons({ recommendation, objectiveKey, translator });
  const confidence = getRecommendationConfidence(recommendation);
  const confidenceLabel = getRecommendationConfidenceLabel(recommendation, translator);
  const imageFallback = "/images/perfumes/placeholders/perfume-placeholder.svg";
  const isAddDisabled = isAdded || isBoxFull;
  const addButtonLabel = isAdded
    ? translator?.t?.("general.added") || "Added"
    : isBoxFull
      ? translator?.t?.("general.boxFull") || "Box full"
      : translator?.t?.("general.addToBox") || "Add to Box";

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
          <span>{translator?.t?.("recommendation.whyThisFits") || "Why this fits"}</span>
          <span
            className={`recommendation-confidence recommendation-confidence-${confidence
              .toLowerCase()
              .replace(/\s+/g, "-")}`}
          >
            {confidenceLabel}
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

function parseNumericAnalyticsValue(value) {
  if (value === "" || value === null || value === undefined) {
    return null;
  }

  const parsedValue = Number(value);
  return Number.isFinite(parsedValue) ? parsedValue : null;
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
