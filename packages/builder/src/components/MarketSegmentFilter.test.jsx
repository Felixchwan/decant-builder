import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { MARKET_SEGMENTS } from "@discovery-box/catalog";
import { aurelianConfig } from "../../../../apps/aurelian/src/merchant/config.js";
import { discoveryDecantsConfig } from "../../../../src/merchants/discoveryDecants/config.js";
import { createBuilderConfig } from "../builder/config/index.js";
import { createTranslator } from "../i18n/createTranslator.js";
import { enUS } from "../i18n/locales/en-US.js";
import { esMX } from "../i18n/locales/es-MX.js";
import MarketSegmentFilter from "./MarketSegmentFilter.jsx";

// No jsdom here (see BalanceHelp.test.jsx): the closed markup is rendered, and the behaviour that needs a live DOM
// (open panel, Tab order, Escape focus restoration, outside press, clamping) is a source contract plus real-browser checks.
const read = (url) => readFileSync(fileURLToPath(new URL(url, import.meta.url)), "utf8").replace(/\r\n/g, "\n");
const componentSource = read("./MarketSegmentFilter.jsx");
const componentCode = componentSource.replace(/^\s*\/\/.*$/gm, "");
const runtimeSource = read("../BuilderRuntime.jsx");
const sharedStyles = read("../../styles.css");
const aurelianCss = read("../../../../apps/aurelian/src/app/builder-market-filter.css");
const aurelianLayout = read("../../../../apps/aurelian/src/app/layout.jsx");

const { t } = createTranslator("es-MX");
const render = (enabledSegments) => renderToStaticMarkup(<MarketSegmentFilter t={t} enabledSegments={enabledSegments} onToggleSegment={() => {}} />);

describe("MarketSegmentFilter: the closed trigger", () => {
  it("reads just 'Tipo' with a chevron when all three segments are on", () => {
    const markup = render([...MARKET_SEGMENTS]);

    expect(markup).toContain(">Tipo</span>");
    expect(markup).not.toContain("·");
    expect(markup).toContain("market-segment-filter__chevron");
    expect(markup).not.toContain("is-filtered");
  });

  it.each([
    [["arabic", "designer"], "Tipo · 2"],
    [["niche"], "Tipo · 1"],
    [[], "Tipo · 0"],
  ])("reads 'Tipo · N' as soon as anything is off (%j)", (enabled, text) => {
    const markup = render(enabled);

    expect(markup).toContain(`>${text}</span>`);
    expect(markup).toContain("is-filtered");
  });

  it("is a real button with aria-expanded=false, no aria-controls while closed, a full accessible name, and a decorative visible label", () => {
    const markup = render([...MARKET_SEGMENTS]);

    expect(markup).toContain('type="button"');
    expect(markup).toContain('aria-expanded="false"');
    expect(markup).not.toContain("aria-controls");
    expect(markup).toContain('aria-label="Tipo de fragancia: 3 de 3 activos"');
    expect(render(["niche"])).toContain('aria-label="Tipo de fragancia: 1 de 3 activos"');
    expect(render([])).toContain('aria-label="Tipo de fragancia: 0 de 3 activos"');
    expect(markup).toContain('<span class="market-segment-filter__label" aria-hidden="true">');
    expect(markup).toContain('<span class="market-segment-filter__chevron" aria-hidden="true">');
  });

  it("renders no panel, no menu role and no browser tooltip while closed", () => {
    const markup = render([...MARKET_SEGMENTS]);

    expect(markup).not.toContain("market-segment-filter__panel");
    expect(markup).not.toContain('role="menu');
    expect(markup).not.toContain("title=");
  });
});

