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

const approvedAurelianColors = {
  background: "#090A09",
  surface: "rgba(17, 17, 15, 0.94)",
  surfaceElevated: "rgba(27, 25, 21, 0.96)",
  text: "#F2EBDD",
  textSecondary: "#C8BEAD",
  textMuted: "#938B7D",
  border: "rgba(200, 166, 101, 0.22)",
  accent: "#C8A665",
  accentStrong: "#9F7D43",
  accentContrast: "#171108",
  disabled: "rgba(147, 139, 125, 0.16)",
};
const assetResolver = (assetKey) => `/images/${assetKey}`;

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
        <DiscoveryBoxBuilder catalog={[]} notes={{}} config={withTheme(syntheticThemeA)} assetResolver={assetResolver} />
        <DiscoveryBoxBuilder catalog={[]} notes={{}} config={withTheme(syntheticThemeB)} assetResolver={assetResolver} />
      </div>
    );

    expect(markup.match(/class="builder-theme-root builder-theme-root--custom"/g)).toHaveLength(2);
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
    expect(aurelianConfig.finalization.mode).toBe("unavailable");
    expect(aurelianConfig.finalization.whatsappNumber).toBe("");
    expect(aurelianConfig.features.whatsappFinalization).toBe(false);
  });

  it("declares the exact approved Aurelian production palette", () => {
    expect(aurelianConfig.theme.colors).toEqual(approvedAurelianColors);
  });

  it("renders every approved Aurelian variable on its independently scoped root", () => {
    const markup = renderToStaticMarkup(
      <div>
        <DiscoveryBoxBuilder catalog={[]} notes={{}} config={discoveryDecantsConfig} assetResolver={assetResolver} />
        <DiscoveryBoxBuilder catalog={[]} notes={{}} config={aurelianConfig} assetResolver={assetResolver} />
      </div>
    );

    expect(markup.match(/class="builder-theme-root"/g)).toHaveLength(1);
    expect(markup.match(/class="builder-theme-root builder-theme-root--custom"/g)).toHaveLength(1);
    Object.entries(approvedAurelianColors).forEach(([key, value]) => {
      const cssName = key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
      expect(markup).toContain(`--builder-color-${cssName}:${value}`);
    });
    expect(markup).toContain("--builder-color-background:#07100b");
    expect(markup).toContain("--builder-color-accent:#4ade80");
  });
});
