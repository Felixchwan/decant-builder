import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { FragranceSalePrice } from "./components/FragranceSalePrice.jsx";
import { filterCatalog } from "./lib/filterCatalog.js";
import { aurelianCatalog } from "./merchant/catalog.js";
import { aurelianConfig } from "./merchant/config.js";
import { getEffectivePoints, getFragrancePrice } from "./merchant/pricing.js";
import { applyPromotions, aurelianPromotions } from "./merchant/promotions.js";

const APP_ROOT = fileURLToPath(new URL("..", import.meta.url));
const read = (...segments) => readFileSync(join(APP_ROOT, ...segments), "utf8").replace(/\r\n/g, "\n");

// Aurelian's promotional pricing: the merchant-owned table (merchant/promotions.js), its application to the catalog, the price filter
// and the landing cards. Test-only fixtures throughout: no real fragrance is on sale.

describe("no production promotion is running", () => {
  it("the promotions table is empty and frozen, so the live catalog carries no sale and every price is the regular one", () => {
    expect(Object.keys(aurelianPromotions)).toEqual([]);
    expect(Object.isFrozen(aurelianPromotions)).toBe(true);
    expect(aurelianCatalog.some((item) => "sale" in item)).toBe(false);
    for (const item of aurelianCatalog) expect(getFragrancePrice(item)).toMatchObject({ isOnSale: false, effectiveAmount: item.points * 100, regularAmount: item.points * 100 });
  });
});

describe("applying promotions to the catalog", () => {
  const catalog = aurelianCatalog;
  const target = catalog.find((item) => item.id === 502);

  it("an empty table returns the very same records: nothing changes at all", () => {
    const applied = applyPromotions(catalog, {});

    expect(applied).toHaveLength(catalog.length);
    applied.forEach((item, index) => expect(item).toBe(catalog[index]));
  });

  it("attaches a promotion to exactly its fragrance, keeps the regular price, and leaves every other record and the source untouched", () => {
    const sale = { active: true, price: 400 };
    const applied = applyPromotions(catalog, { 502: sale });
    const promoted = applied.find((item) => item.id === 502);

    expect(promoted.sale).toBe(sale);
    expect(promoted.points).toBe(target.points);
    expect(promoted.name).toBe(target.name);
    expect(applied.filter((item) => item.sale).map((item) => item.id)).toEqual([502]);
    applied.filter((item) => item.id !== 502).forEach((item) => expect(item).toBe(catalog.find((source) => source.id === item.id)));
    expect("sale" in target).toBe(false); // the canonical record is never written to
    expect(getFragrancePrice(promoted)).toMatchObject({ isOnSale: true, regularAmount: 500, effectiveAmount: 400, savings: 100 });
  });

  it("an inactive or invalid promotion is attached but behaves as the regular price", () => {
    for (const sale of [{ active: false, price: 400 }, { active: true, price: 500 }, { active: true, price: 900 }, { active: true }]) {
      const promoted = applyPromotions(catalog, { 502: sale }).find((item) => item.id === 502);

      expect(getFragrancePrice(promoted)).toMatchObject({ isOnSale: false, effectiveAmount: 500 });
      expect(getEffectivePoints(promoted)).toBe(5);
    }
  });
});

describe("the price filter matches what the customer pays", () => {
  const sale = applyPromotions(aurelianCatalog, { 502: { active: true, price: 400 }, 1: { active: true, price: 75 } });

  it("with no promotion the filter is exactly the regular-price filter", () => {
    expect(filterCatalog(aurelianCatalog, "", "5").map((item) => item.id)).toEqual(aurelianCatalog.filter((item) => item.points === 5).map((item) => item.id));
  });

  it("a fragrance on promotion is found at its special price and no longer at its regular one", () => {
    expect(filterCatalog(sale, "", "4").map((item) => item.id)).toContain(502);
    expect(filterCatalog(sale, "", "5").map((item) => item.id)).not.toContain(502);
    expect(filterCatalog(sale, "", "0.75").map((item) => item.id)).toContain(1); // $100 on promotion at $75
    expect(filterCatalog(sale, "", "1").map((item) => item.id)).not.toContain(1);
    expect(filterCatalog(sale, "", "all")).toHaveLength(aurelianCatalog.length);
  });
});