describe("MarketSegmentFilter: the open group (source contract)", () => {
  it("is a labelled group of native checkboxes, one per segment in the canonical order, each checked from the caller's selection", () => {
    expect(componentSource).toContain('role="group"');
    expect(componentSource).toContain("aria-labelledby={titleId}");
    expect(componentSource).toContain('type="checkbox"');
    expect(componentSource).toContain("MARKET_SEGMENTS.map((segment)");
    expect(componentSource).toContain("checked={enabledSegments.includes(segment)}");
    expect(componentSource).toContain("onToggleSegment(segment, event.target.checked)");
    expect(componentCode).not.toMatch(/role="(menu|menuitem|menuitemcheckbox|listbox|option)"/);
    expect(componentSource).not.toContain("aria-checked"); // native checked state only
  });

  it("wraps each checkbox in its <label>, so the whole row (40px) toggles it", () => {
    expect(componentSource).toMatch(/<label key=\{segment\} className="market-segment-filter__option">\s*<input/);
    expect(aurelianCss).toMatch(/__option \{[^}]*min-height: 2\.5rem/);
  });

  it("exposes aria-expanded and aria-controls (only while open) on the trigger", () => {
    expect(componentSource).toContain("aria-expanded={isOpen}");
    expect(componentSource).toContain("aria-controls={isOpen ? panelId : undefined}");
    expect(componentSource).toContain("id={panelId}");
  });

  it("closes on Escape and hands focus back to the trigger first, closes on an outside press and when focus leaves the group", () => {
    expect(componentSource).toMatch(/event\.key !== "Escape"/);
    expect(componentSource.indexOf("buttonRef.current?.focus()")).toBeLessThan(componentSource.indexOf("setIsOpen(false);\n    };\n\n    document.addEventListener"));
    expect(componentSource).toContain('document.addEventListener("pointerdown", dismissOutside)');
    expect(componentSource).toContain('document.removeEventListener("pointerdown", dismissOutside)');
    expect(componentSource).toContain('document.removeEventListener("keydown", dismissOnEscape)');
    expect(componentSource).toContain("onBlur={handleBlur}");
    expect(componentSource).toMatch(/groupRef\.current\?\.contains\(event\.relatedTarget\)/);
  });

  it("never traps focus and owns no arrow-key model (Tab walks the checkboxes)", () => {
    expect(componentSource).not.toMatch(/ArrowDown|ArrowUp|Home|End"|keyCode/);
    expect(componentSource).not.toContain("tabIndex={0}");
  });

  it("keeps a right-edge clamp: the group hangs from the button's right edge if it would leave the viewport", () => {
    expect(componentSource).toContain("window.innerWidth - edge");
    expect(componentSource).toContain("is-end");
    expect(aurelianCss).toMatch(/__panel\.is-end \{\s*right: 0;\s*left: auto;/);
    expect(aurelianCss).toMatch(/max-width: calc\(100vw - 1\.5rem\)/);
  });

  it("never reaches analytics, storage or the box", () => {
    expect(componentCode).not.toMatch(/analytics|track\(|localStorage|sessionStorage|useBoxActions|box\./i);
  });
});

describe("features.marketSegmentFilter: Aurelian only", () => {
  it("is off by default, on for Aurelian, off for Discovery Decants", () => {
    expect(aurelianConfig.features.marketSegmentFilter).toBe(true);
    expect(discoveryDecantsConfig.features.marketSegmentFilter).toBe(false);
    expect(
      createBuilderConfig({ brand: { businessName: "Test" }, finalization: { whatsappNumber: "5210000000000" } }).features.marketSegmentFilter
    ).toBe(false);
  });

  it("is rendered only when the flag is strictly true, after the count, and the host default can never render it", () => {
    expect(runtimeSource).toContain("const marketSegmentFilter = builderConfig.features?.marketSegmentFilter === true;");
    expect(runtimeSource).toMatch(/\{marketSegmentFilter && \(\s*<MarketSegmentFilter/);
    expect(runtimeSource).toContain("const catalogMarketSegments = marketSegmentFilter ? enabledMarketSegments : null;");
  });

  it("keeps the shared stylesheet free of the control, so Discovery Decants ships no trace of it", () => {
    expect(sharedStyles).not.toMatch(/market-segment/);
    expect(aurelianLayout).toContain('import "./builder-market-filter.css";');
    expect(aurelianLayout.indexOf('import "./builder-market-filter.css";')).toBeGreaterThan(
      aurelianLayout.indexOf('import "@discovery-box/builder/styles.css";')
    );
  });

  it("is not imported by, or rendered in, the Discovery Decants host", () => {
    const ddEntry = read("../../../../src/main.jsx");

    expect(ddEntry).not.toMatch(/market-?segment/i);
    expect(discoveryDecantsConfig.features.marketSegmentFilter).not.toBe(true);
  });
});

describe("the selection is plain, unpersisted state that only narrows the catalog", () => {
  it("starts with all segments on and is never written to storage", () => {
    expect(runtimeSource).toContain("useState(() => [...MARKET_SEGMENTS])");
    const lines = runtimeSource.split("\n").filter((line) => /enabledMarketSegments|catalogMarketSegments|MARKET_SEGMENTS/.test(line));

    expect(lines.join("\n")).not.toMatch(/localStorage|sessionStorage|persist|setItem/);
  });

  it("reaches only the catalog view and the catalog result count, never the box, Composer or recommendations", () => {
    const users = runtimeSource.split("\n").map((line, index) => ({ line, index })).filter(({ line }) => /catalogMarketSegments|enabledMarketSegments/.test(line));
    const outside = users.filter(({ line }) => !/buildCatalogView|getCatalogResultsCount|enabledMarketSegments(: catalogMarketSegments)?,?$|useState|MarketSegmentFilter|setEnabledMarketSegments|catalogMarketSegments(,| \?|\])|handleMarketSegmentToggle|enabledSegments=|const catalogMarketSegments/.test(line));

    expect(outside.map(({ line }) => line.trim())).toEqual([]);
  });

  it("lets every combination through, the last checkbox included (no minimum-one guard)", () => {
    const handler = runtimeSource.slice(runtimeSource.indexOf("function handleMarketSegmentToggle"), runtimeSource.indexOf("function handleMarketSegmentToggle") + 400);

    expect(handler).toContain("MARKET_SEGMENTS.filter");
    expect(handler).not.toMatch(/length\s*(<=?|===)\s*[01]|return current/);
  });
});

describe("copy: es-MX and en-US stay in step", () => {
  const keys = ["label", "group", "triggerAria", "arabic", "designer", "niche"].map((key) => `filter.marketSegment.${key}`);

  it("defines every key in both locales, with the approved Spanish option names", () => {
    keys.forEach((key) => {
      expect(esMX[key], key).toBeTruthy();
      expect(enUS[key], key).toBeTruthy();
    });
    expect(esMX["filter.marketSegment.label"]).toBe("Tipo");
    expect(esMX["filter.marketSegment.arabic"]).toBe("Árabes");
    expect(esMX["filter.marketSegment.designer"]).toBe("Diseñador");
    expect(esMX["filter.marketSegment.niche"]).toBe("Nicho");
  });

  it("keeps the same interpolation placeholders in both locales", () => {
    const placeholders = (text) => [...text.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort();

    expect(placeholders(enUS["filter.marketSegment.triggerAria"])).toEqual(placeholders(esMX["filter.marketSegment.triggerAria"]));
  });
});

describe("Aurelian CSS for the control (builder-market-filter.css)", () => {
  const code = aurelianCss.replace(/\/\*[\s\S]*?\*\//g, "");

  it("scopes every rule to the Builder's catalog section", () => {
    const selectors = [...code.matchAll(/([^{}]+)\{/g)].flatMap((match) => match[1].split(",")).map((selector) => selector.trim()).filter((selector) => selector && !selector.startsWith("@"));

    expect(selectors.length).toBeGreaterThan(10);
    selectors.forEach((selector) => expect(selector, selector).toMatch(/^\.builder-page \.catalog-section /));
  });

  it("is a brass-hairline, near-black, low-radius surface that overlays rather than reflows", () => {
    expect(code).toMatch(/__panel \{[^}]*position: absolute/);
    expect(code).toMatch(/__panel \{[^}]*border: 1px solid var\(--aur-intel-rim\)/);
    expect(code).toMatch(/__panel \{[^}]*background: var\(--aur-intel-card\)/);
    expect(code).toMatch(/__panel \{[^}]*border-radius: 4px/);
  });

  it("has a visible focus state and a touch-sized hit area on coarse pointers", () => {
    expect(code).toMatch(/__trigger:focus-visible \{[^}]*outline: 2px solid/);
    expect(code).toMatch(/input\[type="checkbox"\]:focus-visible \{[^}]*outline: 2px solid/);
    expect(code).toMatch(/@media \(pointer: coarse\)/);
  });

  it("gives phones the heading its own line, then the count and the control share the next", () => {
    expect(code).toMatch(/@media \(max-width: 620px\)/);
    expect(code).toMatch(/grid-template-columns: minmax\(0, 1fr\) auto/);
    expect(code).toMatch(/> h2 \{\s*grid-column: 1 \/ -1/);
  });

  it("respects reduced motion", () => {
    expect(code).toMatch(/@media \(prefers-reduced-motion: reduce\)/);
  });
});
