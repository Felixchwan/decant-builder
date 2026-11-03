import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const APP_ROOT = fileURLToPath(new URL("..", import.meta.url));
const REPOSITORY_ROOT = fileURLToPath(new URL("../../..", import.meta.url));
const read = (...segments) => readFileSync(join(...segments), "utf8");

const css = read(APP_ROOT, "src", "app", "builder-mobile-catalog.css");
const stripped = css.replace(/\/\*[\s\S]*?\*\//g, "");

// Every rule of this sheet sits inside an @media block (checked below), and none nests deeper, so a block is
// `@media (query) { rule { declarations } rule { ... } }`.
const blocks = [...stripped.matchAll(/@media\s*([^{]+)\{((?:[^{}]*\{[^{}]*\})+)\s*\}/g)].map(([, query, body]) => ({
  query: query.trim(),
  rules: [...body.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(([, selector, declarations]) => ({
    selector: selector.trim().replace(/\s+/g, " "),
    declarations,
  })),
}));
// The sheet has two sections, both for phones: the compact card, then the Ver caja tab.
const [cards, shortcut] = blocks;
const bodyOf = (block, selector) =>
  block.rules.filter((rule) => rule.selector === selector).map((rule) => rule.declarations).join(" ");
const sizeOf = (declarations, property) => Number(declarations.match(new RegExp(`${property}:\\s*(-?[\\d.]+)px`))?.[1]);

const GRID = ".builder-page .catalog-grid";
const CARD = `${GRID} .perfume-card`;
const ACTIONS = `${GRID} .perfume-card-compact-actions`;
const PILL_NAV = ".builder-page .mobile-builder-tabs:has(> button:first-child.is-active)";
const PILL = `${PILL_NAV} > button:last-child`;

describe("Aurelian phone catalog: compact two-column cards and the Ver caja edge tab (host-owned, presentation-only)", () => {
  it("is loaded by Aurelian's own layout, after the shared package stylesheet", () => {
    const layout = read(APP_ROOT, "src", "app", "layout.jsx");
    expect(layout).toContain('import "./builder-mobile-catalog.css";');
    expect(layout.indexOf('import "./builder-mobile-catalog.css";')).toBeGreaterThan(
      layout.indexOf('import "@discovery-box/builder/styles.css";')
    );
  });

  it("is phone-only: every rule is inside a 619px-and-below query and scoped to the Builder page, so 620px and up is untouched", () => {
    // both the cards and the shortcut stop at 619px: from 620px the package's own layout and tab bar are used as they are
    expect(blocks.map((block) => block.query)).toEqual(["(max-width: 619px)", "(max-width: 619px)"]);
    expect(stripped).not.toMatch(/@media[^{]*min-width|@media[^{]*max-width:\s*(?:6[2-9]\d|[7-9]\d\d|\d{4})px\)/);
    // nothing is declared outside those blocks
    const outside = stripped.replace(/@media\s*[^{]+\{(?:[^{}]*\{[^{}]*\})+\s*\}/g, "").trim();
    expect(outside).toBe("");
    // the desktop catalog starts at 981px, in its own sheet
    expect(read(APP_ROOT, "src", "app", "builder-catalog-grid.css")).toContain("@media (min-width: 981px)");
    blocks.forEach((block) =>
      block.rules.forEach((rule) => rule.selector.split(",").forEach((part) => expect(part.trim(), part).toMatch(/^\.builder-page /)))
    );
  });

  it("puts the compact card where the shared grid would leave a single column: 619px and below", () => {
    // the shared grid is auto-fill, minmax(260px, 1fr): two columns need a 520px grid, which is a 620px viewport
    const shared = read(REPOSITORY_ROOT, "packages", "builder", "styles.css");
    expect(shared).toContain("grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));");
  });

  it("lays the catalog out as exactly two equal columns with a compact gutter, and gives the cards their width back", () => {
    expect(bodyOf(cards, GRID)).toMatch(/grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\)/);
    expect(sizeOf(bodyOf(cards, GRID), "gap")).toBe(8);
    const section = bodyOf(cards, ".builder-page .catalog-section");
    expect(section).toMatch(/margin-inline:\s*-8px/);
    expect(section).toMatch(/padding:\s*14px 10px/);
    // no extra bottom padding any more: the shortcut no longer floats over the last row
    expect(section).not.toMatch(/padding-bottom/);
    // no horizontal scrolling: columns are minmax(0, 1fr) and the card may shrink
    expect(bodyOf(cards, CARD)).toMatch(/min-width:\s*0/);
    expect(stripped).not.toMatch(/overflow-x|scroll-snap/);
  });

  it("compresses the card: 8px padding, an 84px image box with a 76px bottle drawn by the package's own object-fit", () => {
    expect(sizeOf(bodyOf(cards, CARD), "padding")).toBe(8);
    expect(sizeOf(bodyOf(cards, CARD), "gap")).toBe(6);
    expect(sizeOf(bodyOf(cards, `${GRID} .perfume-card-image`), "height")).toBe(84);
    const bottle = bodyOf(cards, `${GRID} .perfume-card-image .perfume-card-bottle-image`);
    expect(sizeOf(bottle, "height")).toBe(76);
    expect(bottle).toMatch(/max-width:\s*100%/);
    expect(bottle).not.toMatch(/object-fit|transform|scale|filter/);
    expect(stripped).not.toMatch(/url\(|\.png|\.webp|\.jpg/);
  });

  it("keeps one-line name and brand in a smaller, legible size, with no wrapping", () => {
    const name = bodyOf(cards, `${GRID} .perfume-info h3`);
    expect(sizeOf(name, "font-size")).toBe(13.5);
    expect(name).not.toMatch(/white-space:\s*normal|-webkit-line-clamp/);
    const brand = bodyOf(cards, `${GRID} .perfume-info p.perfume-brand-name`);
    expect(sizeOf(brand, "font-size")).toBe(11);
    expect(brand).toMatch(/white-space:\s*nowrap/);
    expect(brand).toMatch(/text-overflow:\s*ellipsis/);
    expect(brand).toMatch(/overflow:\s*hidden/);
    const titles = read(APP_ROOT, "src", "app", "builder-card-titles.css");
    expect(titles).toMatch(/\.perfume-card-name \{[^}]*white-space:\s*nowrap[^}]*text-overflow:\s*ellipsis/);
    expect(stripped).not.toMatch(/animation|@keyframes|transition/);
  });

  it("reads price | Agregar on one row: a smaller price, a larger Agregar, the same 36px height and radius, short wording", () => {
    expect(bodyOf(cards, ACTIONS)).toMatch(/grid-template-columns:\s*auto minmax\(0, 1fr\)/);
    const chip = bodyOf(cards, `${ACTIONS} .perfume-card-points`);
    const button = bodyOf(cards, `${CARD} .perfume-card-compact-actions button`);
    expect(sizeOf(chip, "min-height")).toBe(36);
    expect(sizeOf(button, "min-height")).toBe(36);
    expect(button).toMatch(/justify-self:\s*stretch/);
    expect(sizeOf(chip, "font-size")).toBeLessThanOrEqual(sizeOf(button, "font-size"));
    expect(`${chip} ${button}`).not.toMatch(/border-radius/);
    expect(read(APP_ROOT, "src", "app", "builder-geometry.css")).toMatch(
      /\.builder-page \.perfume-card-compact-actions button,\s*\.builder-page \.perfume-card-points,[^}]*border-radius:\s*8px/
    );
    expect(bodyOf(cards, `${CARD} .perfume-card-compact-actions button .perfume-card-add-label-full`)).toMatch(/display:\s*none/);
    expect(bodyOf(cards, `${CARD} .perfume-card-compact-actions button .perfume-card-add-label-short`)).toMatch(/display:\s*inline/);
    expect(stripped).not.toMatch(/content:|\bpts?\b|puntos/i); // no generated text, no points wording
    expect(chip).not.toMatch(/display:\s*none/);
  });

  it("keeps Product Info reachable: the same 24px mark, tucked into the image corner", () => {
    const info = bodyOf(cards, `${CARD} .perfume-card-info-icon`);
    expect(sizeOf(info, "width")).toBe(24);
    expect(sizeOf(info, "height")).toBe(24);
    expect(info).not.toMatch(/display:\s*none/);
  });

  it("keeps every card the same height: the one subtitle moves out of the text column instead of adding a line", () => {
    const subtitle = bodyOf(cards, `${GRID} .perfume-info .perfume-subtitle`);
    expect(subtitle).toMatch(/position:\s*absolute/);
    expect(subtitle).toMatch(/white-space:\s*nowrap/);
    expect(subtitle).toMatch(/text-overflow:\s*ellipsis/);
    expect(subtitle).not.toMatch(/display:\s*none/);
    expect(subtitle).toMatch(/pointer-events:\s*none/);
    expect(subtitle).not.toMatch(/\bcolor:/);
    expect(bodyOf(cards, `${GRID} .perfume-info .perfume-card-reason`)).toMatch(/-webkit-line-clamp:\s*1/);
    expect(bodyOf(cards, CARD)).not.toMatch(/(?:^|[;\s])height\s*:/);
  });

  it("collapses the redundant tab bar while the catalog shows, so the box button is the only control", () => {
    const bar = bodyOf(shortcut, ".builder-page .mobile-builder-tabs");
    expect(bar).toMatch(/position:\s*static/); // it was sticky behind the site header
    expect(sizeOf(bar, "scroll-margin-top")).toBe(84);
    const collapsed = bodyOf(shortcut, PILL_NAV);
    ["height: 0", "margin: 0", "padding: 0", "border: 0", "background: none", "box-shadow: none", "backdrop-filter: none"].forEach((declaration) =>
      expect(collapsed).toContain(declaration)
    );
    expect(bodyOf(shortcut, `${PILL_NAV} > button:first-child`)).toMatch(/display:\s*none/);
    // no new markup, no second element: the shortcut is the existing box button
    expect(stripped).not.toMatch(/::before|::after|content:/);
  });

  it("floats the shortcut as a slim tab on the screen edge, where no control is, rather than a pill over the cards", () => {
    const tab = bodyOf(shortcut, PILL);
    expect(tab).toMatch(/position:\s*fixed/);
    expect(tab).toMatch(/writing-mode:\s*vertical-rl/); // the text runs along the tab
    expect(tab).toMatch(/border-radius:\s*10px 0 0 10px/); // flush to the edge: rounded only on the inner side
    expect(tab).not.toMatch(/\bleft:|\btop:|inset:/);
    expect(tab).toMatch(/var\(--aur-burgundy\)/);
    expect(tab).toMatch(/var\(--aur-ivory\)/);
    // a count badge stays, upright; no points, no total
    expect(bodyOf(shortcut, `${PILL} span`)).toMatch(/writing-mode:\s*horizontal-tb/);
    expect(bodyOf(shortcut, `${PILL} span`)).toMatch(/var\(--gold\)/);
    expect(stripped).not.toMatch(/total|MXN|\$\d/i);
    // bottom-right-corner placement is gone: that spot was over a control at ~94% of scroll positions
    expect(tab).not.toMatch(/right:\s*max\(14px/);
    expect(tab).not.toMatch(/border-radius:\s*999px/);
  });

  it("can never cover a card control: the tab's visible width stays inside the free band between the screen edge and any control", () => {
    const tab = bodyOf(shortcut, PILL);
    const width = sizeOf(tab, "width");
    const right = sizeOf(tab, "right");
    const visible = width + right; // right is -1px: one pixel of the tab sits past the screen edge
    // the band: the page's own 20px side padding, less the 8px the catalog card reaches into it, plus its 1px border and
    // 10px of padding = where the search, the filters and the cards' own edges end
    const section = bodyOf(cards, ".builder-page .catalog-section");
    const reach = -sizeOf(section, "margin-inline");
    const padding = Number(section.match(/padding:\s*\d+px (\d+)px/)[1]);
    const PAGE_SIDE_PADDING = 20;
    const controlsEnd = PAGE_SIDE_PADDING - reach + 1 + padding;
    expect(controlsEnd).toBe(23);
    expect(visible).toBeLessThanOrEqual(controlsEnd);
    // a card's own tappable parts (its body, the Info mark, price and Agregar) end a further 8px inside the card edge
    expect(visible).toBeLessThan(controlsEnd + sizeOf(bodyOf(cards, CARD), "padding"));
    // and the tab is a real tap target
    expect(width).toBeGreaterThanOrEqual(24);
    expect(sizeOf(tab, "min-height")).toBeGreaterThanOrEqual(96);
    // it never captures pointer events on the card, and nothing positions it over the page's middle
    expect(tab).not.toMatch(/pointer-events/);
    expect(tab).toMatch(/bottom:\s*max\(120px, calc\(env\(safe-area-inset-bottom\) \+ 104px\)\)/);
  });

  it("respects the safe area, stays under the modals and the site header, and has no motion", () => {
    const tab = bodyOf(shortcut, PILL);
    const zIndex = Number(tab.match(/z-index:\s*(\d+)/)[1]);
    expect(zIndex).toBeGreaterThan(40);
    expect(zIndex).toBeLessThan(50); // under the site header (50)
    expect(read(REPOSITORY_ROOT, "packages", "builder", "styles.css")).toMatch(/\.modal-overlay \{[^}]*z-index:\s*1000/);
    expect(stripped).not.toMatch(/animation|@keyframes|transition|transform/);
  });

  it("is Aurelian-only: the shared stylesheet is untouched and Discovery Decants never imports it", () => {
    const shared = read(REPOSITORY_ROOT, "packages", "builder", "styles.css");
    expect(shared).not.toContain("Ver caja");
    expect(shared).not.toContain("builder-mobile-catalog");
    expect(shared).not.toContain("mobileBoxShortcut");
    expect(read(REPOSITORY_ROOT, "src", "main.jsx")).not.toContain("builder-mobile-catalog");
  });
});
