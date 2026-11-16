import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { aurelianConfig } from "../../../../apps/aurelian/src/merchant/config.js";
import { discoveryDecantsConfig } from "../../../../src/merchants/discoveryDecants/config.js";
import { buildCatalogView } from "../../src/builder/internal/catalog/buildCatalogView.js";
import { buildFinalizationModel } from "../../src/builder/internal/finalization/buildFinalizationModel.js";
import { buildCollectionSummary } from "../../src/builder/internal/intelligence/buildCollectionSummary.js";
import FragrancePrice from "../../src/components/FragrancePrice.jsx";
import PerfumeCard from "../../src/components/PerfumeCard.jsx";
import { createCustomerPricing } from "../../src/utils/customerPricing.js";

// Promotional pricing, end to end through the Builder: what a fragrance costs the customer (its effective price) flows to every total,
// to Review, to the order message and to the cards; points stay the measure of box size and thresholds. Test-only data: no real
// fragrance is on sale.

const read = (...segments) => readFileSync(fileURLToPath(new URL(segments.join("/"), import.meta.url)), "utf8").replace(/\r\n/g, "\n");

const aurelianPricing = createCustomerPricing(aurelianConfig);
const decantsPricing = createCustomerPricing(discoveryDecantsConfig);

const perfume = (id, points, extra = {}) => ({
  id,
  name: `Fragancia ${id}`,
  brand: `Casa ${id}`,
  points,
  seasons: ["fall"],
  occasions: ["date"],
  vibes: ["warm"],
  accords: ["amber"],
  topNotes: [],
  middleNotes: [],
  baseNotes: [],
  ...extra,
});
const REGULAR_ONLY = perfume(10, 2); // $200
const ON_SALE = perfume(502, 5, { sale: { active: true, price: 400 } }); // $500 -> $400
const ON_SALE_CUSTOM = perfume(11, 1, { sale: { active: true, price: 75, label: "Oferta de temporada" } }); // $100 -> $75
const INVALID_SALE = perfume(12, 4, { sale: { active: true, price: 450 } }); // price above regular: ignored, $400
const INACTIVE_SALE = perfume(13, 3, { sale: { active: false, price: 100 } }); // inactive: ignored, $300

const summaryOf = (selectedPerfumes, config = aurelianConfig) => buildCollectionSummary({ selectedPerfumes, catalog: selectedPerfumes, notes: {}, config });

describe("box totals: every charged total uses the effective price", () => {
  it("a box with no promotion totals exactly points x pointValue, as before", () => {
    const summary = summaryOf([REGULAR_ONLY, INVALID_SALE, INACTIVE_SALE]);

    expect(summary.money).toMatchObject({ total: 900, regularTotal: 900, savings: 0 });
    expect(summary.points.total).toBe(9);
  });

  it("a mixed box combines regular and promotional fragrances correctly", () => {
    const summary = summaryOf([REGULAR_ONLY, ON_SALE, ON_SALE_CUSTOM, INVALID_SALE, INACTIVE_SALE]);

    // regular 200 + 500 + 100 + 400 + 300 = 1500; charged 200 + 400 + 75 + 400 + 300 = 1375; the saving is 100 + 25
    expect(summary.money.regularTotal).toBe(1500);
    expect(summary.money.total).toBe(1375);
    expect(summary.money.savings).toBe(125);
    expect(summary.money.total).toBe(summary.money.regularTotal - summary.money.savings);
  });

  it("points.total stays the regular value of the box; points.spend is the same box at what the customer pays", () => {
    const regularBox = summaryOf([REGULAR_ONLY, perfume(20, 5), perfume(21, 5)]);
    const promoBox = summaryOf([REGULAR_ONLY, { ...perfume(20, 5), sale: { active: true, price: 100 } }, { ...perfume(21, 5), sale: { active: true, price: 100 } }]);

    expect(promoBox.points.total).toBe(regularBox.points.total); // never a fake reduced point value
    expect(promoBox.points.spend).toBe(4); // $200 + $100 + $100 = $400 = 4 points
    expect(regularBox.points.spend).toBe(regularBox.points.total);
    expect(promoBox.money.total).toBeLessThan(regularBox.money.total);
  });

  it("a points host (Discovery Decants) ignores any sale in its totals", () => {
    const summary = summaryOf([REGULAR_ONLY, ON_SALE], discoveryDecantsConfig);

    expect(summary.money).toMatchObject({ total: 700, regularTotal: 700, savings: 0 });
  });
});

