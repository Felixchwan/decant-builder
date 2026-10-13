import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const APP_ROOT = fileURLToPath(new URL("..", import.meta.url));
const REPOSITORY_ROOT = fileURLToPath(new URL("../../..", import.meta.url));
const read = (...segments) => readFileSync(join(...segments), "utf8").replace(/\r\n/g, "\n");

const css = read(APP_ROOT, "src", "app", "builder-warning-dialog.css");
const code = css.replace(/\/\*[\s\S]*?\*\//g, "");
const rules = [...code.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
  .map((match) => ({ selector: match[1].replace(/\s+/g, " ").trim(), body: match[2].replace(/\s+/g, " ").trim() }))
  .filter(({ selector }) => !selector.startsWith("@"));
const selectors = rules.flatMap(({ selector }) => selector.split(",").map((part) => part.trim()));
const body = (selector) => rules.find((rule) => rule.selector === selector)?.body;

const runtime = read(REPOSITORY_ROOT, "packages", "builder", "src", "BuilderRuntime.jsx");
const sharedCss = read(REPOSITORY_ROOT, "packages", "builder", "styles.css");

const SHELL = ".builder-portal-root .warning-modal";
const BUTTONS = ".builder-portal-root .warning-modal .modal-actions button";

describe("Rare-selection warning dialog (builder-warning-dialog.css)", () => {
  it("is loaded by Aurelian's layout, after the shared stylesheet and the modal chrome it sits beside", () => {
    const layout = read(APP_ROOT, "src", "app", "layout.jsx");
    const at = (name) => layout.indexOf(`import "./${name}";`);

    expect(layout.match(/builder-warning-dialog\.css/g)).toHaveLength(1);
    expect(at("builder-warning-dialog.css")).toBeGreaterThan(at("builder-modals.css"));
    expect(at("builder-warning-dialog.css")).toBeGreaterThan(layout.indexOf('import "@discovery-box/builder/styles.css";'));
  });

  it("is paint on the portalled dialog only: every selector hangs off .builder-portal-root, no !important, no markup or behaviour", () => {
    expect(selectors.length).toBeGreaterThan(12);
    selectors.forEach((selector) => expect(selector, selector).toMatch(/^\.builder-portal-root(?: |$)/));
    expect(code).not.toContain("!important");
    expect(code).not.toMatch(/\.builder-page|#aurelian-builder-summary-slot|\.site-header/);
    expect(code).not.toMatch(/pointer-events|visibility:|display: none|inert|tabindex|@keyframes|animation/);
    // the scrim is the one rule that reaches the overlay, and only the overlay that holds this dialog
    expect(selectors.filter((selector) => !selector.startsWith(".builder-portal-root .warning-modal"))).toEqual([".builder-portal-root .modal-overlay:has(> .warning-modal)"]);
  });

  it("drops the purple and cyan treatment, the 22px corners and the emoji watermarks", () => {
    // the shared stylesheet still carries them: that is what Discovery Decants renders
    expect(sharedCss).toMatch(/\.warning-modal \{[^}]*border-radius: 22px;[^}]*168, 85, 247/);
    expect(sharedCss).toMatch(/\.warning-modal::before \{\s*content: "🦑";/);
    expect(sharedCss).toMatch(/\.warning-footer \{[^}]*color: #67e8f9;/);

    expect(code).not.toMatch(/168,\s*85,\s*247|34,\s*211,\s*238|167,\s*139,\s*250|103,\s*232,\s*249|#a78bfa|#67e8f9|#06100c|#b7f7d3|#6ee7b7/i);
    expect(code).not.toMatch(/(?<![\d.])(?:22|20)px|999px/);
    expect(body(`${SHELL}::before, ${SHELL}::after`)).toBe("content: none;");
  });

  it("gives the shell the family's ground, hairline, radius and shadow, with the caution as a burgundy rim", () => {
    const shell = body(SHELL);

    expect(shell).toContain("border: 1px solid var(--aur-burgundy-rim)");
    expect(shell).toContain("border-radius: 10px");
    expect(shell).toContain("background: var(--aur-intel-card)");
    expect(shell).toContain("0 28px 90px var(--aur-intel-shadow)");
    expect(shell).toContain("inset 0 1px 0 var(--aur-intel-hair)");
    // the same recipe the standard dialogs have (builder-modals.css), differing only in the rim colour
    const modals = read(APP_ROOT, "src", "app", "builder-modals.css");

    expect(modals).toMatch(/border: 1px solid var\(--aur-intel-rim\);\s*border-radius: 10px;\s*background: var\(--aur-intel-card\);/);
    expect(body(".builder-portal-root .modal-overlay:has(> .warning-modal)")).toContain("var(--aur-burgundy-glow)");
  });

  it("sets the type in the house system: brass eyebrow, serif ivory name, soft body, the caution under a hairline", () => {
    expect(body(`${SHELL} h2`)).toContain("color: var(--aur-intel-label)");
    expect(body(`${SHELL} h2`)).toContain("text-transform: uppercase");
    expect(body(`${SHELL} h2`)).toContain("font-size: 0.6875rem");
    expect(body(`${SHELL} h3`)).toContain("font-family: var(--aur-intel-serif)");
    expect(body(`${SHELL} h3`)).toContain("font-weight: 400");
    expect(body(`${SHELL} h3`)).toContain("color: var(--aur-intel-ink)");
    expect(body(`${SHELL} p`)).toContain("color: var(--aur-intel-ink-soft)");
    expect(body(`${SHELL} p.warning-footer`)).toContain("border-top: 1px solid var(--aur-burgundy-line)");
    expect(code).not.toMatch(/font-weight:\s*(?:[89]\d\d|bold)/);
  });

  it("keeps burgundy off text and off the buttons: it is the rim, the haze, the hairline and the decorative mark", () => {
    const burgundyRules = rules.filter(({ body: ruleBody }) => /--aur-burgundy/.test(ruleBody));

    expect(burgundyRules.map(({ selector }) => selector).sort()).toEqual(
      [".builder-portal-root .modal-overlay:has(> .warning-modal)", SHELL, `${SHELL} p.warning-footer`, `${SHELL} .warning-footer > span`].sort()
    );
    // as a colour it appears once: the aria-hidden mark. Never the small text, never a button.
    const asColor = rules.filter(({ body: ruleBody }) => /(?:^|[ ;])color: var\(--aur-burgundy/.test(ruleBody));

    expect(asColor.map(({ selector }) => selector)).toEqual([`${SHELL} .warning-footer > span`]);
    expect(code).not.toContain("--aur-burgundy-text-interactive");
    // the mark is the shared markup's own aria-hidden span, so nothing here adds or announces anything
    expect(runtime).toContain('<span aria-hidden="true">☠</span> {t("rareSelection.caution")}');
  });

  it("keeps the two actions' roles and order, in the approved button language: brass goes ahead, ivory structure goes back", () => {
    expect(body(BUTTONS)).toContain("border-radius: 8px");
    expect(body(BUTTONS)).toContain("min-height: 2.75rem");
    expect(body(`${BUTTONS}:first-child`)).toBe("border: 1px solid var(--gold); background: var(--gold); color: var(--ink);");
    expect(body(`${BUTTONS}:last-child`)).toBe("border: 1px solid var(--aur-intel-rim); background: transparent; color: var(--aur-intel-ink);");
    // two different weights: one filled, one outlined; never two primaries, never a coloured "no"
    expect(body(`${BUTTONS}:first-child`)).not.toEqual(body(`${BUTTONS}:last-child`));
    expect(body(`${BUTTONS}:last-child`)).not.toMatch(/--aur-green|burgundy|--gold/);
    expect(body(`${BUTTONS}:focus-visible`)).toBe("outline: 2px solid var(--aur-intel-brass); outline-offset: 2px;");
    // order and meaning are the runtime's: confirm first, cancel second, each on its own handler
    expect(runtime).toMatch(/<div className="modal-actions">\s*<button type="button" onClick=\{confirmAddPerfume\}>[\s\S]*?<button type="button" onClick=\{cancelAddPerfume\}>/);
  });
});

describe("Rare-selection warning dialog: behaviour, markup and the other hosts are untouched", () => {
  it("keeps the dialog's markup, copy keys, accessible name, Escape and scroll lock exactly as the runtime has them", () => {
    expect(runtime).toContain('className="warning-modal"');
    expect(runtime).toContain('aria-labelledby="rare-selection-title"');
    expect(runtime).toContain('<h2>{t("rareSelection.title")}</h2>');
    expect(runtime).toContain('<h3 id="rare-selection-title">{pendingPerfume.name}</h3>');
    expect(runtime).toContain('<p className="warning-footer">');
    expect(runtime).toMatch(/if \(event\.key === "Escape"\) \{[^}]*cancelAddPerfume\(\);/);
    expect(runtime).toContain("const releaseBodyScrollLock = acquireBodyScrollLock(document);");
    // this pass adds no focus handling to the warning: no ref, no tabIndex, no hook
    const start = runtime.indexOf('className="warning-modal"');
    const markup = runtime.slice(start - 200, runtime.indexOf("</div>\n        </div>,", start));

    expect(markup).not.toMatch(/ref=|tabIndex|useModalFocus/);
  });

  it("leaves the shared stylesheet and Discovery Decants alone: the warning there keeps its own look", () => {
    expect(sharedCss).not.toMatch(/builder-warning-dialog|--aur-burgundy/);

    const walk = (directory) =>
      readdirSync(directory).flatMap((entry) => {
        const path = join(directory, entry);

        return statSync(path).isDirectory() ? walk(path) : /\.(jsx?|css)$/.test(entry) && !/\.test\./.test(entry) ? [path] : [];
      });

    walk(join(REPOSITORY_ROOT, "src")).forEach((path) => expect(read(path), path).not.toMatch(/builder-warning-dialog/));
  });
});
