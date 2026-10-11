import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { esMX } from "../../../packages/builder/src/i18n/locales/es-MX.js";

const APP_ROOT = fileURLToPath(new URL("..", import.meta.url));
const REPOSITORY_ROOT = fileURLToPath(new URL("../../..", import.meta.url));
const read = (...segments) => readFileSync(join(...segments), "utf8").replace(/\r\n/g, "\n");

const css = read(APP_ROOT, "src", "app", "builder-note-explorer.css");
const withoutComments = css.replace(/\/\*[\s\S]*?\*\//g, "");
const rules = [...withoutComments.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
  .map((match) => ({ selector: match[1].replace(/\s+/g, " ").trim(), body: match[2].replace(/\s+/g, " ").trim() }))
  .filter(({ selector }) => !selector.startsWith("@"));
const bodyOf = (selector) => rules.find((rule) => rule.selector === selector)?.body;
const SCOPE = ".builder-portal-root .note-explorer-modal";

describe("Note Explorer in the Aurelian language (builder-note-explorer.css)", () => {
  it("is loaded by Aurelian's layout, after the shared stylesheet and the intelligence tokens it reads", () => {
    const layout = read(APP_ROOT, "src", "app", "layout.jsx");

    expect(layout.indexOf('import "./builder-note-explorer.css";')).toBeGreaterThan(layout.indexOf('import "@discovery-box/builder/styles.css";'));
    expect(layout.indexOf('import "./builder-note-explorer.css";')).toBeGreaterThan(layout.indexOf('import "./builder-intelligence.css";'));
  });

  it("is scoped to the Note Explorer alone: every selector starts at the portal root's .note-explorer-modal", () => {
    expect(rules.length).toBeGreaterThan(30);
    rules.forEach(({ selector }) =>
      selector.split(",").forEach((part) => expect(part.trim(), part).toMatch(/^\.builder-portal-root \.note-explorer-modal(?: |$|:)/))
    );
    // the Review modal and the Composer proposal share its base classes; nothing here may be keyed on them alone
    rules.forEach(({ selector }) => {
      selector.split(",").forEach((part) => {
        expect(part.trim().replace(SCOPE, "")).not.toMatch(/^\s*\.(?:final-summary-modal|final-summary-overlay)\b/);
      });
    });
    expect(css).not.toMatch(/\.composer-proposal-modal|\.final-summary-section/);
  });

  it("needs no !important, no raw colour and no pill radius: tokens, tailored radii", () => {
    expect(withoutComments).not.toContain("!important");
    expect(withoutComments).not.toMatch(/#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(/i);
    expect(withoutComments).not.toMatch(/999px|9999px|border-radius: 50%/);
    expect(withoutComments).not.toMatch(/#fff\b|\bwhite\b/i);
    // every radius is a token or a small literal (<= 10px)
    [...withoutComments.matchAll(/border-radius: ([^;]+);/g)].forEach(([, value]) => {
      expect(value, value).toMatch(/^(var\(--aur-intel-radius-(?:chip|card)\)|\d{1,2}px)$/);
      if (/px$/.test(value)) expect(parseInt(value, 10)).toBeLessThanOrEqual(10);
    });
  });

  it("restyles the pieces the user sees: title, close, search, note cells, chips, results and the add action", () => {
    expect(bodyOf(`${SCOPE} .modal-header h3`)).toContain("font-family: var(--aur-intel-serif)");
    expect(bodyOf(`${SCOPE} .modal-header h3`)).toContain("font-weight: 400");
    expect(bodyOf(`${SCOPE} .modal-header button`)).toContain("border-radius: 6px");
    expect(bodyOf(`${SCOPE} .note-explorer-search input`)).toContain("border-radius: 8px");
    expect(bodyOf(`${SCOPE} .note-explorer-note-button`)).toContain("border-radius: var(--aur-intel-radius-card)");
    expect(bodyOf(`${SCOPE} .note-explorer-selected-chip`)).toContain("border-radius: var(--aur-intel-radius-chip)");
    expect(bodyOf(`${SCOPE} .note-explorer-related-chip`)).toContain("border-radius: var(--aur-intel-radius-chip)");
    expect(bodyOf(`${SCOPE} .note-explorer-result-item`)).toContain("border-radius: var(--aur-intel-radius-card)");
    // the add action is the catalog's brass outline, not a filled pill
    const add = bodyOf(`${SCOPE} .composer-proposal-add-button`);
    expect(add).toContain("background: transparent");
    expect(add).toContain("color: var(--aur-intel-brass)");
  });

  it("keeps a visible brass focus ring on every control and 44px targets on coarse pointers", () => {
    expect(bodyOf(`${SCOPE} button:focus-visible, ${SCOPE} select:focus-visible, ${SCOPE} input:focus-visible`)).toContain(
      "outline: 2px solid var(--aur-intel-brass)"
    );
    expect(withoutComments).toMatch(/@media \(pointer: coarse\)\s*\{[\s\S]*min-height: 2\.75rem/);
  });

  it("changes no label, copy or markup: the dialog keeps its approved Spanish wording", () => {
    expect(esMX["noteExplorer.title"]).toBe("Explorar por nota");
    expect(esMX["general.close"]).toBe("Cerrar");
    expect(esMX["noteExplorer.searchPlaceholder"]).toBe("Buscar notas");
    expect(css).not.toMatch(/content:\s*"[^"]+"/);
  });

  it("leaves no trace in the shared package or Discovery Decants", () => {
    const sharedCss = read(REPOSITORY_ROOT, "packages", "builder", "styles.css");

    expect(sharedCss).not.toContain("builder-note-explorer");
    expect(sharedCss).not.toContain("aur-intel");

    const walk = (directory) =>
      readdirSync(directory).flatMap((entry) => {
        const path = join(directory, entry);

        return statSync(path).isDirectory() ? walk(path) : /\.(jsx?|css)$/.test(entry) && !/\.test\./.test(entry) ? [path] : [];
      });

    walk(join(REPOSITORY_ROOT, "src")).forEach((path) => expect(read(path), path).not.toMatch(/builder-note-explorer|aur-intel/));
  });
});
