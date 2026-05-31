function PerfumeCard({
  perfume,
  tierData,
  noteNames,
  onAddToBox,
  isDisabled,
}) {
  return (
    <article className="perfume-card">
      <div className="perfume-info">
        <h3>{perfume.name}</h3>
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

      <button onClick={() => onAddToBox(perfume)} disabled={isDisabled}>
        Add to box
      </button>
    </article>
  );
}

export default PerfumeCard;