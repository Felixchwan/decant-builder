function PerfumeCard({
  perfume,
  tierData,
  noteNames,
  onAddToBox,
  onOpenDetails,
  isDisabled,
}) {
  const imageFallback = "/images/perfumes/placeholders/perfume-placeholder.svg";

  return (
    <article className="perfume-card">
      <button
        type="button"
        className="perfume-card-details-trigger"
        onClick={() => onOpenDetails(perfume)}
      >
      <div className="perfume-card-image">
        <img
          src={perfume.image || imageFallback}
          alt={`${perfume.name} bottle`}
          onError={(event) => {
            event.currentTarget.onerror = null;
            event.currentTarget.src = imageFallback;
          }}
        />
      </div>

      <div className="perfume-info">
        <h3>{perfume.name}</h3>
        {perfume.subtitle && (
        <p
        className={`perfume-subtitle ${
        perfume.subtitleGlow ? "perfume-subtitle-glow" : ""
        }`}
        style={{
        color: perfume.subtitleColor || "#fbbf24",
        }}
        >
        {perfume.subtitle}
        </p>
        )}
        <p>{perfume.brand}</p>

        <div
          className="tier-badge"
          style={{
            borderColor: tierData.color,
            backgroundColor: tierData.background,
            color: tierData.color,
          }}
        >
          <span>{tierData.emoji}</span>
          {tierData.name} • {perfume.points} pt
        </div>
      </div>

      <div className="tag-row">
        {(perfume.accords || []).slice(0, 3).map((accord) => (
          <span key={accord}>{accord}</span>
        ))}
      </div>

      <div className="hover-details">
        <p>
          <strong>Notes:</strong> {noteNames.join(", ")}
        </p>
        <p>
          <strong>Best for:</strong>{" "}
          {(perfume.occasions || []).join(", ")}
        </p>
      </div>

      </button>

      <button onClick={() => onAddToBox(perfume)} disabled={isDisabled}>
        Add to box
      </button>
    </article>
  );
}

export default PerfumeCard;
