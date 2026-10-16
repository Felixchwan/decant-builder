import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { esMX } from "../../../packages/builder/src/i18n/locales/es-MX.js";

const APP_ROOT = fileURLToPath(new URL("..", import.meta.url));
const REPOSITORY_ROOT = fileURLToPath(new URL("../../..", import.meta.url));
const read = (...segments) => readFileSync(join(...segments), "utf8").replace(/\r\n/g, "\n");

const css = read(APP_ROOT, "src", "app", "builder-modals.css");
const code = css.replace(/\/\*[\s\S]*?\*\//g, "");
const rules = [...code.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
  .map((match) => ({ selector: match[1].replace(/\s+/g, " ").trim(), body: match[2].replace(/\s+/g, " ").trim() }))
  .filter(({ selector }) => !selector.startsWith("@"));
const allSelectors = rules.flatMap(({ selector }) => selector.split(/,(?![^(]*\))/).map((part) => part.trim()));
const rule = (selector) => rules.find((candidate) => candidate.selector === selector)?.body;

const panel = read(REPOSITORY_ROOT, "packages", "builder", "src", "components", "BuilderPanel.jsx");
const runtime = read(REPOSITORY_ROOT, "packages", "builder", "src", "BuilderRuntime.jsx");
const sharedCss = read(REPOSITORY_ROOT, "packages", "builder", "styles.css");
const intelligence = read(APP_ROOT, "src", "app", "builder-intelligence.css");

// The Collection Card preview dialog (an opt-in capability only Aurelian passes) joins the family: same shell, header and "Cerrar".
const PREVIEW = ".collection-card-preview-modal";
const LEGACY_FOUR = ".composer-setup-modal, .composer-proposal-modal, .discovery-review-modal, .perfume-details-modal";
const FOUR = `${LEGACY_FOUR}, ${PREVIEW}`;
const THREE = `.composer-setup-modal, .composer-proposal-modal, .discovery-review-modal, ${PREVIEW}`;

describe("Aurelian modal chrome (builder-modals.css)", () => {
  it("is loaded by Aurelian's layout, after the shared stylesheet and every dialog stylesheet it builds on", () => {
    const layout = read(APP_ROOT, "src", "app", "layout.jsx");
    const at = (name) => layout.indexOf(`import "./${name}";`);

    expect(layout.match(/builder-modals\.css/g)).toHaveLength(1);
    ["builder-intelligence.css", "builder-note-explorer.css", "builder-review-modal.css"].forEach((name) => expect(at("builder-modals.css"), name).toBeGreaterThan(at(name)));
    expect(at("builder-modals.css")).toBeGreaterThan(layout.indexOf('import "@discovery-box/builder/styles.css";'));
  });

  it("is paint on the portalled dialogs only: every selector hangs off .builder-portal-root, no !important, no layout switch", () => {
    expect(allSelectors.length).toBeGreaterThan(20);
    allSelectors.forEach((selector) => expect(selector, selector).toMatch(/^\.builder-portal-root(?: |$)/));
    expect(code).not.toContain("!important");
    expect(code).not.toMatch(/\.builder-page|#aurelian-builder-summary-slot|\.site-header/);
    // no markup, behaviour or hit-testing is changed from here
    expect(code).not.toMatch(/pointer-events|visibility:|display: none|inert|tabindex/);
  });

  it("covers exactly the dialogs the package builds from the shared header, plus the details dialog", () => {
    expect(rule(`.builder-portal-root :is(${FOUR})`)).toContain("border-radius: 10px");
    // every one of those classes is really rendered by the shared package, on a role="dialog" element
    ["composer-setup-modal", "composer-proposal-modal", "discovery-review-modal"].forEach((name) => {
      expect(panel).toMatch(new RegExp(`className="final-summary-modal ${name}"\\s+role="dialog"`));
    });
    expect(panel).toMatch(/className="collection-card-preview-modal"\s+role="dialog"/);
    expect(runtime).toMatch(/className=\{`perfume-details-modal \$\{[\s\S]*?role="dialog"/);
    expect(runtime).toContain('className="perfume-details-close"');
  });

  it("gives all of them the one shell: the warm near-black ground, a brass rim, 10px, the same shadow and scrim", () => {
    const shell = rule(`.builder-portal-root :is(${FOUR})`);

    expect(shell).toContain("border: 1px solid var(--aur-intel-rim)");
    expect(shell).toContain("background: var(--aur-intel-card)");
    expect(shell).toContain("0 28px 90px var(--aur-intel-shadow)");
    expect(shell).toContain("inset 0 1px 0 var(--aur-intel-hair)");
    // the same shell the Note Explorer and the Biblioteca already have
    const note = read(APP_ROOT, "src", "app", "builder-note-explorer.css");

    expect(note).toMatch(/\.note-explorer-modal \{\s*border: 1px solid var\(--aur-intel-rim\);\s*border-radius: 10px;\s*background: var\(--aur-intel-card\);/);
    expect(intelligence).toMatch(/\.scent-library-modal \{[^}]*border: 1px solid var\(--aur-intel-rim\);\s*border-radius: 10px;\s*background: var\(--aur-intel-card\);/);
    // and the brass-haze scrim of the Biblioteca / DNA dialog, for the dialogs that used the package's green one
    expect(rule(".builder-portal-root .final-summary-overlay, .builder-portal-root .modal-overlay:has(> .perfume-details-modal)")).toContain("var(--aur-intel-brass-haze)");
    expect(intelligence).toMatch(/\.scent-library-overlay \{\s*background:\s*radial-gradient\(circle at 50% 8%, var\(--aur-intel-brass-haze\), transparent 36%\),\s*var\(--aur-intel-scrim\);/);
  });

  it("sets the title in the house serif, ivory, regular, and the eyebrow as the quiet brass label (no 700-900 sans, no white)", () => {
    const title = rule(`.builder-portal-root :is(${FOUR}) .modal-header h3`);
    const eyebrow = rule(`.builder-portal-root :is(${FOUR}) .modal-header > div > span`);

    expect(title).toContain("font-family: var(--aur-intel-serif)");
    expect(title).toContain("font-size: 1.5rem");
    expect(title).toContain("font-weight: 400");
    expect(title).toContain("color: var(--aur-intel-ink)");
    expect(eyebrow).toContain("color: var(--aur-intel-label)");
    expect(eyebrow).toContain("font-size: 0.6875rem");
    expect(eyebrow).toContain("letter-spacing: 0.16em");
    expect(eyebrow).toContain("text-transform: uppercase");
    // the same numbers as the Note Explorer's, the reference
    const note = read(APP_ROOT, "src", "app", "builder-note-explorer.css");

    expect(note).toMatch(/\.modal-header h3 \{[^}]*font-size: 1\.5rem;\s*font-weight: 400;\s*letter-spacing: 0\.01em;\s*line-height: 1\.15;/);
    expect(note).toMatch(/\.modal-header span \{[^}]*font-size: 0\.6875rem;\s*font-weight: 600;\s*letter-spacing: 0\.16em;\s*text-transform: uppercase;/);
    expect(code).not.toMatch(/font-weight:\s*(?:[789]\d\d|bold)/);
    expect(code).not.toMatch(/#[0-9a-f]{3,8}\b|rgba?\(\s*(?:255|248|236)/i);
    // phones: the same 1.25rem step the Note Explorer takes, DNA dialog included
    expect(rule(`.builder-portal-root :is(${FOUR}) .modal-header h3, .builder-portal-root .dna-modal-header h3`)).toBe("font-size: 1.25rem;");
  });

  it("makes every dialog's close the same quiet brass-rimmed 'Cerrar', with the brass ring and a 44px target on touch", () => {
    const close = rule(`.builder-portal-root :is(${THREE}) .modal-header button, .builder-portal-root .perfume-details-modal .perfume-details-close, .builder-portal-root .scent-library-modal .modal-header button`);

    expect(close).toContain("min-height: 2.25rem");
    expect(close).toContain("border: 1px solid var(--aur-intel-rim)");
    expect(close).toContain("border-radius: 6px");
    expect(close).toContain("background: transparent");
    expect(close).toContain("font-weight: 500");
    // 13px for the three text buttons; the two glyph closes are 0 and draw their word at 13px (below), so the group sets none
    expect(close).not.toContain("font-size");
    expect(rule(`.builder-portal-root :is(${THREE}) .modal-header button`)).toBe("font-size: 0.8125rem;");
    // the Note Explorer's own close is the reference
    expect(read(APP_ROOT, "src", "app", "builder-note-explorer.css")).toMatch(/\.modal-header button \{\s*min-height: 2\.25rem;\s*padding: 0\.4rem 0\.85rem;\s*border: 1px solid var\(--aur-intel-rim\);\s*border-radius: 6px;/);
    expect(rule(`.builder-portal-root :is(${LEGACY_FOUR}, .note-explorer-modal, ${PREVIEW}) button:focus-visible`)).toBe("outline: 2px solid var(--aur-intel-brass); outline-offset: 2px;");
    expect(code).toMatch(/@media \(pointer: coarse\) \{[^@]*min-height: 2\.75rem;/);
    // the Composer's "Volver" is the same button, one step quieter
    expect(rule(`.builder-portal-root :is(${THREE}) .modal-header button.secondary`)).toContain("border-color: var(--aur-intel-hair)");
  });

  it("draws the word where the package renders an icon-only 'X', and keeps its accessible name", () => {
    const word = [".builder-portal-root .perfume-details-modal .perfume-details-close::after", ".builder-portal-root .scent-library-modal .modal-header button::after"].join(", ");
    const hidden = rule(".builder-portal-root .perfume-details-modal .perfume-details-close, .builder-portal-root .scent-library-modal .modal-header button");

    // the glyph is hidden by size (it stays in the tree), not removed
    expect(hidden).toBe("font-size: 0;");
    expect(rule(word)).toBe(`content: "${esMX["general.close"]}"; font-size: 0.8125rem; letter-spacing: 0.04em;`);
    expect(esMX["general.close"]).toBe("Cerrar");
    // both buttons are named by aria-label, so the drawn word changes nothing a screen reader hears
    expect(runtime).toMatch(/className="perfume-details-close"[\s\S]{0,160}aria-label=\{t\("details\.close"\)\}/);
    expect(panel).toMatch(/aria-label=\{t\("scentLibrary\.close"\)\}/);
    expect(esMX["details.close"]).toBe("Cerrar detalles de fragancia");
    expect(esMX["scentLibrary.close"]).toBe("Cerrar biblioteca olfativa");
  });

  it("leaves the cross to the Biblioteca's inline note panel, the one icon close that is not a dialog's own", () => {
    expect(intelligence).toMatch(/\.scent-library-detail-header button \{[^}]*font-size: 0;/);
    expect(intelligence).toMatch(/\.scent-library-detail-header button::before,\s*\.builder-portal-root \.scent-library-detail-header button::after \{\s*content: "";/);
    expect(intelligence).not.toMatch(/\.scent-library-modal \.modal-header button(?:::before|::after|:hover|:focus-visible)?[ ,{]/);
    expect(code).not.toMatch(/scent-library-detail-header/);
  });

  it("separates the header with a brass hairline on an opaque ground that matches the dialog, and hides no content under it", () => {
    const header = rule(`.builder-portal-root :is(${FOUR}) .modal-header`);

    expect(header).toContain("border-bottom: 1px solid var(--aur-intel-hair)");
    expect(header).toContain("background: var(--aur-modal-head-ground)");
    expect(code).not.toMatch(/linear-gradient\(\s*180deg,\s*var\(--aur-modal/);
    // the flat ground is the first stop of the dialog's own gradient
    expect(intelligence).toContain("--aur-intel-card: linear-gradient(180deg, rgb(22, 19, 15), var(--bg));");
    expect(rule(".builder-portal-root")).toBe("--aur-modal-head-ground: rgb(22, 19, 15);");
    // the 20px margin the sticky header leaves is painted in the same ground, so nothing half-cut shows through
    expect(rule(`.builder-portal-root :is(${THREE}) .modal-header`)).toContain("box-shadow: 0 1.25rem 0 var(--aur-modal-head-ground)");
    expect(sharedCss).toMatch(/\.modal-header \{\s*display: flex;[^}]*margin-bottom: 20px;/);
    // no second rule 20px under it
    expect(rule(`.builder-portal-root :is(${THREE}) .modal-header + .final-summary-section`)).toBe("border-top-color: transparent;");
  });

  it("keeps the unscrolled layout where the package put it: the header's top padding is exactly cancelled", () => {
    const body = rule(`.builder-portal-root :is(${THREE}) .modal-header`);
    const padding = Number(body.match(/padding-top: ([\d.]+)rem/)[1]);
    const margin = Number(body.match(/margin-top: -([\d.]+)rem/)[1]);

    expect(padding).toBe(margin);
  });

  it("sets the Review's collection name as a title like the others, and touches no other content", () => {
    expect(rule(".builder-portal-root .discovery-review-modal .review-overview-section .review-section-heading h4")).toBe(
      "color: var(--aur-intel-ink); font-family: var(--aur-intel-serif); font-weight: 400; letter-spacing: 0.005em; text-transform: none;"
    );
    // the only body selectors in the file: the Collection Card preview dialog's own structure (an opt-in capability
    // the package gives no visual treatment), and that heading
    const body = allSelectors.filter((selector) => !/\.modal-header|\.perfume-details-close|:is\(|final-summary-overlay|modal-overlay|^\.builder-portal-root$|dna-modal-header/.test(selector));

    expect(body).toEqual([
      ".builder-portal-root .collection-card-preview-modal",
      ".builder-portal-root .collection-card-preview-header",
      ".builder-portal-root .discovery-review-modal .review-overview-section .review-section-heading h4",
    ]);
    expect(rule(".builder-portal-root .collection-card-preview-modal")).toBe(
      "width: min(760px, 94vw); max-height: min(880px, 90vh); overflow-y: auto; padding: 24px;"
    );
    expect(rule(".builder-portal-root .collection-card-preview-header")).toBe(
      "position: sticky; top: -24px; z-index: 2; align-items: flex-start; margin-bottom: 18px; padding-bottom: 16px;"
    );
    ["season-coverage", "composer-proposal-item", "summary-grid", "perfume-details-meta", "perfume-image", "note-explorer-search", "note-explorer-note", "note-explorer-result"].forEach((name) => expect(code).not.toContain(name));
  });
});

describe("Aurelian modal chrome: markup, behaviour and the other hosts are untouched", () => {
  it("keeps every close/back control, handler and id exactly as the package renders them", () => {
    expect(panel).toContain('<button type="button" onClick={requestClose} disabled={isGenerating}>{t("general.close")}</button>');
    expect(panel).toContain('<button type="button" className="secondary" onClick={onBack}>');
    expect(panel).toContain('<button type="button" onClick={onCancel}>{t("general.close")}</button>');
    expect(panel).toContain('<button type="button" onClick={onClose}>{t("general.close")}</button>');
    ["composer-setup-title", "composer-proposal-title", "discovery-review-title", "note-explorer-title"].forEach((id) => expect(panel).toContain(`id="${id}"`));
    // Escape and the scroll lock stay the package's: this stylesheet has no script and the package gained no modal code from it
    expect(panel).toContain('if (event.key === "Escape" && !isGenerating)');
    expect(runtime).toContain("handleDialogKeyDown");
  });

  it("is not loaded by, and leaves no trace in, the shared stylesheet or Discovery Decants", () => {
    expect(sharedCss).not.toMatch(/builder-modals|aur-modal-head-ground|aur-intel-/);

    const walk = (directory) =>
      readdirSync(directory).flatMap((entry) => {
        const path = join(directory, entry);

        return statSync(path).isDirectory() ? walk(path) : /\.(jsx?|css)$/.test(entry) && !/\.test\./.test(entry) ? [path] : [];
      });

    walk(join(REPOSITORY_ROOT, "src")).forEach((path) => expect(read(path), path).not.toMatch(/builder-modals|aur-modal-head-ground/));
    // the shared package's own glyph for the details close is still the typed "X" Discovery Decants renders
    expect(runtime).toMatch(/className="perfume-details-close"[\s\S]{0,200}X\s*<\/button>/);
  });
});
