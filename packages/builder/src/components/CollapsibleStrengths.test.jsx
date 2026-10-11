import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { createTranslator } from "../i18n/createTranslator.js";
import CollapsibleStrengths, { VISIBLE_STRENGTHS } from "./CollapsibleStrengths.jsx";

const read = (url) => readFileSync(fileURLToPath(new URL(url, import.meta.url)), "utf8").replace(/\r\n/g, "\n");
const source = read("./CollapsibleStrengths.jsx");
const panelSource = read("./BuilderPanel.jsx");
const runtimeSource = read("../BuilderRuntime.jsx");
const builderSource = read("../builder/DiscoveryBoxBuilder.jsx");

const makeItems = (count) => Array.from({ length: count }, (_, index) => ({ key: `item-${index}`, text: `Strength ${index + 1}` }));
const render = (count, locale = "es-MX") =>
  renderToStaticMarkup(<CollapsibleStrengths items={makeItems(count)} translator={createTranslator(locale)} />);
const shown = (markup) => [...markup.matchAll(/<p class="coverage-strength">([^<]*)<\/p>/g)].map((match) => match[1]);

describe("CollapsibleStrengths: collapsed", () => {
  it("shows the first three strengths, in the order given, and names how many are folded away (Spanish)", () => {
    const markup = render(10);

    expect(VISIBLE_STRENGTHS).toBe(3);
    expect(shown(markup)).toEqual(["Strength 1", "Strength 2", "Strength 3"]);
    expect(markup).toContain("+7 fortalezas más");
  });

  it("says it in English too", () => {
    expect(render(10, "en-US")).toContain("+7 more strengths");
    expect(render(4, "en-US")).toContain("+1 more strengths");
  });

  it("renders a real button that reports and controls the list", () => {
    const markup = render(5);

    expect(markup.match(/<button/g)).toHaveLength(1);
    expect(markup).toContain('type="button"');
    expect(markup).toContain('aria-expanded="false"');
    expect(markup).toMatch(/aria-controls="([^"]+)"/);
    expect(markup.match(/aria-controls="([^"]+)"/)[1]).toBe(markup.match(/<div id="([^"]+)" class="coverage-strengths">/)[1]);
  });

  it("draws the chevron as decoration only", () => {
    expect(render(5)).toContain('<span class="coverage-strengths-chevron" aria-hidden="true"></span>');
  });
});

describe("CollapsibleStrengths: three or fewer", () => {
  it.each([0, 1, 2, 3])("with %i strengths there is no control at all", (count) => {
    const markup = render(count);

    expect(markup).not.toContain("<button");
    expect(markup).not.toContain("coverage-strengths-toggle");
    expect(shown(markup)).toHaveLength(count);
  });

  it("the fourth strength is the first to need the control", () => {
    expect(render(4)).toContain("coverage-strengths-toggle");
  });
});

describe("CollapsibleStrengths: wiring", () => {
  it("only slices the list it is given: no sorting, filtering or re-ranking", () => {
    expect(source).toContain("items.slice(0, VISIBLE_STRENGTHS)");
    expect(source).not.toMatch(/\.sort\(|\.reverse\(|\.filter\(|\.reduce\(/);
  });

  it("toggles in place with one boolean, and expands to every strength", () => {
    expect(source).toContain("const [isExpanded, setIsExpanded] = useState(false);");
    expect(source).toContain("const visibleItems = isExpanded ? items : items.slice(0, VISIBLE_STRENGTHS);");
    expect(source).toContain("aria-expanded={isExpanded}");
    expect(source).not.toMatch(/createPortal|renderOwnedPortal|role="dialog"/);
  });

  it("keeps the button mounted across toggles (no key change, no conditional on isExpanded around it), so focus is never lost", () => {
    expect(source).toMatch(/\{hiddenCount > 0 && \(\s*<button/);
    expect(source).not.toMatch(/isExpanded &&\s*\(?\s*<button/);
    expect(source).not.toContain(".focus(");
  });

  it("uses the Show less label when expanded, and the count label when collapsed", () => {
    expect(source).toContain('"collectionIntelligence.showLessStrengths"');
    expect(source).toContain('"collectionIntelligence.moreStrengths", { count: hiddenCount }');
  });

  it("scrolls only the least distance needed to keep the control in view, and not on first render", () => {
    expect(source).toContain('scrollIntoView?.({ block: "nearest", inline: "nearest", behavior: "instant" })');
    expect(source).toMatch(/if \(!hasToggledRef\.current\) \{\s*return;/);
  });
});

describe("compactStrengths: opt-in, threaded through the shared Builder", () => {
  it("defaults to false at every layer", () => {
    expect(builderSource).toContain("compactStrengths = false,");
    expect(runtimeSource).toContain("compactStrengths = false,");
    expect(panelSource.match(/compactStrengths = false,/g)).toHaveLength(2);
  });

  it("is passed down unchanged by every layer", () => {
    expect(builderSource).toContain("compactStrengths={compactStrengths}");
    expect(runtimeSource).toContain("compactStrengths={compactStrengths}");
    expect(panelSource).toContain("compactStrengths={compactStrengths}");
  });

  it("hands the existing ordered strengths to the list untouched; without the prop the original list renders as before", () => {
    const start = panelSource.indexOf("compactStrengths ? (");
    const block = panelSource.slice(start, panelSource.indexOf("selectFragrancesToGenerateInsights", start));

    expect(block).toContain("items={coverageSummary.strengths.map((item) => ({");
    expect(block).toContain("text: getCoverageStrengthLabel(item, translator) || item.label,");
    expect(block).not.toMatch(/coverageSummary\.strengths\.(sort|filter|reverse|slice\(\s*3)/);
    // the default branch is the pre-existing one: first six, then a static "+N more" line
    expect(block).toContain("coverageSummary.strengths.slice(0, 6).map((item) => (");
    expect(block).toContain('className="coverage-more"');
  });

  it("does not touch how strengths or gaps are calculated, or the seasonal gaps list", () => {
    expect(panelSource).toContain("{coverageSummary.gaps.map((item) => (");
    expect(panelSource).toContain('getCoverageGapLabel(item, translator) || item.label');
  });
});
