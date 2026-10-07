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

  it("only touches the collapsed strip, so the expanded dock keeps its real bottom edge and layout", () => {
    rules
      .filter(({ selector }) => selector.startsWith("#aurelian-builder-summary-slot"))
      .forEach(({ selector }) => {
        expect(selector, selector).toMatch(/\.is-collapsed|\.builder-panel-docked-collapsed/);
      });
    // Both the class and the wrapper this relies on are still emitted by the shared runtime.
    const panel = read(REPOSITORY_ROOT, "packages", "builder", "src", "components", "BuilderPanel.jsx");
    expect(panel).toContain('" is-collapsed"');
    expect(panel).toContain('className="builder-panel-docked-collapsed"');
  });

  it("removes the stray hairline by color only, so the strip's box does not change size", () => {
    const strip = ruleFor(".builder-panel-sticky-summary-card.is-collapsed");
    expect(strip.body).toMatch(/border-bottom-color:\s*transparent;/);
    expect(strip.body).not.toMatch(/(?:^|[;\s])border(?:-bottom)?(?:-width|-style)?\s*:/);
    // The card must keep matching the header's own background (pinned elsewhere): never repainted here.
    expect(withoutComments).not.toMatch(/(?:^|[;\s])background[\w-]*\s*:/);
  });

  it("centers the strip on the header's own axis and groups the three controls with the existing 8px gap", () => {
    const strip = ruleFor(".builder-panel-sticky-summary-card.is-collapsed");
    expect(strip.body).toMatch(/height:\s*var\(--site-header-height\);/);

    const cluster = ruleFor(".builder-panel-docked-collapsed");
    expect(cluster.body).toMatch(/justify-content:\s*flex-end;/);
    expect(cluster.body).toMatch(/gap:\s*8px;/);
    // 8px is the gap the Clear/Review pair already shares in the shared package.
    expect(read(REPOSITORY_ROOT, "packages", "builder", "styles.css")).toMatch(
      /\.builder-panel-docked-collapsed-actions\s*\{[^}]*gap:\s*8px;/
    );
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
      /(?:^|[;\s])(?:width|min-width|min-height|font-size|line-height|margin[\w-]*|display|position|top|right|left)\s*:/
    );
    expect(withoutComments).not.toMatch(/(?:^|[;\s])pointer-events\s*:/);
  });

  it("is absent from the shared Builder package, the catalog and Discovery Decants", () => {
    expect(read(REPOSITORY_ROOT, "packages", "builder", "styles.css")).not.toMatch(/builder-header\.css/);
    expect(read(REPOSITORY_ROOT, "src", "main.jsx")).not.toMatch(/builder-header/);
  });
});
