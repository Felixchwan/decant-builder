import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { createTranslator } from "../i18n/createTranslator.js";
import { buildBalanceHelpModel } from "../builder/presentation/collectionIntelligenceLabels.js";
import BalanceHelp from "./BalanceHelp.jsx";

const read = (url) => readFileSync(fileURLToPath(new URL(url, import.meta.url)), "utf8").replace(/\r\n/g, "\n");
const helpSource = read("./BalanceHelp.jsx");
const panelSource = read("./BuilderPanel.jsx");
const runtimeSource = read("../BuilderRuntime.jsx");
const builderSource = read("../builder/DiscoveryBoxBuilder.jsx");

const ROWS = ["Versatility", "Breadth", "Freshness", "Season Balance", "Signature Coherence"].map((label) => ({ label, level: 3, score: 50 }));
const model = buildBalanceHelpModel({ rows: ROWS, translator: createTranslator("es-MX") });

describe("BalanceHelp: the heading and its one info button", () => {
  const markup = renderToStaticMarkup(<BalanceHelp label="Balance de la colección" model={model} />);

  it("renders the heading text and ONE info button, closed, with an accessible name and no help in the DOM", () => {
    expect(markup).toContain('<span class="collection-balance-title">Balance de la colección</span>');
    expect(markup.match(/<button/g)).toHaveLength(1);
    expect(markup).toContain('aria-expanded="false"');
    expect(markup).toContain('aria-label="Cómo leer este balance"');
    expect(markup).toContain('type="button"');
    expect(markup).not.toContain("balance-help-panel");
    expect(markup).not.toContain("aria-controls");
  });

  it("marks the visible i decorative, so the button is announced by its name alone", () => {
    expect(markup).toContain('<span aria-hidden="true">i</span>');
  });

  it("uses no browser tooltip (no title attribute)", () => {
    expect(markup).not.toContain("title=");
  });
});

describe("BalanceHelp: interaction wiring", () => {
  it("is one component with no viewport branching and no hover: no matchMedia, innerWidth, user agent or pointer-enter", () => {
    const code = helpSource.replace(/\/\/.*$/gm, "");

    expect(code).not.toMatch(/matchMedia|innerWidth|userAgent|pointer:\s*coarse/);
    expect(code).not.toMatch(/onPointerEnter|onPointerLeave|onMouseEnter|onMouseLeave|pointerType|hover/i);
  });

  it("is a single open/closed state: no reducer, no timers", () => {
    expect(helpSource).toContain("const [isOpen, setIsOpen] = useState(false);");
    expect(helpSource).not.toMatch(/useReducer|setTimeout|setInterval|ResizeObserver/);
  });

  it("toggles on click (a tap, Enter and Space are all clicks) and exposes the state to assistive technology", () => {
    expect(helpSource).toContain("onClick={() => setIsOpen((open) => !open)}");
    expect(helpSource).toContain("aria-expanded={isOpen}");
    expect(helpSource).toContain("aria-controls={isOpen ? panelId : undefined}");
  });

  it("opens on keyboard focus only (:focus-visible), so a pointer press cannot open and then immediately close it", () => {
    expect(helpSource).toContain('event.currentTarget.matches(":focus-visible")');
    expect(helpSource).toContain("onFocus={handleButtonFocus}");
  });

  it("closes when focus leaves the button and the help, but not when it moves between them", () => {
    expect(helpSource).toContain("onBlur={handleBlur}");
    expect(helpSource).toMatch(/if \(!groupRef\.current\?\.contains\(event\.relatedTarget\)\) \{\s*setIsOpen\(false\);/);
  });

  it("closes on Escape from anywhere, returning focus to the button first when it was inside the group", () => {
    expect(helpSource).toContain('document.addEventListener("keydown", dismissOnEscape)');
    expect(helpSource).toContain('event.key !== "Escape"');
    expect(helpSource).toMatch(/if \(groupRef\.current\?\.contains\(document\.activeElement\)\) \{\s*buttonRef\.current\?\.focus\(\);\s*\}\s*setIsOpen\(false\);/);
  });

  it("closes on a press outside the group", () => {
    expect(helpSource).toContain('document.addEventListener("pointerdown", dismissOutside)');
    expect(helpSource).toContain("!groupRef.current.contains(event.target)");
  });

  it("keeps the help inside the viewport without moving the heading under what the host pins", () => {
    expect(helpSource).toContain("scrollMarginTop");
    expect(helpSource).toContain('window.scrollBy({ top: delta, behavior: "instant" })');
    expect(helpSource).toContain("panel.style.maxHeight");
  });

  it("makes the help keyboard-reachable only when it has to scroll inside itself", () => {
    expect(helpSource).toMatch(/if \(panel\.scrollHeight > panel\.clientHeight \+ 1\) \{\s*panel\.tabIndex = 0;/);
    expect(helpSource).toContain("tabIndex={-1}");
  });

  it("is a non-modal region with a name, never a tooltip role and never a focus trap", () => {
    expect(helpSource).toContain('role="region"');
    expect(helpSource).not.toContain('role="tooltip"');
    expect(helpSource).not.toMatch(/^\s+role="dialog"/m);
    expect(helpSource).not.toContain("aria-modal");
  });

  it("renders its words from the model only: no copy of its own", () => {
    const visibleStrings = helpSource.match(/>\s*[A-Za-zÁ-ú][^<>{}]*</g) || [];

    // the only literal is the decorative letter on the button
    expect(visibleStrings).toEqual([">i<"]);
  });
});

describe("showBalanceHelp: opt-in, threaded through the shared Builder", () => {
  it("defaults to false at every layer, so a host that does not pass it renders the heading exactly as before", () => {
    expect(builderSource).toContain("showBalanceHelp = false,");
    expect(runtimeSource).toContain("showBalanceHelp = false,");
    expect(panelSource.match(/showBalanceHelp = false,/g)).toHaveLength(2);
  });

  it("is passed down unchanged by every layer", () => {
    expect(builderSource).toContain("showBalanceHelp={showBalanceHelp}");
    expect(runtimeSource).toContain("showBalanceHelp={showBalanceHelp}");
    expect(panelSource).toContain("showBalanceHelp={showBalanceHelp}");
  });

  it("swaps only the heading: without the prop the original span renders, with it BalanceHelp does", () => {
    const start = panelSource.indexOf("{showBalanceHelp ? (");
    const block = panelSource.slice(start, panelSource.indexOf("<div className=\"collection-balance-list\">", start));

    expect(block).toContain("<BalanceHelp");
    expect(block).toContain("buildBalanceHelpModel({ rows: balanceRows, translator })");
    expect(block).toContain('<span>{translator?.t?.("collectionIntelligence.collectionBalance") || "Collection Balance"}</span>');
  });

  it("leaves the rows, their levels and their aria-labels exactly as they were", () => {
    const rows = panelSource.slice(panelSource.indexOf('<div className="collection-balance-list">'), panelSource.indexOf("collection-snapshot-details"));

    expect(rows).toContain("{balanceRows.map((row) => {");
    expect(rows).toContain('aria-label={`${dimensionLabel}: ${row.level} out of 5`}');
    expect(rows).toContain("{formatFiveStarRating(row.level)}");
    expect(rows).not.toContain("BalanceHelp");
  });

  it("derives the help from the same rows the section shows, never from a metric", () => {
    expect(panelSource).not.toMatch(/buildBalanceHelpModel\(\{[^}]*(score|metrics|stars)/);
  });
});