describe("Review / finalization and the WhatsApp order", () => {
  const model = (selectedPerfumes, config = aurelianConfig) => {
    const summary = summaryOf(selectedPerfumes, config);

    return buildFinalizationModel({
      selectedPerfumes,
      totalPoints: summary.points.total,
      estimatedValue: summary.money.total,
      isCollectionReady: true,
      customerInfo: { name: "Ana", city: "Monterrey" },
      curatorBonus: { isUnlocked: false },
      config,
    });
  };

  it("the order carries the effective total, the saving, and the applied sale on exactly the promotional items", () => {
    const { order } = model([REGULAR_ONLY, ON_SALE, ON_SALE_CUSTOM, INVALID_SALE]);

    expect(order.monetaryTotal).toBe(200 + 400 + 75 + 400);
    expect(order.savings).toBe(125);
    expect(order.items.map((item) => Boolean(item.sale))).toEqual([false, true, true, false]);
    expect(order.items[1].sale).toEqual({ effectiveAmount: 400, regularAmount: 500, label: "Oferta especial" });
    expect(order.items[2].sale.label).toBe("Oferta de temporada");
  });

  it("a box with no promotion keeps the order exactly as it was: no saving, no sale on any item", () => {
    const { order, message } = model([REGULAR_ONLY, INVALID_SALE]);

    expect(order.savings).toBe(0);
    expect(order.items.some((item) => "sale" in item)).toBe(false);
    expect(message).not.toMatch(/oferta|precio regular/i);
    expect(message).toContain("1. Fragancia 10 - Casa 10 ($200)");
  });

  it("the WhatsApp message names the price charged, the promotion and the regular price on a promotional line, and sends the effective total", () => {
    const { message } = model([REGULAR_ONLY, ON_SALE, ON_SALE_CUSTOM]);

    expect(message).toContain("1. Fragancia 10 - Casa 10 ($200)");
    expect(message).toContain("2. Fragancia 502 - Casa 502 ($400 MXN, oferta especial; precio regular $500 MXN)");
    expect(message).toContain("3. Fragancia 11 - Casa 11 ($75 MXN, oferta de temporada; precio regular $100 MXN)");
    expect(message).toContain("Total estimado de la Discovery Box: $675 MXN");
    expect(message).not.toContain("$800"); // never the crossed-out regular total
  });

  it("a points host's order message is exactly what it always was", () => {
    const { message, order } = model([REGULAR_ONLY, ON_SALE], discoveryDecantsConfig);

    expect(order.savings).toBe(0);
    expect(order.items.some((item) => "sale" in item)).toBe(false);
    expect(message).toContain("(2 pt)");
    expect(message).toContain("(5 pt)");
    expect(message).not.toMatch(/MXN|oferta|offer|regular price/i);
  });
});

describe("inline price (FragrancePrice)", () => {
  const text = (item, pricing) => renderToStaticMarkup(<FragrancePrice perfume={item} pricing={pricing} />);

  it("without a valid sale it is exactly the plain price text: no element, no strikethrough", () => {
    expect(text(REGULAR_ONLY, aurelianPricing)).toBe("$200");
    expect(text(INVALID_SALE, aurelianPricing)).toBe("$400");
    expect(text(INACTIVE_SALE, aurelianPricing)).toBe("$300");
    expect(text(ON_SALE, decantsPricing)).toBe("5 pt");
  });

  it("with a valid sale it shows the regular price struck through and the special price, and speaks both in words", () => {
    const markup = text(ON_SALE, aurelianPricing);

    expect(markup).toContain('<s class="fragrance-price__regular" aria-hidden="true">$500</s>');
    expect(markup).toContain('<span class="fragrance-price__special" aria-hidden="true">$400</span>');
    expect(markup).toContain('<span class="fragrance-price__sr">Oferta especial: $400 MXN. Precio regular: $500 MXN.</span>');
  });
});

