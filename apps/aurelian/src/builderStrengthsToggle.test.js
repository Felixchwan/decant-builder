import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const APP_ROOT = fileURLToPath(new URL("..", import.meta.url));
const REPOSITORY_ROOT = fileURLToPath(new URL("../../..", import.meta.url));
const read = (...segments) => readFileSync(join(...segments), "utf8").replace(/\r\n/g, "\n");

const css = read(APP_ROOT, "src", "app", "builder-intelligence.css");
const withoutComments = css.replace(/\/\*[\s\S]*?\*\//g, "");
const toggleRules = [...withoutComments.matchAll(/([^{}@]*coverage-strengths[^{}]*)\{([^{}]*)\}/g)].map((match) => ({
  selector: match[1].replace(/\s+/g, " ").trim(),
  body: match[2].replace(/\s+/g, " ").trim(),
}));
const bodyOf = (selector) => toggleRules.find((rule) => rule.selector === selector)?.body;
const TOGGLE = ".builder-page .collection-snapshot .coverage-strengths-toggle";

describe("Box Analysis strengths disclosure (builder-intelligence.css)", () => {
  it("styles only the opt-in markup, every selector under .builder-page .collection-snapshot", () => {
    expect(toggleRules.length).toBeGreaterThanOrEqual(6);
    toggleRules.forEach(({ selector }) =>
      selector.split(",").forEach((part) => expect(part.trim(), part).toMatch(/^\.builder-page \.collection-snapshot /))
    );
  });

  it("is low weight: text in the label brass with no fill, no rim, no shadow and no pill radius", () => {
    const toggle = bodyOf(TOGGLE);

    expect(toggle).toContain("background: transparent");
    expect(toggle).toContain("border: 0");
    expect(toggle).toContain("box-shadow: none");
    expect(toggle).toContain("color: var(--aur-intel-label)");
    expect(toggle).toContain("font-size: 0.75rem");
    expect(toggle).toContain("border-radius: var(--aur-intel-radius-chip)");
    expect(toggle).not.toMatch(/999px|9999px|border-radius: 50%/);
  });

  it("uses tokens only: no raw colour and no !important in the new rules", () => {
    toggleRules.forEach(({ selector, body }) => {
      expect(body, selector).not.toMatch(/#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(/i);
      expect(body, selector).not.toContain("!important");
    });
  });

  it("has a visible focus ring, and only a pointer that can hover gets the hover colour", () => {
    expect(bodyOf(`${TOGGLE}:focus-visible`)).toContain("outline: 2px solid var(--aur-intel-brass)");
    expect(withoutComments).toMatch(/@media \(hover: hover\)\s*\{\s*\.builder-page \.collection-snapshot \.coverage-strengths-toggle:hover \{\s*color: var\(--aur-intel-ink\)/);
  });

  it("draws the chevron with a hairline border that turns when expanded", () => {
    expect(bodyOf(".builder-page .collection-snapshot .coverage-strengths-chevron")).toContain("border-width: 0 1px 1px 0");
    expect(bodyOf(`${TOGGLE}[aria-expanded="true"] .coverage-strengths-chevron`)).toContain("rotate(225deg)");
  });

  it("gives touch a 44px target without growing the line, and honours reduced motion", () => {
    expect(withoutComments).toMatch(/@media \(pointer: coarse\)\s*\{\s*\.builder-page \.collection-snapshot \.coverage-strengths-toggle::before \{[^}]*inset: -0\.55rem -0\.6rem/);
    expect(withoutComments).toMatch(/@media \(prefers-reduced-motion: reduce\)\s*\{[^}]*coverage-strengths-toggle/);
  });

  it("keeps the control clear of the pinned header and docked box with the host's live measurements, not a fixed height", () => {
    const toggle = bodyOf(TOGGLE);

    expect(toggle).toContain("scroll-margin: calc(max(var(--site-header-height, 4.25rem), var(--builder-docked-summary-height, 0px)) + 1.5rem) 0 1rem");
  });

  it("leaves the existing strength line and its drawn check mark exactly as they were", () => {
    expect(withoutComments).toMatch(/\.builder-page \.collection-snapshot \.coverage-strength \{\s*color: var\(--aur-intel-ink-soft\);\s*font-size: 0\.8125rem;\s*\}/);
    expect(withoutComments).toContain(".builder-page .collection-snapshot .coverage-strength::before {");
  });
});

describe("Box Analysis strengths disclosure: Aurelian opts in; Discovery Decants and the shared stylesheet are untouched", () => {
  it("opts in from Aurelian's BuilderExperience only", () => {
    expect(read(APP_ROOT, "src", "components", "BuilderExperience.jsx")).toMatch(/^\s+compactStrengths\s*$/m);
  });

  it("leaves no trace in the frozen shared stylesheet or in Discovery Decants' sources", () => {
    expect(read(REPOSITORY_ROOT, "packages", "builder", "styles.css")).not.toMatch(/coverage-strengths/);

    const walk = (directory) =>
      readdirSync(directory).flatMap((entry) => {
        const path = join(directory, entry);

        return statSync(path).isDirectory() ? walk(path) : /\.(jsx?|css)$/.test(entry) && !/\.test\./.test(entry) ? [path] : [];
      });

    walk(join(REPOSITORY_ROOT, "src")).forEach((path) =>
      expect(read(path), path).not.toMatch(/compactStrengths|coverage-strengths|CollapsibleStrengths/)
    );
  });
});
