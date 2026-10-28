import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const APP_ROOT = fileURLToPath(new URL("..", import.meta.url));
const REPOSITORY_ROOT = fileURLToPath(new URL("../../..", import.meta.url));
const read = (...segments) => readFileSync(join(...segments), "utf8").replace(/\r\n/g, "\n");

const css = read(APP_ROOT, "src", "app", "builder-mobile.css");
const withoutComments = css.replace(/\/\*[\s\S]*?\*\//g, "");
const mediaBlock = withoutComments.match(/@media \(max-width: 980px\)\s*\{([\s\S]*)\}\s*$/);
const rules = [...(mediaBlock?.[1] ?? "").matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((match) => ({
  selector: match[1].replace(/\s+/g, " ").trim(),
  body: match[2].replace(/\s+/g, " ").trim(),
}));
const bodyOf = (selector) => rules.find((rule) => rule.selector === selector)?.body;

describe("Mobile Mi caja stack (builder-mobile.css)", () => {
  it("is loaded by Aurelian's layout, after the shared stylesheet and the intelligence tokens it reads", () => {
    const layout = read(APP_ROOT, "src", "app", "layout.jsx");

    expect(layout.indexOf('import "./builder-mobile.css";')).toBeGreaterThan(layout.indexOf('import "@discovery-box/builder/styles.css";'));
    expect(layout.indexOf('import "./builder-mobile.css";')).toBeGreaterThan(layout.indexOf('import "./builder-intelligence.css";'));
    expect(layout.indexOf('import "./builder-mobile.css";')).toBeGreaterThan(layout.indexOf('import "./builder-collection-card.css";'));
  });

  it("lives entirely inside the Builder's own mobile layout (the 980px tab switch) and under .builder-page", () => {
    // one media block, and nothing outside it
    expect(mediaBlock, "a single (max-width: 980px) block").not.toBeNull();
    expect(withoutComments.replace(/@media \(max-width: 980px\)\s*\{[\s\S]*\}\s*$/, "").trim()).toBe("");
    expect(rules.length).toBeGreaterThan(8);
    rules.forEach(({ selector }) =>
      selector.split(",").forEach((part) => expect(part.trim(), part).toMatch(/^\.builder-page /))
    );
  });

  it("uses no !important, no raw colour and no pill radius: spacing and tokens only", () => {
    expect(withoutComments).not.toContain("!important");
    expect(withoutComments).not.toMatch(/#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(/i);
    expect(withoutComments).not.toMatch(/999px|9999px/);
    // the one colour it uses is the intelligence hairline token
    expect(withoutComments.match(/var\(--[\w-]+\)/g).every((token) => token === "var(--aur-intel-rule)")).toBe(true);
  });

  it("keeps the summary on ONE row of two (Fragancias | Total MXN) at every phone width (the shared <=420px rule wrapped the total)", () => {
    const card = bodyOf(".builder-page .box-summary-card");
    const total = bodyOf(".builder-page .box-summary-total");

    expect(card).toContain("grid-template-columns: repeat(2, minmax(0, 1fr))");
    expect(card).toMatch(/padding: \d+px \d+px/);
    // undoes exactly what the shared small-phone rule does to the total, and restores its divider
    expect(total).toContain("grid-column: auto");
    expect(total).toContain("margin-top: 0");
    expect(total).toContain("padding-top: 0");
    expect(total).toContain("border-top: 0");
    expect(total).toContain("border-left: 1px solid var(--aur-intel-rule)");
  });

  it("tightens the stack below it without shrinking any control: no height, min-height or font-size on a button", () => {
    expect(bodyOf(".builder-page .slot-bar")).toMatch(/height: 5px; margin: 12px 0/);
    expect(bodyOf(".builder-page .review-action")).toContain("padding: 6px");
    expect(bodyOf(".builder-page .review-action .review-box-button")).toBe("margin: 0;");
    expect(bodyOf(".builder-page .review-action p")).toContain("margin: 4px 4px 0");
    // the review button's own 46px target, the vials, and every other button are the package's
    rules.forEach(({ selector, body }) => {
      if (/button|vial|tray-scale/.test(selector)) {
        expect(body, selector).not.toMatch(/(?:^|[ ;])(?:min-)?height:|font-size:/);
      }
    });
    expect(css).not.toMatch(/\.box-vial|\.vial-/);
  });

  it("leaves one Review control on a phone: the compact twin in the summary header is hidden, the bar is kept", () => {
    const hidden = rules.filter(({ body }) => /(?:^|[ ;])display: none;/.test(body));

    // exactly one rule hides anything, and it is the compact button inside the sticky summary card, nothing broader
    expect(hidden.map(({ selector }) => selector)).toEqual([".builder-page .builder-panel-sticky-summary-card .review-box-button--compact"]);
    expect(hidden[0].body).toBe("display: none;");
    // the bar's own button (no --compact) is never targeted by a hiding rule, and no visibility/opacity trick is used
    expect(withoutComments).not.toMatch(/\.review-action[^{]*\{[^}]*display: none/);
    expect(withoutComments).not.toMatch(/visibility: hidden|opacity: 0|clip(?:-path)?:|sr-only|position: absolute/);

    // both buttons really are rendered by the shared panel (same handler), which is why one of them can go
    const panel = read(REPOSITORY_ROOT, "packages", "builder", "src", "components", "BuilderPanel.jsx");
    expect(panel.match(/review-box-button review-box-button--compact/g)).toHaveLength(2);
    expect(panel).toContain('className={`review-action ${isBoxReady ? "is-ready" : "is-incomplete"}`}');
    expect(panel.match(/onClick=\{handleOpenReview\}/g)).toHaveLength(3);
  });

  it("floats the Review bar only while it can be used: incomplete, it sits in the flow and keeps its reason", () => {
    const incomplete = bodyOf(".builder-page .review-action.is-incomplete");
    const sharedCss = read(REPOSITORY_ROOT, "packages", "builder", "styles.css");

    expect(incomplete).toBe("position: static; margin-inline: 0; box-shadow: none;");
    // nothing here changes the ready bar: it keeps the shared sticky bottom bar (only its padding/margins are tuned above)
    expect(rules.some(({ selector }) => /is-ready/.test(selector))).toBe(false);
    expect(bodyOf(".builder-page .review-action")).not.toMatch(/position/);
    expect(sharedCss).toMatch(/@media \(max-width: 980px\) \{[\s\S]*?:where\(\.builder-scope\) \.review-action \{\s*position: sticky;\s*bottom: 10px;/);
    // the disabled semantics and the helper text are the package's: this file never touches `disabled`, the text or the button's size
    expect(withoutComments).not.toMatch(/:disabled|\[disabled\]|\.review-action p \{[^}]*display/);
  });

  it("leaves no trace in the shared package, Discovery Decants or the desktop-only docked summary", () => {
    const sharedCss = read(REPOSITORY_ROOT, "packages", "builder", "styles.css");

    expect(sharedCss).not.toContain("builder-mobile");
    expect(css).not.toContain("aurelian-builder-summary-slot");

    const walk = (directory) =>
      readdirSync(directory).flatMap((entry) => {
        const path = join(directory, entry);

        return statSync(path).isDirectory() ? walk(path) : /\.(jsx?|css)$/.test(entry) && !/\.test\./.test(entry) ? [path] : [];
      });

    walk(join(REPOSITORY_ROOT, "src")).forEach((path) => expect(read(path), path).not.toMatch(/builder-mobile|aur-intel-rule/));
  });
});
