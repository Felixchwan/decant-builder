import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { createCustomerPricing } from "@discovery-box/builder/config";

import { metadata as catalogMetadata } from "./app/catalogo/page.jsx";
import { metadata as comoFuncionaMetadata } from "./app/como-funciona/page.jsx";
import { metadata as contactMetadata } from "./app/contacto/page.jsx";
import { metadata as homeMetadata } from "./app/page.jsx";
import HomePage from "./app/page.jsx";
import ContactPage from "./app/contacto/page.jsx";
import HowItWorksPage from "./app/como-funciona/page.jsx";
import { metadata as builderMetadata } from "./app/build-your-box/page.jsx";
import { CatalogExplorer } from "./components/CatalogExplorer.jsx";
import { CatalogPageView } from "./components/CatalogPageView.jsx";
import { SeasonalFeaturedSelection } from "./components/SeasonalFeaturedSelection.jsx";
import { aurelianCatalog } from "./merchant/catalog.js";
import { aurelianConfig } from "./merchant/config.js";
import { aurelianPricing, formatFragrancePrice, formatFragrancePriceWithCurrency, formatThresholdAmount } from "./merchant/pricing.js";

const APP_ROOT = fileURLToPath(new URL("..", import.meta.url));
const read = (...segments) => readFileSync(join(...segments), "utf8");

// ---------------------------------------------------------------------------------------------------------------
// Aurelian speaks money to customers. Points stay the internal measure (selection, Composer, Curator Bonus,
// validation, tiers); everything a customer reads outside the Builder is an MXN amount from the SAME formatter the
// Builder uses (createCustomerPricing), built once from this merchant's config.
// ---------------------------------------------------------------------------------------------------------------

describe("Aurelian's customer pricing outside the Builder", () => {
  it("is the Builder's own formatter, built from Aurelian's config (one conversion, no second implementation)", () => {
    const sameFormatter = createCustomerPricing(aurelianConfig);

    expect(aurelianConfig.commerce.priceDisplay).toBe("price");
    expect(aurelianConfig.commerce.currency).toBe("MXN");
    for (const points of [1, 1.5, 2, 2.5, 4, 4.5, 5]) {
      expect(aurelianPricing.formatPoints(points)).toBe(sameFormatter.formatPoints(points));
      expect(aurelianPricing.formatPointsForAssistiveTech(points)).toBe(sameFormatter.formatPointsForAssistiveTech(points));
    }
    const source = read(APP_ROOT, "src", "merchant", "pricing.js");
    expect(source).toContain('from "@discovery-box/builder/config"');
    expect(source).not.toMatch(/\*\s*100|pointValue\s*\*/); // no hand-written conversion beside the shared formatter
  });

  it("shows every catalog value as its direct MXN amount, including 4.5 and 2.5", () => {
    const expected = { 1: "$100 MXN", 1.5: "$150 MXN", 2: "$200 MXN", 2.5: "$250 MXN", 4: "$400 MXN", 4.5: "$450 MXN", 5: "$500 MXN" };

    for (const [points, amount] of Object.entries(expected)) {
      expect(formatFragrancePriceWithCurrency(Number(points))).toBe(amount);
      expect(formatFragrancePrice(Number(points))).toBe(amount.replace(" MXN", ""));
    }
    expect([...new Set(aurelianCatalog.map((item) => item.points))].every((points) => points in expected)).toBe(true);
  });

  it("words the box thresholds from minPoints / targetPoints times the point value, never as a separate figure", () => {
    expect(formatThresholdAmount(aurelianConfig.box.minPoints)).toBe("$1,200 MXN");
    expect(formatThresholdAmount(aurelianConfig.curatorBonus.targetPoints)).toBe("$1,200 MXN");
    expect(aurelianConfig.box.minPoints * aurelianConfig.commerce.pointValue).toBe(1200);
    expect(aurelianConfig.curatorBonus.targetPoints * aurelianConfig.commerce.pointValue).toBe(1200);
  });
});

