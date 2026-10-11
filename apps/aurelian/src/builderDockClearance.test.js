import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const APP_ROOT = fileURLToPath(new URL("..", import.meta.url));
const REPOSITORY_ROOT = fileURLToPath(new URL("../../..", import.meta.url));
const read = (...segments) => readFileSync(join(...segments), "utf8").replace(/\r\n/g, "\n");

const css = read(APP_ROOT, "src", "app", "builder-dock-clearance.css");
const code = css.replace(/\/\*[\s\S]*?\*\//g, "");
const sharedCss = read(REPOSITORY_ROOT, "packages", "builder", "styles.css");
const globals = read(APP_ROOT, "src", "app", "globals.css");
const blocks = [...code.matchAll(/(@media [^{]+)\{\s*([^{}]+)\{([^{}]*)\}\s*\}/g)].map((match) => ({
  media: match[1].trim(),
  selector: match[2].replace(/\s+/g, " ").trim(),
  body: match[3].replace(/\s+/g, " ").trim(),
}));
const margin = blocks.find(({ body }) => body.includes("margin-right"));
const motion = blocks.find(({ body }) => body.includes("transition"));

describe("Docked Mi caja card and the catalog controls, panel collapsed (builder-dock-clearance.css)", () => {
  it("is loaded by Aurelian's layout, after the catalog grid it sits beside", () => {
    const layout = read(APP_ROOT, "src", "app", "layout.jsx");

    expect(layout).toContain('import "./builder-dock-clearance.css";');
    expect(layout.indexOf('import "./builder-dock-clearance.css";')).toBeGreaterThan(layout.indexOf('import "./builder-catalog-grid.css";'));
  });

  it("is two rules in the desktop layout (981px and up), nothing else", () => {
    expect(blocks).toHaveLength(2);
    expect(margin.media).toBe("@media (min-width: 981px)");
    expect(motion.media).toBe("@media (min-width: 981px) and (prefers-reduced-motion: no-preference)");
    expect(code.replace(/@media[\s\S]*$/, "").trim()).toBe("");
  });

  it("reserves the card's footprint only while the panel is collapsed AND the docked card is open", () => {
    expect(margin.selector).toContain(":root:has(.layout--panel-collapsed)");
    expect(margin.selector).toContain(":has(#aurelian-builder-summary-slot .builder-panel-sticky-summary-card.is-docked:not(.is-collapsed))");
    // the card's folded strip lives inside the header, so it needs no reservation
    expect(margin.selector).not.toMatch(/\.is-collapsed\)\s/);
  });

  it("touches only the search row and the filter row, never the heading, the grid or the cards", () => {
    expect(margin.selector).toMatch(/\.builder-page \.catalog-section > :is\(\.catalog-controls, \.filters\)$/);
    expect(motion.selector).toBe(".builder-page .catalog-section > :is(.catalog-controls, .filters)");
    expect(code).not.toMatch(/catalog-grid|perfume-card|panel-header|catalog-title/);
    // scoped under .builder-page, so it can never become an unscoped .catalog-controls rule
    expect(code).not.toMatch(/(?<!\.catalog-section > :is\()(?<!\.builder-page )\.catalog-controls\s*\{/);
  });

  it("is a margin of the card's width less the rail and gap the catalog already leaves: 360px - 36px", () => {
    expect(margin.body).toBe("margin-right: calc(360px - 36px);");
  });

  it("keeps those two numbers in lockstep with where they come from", () => {
    // 360px: the docked slot, and the panel column the layout reserves when expanded
    expect(globals).toMatch(/\.site-header__builder-slot\s*\{[^}]*width:360px/);
    expect(sharedCss).toMatch(/\.layout \{\s*grid-template-columns: minmax\(0, 1fr\) 360px;\s*gap: 16px;/);
    // 36px: the collapsed rail (20px) + the layout gap (16px), the same 36px the collapsed intro uses
    expect(sharedCss).toMatch(/\.builder-panel-collapse-rail \{[^}]*flex: 0 0 20px;/);
    expect(globals).toMatch(/margin-right:max\(48px, calc\(50% - var\(--aur-builder-edge\) \+ 36px\)\)/);
    expect(20 + 16).toBe(36);
  });

  it("follows the panel's own collapse motion (220ms ease, same motion preference), so the controls track it instead of jumping", () => {
    expect(motion.body).toBe("transition: margin-right 220ms ease;");
    expect(sharedCss).toMatch(/@media \(prefers-reduced-motion: no-preference\) \{[^@]*\.builder-panel-column \{[^}]*transition: width 220ms ease, opacity 120ms ease;/);
    expect(sharedCss).toMatch(/\.builder-panel-collapsible-row \{\s*transition: gap 220ms ease;/);
  });

  it("scales with the shell by construction: no viewport number, no shell-width assumption, no script", () => {
    expect(code).not.toMatch(/1440|2200|708|\bvw\b|innerWidth|50%/);
    expect(code).not.toContain("!important");
  });
});

describe("Docked card clearance: Aurelian only", () => {
  it("leaves no trace in the shared stylesheet, the catalog grid rule or Discovery Decants' sources", () => {
    expect(sharedCss).not.toMatch(/dock-clearance|aurelian-builder-summary-slot/);
    expect(read(APP_ROOT, "src", "app", "builder-catalog-grid.css")).not.toMatch(/margin-right|dock/);

    const walk = (directory) =>
      readdirSync(directory).flatMap((entry) => {
        const path = join(directory, entry);

        return statSync(path).isDirectory() ? walk(path) : /\.(jsx?|css)$/.test(entry) && !/\.test\./.test(entry) ? [path] : [];
      });

    walk(join(REPOSITORY_ROOT, "src")).forEach((path) => expect(read(path), path).not.toMatch(/builder-dock-clearance/));
  });
});
