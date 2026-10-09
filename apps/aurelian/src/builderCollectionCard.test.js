import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const APP_ROOT = fileURLToPath(new URL("..", import.meta.url));
const REPOSITORY_ROOT = fileURLToPath(new URL("../../..", import.meta.url));
const read = (...segments) => readFileSync(join(...segments), "utf8");

const css = read(APP_ROOT, "src", "app", "builder-collection-card.css").replace(/\r\n/g, "\n");
const withoutComments = css.replace(/\/\*[\s\S]*?\*\//g, "");
const rules = [...withoutComments.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
  .map((match) => ({ selector: match[1].trim(), body: match[2].replace(/\s+/g, " ").trim(), index: match.index }))
  .filter(({ selector }) => !selector.startsWith("@"));
const body = (selector) => rules.find((rule) => rule.selector === selector)?.body;

// The file has two layers: the flat, Builder-route rules for the <=980px row, and the
// desktop-only rail, which is the one @media block and hangs off the header slot because the
// docked card is portaled out of .builder-page.
const SLOT = "#aurelian-builder-summary-slot .builder-panel-summary-accessory";
const mediaIndex = withoutComments.indexOf("@media (min-width: 981px)");
const rowRules = rules.filter(({ selector, index }) => index < mediaIndex && selector.startsWith(".builder-page "));
const railRules = rules.filter(({ selector }) => selector.includes(".builder-panel-summary-accessory"));
const panelRules = rules.filter(({ selector, index }) => index > mediaIndex && selector.startsWith(".builder-page "));
const rail = (suffix = "") => body(`${SLOT}${suffix}`);

const panelSource = read(REPOSITORY_ROOT, "packages", "builder", "src", "components", "BuilderPanel.jsx").replace(/\r\n/g, "\n");
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
    expect(rowRules).toHaveLength(4);
    expect(body(".builder-page .share-box-buttons button")).not.toMatch(/height|padding|font|color|background|border|radius/);
    rowRules.forEach(({ selector, body: ruleBody }) => {
      expect(ruleBody, selector).not.toMatch(/!important|transition|animation|transform|color|background/);
    });
    expect(withoutComments).not.toMatch(/!important|transition|animation/);
  });

  it("keeps both actions wired exactly as the package wires them", () => {
    expect(panelSource).toContain("onClick={handleDownloadShareImage}");
    expect(panelSource).toContain("onClick={handleNativeShareCard}");
    expect(panelSource).toContain("{canNativeShareCard && (");
    expect(panelSource).toContain("disabled={isShareGenerating}");
  });

  it("is Builder-route-only: every row selector is under .builder-page, and the package stylesheet keeps its heading, tooltip and layout", () => {
    rowRules.forEach(({ selector }) => expect(selector, selector).toMatch(/^\.builder-page /));

    expect(sharedCss).toMatch(/\.share-box-toolbar \{\s*display: inline-flex;/);
    expect(sharedCss).toMatch(/\.share-box-actions \{[^}]*margin: -4px 0 12px;/);
    expect(sharedCss).not.toMatch(/builder-collection-card|\.builder-page/);
    // Discovery Decants never loads this file
    expect(read(REPOSITORY_ROOT, "src", "main.jsx")).not.toMatch(/builder-collection-card/);
  });
});

