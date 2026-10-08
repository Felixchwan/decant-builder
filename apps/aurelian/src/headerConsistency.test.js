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
