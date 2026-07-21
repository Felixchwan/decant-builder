import { getTierData } from "../utils/tierUtils";
import { forwardRef } from "react";

const DEFAULT_PROFILE_TRAITS = [];
const DEFAULT_DNA_DESCRIPTORS = [];
const DEFAULT_PERFUMES = [];

const CollectionCard = forwardRef(function CollectionCard({
  heading = "",
  title,
  subtitle,
  mood = DEFAULT_PROFILE_TRAITS,
  palette,
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

function getCollectionLightingComposition({
  perfumes = [],
  palette,
  collectionIdentity = "",
  curatorSubtitle = "",
  profileTraits = [],
  dnaDescriptors = [],
}) {
  const theme = getCollectionCardAmbientTheme(palette, [
    collectionIdentity,
    curatorSubtitle,
    ...profileTraits,
    ...dnaDescriptors,
  ]);
  const compositionBias = getBoxVisualCompositionBias(perfumes, theme.key);
  const finalOriginX = clampNumber(theme.x + compositionBias, 24, 78);

  return {
    theme,
    baseOriginX: theme.x,
    compositionBias,
    finalOriginX,
    originY: theme.y,
  };
}

function getCollectionCardAmbientTheme(palette, values = []) {
  const paletteTheme = getCollectionCardAmbientThemeByKey(palette);

  if (paletteTheme) {
    return paletteTheme;
  }

  const text = values.join(" ").toLowerCase();

  if (/\b(fresh|summer|citrus|aquatic|marine|blue|clean|daily)\b/.test(text)) {
    return {
      ...getCollectionCardAmbientThemeByKey("fresh"),
    };
  }

  if (/\b(green|nature|aromatic|herbal|forest|spring)\b/.test(text)) {
    return {
      ...getCollectionCardAmbientThemeByKey("green"),
    };
  }

  if (/\b(dark|signature|mythic|mystery|smoky|leather|oud|night)\b/.test(text)) {
    return {
      ...getCollectionCardAmbientThemeByKey("signature"),
    };
  }

  if (/\b(evening|warm|amber|bronze|vanilla|sweet|spicy|tobacco|fall|winter)\b/.test(text)) {
    return {
      ...getCollectionCardAmbientThemeByKey("warm"),
    };
  }

  return getCollectionCardAmbientThemeByKey("balanced");
}

function getCollectionCardAmbientThemeByKey(key) {
  if (key === "fresh") {
    return {
      key: "fresh",
      ambient: "rgba(76, 175, 209, 0.15)",
      ambientSoft: "rgba(125, 211, 252, 0.07)",
      titleGlow: "rgba(125, 211, 252, 0.18)",
      moodAccent: "rgba(161, 199, 211, 0.82)",
      x: 28,
      y: "3%",
    };
  }

  if (key === "green") {
    return {
      key: "green",
      ambient: "rgba(74, 163, 107, 0.14)",
      ambientSoft: "rgba(134, 239, 172, 0.065)",
      titleGlow: "rgba(134, 239, 172, 0.16)",
      moodAccent: "rgba(151, 190, 162, 0.82)",
      x: 38,
      y: "3%",
    };
  }

  if (key === "signature") {
    return {
      key: "dark",
      ambient: "rgba(125, 101, 168, 0.13)",
      ambientSoft: "rgba(196, 181, 253, 0.055)",
      titleGlow: "rgba(196, 181, 253, 0.16)",
      moodAccent: "rgba(190, 178, 207, 0.78)",
      x: 65,
      y: "0%",
    };
  }

  if (key === "warm") {
    return {
      key: "warm",
      ambient: "rgba(184, 115, 51, 0.15)",
      ambientSoft: "rgba(250, 204, 21, 0.06)",
      titleGlow: "rgba(250, 204, 21, 0.17)",
      moodAccent: "rgba(218, 190, 132, 0.82)",
      x: 72,
      y: "3%",
    };
  }

  if (key === "office") {
    return {
      key: "balanced",
      ambient: "rgba(205, 181, 133, 0.13)",
      ambientSoft: "rgba(245, 222, 179, 0.055)",
      titleGlow: "rgba(245, 222, 179, 0.15)",
      moodAccent: "rgba(207, 193, 161, 0.82)",
      x: 55,
      y: "3%",
    };
  }

  if (key === "balanced" || !key) {
    return {
      key: "balanced",
      ambient: "rgba(207, 171, 92, 0.13)",
      ambientSoft: "rgba(250, 204, 21, 0.055)",
      titleGlow: "rgba(250, 204, 21, 0.15)",
      moodAccent: "rgba(207, 193, 161, 0.82)",
      x: 55,
      y: "3%",
    };
  }

  return {
    key: "balanced",
    ambient: "rgba(207, 171, 92, 0.13)",
    ambientSoft: "rgba(250, 204, 21, 0.055)",
    titleGlow: "rgba(250, 204, 21, 0.15)",
    moodAccent: "rgba(207, 193, 161, 0.82)",
    x: 55,
    y: "3%",
  };
}

function getBoxVisualCompositionBias(perfumes = [], themeKey = "balanced") {
  const sideWeights = perfumes.reduce(
    (weights, perfume, index) => {
      if (!perfume) {
        return weights;
      }

      const side = index % 2 === 0 ? "left" : "right";
      const visualWeight = getPerfumeAtmosphericWeight(perfume, themeKey);

      weights[side] += visualWeight;
      return weights;
    },
    { left: 0, right: 0 }
  );
  const totalWeight = sideWeights.left + sideWeights.right;

  if (totalWeight <= 0) {
    return 0;
  }

  const sideBalance = (sideWeights.right - sideWeights.left) / totalWeight;
  const themeSensitivity = themeKey === "balanced" ? 6 : 8;

  return Math.round(sideBalance * themeSensitivity * 10) / 10;
}

function getPerfumeAtmosphericWeight(perfume, themeKey) {
  const metadata = [
    ...(perfume.accords || []),
    ...(perfume.vibes || []),
    ...(perfume.occasions || []),
    ...(perfume.seasons || []),
    perfume.tier || "",
  ]
    .join(" ")
    .toLowerCase();
  const warmWeight = countMatches(metadata, /\b(warm|amber|vanilla|spicy|sweet|dark|smoky|leather|oud|tobacco|evening|night|fall|winter)\b/g);
  const freshWeight = countMatches(metadata, /\b(fresh|citrus|aquatic|marine|green|clean|summer|spring|daily|daytime|office)\b/g);
  const tierWeight = getTierAtmosphericWeight(perfume.id);
  const themeWeight = {
    warm: warmWeight,
    dark: warmWeight,
    fresh: freshWeight,
    green: freshWeight,
    balanced: Math.max(warmWeight, freshWeight),
  }[themeKey] || Math.max(warmWeight, freshWeight);

  return 1 + Math.min(themeWeight, 5) * 0.26 + tierWeight;
}

function getTierAtmosphericWeight(id) {
  if (id >= 500) return 0.24;
  if (id >= 400) return 0.18;
  if (id >= 300) return 0.14;
  if (id >= 200) return 0.10;
  if (id >= 100) return 0.06;
  return 0.04;
}

function countMatches(value, pattern) {
  return value.match(pattern)?.length || 0;
}

function clampNumber(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export default CollectionCard;
