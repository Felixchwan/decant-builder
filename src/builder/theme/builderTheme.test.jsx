import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { DiscoveryBoxBuilder } from "../index.js";
import { createBuilderConfig } from "../config/createBuilderConfig.js";
import { validateBuilderConfig } from "../config/validateBuilderConfig.js";
import { aurelianConfig } from "../../merchants/aurelian/config.js";
import { discoveryDecantsConfig } from "../../merchants/discoveryDecants/config.js";
import {
  BUILDER_THEME_COLOR_KEYS,
  BUILDER_THEME_STYLE_PROPERTIES,
  DEFAULT_BUILDER_THEME_COLORS,
  buildBuilderThemeStyle,
  hasCustomBuilderTheme,
} from "./builderTheme.js";
import { acquireBodyScrollLock } from "../internal/portal/bodyScrollLock.js";
import {
  applyBuilderPortalTheme,
  createBuilderPortalRoot,
  removeBuilderPortalRoot,
} from "../internal/portal/useBuilderPortalRoot.js";
import { renderOwnedPortal } from "../internal/portal/renderOwnedPortal.jsx";
import {
  createCollectionCardExportStage,
  removeCollectionCardExportStage,
} from "../internal/portal/collectionCardExportStage.js";

const sourceRoot = fileURLToPath(new URL("../..", import.meta.url));
const builderPanelSource = readFileSync(
  new URL("../../components/BuilderPanel.jsx", import.meta.url),
  "utf8",
);
const metadataPreviewSource = readFileSync(
  new URL("../../components/MetadataPreview.jsx", import.meta.url),
  "utf8",
);
const appSource = readFileSync(new URL("../../App.jsx", import.meta.url), "utf8");
const portalRootSource = readFileSync(
  new URL("../internal/portal/useBuilderPortalRoot.js", import.meta.url),
  "utf8",
);
const ownedPortalSource = readFileSync(
  new URL("../internal/portal/renderOwnedPortal.jsx", import.meta.url),
  "utf8",
);
const exportStageSource = readFileSync(
  new URL("../internal/portal/collectionCardExportStage.js", import.meta.url),
  "utf8",
);
const builderCss = readFileSync(new URL("../styles.css", import.meta.url), "utf8");

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

function productionSources(directory) {
  return readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);
    if (statSync(path).isDirectory()) return productionSources(path);
    if (!/\.[cm]?[jt]sx?$/.test(entry) || /\.test\.[cm]?[jt]sx?$/.test(entry)) return [];
    return [[path, readFileSync(path, "utf8")]];
  });
}

function createPortalStyle() {
  const values = new Map();
  return {
    getPropertyValue: (property) => values.get(property) || "",
    removeProperty: (property) => values.delete(property),
    setProperty: (property, value) => values.set(property, value),
  };
}

function createPortalDocument() {
  const body = {
    children: [],
    appendChild(node) {
      this.children.push(node);
      node.parentNode = this;
      node.isConnected = true;
    },
    removeChild(node) {
      this.children = this.children.filter((child) => child !== node);
      node.parentNode = null;
      node.isConnected = false;
    },
  };

  return {
    body,
    createElement() {
      const attributes = new Map();
      return {
        children: [],
        className: "",
        isConnected: false,
        parentNode: null,
        ownerDocument: this,
        style: createPortalStyle(),
        appendChild(node) {
          this.children.push(node);
          node.parentNode = this;
          node.isConnected = this.isConnected;
        },
        removeChild(node) {
          this.children = this.children.filter((child) => child !== node);
          node.parentNode = null;
          node.isConnected = false;
        },
        getAttribute: (name) => attributes.get(name) || null,
        setAttribute: (name, value) => attributes.set(name, value),
      };
    },
  };
}

function createPortalRootForTheme(documentLike, instanceId, theme) {
  return createBuilderPortalRoot({
    documentLike,
    instanceId,
    themeStyle: buildBuilderThemeStyle(theme),
    isCustomTheme: hasCustomBuilderTheme(theme),
  });
}

