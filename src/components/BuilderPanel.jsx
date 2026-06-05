import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { getTierData } from "../utils/tierUtils";

const DISCOVERY_BONUS_TARGET_POINTS = 12;
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
    const [isNotesModalOpen, setIsNotesModalOpen] = useState(false);
    const [isFinalSummaryOpen, setIsFinalSummaryOpen] = useState(false);
    const [curatorBonusPreference, setCuratorBonusPreference] = useState("complement");
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
          coverageSummary,
          recommendations: curatorBonusLane,
          preference: curatorBonusPreference,
        }),
      [coverageSummary, curatorBonusLane, curatorBonusPreference]
    );
    const isCuratorBonusUnlocked =
      totalPoints >= DISCOVERY_BONUS_TARGET_POINTS && totalSlots >= minSlots;
  return (
    <aside className="builder-panel">
      <div className="panel-header">
        <div>
          <h2>My Box</h2>
          <p>
            {totalSlots}/{maxSelectableSlots} selected slots used
          </p>
        </div>

        <button className="ghost-button" onClick={onClearBox}>
          Clear
        </button>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <span>Points</span>
          <strong>{totalPoints.toFixed(1)}</strong>
        </div>

        <div className="stat-card">
          <span>Value</span>
          <strong>${estimatedValue.toFixed(0)}</strong>
        </div>

        <div className="stat-card">
          <span>Upgrade</span>
          <strong>${upgradeValue.toFixed(0)}</strong>
        </div>
      </div>

      <div className="slot-bar">
        <div
          className="slot-progress"
          style={{
            width: `${Math.min((totalSlots / maxSelectableSlots) * 100, 100)}%`,
          }}
        />
      </div>

      <DiscoveryBonusProgress
        totalPoints={totalPoints}
        totalSlots={totalSlots}
        minSlots={minSlots}
        isUnlocked={isCuratorBonusUnlocked}
        preference={curatorBonusPreference}
        onPreferenceChange={setCuratorBonusPreference}
        hiddenCuratorPicks={hiddenCuratorPicks}
        curatorInsight={curatorInsight}
      />

      <BoxSlotTray
        selectedPerfumes={selectedPerfumes}
        maxSlots={maxSlots}
        maxSelectableSlots={maxSelectableSlots}
        isCuratorBonusUnlocked={isCuratorBonusUnlocked}
      />

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

      {isBoxReady && (
        <button
          className="review-box-button"
          onClick={() => setIsFinalSummaryOpen(true)}
        >
          Review Box
        </button>
      )}

      <div className="selected-list">
        {selectedPerfumes.length === 0 ? (
          <div className="empty-state discovery-empty-state">
            <div className="discovery-empty-intro">
              <span>Discovery Box</span>
              <h3>Build Your Discovery Box</h3>
              <p>
                Select fragrances from the catalog to create a personalized
                collection, unlock Curator Bonus picks, and discover your
                Collection Identity.
              </p>
            </div>

            <div className="discovery-empty-steps">
              <div>
                <span>1</span>
                <strong>Pick Fragrances</strong>
                <p>Build a collection that reflects your tastes.</p>
              </div>

              <div>
                <span>2</span>
                <strong>Unlock Curator Bonus</strong>
                <p>
                  Reach the minimum requirements and receive hidden
                  curator-selected bonus fragrances.
                </p>
              </div>

              <div>
                <span>3</span>
                <strong>Reveal Your Collection DNA</strong>
                <p>
                  Review your accords, seasonal coverage, strengths, and
                  collection identity.
                </p>
              </div>
            </div>
          </div>
        ) : (
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
          ))
        )}
      </div>

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
        <FinalSummaryModal
          selectedPerfumes={selectedPerfumes}
          totalSlots={totalSlots}
          totalPoints={totalPoints}
          estimatedValue={estimatedValue}
          upgradeValue={upgradeValue}
          boxSummary={boxSummary}
          coverageSummary={coverageSummary}
          scentDna={scentDna}
          isBoxReady={isBoxReady}
          isCuratorBonusUnlocked={isCuratorBonusUnlocked}
          curatorBonusPreference={curatorBonusPreference}
          hiddenCuratorPicks={hiddenCuratorPicks}
          onClose={() => setIsFinalSummaryOpen(false)}
        />
      )}
    </aside>
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

function buildCuratorInsight({
  coverageSummary,
  recommendations,
  preference,
}) {
  const strengths = uniqueStrings([
    ...(coverageSummary.strengths || []).map((item) => item.label),
  ]).slice(0, 3);
  const recommendationReasons = recommendations.flatMap(
    (recommendation) => recommendation.reasons || []
  );
  const improvementSources =
    preference === "complement"
      ? [
          ...(coverageSummary.gaps || []).map((item) => item.label),
          ...recommendationReasons,
        ]
      : recommendationReasons;

  return {
    strengths,
    improvementGoals: uniqueStrings(improvementSources).slice(0, 3),
  };
}

function uniqueStrings(values) {
  return [...new Set(values.filter(Boolean))];
}