describe("catalog card (PerfumeCard)", () => {
  const tierData = { color: "#a78bfa", background: "rgba(124,58,237,0.16)", emoji: "👑", name: "Mythic" };
  const card = (item, pricing) =>
    renderToStaticMarkup(
      <PerfumeCard perfume={item} assetResolver={(key) => key} tierData={tierData} onAddToBox={() => {}} onOpenDetails={() => {}} isDisabled={false} pricing={pricing} />
    );

  it("with no sale it is the card as it has always rendered: the single price, no badge, no strikethrough", () => {
    for (const item of [REGULAR_ONLY, INVALID_SALE, INACTIVE_SALE]) {
      const markup = card(item, aurelianPricing);

      expect(markup).not.toMatch(/perfume-card-sale-badge|perfume-card-points--sale|perfume-card-price|<s[ >]/);
      expect(markup).toContain('class="perfume-card-points"');
      expect(markup).toContain(`aria-label="${aurelianPricing.formatPointsForAssistiveTech(item.points)}"`);
    }
  });

  it("with a valid sale it adds the promotion pill and the regular / special pair, and the chip names everything for assistive technology", () => {
    const markup = card(ON_SALE, aurelianPricing);

    expect(markup).toContain('<span class="perfume-card-sale-badge">Oferta especial</span>');
    expect(markup).toContain('class="perfume-card-points perfume-card-points--sale"');
    expect(markup).toContain('aria-label="Oferta especial: $400 MXN. Precio regular: $500 MXN."');
    expect(markup).toContain('<s class="perfume-card-price-regular">$500</s>');
    expect(markup).toContain('<span class="perfume-card-price-special">$400</span>');
    expect(card(ON_SALE_CUSTOM, aurelianPricing)).toContain('<span class="perfume-card-sale-badge">Oferta de temporada</span>');
  });

  it("the Discovery Decants card is byte-identical with or without a sale on the fragrance", () => {
    expect(card(ON_SALE, decantsPricing)).toBe(card({ ...ON_SALE, sale: undefined }, decantsPricing));
    expect(card(ON_SALE, decantsPricing)).not.toMatch(/sale|oferta/i);
  });
});

describe("catalog sorting follows what the customer pays", () => {
  const catalog = [perfume(1, 5, { name: "A" }), perfume(2, 5, { name: "B", sale: { active: true, price: 250 } }), perfume(3, 3, { name: "C" })];
  const order = (sortOption, getPrice) => buildCatalogView({ catalog, sortOption, getPrice }).visiblePerfumes.map((item) => item.id);

  it("without a price accessor it sorts by the fragrance's own points, exactly as before", () => {
    expect(order("pointsAsc")).toEqual([3, 1, 2]);
    expect(order("pointsDesc")).toEqual([1, 2, 3]);
  });

  it("with the effective price a promotional fragrance sorts at its special price", () => {
    expect(order("pointsAsc", aurelianPricing.getEffectivePoints)).toEqual([2, 3, 1]); // 2.5 < 3 < 5
    expect(order("pointsDesc", aurelianPricing.getEffectivePoints)).toEqual([1, 3, 2]);
  });

  it("a points host keeps sorting by points whatever sale is attached", () => {
    expect(order("pointsAsc", decantsPricing.getEffectivePoints)).toEqual([3, 1, 2]);
  });
});

describe("every price a customer reads goes through the one resolver", () => {
  const builderSources = {
    panel: read("../../src/components/BuilderPanel.jsx"),
    runtime: read("../../src/BuilderRuntime.jsx"),
    card: read("../../src/components/PerfumeCard.jsx"),
  };

  it("no Builder surface prints a fragrance's price without FragrancePrice or the resolver", () => {
    for (const [name, source] of Object.entries(builderSources)) {
      const direct = [...source.matchAll(/pricing\.formatPoints\(perfume\.points\)/g)].length;

      // only PerfumeCard's non-sale chip prints the plain price directly (the sale branch is beside it)
      expect(direct, name).toBe(name === "card" ? 1 : 0);
    }
    expect(builderSources.panel.match(/<FragrancePrice perfume=\{perfume\} pricing=\{pricing\} \/>/g)).toHaveLength(4);
    expect(builderSources.runtime).toContain("<FragrancePrice perfume={perfume} pricing={pricing} />");
  });

  it("Product Info shows the pair and names the promotion beside it only while a valid sale applies", () => {
    expect(builderSources.runtime).toContain('perfume-details-price perfume-details-price--sale');
    expect(builderSources.runtime).toMatch(/getFragrancePrice\(perfume\)\.isOnSale && pricing\.getFragrancePrice\(perfume\)\.saleLabel && \(\s*<span className="perfume-details-sale-badge">/);
    expect(builderSources.runtime).toMatch(/className=\{pricing\.getFragrancePrice\(perfume\)\.isOnSale \? "perfume-details-price perfume-details-price--sale" : undefined\}/);
  });

  it("the charged total, the Review saving, the order and the Composer proposal total all derive from effective prices", () => {
    const summarySource = read("../../src/builder/internal/intelligence/buildCollectionSummary.js");

    expect(summarySource).toContain("getFragrancePrice(perfume).savings");
    expect(builderSources.panel).not.toContain("getProposalChargedTotal");
    expect(builderSources.panel).toContain("pricing.formatAmount(proposal.orderTotal)");
    expect(builderSources.panel).toContain('t("pricing.savings")');
    expect(builderSources.runtime).toContain("getPrice: customerPricing.getEffectivePoints");
  });
});
