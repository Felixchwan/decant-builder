import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const APP_ROOT = fileURLToPath(new URL("..", import.meta.url));
const REPOSITORY_ROOT = fileURLToPath(new URL("../../..", import.meta.url));
const read = (...segments) => readFileSync(join(...segments), "utf8").replace(/\r\n/g, "\n");

const css = read(APP_ROOT, "src", "app", "builder-review-modal.css");
const code = css.replace(/\/\*[\s\S]*?\*\//g, "");
const rules = [...code.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((match) => ({
  selector: match[1].replace(/\s+/g, " ").trim(),
  body: match[2].replace(/\s+/g, " ").trim(),
}));
const sharedCss = read(REPOSITORY_ROOT, "packages", "builder", "styles.css");

describe("Review modal season bars (builder-review-modal.css)", () => {
  it("is loaded by Aurelian's layout, after the shared stylesheet", () => {
    const layout = read(APP_ROOT, "src", "app", "layout.jsx");

    expect(layout).toContain('import "./builder-review-modal.css";');
    expect(layout.indexOf('import "./builder-review-modal.css";')).toBeGreaterThan(layout.indexOf('import "@discovery-box/builder/styles.css";'));
  });

  it("is one rule on the portalled dialog's season rows, and nothing else", () => {
    expect(rules).toEqual([
      {
        selector: ".builder-portal-root .review-overview-section .season-coverage-row",
        body: "grid-template-columns: 5rem minmax(0, 1fr) 20px;",
      },
    ]);
    expect(code).not.toContain("!important");
    // the dialog is portalled to <body> inside this class, outside .builder-page
    expect(read(REPOSITORY_ROOT, "packages", "builder", "src", "builder", "internal", "portal", "useBuilderPortalRoot.js")).toContain('"builder-portal-root builder-scope"');
  });

  it("widens only the label column of the modal's row: the bar and count tracks are the shared modal's own", () => {
    const shared = sharedCss.match(/\.review-overview-section \.season-coverage-row \{\s*grid-template-columns: ([^;]+);/)[1];

    expect(shared).toBe("54px minmax(0, 1fr) 20px");
    expect(rules[0].body).toBe("grid-template-columns: 5rem minmax(0, 1fr) 20px;");
    expect(shared.split(" ").slice(1).join(" ")).toBe(rules[0].body.replace("grid-template-columns: 5rem ", "").replace(";", ""));
  });

  it("is wide enough for the widest label at both type sizes, with a real gap, and is a fixed column so the bars align", () => {
    // "Primavera" measured 62px at 11.84px (<= 1024px) and 69px at 13.32px (the 54px column was overrun by 8px and 15px)
    const column = 5 * 16;

    expect(sharedCss).toMatch(/--builder-unit-074: 13\.32px;/);
    expect(sharedCss).toMatch(/--builder-unit-074: 11\.84px;/);
    expect(sharedCss).toMatch(/\.season-coverage-row > span,\s*:where\(\.builder-scope\) \.season-coverage-row strong \{[^}]*font-size: var\(--builder-unit-074\);/);
    expect(column - 69).toBeGreaterThanOrEqual(8 + 3);
    expect(column - 62).toBeGreaterThanOrEqual(8 + 3);
    expect(54).toBeLessThan(62);
    // a fixed length, never `auto`/`max-content`, so every row's bar starts at the same x
    expect(rules[0].body).not.toMatch(/auto|max-content|min-content|fit-content/);
  });

  it("keeps the markup, the data and the labels the package's", () => {
    const panel = read(REPOSITORY_ROOT, "packages", "builder", "src", "components", "BuilderPanel.jsx");

    expect(panel).toMatch(/<div className="season-coverage-row" key=\{season\.id\}>\s*<span>\{seasonLabel\}<\/span>\s*<div\s+className="season-coverage-track"/);
    expect(panel).toContain("style={{ width: `${season.percent}%` }}");
    expect(panel).toContain("<strong>{season.count}</strong>");
  });
});

describe("Review modal season bars: Aurelian only", () => {
  it("leaves no trace in the shared stylesheet or Discovery Decants' sources", () => {
    expect(sharedCss).not.toMatch(/builder-review-modal|5rem minmax\(0, 1fr\) 20px/);

    const walk = (directory) =>
      readdirSync(directory).flatMap((entry) => {
        const path = join(directory, entry);

        return statSync(path).isDirectory() ? walk(path) : /\.(jsx?|css)$/.test(entry) && !/\.test\./.test(entry) ? [path] : [];
      });

    walk(join(REPOSITORY_ROOT, "src")).forEach((path) => expect(read(path), path).not.toMatch(/builder-review-modal/));
  });
});
