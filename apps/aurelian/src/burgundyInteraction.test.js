import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const APP_ROOT = fileURLToPath(new URL("..", import.meta.url));
const css = (name) => readFileSync(join(APP_ROOT, "src", "app", name), "utf8");
const strip = (text) => text.replace(/\/\*[\s\S]*?\*\//g, "");
const rulesOf = (text) =>
  [...strip(text).matchAll(/([^{}]+)\{([^{}]*)\}/g)]
    .map(([, selector, body]) => ({ selector: selector.trim().replace(/\s+/g, " "), body }))
    .filter(({ selector }) => !selector.startsWith("@"));

const globals = css("globals.css");
const zoning = css("builder-zoning.css");
const hero = css("landing-hero.css");

const rule = (text, selector) => rulesOf(text).find((candidate) => candidate.selector === selector)?.body ?? "";

describe("burgundy interaction language: tokens", () => {
  it("defines the burgundy family once, Aurelian-global, from the values the Builder already used", () => {
    const root = rulesOf(globals).filter(({ selector }) => selector === ":root").map(({ body }) => body).join(";");

    expect(root).toContain("--aur-burgundy: #4a0f1f;");
    expect(root).toContain("--aur-burgundy-lift: #8a344a;");
    expect(root).toContain("--aur-burgundy-line: rgba(138, 52, 74, 0.14);");
    expect(root).toContain("--aur-burgundy-rim: rgba(138, 52, 74, 0.5);");
    expect(root).toContain("--aur-burgundy-wash: rgba(74, 15, 31, 0.6);");
    expect(root).toContain("--aur-burgundy-glow: rgba(74, 15, 31, 0.4);");
    expect(root).toContain("--aur-ivory: #e7ddcf;");
  });

  it("is not redeclared anywhere else, so there is no second copy to drift", () => {
    ["builder-zoning.css", "landing-hero.css", "site-header.css", "builder-header.css", "builder-intro.css", "builder-geometry.css"].forEach((name) => {
      expect(strip(css(name)), name).not.toMatch(/--aur-(?:burgundy|ivory)[\w-]*\s*:/);
    });
  });

  it("never uses burgundy as text: wash, rim, underline and glow only", () => {
    [globals, zoning, hero].forEach((text) => {
      rulesOf(text).forEach(({ selector, body }) => {
        [...body.matchAll(/(?:^|[;\s])color:\s*([^;]+);/g)].forEach((match) => {
          expect(match[1], `${selector} color`).not.toMatch(/aur-burgundy|#4a0f1f|#8a344a|74,\s*15,\s*31|138,\s*52,\s*74/i);
        });
      });
    });
  });
});

describe("burgundy interaction language: the three approved controls", () => {
  const hover = ".desktop-nav a:not([aria-current=\"page\"]):hover";
  const focus = ".desktop-nav a:not([aria-current=\"page\"]):focus-visible";

  const navRules = () => rulesOf(globals).filter(({ selector }) => selector.includes(':not([aria-current="page"])'));
  const textRule = () => navRules().find(({ selector }) => !selector.includes("::after"));
  const underlineRule = () => navRules().find(({ selector }) => selector.includes("::after"));

  it("inactive nav hover and keyboard focus get the same burgundy treatment", () => {
    expect(navRules()).toHaveLength(2);
    expect(textRule().selector).toBe(`${hover}, ${focus}`);
    expect(textRule().body).toMatch(/color:\s*var\(--aur-ivory\);/);
    expect(textRule().body).toMatch(/text-shadow:\s*0 0 14px var\(--aur-burgundy-rim\);/);

    expect(underlineRule().selector).toBe(`${hover}::after, ${focus}::after`);
    expect(underlineRule().body).toMatch(/background:\s*var\(--aur-burgundy-lift\);/);
    expect(underlineRule().body).toMatch(/opacity:\s*1;/);
  });

  it("leaves the ACTIVE route brass: the burgundy rules exclude it, and its own brass rules are untouched", () => {
    navRules().forEach(({ selector }) => expect(selector).toContain(':not([aria-current="page"])'));

    expect(strip(globals)).toContain('.desktop-nav a:hover,.desktop-nav a[aria-current="page"],.text-link:hover { color:var(--gold); }');
    expect(strip(globals)).toContain('.desktop-nav a[aria-current="page"]::after { opacity:1; transform:scaleX(1); }');
    expect(strip(globals)).toContain("background:var(--gold)");
  });

  it("changes no geometry or type on the nav: no size, spacing, font or casing property in the new rules", () => {
    navRules().forEach(({ selector, body }) => {
      expect(body, selector).not.toMatch(/(?:^|[;\s])(?:width|height|min-height|padding[\w-]*|margin[\w-]*|gap|font[\w-]*|letter-spacing|text-transform|line-height|display|position)\s*:/);
    });
  });

  it("gives Home 'Explora el catálogo' a burgundy hover and focus: oxblood wash, burgundy rim, faint glow, ivory text kept", () => {
    const hoverRule = rulesOf(hero).find(({ selector }) => selector.startsWith(".aurelian-hero-stage .button--outline:hover"));
    expect(hoverRule.selector).toContain(".aurelian-hero-stage .button--outline:focus-visible");
    expect(hoverRule.body).toMatch(/border-color:\s*var\(--aur-burgundy-lift\);/);
    expect(hoverRule.body).toMatch(/background:\s*var\(--aur-burgundy-wash\);/);
    expect(hoverRule.body).toMatch(/box-shadow:\s*0 0 16px var\(--aur-burgundy-glow\);/);
    expect(hoverRule.body).not.toMatch(/(?:^|[;\s])color:/);
    // resting state and geometry are as approved; no brass tint left on its hover
    expect(rule(hero, ".aurelian-hero-stage .button--outline")).toMatch(/background:\s*rgba\(8, 7, 7/);
    expect(rule(hero, ".aurelian-hero-stage .button--outline")).toMatch(/color:\s*#e7ddcf;/);
    expect(hoverRule.body).not.toMatch(/200,\s*166,\s*101/);
  });

  it("gives the Builder 'Explorar por nota' a burgundy hover and focus, scoped to the one control that is exactly that", () => {
    const selector = ".builder-page .compose-box-header-actions button.secondary:hover, .builder-page .compose-box-header-actions button.secondary:focus-visible";
    const body = rule(zoning, selector);

    expect(body).toMatch(/border-color:\s*var\(--aur-burgundy-rim\);/);
    expect(body).toMatch(/background:\s*var\(--aur-burgundy-wash\);/);
    expect(body).toMatch(/box-shadow:\s*0 0 14px var\(--aur-burgundy-glow\);/);
    expect(body).not.toMatch(/(?:^|[;\s])color:/);
    // the shared secondary rule (also "Descargar PNG") keeps its brass hover, untouched
    expect(rule(zoning, ".builder-page .compose-box-header-actions button.secondary:hover, .builder-page .share-box-buttons button:first-child:hover:not(:disabled)")).toMatch(/169,\s*130,\s*79/);
    // the primary stays brass: nothing here targets the non-secondary button
    expect(strip(zoning)).not.toMatch(/compose-box-header-actions button:not\(\.secondary\)/);
  });

  it("does not recolor anything else: the burgundy interaction tokens appear only in the three approved places", () => {
    const interactionTokens = /aur-burgundy-(?:wash|glow|rim|lift)/;
    const users = ["builder-zoning.css", "landing-hero.css", "globals.css", "site-header.css", "builder-header.css", "builder-geometry.css", "builder-intro.css", "contact-page.css", "landing-closing.css", "landing-how-it-works.css", "landing-seasons.css", "landing-video.css", "catalog-seasons.css", "catalog-controls.css"]
      .filter((name) => interactionTokens.test(strip(css(name))));

    expect(users.sort()).toEqual(["builder-zoning.css", "globals.css", "landing-hero.css"]);
  });

  it("adds no new motion: no transition or animation in the new rules, so reduced-motion behavior is as it was", () => {
    [globals, zoning, hero].forEach((text) => {
      rulesOf(text)
        .filter(({ body }) => /aur-burgundy-(?:wash|glow|rim|lift)/.test(body))
        .forEach(({ selector, body }) => expect(body, selector).not.toMatch(/transition|animation/));
    });
  });
});
