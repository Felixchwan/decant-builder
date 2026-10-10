import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { enUS } from "../../../packages/builder/src/i18n/locales/en-US.js";
import { esMX } from "../../../packages/builder/src/i18n/locales/es-MX.js";

const APP_ROOT = fileURLToPath(new URL("..", import.meta.url));
const REPOSITORY_ROOT = fileURLToPath(new URL("../../..", import.meta.url));
const read = (...segments) => readFileSync(join(...segments), "utf8").replace(/\r\n/g, "\n");

const css = read(APP_ROOT, "src", "app", "builder-intelligence.css");
const sharedCss = read(REPOSITORY_ROOT, "packages", "builder", "styles.css");
const withoutComments = css.replace(/\/\*[\s\S]*?\*\//g, "");

// Flat rules plus the rules inside @media / @keyframes blocks.
const rules = [...withoutComments.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
  .map((match) => ({
    selector: match[1].replace(/\s+/g, " ").trim(),
    body: match[2].replace(/\s+/g, " ").trim(),
  }))
  .filter(({ selector }) => !selector.startsWith("@"));
const TOKEN_SELECTOR = ":is(.builder-page, .builder-portal-root)";
const tokenRule = rules.find((rule) => rule.selector === TOKEN_SELECTOR);
const componentRules = rules.filter(
  (rule) => rule !== tokenRule && !/^(from|to)$/.test(rule.selector)
);
const bodyOf = (selector) => rules.find((rule) => rule.selector === selector)?.body;

describe("Collection Intelligence: Aurelian host paint (builder-intelligence.css)", () => {
  it("is loaded by Aurelian's layout, after the shared stylesheet and the other Builder host files", () => {
    const layout = read(APP_ROOT, "src", "app", "layout.jsx");

    expect(layout.indexOf('import "./builder-intelligence.css";')).toBeGreaterThan(
      layout.indexOf('import "./builder-recommendations.css";')
    );
    expect(layout.indexOf('import "./builder-intelligence.css";')).toBeGreaterThan(
      layout.indexOf('import "@discovery-box/builder/styles.css";')
    );
  });

  it("is Aurelian-only: every selector is under .builder-page or the Builder's portal root", () => {
    expect(componentRules.length).toBeGreaterThan(60);
    componentRules.forEach(({ selector }) =>
      // top-level comma-separated selectors only (commas inside :is(...) belong to one selector)
      selector
        .split(/,(?![^(]*\))/)
        .map((part) => part.trim())
        .forEach((part) => expect(part, part).toMatch(/^\.(builder-page|builder-portal-root) /))
    );
    expect(tokenRule, "token block").toBeDefined();
  });

  it("never reaches the shared package or Discovery Decants: no file there knows these names", () => {
    ["aur-intel", "accord-evidence", "seasonal-gap-icon", "aurelianIntelCardIn"].forEach((name) => {
      expect(sharedCss, name).not.toContain(name);
    });

    const walk = (directory) =>
      readdirSync(directory).flatMap((entry) => {
        const path = join(directory, entry);

        if (statSync(path).isDirectory()) {
          return walk(path);
        }

        return /\.(jsx?|css)$/.test(entry) && !/\.test\./.test(entry) ? [path] : [];
      });
    const discoveryDecantsSources = walk(join(REPOSITORY_ROOT, "src"));

    expect(discoveryDecantsSources.length).toBeGreaterThan(5);
    discoveryDecantsSources.forEach((path) => {
      const source = read(path);

      expect(source, path).not.toMatch(/aur-intel|builder-intelligence|showAccordEvidence|accord-evidence/);
    });
  });

  it("opts in to the accord evidence card from Aurelian's BuilderExperience only", () => {
    const experience = read(APP_ROOT, "src", "components", "BuilderExperience.jsx");

    expect(experience).toMatch(/^\s+showAccordEvidence\s*$/m);
  });

  it("keeps every raw color in one token block; the component rules only read tokens", () => {
    expect(tokenRule.body).toMatch(/--aur-intel-ink:/);
    expect(tokenRule.body).toMatch(/--aur-intel-brass:/);
    expect(tokenRule.body).toMatch(/--aur-intel-label:/);

    componentRules.forEach(({ selector, body }) => {
      expect(`${selector} { ${body} }`, selector).not.toMatch(/#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(/i);
    });
  });

  it("builds on the existing Aurelian tokens instead of re-declaring their values", () => {
    expect(tokenRule.body).toContain("--aur-intel-ink: var(--aur-ivory)");
    expect(tokenRule.body).toContain("--aur-intel-brass: var(--gold)");
    expect(tokenRule.body).toContain("--aur-intel-ink-soft: var(--secondary)");
    expect(tokenRule.body).toContain("--aur-intel-ink-muted: var(--muted)");
    // and the tooling green is the one builder-actions.css defines, never a second copy
    expect(css).toContain("var(--aur-green-text)");
    expect(css).not.toMatch(/--aur-green-[a-z]+:/);
  });

  it("derives its brass and ivory strengths from the existing gold and ivory tokens, not retyped values", () => {
    ["label", "hair", "rim", "rim-strong", "wash", "glow", "mark-off", "brass-haze"].forEach((name) => {
      const declaration = tokenRule.body.match(new RegExp("--aur-intel-" + name + ": ([^;]+);"))?.[1];

      expect(declaration, name).toMatch(/^color-mix\(in srgb, var\(--gold\) \d+%, transparent\)$/);
    });
    expect(tokenRule.body).toMatch(/--aur-intel-rule: color-mix\(in srgb, var\(--aur-ivory\) \d+%, transparent\)/);
    // no near-duplicate oxblood: the existing burgundy wash is reused
    expect(tokenRule.body).toContain("--aur-intel-oxblood-glow: var(--aur-burgundy-wash)");
    // and no retyped gold, ivory or invented oxblood anywhere in the file
    expect(withoutComments).not.toMatch(/200,\s*166,\s*101|231,\s*221,\s*207|98,\s*24,\s*42/);
    // the dark ground family is the one already in use (8, 7, 6), not a new near-black
    expect(tokenRule.body).not.toMatch(/rgba\(6,\s*5,\s*5|rgba\(5,\s*4,\s*4/);
  });

  it("carries none of the rules that were verified dead or redundant", () => {
    // the legacy tooltip shell is never rendered on the evidence path Aurelian opts into
    expect(css).not.toContain("summary-metadata-chip-shell");
    // an empty season profile never renders for the catalog (no fragrance lacks season weights)
    expect(css).not.toContain("is-empty");
    // the DNA label inherits the chip's weight; restating it was redundant
    expect(css).not.toContain(".collection-dna-chips .collection-dna-chip .collection-dna-label");
  });

  it("stacks the Season Profile at phone width, keeping the same radar and copy", () => {
    expect(withoutComments).toMatch(
      /@media \(max-width: 480px\)\s*\{[\s\S]*?\.builder-page \.season-profile-panel\s*\{\s*grid-template-columns: minmax\(0, 1fr\);/
    );
    expect(withoutComments).toMatch(
      /\.builder-page \.season-profile-chart\s*\{\s*justify-self: center;\s*width: 7rem;/
    );
  });

  it("keeps the evidence card out of the focus ring business: the card is a click target, the list is the tab stop", () => {
    expect(bodyOf(".builder-page .accord-evidence:focus")).toBe("outline: none;");
    expect(bodyOf(".builder-page .accord-evidence-list:focus-visible")).toContain("outline: 2px solid var(--aur-intel-brass)");
  });

  it("uses no pure white, no neon and no cool slate/navy anywhere", () => {
    expect(withoutComments).not.toMatch(/#fff\b|#ffffff\b|\bwhite\b|rgba?\(\s*255\s*,\s*255\s*,\s*255/i);
    expect(withoutComments).not.toMatch(/#(?:0f172a|1e293b|334155|94a3b8|cbd5e1|e2e8f0|f8fafc|4ade80|86efac|bbf7d0)/i);
  });

  it("replaces the legacy pills with a low-radius chip, for traits, DNA and every metadata group", () => {
    expect(tokenRule.body).toMatch(/--aur-intel-radius-chip: [3-6]px;/);
    expect(css).not.toMatch(/999px|9999px/);

    const chipSelectors = [
      ".builder-page .collection-profile-chips span",
      ".builder-page .collection-dna-chip",
      ".builder-page .collection-snapshot .summary-tags > span, .builder-page .collection-snapshot .summary-tags > .summary-metadata-chip",
    ];

    chipSelectors.forEach((selector) => {
      expect(bodyOf(selector), selector).toContain("border-radius: var(--aur-intel-radius-chip)");
    });
  });

  it("draws the Collection Balance as five marks (no star glyphs) with the level read from data-level", () => {
    expect(css).not.toMatch(/[★☆]/);

    const meter = bodyOf(".builder-page .collection-balance-row strong");

    expect(meter).toContain("font-size: 0");
    expect(meter).toContain("mask-image: repeating-linear-gradient");

    [1, 2, 3, 4, 5].forEach((level) => {
      expect(bodyOf(`.builder-page .collection-balance-row strong[data-level="${level}"]`)).toBe(
        `--aur-intel-level: ${level};`
      );
    });
  });

  it("keeps the corrected metric names exactly as approved (the redesign changes paint, not words)", () => {
    expect(esMX["collectionIntelligence.balance.versatility"]).toBe("Versatilidad");
    expect(esMX["collectionIntelligence.balance.breadth"]).toBe("Amplitud olfativa");
    expect(esMX["collectionIntelligence.balance.freshness"]).toBe("Frescura");
    expect(esMX["collectionIntelligence.balance.seasonBalance"]).toBe("Balance de temporada");
    expect(esMX["collectionIntelligence.balance.signatureCoherence"]).toBe("Coherencia de firma");
    expect(enUS["collectionIntelligence.balance.breadth"]).toBe("Scent Breadth");
    expect(enUS["collectionIntelligence.balance.signatureCoherence"]).toBe("Signature Coherence");
  });

  it("carries the accord evidence count in both locales", () => {
    expect(enUS["collectionIntelligence.accordEvidence.countOne"]).toBe("1 fragrance");
    expect(enUS["collectionIntelligence.accordEvidence.countMany"]).toBe("{count} fragrances");
    expect(esMX["collectionIntelligence.accordEvidence.countOne"]).toBe("1 fragancia");
    expect(esMX["collectionIntelligence.accordEvidence.countMany"]).toBe("{count} fragancias");
  });

  it("styles the accord evidence card as a compact, bounded surface with a thumbnail row per fragrance", () => {
    const card = bodyOf(".builder-page .accord-evidence");
    const list = bodyOf(".builder-page .accord-evidence-list");
    const row = bodyOf(".builder-page .accord-evidence-list li");
    const thumbnail = bodyOf(".builder-page .accord-evidence-list img");

    expect(card).toContain("position: absolute");
    expect(card).toContain("border-radius: var(--aur-intel-radius-card)");
    expect(card).toContain("background: var(--aur-intel-card)");
    expect(list).toMatch(/max-height: \d+(\.\d+)?rem/);
    expect(list).toContain("overflow-y: auto");
    expect(row).toContain("grid-template-columns: 2.5rem minmax(0, 1fr)");
    expect(thumbnail).toMatch(/width: 2\.5rem; height: 2\.5rem/);
    // the surface that lets nothing through
    expect(tokenRule.body).toMatch(/--aur-intel-card: linear-gradient\(180deg, rgb\(\d+, \d+, \d+\), var\(--bg\)\);/);
  });

  it("respects reduced motion for the card's entrance", () => {
    expect(withoutComments).toMatch(
      /@media \(prefers-reduced-motion: reduce\)\s*\{\s*\.builder-page \.accord-evidence\s*\{\s*animation: none;/
    );
  });

  it("keeps touch targets usable on coarse pointers", () => {
    expect(withoutComments).toMatch(/@media \(pointer: coarse\)/);
    expect(withoutComments).toMatch(/min-height: 2\.75rem/);
  });

  it("gives 'Ver detalles' the tooling treatment (it opens a utility), with a visible keyboard outline", () => {
    const rest = bodyOf(".builder-page .collection-snapshot .details-button");
    const focus = bodyOf(".builder-page .collection-snapshot .details-button:focus-visible");

    expect(rest).toContain("border: 1px solid var(--aur-green-rim)");
    expect(rest).toContain("color: var(--aur-green-text)");
    expect(focus).toContain("outline: 2px solid var(--aur-green-text)");
    // green appears nowhere else in this file: it stays reserved for tooling
    const greenUses = componentRules.filter(({ body }) => /--aur-green-/.test(body));

    greenUses.forEach(({ selector }) => expect(selector).toContain(".details-button"));
  });

  it("styles Biblioteca olfativa on the portal root, with a drawn close mark and visible focus", () => {
    const modal = bodyOf(".builder-portal-root .scent-library-modal");

    expect(modal).toContain("background: var(--aur-intel-card)");
    expect(modal).toMatch(/width: min\(\d+px, 94vw\)/);
    expect(bodyOf(".builder-portal-root .scent-library-modal button:focus-visible")).toContain(
      "outline: 2px solid var(--aur-intel-brass)"
    );
    expect(
      bodyOf(
        ".builder-portal-root .scent-library-modal .modal-header button, .builder-portal-root .scent-library-detail-header button"
      )
    ).toContain("font-size: 0");
  });

  it("leaves a deliberate, empty home for Curator Pick artwork: a variable, no placeholder image or box", () => {
    const slot = bodyOf(".builder-page .curator-bonus-section .curator-pick-slot");
    const art = bodyOf(".builder-page .curator-bonus-section .curator-pick-slot::after");

    expect(slot).toContain("--aur-curator-pick-art: none");
    expect(art).toContain("var(--aur-curator-pick-art)");
    expect(art).toContain("mask-image: linear-gradient");
    expect(art).toContain("pointer-events: none");
    expect(css).not.toMatch(/url\(/);
    // while locked the text keeps the full width; unlocked, the lines leave the lower right clear
    expect(bodyOf(".builder-page .curator-bonus-section .curator-pick-slot.active p")).toMatch(/max-width: \d+%/);
  });

  it("uses !important only where the shared package or the markup forces it, and says why", () => {
    const important = componentRules.filter(({ body }) => body.includes("!important"));

    expect(important.map(({ selector }) => selector).sort()).toEqual([
      ".builder-page .collection-snapshot .seasonal-gaps p",
      ".builder-page .curator-bonus-section .discovery-bonus-state",
      ".builder-page .curator-bonus-section.unlocked .discovery-bonus-state",
    ]);
    expect(css).toMatch(/shared package sets its colour with !important/);
    expect(css).toMatch(/inline colour can only be beaten with !important/);
    // every one of them is a colour, nothing structural
    important.forEach(({ body }) => {
      body
        .split(";")
        .filter((declaration) => declaration.includes("!important"))
        .forEach((declaration) => expect(declaration.trim()).toMatch(/^color:/));
    });
  });

  it("replaces the typed check and the emoji with drawn marks", () => {
    expect(bodyOf(".builder-page .collection-snapshot .coverage-strength::before")).toContain('content: ""');
    expect(bodyOf(".builder-page .collection-snapshot .seasonal-gap-icon")).toBe("display: none;");
    expect(css).not.toMatch(/\\2713|\\2715|✓|✕|[\u{1F300}-\u{1FAFF}]/u);
  });

  it("paints no copy: every generated content string is empty, so no word or number can come from CSS", () => {
    expect(withoutComments.match(/content:\s*"[^"]+"/g)).toBeNull();
  });
});
