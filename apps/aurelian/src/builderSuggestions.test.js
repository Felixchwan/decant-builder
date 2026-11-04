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

  it("keeps the weather credit line small, muted and last, with a visible focus ring on its link", () => {
    const line = bodyOf(outside, ".builder-portal-root .suggestions-attribution");

    expect(line).toMatch(/font-size: 0\.6875rem;/);
    expect(line).toMatch(/color: var\(--aur-intel-ink-muted\);/);
    expect(line).toMatch(/border-top: 1px solid var\(--aur-intel-hair\);/);
    expect(outside).toMatch(/\.suggestions-attribution a:focus-visible \{[^}]*outline: 2px solid var\(--aur-intel-brass\);/);
  });

  it("respects reduced motion", () => {
    const reduced = blocks.find(({ query }) => query === "(prefers-reduced-motion: reduce)");

    expect(reduced.body).toMatch(/animation: none;/);
  });
});

describe("the desktop opener in the docked rack's centre (builder-suggestions.css)", () => {
  const desktop = blocks.find(({ query }) => query === "(min-width: 981px)");
  const SLOT = "#aurelian-builder-summary-slot";
  const BTN = `${SLOT} .box-center-suggestions`;
  // rules inside the desktop query, with nested at-rules (keyframes, reduced motion) taken out of the way
  const nested = split(desktop.body);
  const flat = nested.outside;
  const reduced = nested.blocks.find(({ query }) => query === "(prefers-reduced-motion: reduce)");

  it("exists only in the desktop query: 981px and up, the breakpoint at which the Builder docks the box summary", () => {
    expect(desktop).toBeDefined();
    expect(outside).not.toContain("box-center-suggestions");
    expect(phone.body).not.toContain("box-center-suggestions");
  });

  it("every rule is scoped to the docked rack in the header slot, never to the page, the inline panel, the tablet rack or the Collection Card", () => {
    const selectors = [...flat.matchAll(/([^{}]+)\{/g)].map((match) => match[1].trim()).filter((selector) => selector && !selector.startsWith("@") && !/^(\d+%|from|to|0%,\s*100%)/.test(selector));

    expect(selectors.length).toBeGreaterThan(8);
    selectors.forEach((selector) => expect(selector, selector).toMatch(/^#aurelian-builder-summary-slot /));
    expect(desktop.body).not.toMatch(/\.collection-card|\.builder-portal-root|\.mobile-|\.builder-page/);
  });

  it("is one button filling the channel: absolutely placed inside it, so it consumes no room and shifts no vial", () => {
    expect(bodyOf(flat, `${SLOT} .box-center-channel:has(> .box-center-suggestions)`)).toMatch(/position: relative;/);
    expect(bodyOf(flat, BTN)).toMatch(/position: absolute;/);
    expect(bodyOf(flat, BTN)).toMatch(/inset: 0;/);
    expect(bodyOf(flat, BTN)).toMatch(/overflow: hidden;/); // the glow stays inside the channel
    expect(bodyOf(flat, BTN)).toMatch(/cursor: pointer;/);
  });

  it("both text layers fill the same box and are swapped by opacity alone", () => {
    for (const layer of ["rest", "hint"]) {
      expect(flat).toContain(`${SLOT} .box-center-suggestions__${layer}`);
    }

    const shared = bodyOf(flat, `${SLOT} .box-center-suggestions__rest,\n  ${SLOT} .box-center-suggestions__hint`) || flat.match(/__rest,\s*#aurelian-builder-summary-slot \.box-center-suggestions__hint \{([^}]*)\}/)?.[1];

    expect(shared).toMatch(/position: absolute;/);
    expect(shared).toMatch(/inset: 0;/);
    expect(shared).not.toMatch(/writing-mode|transform/); // neither layer inherits a rotation
    expect(flat).toMatch(/__hint \{[^}]*opacity: 0;/);
  });

  it("the invitation reads HORIZONTALLY: no rotation, no vertical writing mode, a readable size, wrapped inside the channel", () => {
    const hint = flat.match(/\.box-center-suggestions__hint \{(\s*padding:[^}]*)\}/)[1]; // the hint's own rule (the shared layer rule is tested above)
    const rest = flat.match(/\.box-center-suggestions__rest \{(\s*line-height:[^}]*)\}/)[1];

    expect(hint).not.toMatch(/writing-mode|transform|rotate|text-orientation/);
    expect(flat.match(/writing-mode: vertical-rl;/g)).toHaveLength(1); // only the star's rule keeps it, exactly as at rest before
    expect(rest).toMatch(/writing-mode: vertical-rl;/);
    expect(rest).toMatch(/transform: rotate\(180deg\);/);
    expect(hint).toMatch(/font-size: 0\.5625rem;/); // 9px: the same size as the word in the glowing slot, not shrunk to force one line
    expect(hint).toMatch(/line-height: 1\.35;/);
    expect(hint).toMatch(/padding: 8px 0;/);
    expect(hint).toMatch(/overflow-wrap: break-word;/);
    expect(hint).toMatch(/color: var\(--text\);/); // warm ivory
    expect(hint).not.toMatch(/white-space: nowrap/);
  });

  it("the hover and focus rules change opacity, a hairline, an outline and the plus's own breathing only: nothing that could move or resize anything", () => {
    const stateRules = [...flat.matchAll(/([^{}]*:is\(:hover, :focus-visible\)[^{}]*|[^{}]*:focus-visible[^{}]*)\{([^}]*)\}/g)];

    expect(stateRules.length).toBeGreaterThanOrEqual(3);

    for (const [, selector, body] of stateRules) {
      const properties = [...body.matchAll(/([a-z-]+):/g)].map((match) => match[1]);

      properties.forEach((property) => expect(["opacity", "box-shadow", "outline", "outline-offset", "animation"], `${selector.trim()} -> ${property}`).toContain(property));
    }
  });

  it("shows the invitation in the centre on hover or focus-visible of the centre OR of the labelled slot, never on hover alone: the name is the aria-label", () => {
    const tray = ":has\\(\\.box-vial\\.has-suggestions-label:is\\(:hover, :focus-visible\\)\\)";

    expect(flat).toMatch(/__hint \{[^}]*opacity: 0;/);
    expect(flat).toMatch(new RegExp(`:is\\(:hover, :focus-visible\\) \\.box-center-suggestions__rest,\\s*#aurelian-builder-summary-slot \\.box-slot-tray${tray} \\.box-center-suggestions__rest \\{\\s*opacity: 0;`));
    expect(flat).toMatch(new RegExp(`:is\\(:hover, :focus-visible\\) \\.box-center-suggestions__hint,\\s*#aurelian-builder-summary-slot \\.box-slot-tray${tray} \\.box-center-suggestions__hint \\{\\s*opacity: 1;`));
    expect(flat).toMatch(/\.box-center-suggestions:focus-visible \{\s*outline: 2px solid/);
  });

  it("at rest the centre is only a star with a faint halo and the glowing next slot keeps its plus; the word is laid over the plus, hidden until hover or focus", () => {
    const mark = bodyOf(flat, `${SLOT} .box-center-suggestions__mark`);
    const word = bodyOf(flat, `${SLOT} .box-vial.has-suggestions-label .vial-suggestions-label`);

    expect(mark).toMatch(/font-size: 1rem;/);
    expect(mark).toMatch(/text-shadow: 0 0 7px color-mix\(in srgb, var\(--gold\) 30%, transparent\);/);
    expect(flat).not.toContain("box-center-suggestions__label");
    expect(flat).not.toMatch(/\.empty-slot-add \{\s*display: none;/); // the plus is never removed from layout, only faded on hover and focus
    expect(word).toMatch(/position: absolute;\s*inset: 0;/); // laid over the plus's own box: nothing can shift
    expect(word).toMatch(/opacity: 0;/); // invisible at rest
    expect(word).toMatch(/font-size: 0\.5625rem;/);
    expect(word).toMatch(/text-transform: uppercase;/);
    expect(word).toMatch(/white-space: nowrap;/);
    expect(word).toMatch(/pointer-events: none;/);
    expect(word).toMatch(/text-shadow: 0 0 6px/); // a small halo, not a bloom
  });

  it("does not restyle or resize the glowing slot itself: on hover or focus its plus fades and the word fades in, and its focus ring takes the brass", () => {
    const slotRules = [...flat.matchAll(/([^{}]*\.box-vial\.has-suggestions-label[^{}]*)\{([^}]*)\}/g)].map((match) => ({ selector: match[1].trim(), body: match[2] }));
    const ownRules = slotRules.filter(({ selector }) => !selector.includes("box-center-suggestions") && !selector.includes(".vial-suggestions-label")); // the word's own rules are tested above and below

    expect(ownRules.map(({ selector }) => selector.replace(`${SLOT} `, ""))).toEqual([
      ".box-vial.has-suggestions-label:is(:hover, :focus-visible) .empty-slot-add",
      ".box-vial.has-suggestions-label:focus-visible",
    ]);
    ownRules.forEach(({ selector, body }) => expect(body, selector).not.toMatch(/\b(width|height|min-width|min-height|padding|margin|transform|position|display)\s*:/));
    expect(bodyOf(flat, `${SLOT} .box-vial.has-suggestions-label:is(:hover, :focus-visible) .empty-slot-add`)).toMatch(/animation: none;\s*opacity: 0;/);
    expect(bodyOf(flat, `${SLOT} .box-vial.has-suggestions-label:is(:hover, :focus-visible) .vial-suggestions-label`)).toBe("opacity: 1;");
    expect(bodyOf(flat, `${SLOT} .box-vial.has-suggestions-label:focus-visible`)).toMatch(/outline: 2px solid color-mix\(in srgb, var\(--gold\) 80%, transparent\);/);
  });

  it("is restrained: a low-alpha brass wash, a small slow breathing layer, no neon, green, burgundy or heavy blur", () => {
    expect(desktop.body).toMatch(/color-mix\(in srgb, var\(--gold\) 9%, transparent\)/);
    expect(desktop.body).not.toMatch(/burgundy|green|neon|#4ade80|blur\(|filter:/i);
    expect(desktop.body).toMatch(/animation: aur-center-breathe 9s ease-in-out infinite;/);
    expect(desktop.body).toMatch(/50% \{\s*opacity: 0\.55;/);
    expect(desktop.body).not.toMatch(/infinite[^;]*\b[1-3]s\b|animation:[^;]*\b[0-3](\.\d+)?s\b/); // nothing fast
  });

  it("removes the autonomous animation for reduced motion, and the transitions with it", () => {
    expect(reduced).toBeDefined();
    expect(reduced.body).toMatch(/::after \{\s*animation: none;/);
    expect(reduced.body).toMatch(/transition: none;/);
  });

  it("uses the page's own tokens (the header is outside .builder-page), and never the Builder-scoped ones that would be undefined there", () => {
    expect(desktop.body).toContain("var(--gold)");
    expect(desktop.body).not.toContain("--aur-intel-");
  });

  it("is untouched by the phone rules: the phone tab and Ver caja keep their own", () => {
    expect(phone.body).toContain("suggestions-edge-tab");
    expect(desktop.body).not.toContain("suggestions-edge-tab");
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
