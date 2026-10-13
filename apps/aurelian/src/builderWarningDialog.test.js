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
// every declaration the file gives a selector (a selector may have a placement rule and a paint rule)
const body = (selector) => {
  const matching = rules.filter((rule) => rule.selector === selector);

  return matching.length ? matching.map((rule) => rule.body).join(" ") : undefined;
};

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
    expect(code).not.toMatch(/visibility:|display: none|inert|tabindex|@keyframes|animation/);
    // the one thing that opts out of pointing is the crest, which must never catch a click
    expect(rules.filter(({ body: ruleBody }) => /pointer-events/.test(ruleBody)).map(({ selector }) => selector)).toEqual([`${SHELL}::before`]);
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
    expect(body(`${SHELL}::after`)).toBe("content: none;");
    // the squid is gone; the ::before it used to occupy now carries the crest (see the crest describe below)
    expect(code).not.toMatch(/🦑|☠/u);
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

describe("Rare-selection warning dialog: the kraken crest", () => {
  const CREST = "/media/warning/kraken-crest.webp";
  const crest = body(`${SHELL}::before`);

  it("is Aurelian's own optimized asset, a real WebP in the host's public media, light enough to load with the dialog", () => {
    const bytes = readFileSync(join(APP_ROOT, "public", "media", "warning", "kraken-crest.webp"));

    expect(bytes.subarray(0, 4).toString("ascii")).toBe("RIFF");
    expect(bytes.subarray(8, 12).toString("ascii")).toBe("WEBP");
    expect(bytes.length).toBeLessThan(120 * 1024);
    // the one picture this file references
    expect([...code.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/g)].map((match) => match[1])).toEqual([CREST]);
  });

  it("is a CSS background on the shell's ::before, like the Curator Pick artwork: no element, no alt text, nothing to focus", () => {
    expect(crest).toContain('content: ""');
    expect(crest).toContain(`background: url("${CREST}") center / contain no-repeat`);
    expect(crest).toContain("pointer-events: none");
    // same device as the Curator Pick card: a background-image pseudo-element, never an <img>
    expect(read(APP_ROOT, "src", "app", "builder-intelligence.css")).toMatch(/curator-pick-slot::after \{[^}]*pointer-events: none;/);
    // and the shared markup gains no element for it: the dialog still opens straight onto the eyebrow
    expect(runtime).toMatch(/aria-labelledby="rare-selection-title"\s+onClick=\{\(event\) => event\.stopPropagation\(\)\}\s*>\s*<h2>/);
    expect(runtime).not.toMatch(/kraken|crest/i);
  });

  it("is blended into the shell, not pasted on it: masked to a soft circle, softened, saturation held back", () => {
    expect(crest).toContain("mask-image: radial-gradient(closest-side, #000 80%, transparent 100%)");
    expect(crest).toContain("-webkit-mask-image: radial-gradient(closest-side, #000 80%, transparent 100%)");
    const opacity = Number(crest.match(/opacity: ([\d.]+)/)[1]);

    expect(opacity).toBeGreaterThan(0.6);
    expect(opacity).toBeLessThan(1);
    expect(crest).toContain("filter: saturate(");
  });

  it("is an upright grid item beside the eyebrow and the name, undoing the shared watermark's absolute, rotated placement", () => {
    expect(sharedCss).toMatch(/\.warning-modal::before \{[^}]*position: absolute;[^}]*transform: rotate\(-18deg\);/);
    expect(crest).toContain("position: static");
    expect(crest).toContain("transform: none");
    expect(crest).toContain("grid-column: 2");
    expect(crest).toContain("grid-row: 1 / span 2");
    expect(body(SHELL)).toContain("display: grid");
    expect(body(SHELL)).toContain("grid-template-columns: minmax(0, 1fr) auto");
  });

  it("keeps the copy left-aligned and full-width below the header band, so the crest can never sit under a line of text", () => {
    expect(body(SHELL)).toContain("text-align: left");
    expect(body(`${SHELL} h2`)).toContain("grid-column: 1");
    expect(body(`${SHELL} h3`)).toContain("grid-column: 1");
    expect(body(`${SHELL} p, ${SHELL} .modal-actions`)).toBe("grid-column: 1 / -1;");
    expect(code).not.toMatch(/text-align:\s*(?:center|right)/);
    // the crest's height is what sets the header band's, through row 2 (1fr) absorbing it
    expect(body(SHELL)).toContain("grid-template-rows: auto 1fr auto auto auto");
  });

  it("scales down on phones and shifts less into the corner, still a stamp and still clear of the copy", () => {
    const desktop = Number(code.match(/--aur-warning-crest-size: ([\d.]+)rem/)[1]);
    const phone = Number(code.match(/@media \(max-width: 520px\) \{[^@]*--aur-warning-crest-size: ([\d.]+)rem/)[1]);

    expect(desktop).toBeGreaterThanOrEqual(7);
    expect(phone).toBeGreaterThanOrEqual(4.5);
    expect(phone).toBeLessThan(desktop);
    // 460px wide dialog: the crest is a quarter of it at most
    expect((desktop * 16) / 460).toBeLessThan(0.3);
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
