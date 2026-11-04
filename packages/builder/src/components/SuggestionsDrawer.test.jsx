import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { aurelianConfig } from "../../../../apps/aurelian/src/merchant/config.js";
import { discoveryDecantsConfig } from "../../../../src/merchants/discoveryDecants/config.js";
import { ANALYTICS_EVENT_NAMES } from "../analytics/events.js";
import { createBuilderConfig } from "../builder/config/index.js";
import { createTranslator } from "../i18n/createTranslator.js";
import { RecommendationCard } from "./BuilderPanel.jsx";

// BuilderPanel and BuilderRuntime are never rendered whole in this package's tests (no jsdom), so the drawer's wiring is
// pinned as a source contract, the established pattern here; its behaviour (focus, Escape layering, scroll lock, adding,
// Product Info above it) is exercised in a real browser against the Aurelian Builder. The card it reuses IS rendered.
const read = (url) => readFileSync(fileURLToPath(new URL(url, import.meta.url)), "utf8").replace(/\r\n/g, "\n");
const panelSource = read("./BuilderPanel.jsx");
const runtimeSource = read("../BuilderRuntime.jsx");
const builderSource = read("../builder/DiscoveryBoxBuilder.jsx");

const drawerStart = panelSource.indexOf("function SuggestionsDrawer(");
const drawerSource = panelSource.slice(drawerStart, panelSource.indexOf("\n// The Collection Card, as the Download", drawerStart));
const drawerCode = drawerSource.replace(/^\s*\/\/.*$/gm, "");

