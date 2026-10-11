import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const APP_ROOT = fileURLToPath(new URL("..", import.meta.url));
const REPOSITORY_ROOT = fileURLToPath(new URL("../../..", import.meta.url));
const read = (...segments) => readFileSync(join(...segments), "utf8").replace(/\r\n/g, "\n");

const css = read(APP_ROOT, "src", "app", "builder-catalog-grid.css");
const code = css.replace(/\/\*[\s\S]*?\*\//g, "");
const sharedCss = read(REPOSITORY_ROOT, "packages", "builder", "styles.css");
const rule = code.match(/@media \(min-width: 981px\)\s*\{\s*([^{}]+)\{([^{}]*)\}\s*\}/);
const selectors = (rule?.[1] ?? "").split(",").map((part) => part.replace(/\s+/g, " ").trim());
const body = (rule?.[2] ?? "").replace(/\s+/g, " ").trim();

describe("Aurelian catalog grid (builder-catalog-grid.css)", () => {
  it("is loaded by Aurelian's layout, after the shared stylesheet whose fixed three columns it replaces", () => {
    const layout = read(APP_ROOT, "src", "app", "layout.jsx");

    expect(layout).toContain('import "./builder-catalog-grid.css";');
    expect(layout.indexOf('import "./builder-catalog-grid.css";')).toBeGreaterThan(layout.indexOf('import "@discovery-box/builder/styles.css";'));
  });

  it("is one rule in the desktop two-column layout only (981px and up), the same condition as the shared rules it replaces", () => {
    expect(rule, "a single (min-width: 981px) rule").not.toBeNull();
    expect(code.replace(rule[0], "").trim()).toBe("");
    expect(sharedCss).toMatch(/@media \(min-width: 981px\) \{\s*:where\(\.builder-scope\) \.app \{/);
  });

  it("covers both panel states with the one recipe, so the count only ever follows the width", () => {
    expect(selectors).toEqual([
      ".builder-page .layout.layout--panel-collapsible:not(.layout--panel-collapsed) .catalog-grid",
      ".builder-page .layout.layout--panel-collapsed .catalog-grid",
    ]);
    expect(body).toBe("grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));");
  });

  it("takes the count from the width: no fixed number of columns, no !important, no breakpoint ladder", () => {
    expect(code).not.toMatch(/repeat\(\s*\d+\s*,/);
    expect(code).not.toContain("!important");
    expect((code.match(/@media/g) || []).length).toBe(1);
    expect(code).not.toMatch(/@container|container-type/);
  });

  it("uses auto-fill, not auto-fit, so a search with few results keeps card-sized cards instead of stretching them", () => {
    expect(body).toContain("auto-fill");
    expect(body).not.toContain("auto-fit");
  });

  it("keeps the floor the approved card has always had: 220px, the shared collapsed recipe's own minimum", () => {
    expect(sharedCss).toContain("grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));");
    expect(sharedCss).toMatch(/\.layout--panel-collapsed \.catalog-grid \{[^}]*grid-template-columns: repeat\(auto-fit, minmax\(220px, 237px\)\);/);
    expect(body).toContain("minmax(220px, 1fr)");
  });

  it("beats the shared rules it replaces by specificity (one class more), never by order or !important", () => {
    const sharedExpanded = ":where(.builder-scope) .layout.layout--panel-collapsible:not(.layout--panel-collapsed) .catalog-grid";
    const sharedCollapsed = ":where(.builder-scope) .layout.layout--panel-collapsed .catalog-grid";

    expect(sharedCss).toContain(sharedExpanded);
    expect(sharedCss).toContain(sharedCollapsed);
    expect(selectors[0]).toBe(sharedExpanded.replace(":where(.builder-scope)", ".builder-page"));
    expect(selectors[1]).toBe(sharedCollapsed.replace(":where(.builder-scope)", ".builder-page"));
  });

  it("changes nothing but the track recipe: the card, the gap and the centring come from the existing rules", () => {
    expect(body).not.toMatch(/gap|justify|padding|margin|width|height/);
  });
});

describe("Aurelian Builder shell: extra screen width goes to the catalog, in both panel states", () => {
  const globals = read(APP_ROOT, "src", "app", "globals.css");
  const globalsCode = globals.replace(/\/\*[\s\S]*?\*\//g, "");

  it("has one shell width, 2200px (the shared package's own .app ceiling), with no state-dependent override", () => {
    expect(globalsCode).toMatch(/:root\s*\{\s*--aur-builder-max:2200px;/);
    expect(globalsCode).toMatch(/\.builder-page > \.builder-theme-root\s*\{\s*width:min\(var\(--aur-builder-max\),100%\);/);
    expect(globalsCode).not.toMatch(/builder-theme-root:has\(/);
    expect(sharedCss).toMatch(/:where\(\.builder-scope\) \.app \{\s*width: min\(2200px, 100%\);/);
  });

  it("derives every edge that mirrors the shell from the one variable, so the cap cannot drift from them", () => {
    const edgeUses = globalsCode.match(/var\(--aur-builder-edge\)/g) || [];

    // the docked slot, the expanded intro (left + right), the collapsed intro (right)
    expect(edgeUses.length).toBe(4);
    expect(globalsCode).not.toMatch(/calc\(50% - \d+px\)/);
  });

  it("leaves the right panel at its own fixed width: nothing here widens it", () => {
    expect(globalsCode).toMatch(/\.site-header__builder-slot\s*\{[^}]*width:360px/);
    expect(sharedCss).toMatch(/\.layout \{\s*grid-template-columns: minmax\(0, 1fr\) 360px;\s*gap: 16px;/);
    expect(code).not.toMatch(/360px|\.builder-panel|panel-column/);
  });

  it("keeps the intro's copy at one editorial measure, so the plate does not change height between panel states", () => {
    const intro = read(APP_ROOT, "src", "app", "builder-intro.css").replace(/\/\*[\s\S]*?\*\//g, "");

    expect(intro).toMatch(/#builder-entry-header \.lede \{\s*max-width: min\(62%, 36rem\);/);
    expect(intro).not.toMatch(/layout--panel-collapsed\) #builder-entry-header \.lede/);
  });
});

describe("Aurelian catalog grid: no script, and the shared stylesheet and Discovery Decants are untouched", () => {
  it("does not compute a column count anywhere in the Builder's scripts", () => {
    ["BuilderRuntime.jsx", "builder/DiscoveryBoxBuilder.jsx"].forEach((file) => {
      const source = read(REPOSITORY_ROOT, "packages", "builder", "src", file);

      expect(source, file).not.toMatch(/grid-template-columns|columnCount|columnsPerRow|cardsPerRow/);
    });
  });

  it("leaves no trace in Discovery Decants' sources", () => {
    const walk = (directory) =>
      readdirSync(directory).flatMap((entry) => {
        const path = join(directory, entry);

        return statSync(path).isDirectory() ? walk(path) : /\.(jsx?|css)$/.test(entry) && !/\.test\./.test(entry) ? [path] : [];
      });

    walk(join(REPOSITORY_ROOT, "src")).forEach((path) => expect(read(path), path).not.toMatch(/builder-catalog-grid|layout--panel-collapsible/));
  });
});
