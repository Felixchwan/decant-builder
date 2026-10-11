import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const APP_ROOT = fileURLToPath(new URL("..", import.meta.url));
const REPOSITORY_ROOT = fileURLToPath(new URL("../../..", import.meta.url));
const read = (...segments) => readFileSync(join(...segments), "utf8").replace(/\r\n/g, "\n");

const css = read(APP_ROOT, "src", "app", "builder-balance-help.css");
const withoutComments = css.replace(/\/\*[\s\S]*?\*\//g, "");
const rules = [...withoutComments.matchAll(/([^{}@]+)\{([^{}]*)\}/g)].map((match) => ({
  selector: match[1].replace(/\s+/g, " ").trim(),
  body: match[2].replace(/\s+/g, " ").trim(),
}));
const bodyOf = (selector, index = 0) => rules.filter((rule) => rule.selector === selector)[index]?.body;

describe("Collection Balance help (builder-balance-help.css)", () => {
  it("is loaded by Aurelian's layout, after the intelligence sheet whose tokens it reads", () => {
    const layout = read(APP_ROOT, "src", "app", "layout.jsx");

    expect(layout).toContain('import "./builder-balance-help.css";');
    expect(layout.indexOf('import "./builder-balance-help.css";')).toBeGreaterThan(layout.indexOf('import "./builder-intelligence.css";'));
  });

  it("styles only the opt-in markup, every selector under .builder-page", () => {
    expect(rules.length).toBeGreaterThan(10);
    rules.forEach(({ selector }) =>
      selector.split(",").forEach((part) => expect(part.trim(), part).toMatch(/^\.builder-page /))
    );
    expect(withoutComments).not.toMatch(/\.builder-portal-root/);
  });

  it("uses no !important, no raw colour and no browser-default tooltip: tokens from the intelligence sheet only", () => {
    expect(withoutComments).not.toContain("!important");
    expect(withoutComments).not.toMatch(/#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(/i);
    expect(withoutComments).not.toMatch(/\[title\]|tooltip/i);
    const tokens = [...withoutComments.matchAll(/var\((--[\w-]+)\)/g)].map((match) => match[1]);

    expect(tokens.length).toBeGreaterThan(10);
    expect(tokens.every((token) => token.startsWith("--aur-intel-"))).toBe(true);
  });

  it("keeps the info mark small and subordinate: an 18px ring, with a 44px touch halo only on coarse pointers (16px padding box + 2 x 0.9rem)", () => {
    const button = bodyOf(".builder-page .balance-help-button");

    expect(button).toContain("width: 1.125rem");
    expect(button).toContain("height: 1.125rem");
    expect(button).toContain("border-radius: 50%");
    expect(button).toContain("background: transparent");
    expect(withoutComments).toMatch(/@media \(pointer: coarse\)\s*\{\s*\.builder-page \.balance-help-button::before \{[^}]*inset: -0\.9rem/);
  });

  it("keeps the heading and the button on one row at every width, and never wraps the heading", () => {
    const heading = bodyOf(".builder-page .collection-balance-heading");

    expect(heading).toContain("display: flex");
    expect(heading).toContain("align-items: center");
    expect(heading).toContain("position: relative");
    expect(bodyOf(".builder-page .balance-help-button")).toContain("flex: none");
    expect(bodyOf(".builder-page .collection-balance-title")).toContain("min-width: 0");
  });

  it("gives the heading text exactly the label look of the other section labels", () => {
    const title = bodyOf(".builder-page .collection-balance-title");
    const intelligence = read(APP_ROOT, "src", "app", "builder-intelligence.css");
    const label = intelligence.match(/\.builder-page \.collection-balance-summary > span,[^{]*\{([^}]*)\}/)?.[1] ?? "";

    expect(title).toContain("color: var(--aur-intel-label)");
    expect(title).toContain("font-size: 0.6875rem");
    expect(title).toContain("font-weight: 600");
    expect(title).toContain("letter-spacing: 0.16em");
    expect(label).toContain("font-size: 0.6875rem");
    expect(label).toContain("letter-spacing: 0.16em");
  });

  it("paints the help as the evidence card does: opaque warm card, brass rim, low radius, shadow", () => {
    const panel = bodyOf(".builder-page .balance-help-panel");

    expect(panel).toContain("position: absolute");
    expect(panel).toContain("background: var(--aur-intel-card)");
    expect(panel).toContain("border: 1px solid var(--aur-intel-rim)");
    expect(panel).toContain("border-radius: var(--aur-intel-radius-card)");
    expect(panel).toContain("var(--aur-intel-shadow)");
    expect(panel).toContain("overflow-y: auto");
    expect(panel).toMatch(/max-height: min\(40rem, calc\(100dvh - 6rem\)\)/);
  });

  it("stays inside the section column on a wide screen (it is wider than the section, never wider than the clipped column)", () => {
    const panel = bodyOf(".builder-page .balance-help-panel");

    expect(panel).toContain("right: -1rem");
    expect(panel).toContain("left: -1rem");
  });

  it("uses almost the whole width on a phone (<= 768px) with the same markup", () => {
    expect(withoutComments).toMatch(/@media \(max-width: 768px\)\s*\{\s*\.builder-page \.balance-help-panel \{\s*right: -0\.6rem;\s*left: -0\.6rem;/);
  });

  it("tells the placement code how far below the top the heading must stay, from the host's own live measurements, with no fixed height", () => {
    const margin = bodyOf(".builder-page .collection-balance-heading");

    expect(margin).toContain("scroll-margin-top: calc(max(var(--site-header-height, 4.25rem), var(--builder-docked-summary-height, 0px)) + 1.5rem)");
    // no hard-coded guess at the height of the pinned box, and no breakpoint for it
    expect(withoutComments).not.toMatch(/scroll-margin-top:\s*\d+(\.\d+)?rem/);
    expect(withoutComments).not.toMatch(/min-width: 981px/);
  });

  it("honours reduced motion", () => {
    expect(withoutComments).toMatch(/@media \(prefers-reduced-motion: reduce\)\s*\{\s*\.builder-page \.balance-help-panel \{\s*animation: none/);
  });

  it("shows a visible focus ring on the button", () => {
    expect(bodyOf(".builder-page .balance-help-button:focus-visible")).toContain("outline: 2px solid var(--aur-intel-brass)");
  });

  it("sets the copy in the intelligence hierarchy: serif title, tracked brass names, soft body, muted footer", () => {
    expect(bodyOf(".builder-page .balance-help-title")).toContain("font-family: var(--aur-intel-serif)");
    expect(bodyOf(".builder-page .balance-help-list dt")).toContain("color: var(--aur-intel-label)");
    expect(bodyOf(".builder-page .balance-help-list dd")).toContain("color: var(--aur-intel-ink-soft)");
    expect(bodyOf(".builder-page .collection-snapshot .balance-help-panel .balance-help-footer")).toContain("color: var(--aur-intel-ink-muted)");
    // body text never drops below 12px
    [...withoutComments.matchAll(/font-size: ([\d.]+)rem/g)].forEach((match) => expect(Number(match[1])).toBeGreaterThanOrEqual(0.6875));
  });
});

describe("Collection Balance help: Aurelian opts in; Discovery Decants and the shared stylesheet are untouched", () => {
  it("opts in from Aurelian's BuilderExperience only", () => {
    expect(read(APP_ROOT, "src", "components", "BuilderExperience.jsx")).toMatch(/^\s+showBalanceHelp\s*$/m);
  });

  it("leaves no trace in the frozen shared stylesheet or in Discovery Decants' sources", () => {
    expect(read(REPOSITORY_ROOT, "packages", "builder", "styles.css")).not.toMatch(/balance-help|collection-balance-heading|collection-balance-title/);

    const walk = (directory) =>
      readdirSync(directory).flatMap((entry) => {
        const path = join(directory, entry);

        return statSync(path).isDirectory() ? walk(path) : /\.(jsx?|css)$/.test(entry) && !/\.test\./.test(entry) ? [path] : [];
      });

    walk(join(REPOSITORY_ROOT, "src")).forEach((path) =>
      expect(read(path), path).not.toMatch(/showBalanceHelp|balance-help|collection-balance-heading|builder-balance-help/)
    );
  });

  it("does not change what the Balance rows show: the rows' CSS and the metric code are not part of this change", () => {
    expect(css).not.toMatch(/collection-balance-row|collection-balance-list|data-level/);
  });
});
