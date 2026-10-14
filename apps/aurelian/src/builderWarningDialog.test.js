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
    // the only things that opt out of pointing are the two ornament layers (frame and crest), which must never catch a click
    expect(rules.filter(({ body: ruleBody }) => /pointer-events/.test(ruleBody)).map(({ selector }) => selector).sort()).toEqual([`${SHELL}::after`, `${SHELL}::before`]);
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
    // the squid and skull are gone; their two pseudo-elements now carry the frame and the crest (see below)
    expect(code).not.toMatch(/🦑|☠/u);
    [`${SHELL}::before`, `${SHELL}::after`].forEach((selector) => expect(body(selector), selector).not.toMatch(/font-size|rotate|content: "[^"]/));
  });

  it("gives the shell the family's ground, hairline, radius and shadow, with the caution as a burgundy rim", () => {
    const shell = body(SHELL);

    expect(shell).toContain("border: 1px solid var(--aur-burgundy-rim)");
    expect(shell).toContain("border-radius: 10px");
    // the family's ground, under a light burgundy haze around the portrait
    expect(shell).toMatch(/background: radial-gradient\([^;]*var\(--aur-burgundy-glow\)[^;]*\), var\(--aur-intel-card\);/);
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
    // the caution: set off by a brass hairline carrying one diamond, drawn on its own pseudo-elements (no border, no element)
    expect(body(`${SHELL} p.warning-footer`)).not.toContain("border-top");
    expect(body(`${SHELL} p.warning-footer::before`)).toContain("var(--aur-intel-rim)");
    expect(body(`${SHELL} p.warning-footer::after`)).toContain("rotate(45deg)");
    expect(code).not.toMatch(/font-weight:\s*(?:[89]\d\d|bold)/);
  });

  it("keeps burgundy off text and off the buttons: it is the rim, the haze, the hairline and the decorative mark", () => {
    const burgundyRules = rules.filter(({ body: ruleBody }) => /--aur-burgundy/.test(ruleBody));

    expect([...new Set(burgundyRules.map(({ selector }) => selector))].sort()).toEqual(
      [".builder-portal-root .modal-overlay:has(> .warning-modal)", SHELL, `${SHELL} .warning-footer > span`].sort()
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
    expect(runtime).toMatch(/<div className="modal-actions">\s*<button type="button" onClick=\{onConfirm\}>[\s\S]*?<button type="button" data-warning-initial-focus onClick=\{onCancel\}>/);
  });
});

