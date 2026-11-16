import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

// /catalogo with promotions running. The catalog is replaced by the same catalog with TEST-ONLY promotions attached (the real table
// is empty): 502 on a valid sale, 1 on a valid sale with its own label, 2 with an invalid sale (above its regular price).
vi.mock("./merchant/catalog.js", async (importOriginal) => {
  const original = await importOriginal();
  const { applyPromotions } = await import("./merchant/promotions.js");

  return {
    ...original,
    aurelianCatalog: applyPromotions(original.aurelianCatalog, {
      502: { active: true, price: 400 },
      1: { active: true, price: 75, label: "Oferta de temporada" },
      2: { active: true, price: 900 },
    }),
  };
});

const { CatalogExplorer } = await import("./components/CatalogExplorer.jsx");
const markup = renderToStaticMarkup(<CatalogExplorer />);
const cardOf = (id) => markup.match(new RegExp(`<article class="product-card[^"]*" data-fragrance-id="${id}"[\\s\\S]*?</article>`))[0];

describe("/catalogo with promotions", () => {
  it("shows the regular price struck through, the special price, and the promotion pill on a fragrance on a valid sale", () => {
    const card = cardOf(502);

    expect(card).toContain('<span class="product-card__sale-badge">Oferta especial</span>');
    expect(card).toContain('class="product-card__points product-card__points--sale"');
    expect(card).toContain('<s class="product-card__price-regular">$500</s>');
    expect(card).toContain('<span class="product-card__price-special">$400</span>');
  });

  it("speaks the promotion, the price charged and the regular price in Spanish, not only the strikethrough", () => {
    expect(cardOf(502)).toContain('aria-label="Oferta especial: $400 MXN. Precio regular: $500 MXN."');
    expect(cardOf(1)).toContain('aria-label="Oferta de temporada: $75 MXN. Precio regular: $100 MXN."');
    expect(cardOf(1)).toContain('<span class="product-card__sale-badge">Oferta de temporada</span>');
  });

  it("an invalid promotion changes nothing: the plain regular price, no pill, no strikethrough", () => {
    const card = cardOf(2);

    expect(card).not.toMatch(/sale-badge|price-pair|price-regular|<s[ >]|points--sale/);
    expect(card).toMatch(/<p class="product-card__points"[^>]*aria-label="\$\d+ MXN"/);
  });

  it("a fragrance with no promotion renders exactly as before", () => {
    const card = cardOf(3);

    expect(card).not.toMatch(/sale|oferta|price-regular/i);
    expect(card).toMatch(/<span>\$\d+<\/span>/);
  });

  it("the price filter lists the prices customers pay: a promotion's special price is an option", () => {
    const select = markup.match(/<label>Precio por fragancia<select[^>]*>([\s\S]*?)<\/select>/)[1];

    expect(select).toContain('<option value="4">$400 MXN</option>');
    expect(select).toContain('<option value="0.75">$75 MXN</option>');
  });

  it("keeps the learning links, the add action and the rest of the card", () => {
    const card = cardOf(502);

    expect(card).toContain("Agregar a mi Discovery Box");
    expect(card).toContain("Explorar esta fragancia");
    expect(card).toContain('href="/build-your-box?fragrance=502"');
  });
});