function createLockDocument(initialOverflow = "") {
  return { body: { style: { overflow: initialOverflow } } };
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

describe("Builder portal root lifecycle", () => {
  it("is safe without a browser document", () => {
    expect(
      createBuilderPortalRoot({
        documentLike: undefined,
        instanceId: "server",
        themeStyle: {},
        isCustomTheme: false,
      }),
    ).toBeNull();
  });

  it("creates distinct per-instance roots with Discovery and Aurelian themes", () => {
    const documentLike = createPortalDocument();
    const discoveryRoot = createPortalRootForTheme(
      documentLike,
      "discovery-instance",
      discoveryDecantsConfig.theme,
    );
    const aurelianRoot = createPortalRootForTheme(
      documentLike,
      "aurelian-instance",
      aurelianConfig.theme,
    );

    expect(documentLike.body.children).toEqual([discoveryRoot, aurelianRoot]);
    expect(discoveryRoot.getAttribute("data-builder-portal-instance")).toBe("discovery-instance");
    expect(aurelianRoot.getAttribute("data-builder-portal-instance")).toBe("aurelian-instance");
    expect(discoveryRoot.className).toBe("builder-portal-root");
    expect(aurelianRoot.className).toBe("builder-portal-root builder-theme-root--custom");
    expect(discoveryRoot.style.getPropertyValue("--builder-color-accent")).toBe("#4ade80");
    expect(aurelianRoot.style.getPropertyValue("--builder-color-background")).toBe("#090A09");
    expect(aurelianRoot.style.getPropertyValue("--builder-color-accent")).toBe("#C8A665");
  });

  it("updates themes independently and removes only the owning root", () => {
    const documentLike = createPortalDocument();
    const firstRoot = createPortalRootForTheme(documentLike, "first", aurelianConfig.theme);
    const secondRoot = createPortalRootForTheme(
      documentLike,
      "second",
      discoveryDecantsConfig.theme,
    );
    const secondAccent = secondRoot.style.getPropertyValue("--builder-color-accent");

    applyBuilderPortalTheme(
      firstRoot,
      {
        ...buildBuilderThemeStyle(aurelianConfig.theme),
        "--builder-color-accent": "#123456",
      },
      true,
    );

    expect(firstRoot.style.getPropertyValue("--builder-color-accent")).toBe("#123456");
    expect(secondRoot.style.getPropertyValue("--builder-color-accent")).toBe(secondAccent);
    removeBuilderPortalRoot(firstRoot);
    expect(documentLike.body.children).toEqual([secondRoot]);
    expect(secondRoot.isConnected).toBe(true);
    expect(
      BUILDER_THEME_STYLE_PROPERTIES.every(
        (property) => firstRoot.style.getPropertyValue(property) === "",
      ),
    ).toBe(true);
    removeBuilderPortalRoot(firstRoot);
    expect(documentLike.body.children).toEqual([secondRoot]);
  });

  it("removes stale custom-theme state when switching to defaults", () => {
    const documentLike = createPortalDocument();
    const portalRoot = createPortalRootForTheme(documentLike, "theme-switch", aurelianConfig.theme);

    applyBuilderPortalTheme(
      portalRoot,
      buildBuilderThemeStyle(discoveryDecantsConfig.theme),
      false,
    );

    expect(portalRoot.className).toBe("builder-portal-root");
    expect(portalRoot.style.getPropertyValue("--builder-color-background")).toBe("#07100b");
    expect(portalRoot.style.getPropertyValue("--builder-color-accent")).toBe("#4ade80");
  });

  it("synchronizes the complete variable map across default and custom transitions", () => {
    const documentLike = createPortalDocument();
    const defaultStyle = buildBuilderThemeStyle(discoveryDecantsConfig.theme);
    const customAStyle = buildBuilderThemeStyle(aurelianConfig.theme);
    const customBStyle = {
      ...customAStyle,
      "--builder-color-background": "#202020",
      "--builder-color-accent": "#00ffff",
    };
    const portalRoot = createPortalRootForTheme(
      documentLike,
      "complete-theme-map",
      discoveryDecantsConfig.theme,
    );
    const readPortalStyle = () =>
      Object.fromEntries(
        BUILDER_THEME_STYLE_PROPERTIES.map((property) => [
          property,
          portalRoot.style.getPropertyValue(property),
        ]),
      );

    expect(readPortalStyle()).toEqual(defaultStyle);
    applyBuilderPortalTheme(portalRoot, customAStyle, true);
    expect(readPortalStyle()).toEqual(customAStyle);
    expect(portalRoot.className).toContain("builder-theme-root--custom");
    applyBuilderPortalTheme(portalRoot, customBStyle, true);
    expect(readPortalStyle()).toEqual(customBStyle);
    applyBuilderPortalTheme(portalRoot, defaultStyle, false);
    expect(readPortalStyle()).toEqual(defaultStyle);
    expect(portalRoot.className).toBe("builder-portal-root");

    removeBuilderPortalRoot(portalRoot);
    expect(
      BUILDER_THEME_STYLE_PROPERTIES.every(
        (property) => portalRoot.style.getPropertyValue(property) === "",
      ),
    ).toBe(true);
  });
});

describe("coordinated body scroll locking", () => {
  it("restores the exact prior value after overlapping locks release", () => {
    const documentLike = createLockDocument("clip");
    const releaseFirst = acquireBodyScrollLock(documentLike);
    const releaseSecond = acquireBodyScrollLock(documentLike);
    expect(documentLike.body.style.overflow).toBe("hidden");
    releaseFirst();
    expect(documentLike.body.style.overflow).toBe("hidden");
    releaseFirst();
    expect(documentLike.body.style.overflow).toBe("hidden");
    releaseSecond();
    expect(documentLike.body.style.overflow).toBe("clip");
  });

  it("supports reverse release order, idempotence, and separate documents", () => {
    const firstDocument = createLockDocument("scroll");
    const secondDocument = createLockDocument("visible");
    const releaseFirst = acquireBodyScrollLock(firstDocument);
    const releaseFirstAgain = acquireBodyScrollLock(firstDocument);
    const releaseSecond = acquireBodyScrollLock(secondDocument);

    releaseFirstAgain();
    releaseFirstAgain();
    expect(firstDocument.body.style.overflow).toBe("hidden");
    releaseFirst();
    expect(firstDocument.body.style.overflow).toBe("scroll");
    expect(secondDocument.body.style.overflow).toBe("hidden");
    releaseSecond();
    expect(secondDocument.body.style.overflow).toBe("visible");
  });

  it("degrades safely without a writable body", () => {
    expect(() => acquireBodyScrollLock(undefined)()).not.toThrow();
    expect(() => acquireBodyScrollLock({})()).not.toThrow();
  });
});

describe("Builder portal architecture", () => {
  it("routes all seven portal families through the owned target", () => {
    const portalSources = `${builderPanelSource}\n${metadataPreviewSource}`;
    expect(portalSources.match(/renderOwnedPortal\(/g)).toHaveLength(7);
    expect(portalSources).not.toContain("createPortal(");
    expect(ownedPortalSource).toContain("createPortalLike(content, portalRoot)");
    expect(appSource).toContain("portalRoot={portalRoot}");
    expect(appSource).toContain("useBuilderPortalRoot");
  });

  it("uses the exact supplied root at runtime and never falls back to body", () => {
    const firstRoot = { name: "first" };
    const secondRoot = { name: "second" };
    const body = { name: "body" };
    const calls = [];
    const createPortalLike = (content, target) => {
      const portal = { content, target };
      calls.push(portal);
      return portal;
    };
    const families = [
      "collection-card-preview",
      "composer-setup",
      "composer-proposal",
      "collection-dna",
      "scent-library",
      "review",
      "metadata-tooltip",
    ];

    const portals = families.map((family, index) =>
      renderOwnedPortal(
        { family },
        index % 2 === 0 ? firstRoot : secondRoot,
        createPortalLike,
      ),
    );

    expect(portals.map((portal) => portal.content.family)).toEqual(families);
    expect(portals.every((portal) => portal.target !== body)).toBe(true);
    expect(portals.filter((portal) => portal.target === firstRoot)).toHaveLength(4);
    expect(portals.filter((portal) => portal.target === secondRoot)).toHaveLength(3);
    expect(renderOwnedPortal({ family: "closed" }, null, createPortalLike)).toBeNull();
    expect(calls).toHaveLength(7);
  });

  it("keeps export stages scoped and direct body locks centralized", () => {
    expect(builderPanelSource).toContain("createCollectionCardExportStage(portalRoot)");
    expect(builderPanelSource).not.toContain("document.body.appendChild(exportStage)");
    expect(exportStageSource).toContain("portalRoot.appendChild(exportStage)");
    const directOverflowWriters = productionSources(sourceRoot)
      .filter(([path, source]) =>
        source.includes("style.overflow") && !path.endsWith("bodyScrollLock.js"),
      )
      .map(([path]) => path);
    expect(directOverflowWriters).toEqual([]);
  });

  it("uses no global root lookup or merchant-specific portal routing", () => {
    const sharedPortalSource = `${portalRootSource}\n${builderPanelSource}\n${metadataPreviewSource}`;
    expect(sharedPortalSource).not.toMatch(/querySelector\([^)]*builder-portal-root/);
    expect(portalRootSource).not.toMatch(/Aurelian|Discovery|merchant|VITE_MERCHANT/);
  });
});

describe("Collection Card export-stage ownership", () => {
  it("keeps concurrent stages under their roots and cleans up independently", () => {
    const documentLike = createPortalDocument();
    const firstRoot = createPortalRootForTheme(documentLike, "first-export", aurelianConfig.theme);
    const secondRoot = createPortalRootForTheme(
      documentLike,
      "second-export",
      discoveryDecantsConfig.theme,
    );
    const firstStage = createCollectionCardExportStage(firstRoot);
    const secondStage = createCollectionCardExportStage(secondRoot);

    expect(firstStage.parentNode).toBe(firstRoot);
    expect(secondStage.parentNode).toBe(secondRoot);
    expect(firstStage.className).toBe("collection-card-export-stage");
    expect(firstStage.getAttribute("aria-hidden")).toBe("true");

    removeCollectionCardExportStage(firstStage);
    expect(firstRoot.isConnected).toBe(true);
    expect(secondRoot.isConnected).toBe(true);
    expect(secondStage.parentNode).toBe(secondRoot);
    removeCollectionCardExportStage(firstStage);
    removeCollectionCardExportStage(secondStage);
    expect(secondRoot.isConnected).toBe(true);
  });

  it("fails clearly without an active owned root and preserves export dimensions", () => {
    expect(() => createCollectionCardExportStage(null)).toThrow(
      "Collection Card export requires an active Builder portal root.",
    );
    expect(builderCss).toMatch(
      /\.collection-card--export\s*\{[^}]*width:\s*1080px;[^}]*height:\s*1920px;/s,
    );
  });
});