describe("Rare-selection warning dialog: the Squid medallion composition (frame, portrait, one plaque)", () => {
  const CREST = "/media/warning/squid-medallion.webp";
  const frame = body(`${SHELL}::before`);
  const crest = body(`${SHELL}::after`);
  const phone = (selector) => rules.filter((rule) => rule.selector === selector).at(-1)?.body;

  it("is Aurelian's own optimized asset, a real WebP in the host's public media, light enough to load with the dialog", () => {
    const bytes = readFileSync(join(APP_ROOT, "public", "media", "warning", "squid-medallion.webp"));

    expect(bytes.subarray(0, 4).toString("ascii")).toBe("RIFF");
    expect(bytes.subarray(8, 12).toString("ascii")).toBe("WEBP");
    expect(bytes.length).toBeLessThan(120 * 1024);
    // the superseded kraken crest is gone from the host's media and from the stylesheet
    expect(readdirSync(join(APP_ROOT, "public", "media", "warning"))).toEqual(["squid-medallion.webp"]);
    expect(css).not.toContain("kraken");
    // the one picture this file references: every other ornament is a gradient
    expect([...code.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/g)].map((match) => match[1])).toEqual([CREST]);
  });

  it("is a CSS background on the shell's ::after, like the Curator Pick artwork: no element, no alt text, nothing to focus", () => {
    expect(crest).toContain('content: ""');
    expect(crest).toContain(`background: url("${CREST}") center / contain no-repeat`);
    expect(crest).toContain("pointer-events: none");
    expect(read(APP_ROOT, "src", "app", "builder-intelligence.css")).toMatch(/curator-pick-slot::after \{[^}]*pointer-events: none;/);
    // and the shared markup gains no element for it: the dialog still opens straight onto the eyebrow
    expect(runtime).toMatch(/aria-labelledby="rare-selection-title"\s+tabIndex=\{-1\}\s+onClick=\{\(event\) => event\.stopPropagation\(\)\}\s*>\s*<h2>/);
    expect(runtime).not.toMatch(/kraken|crest|medallion/i);
  });

  it("keeps its whole oval frame: not circle-masked, only the cloud-filled sides and the corners are feathered", () => {
    // sides over 8%, top and bottom over 1.5% (the finials reach the edges), and an ellipse that is full over the oval
    const layers = [
      "linear-gradient(90deg, transparent, #000 8%, #000 92%, transparent)",
      "linear-gradient(180deg, transparent, #000 1.5%, #000 98.5%, transparent)",
      "radial-gradient(ellipse 62% 62% at 50% 50%, #000 80%, transparent 100%)",
    ].join(", ");

    expect(crest).toContain(`mask-image: ${layers}`);
    expect(crest).toContain(`-webkit-mask-image: ${layers}`);
    expect(crest).toContain("mask-composite: intersect");
    expect(crest).toContain("-webkit-mask-composite: source-in");
    expect(crest).not.toMatch(/closest-side|radial-gradient\(circle/);
    // shown as it is: the shared watermark's 6% opacity is overridden, and nothing filters or blends it
    expect(crest).toContain("opacity: 1");
    expect(crest).not.toMatch(/filter:|mix-blend-mode/);
  });

  it("adds only a light haze: the portrait carries its own burgundy, so the host has no glow of its own behind it", () => {
    const shell = body(SHELL);

    expect(shell).toMatch(/radial-gradient\(ellipse 56% 100% at 82% 38%, var\(--aur-burgundy-glow\), transparent 80%\)/);
    expect(shell).toMatch(/radial-gradient\(ellipse 90% 80% at 62% 46%, var\(--aur-burgundy-glow\), transparent 76%\)/);
    // the stronger wash and the brass glow used behind the previous artwork are not stacked on this one
    expect(shell).not.toContain("--aur-burgundy-wash), transparent 82%");
    expect(shell).not.toContain("var(--aur-intel-wash), transparent)");
  });

  it("is an upright grid item at the upper right, high and close to the corner, undoing the shared watermark's placement", () => {
    expect(sharedCss).toMatch(/\.warning-modal::after \{[^}]*position: absolute;[^}]*left: -6px;/);
    expect(sharedCss).toMatch(/\.warning-modal::before \{[^}]*transform: rotate\(-18deg\);/);
    expect(crest).toContain("position: static");
    expect(crest).toContain("grid-column: 2");
    expect(crest).toContain("grid-row: 1 / -1");
    expect(crest).toContain("align-self: start");
    expect(crest).toContain("margin: 0.25rem -1rem 0 0");
    expect(frame).toContain("transform: none");
    expect(frame).toContain("opacity: 1");
    expect(body(SHELL)).toContain("display: grid");
    expect(body(SHELL)).toContain("grid-template-columns: minmax(0, 1fr) var(--aur-warning-crest)");
  });

  it("sizes the portrait fluidly: 260px at 1440, about 230 at 1280, 184 at 1024 and 768, 113-120px on a phone", () => {
    const clamp = code.match(/--aur-warning-crest: clamp\(([\d.]+)rem, ([\d.]+)vw, ([\d.]+)rem\)/);
    const px = (viewport) => Math.min(Number(clamp[3]) * 16, Math.max(Number(clamp[1]) * 16, (Number(clamp[2]) / 100) * viewport));

    expect(Math.round(px(1440))).toBeGreaterThanOrEqual(220);
    expect(Math.round(px(1440))).toBeLessThanOrEqual(280);
    expect(px(1280)).toBeGreaterThanOrEqual(220);
    expect(px(1024)).toBeGreaterThanOrEqual(170);
    expect(px(1024)).toBeLessThanOrEqual(220);
    expect(px(768)).toBeGreaterThanOrEqual(170);
    // phones: clamp(7rem, 30vw, 7.5rem) is 113px at 375, 117 at 390 and 120 from 400 up
    const small = code.match(/@media \(max-width: 700px\) \{[^@]*--aur-warning-crest: clamp\(([\d.]+)rem, ([\d.]+)vw, ([\d.]+)rem\)/);
    const phonePx = (viewport) => Math.min(Number(small[3]) * 16, Math.max(Number(small[1]) * 16, (Number(small[2]) / 100) * viewport));

    expect(phonePx(375)).toBeGreaterThanOrEqual(105);
    expect(phonePx(428)).toBeLessThanOrEqual(135);
  });

  it("widens the warning, and only the warning, enough for a real text column beside the crest", () => {
    expect(body(SHELL)).toMatch(/width: min\(44rem, 100%\)/);
    // 704px wide, 32px padding each side, the widest portrait (260px) and a 20px gap leave a 360px copy column at 1440
    expect(704 - 64 - 260 - 20).toBeGreaterThanOrEqual(350);
    // never wider than the package's own 92% ceiling on a small screen, which the host does not override
    expect(sharedCss).toMatch(/\.warning-modal \{[^}]*max-width: 92%;/);
    rules.forEach(({ selector, body: ruleBody }) => expect(ruleBody, selector).not.toMatch(/max-width|min-width/));
  });

  it("keeps the copy left-aligned in the left column, on the full width only below 700px, so the crest can never sit under text", () => {
    expect(body(SHELL)).toContain("text-align: left");
    expect(body(`${SHELL} h2, ${SHELL} h3, ${SHELL} p, ${SHELL} .modal-actions`)).toBe("grid-column: 1;");
    expect(code).not.toMatch(/text-align:\s*(?:center|right)/);
    // phones: the crest steps back into the header band and the copy below it spans both columns
    expect(code).toMatch(/@media \(max-width: 700px\) \{/);
    expect(phone(`${SHELL}::after`)).toContain("grid-row: 1 / span 2");
    expect(phone(`${SHELL} p, ${SHELL} .modal-actions`)).toBe("grid-column: 1 / -1;");
    expect(phone(SHELL)).toContain("grid-template-rows: auto 1fr auto auto auto");
  });

  it("frames the dialog with restraint: an inner hairline and eight bracket strokes, and NO line between copy and crest; thinned on phones", () => {
    expect(frame).toContain("inset: 0.5rem");
    expect(frame).toContain("z-index: -1");
    expect(frame).toContain("border: 1px solid var(--aur-intel-hair)");
    expect(frame.match(/no-repeat/g)).toHaveLength(8);
    // nothing runs vertically between the zones: no tall gradient strip, no seam, no side border
    expect(code).not.toMatch(/background:[^;]*linear-gradient\(180deg|\/ 1px 76%|seam/);
    expect(code).not.toMatch(/border-(?:left|right)\s*:/);
    expect(frame).toContain("pointer-events: none");
    expect(body(SHELL)).toContain("isolation: isolate");
    // eyebrow hairline and the caution divider are gradients on pseudo-elements, not images or icons
    expect(body(`${SHELL} h2::after`)).toContain("linear-gradient(90deg, var(--aur-intel-rim), transparent)");
    expect(body(`${SHELL} p.warning-footer::before`)).toContain("linear-gradient(90deg, transparent, var(--aur-intel-rim) 12%");
    expect(phone(`${SHELL}::before`)).toBe("background: none;");
    // below 340px the eyebrow may wrap; above it, it is held to one line beside the portrait
    expect(phone(`${SHELL} h2`)).toBe("white-space: normal;");
    expect(code).not.toMatch(/data:|<svg|content: "[^"]/);
  });
});

describe("Rare-selection warning dialog: behaviour, markup and the other hosts are untouched", () => {
  it("keeps the dialog's markup, copy keys, accessible name, Escape and scroll lock exactly as the runtime has them", () => {
    expect(runtime).toContain('className="warning-modal"');
    expect(runtime).toContain('aria-labelledby="rare-selection-title"');
    expect(runtime).toContain('<h2>{t("rareSelection.title")}</h2>');
    expect(runtime).toContain('<h3 id="rare-selection-title">{perfume.name}</h3>');
    expect(runtime).toContain('<p className="warning-footer">');
    expect(runtime).toMatch(/if \(event\.key === "Escape"\) \{[^}]*cancelAddPerfume\(\);/);
    expect(runtime).toContain("const releaseBodyScrollLock = acquireBodyScrollLock(document);");
  });

  it("gained focus management and nothing visual: a ref, tabIndex -1 and one data attribute, no new class, style or element", () => {
    const start = runtime.indexOf("function RareSelectionWarning(");
    const component = runtime.slice(start, runtime.indexOf("\nfunction ", start + 10));
    const dialogOpen = component.slice(component.indexOf('<div\n        ref={dialogRef}'), component.indexOf("<h2>"));

    expect(dialogOpen).toMatch(/ref=\{dialogRef\}\s+className="warning-modal"\s+role="dialog"\s+aria-modal="true"\s+aria-labelledby="rare-selection-title"\s+tabIndex=\{-1\}/);
    // the only classes in the component are the ones the stylesheets already style
    expect([...component.matchAll(/className="([^"]+)"/g)].map((match) => match[1])).toEqual(["modal-overlay", "warning-modal", "warning-footer", "modal-actions"]);
    expect(component).not.toMatch(/style=\{/);
    expect(component.match(/<button[^>]*data-warning-initial-focus/g)).toHaveLength(1);
    // the one attribute is on the safe action, which is the second button
    expect(component).toMatch(/<button type="button" data-warning-initial-focus onClick=\{onCancel\}>\s*\{t\("general\.cancel"\)\}/);
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
