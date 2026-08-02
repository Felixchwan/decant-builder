import { brandAssets } from "@discovery-box/catalog";

function PerfumeCard({
  perfume,
  assetResolver,
  tierData,
  onAddToBox,
  onOpenDetails,
  isDisabled,
  labels = {},
}) {
  const imageFallback = perfume.imageFallback;
  const brandAssetKey = brandAssets[perfume.brand] || "";
  const brandAsset = brandAssetKey ? assetResolver(brandAssetKey) : "";
  const addLabel = labels.add || "Add";
  const addToBoxLabel = labels.addToBox || "Add to box";
  const viewDetailsLabel = labels.viewDetails || "View notes & details";

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
              <div className="perfume-brand-row">
                <p className="perfume-brand-name">{perfume.brand}</p>
                {brandAsset && (
                  <span className="perfume-card-brand-logo" aria-hidden="true">
                    <img
                      src={brandAsset}
                      alt=""
                      loading="lazy"
                      onError={(event) => {
                        event.currentTarget.closest(".perfume-card-brand-logo")?.remove();
                      }}
                    />
                  </span>
                )}
              </div>

            </div>
          </div>
        </div>
      </button>

      <button
        type="button"
        className="perfume-card-info-icon"
        data-tooltip={viewDetailsLabel}
        aria-label={viewDetailsLabel}
        onClick={() => onOpenDetails(perfume)}
      >
        i
      </button>

      <div className="perfume-card-compact-actions">
        <div
          className="perfume-card-points"
          style={{
            borderColor: tierData.color,
            backgroundColor: tierData.background,
            color: tierData.color,
          }}
          aria-label={`${perfume.points} pt`}
        >
          <span aria-hidden="true">{tierData.emoji}</span>
          <span>{perfume.points} pt</span>
        </div>

        <button onClick={() => onAddToBox(perfume)} disabled={isDisabled}>
          <span className="perfume-card-add-label-full">{addToBoxLabel}</span>
          <span className="perfume-card-add-label-short">{addLabel}</span>
        </button>
      </div>
    </article>
  );
}

export default PerfumeCard;
