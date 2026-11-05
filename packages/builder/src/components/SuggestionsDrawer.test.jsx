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
    expect(runtimeSource).toMatch(/\{suggestionsDrawer && \(\s*<button\s+type="button"\s+className="suggestions-edge-tab"/);
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
    expect(tab).toContain("onClick={openSuggestions}"); // the one open handler every opener shares
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
    expect(runtimeSource).toContain("suggestionsOpenerRef={suggestionsOpenerRef}");
    // whichever control opened it comes first; if that is gone (the phone tab steps aside at the end of the page) the desktop
    // rack's opener, then the phone tab, then the box tab
    expect(drawerSource).toContain('fallbackSelector: [".box-center-suggestions", ".suggestions-edge-tab", \'[aria-controls="my-box-panel"]\'],');
    expect(drawerSource).toContain("openerRef,");
  });
});

describe("one drawer, one state, one open handler: the phone tab and the desktop rack opener share them", () => {
  const trayStart = panelSource.indexOf("function BoxSlotTray(");
  const traySource = panelSource.slice(trayStart, panelSource.indexOf("\nfunction ", trayStart + 20));
  const centerStart = traySource.indexOf("{hasSuggestionsOpener ? (");
  const center = traySource.slice(centerStart, traySource.indexOf(") : (", centerStart));

  it("the Runtime keeps ONE open state and ONE handler, and remembers which control opened the drawer", () => {
    expect(runtimeSource.match(/useState\(false\);\s*\n\s*\/\/ The control that actually opened/g)).toHaveLength(1);
    expect(runtimeSource.match(/const \[isSuggestionsOpen, setIsSuggestionsOpen\]/g)).toHaveLength(1);
    expect(runtimeSource.match(/const openSuggestions = \(event\) => \{/g)).toHaveLength(1);
    expect(runtimeSource).toContain("suggestionsOpenerRef.current = opener?.nodeType === 1 ? opener : null;");
    expect(runtimeSource).toContain("setIsSuggestionsOpen(true);");
    expect(runtimeSource.match(/setIsSuggestionsOpen\(true\)/g)).toHaveLength(1); // only inside the shared handler
  });

  it("hands the desktop rack the very same handler, and only when the Suggestions feature is on", () => {
    expect(runtimeSource).toContain("onSuggestionsOpen={suggestionsDrawer ? openSuggestions : undefined}");
    expect(panelSource).toContain("onOpenSuggestions={onSuggestionsOpen}");
    expect(panelSource).toContain("isSuggestionsOpen={isSuggestionsOpen}\n              />");
    expect(panelSource).toContain("onClick={onOpenSuggestions}");
  });

  it("the drawer is mounted once, in the panel, whoever opened it: the rack opener never mounts a drawer or computes anything", () => {
    expect(panelSource.match(/<SuggestionsDrawer/g)).toHaveLength(1);
    expect(center).not.toMatch(/SuggestionsDrawer|buildToday|useState|useEffect|fetch|getTodayContext|resolveTodayContext|recommendations/);
  });

  it("renders the centre opener ONLY in the docked (desktop) rack, and keeps the plain decorative channel everywhere else", () => {
    expect(traySource).toContain('const hasSuggestionsOpener = isCompact && typeof onOpenSuggestions === "function";');
    expect(center.startsWith("{hasSuggestionsOpener ? (")).toBe(true);
    expect(traySource).toContain('<div className="box-center-channel" aria-hidden="true" />');
    expect(panelSource).toContain("isCompact={isSummaryDocked}");
    expect(panelSource).toContain('window.matchMedia("(min-width: 981px)")'); // the docking breakpoint, reused, not a new one
  });

  it("is one native button with an accessible name, a dialog relationship and decorative visible words", () => {
    expect(center).toContain('type="button"');
    expect(center).toContain('className="box-center-suggestions"');
    expect(center).toContain('aria-haspopup="dialog"');
    expect(center).toContain("aria-expanded={isSuggestionsOpen}");
    expect(center).toContain('aria-label={translator.t("suggestions.centerOpener.aria")}');
    expect(center.match(/<button/g)).toHaveLength(1); // no nested interactive element
    expect(center).not.toMatch(/<(a|input|select|textarea)\b/);
    expect(center).toContain('<span className="box-center-suggestions__rest" aria-hidden="true">');
    expect(center).toContain('<span className="box-center-suggestions__hint" aria-hidden="true">');
    expect(center).toContain('translator.t("suggestions.centerOpener.hint")');
    // at rest the centre is only the star: the word lives in the glowing next slot
    expect(center).toContain('<span className="box-center-suggestions__mark">✦</span>');
    expect(center).not.toContain('app.suggestionsTab');
    expect(center).not.toContain('box-center-suggestions__label');
  });

  it("holds no Spanish in shared code: both lines come from the dictionary", () => {
    expect(center).not.toMatch(/SUGERENCIAS|Sugerencias|Ver recomendaciones/);
  });

  it("is not a fragrance slot: it adds no slot, no index and no handler to the rack", () => {
    expect(center.replace(/^\s*\/\/.*$/gm, "")).not.toMatch(/BoxVialSlot|onRemove|onDrop|onDragStart|slot|index/i);
  });

  it("is never part of the Collection Card or its export: the card draws its own rack and never mounts the tray", () => {
    const card = read("./CollectionCard.jsx");
    const exportStart = panelSource.indexOf("async function renderCollectionCardPng");
    const exportSource = panelSource.slice(exportStart, panelSource.indexOf("\nfunction ", exportStart + 20));

    expect(card).not.toMatch(/BoxSlotTray|box-center|Suggestions|suggestions|Sugerencias|onOpenSuggestions/);
    expect(exportSource).toContain("<CollectionCard");
    expect(exportSource).not.toMatch(/BoxSlotTray|box-center|Suggestions|suggestions|onOpenSuggestions/);
    expect(read("../builder/internal/collectionCard/buildCollectionCardViewModel.js")).not.toMatch(/uggestion|box-center/);
  });
});

describe("the glowing next slot carries the word, and opens the same drawer, in the docked rack only", () => {
  const trayStart = panelSource.indexOf("function BoxSlotTray(");
  const traySource = panelSource.slice(trayStart, panelSource.indexOf("\nfunction ", trayStart + 20));
  const slotStart = panelSource.indexOf("function BoxVialSlot(");
  const slotSource = panelSource.slice(slotStart, panelSource.indexOf("\nfunction ", slotStart + 20));
  const emptyBranch = slotSource.slice(slotSource.indexOf("if (!perfume) {"), slotSource.indexOf("const tierData"));

  it("the tray decides once, from the same flag as the centre opener, and only then swaps the slot's action and gives it the word", () => {
    expect(traySource).toContain('const hasSuggestionsOpener = isCompact && typeof onOpenSuggestions === "function";');
    expect(traySource).toContain("const nextSlotAction = hasSuggestionsOpener ? onOpenSuggestions : onNextSlotRecommendation;");
    expect(traySource).toContain('const nextSlotLabel = hasSuggestionsOpener ? translator.t("app.suggestionsTab") : undefined;');
    // both columns, nothing else
    expect(traySource.match(/onNextSlotRecommendation=\{nextSlotAction\}/g)).toHaveLength(2);
    expect(traySource.match(/suggestionsLabel=\{nextSlotLabel\}/g)).toHaveLength(2);
    expect(traySource).not.toMatch(/onNextSlotRecommendation=\{onNextSlotRecommendation\}/);
  });

  it("the label is given to the GLOWING next slot only, never to a plain empty, a filled or a reserved slot", () => {
    expect(emptyBranch).toContain('const carriesLabel = isNextAvailable && typeof suggestionsLabel === "string" && suggestionsLabel !== "";');
    expect(slotSource.slice(slotSource.indexOf("if (isReserved) {"), slotSource.indexOf("if (!perfume) {"))).not.toMatch(/suggestionsLabel|has-suggestions-label/); // the reserved branch
    expect(slotSource.slice(slotSource.indexOf("const tierData"))).not.toMatch(/suggestionsLabel|has-suggestions-label/); // the filled branch
  });

  it("keeps the slot's own markup: the plus stays in the tree (hidden by the host), and the word is a decorative extra", () => {
    expect(emptyBranch).toContain('<span className="empty-slot-add" aria-hidden="true">+</span>');
    expect(emptyBranch).toContain('<span className="vial-suggestions-label" aria-hidden="true">');
    expect(emptyBranch).toContain("{suggestionsLabel}");
    expect(emptyBranch).toContain('${carriesLabel ? " has-suggestions-label" : ""}');
  });

  it("keeps the slot's accessible name and announces the dialog it opens, only when it carries the word", () => {
    expect(emptyBranch).toContain('"collectionIntelligence.viewRecommendationsForNextSlot"');
    expect(emptyBranch).toContain('aria-haspopup={carriesLabel ? "dialog" : undefined}');
    expect(emptyBranch).toContain("aria-expanded={carriesLabel ? isSuggestionsOpen : undefined}");
  });

  it("click and Enter / Space reach the same action, and the keyboard path passes its event so focus can return to this very button", () => {
    expect(emptyBranch).toContain("onClick={isInteractiveNextAvailable ? onNextSlotRecommendation : undefined}");
    expect(emptyBranch).toContain("onNextSlotRecommendation?.(event);");
  });

  it("everywhere else the slot is exactly what it was: it scrolls to the recommendation lane, with no word and no dialog", () => {
    expect(panelSource).toContain("onNextSlotRecommendation={handleNextSlotRecommendation}");
    expect(panelSource).toContain("balanceLaneRef.current.scrollIntoView({");
    // no host opener -> nextSlotAction is the original handler and nextSlotLabel is undefined: the word is never rendered
    expect(traySource).toContain(": onNextSlotRecommendation;");
  });

  it("is live-rack only: the Collection Card never renders a slot with this word", () => {
    expect(read("./CollectionCard.jsx")).not.toMatch(/BoxVialSlot|vial-suggestions-label|has-suggestions-label/);
  });

  it("holds no Spanish: the word comes from the dictionary", () => {
    expect(emptyBranch + traySource).not.toMatch(/SUGERENCIAS|Sugerencias/);
  });
});

describe("the opener's markup in context (rendered)", () => {
  // BoxSlotTray is private to BuilderPanel, so this exercises its source exactly as the contract tests above do, plus the
  // dictionary lines it reads.
  it("has real copy in both locales: 'Sugerencias' and the longer invitation", () => {
    const es = createTranslator("es-MX");
    const en = createTranslator("en-US");

    expect(es.t("app.suggestionsTab")).toBe("Sugerencias");
    // the visible invitation carries one soft hyphen (U+00AD) where its longest word may break in the narrow rack centre
    expect(es.t("suggestions.centerOpener.hint")).toBe("Ver recomen\u00ADdaciones para completar tu caja");
    expect(es.t("suggestions.centerOpener.hint").replace(/\u00AD/g, "")).toBe("Ver recomendaciones para completar tu caja");
    expect(es.t("suggestions.centerOpener.hint").match(/\u00AD/g)).toHaveLength(1);
    expect(es.t("suggestions.centerOpener.aria")).toBe("Sugerencias: ver recomendaciones para completar tu caja");
    expect(en.t("suggestions.centerOpener.hint")).toBe("See suggestions to complete your box");
    expect(en.t("suggestions.centerOpener.aria")).toContain("Suggestions");
  });

  it("the accessible name carries the whole meaning, so nothing depends on hovering", () => {
    const es = createTranslator("es-MX");

    expect(es.t("suggestions.centerOpener.aria")).toContain(es.t("suggestions.centerOpener.hint").replace(/\u00AD/g, "").toLowerCase());
    expect(es.t("suggestions.centerOpener.aria")).not.toContain("\u00AD"); // the accessible name is plain text
    expect(es.t("suggestions.centerOpener.aria").startsWith(es.t("app.suggestionsTab"))).toBe(true);
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
    expect(drawerCode).toContain("buildTodayRoleRecommendations({ perfumes: catalogPerfumes, context: hostToday })");
    expect(drawerCode).not.toMatch(/buildTodayRoleRecommendations\([^)]*selected/);
  });

  it("'Para hoy' passes each pick's occasion label from the dictionary to its card, and only to those cards", () => {
    expect(drawerCode).toContain("occasionLabel={getTodayRoleLabel(recommendation, translator)}");
    expect(drawerCode.match(/occasionLabel=/g)).toHaveLength(1); // not the Versatility / Affinity lanes
    expect(panelSource.match(/occasionLabel=/g)).toHaveLength(1);
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

  it("shows an occasion label it is given as a plain, non-interactive span at the START of the action row, before the button", () => {
    const markup = render({ reasons: ["x"], confidenceLabel: "", occasionLabel: "Vacaciones" });
    const row = markup.slice(markup.indexOf('<div class="recommendation-actions">'));

    expect(row).toContain('<span class="recommendation-occasion">Vacaciones</span>');
    expect(row.indexOf("recommendation-occasion")).toBeLessThan(row.indexOf("<button"));
    expect(row.match(/<button/g)).toHaveLength(1); // the label is not a control: no button, role, tabindex or handler on it
    expect(row).not.toMatch(/<span class="recommendation-occasion"[^>]*(?:role|tabindex|aria-|onclick)/i);
    expect(markup.slice(0, markup.indexOf("recommendation-actions"))).not.toContain("recommendation-occasion"); // not beside "Por qué encaja"
  });

  it("keeps the action row exactly as before when there is no occasion label (Versatility and Affinity cards)", () => {
    expect(render({ reasons: ["x"], confidenceLabel: "" })).not.toContain("recommendation-occasion");
    expect(render({ reasons: ["x"], confidenceLabel: "", occasionLabel: "" })).not.toContain("recommendation-occasion");
    expect(render({})).toContain('<div class="recommendation-actions"><button type="button">Agregar a caja</button></div>');
  });

  it("an added pick keeps its label and the quiet 'Agregado' button", () => {
    const markup = render({ isAdded: true, reasons: ["x"], confidenceLabel: "", occasionLabel: "Citas" });

    expect(markup).toContain('<span class="recommendation-occasion">Citas</span>');
    expect(markup).toMatch(/<button type="button" disabled="">Agregado<\/button>/);
  });

  it("an added pick reads as added and its button is disabled", () => {
    const markup = render({ isAdded: true, reasons: ["x"], confidenceLabel: "" });

    expect(markup).toContain(">Agregado<");
    expect(markup).toMatch(/<button type="button" disabled="">Agregado<\/button>/);
  });
});
