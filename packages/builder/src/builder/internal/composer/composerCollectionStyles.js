export const COMPOSER_COLLECTION_STYLE_IDS = Object.freeze({
  PREMIUM_FOCUS: "premium_focus",
  BALANCED_MIX: "balanced_mix",
  MORE_VARIETY: "more_variety",
});

const COLLECTION_STYLES = Object.freeze([
  Object.freeze({
    id: COMPOSER_COLLECTION_STYLE_IDS.PREMIUM_FOCUS,
    label: "Premium Focus",
  }),
  Object.freeze({
    id: COMPOSER_COLLECTION_STYLE_IDS.BALANCED_MIX,
    label: "Balanced Mix",
  }),
  Object.freeze({
    id: COMPOSER_COLLECTION_STYLE_IDS.MORE_VARIETY,
    label: "More Variety",
  }),
]);

const COLLECTION_STYLE_BY_ID = Object.freeze(
  Object.fromEntries(COLLECTION_STYLES.map((style) => [style.id, style]))
);

export const DEFAULT_COMPOSER_COLLECTION_STYLE_ID =
  COMPOSER_COLLECTION_STYLE_IDS.BALANCED_MIX;
export const COMPOSER_COLLECTION_STYLES = COLLECTION_STYLES;

export function getComposerCollectionStyle(styleId) {
  return (
    COLLECTION_STYLE_BY_ID[styleId] ||
    COLLECTION_STYLE_BY_ID[DEFAULT_COMPOSER_COLLECTION_STYLE_ID]
  );
}
