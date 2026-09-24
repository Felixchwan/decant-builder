import { getTierData } from "../utils/tierUtils";
import { forwardRef } from "react";
import { DEFAULT_BUILDER_THEME_COLORS } from "../builder/theme/builderTheme.js";
import { getCollectionLightingComposition } from "../builder/internal/collectionCard/getCollectionLightingComposition.js";

const DEFAULT_PROFILE_TRAITS = [];
const DEFAULT_DNA_DESCRIPTORS = [];
const DEFAULT_PERFUMES = [];

const CollectionCard = forwardRef(function CollectionCard({
  heading = "",
  title,
  subtitle,
  mood = DEFAULT_PROFILE_TRAITS,
  palette,
  themeAccent = DEFAULT_BUILDER_THEME_COLORS.accent,
  themeAccentStrong = DEFAULT_BUILDER_THEME_COLORS.accentStrong,
  exportMode = false,
  collectionIdentity = "Collection In Progress",
  curatorSubtitle = "Curated fragrance character",
  perfumes = DEFAULT_PERFUMES,
  fragranceCount = perfumes.length,
  collectionPoints = 0,
  profileTraits = DEFAULT_PROFILE_TRAITS,
  dnaDescriptors = DEFAULT_DNA_DESCRIPTORS,
  isCuratorBonusUnlocked = false,
  maxSlots = 16,
  maxSelectableSlots = 14,
  ariaLabel = "collection card",
  boxAriaLabel = "Rendered Discovery Box",
  footer = "Curated for discovery.",
  curatorBonusIncludedLabel = "Curator Bonus Included",
  curatorBonusAvailableLabel = "Curator Bonus Available",
  curatorBonusUnlockedCopy = "Mystery selections remain wrapped.",
  curatorBonusLockedCopy = "Complete your Discovery Box to unlock mystery selections.",
}, ref) {
  const displayTitle = title || collectionIdentity;
  const displaySubtitle = subtitle || curatorSubtitle;
  const visibleMood = mood.filter(Boolean).slice(0, 3);
  const visibleProfileTraits = profileTraits.filter(Boolean).slice(0, 3);
  const visibleDnaDescriptors = dnaDescriptors.filter(Boolean).slice(0, 3);
  const slotRows = buildCollectionCardRows(maxSlots);
  const lightingComposition = getCollectionLightingComposition({
    perfumes,
    palette,
    collectionIdentity: displayTitle,
    curatorSubtitle: displaySubtitle,
    profileTraits: visibleProfileTraits,
    dnaDescriptors: visibleDnaDescriptors,
    themeAccent,
    themeAccentStrong,
  });

  return (
    <article
      ref={ref}
      className={`collection-card ${exportMode ? "collection-card--export" : ""}`}
      aria-label={ariaLabel}
      style={{
        "--collection-card-ambient": lightingComposition.theme.ambient,
        "--collection-card-ambient-soft": lightingComposition.theme.ambientSoft,
        "--collection-card-title-glow": lightingComposition.theme.titleGlow,
        "--collection-card-mood-accent": lightingComposition.theme.moodAccent,
        "--collection-card-ambient-x": `${lightingComposition.finalOriginX}%`,
        "--collection-card-ambient-y": lightingComposition.originY,
      }}
    >
      <div className="collection-card-topline">{heading}</div>

      <header className="collection-card-header">
        <h2>{displayTitle}</h2>
        <p>{displaySubtitle}</p>
      </header>

      {visibleMood.length === 3 && (
        <div className="collection-card-mood" aria-label="Collection mood">
          <span>MOOD</span>
          <p>
            {visibleMood.map((descriptor, index) => (
              <span className="collection-card-mood-item" key={descriptor}>
                {index > 0 && (
                  <span className="collection-card-mood-separator" aria-hidden="true">
                    ◆
                  </span>
                )}
                {descriptor}
              </span>
            ))}
          </p>
        </div>
      )}

      <div className="collection-card-box-wrap" aria-label={boxAriaLabel}>
        <div className="collection-card-box">
          <div className="collection-card-column">
            {slotRows.map(({ leftIndex }) => (
              <CollectionCardVial
                key={`collection-left-${leftIndex}`}
                index={leftIndex}
                perfume={perfumes[leftIndex]}
                isReserved={leftIndex >= maxSelectableSlots}
                isCuratorBonusUnlocked={isCuratorBonusUnlocked}
              />
            ))}
          </div>

          <div className="collection-card-center-channel" aria-hidden="true" />

          <div className="collection-card-column">
            {slotRows.map(({ rightIndex }) =>
              rightIndex < maxSlots ? (
                <CollectionCardVial
                  key={`collection-right-${rightIndex}`}
                  index={rightIndex}
                  perfume={perfumes[rightIndex]}
                  isReserved={rightIndex >= maxSelectableSlots}
                  isCuratorBonusUnlocked={isCuratorBonusUnlocked}
                />
              ) : null
            )}
          </div>
        </div>
      </div>

      <div className="collection-card-summary" aria-label="Collection summary">
        <div>
          <strong>{fragranceCount}</strong>
          <span>{fragranceCount === 1 ? "Fragrance" : "Fragrances"}</span>
        </div>

        <div>
          <strong>{Number(collectionPoints).toFixed(1)}</strong>
          <span>Collection Points</span>
        </div>
      </div>

      <CollectionCardSection title="Collection Profile">
        {visibleProfileTraits.length > 0 ? (
          <div className="collection-card-chip-row">
            {visibleProfileTraits.map((trait) => (
              <span key={trait}>{trait}</span>
            ))}
          </div>
        ) : (
          <p>Profile develops as the box is curated.</p>
        )}
      </CollectionCardSection>

      <CollectionCardSection title="Collection DNA">
        {visibleDnaDescriptors.length > 0 ? (
          <div className="collection-card-dna-row">
            {visibleDnaDescriptors.map((descriptor) => (
              <span key={descriptor}>{descriptor}</span>
            ))}
          </div>
        ) : (
          <p>Scent identity develops as the box is curated.</p>
        )}
      </CollectionCardSection>

      <section className="collection-card-curator">
        <span>
          {isCuratorBonusUnlocked ? curatorBonusIncludedLabel : curatorBonusAvailableLabel}
        </span>
        <p>
          {isCuratorBonusUnlocked
            ? curatorBonusUnlockedCopy
            : curatorBonusLockedCopy}
        </p>
      </section>

      <footer>{footer}</footer>
    </article>
  );
});

