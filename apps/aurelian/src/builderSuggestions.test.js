import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const APP_ROOT = fileURLToPath(new URL("..", import.meta.url));
const REPOSITORY_ROOT = fileURLToPath(new URL("../../..", import.meta.url));
const read = (...segments) => readFileSync(join(...segments), "utf8").replace(/\r\n/g, "\n");
const strip = (css) => css.replace(/\/\*[\s\S]*?\*\//g, "");

const css = strip(read(APP_ROOT, "src", "app", "builder-suggestions.css"));
const mobileCatalog = strip(read(APP_ROOT, "src", "app", "builder-mobile-catalog.css"));
const globals = strip(read(APP_ROOT, "src", "app", "globals.css"));

// The media blocks of a stylesheet (one level deep is all this file uses), and the part outside any of them.
function split(source) {
  const blocks = [];
  let outside = "";
  let index = 0;

  while (index < source.length) {
    const at = source.indexOf("@media", index);

    if (at === -1) {
      outside += source.slice(index);
      break;
    }

    outside += source.slice(index, at);
    const open = source.indexOf("{", at);
    let depth = 1;
    let cursor = open + 1;

    while (depth > 0 && cursor < source.length) {
      if (source[cursor] === "{") depth++;
      if (source[cursor] === "}") depth--;
      cursor++;
    }

    blocks.push({ query: source.slice(at + 6, open).trim(), body: source.slice(open + 1, cursor - 1) });
    index = cursor;
  }

  return { outside, blocks };
}

const bodyOf = (source, selector) => {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+");
  const match = source.match(new RegExp(`(?:^|[},])\\s*${escaped}\\s*\\{([^}]*)\\}`));

  return match ? match[1].replace(/\s+/g, " ").trim() : "";
};

const { outside, blocks } = split(css);
const phone = blocks.find(({ query }) => query === "(max-width: 619px)");
const TAB = ".builder-page .suggestions-edge-tab";
const SHOWN = ".builder-page .mobile-builder-tabs:has(> button:first-child.is-active) + .suggestions-edge-tab";
const VER_CAJA = ".builder-page .mobile-builder-tabs:has(> button:first-child.is-active) > button:last-child";

describe("the Sugerencias edge tab (builder-suggestions.css)", () => {
  it("is not displayed at all by default, so 620px and up (tablets, landscape phones) never show it", () => {
    expect(bodyOf(outside, TAB)).toBe("display: none;");
    expect(phone).toBeDefined();
  });

  it("is shown only inside the 619px-and-below query, with the catalog tab active, as a sibling after the tab bar", () => {
    expect(bodyOf(phone.body, SHOWN)).toMatch(/display: inline-flex;/);
    expect(bodyOf(phone.body, SHOWN)).toMatch(/position: fixed;/);
    expect(outside).not.toMatch(/inline-flex/);
    expect(outside).not.toMatch(/position:\s*fixed/);
  });

  it("is independent of the tab bar's children: no :last-child / :nth-child / :first-child rule paints it", () => {
    const paintingSelectors = [...css.matchAll(/([^{}]+)\{/g)].map((match) => match[1]).filter((selector) => selector.includes("suggestions-edge-tab"));

    expect(paintingSelectors.length).toBeGreaterThan(5);
    paintingSelectors.forEach((selector) => expect(selector).not.toMatch(/:last-child\s+\+|nth-child|nth-of-type|> button:last-child\s*\+/));
    // the only structural condition on the bar is the one that already means "catalog showing"
    expect(SHOWN).not.toMatch(/last-child/);
  });

  it("mirrors Ver caja: the opposite edge, the same bottom offset and safe-area logic, the same z-index, below the header and every dialog", () => {
    const tab = bodyOf(phone.body, SHOWN);
    const caja = bodyOf(mobileCatalog, VER_CAJA) || mobileCatalog.slice(mobileCatalog.indexOf(VER_CAJA));
    const bottom = (body) => body.match(/bottom: ([^;]+);/)?.[1];

    expect(tab).toMatch(/left: -1px;/);
    expect(tab).toMatch(/border-left: 0;/);
    expect(bottom(tab)).toBe("max(120px, calc(env(safe-area-inset-bottom) + 104px))");
    expect(bottom(tab)).toBe(bottom(caja));
    expect(tab).toMatch(/z-index: 45;/);
    expect(caja).toMatch(/z-index: 45;/);
    expect(Number(globals.match(/\.site-header \{[^}]*z-index:(\d+)/)[1])).toBe(50);
  });

  it("is a slim tab: about 22px wide and 110-120px tall, a touch slimmer than Ver caja's 24px", () => {
    const tab = bodyOf(phone.body, SHOWN);
    const width = Number(tab.match(/ width: (\d+)px;/)[1]);
    const height = Number(tab.match(/min-height: (\d+)px;/)[1]);

    expect(width).toBe(22);
    expect(width).toBeLessThan(24);
    expect(height).toBeGreaterThanOrEqual(110);
    expect(height).toBeLessThanOrEqual(120);
  });

  it("leaves Ver caja's own geometry as it was", () => {
    const caja = mobileCatalog.slice(mobileCatalog.indexOf(VER_CAJA));
    const rule = caja.slice(0, caja.indexOf("}"));

    expect(rule).toMatch(/position: fixed;/);
    expect(rule).toMatch(/right: -1px;/);
    expect(rule).toMatch(/width: 24px;/);
    expect(rule).toMatch(/min-height: 96px;/);
    expect(rule).toMatch(/background: var\(--aur-burgundy\);/);
  });

  it("is quieter than Ver caja: near-black, a brass hairline, muted ivory, a low radius, and no burgundy, green or glow", () => {
    const tab = bodyOf(phone.body, SHOWN);

    expect(tab).toMatch(/background: rgba\(15, 14, 12, 0\.96\);/);
    expect(tab).toMatch(/border: 1px solid var\(--aur-intel-rim\);/);
    expect(tab).toMatch(/color: var\(--aur-intel-label\);/);
    expect(tab).toMatch(/border-radius: 0 6px 6px 0;/);
    expect(css).not.toMatch(/burgundy|#4ade80|#86efac|green|neon/i);
  });

  it("reads upward along the edge, turning only its label, with the star decorative and small", () => {
    expect(bodyOf(phone.body, ".builder-page .suggestions-edge-tab__label")).toMatch(/writing-mode: vertical-rl;/);
    expect(bodyOf(phone.body, ".builder-page .suggestions-edge-tab__label")).toMatch(/transform: rotate\(180deg\);/);
    expect(bodyOf(phone.body, ".builder-page .suggestions-edge-tab__mark")).toMatch(/font-size: 0\.625rem;/);
  });

  it("has a visible keyboard focus state", () => {
    expect(phone.body).toMatch(/suggestions-edge-tab:focus-visible \{[^}]*outline: 2px solid var\(--aur-intel-brass\);/);
  });

  it("hides BOTH edge tabs while the mobile menu is open, with enough specificity to beat the rules that show them", () => {
    const hide = phone.body.match(/(body:has\(\.mobile-menu\[open\]\)[^{]+)\{([^}]*)\}/);

    expect(hide).not.toBeNull();
    expect(hide[1]).toContain(`body:has(.mobile-menu[open]) ${SHOWN}`);
    expect(hide[1]).toContain(`body:has(.mobile-menu[open]) ${VER_CAJA}`);
    expect(hide[2]).toMatch(/display: none;/);
  });

  it("sets no z-index on the drawer or its overlay: it stays under the Builder's own dialog layer, with no escalation", () => {
    const zIndexes = [...css.matchAll(/z-index:\s*(-?\d+)/g)].map((match) => Number(match[1]));

    expect(zIndexes).toEqual([45]);
    expect(Math.max(...zIndexes)).toBeLessThan(50);
  });
});

describe("the drawer (builder-suggestions.css)", () => {
  it("is scoped to the dialogs the Builder portals to <body>, never to the page", () => {
    // a selector list's own commas, not the ones inside :is(...) / :has(...)
    const splitList = (list) => {
      const parts = [];
      let depth = 0;
      let current = "";

      for (const character of list) {
        if (character === "(") depth++;
        if (character === ")") depth--;
        if (character === "," && depth === 0) {
          parts.push(current);
          current = "";
        } else {
          current += character;
        }
      }

      return [...parts, current];
    };
    const selectors = [...outside.matchAll(/([^{}]+)\{/g)]
      .flatMap((match) => splitList(match[1]))
      .map((selector) => selector.trim())
      .filter((selector) => selector && !selector.startsWith("@") && !/^(from|to)$/.test(selector) && !/^\d+%$/.test(selector));
    const drawerSelectors = selectors.filter((selector) => !selector.startsWith(TAB));

    expect(drawerSelectors.length).toBeGreaterThan(20);
    drawerSelectors.forEach((selector) => expect(selector, selector).toMatch(/^\.builder-portal-root /));
  });

  it("hangs from the left edge, flush, and leaves a strip of scrim on the right so a tap outside closes it", () => {
    expect(bodyOf(outside, ".builder-portal-root .suggestions-overlay")).toMatch(/justify-content: flex-start;/);
    expect(bodyOf(outside, ".builder-portal-root .suggestions-overlay")).toMatch(/padding: 0;/);
    expect(bodyOf(outside, ".builder-portal-root .suggestions-drawer")).toMatch(/width: min\(24rem, calc\(100vw - 2\.5rem\)\);/);
    expect(bodyOf(outside, ".builder-portal-root .suggestions-drawer")).toMatch(/height: 100%;/);
  });

  it("uses the same near-black, brass-rimmed language as the other Aurelian dialogs", () => {
    const drawer = bodyOf(outside, ".builder-portal-root .suggestions-drawer");

    expect(drawer).toMatch(/background: var\(--aur-intel-card\);/);
    expect(drawer).toMatch(/border-right: 1px solid var\(--aur-intel-rim\);/);
    expect(bodyOf(outside, ".builder-portal-root .suggestions-overlay")).toMatch(/background: var\(--aur-intel-scrim\);/);
  });

  it("scrolls its own body, contained, and clears the phone's safe areas", () => {
    expect(bodyOf(outside, ".builder-portal-root .suggestions-body")).toMatch(/overflow-y: auto;/);
    expect(bodyOf(outside, ".builder-portal-root .suggestions-body")).toMatch(/overscroll-behavior: contain;/);
    expect(bodyOf(outside, ".builder-portal-root .suggestions-body")).toMatch(/env\(safe-area-inset-bottom\)/);
    expect(bodyOf(outside, ".builder-portal-root .suggestions-header")).toMatch(/env\(safe-area-inset-top\)/);
  });

  it("gives its close button and controls a visible focus ring", () => {
    expect(outside).toMatch(/\.suggestions-header button:focus-visible \{[^}]*outline: 2px solid var\(--aur-intel-brass\);/);
    expect(outside).toMatch(/\.recommendation-detail-trigger:focus-visible \{[^}]*outline: 2px solid var\(--aur-intel-brass\);/);
  });

  it("takes the package's green 'add' pill down to a brass-rimmed button", () => {
    const add = bodyOf(outside, ".builder-portal-root .suggestions-drawer .recommendation-actions button");

    expect(add).toMatch(/background: transparent;/);
    expect(add).toMatch(/border: 1px solid var\(--aur-intel-rim-strong\);/);
  });

  it("respects reduced motion", () => {
    const reduced = blocks.find(({ query }) => query === "(prefers-reduced-motion: reduce)");

    expect(reduced.body).toMatch(/animation: none;/);
  });
});

describe("loading and Discovery Decants safety", () => {
  it("is imported by Aurelian's layout, after the shared stylesheet and after the Ver caja rules it must mirror and out-rank", () => {
    const layout = read(APP_ROOT, "src", "app", "layout.jsx");
    const position = (file) => layout.indexOf(`import "${file}";`);

    expect(position("./builder-suggestions.css")).toBeGreaterThan(-1);
    expect(position("./builder-suggestions.css")).toBeGreaterThan(position("@discovery-box/builder/styles.css"));
    expect(position("./builder-suggestions.css")).toBeGreaterThan(position("./builder-mobile-catalog.css"));
  });

  it("the shared Builder stylesheet is frozen: it has no trace of the feature", () => {
    const shared = read(REPOSITORY_ROOT, "packages", "builder", "styles.css");

    expect(shared).not.toMatch(/suggestions-|Sugerencias/);
  });

  it("Discovery Decants' source and styles carry none of it", () => {
    for (const file of ["src/main.jsx", "src/App.css", "src/index.css", "src/merchants/discoveryDecants/config.js"]) {
      expect(read(REPOSITORY_ROOT, ...file.split("/")), file).not.toMatch(/suggestions|Sugerencias|monterrey|getTodayContext|onBoxShortcutChange/i);
    }
  });
});
