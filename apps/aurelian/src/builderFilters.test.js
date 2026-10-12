import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const APP_ROOT = fileURLToPath(new URL("..", import.meta.url));
const REPOSITORY_ROOT = fileURLToPath(new URL("../../..", import.meta.url));
const read = (...segments) => readFileSync(join(...segments), "utf8").replace(/\r\n/g, "\n");

const css = read(APP_ROOT, "src", "app", "builder-filters.css");
const code = css.replace(/\/\*[\s\S]*?\*\//g, "");
const sharedCss = read(REPOSITORY_ROOT, "packages", "builder", "styles.css");
const blocks = [...code.matchAll(/(@media [^{]+)\{\s*([^{}]+)\{([^{}]*)\}\s*\}/g)].map((match) => ({
  media: match[1].trim(),
  selector: match[2].replace(/\s+/g, " ").trim(),
  body: match[3].replace(/\s+/g, " ").trim(),
}));
const at = (media) => blocks.find((block) => block.media === media);

describe("Catalog filter row gets the room its labels need (builder-filters.css)", () => {
  it("is loaded by Aurelian's layout, after the shared stylesheet and next to the dock clearance it shares the row with", () => {
    const layout = read(APP_ROOT, "src", "app", "layout.jsx");

    expect(layout).toContain('import "./builder-filters.css";');
    expect(layout.indexOf('import "./builder-filters.css";')).toBeGreaterThan(layout.indexOf('import "@discovery-box/builder/styles.css";'));
    expect(layout.indexOf('import "./builder-filters.css";')).toBeGreaterThan(layout.indexOf('import "./builder-dock-clearance.css";'));
  });

  it("is three layout rules and nothing else, all on the Builder's own filter row", () => {
    expect(blocks.map(({ media }) => media)).toEqual([
      "@media (min-width: 1200px) and (max-width: 1439px)",
      "@media (min-width: 981px) and (max-width: 1199px)",
      "@media (max-width: 520px)",
    ]);
    expect(code.replace(/@media[^{]+\{[^{}]*\{[^{}]*\}\s*\}/g, "").trim()).toBe("");
    blocks.forEach(({ selector, body }) => {
      expect(selector).toBe(".builder-page .catalog-section .filters");
      expect(body).toMatch(/^grid-template-columns: [^;]+;$/);
    });
  });

  it("changes tracks only: no size, copy, colour or ellipsis, and the selects' own rules are untouched", () => {
    blocks.forEach(({ body }) => expect(body).not.toMatch(/font|padding|height|width|margin|gap|color|background|border|overflow|white-space|display|!important/));
    expect(code).not.toMatch(/(?<![\w-])select(?![\w-])|!important|@container|container-type/);
    // the safety net the shared row keeps for a long *selected* value
    expect(sharedCss).toMatch(/\.filters select \{[^}]*text-overflow: ellipsis;/);
  });

  it("sizes four tracks to the labels between 1200px and 1439px (the room each label needs, as fractions)", () => {
    const body = at("@media (min-width: 1200px) and (max-width: 1439px)").body;

    expect(body).toBe("grid-template-columns: minmax(0, 170fr) minmax(0, 157fr) minmax(0, 126fr) minmax(0, 217fr);");

    const needs = [...body.matchAll(/(\d+)fr/g)].map((match) => Number(match[1]));
    // Temporadas, Ocasiones, Vibes, Orden at 14.76px: 670px of labels + 3 gaps of 8px = 694px, a row the shell has from 1200px
    expect(needs.reduce((total, need) => total + need, 0) + 3 * 8).toBe(694);
    expect(1200 - 469).toBeGreaterThanOrEqual(694);
    // the label type is 14.76px from 1025px, the size those numbers were measured at
    expect(sharedCss).toMatch(/--builder-unit-082: 14\.76px;/);
    // from 1440px the shared four equal tracks are kept (an equal quarter is 237px, the longest label needs 217px)
    expect(sharedCss).toMatch(/\.filters \{[^}]*grid-template-columns: repeat\(4, minmax\(0, 1fr\)\);/);
    expect((1440 - 469 - 3 * 8) / 4).toBeGreaterThan(217);
  });

  it("goes two by two where four labels cannot share one row (981-1199px), the one place the toolbar grows", () => {
    expect(at("@media (min-width: 981px) and (max-width: 1199px)").body).toBe("grid-template-columns: repeat(2, minmax(0, 1fr));");
    // the desktop layout starts at 981px, the same switch the shared filter grid uses
    expect(sharedCss).toMatch(/@media \(min-width: 981px\) \{[\s\S]*?:where\(\.builder-scope\) \.filters \{\s*[^}]*display: grid;/);
    // 981px, panel open: four tracks would be ~122px against labels of 156/145/117/198px
    expect((981 - 469 - 3 * 8) / 4).toBeLessThan(156);
    // two tracks hold the longest label with room (and a long selected value such as "Orden: Puntos: menor a mayor")
    expect((981 - 469 - 8) / 2).toBeGreaterThan(231);
  });

  it("stacks one select per row on phones (<= 520px), where a half-width track is narrower than three of the four labels", () => {
    expect(at("@media (max-width: 520px)").body).toBe("grid-template-columns: minmax(0, 1fr);");
    // the shared phone rule is the two-column grid being replaced, at the same breakpoint
    expect(sharedCss).toMatch(/@media \(max-width: 520px\) \{[\s\S]*?:where\(\.builder-scope\) \.filters \{\s*display: grid;\s*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\);/);
    // 375px phone: a half track is ~141px; the labels need 180 / 166 / 133 / 231px at 16px
    expect(141).toBeLessThan(180);
  });

  it("leaves 521-980px alone (the shared wrapping row already fits) and the 1440px+ desktop untouched", () => {
    const covered = (width) => blocks.filter(({ media }) => {
      const min = Number(media.match(/min-width: (\d+)px/)?.[1] ?? 0);
      const max = Number(media.match(/max-width: (\d+)px/)?.[1] ?? Infinity);

      return width >= min && width <= max;
    }).length;

    [521, 600, 768, 980].forEach((width) => expect(covered(width), String(width)).toBe(0));
    [1440, 1600, 1920, 2200].forEach((width) => expect(covered(width), String(width)).toBe(0));
    [375, 390, 428, 520, 981, 1024, 1199, 1200, 1280, 1366, 1439].forEach((width) => expect(covered(width), String(width)).toBe(1));
  });
});

describe("Catalog filter row: Aurelian only", () => {
  it("never touches the dock clearance, the grid, the shared stylesheet or Discovery Decants", () => {
    expect(read(APP_ROOT, "src", "app", "builder-dock-clearance.css")).not.toMatch(/grid-template-columns/);
    expect(sharedCss).not.toMatch(/builder-filters/);
    expect(read(APP_ROOT, "src", "app", "builder-catalog-grid.css")).not.toMatch(/\.filters/);

    const walk = (directory) =>
      readdirSync(directory).flatMap((entry) => {
        const path = join(directory, entry);

        return statSync(path).isDirectory() ? walk(path) : /\.(jsx?|css)$/.test(entry) && !/\.test\./.test(entry) ? [path] : [];
      });

    walk(join(REPOSITORY_ROOT, "src")).forEach((path) => expect(read(path), path).not.toMatch(/builder-filters/));
  });

  it("keeps the labels' copy and markup the package's: every option still carries its Category: Value prefix", () => {
    const filterBar = read(REPOSITORY_ROOT, "packages", "builder", "src", "components", "FilterBar.jsx");

    expect(filterBar).toContain("{categoryLabel}: {t(\"filter.allValue\")}");
    expect(filterBar).toContain("{sortLabel}: {t(\"filter.sort.bestMatch\")}");
  });
});
