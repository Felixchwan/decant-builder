import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const APP_ROOT = fileURLToPath(new URL("..", import.meta.url));
const REPOSITORY_ROOT = fileURLToPath(new URL("../../..", import.meta.url));
const read = (...segments) => readFileSync(join(...segments), "utf8");

const headerCss = read(APP_ROOT, "src", "app", "builder-header.css");
const withoutComments = headerCss.replace(/\/\*[\s\S]*?\*\//g, "");

// One @media block, rules never nest further: a plain `selector { body }`
// pattern finds every rule (flattening the media query).
const rules = [...withoutComments.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
  .map(([, selector, body]) => ({ selector: selector.trim(), body }))
  .filter(({ selector }) => !selector.startsWith("@"));
const ruleFor = (needle) => rules.find(({ selector }) => selector.includes(needle));

describe("Aurelian Builder header: collapsed summary strip (host-owned, desktop-only)", () => {
  it("is loaded by Aurelian's own layout, after the geometry stylesheet", () => {
    const layout = read(APP_ROOT, "src", "app", "layout.jsx");
    expect(layout.indexOf('import "./builder-header.css";')).toBeGreaterThan(
      layout.indexOf('import "./builder-geometry.css";')
    );
  });

  it("applies only on desktop: every rule sits inside the single (min-width: 981px) query the Builder itself docks on", () => {
    expect(withoutComments.match(/@media/g)).toHaveLength(1);
    expect(withoutComments).toMatch(/^\s*@media\s*\(min-width:\s*981px\)\s*\{/);
    // ... which is the same switch the shared runtime uses to dock the summary.
    expect(read(REPOSITORY_ROOT, "packages", "builder", "src", "components", "BuilderPanel.jsx")).toContain(
      'window.matchMedia("(min-width: 981px)")'
    );
  });

  it("is scoped to the Builder route's header and the docked summary slot, never !important", () => {
    expect(withoutComments).not.toContain("!important");
    rules.forEach(({ selector }) => {
      expect(selector, selector).toMatch(
        /^(?::root:has\(\.site-header__inner--builder\)|#aurelian-builder-summary-slot )/
      );
    });
  });

  it("touches only the docked card: the collapsed strip, the expanded dock's top row, and the three controls' columns", () => {
    const EXPANDED = ".builder-panel-sticky-summary-card.is-docked:not(.is-collapsed)";
    rules
      .filter(({ selector }) => selector.startsWith("#aurelian-builder-summary-slot"))
      .forEach(({ selector }) => {
        // the expanded-state exceptions: the row-centering pair, and the shared three-column row
        if (selector.includes(":not(.is-collapsed)")) {
          selector.split(",").forEach((part) => {
            const allowed = [
              `#aurelian-builder-summary-slot ${EXPANDED}`,
              `#aurelian-builder-summary-slot ${EXPANDED} > .panel-header`,
              "#aurelian-builder-summary-slot .builder-panel-docked-collapsed",
            ];
            expect(allowed, part).toContain(part.trim());
          });
        }
      });
    // Both the class and the wrappers this relies on are still emitted by the shared runtime.
    const panel = read(REPOSITORY_ROOT, "packages", "builder", "src", "components", "BuilderPanel.jsx");
    expect(panel).toContain('" is-collapsed"');
    expect(panel).toContain('className="builder-panel-docked-collapsed"');
    expect(panel).toContain('className="builder-panel-docked-collapsed-actions"');
    expect(panel).toContain('className="panel-header-actions"');
  });

  it("removes the stray hairline by color only, so the strip's box does not change size", () => {
    const strip = ruleFor(".builder-panel-sticky-summary-card.is-collapsed");
    expect(strip.body).toMatch(/border-bottom-color:\s*transparent;/);
    expect(strip.body).not.toMatch(/(?:^|[;\s])border(?:-bottom)?(?:-width|-style)?\s*:/);
    // The card must keep matching the header's own background (pinned elsewhere): never repainted here.
    expect(withoutComments).not.toMatch(/(?:^|[;\s])background[\w-]*\s*:/);
  });

  it("centers the strip on the header's own axis, with the expanded card's own 22px side padding", () => {
    const strip = ruleFor(".builder-panel-sticky-summary-card.is-collapsed");
    expect(strip.body).toMatch(/height:\s*var\(--site-header-height\);/);
    expect(strip.body).toMatch(/padding:\s*0 22px;/);
    // the expanded card's horizontal padding, from the package, is what the collapsed strip now matches
    expect(read(REPOSITORY_ROOT, "packages", "builder", "styles.css")).toMatch(
      /\.builder-panel-sticky-summary-card \{[^}]*padding: 22px 22px 18px;/
    );
  });

  it("centers the EXPANDED dock's Mi caja / Vaciar caja / Revisar row on the header axis, by container geometry only", () => {
    const EXPANDED = "#aurelian-builder-summary-slot .builder-panel-sticky-summary-card.is-docked:not(.is-collapsed)";
    const card = rules.find(({ selector }) => selector === EXPANDED);
    const row = rules.find(({ selector }) => selector === `${EXPANDED} > .panel-header`);

    // no top inset (the shared 22px exists to clear the in-panel padding), and the row spans exactly the header's height
    expect(card.body.replace(/\s+/g, " ").trim()).toBe("padding-top: 0;");
    // ...and the row's only other declaration is its bottom margin, 18px (the package's) -> 8px, which is what hangs
    // the rack from the header line. It is scoped to this selector, so the collapsed strip and <=980px keep theirs.
    expect(row.body.replace(/\s+/g, " ").trim()).toBe("height: var(--site-header-height); margin-bottom: 8px;");
    expect(read(REPOSITORY_ROOT, "packages", "builder", "styles.css")).toMatch(/\.panel-header \{[^}]*margin-bottom: 18px;/);
    expect(rules.filter(({ body }) => /margin-bottom/.test(body)).map(({ selector }) => selector)).toEqual([`${EXPANDED} > .panel-header`]);

    // vertical only: no horizontal padding, gap, width, side/top margin, transform or per-control nudge anywhere in the pair
    [card, row].forEach(({ body }) => {
      expect(body).not.toMatch(/padding-(?:left|right|inline|bottom)|(?:^|[;\s])padding\s*:|gap|width|margin-(?:left|right|inline|top)|(?:^|[;\s])margin\s*:|transform|translate|align-|justify-|(?:^|[;\s])(?:top|bottom|left|right)\s*:/);
    });
  });

  describe("three stable control positions (expanded and collapsed)", () => {
    const SLOT = "#aurelian-builder-summary-slot";
    const GRID = `${SLOT} .builder-panel-sticky-summary-card.is-docked:not(.is-collapsed) > .panel-header, ${SLOT} .builder-panel-docked-collapsed`;
    const body = (selector) => rules.find((rule) => rule.selector.replace(/\s+/g, " ") === selector)?.body.replace(/\s+/g, " ").trim();

    it("gives the expanded row and the collapsed row the same three-track grid, centered on the header axis", () => {
      expect(body(GRID)).toBe("display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; column-gap: 0;");
    });

    it("lets the action buttons be grid items of those rows, so each takes its own column", () => {
      expect(body(`${SLOT} .panel-header-actions, ${SLOT} .builder-panel-docked-collapsed-actions`)).toBe("display: contents;");
    });

    it("puts expand/minimize left, Vaciar caja in the middle track and Revisar right, by explicit column", () => {
      expect(body(`${SLOT} .builder-box-header-title, ${SLOT} .builder-panel-docked-collapsed .summary-collapse-toggle`)).toBe("grid-column: 1; justify-self: start;");
      expect(body(`${SLOT} .builder-clear-button`)).toBe("grid-column: 2; justify-self: center;");
      expect(body(`${SLOT} .review-box-button`)).toBe("grid-column: 3; justify-self: end;");
      // the 1px puts the collapsed chevron on the expanded chevron's axis (it sits inside the strip's border)
      expect(body(`${SLOT} .builder-panel-docked-collapsed .summary-collapse-toggle`)).toBe("margin-left: 1px;");
    });

    it("moves nothing with transforms, per-state pixel nudges or position offsets, and never touches a control's size or type", () => {
      expect(withoutComments).not.toMatch(/transform|translate|(?:^|[;\s])(?:top|bottom|left|right)\s*:|position\s*:/);
      expect(withoutComments).not.toMatch(/(?:^|[;\s])(?:width|min-width|max-width|height\s*:\s*\d|min-height|font-size|line-height)\s*:/);
      // the only margins anywhere are the expanded row's 8px bottom margin and the 1px chevron alignment
      expect([...withoutComments.matchAll(/margin[\w-]*\s*:\s*([^;]+);/g)].map((m) => m[1])).toEqual(["8px", "1px"]);
    });

    it("leaves Revisar and Vaciar in the same horizontal place whether the box is expanded or collapsed (and whether Vaciar is there)", () => {
      // both rows share the grid above and the same 22px side padding, so the columns resolve to the same x;
      // Revisar names column 3 explicitly, so an empty box (no Vaciar caja) cannot slide it into column 2
      expect(body(`${SLOT} .review-box-button`)).toMatch(/grid-column: 3;/);
      expect(body(`${SLOT} .builder-clear-button`)).toMatch(/grid-column: 2;/);
    });
  });

  it("needs no shared-package edit: the cause is still the package's own inset, which the host overrides", () => {
    const shared = read(REPOSITORY_ROOT, "packages", "builder", "styles.css");

    expect(shared).toMatch(/\.builder-panel-sticky-summary-card \{[^}]*padding: 22px 22px 18px;/);
    expect(shared).toMatch(/\.builder-panel-sticky-summary-card\.is-docked \{[^}]*margin: 0;[^}]*\}/);
    expect(shared).not.toMatch(/aurelian-builder-summary-slot/);
  });

  it("trims the Builder header modestly (4.75rem to 4.25rem), reusing the value phones already use", () => {
    const root = ruleFor(":root:has(.site-header__inner--builder)");
    expect(root.body).toMatch(/--site-header-height:\s*4\.25rem;/);
    const globals = read(APP_ROOT, "src", "app", "globals.css");
    expect(globals).toMatch(/--site-header-height:\s*4\.75rem;/);
    expect(globals).toMatch(/:root\s*\{\s*--site-header-height:\s*4\.25rem;\s*\}/);
  });

  it("changes no control size, semantics or click target", () => {
    expect(withoutComments).not.toMatch(
      /(?:^|[;\s])(?:width|min-width|min-height|font-size|line-height|position|top|right|left)\s*:/
    );
    expect(withoutComments).not.toMatch(/(?:^|[;\s])pointer-events\s*:/);
  });

  it("is absent from the shared Builder package, the catalog and Discovery Decants", () => {
    expect(read(REPOSITORY_ROOT, "packages", "builder", "styles.css")).not.toMatch(/builder-header\.css/);
    expect(read(REPOSITORY_ROOT, "src", "main.jsx")).not.toMatch(/builder-header/);
  });
});
