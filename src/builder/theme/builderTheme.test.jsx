import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { DiscoveryBoxBuilder } from "../index.js";
import { createBuilderConfig } from "../config/createBuilderConfig.js";
import { validateBuilderConfig } from "../config/validateBuilderConfig.js";
import { aurelianConfig } from "../../merchants/aurelian/config.js";
import { discoveryDecantsConfig } from "../../merchants/discoveryDecants/config.js";
import {
  BUILDER_THEME_COLOR_KEYS,
  DEFAULT_BUILDER_THEME_COLORS,
  buildBuilderThemeStyle,
} from "./builderTheme.js";

const syntheticThemeA = {
  colors: {
    background: "#101010",
    accent: "#ff00ff",
    accentContrast: "#000001",
  },
};

const syntheticThemeB = {
  colors: {
    background: "#202020",
    accent: "#00ffff",
  },
};

function withTheme(theme) {
  return createBuilderConfig({
    ...discoveryDecantsConfig,
    theme,
  });
}

describe("Builder theme contract", () => {
  it("resolves Discovery-compatible defaults to the current production literals", () => {
    expect(discoveryDecantsConfig.theme.colors).toEqual({
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
    expect(discoveryDecantsConfig.theme.colors).toEqual(DEFAULT_BUILDER_THEME_COLORS);
  });

  it("merges partial theme overrides while retaining every default", () => {
    const config = withTheme(syntheticThemeA);

    expect(config.theme.colors).toEqual({
      ...DEFAULT_BUILDER_THEME_COLORS,
      ...syntheticThemeA.colors,
    });
  });

  it.each([
    ["non-object theme", { theme: "dark" }, /Invalid builder config at theme/],
    ["non-object colors", { theme: { colors: [] } }, /Invalid builder config at theme.colors/],
    ["non-string color", { theme: { colors: { accent: 42 } } }, /theme.colors.accent/],
  ])("rejects %s", (_label, override, error) => {
    expect(() => createBuilderConfig({ ...discoveryDecantsConfig, ...override })).toThrow(error);
  });

  it("rejects unknown theme and color keys", () => {
    expect(() =>
      createBuilderConfig({
        ...discoveryDecantsConfig,
        theme: { layout: {}, colors: {} },
      })
    ).toThrow(/Invalid builder config at theme: contains unsupported keys: layout/);
    expect(() =>
      createBuilderConfig({
        ...discoveryDecantsConfig,
        theme: { colors: { accentGlow: "#abcdef" } },
      })
    ).toThrow(/Invalid builder config at theme.colors: contains unsupported keys: accentGlow/);
  });

  it("maps only allowlisted theme colors to known CSS custom properties", () => {
    const config = withTheme(syntheticThemeA);
    const style = buildBuilderThemeStyle(config.theme);

    expect(Object.keys(style)).toHaveLength(BUILDER_THEME_COLOR_KEYS.length);
    expect(style).toMatchObject({
      "--builder-color-background": "#101010",
      "--builder-color-accent": "#ff00ff",
      "--builder-color-accent-contrast": "#000001",
      "--builder-color-surface": DEFAULT_BUILDER_THEME_COLORS.surface,
    });
    expect(style).not.toHaveProperty("accentGlow");
  });

  it("scopes different synthetic themes to separate Builder root elements", () => {
    const markup = renderToStaticMarkup(
      <div>
        <DiscoveryBoxBuilder catalog={[]} notes={{}} config={withTheme(syntheticThemeA)} />
        <DiscoveryBoxBuilder catalog={[]} notes={{}} config={withTheme(syntheticThemeB)} />
      </div>
    );

    expect(markup.match(/class="builder-theme-root"/g)).toHaveLength(2);
    expect(markup).toContain("--builder-color-background:#101010");
    expect(markup).toContain("--builder-color-accent:#ff00ff");
    expect(markup).toContain("--builder-color-background:#202020");
    expect(markup).toContain("--builder-color-accent:#00ffff");
  });

  it("does not mutate document root or body styles while producing instance styles", () => {
    const documentRootStyle = { color: "root-owned" };
    const bodyStyle = { background: "host-owned" };
    const beforeRoot = { ...documentRootStyle };
    const beforeBody = { ...bodyStyle };

    buildBuilderThemeStyle(withTheme(syntheticThemeA).theme);

    expect(documentRootStyle).toEqual(beforeRoot);
    expect(bodyStyle).toEqual(beforeBody);
  });

  it("keeps both merchant configs valid and preserves Aurelian locale and box rules", () => {
    expect(validateBuilderConfig(discoveryDecantsConfig)).toBe(discoveryDecantsConfig);
    expect(validateBuilderConfig(aurelianConfig)).toBe(aurelianConfig);
    expect(aurelianConfig.locale).toBe("es-MX");
    expect(aurelianConfig.box).toMatchObject({
      minSelectableSlots: 6,
      maxSelectableSlots: 14,
    });
  });
});
