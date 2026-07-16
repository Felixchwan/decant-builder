import { getBrandAsset } from "../data/brandAssets";

function PerfumeCard({
  perfume,
  tierData,
  onAddToBox,
  onOpenDetails,
  isDisabled,
}) {
  const imageFallback = "/images/perfumes/placeholders/perfume-placeholder.svg";
  const brandAsset = getBrandAsset(perfume.brand);

  return (
    <article className="perfume-card">
      <button
        type="button"
        className="perfume-card-details-trigger"
        onClick={() => onOpenDetails(perfume)}
      >
        <div className="perfume-card-image">
          <img
            className="perfume-card-bottle-image"
            src={perfume.image || imageFallback}
            alt={`${perfume.name} bottle`}
            onError={(event) => {
              event.currentTarget.onerror = null;
              event.currentTarget.src = imageFallback;
            }}
          />
        </div>

        <div className="perfume-info">
          <div className="perfume-info-heading">
            <div className="perfume-info-copy">
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

              <div className="perfume-card-tier-row">
                <div
                  className="tier-badge perfume-card-tier-desktop"
                  style={{
                    borderColor: tierData.color,
                    backgroundColor: tierData.background,
                    color: tierData.color,
                  }}
                >
                  <span>{tierData.emoji}</span>
                  {tierData.name} - {perfume.points} pt
                </div>

                {brandAsset && (
                  <span className="perfume-card-brand-logo-desktop" aria-hidden="true">
                    <img
                      src={brandAsset}
                      alt=""
                      loading="lazy"
                      onError={(event) => {
                        event.currentTarget
                          .closest(".perfume-card-brand-logo-desktop")
                          ?.remove();
                      }}
                    />
                  </span>
                )}
              </div>
            </div>

            {brandAsset && (
              <span className="perfume-card-brand-logo-mobile" aria-hidden="true">
                <img
                  src={brandAsset}
                  alt=""
                  loading="lazy"
                  onError={(event) => {
                    event.currentTarget
                      .closest(".perfume-card-brand-logo-mobile")
                      ?.remove();
                  }}
                />
              </span>
            )}
          </div>
        </div>

        <div className="tag-row">
          {(perfume.accords || []).slice(0, 3).map((accord) => (
            <span key={accord}>{accord}</span>
          ))}
        </div>
      </button>

      <button
        type="button"
        className="perfume-card-info-icon"
        data-tooltip="View notes & details"
        aria-label="View notes & details"
        onClick={() => onOpenDetails(perfume)}
      >
        i
      </button>

      <div className="perfume-card-compact-actions">
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

        <span className="compact-points">{perfume.points} pt</span>

        <button onClick={() => onAddToBox(perfume)} disabled={isDisabled}>
          Add
        </button>
      </div>

      <button
        className="perfume-card-add-full"
        onClick={() => onAddToBox(perfume)}
        disabled={isDisabled}
      >
        Add to box
      </button>
    </article>
  );
}

export default PerfumeCard;
