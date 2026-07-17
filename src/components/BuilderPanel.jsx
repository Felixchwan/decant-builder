import { forwardRef, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { businessConfig } from "../config/business";
import { getTierData } from "../utils/tierUtils";

const DISCOVERY_BONUS_TARGET_POINTS = 12;
const SHARE_IMAGE_WIDTH = 1080;
const SHARE_IMAGE_HEIGHT = 1350;
const CURATOR_BONUS_PREFERENCES = {
  complement: {
    label: "Complement My Collection",
    description: "Curator picks selected to balance your box.",
  },
  similar: {
    label: "Similar To My Picks",
    description: "Curator picks inspired by your current taste.",
  },
};

function BuilderPanel({
  totalSlots,
  maxSlots,
  maxSelectableSlots,
  totalPoints,
  estimatedValue,
  upgradeValue,
  selectedPerfumes,
  boxSummary,
  onClearBox,
  onRemovePerfume,
  onReorderPerfumes,
  minSlots,
  minPoints,
  missingSlots,
  missingPoints,
  coverageSummary,
  recommendations,
  scentDna,
  isBoxReady,
  onAddPerfume,
}) {
    const [hasSeenDiscoveryIntro, setHasSeenDiscoveryIntro] = useState(() => {
      if (typeof window === "undefined") {
        return true;
      }

      return window.localStorage.getItem("discoveryBoxIntroSeen") === "true";
    });
    const [isDiscoveryIntroOpen, setIsDiscoveryIntroOpen] = useState(false);
    const [isNotesModalOpen, setIsNotesModalOpen] = useState(false);
    const [isFinalSummaryOpen, setIsFinalSummaryOpen] = useState(false);
    const [isCollectionSnapshotOpen, setIsCollectionSnapshotOpen] = useState(false);
    const [curatorBonusPreference, setCuratorBonusPreference] = useState("complement");
    const previousCuratorBonusUnlockedRef = useRef(false);
    const curatorBonusModuleRef = useRef(null);
    const [isCuratorBonusAnimating, setIsCuratorBonusAnimating] = useState(false);
    const [shareStatus, setShareStatus] = useState("");
    const [isShareTooltipOpen, setIsShareTooltipOpen] = useState(false);
    const [isBalanceLaneEmphasized, setIsBalanceLaneEmphasized] = useState(false);
    const shareStatusTimeoutRef = useRef(null);
    const balanceLaneRef = useRef(null);
    const balanceLaneEmphasisTimeoutRef = useRef(null);
    const sortedNotes = [...boxSummary.notes].sort();
    const selectedPerfumeIds = new Set(
      selectedPerfumes.map((perfume) => perfume.id)
    );
    const basedOnYourPicks = recommendations?.basedOnYourPicks || [];
    const toBalanceYourBox = recommendations?.toBalanceYourBox || [];
    const curatorBonusLane =
      curatorBonusPreference === "similar" ? basedOnYourPicks : toBalanceYourBox;
    const hiddenCuratorPicks = useMemo(
      () => buildHiddenCuratorPicks(curatorBonusLane, selectedPerfumeIds),
      [curatorBonusLane, selectedPerfumes]
    );
    const curatorInsight = useMemo(
      () =>
        buildCuratorInsight({
          boxSummary,
          coverageSummary,
          recommendations: curatorBonusLane,
          preference: curatorBonusPreference,
          selectedCount: selectedPerfumes.length,
        }),
      [boxSummary, coverageSummary, curatorBonusLane, curatorBonusPreference, selectedPerfumes.length]
    );
    const boxIntelligence = useMemo(
      () =>
        buildBoxIntelligence({
          boxSummary,
          coverageSummary,
          scentDna,
          selectedPerfumes,
        }),
      [boxSummary, coverageSummary, scentDna, selectedPerfumes]
    );
    const isCuratorBonusUnlocked =
      totalPoints >= DISCOVERY_BONUS_TARGET_POINTS && totalSlots >= minSlots;
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
    const canCopyShareImage =
      typeof window !== "undefined" &&
      typeof window.ClipboardItem !== "undefined" &&
      Boolean(navigator.clipboard?.write);
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
        window.localStorage.setItem("discoveryBoxIntroSeen", "true");
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

    const createShareImageBlob = () =>
      renderDiscoveryBoxShareImage({
        selectedPerfumes,
        maxSlots,
        maxSelectableSlots,
        isCuratorBonusUnlocked,
        totalPoints,
        businessName: businessConfig.businessName,
      });

    const handleDownloadShareImage = async () => {
      try {
        const blob = await createShareImageBlob();
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = "discovery-decants-box.png";
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.setTimeout(() => URL.revokeObjectURL(url), 1000);
        showShareStatus("Share image downloaded.");
      } catch (error) {
        console.error("Unable to download share image", error);
        showShareStatus("Could not create the share image.");
      }
    };

    const handleCopyShareImage = async () => {
      if (!canCopyShareImage) {
        showShareStatus("Image copy is not supported in this browser.");
        return;
      }

      try {
        const blob = await createShareImageBlob();
        await navigator.clipboard.write([
          new ClipboardItem({
            "image/png": blob,
          }),
        ]);
        showShareStatus("Share image copied.");
      } catch (error) {
        console.error("Unable to copy share image", error);
        showShareStatus("Copy failed. Try Download PNG instead.");
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
        setIsCuratorBonusAnimating(false);
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
            <h2>My Box</h2>
            <button
              className="info-button"
              type="button"
              onClick={() => setIsDiscoveryIntroOpen(true)}
              aria-label="Show Discovery Box introduction"
            >
              i
            </button>
          </div>
          <p>
            {totalSlots}/{maxSelectableSlots} selected slots used
          </p>
        </div>

        <button className="ghost-button" onClick={onClearBox}>
          Clear
        </button>
      </div>

      {shouldShowDiscoveryIntro && (
        <DiscoveryBoxCoachmark onDismiss={dismissDiscoveryIntro} />
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
          <span className="share-box-label">Share My Box</span>

          <span className="share-info-wrap">
            <button
              type="button"
              className="share-info-button"
              aria-label="About Share My Box"
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
              Export a clean visual snapshot of your Discovery Box.
            </span>
          </span>
        </div>

        <div className="share-box-buttons">
          <button type="button" onClick={handleDownloadShareImage}>
            Download PNG
          </button>
          <button
            type="button"
            onClick={handleCopyShareImage}
            disabled={!canCopyShareImage}
          >
            Copy Image
          </button>
        </div>

        {shareStatus && <p className="share-box-status">{shareStatus}</p>}
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
        totalPoints={totalPoints}
        totalSlots={totalSlots}
        minSlots={minSlots}
        isUnlocked={isCuratorBonusUnlocked}
        isAnimating={isCuratorBonusAnimating}
        preference={curatorBonusPreference}
        onPreferenceChange={setCuratorBonusPreference}
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
          Review My Box
        </button>

        {!isBoxReady && (
          <p>Need {reviewRequirementText || "minimum requirements"} to review.</p>
        )}
      </div>

{/*
<div className={`box-status ${isBoxReady ? "ready" : "not-ready"}`}>
  <strong>
    {isBoxReady ? "Discovery Box ready" : "Discovery Box requirements"}
  </strong>

  <p>
    {totalSlots >= minSlots
      ? `✓ Minimum ${minSlots} fragrances`
      : `Need ${missingSlots} more fragrance${missingSlots === 1 ? "" : "s"}`}
  </p>

  <p>
    {totalPoints >= minPoints
      ? `✓ Minimum ${minPoints} points`
      : `Need ${missingPoints.toFixed(1)} more point${
          missingPoints === 1 ? "" : "s"
        }`}
  </p>
</div>
*/}

      {/*
      <div className="selected-list">
        {selectedPerfumes.length > 0 &&
          selectedPerfumes.map((perfume, index) => (
            <div className="selected-item" key={`${perfume.id}-${index}`}>
              <div>
                <strong>{perfume.name}</strong>

                {perfume.subtitle && (
                <span className="selected-subtitle">
                    {perfume.subtitle
                    .toLowerCase()
                    .replace(/\b\w/g, (char) => char.toUpperCase())}
                </span>
                )}

                <span>
                 {perfume.brand} · {perfume.points} pt
                </span>
              </div>

              <button onClick={() => onRemovePerfume(index)}>Remove</button>
            </div>
          ))}
      </div>
      */}

      <CollectionSnapshot
        boxSummary={boxSummary}
        coverageSummary={coverageSummary}
        insight={curatorInsight}
        selectedCount={selectedPerfumes.length}
        isExpanded={isCollectionSnapshotOpen}
        onToggle={() => setIsCollectionSnapshotOpen((isOpen) => !isOpen)}
        onOpenScentLibrary={() => setIsNotesModalOpen(true)}
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

    <RecommendationLane
      title="To Balance Your Box"
      recommendations={toBalanceYourBox}
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
      {false && isNotesModalOpen && (
  <div
    className="modal-overlay"
    onClick={() => setIsNotesModalOpen(false)}
  >
    <div
      className="modal-content"
      onClick={(event) => event.stopPropagation()}
    >
      <div className="modal-header">
        <h3>Scent Library</h3>

        <button
          onClick={() => setIsNotesModalOpen(false)}
        >
          ✕
        </button>
      </div>

      <div className="notes-grid">
        {sortedNotes.map((note) => (
          <span key={note} className="note-pill">
            {note}
          </span>
        ))}
      </div>
    </div>
  </div>
      )}
      {isFinalSummaryOpen && (
        <DiscoveryBoxReviewModal
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
          onClose={() => setIsFinalSummaryOpen(false)}
        />
      )}
    </aside>
  );
}

function DiscoveryBoxCoachmark({ onDismiss }) {
  return (
    <section className="discovery-coachmark" aria-label="Discovery Box introduction">
      <span className="coachmark-pointer" aria-hidden="true" />

      <div>
        <span>Welcome to Discovery Box</span>
        <p>Build your collection by selecting fragrances from the catalog.</p>
        <p>Reach 12 points to unlock Curator Bonus selections.</p>
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
  boxSummary,
  coverageSummary,
  insight,
  selectedCount,
  isExpanded,
  onToggle,
  onOpenScentLibrary,
}) {
  const seasonRows = buildSeasonCoverageRows(
    boxSummary.seasonStrengths || boxSummary.seasonCounts || {},
    selectedCount
  );
  const hasProfileData =
    boxSummary.occasions.length > 0 ||
    boxSummary.seasons.length > 0 ||
    boxSummary.vibes.length > 0 ||
    Object.keys(boxSummary.accordMap).length > 0 ||
    boxSummary.notes.length > 0;
  const hasAnalysisData =
    coverageSummary.strengths.length > 0 || coverageSummary.gaps.length > 0;

  return (
    <section className={`collection-snapshot ${isExpanded ? "is-expanded" : ""}`}>
      <div className="collection-snapshot-header">
        <h3>Collection Snapshot</h3>
        <button type="button" onClick={onToggle} aria-expanded={isExpanded}>
          {isExpanded ? "Hide Full Analysis" : "View Full Analysis"}
        </button>
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

      <div className="collection-insight">
        <span>Collection Insight</span>

        <div className="collection-insight-grid">
          <CollectionInsightList
            title="Your collection currently excels in:"
            items={insight.strengths}
            emptyText="Select fragrances to generate collection insights."
            marker="check"
          />
          <CollectionInsightList
            title="Opportunities:"
            items={insight.improvementGoals}
            emptyText="Build your collection to reveal its opportunities."
            marker="bullet"
          />
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
                  <span>Notes</span>

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

function buildSeasonCoverageRows(seasonCounts, selectedCount = 0) {
  const seasons = ["spring", "summer", "fall", "winter"];
  const maxSeasonStrength = Math.max(1, selectedCount * 10);

  return seasons.map((season) => {
    const strength = seasonCounts[season] || 0;
    const score = Math.round((strength / maxSeasonStrength) * 100);

    return {
      id: season,
      label: formatLabel(season),
      count: score,
      strength,
      percent: score,
    };
  });
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

function buildCuratorInsight({
  boxSummary,
  coverageSummary,
  recommendations,
  preference,
  selectedCount,
}) {
  if (selectedCount === 0) {
    return {
      strengths: [],
      improvementGoals: [],
    };
  }

  const seasonalRows = buildSeasonCoverageRows(
    boxSummary.seasonStrengths || boxSummary.seasonCounts || {},
    selectedCount
  );
  const seasonalStrengths = seasonalRows
    .filter((season) => season.count >= 50)
    .map((season) => `${getSeasonStrengthLevel(season.count)} ${season.label} Coverage`);
  const seasonalOpportunities = seasonalRows
    .filter((season) => season.count < 50)
    .map((season) => `${getSeasonStrengthLevel(season.count)} ${season.label} Coverage`);
  const profileStrengths = getCollectionProfileStrengths(boxSummary);
  const profileOpportunities = getCollectionProfileOpportunities(boxSummary, seasonalRows);
  const strengths = uniqueStrings([
    ...seasonalStrengths,
    ...profileStrengths,
    ...(coverageSummary.strengths || []).map((item) => item.label),
  ]).slice(0, 3);
  const recommendationReasons = recommendations.flatMap(
    (recommendation) => recommendation.reasons || []
  );
  const improvementSources =
    preference === "complement"
      ? [
          ...seasonalOpportunities,
          ...profileOpportunities,
          ...(coverageSummary.gaps || []).map((item) => getGapLabel(item)),
          ...recommendationReasons,
        ]
      : [
          ...profileOpportunities,
          ...seasonalOpportunities,
          ...recommendationReasons,
        ];

  return {
    strengths,
    improvementGoals: uniqueStrings(improvementSources).slice(0, 3),
  };
}

function buildBoxIntelligence({
  boxSummary,
  coverageSummary,
  scentDna,
  selectedPerfumes,
}) {
  const selectedCount = selectedPerfumes.length;

  if (selectedCount === 0) {
    return {
      isEarly: false,
      items: [],
    };
  }

  const seasonRows = buildSeasonCoverageRows(
    boxSummary.seasonStrengths || boxSummary.seasonCounts || {},
    selectedCount
  );
  const occasionCounts = boxSummary.occasionCounts || {};
  const vibeCounts = boxSummary.vibeCounts || {};
  const accordCounts = getAccordCounts(boxSummary);
  const profileSignals = getBoxProfileSignals({
    occasionCounts,
    vibeCounts,
    accordCounts,
  });
  const dominantProfile = getDominantBoxProfile({
    profileSignals,
    scentDna,
    selectedCount,
  });
  const strongestCoverage = getStrongestBoxCoverage({
    seasonRows,
    occasionCounts,
    selectedCount,
  });
  const mostImportantGap = getMostImportantBoxGap({
    boxSummary,
    coverageSummary,
    seasonRows,
    occasionCounts,
    vibeCounts,
    accordCounts,
    profileSignals,
    selectedCount,
  });
  const bestNextMove = getBestBoxNextMove({
    gap: mostImportantGap,
    profileSignals,
    occasionCounts,
    accordCounts,
  });

  return {
    isEarly: selectedCount < 3,
    items: uniqueInsightItems([
      {
        type: "profile",
        label: selectedCount < 3 ? "Early profile" : "Dominant profile",
        value: dominantProfile,
      },
      {
        type: "coverage",
        label: "Strongest coverage",
        value: strongestCoverage,
      },
      {
        type: "gap",
        label: "Main gap",
        value: mostImportantGap.label,
      },
      {
        type: "next",
        label: "Best next move",
        value: bestNextMove,
      },
    ]).slice(0, 4),
  };
}

function getBoxProfileSignals({ occasionCounts, vibeCounts, accordCounts }) {
  const fresh =
    (vibeCounts.fresh || 0) +
    (vibeCounts.clean || 0) +
    (accordCounts.fresh || 0) +
    (accordCounts.citrus || 0) +
    (accordCounts.marine || 0) +
    (accordCounts.aquatic || 0) +
    (accordCounts.aromatic || 0);
  const warmEvening =
    (occasionCounts.date || 0) +
    (occasionCounts.night || 0) +
    (occasionCounts.evening || 0) +
    (occasionCounts.formal || 0) +
    (vibeCounts.warm || 0) +
    (vibeCounts.cozy || 0) +
    (vibeCounts.seductive || 0) +
    (accordCounts.amber || 0) +
    (accordCounts["warm spicy"] || 0) +
    (accordCounts.smoky || 0);
  const sweetSeductive =
    (vibeCounts.seductive || 0) +
    (accordCounts.sweet || 0) +
    (accordCounts.vanilla || 0) +
    (accordCounts.amber || 0);
  const woodySophisticated =
    (accordCounts.woody || 0) +
    (accordCounts.leather || 0) +
    (accordCounts.iris || 0) +
    (accordCounts.powdery || 0) +
    (occasionCounts.formal || 0) +
    (vibeCounts.elegant || 0);

  return {
    fresh,
    warmEvening,
    sweetSeductive,
    woodySophisticated,
  };
}

function getDominantBoxProfile({ profileSignals, scentDna, selectedCount }) {
  const sortedSignals = Object.entries(profileSignals).sort(
    ([, scoreA], [, scoreB]) => scoreB - scoreA
  );
  const [topSignal, topScore] = sortedSignals[0] || ["balanced", 0];
  const secondScore = sortedSignals[1]?.[1] || 0;
  const seasonBalance = scentDna?.scores?.seasonBalance || 0;
  const versatility = scentDna?.scores?.versatility || 0;

  if (
    (selectedCount >= 6 && seasonBalance >= 60 && versatility >= 70) ||
    (selectedCount >= 4 && seasonBalance >= 60 && versatility >= 70 && topScore <= secondScore + 4)
  ) {
    return "Balanced and versatile";
  }

  if (topSignal === "warmEvening") {
    return "Warm and evening-oriented";
  }

  if (topSignal === "sweetSeductive") {
    return "Sweet and seductive";
  }

  if (topSignal === "woodySophisticated") {
    return "Woody and sophisticated";
  }

  if (topSignal === "fresh" && topScore > 0) {
    return "Fresh-heavy";
  }

  return selectedCount < 3 ? "Still taking shape" : "Balanced and versatile";
}

function getStrongestBoxCoverage({ seasonRows, occasionCounts, selectedCount }) {
  const seasonCandidates = seasonRows
    .filter((season) => season.count >= 30)
    .map((season) => ({
      score: season.count,
      label: `${getSeasonStrengthLevel(season.count)} ${season.label.toLowerCase()} coverage`,
    }));
  const occasionCandidates = [
    {
      score: getOccasionCoverageScore(occasionCounts, ["office"], selectedCount),
      label: "Strong office versatility",
    },
    {
      score: getOccasionCoverageScore(occasionCounts, ["date", "night", "evening"], selectedCount),
      label: "Strong date-night profile",
    },
    {
      score: getOccasionCoverageScore(occasionCounts, ["daily", "casual"], selectedCount),
      label: "Strong daily versatility",
    },
    {
      score: getOccasionCoverageScore(occasionCounts, ["formal"], selectedCount),
      label: "Strong formal coverage",
    },
  ].filter((candidate) => candidate.score >= 50);
  const topCandidate = [...seasonCandidates, ...occasionCandidates].sort(
    (a, b) => b.score - a.score || a.label.localeCompare(b.label)
  )[0];

  return topCandidate?.label || "Profile still developing";
}

function getMostImportantBoxGap({
  coverageSummary,
  seasonRows,
  occasionCounts,
  accordCounts,
  profileSignals,
  selectedCount,
}) {
  const winterScore = seasonRows.find((season) => season.id === "winter")?.count || 0;
  const summerScore = seasonRows.find((season) => season.id === "summer")?.count || 0;
  const formalCount = occasionCounts.formal || 0;
  const eveningCount =
    (occasionCounts.date || 0) + (occasionCounts.night || 0) + (occasionCounts.evening || 0);
  const accordDiversity = Object.keys(accordCounts).length;
  const gapCandidate = (coverageSummary.gaps || [])[0];

  if (winterScore < 35 && profileSignals.fresh > profileSignals.warmEvening) {
    return {
      type: "winter",
      label: "Limited winter depth",
    };
  }

  if (formalCount === 0 && selectedCount >= 3) {
    return {
      type: "formal",
      label: "Weak formal coverage",
    };
  }

  if (eveningCount < 2 && selectedCount >= 3) {
    return {
      type: "evening",
      label: "Limited evening versatility",
    };
  }

  if (profileSignals.fresh >= profileSignals.warmEvening + 3) {
    return {
      type: "warmth",
      label: "Missing warm or smoky character",
    };
  }

  if (accordDiversity < Math.min(5, selectedCount + 2)) {
    return {
      type: "diversity",
      label: "Low accord diversity",
    };
  }

  if (summerScore < 30 && selectedCount >= 3) {
    return {
      type: "summer",
      label: "Limited warm-weather freshness",
    };
  }

  if (gapCandidate) {
    return {
      type: gapCandidate.category || "coverage",
      label: getGapLabel(gapCandidate),
    };
  }

  return {
    type: "contrast",
    label: "Missing a clear contrast profile",
  };
}

function getBestBoxNextMove({ gap, profileSignals, occasionCounts, accordCounts }) {
  if (gap.type === "winter" || gap.type === "warmth") {
    return "Add one warm evening fragrance";
  }

  if (gap.type === "formal") {
    return "Add a formal woody option";
  }

  if (gap.type === "summer") {
    return "Add a fresh daytime fragrance";
  }

  if (gap.type === "evening") {
    return "Add a stronger evening fragrance";
  }

  if (gap.type === "diversity") {
    return "Add a contrasting profile for more diversity";
  }

  if (!accordCounts.woody && (occasionCounts.formal || 0) === 0) {
    return "Add a polished woody fragrance";
  }

  if (profileSignals.warmEvening > profileSignals.fresh + 2) {
    return "Add a fresh daytime fragrance";
  }

  return "Add a clear contrast fragrance";
}

function getOccasionCoverageScore(occasionCounts, targets, selectedCount) {
  const count = targets.reduce((sum, target) => sum + (occasionCounts[target] || 0), 0);

  if (selectedCount === 0) {
    return 0;
  }

  return Math.round((count / selectedCount) * 100);
}

function uniqueInsightItems(items) {
  const seenValues = new Set();

  return items.filter((item) => {
    const normalizedValue = item.value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

    if (seenValues.has(normalizedValue)) {
      return false;
    }

    seenValues.add(normalizedValue);
    return true;
  });
}

function getSeasonStrengthLevel(score) {
  if (score >= 90) return "Dominant";
  if (score >= 70) return "Excellent";
  if (score >= 50) return "Strong";
  if (score >= 30) return "Moderate";
  return "Weak";
}

function getCollectionProfileStrengths(boxSummary) {
  const strengths = [];
  const occasionCounts = boxSummary.occasionCounts || {};
  const vibeCounts = boxSummary.vibeCounts || {};
  const accordCounts = getAccordCounts(boxSummary);

  if ((occasionCounts.daily || 0) + (occasionCounts.office || 0) >= 3) {
    strengths.push("Strong Daily Versatility");
  }

  if ((occasionCounts.date || 0) + (occasionCounts.night || 0) >= 3) {
    strengths.push("Strong Evening Variety");
  }

  if ((vibeCounts.fresh || 0) + (accordCounts.fresh || 0) + (accordCounts.citrus || 0) >= 4) {
    strengths.push("Fresh-forward Profile");
  }

  if ((vibeCounts.warm || 0) + (vibeCounts.cozy || 0) + (accordCounts.amber || 0) >= 4) {
    strengths.push("Strong Cold-weather Depth");
  }

  return strengths;
}

function getCollectionProfileOpportunities(boxSummary, seasonalRows) {
  const opportunities = [];
  const occasionCounts = boxSummary.occasionCounts || {};
  const vibeCounts = boxSummary.vibeCounts || {};
  const accordCounts = getAccordCounts(boxSummary);
  const winterScore = seasonalRows.find((season) => season.id === "winter")?.count || 0;
  const summerScore = seasonalRows.find((season) => season.id === "summer")?.count || 0;
  const freshSignals =
    (vibeCounts.fresh || 0) + (vibeCounts.clean || 0) + (accordCounts.citrus || 0);
  const warmSignals =
    (vibeCounts.warm || 0) +
    (vibeCounts.cozy || 0) +
    (accordCounts.amber || 0) +
    (accordCounts["warm spicy"] || 0);

  if (winterScore < 50 && warmSignals < freshSignals) {
    opportunities.push("Limited Cold-weather Depth");
  }

  if (summerScore < 30) {
    opportunities.push("Limited Warm-weather Freshness");
  }

  if ((occasionCounts.date || 0) + (occasionCounts.night || 0) < 2) {
    opportunities.push("Missing Evening Variety");
  }

  if (!accordCounts.woody) {
    opportunities.push("Underrepresented Woody Fragrances");
  }

  if (!accordCounts.leather && (occasionCounts.date || 0) + (occasionCounts.night || 0) < 3) {
    opportunities.push("Missing Leather Depth");
  }

  if (freshSignals >= warmSignals + 3) {
    opportunities.push("Fresh-heavy Profile");
  }

  return opportunities;
}

function getGapLabel(item) {
  if (item.category === "seasons") {
    return `Weak ${formatLabel(item.target)} Coverage`;
  }

  return `Limited ${formatLabel(item.target)} Variety`;
}

function getAccordCounts(boxSummary) {
  return Object.fromEntries(
    Object.entries(boxSummary.accordMap || {}).map(([accord, perfumeNames]) => [
      accord,
      perfumeNames.length,
    ])
  );
}

function uniqueStrings(values) {
  return [...new Set(values.filter(Boolean))];
}

const CuratorBonusModule = forwardRef(function CuratorBonusModule(
  {
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
          <span>Curator Bonus</span>
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
        {isUnlocked ? "Curator Bonus Unlocked" : lockedMessage}
      </p>

      {isAnimating && (
        <div className="curator-unlock-confirmation" role="status">
          Curator Bonus Unlocked
        </div>
      )}

      {(!isUnlocked || isAnimating) && (
        <div className="curator-lock-visual" aria-hidden="true">
          <span />
        </div>
      )}

      <div className="curator-bonus-card">
        <div className="curator-bonus-copy">
          {!isUnlocked && <strong>Complete your Discovery Box</strong>}
          <p>
            {isUnlocked
              ? `${preferenceData.label} selected. Your curator pick${
                  hiddenPickCount === 1 ? "" : "s"
                } will stay wrapped until reveal.`
              : "Unlock Curator Bonus and choose your reward strategy."}
          </p>
        </div>

        {isUnlocked ? (
          <div className="curator-preference-control">
            <label htmlFor="curator-bonus-preference">
              Curator Bonus Style
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
            <span>Curator Bonus Style</span>
            <strong>Unlock to choose curator style</strong>
          </div>
        )}

        <div className={`curator-pick-slot ${isUnlocked ? "active" : ""}`}>
          <span>Curator Pick</span>
          <strong>Bonus Fragrance</strong>
          <p>Equivalent to 2 bonus points.</p>
          {isUnlocked && (
            <p>
              {preference === "similar"
                ? "Selected based on your fragrance preferences."
                : "Selected to complement your collection."}
            </p>
          )}
        </div>
      </div>
    </section>
  );
});

function DiscoveryBonusProgress({
  totalPoints,
  totalSlots,
  minSlots,
  isUnlocked,
}) {
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
      className={`discovery-bonus-panel ${isUnlocked ? "unlocked" : "locked"}`}
    >
      <div className="discovery-progress-header">
        <div>
          <span>Discovery Box Progress</span>
          <strong>Curator Bonus</strong>
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
        {isUnlocked
          ? "Curator Bonus Unlocked"
          : lockedMessage}
      </p>

        <span hidden aria-hidden="true">
          🎁
        </span>

    </section>
  );
}

function CuratorBonusSection({
  isUnlocked,
  isAnimating,
  preference,
  onPreferenceChange,
  hiddenCuratorPicks,
}) {
  const preferenceData = CURATOR_BONUS_PREFERENCES[preference];
  const hiddenPickCount = hiddenCuratorPicks.length;

  return (
    <section
      className={`discovery-bonus-panel curator-bonus-section ${
        isUnlocked ? "unlocked" : "locked"
      } ${isAnimating ? "is-unlocking" : ""}`}
    >
      <div className="curator-bonus-panel-header">
        <div>
          <span>Curator Bonus</span>
        </div>

        <span className="curator-bonus-status">
          {isUnlocked ? "Unlocked" : "Locked"}
        </span>
      </div>

      {isAnimating && (
        <div className="curator-unlock-confirmation" role="status">
          Curator Bonus Unlocked
        </div>
      )}

      {(!isUnlocked || isAnimating) && (
        <div className="curator-lock-visual" aria-hidden="true">
          <span />
        </div>
      )}

      <div className="curator-bonus-card">
        <div className="curator-bonus-copy">
          {!isUnlocked && <strong>Complete your Discovery Box</strong>}
          <p>
            {isUnlocked
              ? `${preferenceData.label} selected. Your curator pick${
                  hiddenPickCount === 1 ? "" : "s"
                } will stay wrapped until reveal.`
              : "Unlock Curator Bonus and choose your reward strategy."}
          </p>
        </div>

        {isUnlocked ? (
          <div className="curator-preference-control">
            <label htmlFor="curator-bonus-preference">
              Curator Bonus Style
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
            <span>Curator Bonus Style</span>
            <strong>Unlock to choose curator style</strong>
          </div>
        )}

        <div className={`curator-pick-slot ${isUnlocked ? "active" : ""}`}>
          <span>Curator Pick</span>
          <strong>Bonus Fragrance</strong>
          <p>Equivalent to 2 bonus points.</p>
          {isUnlocked && (
            <p>
              {preference === "similar"
                ? "Selected based on your fragrance preferences."
                : "Selected to complement your collection."}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

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

function CollectionInsightList({ title, items, emptyText, marker }) {
  return (
    <div>
      <span>{title}</span>

      {items.length > 0 ? (
        <ul>
          {items.map((item) => (
            <li className={`insight-marker-${marker}`} key={item}>{item}</li>
          ))}
        </ul>
      ) : (
        <p>{emptyText}</p>
      )}
    </div>
  );
}

function DiscoveryBoxReviewModal({
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
  onClose,
}) {
  const [finalizeStatus, setFinalizeStatus] = useState("");
  const [customerInfo, setCustomerInfo] = useState({
    name: "",
    city: "",
    notes: "",
  });
  const [fallbackWhatsAppUrl, setFallbackWhatsAppUrl] = useState("");
  const collectionIdentity = getCollectionIdentity(boxSummary);
  const curatorPreferenceLabel =
    CURATOR_BONUS_PREFERENCES[curatorBonusPreference]?.label;
  const seasonRows = buildSeasonCoverageRows(
    boxSummary.seasonStrengths || boxSummary.seasonCounts || {},
    selectedPerfumes.length
  );
  const strengths =
    curatorInsight?.strengths?.length > 0
      ? curatorInsight.strengths.slice(0, 3)
      : coverageSummary.strengths.slice(0, 3).map((item) => item.label);
  const opportunities =
    curatorInsight?.improvementGoals?.length > 0
      ? curatorInsight.improvementGoals.slice(0, 3)
      : coverageSummary.gaps.slice(0, 3).map((item) => item.label);
  const curatorRewardLabel =
    hiddenCuratorPicks.length > 1 ? "Bonus Fragrances" : "Bonus Fragrance";
  const canFinalize =
    isBoxReady && customerInfo.name.trim() && customerInfo.city.trim();

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
    setCustomerInfo((currentInfo) => ({
      ...currentInfo,
      [field]: value,
    }));
  }

  async function handleFinalizeBox() {
    if (!canFinalize) {
      setFinalizeStatus("Enter customer name and city before finalizing.");
      return;
    }

    const whatsappMessage = buildDiscoveryBoxWhatsAppMessage({
      customerInfo,
      selectedPerfumes,
      totalPoints,
      estimatedValue,
      isCuratorBonusUnlocked,
      curatorPreferenceLabel,
    });
    const whatsappUrl = `https://wa.me/${businessConfig.whatsappNumber}?text=${encodeURIComponent(
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
          ? "WhatsApp was blocked. The order message was copied; use the button below to open WhatsApp."
          : "WhatsApp was blocked. Use the button below to open WhatsApp manually."
      );
      return;
    }

    setFallbackWhatsAppUrl("");
    setFinalizeStatus(
      didCopy
        ? `Opening WhatsApp to message ${businessConfig.businessName}. Order message copied.`
        : `Opening WhatsApp to message ${businessConfig.businessName}.`
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
            <p className="summary-eyebrow">Discovery Box Review</p>
            <h3 id="discovery-review-title">Your personalized fragrance collection is ready.</h3>
          </div>

          <button type="button" onClick={onClose}>Close</button>
        </div>

        <section className="collection-identity review-identity-hero">
          <span>Collection Identity</span>
          <strong>{collectionIdentity.name}</strong>
          <p>{collectionIdentity.description}</p>
        </section>

        <section className="final-summary-stats">
          <SummaryStat label="Fragrances" value={selectedPerfumes.length} />
          <SummaryStat label="Total Points" value={totalPoints.toFixed(1)} />
          <SummaryStat label="Order Total" value={`$${estimatedValue.toFixed(0)}`} />
          <SummaryStat
            label="Curator Bonus"
            value={isCuratorBonusUnlocked ? "Unlocked" : "Locked"}
          />
        </section>

        <section className="final-summary-section review-customer-section">
          <h4>Customer Info</h4>

          <div className="review-customer-form">
            <label>
              <span>Customer name</span>
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
              <span>City</span>
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

        <section className="final-summary-section review-rules-section">
          <h4>Box Rules</h4>

          <ul className="review-rules-list">
            <li>Build at least 6 fragrances, up to 14 selectable fragrances.</li>
            <li>1 point = $100. Your order total is based on selected points.</li>
            <li>Curator Bonus unlocks at 12 points and 6 fragrances.</li>
            <li>The physical box has 16 slots, with 2 reserved for Curator Bonus picks.</li>
          </ul>
        </section>

        <section className="final-summary-section review-season-section">
          <h4>Season Coverage</h4>

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

        <section className="final-summary-section review-curator-section">
          <h4>Curator Bonus</h4>

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
                  ? "Your curator pick remains wrapped until reveal."
                  : "Unlocks when your Discovery Box is complete."}
              </p>
            </div>
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
            Open WhatsApp manually
          </a>
        )}
      </div>
    </div>,
    document.body
  );
}

function buildDiscoveryBoxWhatsAppMessage({
  customerInfo,
  selectedPerfumes,
  totalPoints,
  estimatedValue,
  isCuratorBonusUnlocked,
  curatorPreferenceLabel,
}) {
  const customerNotes = customerInfo.notes.trim();
  const perfumeLines = selectedPerfumes.map(
    (perfume, index) =>
      `${index + 1}. ${perfume.name} - ${perfume.brand} (${perfume.points} pt)`
  );
  const curatorStatus = isCuratorBonusUnlocked
    ? [
        "Curator Bonus: Unlocked",
        `Curator Style: ${curatorPreferenceLabel}`,
      ].join("\n")
    : "Curator Bonus: Not unlocked";

  return [
    `Hello ${businessConfig.businessName}, I would like to finalize my Discovery Box order.`,
    "",
    `Customer: ${customerInfo.name.trim()}`,
    `City: ${customerInfo.city.trim()}`,
    customerNotes ? `Notes: ${customerNotes}` : "",
    "",
    "Selected fragrances:",
    ...perfumeLines,
    "",
    `Total slots: ${selectedPerfumes.length}`,
    `Total points: ${totalPoints.toFixed(1)}`,
    `Order total: $${estimatedValue.toFixed(0)}`,
    curatorStatus,
    "",
    "Please confirm availability and next steps. Thank you.",
  ].filter(Boolean).join("\n");
}

function FinalSummaryModal({
  selectedPerfumes,
  totalSlots,
  totalPoints,
  estimatedValue,
  upgradeValue,
  boxSummary,
  coverageSummary,
  scentDna,
  isBoxReady,
  isCuratorBonusUnlocked,
  curatorBonusPreference,
  hiddenCuratorPicks,
  onClose,
}) {
  const collectionIdentity = getCollectionIdentity(boxSummary);
  const curatorPreferenceLabel =
    CURATOR_BONUS_PREFERENCES[curatorBonusPreference]?.label;
  const [customerInfo, setCustomerInfo] = useState({
    name: "",
    city: "",
    notes: "",
  });
  const [preparedOrder, setPreparedOrder] = useState(null);
  const [copyStatus, setCopyStatus] = useState("");
  const canPrepareOrder =
    isBoxReady && customerInfo.name.trim() && customerInfo.city.trim();
  const customerMessage = preparedOrder
    ? buildCustomerWhatsAppMessage({
        order: preparedOrder,
        totalSlots,
        totalPoints,
        estimatedValue,
        isCuratorBonusUnlocked,
        curatorPreferenceLabel,
      })
    : "";
  const sellerSummary = preparedOrder
    ? buildSellerOrderSummary({
        order: preparedOrder,
        selectedPerfumes,
        totalPoints,
        estimatedValue,
        curatorPreferenceLabel,
        hiddenCuratorPicks,
      })
    : "";

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
    setCustomerInfo((currentInfo) => ({
      ...currentInfo,
      [field]: value,
    }));
  }

  function handlePrepareOrder() {
    if (!canPrepareOrder) {
      return;
    }

    setPreparedOrder({
      ...customerInfo,
      name: customerInfo.name.trim(),
      city: customerInfo.city.trim(),
      notes: customerInfo.notes.trim(),
      orderCode: buildOrderCode(),
      timestamp: new Date(),
    });
    setCopyStatus("");
  }

  async function handleCopy(label, text) {
    const didCopy = await copyText(text);
    setCopyStatus(didCopy ? `${label} copied` : `Could not copy ${label.toLowerCase()}`);
  }

  return createPortal(
    <div className="modal-overlay final-summary-overlay" onClick={onClose}>
      <div
        className="final-summary-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="final-summary-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal-header">
          <div>
            <p className="summary-eyebrow">Discovery Box</p>
            <h3 id="final-summary-title">Your Completed Box</h3>
          </div>

          <button onClick={onClose}>Close</button>
        </div>

        <section className="collection-identity">
          <span>Collection Identity</span>
          <strong>{collectionIdentity.name}</strong>
          <p>{collectionIdentity.description}</p>
        </section>

        <section className="final-summary-stats">
          <SummaryStat label="Fragrances Selected" value={totalSlots} />
          <SummaryStat label="Total Points" value={totalPoints.toFixed(1)} />
          <SummaryStat label="Estimated Value" value={`$${estimatedValue.toFixed(0)}`} />
          <SummaryStat label="Upgrade Value" value={`$${upgradeValue.toFixed(0)}`} />
        </section>

        <section className="final-readiness-grid">
          <div className={isBoxReady ? "ready" : ""}>
            <span>Discovery Box</span>
            <strong>{isBoxReady ? "Ready" : "In Progress"}</strong>
            <p>
              {isBoxReady
                ? "Minimum fragrance and point requirements are met."
                : "Complete the requirements before checkout prep."}
            </p>
          </div>

          <div className={isCuratorBonusUnlocked ? "ready" : ""}>
            <span>Curator Bonus</span>
            <strong>{isCuratorBonusUnlocked ? "Unlocked" : "Locked"}</strong>
            <p>
              {isCuratorBonusUnlocked
                ? `${curatorPreferenceLabel} selected. Picks remain wrapped until reveal.`
                : "Unlocks when the Discovery Box is valid."}
            </p>
          </div>
        </section>

        <section className="final-summary-section order-prep-section">
          <h4>Order Prep</h4>

          <div className="order-customer-form">
            <label>
              <span>Name</span>
              <input
                type="text"
                value={customerInfo.name}
                onChange={(event) =>
                  handleCustomerInfoChange("name", event.target.value)
                }
                placeholder="Customer name"
              />
            </label>

            <label>
              <span>City</span>
              <input
                type="text"
                value={customerInfo.city}
                onChange={(event) =>
                  handleCustomerInfoChange("city", event.target.value)
                }
                placeholder="Delivery city"
              />
            </label>

            <label className="order-notes-field">
              <span>Notes / Preferences</span>
              <textarea
                value={customerInfo.notes}
                onChange={(event) =>
                  handleCustomerInfoChange("notes", event.target.value)
                }
                placeholder="Optional customer notes"
                rows={3}
              />
            </label>
          </div>

          <div className="order-prep-actions">
            <button
              type="button"
              onClick={handlePrepareOrder}
              disabled={!canPrepareOrder}
            >
              Prepare Order
            </button>
            {!isBoxReady && (
              <p>Complete the Discovery Box before preparing the order.</p>
            )}
          </div>

          {preparedOrder && (
            <div className="seller-order-summary">
              <div>
                <span>Customer WhatsApp Message</span>
                <p>Curator Pick identities stay hidden from the customer.</p>
                <pre>{customerMessage}</pre>
                <button
                  type="button"
                  onClick={() =>
                    handleCopy("Customer WhatsApp message", customerMessage)
                  }
                >
                  Copy Customer WhatsApp Message
                </button>
              </div>

              <div>
                <span>Seller Order Summary</span>
                <p>Operational view for fulfillment. Hidden Curator Picks are shown here only.</p>
                <pre>{sellerSummary}</pre>
                <button
                  type="button"
                  onClick={() =>
                    handleCopy("Seller order summary", sellerSummary)
                  }
                >
                  Copy Seller Order Summary
                </button>
              </div>

              {copyStatus && <p className="copy-status">{copyStatus}</p>}
            </div>
          )}
        </section>

        <ScentDnaPanel scentDna={scentDna} />

        <section className="final-summary-section">
          <h4>Selected Fragrances</h4>

          <div className="final-fragrance-list">
            {selectedPerfumes.map((perfume, index) => (
              <article key={`${perfume.id}-${index}`}>
                <div>
                  <strong>{perfume.name}</strong>
                  {perfume.subtitle && (
                    <span className="selected-subtitle">
                      {perfume.subtitle
                        .toLowerCase()
                        .replace(/\b\w/g, (char) => char.toUpperCase())}
                    </span>
                  )}
                  <span>{perfume.brand}</span>
                </div>

                <strong>{perfume.points} pt</strong>
              </article>
            ))}
          </div>
        </section>

        <section className="final-summary-section">
          <h4>Box Profile</h4>

          <ProfileGroup label="Occasions" values={boxSummary.occasions} />
          <ProfileGroup label="Seasons" values={boxSummary.seasons} />
          <ProfileGroup label="Vibes" values={boxSummary.vibes} />
        </section>

        <section className="final-summary-section">
          <h4>Box Analysis</h4>

          <div className="final-analysis-grid">
            <div>
              <span>Strengths</span>
              {coverageSummary.strengths.length > 0 ? (
                coverageSummary.strengths.slice(0, 8).map((item) => (
                  <p key={`${item.category}-${item.label}`}>✓ {item.label}</p>
                ))
              ) : (
                <p>Your box is ready, with more profile detail coming as you add variety.</p>
              )}
            </div>

            <div>
              <span>Gaps</span>
              {coverageSummary.gaps.length > 0 ? (
                coverageSummary.gaps.map((item) => (
                  <p key={`${item.category}-${item.target}`}>
                    {formatLabel(item.target)}: {item.label}
                  </p>
                ))
              ) : (
                <p>No major seasonal gaps detected. This box has a well-rounded profile.</p>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>,
    document.body
  );
}

function buildOrderCode() {
  const timestamp = new Date();
  const datePart = timestamp
    .toISOString()
    .slice(2, 10)
    .replaceAll("-", "");
  const timePart = String(timestamp.getTime()).slice(-4);

  return `DB-${datePart}-${timePart}`;
}

function buildCustomerWhatsAppMessage({
  order,
  totalSlots,
  totalPoints,
  estimatedValue,
  isCuratorBonusUnlocked,
  curatorPreferenceLabel,
}) {
  return [
    "Discovery Box Order",
    `Order Code: ${order.orderCode}`,
    `Customer: ${order.name}`,
    `City: ${order.city}`,
    `Selected Fragrances: ${totalSlots}`,
    `Selected Points: ${totalPoints.toFixed(1)}`,
    `Customer Price: $${estimatedValue.toFixed(0)}`,
    `Curator Bonus: ${isCuratorBonusUnlocked ? "Unlocked" : "Locked"}`,
    `Curator Bonus Style: ${curatorPreferenceLabel}`,
    "Curator Picks remain wrapped until delivery.",
    order.notes ? `Notes: ${order.notes}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

function buildSellerOrderSummary({
  order,
  selectedPerfumes,
  totalPoints,
  estimatedValue,
  curatorPreferenceLabel,
  hiddenCuratorPicks,
}) {
  return [
    "SELLER ORDER SUMMARY",
    `Order Code: ${order.orderCode}`,
    `Timestamp: ${order.timestamp.toLocaleString()}`,
    "",
    "CUSTOMER",
    `Name: ${order.name}`,
    `City: ${order.city}`,
    `Notes / Preferences: ${order.notes || "None"}`,
    "",
    "SELECTED FRAGRANCES",
    ...selectedPerfumes.map(formatOrderPerfumeLine),
    "",
    `Total Selected Points: ${totalPoints.toFixed(1)}`,
    `Customer Price: $${estimatedValue.toFixed(0)}`,
    `Estimated Collection Value: $${estimatedValue.toFixed(0)}`,
    "",
    "CURATOR BONUS",
    `Style: ${curatorPreferenceLabel}`,
    "Hidden Curator Picks:",
    ...(hiddenCuratorPicks.length > 0
      ? hiddenCuratorPicks.map(formatOrderPerfumeLine)
      : ["No hidden picks available"]),
  ].join("\n");
}

function formatOrderPerfumeLine(perfume) {
  return `- ${perfume.name}${perfume.subtitle ? ` ${perfume.subtitle}` : ""} | ${
    perfume.brand
  } | ${perfume.points} pt`;
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

function RecommendationLane({
  title,
  recommendations,
  selectedPerfumeIds,
  isBoxFull,
  onAddPerfume,
  sectionRef,
  isEmphasized = false,
}) {
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    setActiveIndex((currentIndex) => {
      if (recommendations.length === 0) {
        return 0;
      }

      return Math.min(currentIndex, recommendations.length - 1);
    });
  }, [recommendations.length]);

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
}) {
  const { perfume, score } = recommendation;
  const explanations = getRecommendationExplanations(recommendation);
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

function getRecommendationExplanations(recommendation) {
  const reasons = Array.isArray(recommendation.reasons)
    ? recommendation.reasons
    : [];
  const reasonOptions = [
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

function ScentDnaPanel({ scentDna }) {
  return (
    <section className="final-summary-section scent-dna-panel">
      <h4>Scent DNA</h4>

      <div className="scent-dna-scores">
        <DnaScore label="Versatility" value={scentDna.scores.versatility} />
        <DnaScore label="Depth" value={scentDna.scores.depth} />
        <DnaScore label="Season Balance" value={scentDna.scores.seasonBalance} />
      </div>

      <div className="scent-dna-grid">
        <DnaMetricGroup title="Dominant Accords" items={scentDna.topAccords} />
        <DnaMetricGroup title="Top Vibes" items={scentDna.topVibes} />
        <DnaMetricGroup title="Season Coverage" items={scentDna.seasonCoverage} />
      </div>
    </section>
  );
}

function DnaScore({ label, value }) {
  return (
    <div className="scent-dna-score">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function DnaMetricGroup({ title, items }) {
  return (
    <div className="scent-dna-group">
      <span>{title}</span>

      {items.length > 0 ? (
        items.map((item) => <DnaBar key={item.label} item={item} />)
      ) : (
        <p>No data yet</p>
      )}
    </div>
  );
}

function DnaBar({ item }) {
  return (
    <div className="scent-dna-row">
      <div className="scent-dna-row-label">
        <strong>{formatLabel(item.label)}</strong>
        <span>
          {item.count} / {item.percent}%
        </span>
      </div>

      <div className="scent-dna-bar" aria-hidden="true">
        <span style={{ width: `${item.percent}%` }} />
      </div>
    </div>
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

function ProfileGroup({ label, values }) {
  return (
    <div className="final-profile-group">
      <span>{label}</span>

      <div className="final-summary-tags">
        {values.length > 0 ? (
          values.map((value) => <span key={value}>{value}</span>)
        ) : (
          <p>No data yet</p>
        )}
      </div>
    </div>
  );
}

function getCollectionIdentity(boxSummary) {
  const vibes = new Set(boxSummary.vibes || []);
  const occasions = new Set(boxSummary.occasions || []);
  const seasons = new Set(boxSummary.seasons || []);
  const occasionCounts = boxSummary.occasionCounts || {};
  const vibeCounts = boxSummary.vibeCounts || {};
  const accordLabels = getTopCollectionLabels(boxSummary.accordMap);
  const scentProfile = formatIdentityList(accordLabels, "a varied scent profile");
  const seasonProfile = getSeasonProfile(seasons);
  const occasionProfile = getOccasionProfile(occasions, occasionCounts);

  if (isEveningRotation(vibes, occasions, accordLabels, occasionCounts, vibeCounts)) {
    return {
      name: "Evening Rotation",
      description: `Focused on ${scentProfile}, with a profile suited to ${occasionProfile}.`,
    };
  }

  if (isFreshRotation(vibes, occasions, accordLabels, occasionCounts, vibeCounts)) {
    return {
      name: "Fresh Rotation",
      description: `Built around ${scentProfile}, ${seasonProfile} and ${occasionProfile}.`,
    };
  }

  if (seasons.size >= 4 && occasions.size >= 5) {
    return {
      name: "Balanced Rotation",
      description: `Designed for strong year-round coverage with ${occasionProfile} and broad appeal.`,
    };
  }

  if (occasions.size >= 4 || vibes.has("versatile")) {
    return {
      name: "Versatile Rotation",
      description: `Built for ${occasionProfile}, supported by ${scentProfile}.`,
    };
  }

  return {
    name: "Curated Selection",
    description: `A focused selection shaped by ${scentProfile} and ${seasonProfile}.`,
  };
}

function isFreshRotation(vibes, occasions, accordLabels, occasionCounts, vibeCounts) {
  const freshScore =
    getCount(vibeCounts, "fresh") +
    getCount(vibeCounts, "clean") +
    getCount(occasionCounts, "office") +
    getCount(occasionCounts, "daily") +
    getMatchingLabelCount(accordLabels, ["citrus", "aromatic", "fresh spicy", "green"]);

  return freshScore >= 3 || (vibes.has("fresh") && occasions.has("office"));
}

function isEveningRotation(vibes, occasions, accordLabels, occasionCounts, vibeCounts) {
  const eveningScore =
    getCount(occasionCounts, "date") +
    getCount(occasionCounts, "night") +
    getCount(occasionCounts, "evening") +
    getCount(occasionCounts, "formal") +
    getCount(vibeCounts, "seductive") +
    getCount(vibeCounts, "bold") +
    getMatchingLabelCount(accordLabels, ["amber", "sweet", "warm spicy", "vanilla", "woody"]);

  return eveningScore >= 4 || (occasions.has("night") && occasions.has("date"));
}

function getTopCollectionLabels(valueMap = {}) {
  return Object.entries(valueMap)
    .sort(([, firstItems], [, secondItems]) => secondItems.length - firstItems.length)
    .slice(0, 3)
    .map(([label]) => formatLabel(label).toLowerCase());
}

function getCount(countMap, key) {
  return countMap[key] || 0;
}

function getMatchingLabelCount(labels, targets) {
  return labels.filter((label) => targets.includes(label)).length;
}

function getSeasonProfile(seasons) {
  if (seasons.size >= 4) {
    return "year-round coverage";
  }

  if (seasons.has("spring") && seasons.has("summer")) {
    return "warm-weather versatility";
  }

  if (seasons.has("fall") || seasons.has("winter")) {
    return "cool-weather depth";
  }

  if (seasons.size > 0) {
    return `${formatIdentityList([...seasons].map(formatLabel))} coverage`;
  }

  return "seasonal flexibility";
}

function getOccasionProfile(occasions, occasionCounts = {}) {
  const daytimeCount =
    getCount(occasionCounts, "daily") +
    getCount(occasionCounts, "office") +
    getCount(occasionCounts, "casual");
  const eveningCount =
    getCount(occasionCounts, "date") +
    getCount(occasionCounts, "night") +
    getCount(occasionCounts, "evening");

  if (eveningCount > daytimeCount) {
    return "evening wear";
  }

  if (getCount(occasionCounts, "formal") > daytimeCount) {
    return "polished occasions";
  }

  if (
    occasions.has("daily") &&
    occasions.has("office") &&
    occasions.has("casual")
  ) {
    return "daily versatility";
  }

  if (occasions.size > 0) {
    return formatIdentityList([...occasions].map(formatLabel).slice(0, 3));
  }

  return "flexible wear";
}

function formatIdentityList(items, fallback = "a balanced profile") {
  const filteredItems = items.filter(Boolean);

  if (filteredItems.length === 0) {
    return fallback;
  }

  if (filteredItems.length === 1) {
    return filteredItems[0];
  }

  return `${filteredItems.slice(0, -1).join(", ")} and ${
    filteredItems[filteredItems.length - 1]
  }`;
}

function renderDiscoveryBoxShareImage({
  selectedPerfumes,
  maxSlots,
  maxSelectableSlots,
  isCuratorBonusUnlocked,
  totalPoints,
  businessName,
}) {
  const canvas = document.createElement("canvas");
  canvas.width = SHARE_IMAGE_WIDTH;
  canvas.height = SHARE_IMAGE_HEIGHT;
  const ctx = canvas.getContext("2d");
  const rowCount = Math.ceil(maxSlots / 2);
  const selectedCount = selectedPerfumes.length;

  drawShareBackground(ctx);
  drawShareHeader(ctx, businessName, selectedCount, maxSelectableSlots, totalPoints);
  drawShareBox(ctx, {
    selectedPerfumes,
    maxSlots,
    maxSelectableSlots,
    isCuratorBonusUnlocked,
    rowCount,
  });
  drawShareFooter(ctx, isCuratorBonusUnlocked);

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
      } else {
        reject(new Error("Canvas export failed"));
      }
    }, "image/png");
  });
}

function drawShareBackground(ctx) {
  const background = ctx.createLinearGradient(0, 0, 0, SHARE_IMAGE_HEIGHT);
  background.addColorStop(0, "#13110c");
  background.addColorStop(0.48, "#050605");
  background.addColorStop(1, "#100d08");
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, SHARE_IMAGE_WIDTH, SHARE_IMAGE_HEIGHT);

  const glow = ctx.createRadialGradient(540, 300, 60, 540, 300, 620);
  glow.addColorStop(0, "rgba(212, 175, 55, 0.20)");
  glow.addColorStop(0.42, "rgba(212, 175, 55, 0.05)");
  glow.addColorStop(1, "rgba(212, 175, 55, 0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, SHARE_IMAGE_WIDTH, SHARE_IMAGE_HEIGHT);
}

function drawShareHeader(ctx, businessName, selectedCount, maxSelectableSlots, totalPoints) {
  ctx.save();
  ctx.textAlign = "center";
  ctx.fillStyle = "#f8f3e5";
  ctx.font = "700 54px Inter, Arial, sans-serif";
  ctx.fillText(businessName || "Discovery Decants", SHARE_IMAGE_WIDTH / 2, 126);

  ctx.fillStyle = "rgba(245, 231, 195, 0.72)";
  ctx.font = "600 26px Inter, Arial, sans-serif";
  ctx.fillText("My Discovery Box", SHARE_IMAGE_WIDTH / 2, 174);

  ctx.fillStyle = "rgba(203, 213, 225, 0.74)";
  ctx.font = "500 22px Inter, Arial, sans-serif";
  ctx.fillText(
    `${selectedCount}/${maxSelectableSlots} fragrances selected  |  ${formatSharePoints(totalPoints)}`,
    SHARE_IMAGE_WIDTH / 2,
    218
  );
  ctx.restore();
}

function drawShareBox(ctx, {
  selectedPerfumes,
  maxSlots,
  maxSelectableSlots,
  isCuratorBonusUnlocked,
  rowCount,
}) {
  const box = {
    x: 78,
    y: 284,
    width: 924,
    height: 826,
  };
  const paddingX = 38;
  const paddingY = 46;
  const gap = 26;
  const centerWidth = 142;
  const columnWidth = (box.width - paddingX * 2 - centerWidth - gap * 2) / 2;
  const slotHeight = 66;
  const rowGap = 19;
  const slotsHeight = rowCount * slotHeight + (rowCount - 1) * rowGap;
  const startY = box.y + (box.height - slotsHeight) / 2;
  const leftX = box.x + paddingX;
  const centerX = leftX + columnWidth + gap;
  const rightX = centerX + centerWidth + gap;

  drawRoundedRect(ctx, box.x, box.y, box.width, box.height, 34);
  const frameGradient = ctx.createLinearGradient(box.x, box.y, box.x, box.y + box.height);
  frameGradient.addColorStop(0, "#1d1a13");
  frameGradient.addColorStop(0.5, "#050505");
  frameGradient.addColorStop(1, "#14100a");
  ctx.fillStyle = frameGradient;
  ctx.fill();
  ctx.strokeStyle = "rgba(245, 231, 195, 0.20)";
  ctx.lineWidth = 2;
  ctx.stroke();

  drawRoundedRect(ctx, box.x + 16, box.y + 16, box.width - 32, box.height - 32, 22);
  ctx.strokeStyle = "rgba(255, 255, 255, 0.045)";
  ctx.lineWidth = 2;
  ctx.stroke();

  drawRoundedRect(ctx, centerX, box.y + paddingY, centerWidth, box.height - paddingY * 2, 18);
  const centerGradient = ctx.createLinearGradient(centerX, box.y, centerX + centerWidth, box.y);
  centerGradient.addColorStop(0, "rgba(0, 0, 0, 0.82)");
  centerGradient.addColorStop(0.5, "rgba(8, 8, 7, 0.95)");
  centerGradient.addColorStop(1, "rgba(0, 0, 0, 0.82)");
  ctx.fillStyle = centerGradient;
  ctx.fill();
  ctx.strokeStyle = "rgba(255, 255, 255, 0.04)";
  ctx.stroke();

  for (let rowIndex = 0; rowIndex < rowCount; rowIndex += 1) {
    const y = startY + rowIndex * (slotHeight + rowGap);
    const leftIndex = rowIndex * 2;
    const rightIndex = rowIndex * 2 + 1;

    drawShareSlot(ctx, {
      x: leftX,
      y,
      width: columnWidth,
      height: slotHeight,
      perfume: selectedPerfumes[leftIndex],
      isReserved: leftIndex >= maxSelectableSlots,
      isCuratorBonusUnlocked,
    });

    if (rightIndex < maxSlots) {
      drawShareSlot(ctx, {
        x: rightX,
        y,
        width: columnWidth,
        height: slotHeight,
        perfume: selectedPerfumes[rightIndex],
        isReserved: rightIndex >= maxSelectableSlots,
        isCuratorBonusUnlocked,
      });
    }
  }
}

function drawShareSlot(ctx, {
  x,
  y,
  width,
  height,
  perfume,
  isReserved,
  isCuratorBonusUnlocked,
}) {
  const capWidth = 52;
  const tierColor = perfume ? getTierData(perfume.id).color : "rgba(148, 163, 184, 0.42)";
  const bodyX = x + capWidth - 2;
  const bodyWidth = width - capWidth + 2;

  ctx.save();
  ctx.shadowColor = "rgba(0, 0, 0, 0.45)";
  ctx.shadowBlur = 10;
  ctx.shadowOffsetY = 4;
  drawRoundedRect(ctx, x, y + 5, width, height - 10, 20);
  ctx.fillStyle = "rgba(0, 0, 0, 0.26)";
  ctx.fill();
  ctx.restore();

  drawSlotCap(ctx, x, y + 8, capWidth, height - 16, tierColor, Boolean(perfume), isReserved);

  if (isReserved) {
    drawBonusShareSlot(ctx, bodyX, y + 6, bodyWidth, height - 12, isCuratorBonusUnlocked);
    return;
  }

  if (!perfume) {
    drawEmptyShareSlot(ctx, bodyX, y + 6, bodyWidth, height - 12);
    return;
  }

  drawRoundedRect(ctx, bodyX, y + 6, bodyWidth, height - 12, 18);
  const bodyGradient = ctx.createLinearGradient(bodyX, y, bodyX, y + height);
  bodyGradient.addColorStop(0, "#242827");
  bodyGradient.addColorStop(0.5, "#080b0a");
  bodyGradient.addColorStop(1, "#171a18");
  ctx.fillStyle = bodyGradient;
  ctx.fill();
  ctx.strokeStyle = tierColor;
  ctx.lineWidth = 2.5;
  ctx.stroke();

  ctx.globalAlpha = 0.18;
  ctx.fillStyle = tierColor;
  drawRoundedRect(ctx, bodyX + 14, y + 16, bodyWidth - 28, 9, 8);
  ctx.fill();
  ctx.globalAlpha = 1;

  const label = perfume.shortName || getShortPerfumeName(perfume.name);
  ctx.fillStyle = "#f8fafc";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = "800 23px Inter, Arial, sans-serif";
  drawWrappedSlotLabel(ctx, label.toUpperCase(), bodyX + bodyWidth / 2, y + height / 2, bodyWidth - 36);
}

function drawSlotCap(ctx, x, y, width, height, color, isFilled, isReserved) {
  drawRoundedRect(ctx, x, y, width, height, 12);
  const capGradient = ctx.createLinearGradient(x, y, x + width, y);
  capGradient.addColorStop(0, isFilled || isReserved ? color : "rgba(148, 163, 184, 0.16)");
  capGradient.addColorStop(0.28, "#222625");
  capGradient.addColorStop(1, "#050606");
  ctx.fillStyle = capGradient;
  ctx.fill();
  ctx.strokeStyle = isFilled || isReserved ? color : "rgba(148, 163, 184, 0.18)";
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = "rgba(255, 255, 255, 0.12)";
  drawRoundedRect(ctx, x + 9, y + 8, width - 24, 5, 4);
  ctx.fill();
}

function drawEmptyShareSlot(ctx, x, y, width, height) {
  drawRoundedRect(ctx, x, y, width, height, 18);
  ctx.fillStyle = "rgba(3, 7, 8, 0.62)";
  ctx.fill();
  ctx.strokeStyle = "rgba(148, 163, 184, 0.22)";
  ctx.setLineDash([10, 12]);
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.strokeStyle = "rgba(245, 231, 195, 0.25)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x + width / 2, y + height / 2, 12, 0, Math.PI * 2);
  ctx.stroke();

  ctx.fillStyle = "rgba(245, 231, 195, 0.28)";
  ctx.font = "600 22px Inter, Arial, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("+", x + width / 2, y + height / 2 + 1);
}

function drawBonusShareSlot(ctx, x, y, width, height, isUnlocked) {
  drawRoundedRect(ctx, x, y, width, height, 18);

  if (isUnlocked) {
    const wrapGradient = ctx.createLinearGradient(x, y, x, y + height);
    wrapGradient.addColorStop(0, "#f8dfa0");
    wrapGradient.addColorStop(0.5, "#d6a12f");
    wrapGradient.addColorStop(1, "#7c4212");
    ctx.fillStyle = wrapGradient;
    ctx.fill();
    ctx.strokeStyle = "rgba(250, 204, 21, 0.86)";
    ctx.lineWidth = 2.5;
    ctx.stroke();

    ctx.fillStyle = "rgba(95, 13, 24, 0.88)";
    ctx.fillRect(x + width / 2 - 7, y, 14, height);
    ctx.fillRect(x, y + height / 2 - 5, width, 10);

    const sealX = x + width / 2;
    const sealY = y + height / 2;
    const seal = ctx.createRadialGradient(sealX - 4, sealY - 5, 2, sealX, sealY, 18);
    seal.addColorStop(0, "#b91c1c");
    seal.addColorStop(0.62, "#7f1d1d");
    seal.addColorStop(1, "#450a0a");
    ctx.fillStyle = seal;
    ctx.beginPath();
    ctx.arc(sealX, sealY, 17, 0, Math.PI * 2);
    ctx.fill();
    return;
  }

  const lockedGradient = ctx.createLinearGradient(x, y, x, y + height);
  lockedGradient.addColorStop(0, "#211d10");
  lockedGradient.addColorStop(1, "#050505");
  ctx.fillStyle = lockedGradient;
  ctx.fill();
  ctx.strokeStyle = "rgba(250, 204, 21, 0.42)";
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.globalAlpha = 0.34;
  ctx.strokeStyle = "rgba(250, 204, 21, 0.70)";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(x + 18, y + height - 12);
  ctx.lineTo(x + width - 18, y + 12);
  ctx.moveTo(x + 18, y + 12);
  ctx.lineTo(x + width - 18, y + height - 12);
  ctx.stroke();
  ctx.globalAlpha = 1;

  const lockX = x + width / 2;
  const lockY = y + height / 2;
  ctx.strokeStyle = "rgba(250, 204, 21, 0.80)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(lockX, lockY - 7, 12, Math.PI, 0);
  ctx.stroke();
  drawRoundedRect(ctx, lockX - 17, lockY - 4, 34, 25, 6);
  ctx.fillStyle = "rgba(250, 204, 21, 0.20)";
  ctx.fill();
  ctx.stroke();
}

function drawShareFooter(ctx, isCuratorBonusUnlocked) {
  ctx.save();
  ctx.textAlign = "center";
  ctx.fillStyle = "rgba(245, 231, 195, 0.78)";
  ctx.font = "700 28px Inter, Arial, sans-serif";
  ctx.fillText(
    isCuratorBonusUnlocked ? "Curator Bonus Unlocked" : "Curator Bonus Locked",
    SHARE_IMAGE_WIDTH / 2,
    1194
  );
  ctx.fillStyle = "rgba(203, 213, 225, 0.66)";
  ctx.font = "500 22px Inter, Arial, sans-serif";
  ctx.fillText(
    isCuratorBonusUnlocked
      ? "Mystery picks are wrapped inside your box."
      : "Complete your Discovery Box to unlock wrapped curator picks.",
    SHARE_IMAGE_WIDTH / 2,
    1236
  );
  ctx.fillStyle = "rgba(245, 231, 195, 0.42)";
  ctx.font = "600 18px Inter, Arial, sans-serif";
  ctx.fillText("Build yours with Discovery Decants", SHARE_IMAGE_WIDTH / 2, 1294);
  ctx.restore();
}

function drawRoundedRect(ctx, x, y, width, height, radius) {
  const resolvedRadius = Math.min(radius, width / 2, height / 2);

  ctx.beginPath();
  ctx.moveTo(x + resolvedRadius, y);
  ctx.lineTo(x + width - resolvedRadius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + resolvedRadius);
  ctx.lineTo(x + width, y + height - resolvedRadius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - resolvedRadius, y + height);
  ctx.lineTo(x + resolvedRadius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - resolvedRadius);
  ctx.lineTo(x, y + resolvedRadius);
  ctx.quadraticCurveTo(x, y, x + resolvedRadius, y);
  ctx.closePath();
}

function drawWrappedSlotLabel(ctx, text, x, y, maxWidth) {
  const words = text.split(/\s+/).filter(Boolean);

  if (words.length <= 1 || ctx.measureText(text).width <= maxWidth) {
    drawFittedLine(ctx, text, x, y, maxWidth);
    return;
  }

  const lines = [];
  let currentLine = "";

  words.forEach((word) => {
    const nextLine = currentLine ? `${currentLine} ${word}` : word;

    if (ctx.measureText(nextLine).width <= maxWidth || !currentLine) {
      currentLine = nextLine;
      return;
    }

    lines.push(currentLine);
    currentLine = word;
  });

  if (currentLine) {
    lines.push(currentLine);
  }

  if (lines.length === 1) {
    drawFittedLine(ctx, lines[0], x, y, maxWidth);
    return;
  }

  const firstLine = lines[0];
  const secondLine = lines.slice(1).join(" ");
  const lineGap = 22;
  drawFittedLine(ctx, firstLine, x, y - lineGap / 2, maxWidth);
  drawFittedLine(ctx, secondLine, x, y + lineGap / 2, maxWidth);
}

function drawFittedLine(ctx, text, x, y, maxWidth) {
  if (ctx.measureText(text).width <= maxWidth) {
    ctx.fillText(text, x, y);
    return;
  }

  let fittedText = text;
  while (fittedText.length > 3 && ctx.measureText(`${fittedText}...`).width > maxWidth) {
    fittedText = fittedText.slice(0, -1);
  }

  ctx.fillText(`${fittedText}...`, x, y);
}

function formatSharePoints(totalPoints) {
  const formattedPoints = Number.isInteger(totalPoints)
    ? totalPoints.toFixed(0)
    : totalPoints.toFixed(1);

  return `${formattedPoints} pts`;
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

function formatLabel(value) {
  return value
    .split(/(?=[A-Z])|[-_\s]/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export default BuilderPanel;