describe("the catalog speaks MXN", () => {
  const markup = renderToStaticMarkup(<CatalogPageView />);
  const explorer = renderToStaticMarkup(<CatalogExplorer />);

  it("labels the filter Precio por fragancia, keeps the numeric option values, and shows each option as MXN", () => {
    const select = explorer.match(/<label>Precio por fragancia<select[^>]*>([\s\S]*?)<\/select><\/label>/)?.[1] ?? "";
    const options = [...select.matchAll(/<option value="([^"]+)"[^>]*>([^<]*)<\/option>/g)].map(([, value, label]) => [value, label]);

    expect(options).toEqual([
      ["all", "Todos"],
      ["1", "$100 MXN"],
      ["1.5", "$150 MXN"],
      ["2", "$200 MXN"],
      ["2.5", "$250 MXN"],
      ["4", "$400 MXN"],
      ["4.5", "$450 MXN"],
      ["5", "$500 MXN"],
    ]);
    expect(explorer).not.toContain("Puntos por fragancia");
  });

  it("shows each tier chip as the short Builder amount and speaks it with its currency", () => {
    const chips = [...explorer.matchAll(/<p class="product-card__points"[^>]*aria-label="([^"]*)"[^>]*>[\s\S]*?<span>([^<]*)<\/span><\/p>/g)];

    expect(chips.length).toBe(aurelianCatalog.length);
    chips.forEach(([, label, visible]) => {
      expect(label).toMatch(/^\$\d{3} MXN$/);
      expect(visible).toBe(label.replace(" MXN", ""));
    });
    const representative = aurelianCatalog[0];
    expect(explorer).toContain(`aria-label="${formatFragrancePriceWithCurrency(representative.points)}"`);
  });

  it("explains pricing directly, on the page and in the explorer, and keeps the order / popularity statement", () => {
    const direct = "Cada fragancia muestra su precio en MXN; tu Discovery Box se arma sumando esos montos.";

    expect(markup).toContain(direct);
    expect(markup).toContain("El catálogo no está ordenado por popularidad ni por lo más vendido.");
    expect(explorer).toContain(`<p>${direct}</p>`);
  });

  it("asks for another price in the empty state", () => {
    expect(read(APP_ROOT, "src", "components", "CatalogExplorer.jsx")).toContain("selecciona “Todos” en precio.");
  });
});

describe("the landing seasonal cards speak MXN", () => {
  it("shows each card's value as the short amount", () => {
    const markup = renderToStaticMarkup(<SeasonalFeaturedSelection />);
    const amounts = [...markup.matchAll(/<h3>[^<]*<\/h3><span>([^<]*)<\/span>/g)].map(([, amount]) => amount);

    expect(amounts.length).toBeGreaterThan(0);
    amounts.forEach((amount) => expect(amount).toMatch(/^\$\d{3}$/));
  });
});

describe("Cómo funciona speaks MXN", () => {
  const route = renderToStaticMarkup(<HowItWorksPage />);

  it("says precios in the catalog step, the derived minimum in the selection step, and the derived Curator Bonus threshold", () => {
    expect(route).toContain(`Revisa casas, perfiles aromáticos y precios de las ${aurelianCatalog.length} fragancias.`);
    expect(route).toContain(`hasta alcanzar al menos ${formatThresholdAmount(aurelianConfig.box.minPoints)}. Cada fragancia suma su precio al total de tu caja.`);
    expect(route).toContain(`Al alcanzar ${formatThresholdAmount(aurelianConfig.curatorBonus.targetPoints)}, podrás`);
  });

  it("describes the page as building the selection in MXN", () => {
    expect(comoFuncionaMetadata.description).toBe("Conoce cómo elegir 6–14 fragancias, armar tu selección en MXN y solicitar una Discovery Box Aurelian en Monterrey.");
  });
});

// ---------------------------------------------------------------------------------------------------------------
// The guard. It looks only at what an Aurelian customer reads on the Aurelian-owned pages (their rendered text and
// page metadata), never at identifiers, so `points`, `minPoints`, `pointValue` and the shared Builder's own
// point-wording keys (reached only when a host has not opted into price display) are not its business. A page or
// component that starts naming "puntos" / "pts" / "points" to customers again fails here.
// ---------------------------------------------------------------------------------------------------------------

