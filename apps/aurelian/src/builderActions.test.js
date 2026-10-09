import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const APP_ROOT = fileURLToPath(new URL("..", import.meta.url));
const REPOSITORY_ROOT = fileURLToPath(new URL("../../..", import.meta.url));
const read = (...segments) => readFileSync(join(...segments), "utf8").replace(/\r\n/g, "\n");

const css = read(APP_ROOT, "src", "app", "builder-actions.css");
const withoutComments = css.replace(/\/\*[\s\S]*?\*\//g, "");
const rules = [...withoutComments.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
  .map(([, selector, ruleBody]) => ({ selector: selector.trim().replace(/\s+/g, " "), body: ruleBody.replace(/\s+/g, " ").trim() }))
  .filter(({ selector }) => !selector.startsWith("@"));
const body = (selector) => rules.find((rule) => rule.selector === selector)?.body;

const luminance = (hex) => {
  const channel = (offset) => {
    const value = parseInt(hex.slice(offset, offset + 2), 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
};
const contrast = (a, b) => (Math.max(luminance(a), luminance(b)) + 0.05) / (Math.min(luminance(a), luminance(b)) + 0.05);

const EXPLORE = ".builder-page .compose-box-header-actions button.secondary";
const ADD = ".builder-page .perfume-card-compact-actions button";

describe("Aurelian Builder actions (host-owned): the green tool and the card add button", () => {
  it("is loaded by Aurelian's own layout, after the zoning and collection-card files, and by nothing else", () => {
    const layout = read(APP_ROOT, "src", "app", "layout.jsx");

    expect(layout.indexOf('import "./builder-actions.css";')).toBeGreaterThan(layout.indexOf('import "./builder-zoning.css";'));
    expect(layout.indexOf('import "./builder-actions.css";')).toBeGreaterThan(layout.indexOf('import "./builder-collection-card.css";'));
    expect(read(REPOSITORY_ROOT, "src", "main.jsx")).not.toMatch(/builder-actions/);
  });

  it("scopes every rule to the Builder route and never uses !important", () => {
    expect(rules.length).toBeGreaterThan(8);
    rules.forEach(({ selector }) => {
      // the one exception is "Vaciar caja", which lives in the header-docked box card, outside .builder-page
      selector.split(",").forEach((part) => expect(part.trim(), selector).toMatch(/^(?:\.builder-page(?: |$)|#aurelian-builder-summary-slot \.builder-clear-button)/));
    });
    expect(withoutComments).not.toContain("!important");
    expect(withoutComments).not.toMatch(/transition|animation/);
  });

  it("keeps the green tokens in the Builder scope, and the green text clears 4.5:1 on its ground and its hover wash", () => {
    const tokens = body(".builder-page");
    expect(tokens).toContain("--aur-green-text: #5aa686;");
    expect(tokens).toContain("--aur-green-rim: rgba(90, 166, 134, 0.55);");
    expect(tokens).toContain("--aur-green-wash: rgba(23, 60, 50, 0.6);");
    expect(contrast("#5aa686", "#0a0d0b")).toBeGreaterThanOrEqual(4.5);
    // the wash over the near-black ground resolves to about #0f2019
    expect(contrast("#5aa686", "#0f2019")).toBeGreaterThanOrEqual(4.5);
    // the deep zone green stays a surface; it is never the text
    expect(withoutComments).not.toMatch(/(?:^|[;\s])color:\s*(?:var\(--aur-green\)|#173c32)/);
  });

  it("themes 'Explorar por nota' as a green tool: dark ground, green outline and text, green wash on hover and focus", () => {
    expect(body(EXPLORE)).toMatch(/border-color: var\(--aur-green-rim\);/);
    expect(body(EXPLORE)).toMatch(/background: rgba\(8, 11, 10, 0\.78\);/);
    expect(body(EXPLORE)).toMatch(/color: var\(--aur-green-text\);/);

    const hover = body(`${EXPLORE}:hover, ${EXPLORE}:focus-visible`);
    expect(hover).toMatch(/border-color: var\(--aur-green-text\);/);
    expect(hover).toMatch(/background: var\(--aur-green-wash\);/);
    expect(hover).toMatch(/box-shadow: 0 0 12px var\(--aur-green-glow\);/);
    // green-led focus, not the global gold ring
    expect(body(`${EXPLORE}:focus-visible`)).toMatch(/outline: 2px solid var\(--aur-green-text\);/);
  });

  it("changes nothing about 'Explorar por nota' except paint: no size, spacing, type or layout", () => {
    [EXPLORE, `${EXPLORE}:hover, ${EXPLORE}:focus-visible`, `${EXPLORE}:focus-visible`].forEach((selector) => {
      expect(body(selector), selector).not.toMatch(/(?:^|[;\s])(?:width|height|min-[\w-]+|max-[\w-]+|padding[\w-]*|margin[\w-]*|font[\w-]*|display|position|flex[\w-]*|gap)\s*:/);
    });
  });

  it("targets only that tool: not 'Armar mi caja' (the non-secondary button), 'Descargar PNG', or any brass or burgundy control", () => {
    expect(withoutComments).not.toMatch(/compose-box-header-actions button:not\(\.secondary\)/);
    expect(withoutComments).not.toMatch(/share-box/);
    // burgundy appears only in the cautionary "Vaciar caja" rule, never on the tool or the add button
    const burgundy = rules.filter(({ body: ruleBody }) => /aur-burgundy/.test(ruleBody)).map(({ selector }) => selector);
    expect(burgundy).toEqual([
      "#aurelian-builder-summary-slot .builder-clear-button:hover:not(:disabled), #aurelian-builder-summary-slot .builder-clear-button:focus-visible",
    ]);
    // the one `button.secondary` in the Composer header is the opener (see the package markup)
    const panelSource = read(REPOSITORY_ROOT, "packages", "builder", "src", "components", "BuilderPanel.jsx");
    expect(panelSource.match(/className="secondary"/g) ?? panelSource.match(/className="[^"]*\bsecondary\b[^"]*"/g)).toBeTruthy();
  });

  it("draws the add button as a brass outline by default, with no fill", () => {
    const rest = body(ADD);
    expect(rest).toMatch(/background: transparent;/);
    expect(rest).toMatch(/box-shadow: inset 0 0 0 1px rgba\(200, 166, 101, 0\.7\);/);
    expect(rest).toMatch(/color: var\(--gold\);/);
    // an inset shadow, not a border, so the button keeps its size in every state
    expect(rest).not.toMatch(/border/);
  });

  it("tints it on hover only while it can be used", () => {
    const hover = body(`${ADD}:hover:not(:disabled)`);
    expect(hover).toMatch(/background: rgba\(200, 166, 101, 0\.14\);/);
    expect(hover).toMatch(/box-shadow: inset 0 0 0 1px var\(--gold\);/);
  });

  it("fills the added button brass with dark ink, holds it through hover, and keeps it at full strength in a full box", () => {
    const added = body(`${ADD}.is-added, ${ADD}.is-added:hover:not(:disabled)`);
    expect(added).toMatch(/background: var\(--gold\);/);
    expect(added).toMatch(/color: var\(--ink\);/);
    expect(added).toMatch(/cursor: default;/);
    expect(body(`${ADD}.is-added:disabled`)).toBe("opacity: 1;");
  });

  it("outranks the hover rule with the added rule, so hovering an added button never turns it back into an outline", () => {
    // `.is-added:hover:not(:disabled)` is listed in the same rule as `.is-added`
    expect(rules.some(({ selector }) => selector.includes(`${ADD}.is-added:hover:not(:disabled)`))).toBe(true);
  });

  it("fits the longer label without changing the card: one 13px line, and the package's short label on the narrow desktop grid", () => {
    const type = rules.filter(({ selector }) => selector === ADD).find(({ body: ruleBody }) => /font-size/.test(ruleBody));
    expect(type.body).toMatch(/font-size: 13px;/);
    expect(type.body).toMatch(/white-space: nowrap;/);
    expect(css).toContain("@media (min-width: 981px) and (max-width: 1219px)");
    expect(body(`${ADD}:not(.is-added) .perfume-card-add-label-full`)).toBe("display: none;");
    expect(body(`${ADD}:not(.is-added) .perfume-card-add-label-short`)).toBe("display: inline;");
  });
});

describe("Catalog card add button: the package side stays opt-in and merchant-neutral", () => {
  const card = read(REPOSITORY_ROOT, "packages", "builder", "src", "components", "PerfumeCard.jsx");
  const runtime = read(REPOSITORY_ROOT, "packages", "builder", "src", "BuilderRuntime.jsx");

  it("Aurelian opts in; Discovery Decants does not", () => {
    expect(read(APP_ROOT, "src", "components", "BuilderExperience.jsx")).toMatch(/^\s+showAddedState\s*$/m);
    [read(REPOSITORY_ROOT, "src", "main.jsx"), read(REPOSITORY_ROOT, "src", "app", "DiscoveryDecantsApp.jsx")].forEach((source) =>
      expect(source).not.toContain("showAddedState")
    );
  });

  it("leaves the add handler, the full-box disabling and the duplicate guard exactly where they were", () => {
    expect(card).toContain("onClick={() => onAddToBox(perfume)}");
    expect(card).toContain("disabled={isDisabled}");
    expect(runtime).toContain("isDisabled={totalSlots >= MAX_SELECTABLE_SLOTS}");
    expect(runtime).toMatch(/const eligibility = canAddPerfume\(\{/);
  });

  it("derives the added state only from the box contents and the opt-in", () => {
    expect(runtime).toContain("return showAddedState && selectedPerfumes.some((selected) => selected.id === perfume.id);");
    expect(runtime.match(/isInBox=\{isPerfumeInBox\(perfume\)\}/g)).toHaveLength(2);
  });
});

describe("Vaciar caja: oxblood hover and focus, scoped to the docked box card", () => {
  const CLEAR = "#aurelian-builder-summary-slot .builder-clear-button";
  const hover = body(`${CLEAR}:hover:not(:disabled), ${CLEAR}:focus-visible`);

  it("answers hover and keyboard focus with the burgundy wash, rim and glow and ivory text", () => {
    expect(hover).toMatch(/background: var\(--aur-burgundy-wash\);/);
    expect(hover).toMatch(/color: var\(--aur-ivory\);/);
    // the button has no border (its hairline is an inset shadow), so the rim is that hairline in burgundy
    expect(hover).toMatch(/box-shadow: inset 0 0 0 1px var\(--aur-burgundy-rim\), 0 0 14px var\(--aur-burgundy-glow\);/);
  });

  it("is never bright red, never a brass fill, and leaves the resting neutral look and the gold focus ring alone", () => {
    expect(hover).not.toMatch(/#[0-9a-f]{3,6}|rgb|red|gold|--gold/i);
    // no rule restyles the button at rest: every selector for it carries :hover or :focus-visible
    rules
      .flatMap(({ selector }) => selector.split(",").map((part) => part.trim()))
      .filter((part) => part.startsWith(CLEAR))
      .forEach((part) => expect(part, part).toMatch(/:(?:hover|focus-visible)/));
    expect(hover).not.toMatch(/outline/);
  });

  it("changes no behavior, size or position: paint only, and no other control in the card is targeted", () => {
    expect(hover).not.toMatch(/width|height|padding|margin|font|display|position|transform|grid/);
    const cardRules = rules.filter(({ selector }) => selector.includes("#aurelian-builder-summary-slot"));
    expect(cardRules).toHaveLength(1);
    expect(withoutComments).not.toMatch(/review-box-button|summary-collapse-toggle/);
  });

  it("lets the existing destructive wiring through untouched: the same onClearBox, the same label", () => {
    const panel = readFileSync(join(REPOSITORY_ROOT, "packages", "builder", "src", "components", "BuilderPanel.jsx"), "utf8");
    expect(panel.match(/onClick=\{onClearBox\}/g)).toHaveLength(2);
  });
});
