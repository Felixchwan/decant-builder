import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import CatalogPage from "./app/catalogo/page.jsx";
import { CatalogExplorer } from "./components/CatalogExplorer.jsx";
import { CatalogPageView } from "./components/CatalogPageView.jsx";
import { buildCatalogSeasonHref, buildSeasonalFragranceHref, getExplicitSeasonWeight, parseCatalogSeason } from "./lib/catalogSeason.js";
import { resolveCatalogFragranceIntent } from "./lib/resolveCatalogFragranceIntent.js";
import { filterCatalog } from "./lib/filterCatalog.js";
import { SEASONAL_SLOTS } from "./lib/seasonalSelection.js";
import { aurelianCatalog } from "./merchant/catalog.js";

const APP_ROOT = fileURLToPath(new URL("..", import.meta.url));
const REPOSITORY_ROOT = fileURLToPath(new URL("../../..", import.meta.url));
const read = (...segments) => readFileSync(join(...segments), "utf8");

const css = read(APP_ROOT, "src", "app", "catalog-controls.css").replace(/\/\*[\s\S]*?\*\//g, "");
const rules = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(([, selector, body]) => ({ selector: selector.trim(), body })).filter(({ selector }) => !selector.startsWith("@"));

// The Temporada select: its options and which one is selected.
function seasonSelect(markup) {
  const match = markup.match(/<label>Temporada<select[^>]*>([\s\S]*?)<\/select><\/label>/);
  if (!match) return null;
  const options = [...match[1].matchAll(/<option value="([^"]+)"([^>]*)>([^<]*)<\/option>/g)].map(([, value, attrs, label]) => ({ value, label, selected: /selected/.test(attrs) }));
  return options;
}

function sourceFiles(directory) {
  return readdirSync(directory).flatMap((entry) => {
    if (["node_modules", ".next", "dist"].includes(entry)) return [];
    const path = join(directory, entry);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.(?:[cm]?[jt]sx?|css)$/.test(entry) && !/\.test\.[cm]?[jt]sx?$/.test(entry) ? [path] : [];
  });
}

describe("the manual season filter (a control for the existing seasonal mode)", () => {
  it("is a labelled select after Search and Points, with Todas first and the four seasons by their approved names", () => {
    const markup = renderToStaticMarkup(<CatalogPageView />);
    const labels = [...markup.matchAll(/<div class="catalog-controls"[\s\S]*?<\/div>/g)][0][0].match(/<label>[^<]+/g).map((label) => label.replace("<label>", ""));
    expect(labels).toEqual(["Buscar fragancia o casa", "Puntos por fragancia", "Temporada"]);
    expect(seasonSelect(markup)).toEqual([
      { value: "all", label: "Todas", selected: true },
      { value: "spring", label: "Primavera", selected: false },
      { value: "summer", label: "Verano", selected: false },
      { value: "fall", label: "Otoño", selected: false },
      { value: "winter", label: "Invierno", selected: false },
    ]);
    // The option values are exactly the public query contract, and the labels the landing's own slots.
    expect(seasonSelect(markup).slice(1).map(({ value, label }) => [value, label])).toEqual(SEASONAL_SLOTS.map(({ key, label }) => [key, label]));
  });

  it("shows what the URL says: each valid season selects its own option, 'fall' displays as Otoño", () => {
    for (const { key, label } of SEASONAL_SLOTS) {
      const options = seasonSelect(renderToStaticMarkup(<CatalogPageView season={key} />));
      expect(options.filter(({ selected }) => selected)).toEqual([{ value: key, label, selected: true }]);
    }
    expect(seasonSelect(renderToStaticMarkup(<CatalogPageView season="fall" />)).find(({ selected }) => selected).label).toBe("Otoño");
  });

  it("falls back to Todas for a missing or invalid season, without throwing", () => {
    for (const bad of ["autumn", "primavera", "SPRING", "", undefined, null, ["spring", "summer"]]) {
      const season = parseCatalogSeason(bad);
      expect(season).toBeNull();
      const options = seasonSelect(renderToStaticMarkup(<CatalogPageView season={season} />));
      expect(options.filter(({ selected }) => selected).map(({ value }) => value)).toEqual(["all"]);
    }
    expect(seasonSelect(renderToStaticMarkup(<CatalogPage />)).find(({ selected }) => selected).value).toBe("all");
  });

  it("drives the same seasonal mode as a deep link: the same page, the same list and the same count", () => {
    for (const { key, label } of SEASONAL_SLOTS) {
      const deepLink = renderToStaticMarkup(<CatalogPageView season={key} />);
      const expected = filterCatalog(aurelianCatalog, "", "all", key);
      expect(deepLink).toContain(`data-season="${key}"`);
      expect(deepLink).toContain(`${expected.length} fragancias de ${label.toLowerCase()}`);
      expect(deepLink).not.toContain("de 92 fragancias");
      expect([...deepLink.matchAll(/class="product-card[^"]*" data-fragrance-id="(\d+)"/g)].map((match) => Number(match[1]))).toEqual(expected.map(({ id }) => id));
    }
  });

  it("still combines with search and points inside the season, in the existing seasonal order", () => {
    const result = filterCatalog(aurelianCatalog, "dior", "1", "fall");
    expect(result.every((item) => item.seasons.includes("fall") && item.points === 1 && /dior/i.test(`${item.brand} ${item.name}`))).toBe(true);
    // Ranking semantics are unchanged: scored before unscored, descending weight.
    const weights = filterCatalog(aurelianCatalog, "", "all", "winter").map((item) => getExplicitSeasonWeight(item, "winter"));
    const firstUnscored = weights.indexOf(null);
    expect(weights.slice(0, firstUnscored).every((weight, index, all) => index === 0 || all[index - 1] >= weight)).toBe(true);
    expect(weights.slice(firstUnscored).every((weight) => weight === null)).toBe(true);
  });
});

describe("the select writes the URL (buildCatalogSeasonHref)", () => {
  it("sets a valid season and keeps every other param exactly where it was", () => {
    expect(buildCatalogSeasonHref("", "spring")).toBe("/catalogo?season=spring");
    expect(buildCatalogSeasonHref("?fragrance=210", "fall")).toBe("/catalogo?fragrance=210&season=fall");
    expect(buildCatalogSeasonHref("?season=fall&fragrance=210", "winter")).toBe("/catalogo?season=winter&fragrance=210");
    expect(buildCatalogSeasonHref("?fragrance=210&foo=bar&season=spring&x=1", "summer")).toBe("/catalogo?fragrance=210&foo=bar&season=summer&x=1");
  });

  it("'Todas' removes only the season param", () => {
    expect(buildCatalogSeasonHref("?season=fall", null)).toBe("/catalogo");
    expect(buildCatalogSeasonHref("?season=fall&fragrance=210", null)).toBe("/catalogo?fragrance=210");
    expect(buildCatalogSeasonHref("?fragrance=210&foo=bar&season=winter", null)).toBe("/catalogo?fragrance=210&foo=bar");
    expect(buildCatalogSeasonHref("", null)).toBe("/catalogo");
  });

  it("never writes an invalid season, and collapses repeated or invalid ones", () => {
    expect(buildCatalogSeasonHref("?season=fall", "autumn")).toBe("/catalogo");
    expect(buildCatalogSeasonHref("?season=spring&season=summer", "fall")).toBe("/catalogo?season=fall");
    expect(buildCatalogSeasonHref("?season=bogus&fragrance=3", "winter")).toBe("/catalogo?season=winter&fragrance=3");
    expect(buildCatalogSeasonHref("?season=spring&season=summer&a=1", null)).toBe("/catalogo?a=1");
  });
});

describe("the select is wired to the existing implementation, not a parallel one", () => {
  const source = read(APP_ROOT, "src", "components", "CatalogExplorer.jsx");

  it("reads the season from the URL-derived prop and navigates with the router, keeping the page's state", () => {
    expect(source).toContain("useOptimistic(urlSeason)");
    expect(source).toContain("parseCatalogSeason(value)");
    expect(source).toContain("buildCatalogSeasonHref(window.location.search, next)");
    expect(source).toContain("router.push(href, { scroll: false })");
    expect(source).toContain('value={season ?? "all"}');
    expect(source).toContain("SEASONAL_SLOTS.map(({ key, label }) => <option");
  });

  it("filters through the one shared filterCatalog call: no second seasonal filter or ranking in the component", () => {
    expect(source.match(/filterCatalog\(/g)).toHaveLength(1);
    expect(source).toContain("filterCatalog(aurelianCatalog, query, points, season)");
    expect(source).not.toMatch(/\.seasons\b|seasonWeights|getExplicitSeasonWeight|rankBySeasonalRelevance/);
  });

  it("renders without a router (static render) and still shows the control", () => {
    expect(() => renderToStaticMarkup(<CatalogExplorer />)).not.toThrow();
    expect(seasonSelect(renderToStaticMarkup(<CatalogExplorer season="winter" />)).find(({ selected }) => selected).value).toBe("winter");
  });
});

describe("catalog density and control layout (host-owned CSS)", () => {
  it("keys every rule on the standalone catalog page, so the Builder's own catalog controls are never touched", () => {
    expect(rules.length).toBeGreaterThan(4);
    rules.forEach(({ selector }) => {
      selector.split(",").map((part) => part.trim()).forEach((part) => {
        expect(part, part).toMatch(/^\.catalog-page/);
        expect(part, part).not.toMatch(/builder/i);
      });
    });
    expect(css).not.toContain("!important");
  });

  it("lays the three controls out proportionally (fractions, never fixed pixels), wrapping and stacking on narrow screens", () => {
    const controls = rules.find(({ selector }) => selector === ".catalog-page .catalog-controls").body;
    expect(controls).toMatch(/grid-template-columns:\s*minmax\(0,\s*11fr\)\s*minmax\(0,\s*4fr\)\s*minmax\(0,\s*4fr\)/);
    expect(css).not.toMatch(/grid-template-columns:[^;]*\d+px/);
    expect(css).toMatch(/@media \(max-width: 720px\)[\s\S]*repeat\(2,\s*minmax\(0,\s*1fr\)\)/);
    expect(css).toMatch(/\.catalog-controls > label:first-child\s*\{\s*grid-column:\s*1 \/ -1/);
    expect(css).toMatch(/@media \(max-width: 560px\)[\s\S]*grid-template-columns:\s*minmax\(0,\s*1fr\)/);
  });

  it("tightens the opening without touching the type: padding and margins only", () => {
    expect(css).not.toMatch(/font-size|line-height|letter-spacing|font-family/);
    const hero = rules.find(({ selector }) => selector === ".catalog-page").body;
    expect(hero).toMatch(/padding-block:/);
    // It loads after the generic page-intro and controls rules it refines, and after the seasonal file.
    const layout = read(APP_ROOT, "src", "app", "layout.jsx");
    expect(layout.indexOf('import "./catalog-controls.css";')).toBeGreaterThan(layout.indexOf('import "./globals.css";'));
    expect(layout.indexOf('import "./catalog-controls.css";')).toBeGreaterThan(layout.indexOf('import "./catalog-seasons.css";'));
  });

  it("keeps the touch size and leaves the cards alone", () => {
    expect(read(APP_ROOT, "src", "app", "globals.css")).toMatch(/\.catalog-page \.catalog-controls input,\.catalog-page \.catalog-controls select \{ width:100%; min-height:3rem/);
    expect(css).not.toMatch(/product-card|catalog-explorer-grid/);
  });

  it("is host-owned: no trace in the Builder, the shared packages or Discovery Decants", () => {
    const trace = /catalog-controls\.css|buildCatalogSeasonHref|catalogSeasonFilter/;
    const files = [
      ...sourceFiles(join(REPOSITORY_ROOT, "packages", "builder", "src")),
      join(REPOSITORY_ROOT, "packages", "builder", "styles.css"),
      ...sourceFiles(join(REPOSITORY_ROOT, "packages", "catalog", "src")),
      ...sourceFiles(join(REPOSITORY_ROOT, "src")),
    ];
    files.forEach((file) => expect(read(file), file).not.toMatch(trace));
    for (const file of ["BuilderExperience.jsx", "BuilderMount.jsx", "SeasonalFeaturedSelection.jsx", "LandingHowItWorks.jsx", "SocialFollow.jsx"]) {
      expect(read(APP_ROOT, "src", "components", file), file).not.toMatch(trace);
    }
  });
});

describe("landing handoff: season + fragrance (buildSeasonalFragranceHref)", () => {
  it("writes season first, then the fragrance, using the catalog's existing ?fragrance= contract", () => {
    expect(buildSeasonalFragranceHref("fall", 4)).toBe("/catalogo?season=fall&fragrance=4");
    expect(buildSeasonalFragranceHref("winter", "5")).toBe("/catalogo?season=winter&fragrance=5");
  });

  it("degrades to the season alone, or the plain catalog, rather than writing values the catalog would ignore", () => {
    expect(buildSeasonalFragranceHref("fall", "abc")).toBe("/catalogo?season=fall");
    expect(buildSeasonalFragranceHref("fall", 0)).toBe("/catalogo?season=fall");
    expect(buildSeasonalFragranceHref("fall", undefined)).toBe("/catalogo?season=fall");
    expect(buildSeasonalFragranceHref("autumn", 4)).toBe("/catalogo?fragrance=4");
    expect(buildSeasonalFragranceHref(null, null)).toBe("/catalogo");
  });

  it("the link the helper writes round-trips through the page's own parsing", () => {
    const url = new URL(buildSeasonalFragranceHref("fall", 4), "https://example.test");
    expect(parseCatalogSeason(url.searchParams.getAll("season"))).toBe("fall");
    expect(resolveCatalogFragranceIntent(url.search, aurelianCatalog)?.name).toBe("Legend EDT");
  });
});

describe("season + fragrance: the target is looked up in the rendered seasonal result", () => {
  const legend = aurelianCatalog.find((item) => item.name === "Legend EDT");
  const acqua = aurelianCatalog.find((item) => item.name === "Acqua di Gio EDT");
  const cardIds = (markup) => [...markup.matchAll(/class="product-card[^"]*" data-fragrance-id="(\d+)"/g)].map((match) => Number(match[1]));
  // The page hands CatalogPageView the validated season (the page itself suspends on its promise, which a static render can't await).
  const page = (params) => renderToStaticMarkup(<CatalogPageView season={parseCatalogSeason(params.season)} />);

  it("season=fall&fragrance=<Legend>: the Fall filter applies and the rendered cards include Legend EDT", () => {
    expect(resolveCatalogFragranceIntent(`?season=fall&fragrance=${legend.id}`, aurelianCatalog)?.id).toBe(legend.id);
    const markup = page({ season: "fall", fragrance: String(legend.id) });
    expect(cardIds(markup)).toContain(legend.id);
    expect(cardIds(markup).length).toBeLessThan(aurelianCatalog.length);
  });

  it("a fragrance not compatible with the season is never rendered, so there is nothing to scroll to or highlight, and the season stays", () => {
    const markup = page({ season: "winter", fragrance: String(acqua.id) });
    expect(acqua.seasons).not.toContain("winter");
    expect(cardIds(markup)).not.toContain(acqua.id);
    expect(seasonSelect(markup).find(({ selected }) => selected).value).toBe("winter");
    // the highlight class is applied only by the client effect after a card has been brought into view
    expect(markup).not.toContain("product-card--highlighted");
  });

  it("an invalid or repeated fragrance id resolves to no target and never throws; the season filter is untouched", () => {
    for (const bad of ["abc", "0", "-3", "1.5", "99999", "4abc", ""]) {
      const search = `?season=fall&fragrance=${bad}`;
      expect(() => resolveCatalogFragranceIntent(search, aurelianCatalog)).not.toThrow();
      expect(resolveCatalogFragranceIntent(search, aurelianCatalog)).toBeNull();
    }
    expect(resolveCatalogFragranceIntent("?season=fall&fragrance=4&fragrance=5", aurelianCatalog)).toBeNull();
    const markup = page({ season: "fall", fragrance: "abc" });
    expect(cardIds(markup).length).toBeGreaterThan(0);
    expect(seasonSelect(markup).find(({ selected }) => selected).value).toBe("fall");
  });

  it("an invalid season falls back to the full catalog, and a valid fragrance is still resolved against it", () => {
    const markup = page({ season: "autumn", fragrance: String(legend.id) });
    expect(cardIds(markup)).toHaveLength(aurelianCatalog.length);
    expect(resolveCatalogFragranceIntent(`?season=autumn&fragrance=${legend.id}`, aurelianCatalog)?.id).toBe(legend.id);
  });
});

describe("the requested card's emphasis is temporary and respects reduced motion", () => {
  const source = read(APP_ROOT, "src", "components", "CatalogExplorer.jsx");
  const globals = read(APP_ROOT, "src", "app", "globals.css").replace(/\r\n/g, "\n");

  it("highlights only after the card is brought into view, for a bounded time, and clears the timer on cleanup", () => {
    expect(source).toContain("const CATALOG_HIGHLIGHT_MS = 2600;");
    expect(source).toContain("setHighlightedId(requestedFragrance.id);");
    expect(source).toContain("window.setTimeout(() => setHighlightedId(null), CATALOG_HIGHLIGHT_MS)");
    expect(source).toContain("window.clearTimeout(timer);");
    // the class follows the temporary id, never the standing request
    expect(source).toContain('highlightedId === item.id ? " product-card--highlighted"');
    expect(source).not.toContain('requestedFragrance?.id === item.id ? " product-card--highlighted"');
  });

  it("scrolls the rendered card, with no smooth scrolling under reduced motion, and keeps focus handling", () => {
    expect(source).toContain('window.matchMedia?.("(prefers-reduced-motion: reduce)").matches');
    expect(source).toContain('behavior: reduceMotion ? "auto" : "smooth"');
    expect(source).toContain('block: "center"');
    expect(source).toContain("card.focus({ preventScroll: true });");
    expect(source).toContain("if (!requestedFragrance || !requestedCardRef.current) return undefined;");
  });

  it("emphasizes with border colour and shadow only, and fades only when motion is allowed", () => {
    const rule = globals.match(/\.product-card--highlighted \{([^}]*)\}/)[1];
    expect(rule).toMatch(/border-color:var\(--gold\)/);
    expect(rule).toMatch(/var\(--aur-burgundy-glow\)/);
    expect(rule).not.toMatch(/(?:^|[;\s])(?:width|height|margin|padding|transform|animation|top|left)\s*:/);
    expect(globals).toMatch(/@media \(prefers-reduced-motion:no-preference\) \{ \.product-card \{ transition:border-color \.6s ease,box-shadow \.6s ease; \} \}/);
  });
});