describe("Collection Card actions: desktop rail beside the docked box (host-owned, opt-in anchor)", () => {
  const mediaStart = withoutComments.indexOf("@media (min-width: 981px)");

  it("opts in from Aurelian's Builder host only; Discovery Decants and the shared defaults never pass the prop", () => {
    expect(read(APP_ROOT, "src", "components", "BuilderExperience.jsx")).toMatch(/^\s+dockShareActions\s*$/m);

    [read(REPOSITORY_ROOT, "src", "main.jsx"), read(REPOSITORY_ROOT, "src", "app", "DiscoveryDecantsApp.jsx")].forEach((source) =>
      expect(source).not.toContain("dockShareActions")
    );
    expect(read(REPOSITORY_ROOT, "packages", "builder", "src", "builder", "DiscoveryBoxBuilder.jsx")).toContain("dockShareActions = false,");
  });

  it("lives in one @media (min-width: 981px) block -- the docking breakpoint -- so the <=980px row is the unchanged one above", () => {
    expect(withoutComments.match(/@media/g)).toHaveLength(1);
    expect(mediaStart).toBeGreaterThan(-1);
    expect(withoutComments.indexOf(SLOT)).toBeGreaterThan(mediaStart);
    // every flat row rule comes before it, and the package only renders the anchor when docked (>=981px)
    expect(withoutComments.lastIndexOf(".builder-page .share-box-buttons button")).toBeLessThan(mediaStart);
    expect(panelSource).toContain('<div className="builder-panel-summary-accessory">');
    expect(panelSource).toContain('window.matchMedia("(min-width: 981px)")');
  });

  it("hides the panel's own utility row at desktop, so no orphan strip sits above the Composer in any box or panel state", () => {
    expect(panelRules.map(({ selector }) => selector)).toEqual([
      ".builder-page .builder-panel > .share-box-actions",
      ".builder-page .builder-panel > .compose-box-panel:first-child",
    ]);
    expect(body(".builder-page .builder-panel > .share-box-actions")).toBe("display: none;");
    // the Composer sheds only its top lead (14px); one panel inset remains
    expect(body(".builder-page .builder-panel > .compose-box-panel:first-child")).toBe("margin-top: 0;");
    // the same rules sit inside the desktop block, so the inline (<=980px) row and its spacing are untouched
    panelRules.forEach(({ index }) => expect(index).toBeGreaterThan(mediaIndex));
    expect(rowRules.map(({ selector }) => selector)).not.toContain(".builder-page .builder-panel > .share-box-actions");
  });

  describe("top spacing above the Composer, by state", () => {
    const COLLAPSED =
      ":root:has(#aurelian-builder-summary-slot .builder-panel-sticky-summary-card.is-docked.is-collapsed) .builder-page .builder-panel";
    const collapsedRules = rules.filter(({ selector }) => selector.startsWith(":root:has(#aurelian-builder-summary-slot .builder-panel-sticky-summary-card"));

    it("tightens the collapsed desktop state only: panel padding 18px -> 14px and the stale 14px Composer lead removed", () => {
      expect(collapsedRules.map(({ selector }) => selector)).toEqual([
        COLLAPSED,
        `${COLLAPSED} > .share-box-actions + .compose-box-panel`,
      ]);
      expect(body(COLLAPSED)).toBe("padding-top: 14px;");
      expect(body(`${COLLAPSED} > .share-box-actions + .compose-box-panel`)).toBe("margin-top: 0;");
      // 1px border + 14px padding = a 15px gap, inside the requested 12-16px band
      expect(1 + 14).toBeGreaterThanOrEqual(12);
      expect(1 + 14).toBeLessThanOrEqual(16);
    });

    it("keys on the collapsed, docked card itself (the existing .is-collapsed class), and only at >=981px", () => {
      collapsedRules.forEach(({ index }) => expect(index).toBeGreaterThan(mediaIndex));
      expect(COLLAPSED).toContain(".is-docked.is-collapsed");
      expect(panelSource).toContain(`isDockedAndCollapsed ? " is-collapsed" : ""`);
    });

    it("leaves the expanded state exactly as approved: no padding rule for it, and the existing first-child margin reset only", () => {
      // expanded keeps the package's 18px panel padding and the Composer's 0 margin from the rule above
      expect(rules.filter(({ selector, body: ruleBody }) => /padding/.test(ruleBody) && /\.builder-panel(?![-\w])/.test(selector)).map(({ selector }) => selector)).toEqual([COLLAPSED]);
      expect(body(".builder-page .builder-panel > .compose-box-panel:first-child")).toBe("margin-top: 0;");
      expect(sharedCss).toMatch(/\.builder-panel \{[^}]*padding: 18px;/);
    });

    it("leaves <=980px alone: nothing outside the desktop media block touches the panel or the Composer", () => {
      rules
        .filter(({ index }) => index < mediaIndex)
        .forEach(({ selector }) => expect(selector, selector).not.toMatch(/builder-panel(?!-)|compose-box-panel/));
      // below 981px nothing is docked, so the collapsed-card class (and this rule) cannot exist there
      expect(panelSource).toContain('window.matchMedia("(min-width: 981px)")');
    });

    it("changes no shared package file or stylesheet, and leaves the Composer's own padding to the package", () => {
      expect(withoutComments).not.toMatch(/compose-box-panel[^{]*\{[^}]*padding/);
      expect(sharedCss).not.toContain("is-collapsed .builder-panel");
      expect(sharedCss).not.toMatch(/builder-collection-card/);
    });
  });

  it("scopes every rail rule to the anchor under the header slot (the docked card is outside .builder-page)", () => {
    expect(railRules.length).toBeGreaterThan(8);
    railRules.forEach(({ selector }) => {
      expect(selector, selector).toMatch(
        /^(?:#aurelian-builder-summary-slot \.builder-panel-summary-accessory|:root:has\(\.layout--panel-collapsed\) #aurelian-builder-summary-slot \.builder-panel-summary-accessory)(?: |:|$)/
      );
    });
  });

  it("is a narrow, vertically centred rail: 26px wide, in the column left of the tray, tray-height tall", () => {
    const anchor = rail();
    expect(anchor).toMatch(/position: absolute;/);
    expect(anchor).toMatch(/left: -7px;/);
    expect(anchor).toMatch(/top: calc\(var\(--site-header-height\) \+ 27px\);/);
    expect(anchor).toMatch(/width: 26px;/);
    expect(anchor).toMatch(/height: 171px;/);
    expect(anchor).toMatch(/display: flex;/);
    expect(anchor).toMatch(/align-items: center;/);

    expect(rail(" .share-box-actions")).toMatch(/flex-direction: column;/);
    expect(rail(" .share-box-buttons")).toMatch(/flex-direction: column;/);
    expect(rail(" .share-box-toolbar")).toBe("display: none;");
  });

  it("makes every control the same square, icon-only, with its real text kept as the accessible name", () => {
    const button = rail(" .share-box-buttons button");
    expect(button).toMatch(/width: 26px;/);
    expect(button).toMatch(/height: 26px;/);
    // font-size 0 hides the glyphs but leaves the text in the accessibility tree; display/visibility would not
    expect(button).toMatch(/font-size: 0;/);
    expect(button).not.toMatch(/display:|visibility:|clip|text-indent/);
    // two distinct icons, painted as a mask so they follow the text color
    expect(rail(" .share-box-buttons button:first-child")).toMatch(/--aur-rail-icon: url\("data:image\/svg\+xml/);
    expect(rail(" .share-box-buttons button:not(:first-child)")).toMatch(/--aur-rail-icon: url\("data:image\/svg\+xml/);
    expect(rail(" .share-box-buttons button::before")).toMatch(/mask: var\(--aur-rail-icon\)/);
    // the package gives the docked placement a native hover title from the same labels
    expect(panelSource).toContain("title={shareActionTitle(");
  });

  it("rests neutral and answers with restrained brass on hover and a visible gold focus ring", () => {
    expect(rail(" .share-box-buttons button")).toMatch(/color: rgba\(231, 221, 207, 0\.62\);/);
    expect(rail(" .share-box-buttons button:hover:not(:disabled)")).toMatch(/color: var\(--gold\);/);
    expect(rail(" .share-box-buttons button:focus-visible")).toMatch(/outline: 2px solid var\(--gold\);/);
    expect(rail(" .share-box-buttons button:disabled")).toMatch(/opacity: 0\.46;/);
  });

  it("moves the status line beside the rail instead of squeezing it into 26px, as the same aria-live element", () => {
    const status = rail(" .share-box-status");
    expect(status).toMatch(/position: absolute;/);
    expect(status).toMatch(/right: calc\(100% \+ 10px\);/);
    expect(status).toMatch(/font-size: 0\.8rem;/);
    expect(panelSource).toContain('<p className="share-box-status" aria-live="polite">');
  });

  it("removes the rail from layout, tab order and the accessibility tree while the right panel is collapsed", () => {
    expect(body(`:root:has(.layout--panel-collapsed) ${SLOT}`)).toBe("display: none;");
    // the hook is the Builder's own collapsed-layout class, the one the other host files already key on
    expect(read(REPOSITORY_ROOT, "packages", "builder", "src", "BuilderRuntime.jsx")).toContain("layout--panel-collapsed");
  });
});
