import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const APP_DIR = fileURLToPath(new URL("./app/", import.meta.url));
const strip = (css) => css.replace(/\/\*[\s\S]*?\*\//g, "");
const cssFiles = readdirSync(APP_DIR).filter((name) => name.endsWith(".css"));
const read = (name) => strip(readFileSync(join(APP_DIR, name), "utf8"));

// The Builder owns its own (identical) header geometry; every other stylesheet is a
// route or feature file that must not size the shared bar.
const BUILDER_OWNED = new Set(["builder-header.css"]);

describe("one site-header height on every primary route", () => {
  it("defines the desktop height once, in globals.css, at the same 4.25rem the Home bar always had", () => {
    const globals = read("globals.css");
    expect(globals).toMatch(/@media \(min-width:981px\) \{ :root \{ --site-header-height:4\.25rem; \} \}/);
    expect(globals).toMatch(/\.site-header__inner \{[^}]*min-height:var\(--site-header-height\)/);
  });

  it("lets no route or feature stylesheet set the shared header's height variable", () => {
    cssFiles
      .filter((name) => name !== "globals.css" && !BUILDER_OWNED.has(name))
      .forEach((name) => {
        expect(read(name), name).not.toMatch(/--site-header-height\s*:/);
      });
  });

  it("lets no route or feature stylesheet resize or re-pad the shared header bar", () => {
    cssFiles
      .filter((name) => name !== "globals.css" && !BUILDER_OWNED.has(name))
      .forEach((name) => {
        const rules = [...read(name).matchAll(/([^{}]+)\{([^{}]*)\}/g)];
        rules
          // Pseudo-elements (the landing's 1px hairline) decorate the bar; they don't size it.
          .filter(([, selector]) => /\.site-header(?:__inner)?(?![\w-])/.test(selector) && !/::/.test(selector))
          .forEach(([, selector, body]) => {
            expect(body, `${name}: ${selector.trim()}`).not.toMatch(/(?:^|[;\s])(?:height|min-height|max-height|padding[\w-]*)\s*:/);
          });
      });
  });
});

describe("one site-header skin on every primary route (the Home header is the reference)", () => {
  const skin = read("site-header.css");
  const rules = [...skin.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(([, selector, body]) => ({ selector: selector.trim(), body }));
  const SCOPE = ".site-header:not(:has(.site-header__inner--builder))";
  const rule = (selector) => rules.find((candidate) => candidate.selector === `${SCOPE} ${selector}`)?.body ?? "";

  it("is loaded by the layout after the global header defaults", () => {
    const layout = readFileSync(join(APP_DIR, "layout.jsx"), "utf8");
    expect(layout.indexOf('import "./site-header.css";')).toBeGreaterThan(layout.indexOf('import "./globals.css";'));
  });

  it("is one shared system: every rule hangs off the same non-Builder header scope, none off a route", () => {
    expect(rules.length).toBeGreaterThan(6);
    rules.forEach(({ selector }) => {
      expect(selector.startsWith(SCOPE), selector).toBe(true);
      expect(selector, selector).not.toMatch(/body:has|aurelian-hero|contact|catalog|como-funciona|landing|builder-page|:root/);
    });
    expect(skin).not.toContain("!important");
  });

  it("gives the nav the Home treatment: small, tracked, uppercase, with the focus underline", () => {
    const nav = rule(".desktop-nav a");
    expect(nav).toMatch(/font-size:\s*0\.72rem;/);
    expect(nav).toMatch(/letter-spacing:\s*0\.16em;/);
    expect(nav).toMatch(/text-transform:\s*uppercase;/);
    expect(rule(".desktop-nav a:focus-visible::after")).toMatch(/opacity:\s*1;/);
  });

  it("gives the header CTA the Home outlined treatment, never the filled brass button", () => {
    const cta = rule(".desktop-cta");
    expect(cta).toMatch(/background:\s*transparent;/);
    expect(cta).toMatch(/border-color:\s*rgba\(200, 166, 101, 0\.5\);/);
    expect(cta).toMatch(/border-radius:\s*8px;/);
    expect(cta).toMatch(/color:\s*var\(--gold\);/);
    expect(cta).toMatch(/font-size:\s*0\.72rem;/);
    expect(cta).toMatch(/letter-spacing:\s*0\.14em;/);
    expect(cta).toMatch(/text-transform:\s*uppercase;/);
    expect(rule(".desktop-cta:hover")).toMatch(/background:\s*rgba\(200, 166, 101, 0\.12\);/);
  });

  it("is skin only: no size, spacing or position on the bar, the links or the CTA (the 1px hairline aside)", () => {
    rules
      .filter(({ selector }) => !selector.endsWith("::after") || selector.includes(".desktop-nav"))
      .forEach(({ selector, body }) => {
        expect(body, selector).not.toMatch(/(?:^|[;\s])(?:width|height|min-height|max-height|padding[\w-]*|margin[\w-]*|gap|display|position)\s*:/);
      });
    expect(skin).not.toMatch(/@media/);
  });

  it("changes casing in CSS only: the link labels in the header component are unchanged", () => {
    const header = readFileSync(join(APP_DIR, "..", "components", "SiteHeader.jsx"), "utf8");
    ['["/", "Inicio"]', '["/como-funciona", "Cómo funciona"]', '["/catalogo", "Catálogo"]', '["/contacto", "Contacto"]', ">Construye tu caja<"].forEach((label) => expect(header).toContain(label));
    expect(header).not.toMatch(/toUpperCase|INICIO|CATÁLOGO/);
  });
});
