import { useState } from "react";
import { getTierData } from "../utils/tierUtils";

function BuilderPanel({
  totalSlots,
  maxSlots,
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
  isBoxReady,
}) {
    const [isNotesModalOpen, setIsNotesModalOpen] = useState(false);
    const sortedNotes = [...boxSummary.notes].sort();
  return (
    <aside className="builder-panel">
      <div className="panel-header">
        <div>
          <h2>My Box</h2>
          <p>
            {totalSlots}/{maxSlots} slots used
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
          style={{ width: `${(totalSlots / maxSlots) * 100}%` }}
        />
      </div>

      <BoxSlotTray selectedPerfumes={selectedPerfumes} maxSlots={maxSlots} />

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

      <div className="selected-list">
        {selectedPerfumes.length === 0 ? (
          <p className="empty-state">Start adding perfumes to your box.</p>
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

    {coverageSummary.seasonalRecommendations?.length > 0 && (
    <div className="recommendations">
    <h4>Recommended Picks</h4>

    {coverageSummary.seasonalRecommendations.map((item) => (
      <p key={`${item.season}-${item.perfume.id}`}>
        {getSeasonIcon(item.season)}{" "}
        {formatLabel(item.season)} Recommendation
        <br />
        → {item.perfume.name}
      </p>
        ))}
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
    </aside>
  );
}

function BoxSlotTray({ selectedPerfumes, maxSlots }) {
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
            />
          ) : null
        )}
      </div>
    </div>
  );
}

function BoxVialSlot({ perfume, index }) {
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
