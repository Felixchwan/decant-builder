import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import CatalogPage from "./app/catalogo/page.jsx";
import HomePage from "./app/page.jsx";
import { CatalogPageView } from "./components/CatalogPageView.jsx";
import { filterCatalog } from "./lib/filterCatalog.js";
import { SEASONAL_SLOTS } from "./lib/seasonalSelection.js";
import { aurelianCatalog } from "./merchant/catalog.js";

const APP_ROOT = fileURLToPath(new URL("..", import.meta.url));
const REPOSITORY_ROOT = fileURLToPath(new URL("../../..", import.meta.url));
const read = (...segments) => readFileSync(join(...segments), "utf8");

const css = read(APP_ROOT, "src", "app", "catalog-seasons.css");
const withoutComments = css.replace(/\/\*[\s\S]*?\*\//g, "");
const rules = [...withoutComments.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
  .map(([, selector, body]) => ({ selector: selector.trim(), body }))
  .filter(({ selector }) => !selector.startsWith("@"));
const selectors = rules.flatMap(({ selector }) => selector.split(",").map((part) => part.trim()));

// Public season key -> artwork file. The key says "fall"; the file says "autumn".
const EXPECTED_ART = {
  spring: "catalog-spring-editorial.webp",
  summer: "catalog-summer-editorial.webp",
  fall: "catalog-autumn-editorial.webp",
  winter: "catalog-winter-editorial.webp",
};
const ART_DIR = join(APP_ROOT, "public", "media", "landing", "seasons");

const cardIds = (markup) => [...markup.matchAll(/class="product-card[^"]*" data-fragrance-id="(\d+)"/g)].map((match) => Number(match[1]));

function sourceFiles(directory) {
  return readdirSync(directory).flatMap((entry) => {
    if (["node_modules", ".next", "dist"].includes(entry)) return [];
    const path = join(directory, entry);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.(?:[cm]?[jt]sx?|css)$/.test(entry) && !/\.test\.[cm]?[jt]sx?$/.test(entry) ? [path] : [];
  });
}

describe("full catalog (no valid season) stays the complete, unthemed catalog", () => {
  it("renders every fragrance with no seasonal attribute, heading, control or count", () => {
    const markup = renderToStaticMarkup(<CatalogPage />);
    expect(markup).toContain('<div class="catalog-atmosphere">');
    expect(markup).not.toMatch(/data-season/);
    expect(markup).not.toContain("catalog-season-context");
    expect(markup).not.toContain("Ver catálogo completo");
    expect(markup).toContain(`${aurelianCatalog.length} fragancias para explorar`);
    expect(markup).toContain(`${aurelianCatalog.length} de ${aurelianCatalog.length} fragancias`);
    expect(cardIds(markup)).toEqual(aurelianCatalog.map(({ id }) => id));
  });

  it("is the same output for an unusable season value as for none", () => {
    const full = renderToStaticMarkup(<CatalogPageView season={null} />);
    expect(renderToStaticMarkup(<CatalogPage />)).toBe(full);
    expect(full).not.toMatch(/data-season/);
  });

  it("reads the season on the server, through the shared parser, so the first HTML is already filtered", () => {
    const source = read(APP_ROOT, "src", "app", "catalogo", "page.jsx");
    expect(source).toContain("use(searchParams)");
    expect(source).toContain("parseCatalogSeason(params?.[CATALOG_SEASON_PARAM])");
    expect(source).toContain("canonical");
    expect(source).toContain('"/catalogo"');
  });
});

describe("seasonal mode (the page body)", () => {
  for (const { key, label } of SEASONAL_SLOTS) {
    it(`${key}: states the season in text, shows only compatible fragrances in relevance order, and offers the way out`, () => {
      const markup = renderToStaticMarkup(<CatalogPageView season={key} />);
      const lower = label.toLowerCase();
      const expected = filterCatalog(aurelianCatalog, "", "all", key);

      expect(markup).toContain(`data-season="${key}"`);
      expect(markup).toContain(`Selección de ${lower}`);
      expect(markup).not.toContain("fragancias para explorar");
      expect(markup).toContain("Encuentra los aromas que quieres conocer.");
      expect(markup).toContain(`${expected.length} fragancias de ${lower}`);
      expect(markup).not.toContain(`de ${aurelianCatalog.length} fragancias`);
      expect(markup).toMatch(/<a class="button button--compact" href="\/catalogo">Ver catálogo completo<\/a>/);

      expect(cardIds(markup)).toEqual(expected.map(({ id }) => id));
      expect(expected.length).toBeLessThan(aurelianCatalog.length);
      for (const id of cardIds(markup)) {
        expect(aurelianCatalog.find((item) => item.id === id).seasons).toContain(key);
      }
    });
  }

  it("keeps card actions exactly as in the full catalog", () => {
    const markup = renderToStaticMarkup(<CatalogPageView season="winter" />);
    const ids = cardIds(markup);
    expect(markup.match(/Agregar a mi Discovery Box/g)).toHaveLength(ids.length);
    expect(markup.match(/Explorar esta fragancia/g)).toHaveLength(ids.length);
    for (const id of ids) {
      expect(markup).toContain(`href="/build-your-box?fragrance=${id}"`);
      expect(markup).toContain(`href="/mis-descubrimientos/observar?fragrance=${id}"`);
    }
  });

  it("leads out through whatever href it is given, so other params survive", () => {
    const markup = renderToStaticMarkup(<CatalogPageView fullHref="/catalogo?fragrance=210" season="fall" />);
    expect(markup).toContain('href="/catalogo?fragrance=210">Ver catálogo completo');
  });

  it("never puts the artwork in markup: it is a decorative CSS background and the season is text", () => {
    const markup = renderToStaticMarkup(<CatalogPageView season="spring" />);
    expect(markup).not.toMatch(/editorial\.webp|<img[^>]+landing\/seasons/);
  });
});

describe("landing seasonal cards deep-link by season role, carrying their own fragrance", () => {
  it("links each slot to /catalogo?season=<key>&fragrance=<its own id>, in slot order", () => {
    const markup = renderToStaticMarkup(<HomePage />);
    const cards = [...markup.matchAll(/<article class="seasonal-card[^"]*" data-fragrance-id="(\d+)" data-season="([a-z]+)"[\s\S]*?<\/article>/g)];
    expect(cards.map((match) => match[2])).toEqual(["spring", "summer", "fall", "winter"]);
    for (const [card, id, season] of cards) {
      expect(card).toContain(`href="/catalogo?season=${season}&amp;fragrance=${id}"`);
      expect(card).not.toMatch(/href="\/catalogo\?fragrance=/);
    }
    expect(markup).not.toMatch(/href="\/catalogo\?season=autumn/);

    const source = read(APP_ROOT, "src", "components", "SeasonalFeaturedSelection.jsx");
    // built by the one seasonal-URL helper, from the card's own item, not assembled inline
    expect(source).toContain("href={buildSeasonalFragranceHref(season.key, item.id)}");
    expect(source).not.toMatch(/href=\{`\/catalogo/);
    // The rotating fragrance content stays: the bottle, name and points are still rendered.
    expect(source).toContain("<h3>{item.name}</h3>");
  });
});

describe("seasonal page atmosphere (host-owned, decorative, one season at a time)", () => {
  it("maps the four semantic keys to the four existing landing assets, each only under its own selector", () => {
    const urls = [...withoutComments.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/g)].map((match) => match[1]);
    expect(urls.sort()).toEqual(Object.values(EXPECTED_ART).map((file) => `/media/landing/seasons/${file}`).sort());
    for (const [key, file] of Object.entries(EXPECTED_ART)) {
      const rule = rules.find(({ selector }) => selector === `.catalog-atmosphere[data-season="${key}"]`);
      expect(rule.body).toContain(`/media/landing/seasons/${file}`);
      expect(existsSync(join(ART_DIR, file))).toBe(true);
    }
    // Reused, not duplicated: the seasons folder still holds exactly the four approved files.
    expect(readdirSync(ART_DIR).sort()).toEqual(Object.values(EXPECTED_ART).sort());
    expect(withoutComments).not.toMatch(/\/media\/(?!landing\/seasons\/)/);
  });

  it("applies only inside the standalone catalog's own wrapper, never per card", () => {
    expect(selectors.length).toBeGreaterThan(5);
    selectors.forEach((selector) => {
      expect(selector, selector).toMatch(/^\.catalog-(?:atmosphere|season-context)/);
      expect(selector, selector).not.toMatch(/product-card|data-fragrance|nth-child|:has\(|\.builder|\.seasonal-/);
    });
    expect(withoutComments).not.toContain("!important");
  });

  it("holds the art with sticky positioning only: no fixed attachment, filter, blur, motion or pointer capture issues", () => {
    expect(withoutComments).not.toMatch(/background-attachment/);
    expect(withoutComments).not.toMatch(/(?:^|[;\s{])(?:backdrop-)?filter\s*:/);
    expect(withoutComments).not.toMatch(/blur\(|transform|animation|@keyframes|transition|translate|parallax/);
    expect(withoutComments).not.toMatch(/position:\s*fixed/);
    const layer = rules.find(({ selector }) => selector === '.catalog-atmosphere[data-season]::before');
    expect(layer.body).toMatch(/position:\s*sticky;/);
    expect(layer.body).toMatch(/z-index:\s*-1;/);
    expect(layer.body).toMatch(/pointer-events:\s*none;/);
    expect(layer.body).toMatch(/content:\s*"";/);
    const wrapper = rules.find(({ selector }) => selector === ".catalog-atmosphere");
    expect(wrapper.body).toMatch(/isolation:\s*isolate;/);
  });

  it("only paints when a valid season is present, and states the season in text, not in CSS content", () => {
    const paint = rules.filter(({ body }) => /var\(--catalog-season-art\)/.test(body));
    expect(paint).toHaveLength(1);
    expect(paint[0].selector).toContain("[data-season]");
    const contents = [...withoutComments.matchAll(/(?:^|[;\s])content\s*:\s*([^;]+);/g)].map((match) => match[1].trim());
    contents.forEach((value) => expect(value).toBe('""'));
  });

  it("does not touch layout geometry or the cards", () => {
    rules.forEach(({ selector, body }) => {
      if (selector.includes("catalog-season-context")) return;
      expect(body, selector).not.toMatch(/(?:^|[;\s])(?:grid[\w-]*|gap|width|padding[\w-]*|order|float)\s*:/);
    });
  });

  it("is loaded by Aurelian's own layout, after the landing seasonal styles", () => {
    const layout = read(APP_ROOT, "src", "app", "layout.jsx");
    expect(layout.indexOf('import "./catalog-seasons.css";')).toBeGreaterThan(layout.indexOf('import "./landing-seasons.css";'));
  });
});

describe("boundaries: Builder, shared packages and Discovery Decants are untouched by seasonal browsing", () => {
  it("keeps the seasonal catalog out of the Builder", () => {
    for (const file of ["BuilderExperience.jsx", "BuilderMount.jsx", "BuilderIntroHeader.jsx", "IntroPreferenceProvider.jsx"]) {
      expect(read(APP_ROOT, "src", "components", file), file).not.toMatch(/catalogSeason|catalog-atmosphere|CatalogPageView/);
    }
    expect(read(APP_ROOT, "src", "app", "build-your-box", "page.jsx")).not.toMatch(/catalogSeason|catalog-atmosphere|CatalogPageView/);
  });

  it("leaves no trace of it in the shared packages or the Discovery Decants host", () => {
    const trace = /catalogSeason|catalog-seasons|catalog-atmosphere|CATALOG_SEASON_PARAM|landing\/seasons/;
    const files = [
      ...sourceFiles(join(REPOSITORY_ROOT, "packages", "builder", "src")),
      join(REPOSITORY_ROOT, "packages", "builder", "styles.css"),
      ...sourceFiles(join(REPOSITORY_ROOT, "packages", "catalog", "src")),
      ...sourceFiles(join(REPOSITORY_ROOT, "src")),
    ];
    files.forEach((file) => expect(read(file), file).not.toMatch(trace));
  });
});

describe("landing seasonal cards: canonical fragrance per season (initial, unrotated selection)", () => {
  const byName = (name) => aurelianCatalog.find((item) => item.name === name);
  const EXPECTED = [
    ["spring", "Acqua di Gio EDT"],
    ["summer", "Light Blue Pour Homme EDT"],
    ["fall", "Legend EDT"],
    ["winter", "Le Male"],
  ];

  it("maps Spring/Summer/Fall/Winter to Acqua di Gio EDT, Light Blue Pour Homme EDT, Legend EDT and Le Male by their catalog ids", () => {
    const markup = renderToStaticMarkup(<HomePage />);
    for (const [season, name] of EXPECTED) {
      const item = byName(name);
      expect(item, name).toBeTruthy();
      expect(markup).toContain(`href="/catalogo?season=${season}&amp;fragrance=${item.id}"`);
    }
    expect(EXPECTED.map(([, name]) => byName(name).id)).toEqual([1, 2, 4, 5]);
  });

  it("every seasonal card's fragrance is compatible with its own season, so the target is always in the filtered result", () => {
    for (const [season, name] of EXPECTED) {
      const visible = filterCatalog(aurelianCatalog, "", "all", season);
      expect(visible.map(({ id }) => id)).toContain(byName(name).id);
    }
  });
});