function DiscoveryBonusProgress({
  totalPoints,
  totalSlots,
  minSlots,
  isUnlocked,
  preference,
  onPreferenceChange,
  hiddenCuratorPicks,
  curatorInsight,
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
  const preferenceData = CURATOR_BONUS_PREFERENCES[preference];
  const hiddenPickCount = hiddenCuratorPicks.length;
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

      <div className="curator-preference-control">
        <label htmlFor="curator-bonus-preference">
          Curator Bonus Style
        </label>

        <select
          id="curator-bonus-preference"
          value={preference}
          onChange={(event) => onPreferenceChange(event.target.value)}
        >
          {Object.entries(CURATOR_BONUS_PREFERENCES).map(([value, option]) => (
            <option key={value} value={value}>
              {option.label}
            </option>
          ))}
        </select>

        <p>{preferenceData.description}</p>
      </div>

      <CuratorInsight insight={curatorInsight} />

      <div className="curator-bonus-card">
        <div className="curator-bonus-icon" aria-hidden="true">
          🎁
        </div>

        <div>
          <span>Curator Bonus</span>
          <strong>
            {isUnlocked ? "Curator Bonus Unlocked" : "Locked"}
          </strong>
          <p>
            {isUnlocked
              ? `${preferenceData.label} selected. Your curator pick${
                  hiddenPickCount === 1 ? "" : "s"
                } will stay wrapped until reveal.`
              : "Complete your Discovery Box to unlock."}
          </p>
        </div>

        <div className={`curator-pick-slot ${isUnlocked ? "active" : ""}`}>
          <span>Curator Pick</span>
          <strong>{isUnlocked ? "Curator Bonus" : "Bonus Slot"}</strong>
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

function CuratorInsight({ insight }) {
  return (
    <section className="curator-insight">
      <h4>Curator Insight</h4>

      <div className="curator-insight-grid">
        <CuratorInsightList
          title="Your collection is currently strong in:"
          items={insight.strengths}
          emptyText="Add more fragrances to reveal collection strengths."
        />
        <CuratorInsightList
          title="Your curator bonus will focus on:"
          items={insight.improvementGoals}
          emptyText="Add more fragrances to reveal curator focus areas."
        />
      </div>
    </section>
  );
}

function CuratorInsightList({ title, items, emptyText }) {
  return (
    <div>
      <span>{title}</span>

      {items.length > 0 ? (
        <ul>
          {items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      ) : (
        <p>{emptyText}</p>
      )}
    </div>
  );
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
}) {
  if (recommendations.length === 0) {
    return null;
  }

  return (
    <section className="recommendation-lane">
      <h4>{title}</h4>

      {recommendations.map((recommendation, index) => (
        <RecommendationCard
          key={recommendation.perfume.id}
          recommendation={recommendation}
          rank={index + 1}
          isAdded={selectedPerfumeIds.has(recommendation.perfume.id)}
          isBoxFull={isBoxFull}
          onAddPerfume={onAddPerfume}
        />
      ))}
    </section>
  );
}

function RecommendationCard({
  recommendation,
  rank,
  isAdded,
  isBoxFull,
  onAddPerfume,
}) {
  const { perfume, score, reasons } = recommendation;
  const isAddDisabled = isAdded || isBoxFull;
  const addButtonLabel = isAdded ? "Added" : isBoxFull ? "Box full" : "Add to Box";

  return (
    <article className="recommendation-card">
      <div className="recommendation-card-header">
        <div className="recommendation-title-group">
          <span className="recommendation-rank">#{rank}</span>

          <div>
            <strong>{perfume.name}</strong>
            <span>
              {perfume.brand} · {perfume.points} pt
            </span>
          </div>
        </div>

        <span className="recommendation-score">{score}</span>
      </div>

      {reasons.length > 0 && (
        <div className="recommendation-reasons">
          {reasons.map((reason) => (
            <p key={reason}>{reason}</p>
          ))}
        </div>
      )}

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

function BoxSlotTray({
  selectedPerfumes,
  maxSlots,
  maxSelectableSlots,
  isCuratorBonusUnlocked,
}) {
  const rowCount = Math.ceil(maxSlots / 2);
  const rows = Array.from({ length: rowCount }, (_, rowIndex) => ({
    leftIndex: rowIndex * 2,
    rightIndex: rowIndex * 2 + 1,
  }));

  return (
    <div className="box-slot-tray" aria-label="Fragrance box slots">
      <div className="box-column">
        {rows.map(({ leftIndex }) => (
            <BoxVialSlot
              key={`left-slot-${leftIndex}`}
              index={leftIndex}
              perfume={selectedPerfumes[leftIndex]}
              isReserved={leftIndex >= maxSelectableSlots}
              isCuratorBonusUnlocked={isCuratorBonusUnlocked}
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
            />
          ) : null
        )}
      </div>
    </div>
  );
}

function BoxVialSlot({ perfume, index, isReserved, isCuratorBonusUnlocked }) {
  if (isReserved) {
    return (
      <div
        className={`box-vial bonus-reserved ${
          isCuratorBonusUnlocked ? "bonus-unlocked" : "bonus-locked"
        }`}
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
    return (
      <div
        className="box-vial empty"
        aria-label={`Empty slot ${index + 1}`}
      >
        <span className="vial-cap" />
        <span className="vial-body" />
      </div>
    );
  }

  const tierData = getTierData(perfume.id);

  return (
    <div
      className="box-vial filled"
      aria-label={`Filled slot ${index + 1}: ${perfume.name}`}
      title={perfume.name}
      style={{
        "--tier-color": tierData.color,
        "--tier-background": tierData.background,
      }}
    >
      <span className="vial-cap" />
      <span className="vial-body">
        <strong className="vial-label">{getShortPerfumeName(perfume.name)}</strong>
      </span>
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
