import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const APP_ROOT = fileURLToPath(new URL("..", import.meta.url));
const REPOSITORY_ROOT = fileURLToPath(new URL("../../..", import.meta.url));
const read = (...segments) => readFileSync(join(...segments), "utf8").replace(/\r\n/g, "\n");

const css = read(APP_ROOT, "src", "app", "builder-recommendations.css");
const withoutComments = css.replace(/\/\*[\s\S]*?\*\//g, "");
const rules = [...withoutComments.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((match) => ({
  selector: match[1].replace(/\s+/g, " ").trim(),
  body: match[2].replace(/\s+/g, " ").trim(),
}));
const body = (selector) => rules.find((rule) => rule.selector === selector)?.body;

const VERSATILITY = ".builder-page .recommendation-lane--versatility";
const AFFINITY = ".builder-page .recommendation-lane--affinity";

describe("Recommendation lenses: Aurelian host paint (Versatilidad = brass, Afinidad = burgundy)", () => {
  it("is loaded by Aurelian's layout, after the shared stylesheet and the other Builder host files", () => {
    const layout = read(APP_ROOT, "src", "app", "layout.jsx");

    expect(layout.indexOf('import "./builder-recommendations.css";')).toBeGreaterThan(
      layout.indexOf('import "./builder-actions.css";')
    );
    expect(layout.indexOf('import "./builder-recommendations.css";')).toBeGreaterThan(
      layout.indexOf('import "@discovery-box/builder/styles.css";')
    );
  });

  it("is Builder-route-only: every selector is under .builder-page", () => {
    expect(rules.length).toBeGreaterThan(5);
    rules.forEach(({ selector }) =>
      selector.split(",").forEach((part) => expect(part.trim(), part).toMatch(/^\.builder-page /))
    );
  });

  it("gives each lens its own accent: brass for versatility, burgundy tokens for affinity", () => {
    expect(body(VERSATILITY)).toContain("--lens-label-text: var(--gold);");
    expect(body(VERSATILITY)).toContain("rgba(200, 166, 101,");
    expect(body(AFFINITY)).toContain("--lens-rim: var(--aur-burgundy-lift);");
    expect(body(AFFINITY)).toContain("--lens-wash: var(--aur-burgundy-wash);");
    expect(body(AFFINITY)).toContain("--lens-glow: var(--aur-burgundy-glow);");
  });

  it("keeps burgundy off text except the one readable interactive token on the small control glyphs", () => {
    // the pill text is ivory on the burgundy wash; burgundy never carries it
    expect(body(AFFINITY)).toContain("--lens-label-text: var(--aur-ivory);");
    expect(body(AFFINITY)).toContain("--lens-control-text: var(--aur-burgundy-text-interactive);");

    const colorDeclarations = [...withoutComments.matchAll(/(?:^|[;{\s])color:\s*([^;]+);/g)].map((match) =>
      match[1].trim()
    );
    expect(colorDeclarations.length).toBeGreaterThan(0);
    colorDeclarations.forEach((value) => expect(value).not.toMatch(/burgundy/));
  });

  it("uses no green anywhere: green stays reserved for tools such as Explorar por nota", () => {
    expect(withoutComments).not.toMatch(/green|sage|#5aa686|90,\s*166,\s*134|23,\s*60,\s*50|63,\s*122,\s*104/i);
    expect(withoutComments).not.toMatch(/--aur-green/);
  });

  it("states the lens as a compact pill + hint on one line, with real text carrying the meaning", () => {
    const lens = body(".builder-page .recommendation-lens");
    const label = body(".builder-page .recommendation-lens-label");
    const hint = body(".builder-page .recommendation-lens-hint");

    expect(lens).toMatch(/display: flex;/);
    expect(lens).toMatch(/align-items: center;/);
    expect(label).toMatch(/white-space: nowrap;/);
    expect(label).toMatch(/border-radius: 999px;/);
    expect(hint).toMatch(/white-space: nowrap;/);
    expect(hint).toMatch(/text-overflow: ellipsis;/);
    // the lens is text in the DOM, not generated content
    expect(withoutComments).not.toMatch(/content\s*:/);
  });

  it("tints the card with a hairline rim and a faint glow, never a fill", () => {
    const card = body(`${VERSATILITY} .recommendation-card, ${AFFINITY} .recommendation-card`);

    expect(card).toMatch(/border-color: var\(--lens-hair\);/);
    expect(card).toMatch(/inset 0 1px 0 var\(--lens-rim\)/);
    expect(card).not.toMatch(/background/);
  });

  it("recolors the carousel controls per lens without touching size, hit area, disabled state or the counter", () => {
    const resting = `${VERSATILITY} .recommendation-carousel-controls button, ${AFFINITY} .recommendation-carousel-controls button`;
    const hover = rules.find(({ selector }) => selector.includes(":not(:disabled):hover"));

    expect(body(resting)).toMatch(/border-color: var\(--lens-hair\);/);
    expect(body(resting)).toMatch(/color: var\(--lens-control-text\);/);
    expect(body(resting)).not.toMatch(/width|height|padding|min-|margin|font|cursor|opacity|pointer-events/);
    // hover and keyboard focus apply to enabled controls only, for both lenses
    expect(hover.selector).toContain(`${VERSATILITY} .recommendation-carousel-controls button:not(:disabled):hover`);
    expect(hover.selector).toContain(`${AFFINITY} .recommendation-carousel-controls button:not(:disabled):focus-visible`);
    // every control rule is scoped to a lens
    rules
      .filter(({ selector }) => selector.includes("recommendation-carousel-controls"))
      .forEach(({ selector }) =>
        selector
          .split(",")
          .forEach((part) => expect(part, part).toMatch(/recommendation-lane--(versatility|affinity)/))
      );
    expect(withoutComments).not.toMatch(/recommendation-carousel-controls span/);
  });

  it("leaves confidence badges, motion and !important alone, so reduced motion loses nothing", () => {
    expect(withoutComments).not.toMatch(/recommendation-confidence/);
    expect(withoutComments).not.toMatch(/!important|animation|transition|transform|@keyframes/);
  });

  it("adds no layout of its own beyond the lens row: no width/height/position/margin on cards or lanes", () => {
    rules
      .filter(({ selector }) => /recommendation-card|recommendation-lane--/.test(selector) && !/button/.test(selector))
      .forEach(({ selector, body: ruleBody }) =>
        expect(ruleBody, selector).not.toMatch(/(?:^|[;\s])(?:width|height|padding|margin|position|display|gap)\s*:/)
      );
  });
});

describe("Recommendation lenses: opt-in wiring", () => {
  it("is requested by Aurelian's Builder host only; Discovery Decants and the shared defaults never pass it", () => {
    expect(read(APP_ROOT, "src", "components", "BuilderExperience.jsx")).toMatch(/^\s+showRecommendationLenses\s*$/m);

    [read(REPOSITORY_ROOT, "src", "main.jsx"), read(REPOSITORY_ROOT, "src", "app", "DiscoveryDecantsApp.jsx")].forEach(
      (source) => expect(source).not.toContain("showRecommendationLenses")
    );
    expect(read(REPOSITORY_ROOT, "packages", "builder", "src", "builder", "DiscoveryBoxBuilder.jsx")).toContain(
      "showRecommendationLenses = false,"
    );
    expect(read(REPOSITORY_ROOT, "src", "main.jsx")).not.toMatch(/builder-recommendations/);
  });

  it("the shared stylesheet is untouched by the lens", () => {
    expect(read(REPOSITORY_ROOT, "packages", "builder", "styles.css")).not.toMatch(
      /recommendation-lens|recommendation-lane--/
    );
  });
});
