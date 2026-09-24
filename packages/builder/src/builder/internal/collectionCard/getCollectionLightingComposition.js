import { DEFAULT_BUILDER_THEME_COLORS } from "../../theme/builderTheme.js";

export function getCollectionLightingComposition({
  perfumes = [],
  palette,
  collectionIdentity = "",
  curatorSubtitle = "",
  profileTraits = [],
  dnaDescriptors = [],
  themeAccent = DEFAULT_BUILDER_THEME_COLORS.accent,
  themeAccentStrong = DEFAULT_BUILDER_THEME_COLORS.accentStrong,
}) {
  const theme = getCollectionCardAmbientTheme(
    palette,
    [collectionIdentity, curatorSubtitle, ...profileTraits, ...dnaDescriptors],
    themeAccent,
    themeAccentStrong
  );
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

function getCollectionCardAmbientTheme(palette, values = [], themeAccent, themeAccentStrong) {
  const paletteTheme = getCollectionCardAmbientThemeByKey(palette, themeAccent, themeAccentStrong);

  if (paletteTheme) {
    return paletteTheme;
  }

  const text = values.join(" ").toLowerCase();

  if (/\b(fresh|summer|citrus|aquatic|marine|blue|clean|daily)\b/.test(text)) {
    return {
      ...getCollectionCardAmbientThemeByKey("fresh", themeAccent, themeAccentStrong),
    };
  }

  if (/\b(green|nature|aromatic|herbal|forest|spring)\b/.test(text)) {
    return {
      ...getCollectionCardAmbientThemeByKey("green", themeAccent, themeAccentStrong),
    };
  }

  if (/\b(dark|signature|mythic|mystery|smoky|leather|oud|night)\b/.test(text)) {
    return {
      ...getCollectionCardAmbientThemeByKey("signature", themeAccent, themeAccentStrong),
    };
  }

  if (/\b(evening|warm|amber|bronze|vanilla|sweet|spicy|tobacco|fall|winter)\b/.test(text)) {
    return {
      ...getCollectionCardAmbientThemeByKey("warm", themeAccent, themeAccentStrong),
    };
  }

  return getCollectionCardAmbientThemeByKey("balanced", themeAccent, themeAccentStrong);
}

// Each mood keeps its own composition (how strongly it leans toward the
// theme's accentStrong vs its base accent, and how intense each glow layer
// is) so moods stay visually distinct -- but every mood's hue now comes from
// the active host theme instead of a mood-specific fixed color (blue/green/
// purple/amber). "signature"/"office" intentionally keep the legacy `key`
// values ("dark"/"balanced") they always returned: getBoxVisualCompositionBias
// branches on `theme.key`, and that composition behavior is unrelated to color
// and must not change here.
const MOOD_COMPOSITIONS = {
  fresh: { key: "fresh", blendToStrong: 0, ambientAlpha: 0.12, ambientSoftAlpha: 0.06, titleGlowAlpha: 0.14, moodAccentAlpha: 0.78, x: 28, y: "3%" },
  green: { key: "green", blendToStrong: 0.15, ambientAlpha: 0.13, ambientSoftAlpha: 0.065, titleGlowAlpha: 0.15, moodAccentAlpha: 0.80, x: 38, y: "3%" },
  signature: { key: "dark", blendToStrong: 0.85, ambientAlpha: 0.16, ambientSoftAlpha: 0.055, titleGlowAlpha: 0.18, moodAccentAlpha: 0.78, x: 65, y: "0%" },
  warm: { key: "warm", blendToStrong: 0.55, ambientAlpha: 0.15, ambientSoftAlpha: 0.07, titleGlowAlpha: 0.19, moodAccentAlpha: 0.82, x: 72, y: "3%" },
  office: { key: "balanced", blendToStrong: 0.2, ambientAlpha: 0.13, ambientSoftAlpha: 0.055, titleGlowAlpha: 0.14, moodAccentAlpha: 0.80, x: 55, y: "3%" },
  balanced: { key: "balanced", blendToStrong: 0.4, ambientAlpha: 0.13, ambientSoftAlpha: 0.055, titleGlowAlpha: 0.15, moodAccentAlpha: 0.80, x: 55, y: "3%" },
};

export function getCollectionCardAmbientThemeByKey(key, themeAccent, themeAccentStrong) {
  const accent = themeAccent || DEFAULT_BUILDER_THEME_COLORS.accent;
  const accentStrong = themeAccentStrong || DEFAULT_BUILDER_THEME_COLORS.accentStrong;
  // Any unrecognized or falsy key -- same as the previous implementation --
  // falls back to the "balanced" composition, so this always returns a
  // theme object.
  const composition = MOOD_COMPOSITIONS[key] || MOOD_COMPOSITIONS.balanced;
  const hue = mixTowardAccentStrong(accent, accentStrong, composition.blendToStrong);

  return {
    key: composition.key,
    ambient: tintWithAccent(hue, composition.ambientAlpha),
    ambientSoft: tintWithAccent(hue, composition.ambientSoftAlpha),
    titleGlow: tintWithAccent(hue, composition.titleGlowAlpha),
    moodAccent: tintWithAccent(hue, composition.moodAccentAlpha),
    x: composition.x,
    y: composition.y,
  };
}

// Blends the theme's base accent toward its accentStrong variant -- 0 stays
// pure accent, 1 becomes pure accentStrong, anything between mixes the two.
// This is what differentiates moods now that hue itself always comes from
// the theme (a "warm" mood leans further toward accentStrong than "fresh"
// does), rather than each mood picking an unrelated fixed color.
function mixTowardAccentStrong(accent, accentStrong, blendToStrong) {
  if (blendToStrong <= 0) return accent;
  if (blendToStrong >= 1) return accentStrong;
  return `color-mix(in srgb, ${accentStrong} ${formatPercent(blendToStrong * 100)}%, ${accent})`;
}

// Matches the color-mix(in srgb, <color> N%, transparent) convention used
// throughout packages/builder/styles.css for every other theme-derived
// translucent accent treatment.
function tintWithAccent(hue, alpha) {
  return `color-mix(in srgb, ${hue} ${formatPercent(alpha * 100)}%, transparent)`;
}

function formatPercent(value) {
  return Math.round(value * 1000) / 1000;
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