const textOf = (html) =>
  html
    .replace(/<(script|style)[\s\S]*?<\/\1>/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ");

// Spanish idioms that happen to contain the word and have nothing to do with the price.
const ALLOWED_IDIOMS = [/punto de partida/gi, /punto de vista/gi, /puntos de venta/gi];
const POINTS_WORDING = /\b(?:puntos?|pts?|points?)\b/i;

const withoutIdioms = (text) => ALLOWED_IDIOMS.reduce((remaining, idiom) => remaining.replace(idiom, " "), text);
const customerFacing = (text) => withoutIdioms(text);

describe("Aurelian customer-facing copy never prices in points", () => {
  const surfaces = {
    "landing (hero, seasonal cards, Cómo funciona teaser)": textOf(renderToStaticMarkup(<HomePage />)),
    "/catalogo": textOf(renderToStaticMarkup(<CatalogPageView />)),
    "/catalogo explorer (filter, chips, helper copy)": textOf(renderToStaticMarkup(<CatalogExplorer />)),
    "/como-funciona": textOf(renderToStaticMarkup(<HowItWorksPage />)),
    "/contacto": textOf(renderToStaticMarkup(<ContactPage />)),
  };

  for (const [name, text] of Object.entries(surfaces)) {
    it(`${name} carries no puntos / pts / points wording`, () => {
      expect(customerFacing(text)).not.toMatch(POINTS_WORDING);
    });
  }

  it("keeps the page metadata (titles and descriptions search results show) free of points wording", () => {
    for (const metadata of [homeMetadata, catalogMetadata, comoFuncionaMetadata, contactMetadata, builderMetadata]) {
      expect(customerFacing(`${metadata.title ?? ""} ${metadata.description ?? ""}`)).not.toMatch(POINTS_WORDING);
    }
  });

  it("also covers the Aurelian-owned page sources, ignoring comments, identifiers and the allowed idioms", () => {
    const files = [
      ["components", "CatalogExplorer.jsx"],
      ["components", "CatalogPageView.jsx"],
      ["components", "SeasonalFeaturedSelection.jsx"],
      ["components", "LandingHowItWorks.jsx"],
      ["components", "LandingHowItWorksTeaser.jsx"],
      ["app", "como-funciona", "page.jsx"],
      ["app", "page.jsx"],
      ["app", "contacto", "page.jsx"],
    ];

    for (const segments of files) {
      const source = read(APP_ROOT, "src", ...segments)
        .replace(/\/\*[\s\S]*?\*\//g, " ")
        .replace(/^\s*\/\/.*$/gm, " ")
        .replace(/\{\/\*[\s\S]*?\*\/\}/g, " ");
      // Only text a customer could read: JSX text between tags and string literals. Identifiers such as `item.points`
      // or `pointOptions` are not words in prose, so they are not looked at.
      const prose = [...source.matchAll(/>([^<>{}]+)</g), ...source.matchAll(/(["'`])((?:(?!\1)[^\\\n])*?)\1/g)]
        .map((match) => match[2] ?? match[1])
        .filter((text) => /\s/.test(text.trim()));

      prose.forEach((text) => expect(customerFacing(text), `${segments.join("/")}: ${text.slice(0, 60)}`).not.toMatch(POINTS_WORDING));
    }
  });

  it("keeps the allow-list to legitimate idioms: 'punto de partida' passes, a price in puntos does not", () => {
    expect(customerFacing("cada Discovery Box es un punto de partida")).not.toMatch(POINTS_WORDING);
    expect(customerFacing("1.5 puntos")).toMatch(POINTS_WORDING);
    expect(customerFacing("alcanza el mínimo de 12 puntos")).toMatch(POINTS_WORDING);
    expect(customerFacing("1.5 pts")).toMatch(POINTS_WORDING);
    expect(customerFacing("Total points")).toMatch(POINTS_WORDING);
  });
});