describe("features.suggestionsDrawer: Aurelian only", () => {
  it("is off by default and for Discovery Decants, on for Aurelian", () => {
    expect(aurelianConfig.features.suggestionsDrawer).toBe(true);
    expect(discoveryDecantsConfig.features.suggestionsDrawer).toBe(false);
    expect(createBuilderConfig({ brand: { businessName: "Test" }, finalization: { whatsappNumber: "5210000000000" } }).features.suggestionsDrawer).toBe(false);
  });

  it("is read strictly (=== true) and gates both the edge tab and the open state the panel receives", () => {
    expect(runtimeSource).toContain("const suggestionsDrawer = builderConfig.features?.suggestionsDrawer === true;");
    expect(runtimeSource).toMatch(/\{suggestionsDrawer && \(\s*<button\s+ref=\{suggestionsTabRef\}/);
    expect(runtimeSource).toContain("isSuggestionsOpen={suggestionsDrawer && isSuggestionsOpen}");
  });

  it("the panel renders the drawer only while it is open and a portal root exists", () => {
    expect(panelSource).toMatch(/\{isSuggestionsOpen && portalRoot && \(\s*<SuggestionsDrawer/);
    expect(panelSource).toContain("isSuggestionsOpen = false,");
  });

  it("the Discovery Decants host passes neither hook, and ships no trace of the feature", () => {
    const decantsApp = read("../../../../src/main.jsx") + read("../../../../src/merchants/discoveryDecants/config.js");

    expect(decantsApp).not.toMatch(/onBoxShortcutChange|getTodayContext|suggestionsDrawer: true|Sugerencias|monterrey/i);
  });
});

describe("the edge tab (rendered by the Runtime)", () => {
  const tabIndex = runtimeSource.indexOf('className="suggestions-edge-tab"');
  const tab = runtimeSource.slice(runtimeSource.lastIndexOf("<button", tabIndex), runtimeSource.indexOf("</button>", tabIndex));

  it("is a real button that announces a dialog and its state", () => {
    expect(tab).toContain('type="button"');
    expect(tab).toContain('aria-haspopup="dialog"');
    expect(tab).toContain("aria-expanded={isSuggestionsOpen}");
    expect(tab).toContain("onClick={() => setIsSuggestionsOpen(true)}");
    expect(tab).toContain('t("app.suggestionsTab")');
  });

  it("keeps its star decorative, so the accessible name is just the word", () => {
    expect(tab).toContain('<span className="suggestions-edge-tab__mark" aria-hidden="true">');
  });

  it("is a sibling AFTER the tab bar, never a child of it (the host's floating box tab is the bar's last child)", () => {
    const navEnd = runtimeSource.indexOf("</nav>", runtimeSource.indexOf('className="mobile-builder-tabs"'));

    expect(tabIndex).toBeGreaterThan(navEnd);
    expect(runtimeSource.slice(runtimeSource.indexOf('className="mobile-builder-tabs"'), navEnd)).not.toContain("suggestions-edge-tab");
  });

  it("is the control focus returns to when the drawer closes", () => {
    expect(runtimeSource).toContain("suggestionsOpenerRef={suggestionsTabRef}");
    // the tab first, then the box tab if a host has taken the tab off the screen (it steps aside at the end of the page)
    expect(drawerSource).toContain('fallbackSelector: [".suggestions-edge-tab", \'[aria-controls="my-box-panel"]\'],');
    expect(drawerSource).toContain("openerRef,");
  });
});

describe("the drawer: a dialog on the Builder's existing infrastructure", () => {
  it("is a labelled, modal dialog in the owned portal, over a modal-overlay", () => {
    expect(drawerSource).toContain('role="dialog"');
    expect(drawerSource).toContain('aria-modal="true"');
    expect(drawerSource).toContain("aria-labelledby={titleId}");
    expect(drawerSource).toContain("tabIndex={-1}");
    expect(drawerSource).toContain('className="modal-overlay suggestions-overlay"');
    expect(drawerSource).toContain("portalRoot\n  );");
    expect(drawerSource).toContain("renderOwnedPortal(");
  });

  it("uses useModalFocus (focus in, Tab wrap, restore) and stands down while a layer is above", () => {
    expect(drawerSource).toContain("useModalFocus({");
    expect(drawerSource).toContain('initialFocusSelector: ".suggestions-header button"');
    expect(drawerSource).toContain("suspended: isDetailOpen,");
  });

  it("holds the shared, reference-counted body scroll lock for its whole mounted life, so the catalog stays where it was", () => {
    expect(drawerSource).toContain("acquireBodyScrollLock(document)");
    expect(drawerSource).toMatch(/useEffect\(\(\) => \{\s*const releaseBodyScrollLock = acquireBodyScrollLock\(document\);\s*return \(\) => releaseBodyScrollLock\(\);\s*\}, \[\]\);/);
  });

  it("closes on Escape only when no layer (Product Info, the rare-selection confirmation) is above it", () => {
    expect(drawerSource).toContain('if (event.key === "Escape" && !isDetailOpen) {');
    expect(panelSource).toContain("isDetailOpen={isLayerAboveOpen}\n          openerRef={suggestionsOpenerRef}");
  });

  it("closes on the overlay and on its own Close button, not on a click inside it", () => {
    expect(drawerSource).toContain('<div className="modal-overlay suggestions-overlay" role="presentation" onClick={onClose}>');
    expect(drawerSource).toContain("onClick={(event) => event.stopPropagation()}");
    expect(drawerSource).toContain('{t("general.close")}');
  });

  it("is a layer, not a route: it never navigates, scrolls the page or touches the catalog", () => {
    expect(drawerCode).not.toMatch(/window\.location|history\.|router|scrollTo|scrollIntoView|onMobileTabChange/);
  });

  it("recomputes 'now' only when it opens: the host callback is read once, in the mount-time state initialiser", () => {
    expect(drawerSource).toMatch(/const \[hostToday, setHostToday\] = useState\(\(\) => \{\s*try \{\s*return typeof getTodayContext === "function" \? getTodayContext\(\) : null;/);
    expect(drawerCode).not.toMatch(/setInterval|setTimeout|requestAnimationFrame/);
  });

  it("asks the host's optional async context ONCE per opening, in the background, and keeps what it had if that fails", () => {
    const effect = drawerSource.slice(drawerSource.indexOf("useEffect(() => {\n    if (typeof resolveTodayContext"), drawerSource.indexOf("useModalFocus({"));

    expect(effect).toContain('if (typeof resolveTodayContext !== "function") {');
    expect(effect).toContain(".then(() => resolveTodayContext())");
    expect(effect).toContain("if (isCurrent && resolved) {\n          setHostToday(resolved);");
    expect(effect).toContain(".catch(() => {});");
    expect(effect).toMatch(/isCurrent = false;/);
    expect(effect).toContain("}, []);"); // mount only
    expect(drawerCode).not.toMatch(/fetch\(|XMLHttpRequest|setInterval/);
  });

  it("shows a credit line only when the host supplied one, as a plain external link", () => {
    expect(drawerSource).toContain("{hostToday?.attribution?.text ? (");
    expect(drawerSource).toContain('<a href={hostToday.attribution.href} target="_blank" rel="noopener noreferrer">');
    expect(drawerCode).not.toMatch(/MET|Norway|Monterrey|api\.met\.no/);
  });

  it("treats a throwing or absent host context as no 'Para hoy', never an error", () => {
    expect(drawerSource).toContain("} catch {\n      return null;");
    expect(drawerSource).toContain("{todayPicks.length > 0 && (");
  });
});

describe("the three sections reuse what the panel already computed", () => {
  it("does not recompute any recommendation system", () => {
    // (written as patterns so this file does not itself spell the Composer core's names: the architecture gate in
    // recommendationArchitecture.test.js allows only two non-Composer files to mention them)
    expect(drawerCode).not.toMatch(/\bbuild(?!Today)\w*(Recommendations|NextImprovement\w*|IntelligenceViewModel)\b|\bcompose\w*Collection\b|\bcompute\w*Similarity\b/);
  });

  it("gets Versatility from the panel's own next-improvement result, Affinity from its own 'based on your picks'", () => {
    expect(panelSource).toContain("nextImprovementResult={nextImprovementResult}");
    expect(panelSource).toContain("basedOnYourPicks={basedOnYourPicks}");
    expect(panelSource).toContain("const nextImprovementResult = collectionIntelligence.nextImprovement;");
    expect(panelSource).toContain("const basedOnYourPicks = recommendations?.basedOnYourPicks || EMPTY_RECOMMENDATIONS;");
  });

  it("renders them with the same lane components the box panel uses", () => {
    expect(drawerCode).toMatch(/<NextImprovementSection[\s\S]*?lens="versatility"/);
    expect(drawerCode).toMatch(/<RecommendationLane[\s\S]*?recommendations=\{basedOnYourPicks\}[\s\S]*?lens="affinity"/);
    expect(drawerCode).toContain("<RecommendationCard");
  });

  it("orders them Para hoy, Versatilidad, Afinidad", () => {
    const today = drawerCode.indexOf("suggestions-today");
    const versatility = drawerCode.indexOf("<NextImprovementSection");
    const affinity = drawerCode.indexOf("<RecommendationLane");

    expect(today).toBeGreaterThan(-1);
    expect(today).toBeLessThan(versatility);
    expect(versatility).toBeLessThan(affinity);
  });

  it("hides Versatility when the box is empty or there is no result, cleanly", () => {
    expect(drawerSource).toContain("const hasVersatility = selectedCount > 0 && nextImprovementResult && nextImprovementResult.recommendations.length > 0;");
    expect(drawerCode).toContain("{hasVersatility && (");
  });

  it("shows one short prompt, from the dictionary, instead of an empty Affinity lane when the box is empty", () => {
    expect(drawerCode).toContain("{selectedCount === 0 ? (");
    expect(drawerCode).toContain('t("suggestions.affinity.empty")');
    expect(drawerCode).not.toMatch(/Agrega algunas fragancias/);
  });

  it("holds no Spanish: every word is a dictionary key", () => {
    expect(drawerCode).not.toMatch(/Sugerencias|Para hoy|Versatilidad|Afinidad|Cerrar|Monterrey/);
  });

  it("'Para hoy' ranks the whole catalog with the host's context, never the box", () => {
    expect(drawerCode).toContain("buildTodayRecommendations({ perfumes: catalogPerfumes, context: hostToday })");
    expect(drawerCode).not.toMatch(/buildTodayRecommendations\([^)]*selected/);
  });
});

describe("adding and Product Info go through the existing paths", () => {
  it("re-reports each card's Add under its section's source, through the one addPerfume path, forwarding the opener", () => {
    expect(drawerSource).toContain("const addFrom = (source) => (perfume, _reportedSource, opener) => onAddPerfume(perfume, source, opener);");
    expect(drawerSource).toContain('addFrom("suggestions_today")');
    expect(drawerSource).toContain('addFrom("suggestions_versatility")');
    expect(drawerSource).toContain('addFrom("suggestions_affinity")');
    expect(panelSource).toContain("onAddPerfume={onAddPerfume}\n          onOpenPerfumeDetails={onOpenSuggestionPerfumeDetails}");
    expect(runtimeSource).toContain("onAddPerfume={addPerfume}");
  });

  it("never closes the drawer when something is added", () => {
    expect(drawerCode).not.toMatch(/onAddPerfume\([^)]*\)[^;]*onClose|onClose\(\)[^;]*onAddPerfume/);
  });

  it("opens the one Product Info dialog, scoped to the section's picks, under a suggestions_* source", () => {
    expect(runtimeSource).toContain("function openSuggestionPerfumeDetails(perfumeId, orderedPerfumeIds, source) {");
    expect(runtimeSource).toContain("openPerfumeDetails(perfume, source, orderedPerfumeIds);");
    expect(runtimeSource).toContain("onOpenSuggestionPerfumeDetails={openSuggestionPerfumeDetails}");
    expect(drawerSource).toContain('detailsFrom("suggestions_today")');
    expect(drawerSource).toContain('detailsFrom("suggestions_versatility")');
    expect(drawerSource).toContain('detailsFrom("suggestions_affinity")');
  });

  it("adds NO analytics event: only existing events, with source strings they already accept", () => {
    expect(ANALYTICS_EVENT_NAMES.filter((name) => /suggest/.test(name))).toEqual([]);
    expect(drawerCode).not.toMatch(/analytics|ANALYTICS_EVENTS/);
  });
});

describe("the host hooks the Builder publishes", () => {
  it("documents both as optional, and passes both straight through", () => {
    expect(builderSource).toContain("props.onBoxShortcutChange");
    expect(builderSource).toContain("props.getTodayContext");
    expect(builderSource).toContain("onBoxShortcutChange={onBoxShortcutChange}");
    expect(builderSource).toContain("getTodayContext={getTodayContext}");
  });

  it("the box shortcut IS the box tab's own handler, not a copy of it", () => {
    const start = runtimeSource.indexOf("const openBoxFromHostRef = useRef(null);");
    const block = runtimeSource.slice(start, runtimeSource.indexOf("const closePerfumeDetails"));

    expect(block).toContain("openMobileBoxTab();");
    expect(block).not.toMatch(/setActiveMobileTab|savedCatalogScrollRef|scrollIntoView|scrollTo/);
  });

  it("hands out ONE stable function over a ref refreshed every render, so a host never holds a stale handler", () => {
    expect(runtimeSource).toContain("const openBoxForHost = useCallback(() => openBoxFromHostRef.current?.(), []);");
    expect(runtimeSource).toMatch(/useEffect\(\(\) => \{\s*openBoxFromHostRef\.current = \(\) => \{/);
  });

  it("publishes the count with that function, and withdraws it (null) when the Builder goes away", () => {
    expect(runtimeSource).toContain("onBoxShortcutChange({ count: totalSlots, open: openBoxForHost });");
    expect(runtimeSource).toContain("}, [onBoxShortcutChange, totalSlots, openBoxForHost]);");
    expect(runtimeSource).toMatch(/return \(\) => onBoxShortcutChange\(null\);\s*\}, \[onBoxShortcutChange\]\);/);
  });

  it("publishes nothing when no host supplied the hook", () => {
    expect(runtimeSource).toMatch(/if \(typeof onBoxShortcutChange !== "function"\) \{\s*return;/);
    expect(runtimeSource).toMatch(/if \(typeof onBoxShortcutChange !== "function"\) \{\s*return undefined;/);
  });

  it("moves focus to the box tab after the transition (the menu control that triggered it is gone)", () => {
    expect(runtimeSource).toContain("mobileBoxButtonRef.current?.focus({ preventScroll: true })");
  });
});

describe("RecommendationCard: the optional overrides the drawer uses", () => {
  const translator = createTranslator("es-MX");
  const perfume = { id: 7, name: "Noche Prueba", brand: "Casa", points: 1.5, image: "", imageFallback: "" };
  const render = (props) =>
    renderToStaticMarkup(
      <RecommendationCard recommendation={{ perfume, score: 80, explanations: [], reasons: [] }} isAdded={false} isBoxFull={false} onAddPerfume={() => {}} translator={translator} {...props} />
    );

  it("shows the reason lines it is given, instead of deriving any", () => {
    const markup = render({ reasons: ["Buena opción para la noche", "Encaja con el otoño"], confidenceLabel: "" });

    expect(markup).toContain("<p>Buena opción para la noche</p>");
    expect(markup).toContain("<p>Encaja con el otoño</p>");
  });

  it("shows no confidence pill for an empty confidence label", () => {
    expect(render({ reasons: ["x"], confidenceLabel: "" })).not.toContain("recommendation-confidence");
  });

  it("shows a confidence label it is given", () => {
    expect(render({ reasons: ["x"], confidenceLabel: "Alta" })).toContain("recommendation-confidence");
  });

  it("without overrides it derives the confidence pill exactly as it always has", () => {
    const markup = render({});

    expect(markup).toContain("recommendation-confidence recommendation-confidence-high");
    expect(markup).toContain(">Alta<");
  });

  it("an added pick reads as added and its button is disabled", () => {
    const markup = render({ isAdded: true, reasons: ["x"], confidenceLabel: "" });

    expect(markup).toContain(">Agregado<");
    expect(markup).toMatch(/<button type="button" disabled="">Agregado<\/button>/);
  });
});
