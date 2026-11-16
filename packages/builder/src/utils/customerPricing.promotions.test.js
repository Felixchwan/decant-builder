import { describe, expect, it } from "vitest";

import { DEFAULT_CUSTOMER_PRICING, createCustomerPricing } from "./customerPricing.js";

// The one resolver of what a fragrance costs the customer. Regular price = points x pointValue, always; a promotion is an optional
// `sale` overlay, honoured only for a price-display host and only when it is valid.

const priceHost = createCustomerPricing({
  commerce: {
    priceDisplay: "price",
    pointValue: 100,
    currency: "MXN",
    locale: "es-MX",
    saleLabel: "Oferta especial",
    regularPriceLabel: "Precio regular",
    salePriceLabel: "Precio especial",
  },
});
const pointsHost = createCustomerPricing({ commerce: { priceDisplay: "points", pointValue: 100, currency: "MXN" } });
const fragrance = (overrides = {}) => ({ id: 1, name: "Test", points: 5, ...overrides });
const withSale = (sale) => fragrance({ sale });

describe("regular price: unchanged when there is no promotion", () => {
  it("a fragrance with no sale costs points x pointValue, with no promotion", () => {
    expect(priceHost.getFragrancePrice(fragrance())).toEqual({ regularAmount: 500, effectiveAmount: 500, isOnSale: false, savings: 0, saleLabel: "" });
    expect(priceHost.formatSaleForAssistiveTech(fragrance())).toBe("");
    expect(priceHost.getEffectivePoints(fragrance())).toBe(5);
  });

  it("the regular price is preserved beside a valid sale and never replaced by it", () => {
    const price = priceHost.getFragrancePrice(withSale({ active: true, price: 400 }));

    expect(price.regularAmount).toBe(500);
    expect(price.effectiveAmount).toBe(400);
    expect(fragrance({ sale: { active: true, price: 400 } }).points).toBe(5); // the record itself is untouched
  });
});

describe("a valid, active sale", () => {
  it("resolves to the sale price, names the saving and the promotion, and speaks both prices", () => {
    const price = priceHost.getFragrancePrice(withSale({ active: true, price: 400 }));

    expect(price).toEqual({ regularAmount: 500, effectiveAmount: 400, isOnSale: true, savings: 100, saleLabel: "Oferta especial" });
    expect(priceHost.formatSaleForAssistiveTech(withSale({ active: true, price: 400 }))).toBe("Oferta especial: $400 MXN. Precio regular: $500 MXN.");
  });

  it("uses the sale's own label when it has one, and the host's default when it has none or a blank one", () => {
    expect(priceHost.getFragrancePrice(withSale({ active: true, price: 400, label: "Oferta de temporada" })).saleLabel).toBe("Oferta de temporada");
    expect(priceHost.getFragrancePrice(withSale({ active: true, price: 400, label: "   " })).saleLabel).toBe("Oferta especial");
    expect(priceHost.getFragrancePrice(withSale({ active: true, price: 400, label: 7 })).saleLabel).toBe("Oferta especial");
  });

  it("expresses the effective price in points (price / pointValue), the unit filters and price sorting use", () => {
    expect(priceHost.getEffectivePoints(withSale({ active: true, price: 400 }))).toBe(4);
    expect(priceHost.getEffectivePoints(withSale({ active: true, price: 350 }))).toBe(3.5);
  });
});

describe("a sale that is not valid is never shown and never charged", () => {
  const regular = { regularAmount: 500, effectiveAmount: 500, isOnSale: false, savings: 0, saleLabel: "" };

  it.each([
    ["inactive", { active: false, price: 400 }],
    ["active missing", { price: 400 }],
    ["active not exactly true", { active: "true", price: 400 }],
    ["price equal to the regular price", { active: true, price: 500 }],
    ["price above the regular price", { active: true, price: 650 }],
    ["price zero", { active: true, price: 0 }],
    ["price negative", { active: true, price: -50 }],
    ["price missing", { active: true }],
    ["price a string", { active: true, price: "400" }],
    ["price NaN", { active: true, price: Number.NaN }],
    ["price Infinity", { active: true, price: Number.POSITIVE_INFINITY }],
    ["price null", { active: true, price: null }],
  ])("%s -> the regular price, no promotion", (_name, sale) => {
    expect(priceHost.getFragrancePrice(withSale(sale))).toEqual(regular);
    expect(priceHost.formatSaleForAssistiveTech(withSale(sale))).toBe("");
    expect(priceHost.getEffectivePoints(withSale(sale))).toBe(5);
  });

  it("a malformed sale, or no fragrance at all, never throws", () => {
    for (const sale of [null, undefined, 0, "sale", [], () => {}]) expect(priceHost.getFragrancePrice(withSale(sale)).isOnSale).toBe(false);
    expect(priceHost.getFragrancePrice(undefined).effectiveAmount).toBe(0);
    expect(priceHost.getFragrancePrice({ points: "5" }).effectiveAmount).toBe(0);
  });
});

describe("only a price-display host runs promotions", () => {
  it("a points host (Discovery Decants) ignores a sale entirely: same price, no promotion, points wording", () => {
    const sale = withSale({ active: true, price: 400 });

    expect(pointsHost.getFragrancePrice(sale).isOnSale).toBe(false);
    expect(pointsHost.getEffectivePoints(sale)).toBe(5);
    expect(pointsHost.formatPoints(sale.points)).toBe("5 pt");
    expect(DEFAULT_CUSTOMER_PRICING.getFragrancePrice(sale).isOnSale).toBe(false);
  });
});

describe("one deterministic resolver", () => {
  it("returns the same frozen answer for the same fragrance, every time", () => {
    const sale = withSale({ active: true, price: 400 });
    const first = priceHost.getFragrancePrice(sale);

    expect(priceHost.getFragrancePrice(sale)).toEqual(first);
    expect(Object.isFrozen(first)).toBe(true);
    expect(Object.isFrozen(priceHost)).toBe(true);
  });

  it("does not mutate the fragrance it reads", () => {
    const sale = { active: true, price: 400 };
    const perfume = fragrance({ sale });
    const copy = JSON.parse(JSON.stringify(perfume));

    priceHost.getFragrancePrice(perfume);
    priceHost.getEffectivePoints(perfume);
    priceHost.formatSaleForAssistiveTech(perfume);

    expect(JSON.parse(JSON.stringify(perfume))).toEqual(copy);
  });

  it("is the only place a sale price is compared with the regular price (consumers ask it, none re-implements it)", async () => {
    const { readFileSync, readdirSync, statSync } = await import("node:fs");
    const { join } = await import("node:path");
    const { fileURLToPath } = await import("node:url");
    const roots = [fileURLToPath(new URL("../", import.meta.url)), fileURLToPath(new URL("../../../../apps/aurelian/src/", import.meta.url))];
    const files = [];
    const walk = (dir) => {
      for (const entry of readdirSync(dir)) {
        const path = join(dir, entry);

        if (statSync(path).isDirectory()) walk(path);
        else if (/\.(js|jsx)$/.test(entry) && !/\.test\./.test(entry)) files.push(path);
      }
    };

    roots.forEach(walk);
    const offenders = files.filter((file) => /sale\??\.price|\.sale\.price|sale\.active/.test(readFileSync(file, "utf8")) && !/customerPricing\.js$/.test(file));

    expect(offenders).toEqual([]);
  });
});
