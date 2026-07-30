export const BUILDER_THEME_COLOR_KEYS = Object.freeze([
  "background",
  "surface",
  "surfaceElevated",
  "text",
  "textSecondary",
  "textMuted",
  "border",
  "accent",
  "accentStrong",
  "accentContrast",
  "disabled",
]);

export const DEFAULT_BUILDER_THEME_COLORS = Object.freeze({
  background: "#07100b",
  surface: "rgba(8, 20, 14, 0.82)",
  surfaceElevated: "rgba(15, 23, 42, 0.72)",
  text: "#ecfdf5",
  textSecondary: "#b6c8bd",
  textMuted: "#94a3b8",
  border: "rgba(148, 163, 184, 0.18)",
  accent: "#4ade80",
  accentStrong: "#22c55e",
  accentContrast: "#052e16",
  disabled: "rgba(148, 163, 184, 0.12)",
});

const THEME_COLOR_VARIABLES = Object.freeze({
  background: "--builder-color-background",
  surface: "--builder-color-surface",
  surfaceElevated: "--builder-color-surface-elevated",
  text: "--builder-color-text",
  textSecondary: "--builder-color-text-secondary",
  textMuted: "--builder-color-text-muted",
  border: "--builder-color-border",
  accent: "--builder-color-accent",
  accentStrong: "--builder-color-accent-strong",
  accentContrast: "--builder-color-accent-contrast",
  disabled: "--builder-color-disabled",
});

export function buildBuilderThemeStyle(theme) {
  return Object.fromEntries(
    BUILDER_THEME_COLOR_KEYS.map((key) => [
      THEME_COLOR_VARIABLES[key],
      theme.colors[key],
    ])
  );
}

export function hasCustomBuilderTheme(theme) {
  return BUILDER_THEME_COLOR_KEYS.some(
    (key) => theme.colors[key] !== DEFAULT_BUILDER_THEME_COLORS[key]
  );
}