describe("landing seasonal card price (FragranceSalePrice)", () => {
  const item = (sale) => ({ id: 502, name: "Oud for Greatness", points: 5, ...(sale ? { sale } : {}) });

  it("without a valid promotion it is exactly the plain price span it has always been", () => {
    expect(renderToStaticMarkup(<FragranceSalePrice item={item()} />)).toBe("<span>$500</span>");
    expect(renderToStaticMarkup(<FragranceSalePrice item={item({ active: true, price: 500 })} />)).toBe("<span>$500</span>");
    expect(renderToStaticMarkup(<FragranceSalePrice item={item({ active: false, price: 100 })} />)).toBe("<span>$500</span>");
  });

  it("with a valid promotion it shows the struck regular price and the special price, and is spoken in full in Spanish", () => {
    const markup = renderToStaticMarkup(<FragranceSalePrice item={item({ active: true, price: 400 })} />);

    expect(markup).toContain('<s aria-hidden="true" class="fragrance-price__regular">$500</s>');
    expect(markup).toContain('<span aria-hidden="true" class="fragrance-price__special">$400</span>');
    expect(markup).toContain("Oferta especial: $400 MXN. Precio regular: $500 MXN.");
  });
});

describe("Aurelian's promotional copy is Spanish, with a safe default", () => {
  it("names the promotion, the regular price and the special price in Spanish", () => {
    expect(aurelianConfig.commerce.saleLabel).toBe("Oferta especial");
    expect(aurelianConfig.commerce.regularPriceLabel).toBe("Precio regular");
    expect(aurelianConfig.commerce.salePriceLabel).toBe("Precio especial");
    expect(aurelianConfig.finalization.messageLabels.regularPrice).toBe("precio regular");
  });
});

describe("the promotional look (promotional-pricing.css)", () => {
  const css = read("src", "app", "promotional-pricing.css");
  const layout = read("src", "app", "layout.jsx");
  const code = css.replace(/\/\*[\s\S]*?\*\//g, "");

  it("is loaded by the layout, after the shared stylesheet and the catalog controls", () => {
    expect(layout.indexOf('import "./promotional-pricing.css";')).toBeGreaterThan(layout.indexOf('import "./catalog-controls.css";'));
    expect(layout.indexOf('import "./promotional-pricing.css";')).toBeGreaterThan(layout.indexOf('import "@discovery-box/builder/styles.css";'));
  });

  it("strikes the regular price through the middle, muted and smaller, and emphasizes the special price in brass", () => {
    expect(code).toMatch(/\.fragrance-price__regular \{[^}]*text-decoration-line: line-through;/);
    expect(code).toMatch(/\.fragrance-price__regular \{[^}]*color: var\(--muted\);/);
    expect(code).toMatch(/\.fragrance-price__regular \{[^}]*font-size: 0\.84em;/);
    expect(code).toMatch(/\.fragrance-price__special \{[^}]*color: var\(--gold\);[^}]*font-weight: 700;/);
    expect(code).toMatch(/\.perfume-card-price-regular \{[^}]*text-decoration-line: line-through;/);
    expect(code).toMatch(/\.product-card__price-regular \{[^}]*text-decoration-line: line-through;/);
  });

  it("keeps the pill restrained: near-black, brass hairline, uppercase, small, low radius; no red, no bright colour", () => {
    expect(code).toMatch(/background: rgb\(10, 9, 8\);/);
    expect(code).toMatch(/border-radius: 3px;/);
    expect(code).toMatch(/text-transform: uppercase;/);
    expect(code).toMatch(/color: var\(--gold\);/);
    expect(code).not.toMatch(/#(?:f[0-9a-f]{2}[0-4][0-9a-f]{2}|e[0-9a-f]{2}[0-3][0-9a-f]{2})|red|crimson|orange|gradient|animation|box-shadow/i);
  });

  it("hides the spoken text visually but never from assistive technology", () => {
    const rule = code.match(/\.fragrance-price__sr \{([^}]*)\}/)[1];

    expect(rule).toMatch(/position: absolute;/);
    expect(rule).toMatch(/clip-path: inset\(50%\);/);
    expect(rule).not.toMatch(/display: none|visibility: hidden/);
  });

  it("adds no height: the card pill sits on the bottle, and the Product Info pill wraps only on a phone", () => {
    expect(code).toMatch(/\.builder-page \.perfume-card-sale-badge \{[^}]*position: absolute;/);
    expect(code).toMatch(/@media \(max-width: 619px\)[\s\S]*perfume-details-meta:has\(\.perfume-details-sale-badge\)[\s\S]*flex-wrap: wrap;/);
  });

  it("styles only promotional markup: every selector is a promotion class", () => {
    const selectors = [...code.replace(/:is\([^)]*\)/g, "").matchAll(/([^{}]+)\{/g)].flatMap(([, list]) => (list.trim().startsWith("@") ? [] : list.split(",").map((part) => part.trim())));

    selectors.forEach((selector) => expect(selector, selector).toMatch(/fragrance-price|sale-badge|price-pair|price-regular|price-special|perfume-details-meta|product-card__image$|\.perfume-details-price/));
  });
});