function CollectionCardSection({ title, children }) {
  return (
    <section className="collection-card-section">
      <span>{title}</span>
      {children}
    </section>
  );
}

function CollectionCardVial({ perfume, isReserved, isCuratorBonusUnlocked }) {
  if (isReserved) {
    return (
      <span
        className={`collection-card-vial collection-card-vial-bonus ${
          isCuratorBonusUnlocked ? "is-unlocked" : "is-locked"
        }`}
        aria-label="Curator Bonus slot"
      >
        <span className="collection-card-vial-cap" />
        <span className="collection-card-vial-body">
          <span className="collection-card-bonus-mark" />
        </span>
      </span>
    );
  }

  if (!perfume) {
    return (
      <span className="collection-card-vial is-empty" aria-label="Empty collection slot">
        <span className="collection-card-vial-cap" />
        <span className="collection-card-vial-body" />
      </span>
    );
  }

  const tierData = getTierData(perfume.id);
  const label = perfume.shortName || getShortPerfumeName(perfume.name);

  return (
    <span
      className="collection-card-vial is-filled"
      title={perfume.name}
      style={{
        "--collection-tier-color": tierData.color,
        "--collection-glass-mid": tierData.glassTintMid,
        "--collection-glass-edge": tierData.glassTintEdge,
      }}
    >
      <span className="collection-card-vial-cap" />
      <span className="collection-card-vial-body">
        {perfume.image && (
          <img
            className="collection-card-vial-image"
            src={perfume.image}
            alt=""
          />
        )}
        <span className="collection-card-vial-label">{label}</span>
      </span>
    </span>
  );
}

function buildCollectionCardRows(maxSlots) {
  const rowCount = Math.ceil(maxSlots / 2);

  return Array.from({ length: rowCount }, (_, rowIndex) => ({
    leftIndex: rowIndex * 2,
    rightIndex: rowIndex * 2 + 1,
  }));
}

function getShortPerfumeName(name = "") {
  const cleanName = name.replace(/\s*\([^)]*\)\s*/g, " ").trim();
  const words = cleanName.split(/\s+/).filter(Boolean);

  if (words.length <= 2) {
    return cleanName;
  }

  return words.slice(0, 2).join(" ");
}

export default CollectionCard;
