import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const APP_ROOT = fileURLToPath(new URL("..", import.meta.url));
const REPOSITORY_ROOT = fileURLToPath(new URL("../../..", import.meta.url));
const read = (...segments) => readFileSync(join(...segments), "utf8").replace(/\r\n/g, "\n");

const css = read(APP_ROOT, "src", "app", "builder-recommendations.css");
const sharedCss = read(REPOSITORY_ROOT, "packages", "builder", "styles.css");
const zoning = read(APP_ROOT, "src", "app", "builder-zoning.css");
const withoutComments = css.replace(/\/\*[\s\S]*?\*\//g, "");
const rules = [...withoutComments.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
  .map((match) => ({
    selector: match[1].replace(/\s+/g, " ").trim(),
    body: match[2].replace(/\s+/g, " ").trim(),
  }))
  .filter(({ selector }) => !selector.startsWith("@"));
const body = (selector) => rules.find((rule) => rule.selector === selector)?.body;

const VERSATILITY = ".builder-page .recommendation-lane--versatility";
const AFFINITY = ".builder-page .recommendation-lane--affinity";
const HOVER_TRIGGER = ".recommendation-detail-trigger:is(:hover, :focus-visible)";
const TIERS = ["--lens-hair", "--lens-top", "--lens-hover", "--lens-control-hair"];

// ---- colour helpers: judge intensity by perceived brightness, not by raw alpha ----------------------
const GROUND = [9, 10, 9]; // --bg, the near-black every Builder surface sits on
const channel = (value) => {
  const v = value / 255;
  return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
};
const luminance = ([r, g, b]) => 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
const over = (rgb, alpha) => rgb.map((value, index) => value * alpha + GROUND[index] * (1 - alpha));
const rgbaOf = (text) => {
  const match = text.match(/rgba\((\d+), (\d+), (\d+), ([\d.]+)\)/);
  return { rgb: match.slice(1, 4).map(Number), alpha: Number(match[4]) };
};
// a lens token's own colour, e.g. "--lens-hover: rgba(150, 58, 80, 0.55);"
const tokenLum = (lensBody, token) => {
  const { rgb, alpha } = rgbaOf(lensBody.match(new RegExp(`${token}: rgba\\([^)]*\\)`))[0]);
  return luminance(over(rgb, alpha));
};

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
      // top-level comma-separated selectors only (commas inside :is(...) belong to one selector)
      selector.split(/,(?![^(]*\))/).forEach((part) => expect(part.trim(), part).toMatch(/^\.builder-page /))
    );
  });

  it("gives each lens its own hue: brass for versatility, burgundy for affinity, at rest and on hover", () => {
    expect(body(VERSATILITY)).toContain("--lens-label-text: var(--gold);");
    expect(body(VERSATILITY)).toContain("--lens-hover: rgba(200, 166, 101, 0.26);");
    expect(body(AFFINITY)).toContain("--lens-hover: rgba(150, 58, 80, 0.55);");
    expect(body(AFFINITY)).toContain("--lens-wash: var(--aur-burgundy-wash);");
    expect(body(AFFINITY)).toMatch(/--lens-hair: rgba\(138, 52, 74,/);
    // the two lenses never share a colour in any tier
    TIERS.forEach((token) =>
      expect(body(VERSATILITY).match(new RegExp(`${token}:[^;]+;`))[0]).not.toBe(
        body(AFFINITY).match(new RegExp(`${token}:[^;]+;`))[0]
      )
    );
  });

  it("keeps burgundy off text except the one readable interactive token on the small control glyphs", () => {
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

  it("recolors the carousel controls per lens without touching size, hit area, disabled state or the counter", () => {
    const resting = `${VERSATILITY} .recommendation-carousel-controls button, ${AFFINITY} .recommendation-carousel-controls button`;
    const hover = rules.find(({ selector }) => selector.includes(":not(:disabled):hover"));

    expect(body(resting)).toMatch(/border-color: var\(--lens-control-hair\);/);
    expect(body(resting)).toMatch(/color: var\(--lens-control-text\);/);
    expect(body(resting)).not.toMatch(/width|height|padding|min-|margin|font|cursor|opacity|pointer-events/);
    // hover and keyboard focus apply to enabled controls only, for both lenses
    expect(hover.selector).toContain(`${VERSATILITY} .recommendation-carousel-controls button:not(:disabled):hover`);
    expect(hover.selector).toContain(`${AFFINITY} .recommendation-carousel-controls button:not(:disabled):focus-visible`);
    expect(hover.body).toMatch(/border-color: var\(--lens-hover\);/);
    rules
      .filter(({ selector }) => selector.includes("recommendation-carousel-controls"))
      .forEach(({ selector }) =>
        selector
          .split(",")
          .forEach((part) => expect(part, part).toMatch(/recommendation-lane--(versatility|affinity)/))
      );
    expect(withoutComments).not.toMatch(/recommendation-carousel-controls span/);
  });

  it("leaves confidence badges and !important alone", () => {
    expect(withoutComments).not.toMatch(/recommendation-confidence/);
    expect(withoutComments).not.toMatch(/!important/);
  });

  it("adds no layout of its own beyond the lens row: no width/height/position/margin/padding on the card", () => {
    rules
      .filter(({ selector }) => /recommendation-card|recommendation-lane--/.test(selector) && !/button/.test(selector))
      .forEach(({ selector, body: ruleBody }) =>
        expect(ruleBody, selector).not.toMatch(/(?:^|[;\s])(?:width|height|padding|margin|position|display|gap)\s*:/)
      );
  });
});

describe("Recommendation rim intensity: the catalog perfume-card hover is the ceiling", () => {
  const CARD = `${VERSATILITY} .recommendation-card, ${AFFINITY} .recommendation-card`;
  const HOVER_CARD = `${VERSATILITY} .recommendation-card:has(${HOVER_TRIGGER}), ${AFFINITY} .recommendation-card:has(${HOVER_TRIGGER})`;

  // The catalog card as Aurelian paints it: the host's burgundy "oxblood illumination" hover (builder-zoning.css,
  // which overrides the shared brass hover) is the number every tier below is measured against.
  const cardHover = zoning.match(/\.builder-page \.perfume-card:hover,\s*\.builder-page \.perfume-card:focus-within \{[^}]*\}/)[0];
  const cardRest = zoning.match(/\.builder-page \.perfume-card \{[^}]*\}/)[0];
  const hoverRim = rgbaOf(cardHover.match(/border-color: rgba\([^)]*\)/)[0]);
  const restRim = rgbaOf(cardRest.match(/border-color: rgba\([^)]*\)/)[0]);
  const cardHoverShadow = cardHover.match(/0 (\d+)px (\d+)px rgba\(0, 0, 0, ([\d.]+)\)/);
  const ceiling = luminance(over(hoverRim.rgb, hoverRim.alpha));
  const cardRestLum = luminance(over(restRim.rgb, restRim.alpha));

  it("reads the real catalog-card hover: a burgundy rim at 55% with a dark drop shadow, over a 10% rest hairline", () => {
    expect([...hoverRim.rgb, hoverRim.alpha]).toEqual([150, 58, 80, 0.55]);
    expect(cardHoverShadow.slice(1).map(Number)).toEqual([18, 40, 0.35]);
    expect(restRim.alpha).toBe(0.1);
    expect(ceiling).toBeCloseTo(0.035, 3);
  });

  it("rest is a quiet hairline and a faint top rim, with no persistent glow", () => {
    const rest = body(CARD);

    expect(rest).toContain("border-color: var(--lens-hair);");
    expect(rest).toMatch(/box-shadow: inset 0 1px 0 var\(--lens-top\);/);
    // nothing but the inset rim: no outer blur at rest
    expect(rest.match(/box-shadow:[^;]+;/)[0]).not.toMatch(/\b0 0 \d+px|,\s*\d+px \d+px|,\s*0 \d+px/);
    expect(withoutComments).not.toMatch(/--lens-glow/);
    [VERSATILITY, AFFINITY].forEach((lens) => {
      expect(tokenLum(body(lens), "--lens-hair"), lens).toBeLessThan(tokenLum(body(lens), "--lens-top"));
      expect(tokenLum(body(lens), "--lens-top"), lens).toBeLessThan(tokenLum(body(lens), "--lens-hover"));
      // rest stays within a few times the catalog card's own resting hairline: never "selected-looking"
      expect(tokenLum(body(lens), "--lens-hair"), lens).toBeLessThan(cardRestLum * 3);
    });
  });

  it("every tier of both hues is bounded by the catalog-card hover, in perceived brightness", () => {
    TIERS.forEach((token) =>
      [VERSATILITY, AFFINITY].forEach((lens) =>
        expect(tokenLum(body(lens), token), `${lens} ${token}`).toBeLessThanOrEqual(ceiling + 1e-9)
      )
    );
    // the hover tier is the top of each ladder: at the card's own level (never above, and not far below)
    [VERSATILITY, AFFINITY].forEach((lens) => {
      expect(tokenLum(body(lens), "--lens-hover"), lens).toBeGreaterThan(ceiling * 0.9);
      expect(tokenLum(body(lens), "--lens-hover"), lens).toBeLessThanOrEqual(ceiling);
    });
  });

  it("the two hues sit at the same perceived brightness in every tier: they differ by hue and label, not by strength", () => {
    ["--lens-hair", "--lens-top", "--lens-hover"].forEach((token) => {
      const brass = tokenLum(body(VERSATILITY), token);
      const burgundy = tokenLum(body(AFFINITY), token);

      expect(Math.abs(brass - burgundy) / Math.max(brass, burgundy), token).toBeLessThan(0.1);
    });
  });

  it("hover / keyboard focus rises only when the perfume (the details button) is hovered or focused", () => {
    const hoverRule = rules.find(({ selector }) => selector === HOVER_CARD);

    expect(hoverRule, "hover rule").toBeTruthy();
    expect(hoverRule.body).toContain("border-color: var(--lens-hover);");
    expect(hoverRule.body).toMatch(/inset 0 1px 0 var\(--lens-hover\)/);
    // a soft dark shadow no larger than the catalog card's; never a coloured glow
    const shadow = hoverRule.body.match(/0 (\d+)px (\d+)px rgba\(0, 0, 0, ([\d.]+)\)/);
    expect(Number(shadow[1])).toBeLessThanOrEqual(Number(cardHoverShadow[1]));
    expect(Number(shadow[2])).toBeLessThanOrEqual(Number(cardHoverShadow[2]));
    expect(Number(shadow[3])).toBeLessThanOrEqual(Number(cardHoverShadow[3]));
    expect(hoverRule.body).not.toMatch(/--lens-(?:glow|rim)|rgba\((?!0, 0, 0)/);
  });

  it("gives feedback without moving anything: no lift or transform (the catalog card lifts 4px; this one must not shift the Add button), and no longer than the card's 180ms", () => {
    expect(withoutComments).not.toMatch(/transform|translate|scale\(/);
    expect(body(CARD)).toMatch(/transition:\s*border-color 180ms ease,\s*box-shadow 180ms ease;/);
    // the catalog card's own transition is 180ms on the same two properties (plus the lift this card does not do)
    expect(sharedCss).toMatch(/\.perfume-card \{[^}]*transition: transform 180ms ease, border-color 180ms ease, box-shadow 180ms ease;/);
    // and it respects reduced motion
    expect(withoutComments).toMatch(/@media \(prefers-reduced-motion: reduce\)/);
    expect(withoutComments).toMatch(/transition: none;/);
  });

  it("underlines the name on hover/focus as a second, colour-independent cue", () => {
    const underline = rules.find(({ selector }) => selector.includes(`${HOVER_TRIGGER} strong`));

    expect(underline.selector).toContain(VERSATILITY);
    expect(underline.selector).toContain(AFFINITY);
    expect(underline.body).toMatch(/text-decoration: underline;/);
    expect(underline.body).not.toMatch(/font-size|padding|margin|display/);
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

  it("the shared stylesheet is untouched by the lens or the details trigger", () => {
    expect(sharedCss).not.toMatch(/recommendation-lens|recommendation-lane--|recommendation-detail-trigger/);
  });
});
