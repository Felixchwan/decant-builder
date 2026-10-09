import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const APP_ROOT = fileURLToPath(new URL("..", import.meta.url));
const REPOSITORY_ROOT = fileURLToPath(new URL("../../..", import.meta.url));
const read = (...segments) => readFileSync(join(...segments), "utf8");

const css = read(APP_ROOT, "src", "app", "builder-collection-card.css");
const withoutComments = css.replace(/\/\*[\s\S]*?\*\//g, "");
const rules = [...withoutComments.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
  .map(([, selector, body]) => ({ selector: selector.trim(), body: body.replace(/\s+/g, " ").trim() }))
  .filter(({ selector }) => !selector.startsWith("@"));
const body = (selector) => rules.find((rule) => rule.selector === selector)?.body;

const panelSource = read(REPOSITORY_ROOT, "packages", "builder", "src", "components", "BuilderPanel.jsx");
const sharedCss = read(REPOSITORY_ROOT, "packages", "builder", "styles.css");

describe("Collection Card block: titleless, host-simplified (the shared markup is untouched)", () => {
  it("is loaded by Aurelian's own layout, after the shared stylesheet and the other Builder host files", () => {
    const layout = read(APP_ROOT, "src", "app", "layout.jsx");

    expect(layout.indexOf('import "./builder-collection-card.css";')).toBeGreaterThan(layout.indexOf('import "./builder-header.css";'));
    expect(layout.indexOf('import "./builder-collection-card.css";')).toBeGreaterThan(layout.indexOf('import "@discovery-box/builder/styles.css";'));
  });

  it("hides the 'COLLECTION CARD' heading and the (i) tooltip by hiding their one shared toolbar, never by removing it", () => {
    // display:none leaves the layout, the tab order and the accessibility tree
    expect(body(".builder-page .share-box-toolbar")).toBe("display: none;");

    // the label, the info button and the tooltip all live inside that toolbar, in the package's own markup
    const start = panelSource.indexOf('<div className="share-box-toolbar">');
    const toolbar = panelSource.slice(start, panelSource.indexOf('<div className="share-box-buttons"'));
    expect(start).toBeGreaterThan(-1);
    expect(toolbar).toContain('className="share-box-label"');
    expect(toolbar).toContain('className="share-info-button"');
    expect(toolbar).toContain('role="tooltip"');
  });

  it("lets the two actions share the row (one fills it, two split it) and drops the margin that tucked under the old label", () => {
    expect(body(".builder-page .share-box-actions")).toBe("margin: 0 0 12px;");
    expect(body(".builder-page .share-box-buttons")).toBe("justify-content: stretch;");
    expect(body(".builder-page .share-box-buttons button")).toBe("flex: 1 1 0;");
  });

  it("changes only the row's layout: no size, type, color or border on the buttons, no motion, no !important", () => {
    expect(rules).toHaveLength(4);
    expect(body(".builder-page .share-box-buttons button")).not.toMatch(/height|padding|font|color|background|border|radius/);
    expect(withoutComments).not.toMatch(/!important|transition|animation|transform|color|background/);
  });

  it("keeps both actions wired exactly as the package wires them", () => {
    expect(panelSource).toContain("onClick={handleDownloadShareImage}");
    expect(panelSource).toContain("onClick={handleNativeShareCard}");
    expect(panelSource).toContain("{canNativeShareCard && (");
    expect(panelSource).toContain("disabled={isShareGenerating}");
  });

  it("is Builder-route-only: every selector is under .builder-page, and the package stylesheet keeps its heading, tooltip and layout", () => {
    rules.forEach(({ selector }) => expect(selector, selector).toMatch(/^\.builder-page /));

    expect(sharedCss).toMatch(/\.share-box-toolbar \{\s*display: inline-flex;/);
    expect(sharedCss).toMatch(/\.share-box-actions \{[^}]*margin: -4px 0 12px;/);
    expect(sharedCss).not.toMatch(/builder-collection-card|\.builder-page/);
    // Discovery Decants never loads this file
    expect(read(REPOSITORY_ROOT, "src", "main.jsx")).not.toMatch(/builder-collection-card/);
  });
});
