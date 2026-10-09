import { brandAssets } from "@discovery-box/catalog";

function PerfumeCard({
  perfume,
  assetResolver,
  tierData,
  reason,
  onAddToBox,
  onOpenDetails,
  isDisabled,
  // Opt-in presentation state (see DiscoveryBoxBuilder's showAddedState): true only for a
  // card whose fragrance is already in the box AND whose host asked to see that. Absent/false
  // renders the card exactly as it always has -- same label, same markup, no extra class.
  isInBox = false,
  labels = {},
}) {
  const imageFallback = perfume.imageFallback;
  const brandAssetKey = brandAssets[perfume.brand] || "";
  const brandAsset = brandAssetKey ? assetResolver(brandAssetKey) : "";
  const addLabel = labels.add || "Add";
  const addToBoxLabel = labels.addToBox || "Add to box";
  const addedLabel = labels.added || "Added";
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
          {brandAsset && (
            <span className="perfume-card-brand-badge" aria-hidden="true">
              <img
                src={brandAsset}
                alt=""
                loading="lazy"
                onError={(event) => {
                  event.currentTarget.closest(".perfume-card-brand-badge")?.remove();
                }}
              />
            </span>
          )}
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
                  style={perfume.subtitleColor ? { color: perfume.subtitleColor } : undefined}
                >
                  {perfume.subtitle}
                </p>
              )}
              <p className="perfume-brand-name">{perfume.brand}</p>

              {reason && <p className="perfume-card-reason">{reason}</p>}
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

        <button
          className={isInBox ? "perfume-card-add-button is-added" : undefined}
          onClick={() => onAddToBox(perfume)}
          disabled={isDisabled}
        >
          <span className="perfume-card-add-label-full">{isInBox ? addedLabel : addToBoxLabel}</span>
          <span className="perfume-card-add-label-short">{isInBox ? addedLabel : addLabel}</span>
        </button>
      </div>
    </article>
  );
}

export default PerfumeCard;
