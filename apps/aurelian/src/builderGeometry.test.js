import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const APP_ROOT = fileURLToPath(new URL("..", import.meta.url));
const REPOSITORY_ROOT = fileURLToPath(new URL("../../..", import.meta.url));
const read = (...segments) => readFileSync(join(...segments), "utf8");

const geometryCss = read(APP_ROOT, "src", "app", "builder-geometry.css");
const withoutComments = geometryCss.replace(/\/\*[\s\S]*?\*\//g, "");

// Inner rules never nest further than one @media, so a plain
// `selector { declarations }` pattern finds every rule (flattening the @media).
const rules = [...withoutComments.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
  .map(([, selector, body]) => ({ selector: selector.trim(), body }))
  .filter(({ selector }) => !selector.startsWith("@"));
const selectors = rules.flatMap(({ selector }) => selector.split(",").map((part) => part.trim()));

const radiusOf = (selector) => {
  const rule = rules.find((candidate) =>
    candidate.selector.split(",").map((part) => part.trim()).includes(selector)
  );
  const match = rule && rule.body.match(/border-radius:\s*(\d+)px(?:\s+(\d+)px\s+(\d+)px\s+(\d+)px)?/);
  return match ? Number(match[1]) : null;
};

describe("Aurelian shape language and header typography (host-owned, presentation-only)", () => {
  it("is loaded by Aurelian's own layout, after the zoning and intro stylesheets", () => {
    const layout = read(APP_ROOT, "src", "app", "layout.jsx");
    expect(layout.indexOf('import "./builder-geometry.css";')).toBeGreaterThan(
      layout.indexOf('import "./builder-intro.css";')
    );
  });

  it("is scoped to the Builder page, the docked summary slot, or the Builder-route header", () => {
    expect(selectors.length).toBeGreaterThan(30);
    selectors.forEach((selector) => {
      expect(selector, selector).toMatch(
        /^(?:\.builder-page|#aurelian-builder-summary-slot|\.site-header:has\(\.site-header__inner--builder\))/
      );
    });
  });

  it("never uses !important, assets or animation", () => {
    expect(withoutComments).not.toContain("!important");
    expect(withoutComments).not.toMatch(/url\(|@keyframes|animation|transition/);
  });

  it("changes no size, spacing, layout or hit area: no box, border-width or positioning declarations", () => {
    rules.forEach(({ selector, body }) => {
      expect(body, selector).not.toMatch(
        /(?:^|[;\s])(?:margin|padding|gap|display|position|top|right|bottom|left|width|height|min-width|max-width|min-height|max-height|grid-template[\w-]*|flex[\w-]*|border|border-width|border-style|line-height)\s*:/
      );
    });
    // The one size-related declaration: the header nav links' type size.
    rules
      .filter(({ body }) => /(?:^|[;\s])font-size\s*:/.test(body))
      .forEach(({ selector }) => {
        expect(selector).toBe(".site-header:has(.site-header__inner--builder) .desktop-nav a");
      });
    expect(withoutComments.match(/@media/g)).toHaveLength(1);
    expect(withoutComments).toContain("@media (max-width: 980px)");
  });

  it("only ever softens the shared geometry downwards: a bounded radius scale, never round-to-square", () => {
    const radii = [...withoutComments.matchAll(/border-radius:\s*([^;]+);/g)].flatMap((match) =>
      [...match[1].matchAll(/(\d+)px/g)].map((value) => Number(value[1]))
    );
    expect(radii.length).toBeGreaterThan(10);
    radii.forEach((value) => {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(14);
    });
    // No selector is squared off entirely (the brief: tailored, not brutalist).
    expect(Math.min(...radii.filter((value) => value > 0))).toBeGreaterThanOrEqual(5);
  });

  it("keeps the intended hierarchy: shells > panels/cards/controls > buttons > nested > card image", () => {
    const shell = radiusOf(".builder-page .catalog-section");
    expect(shell).toBe(radiusOf(".builder-page .builder-panel"));
    expect(shell).toBeGreaterThanOrEqual(12);
    expect(shell).toBeLessThanOrEqual(14);

    const panel = radiusOf(".builder-page .compose-box-panel");
    expect(panel).toBe(radiusOf(".builder-page .curator-bonus-section"));
    expect(panel).toBe(radiusOf(".builder-page .collection-snapshot"));
    expect(panel).toBeGreaterThanOrEqual(8);
    expect(panel).toBeLessThanOrEqual(12);
    expect(panel).toBeLessThan(shell);

    const card = radiusOf(".builder-page .perfume-card");
    expect(card).toBeGreaterThanOrEqual(8);
    expect(card).toBeLessThanOrEqual(10);
    expect(radiusOf(".builder-page .perfume-card-image")).toBeLessThan(card);

    const control = radiusOf('.builder-page .catalog-section input[type="search"]');
    expect(control).toBe(radiusOf(".builder-page .catalog-section .filters select"));
    expect(control).toBeGreaterThanOrEqual(8);
    expect(control).toBeLessThanOrEqual(12);

    const button = radiusOf(".builder-page .perfume-card-compact-actions button");
    expect(button).toBe(radiusOf("#aurelian-builder-summary-slot .builder-clear-button"));
    expect(button).toBe(radiusOf("#aurelian-builder-summary-slot .review-box-button"));
    expect(button).toBeGreaterThanOrEqual(8);
    expect(button).toBeLessThanOrEqual(10);

    // Nested panels are never rounder than the panel that hosts them.
    expect(radiusOf(".builder-page .curator-bonus-card")).toBeLessThanOrEqual(panel);
  });

  it("keeps the sticky summary card's top corners equal to the panel shell it sits over", () => {
    const sticky = rules.find(({ selector }) => selector.includes(".builder-panel-sticky-summary-card"));
    expect(sticky.body).toMatch(new RegExp(`border-radius:\\s*${radiusOf(".builder-page .builder-panel")}px ${radiusOf(".builder-page .builder-panel")}px 0 0`));
  });

  it("leaves icon buttons, progress tracks, pills and chips round: none of them is targeted", () => {
    const targeted = selectors.join(" ");
    [
      "perfume-card-info-icon",
      "builder-intro-dismiss",
      "slot-bar",
      "slot-progress",
      "discovery-progress-bar",
      "discovery-bonus-state",
      "collection-dna-chip",
      "summary-metadata-chip",
      "summary-collapse-toggle",
      "recommendation-carousel-controls",
    ].forEach((name) => expect(targeted, name).not.toContain(name));
  });

  it("applies the serif only to the 'Mi caja' title, never to controls or labels", () => {
    const serifRules = rules.filter(({ body }) => /font-family:/.test(body));
    expect(serifRules).toHaveLength(1);
    expect(serifRules[0].selector).toContain(".builder-box-header-title h2");
    expect(serifRules[0].body).toMatch(/Georgia/);
  });

  it("styles the header on the Builder route only, and never touches nav copy or colors", () => {
    const header = rules.filter(({ selector }) => selector.includes(".site-header:has"));
    expect(header.length).toBeGreaterThanOrEqual(3);
    header.forEach(({ body }) => expect(body).not.toMatch(/(?:^|[;\s])(?:color|background)[\w-]*\s*:/));
    expect(withoutComments).not.toMatch(/(?:^|[;\s])content\s*:/);
  });

  it("keeps 'Vaciar caja' as a secondary: a hairline drawn as an inset shadow, not a border", () => {
    const clear = rules.find(({ selector }) => selector.startsWith(".builder-page .builder-clear-button"));
    expect(clear.body).toMatch(/box-shadow:\s*inset 0 0 0 1px/);
    expect(clear.body).not.toMatch(/(?:^|[;\s])border\s*:/);
  });

  it("is absent from the shared Builder package, the catalog and Discovery Decants", () => {
    const shared = read(REPOSITORY_ROOT, "packages", "builder", "styles.css");
    expect(shared).not.toMatch(/builder-geometry/);
    const entry = read(REPOSITORY_ROOT, "src", "main.jsx");
    expect(entry).not.toMatch(/builder-geometry/);
  });
});
