import { describe, expect, it } from "vitest";

import { MARKET_SEGMENTS, brandMarketSegments, fragrances, getBrandMarketSegment } from "@discovery-box/catalog";

const catalogBrands = [...new Set(fragrances.map(({ brand }) => brand))];

describe("brand market segments", () => {
  it("offers exactly the three merchant-neutral segments", () => {
    expect(MARKET_SEGMENTS).toEqual(["arabic", "designer", "niche"]);
    expect(Object.isFrozen(MARKET_SEGMENTS)).toBe(true);
    expect(Object.isFrozen(brandMarketSegments)).toBe(true);
  });

  // This is the development-time guard for a new brand: add the brand to brandMarketSegments.js, deciding its segment.
  it("classifies every brand in the catalog into exactly one segment", () => {
    const unclassified = catalogBrands.filter((brand) => !Object.hasOwn(brandMarketSegments, brand));

    expect(unclassified, `brands missing from brandMarketSegments.js: ${unclassified.join(", ")}`).toEqual([]);
    catalogBrands.forEach((brand) => expect(MARKET_SEGMENTS, brand).toContain(brandMarketSegments[brand]));
  });

  it("lists no brand the catalog does not use, so the table cannot drift", () => {
    expect(Object.keys(brandMarketSegments).filter((brand) => !catalogBrands.includes(brand))).toEqual([]);
  });

  it("keeps the approved classification", () => {
    const brandsOf = (segment) => Object.keys(brandMarketSegments).filter((brand) => brandMarketSegments[brand] === segment).sort();

    expect(brandsOf("arabic")).toEqual(["Armaf", "Bharara", "Rayhaan"]);
    expect(brandsOf("niche")).toEqual([
      "Acqua di Parma", "Casamorati", "Creed", "Diptyque", "Essential Parfums", "Jo Milano", "Mancera", "Nishane",
      "Parfums de Marly", "Sospiro Perfumes", "Xerjoff", "Zoologist",
    ]);
    expect(brandsOf("designer")).toHaveLength(33);
    expect(Object.keys(brandMarketSegments)).toHaveLength(48);
  });

  it("treats YSL and Yves Saint Laurent as one house in one segment, keeping both brand strings", () => {
    expect(getBrandMarketSegment("YSL")).toBe("designer");
    expect(getBrandMarketSegment("Yves Saint Laurent")).toBe(getBrandMarketSegment("YSL"));
    expect(catalogBrands).toEqual(expect.arrayContaining(["YSL", "Yves Saint Laurent"]));
  });

  it("answers undefined, never a guess, for a brand it has not been told about", () => {
    expect(getBrandMarketSegment("Some Future Brand")).toBeUndefined();
    expect(getBrandMarketSegment(undefined)).toBeUndefined();
    expect(getBrandMarketSegment("constructor")).toBeUndefined();
    expect(getBrandMarketSegment("__proto__")).toBeUndefined();
  });

  it("is brand-level only: no fragrance record carries a segment field", () => {
    fragrances.forEach((fragrance) => {
      expect(Object.keys(fragrance).filter((key) => /segment|market/i.test(key)), fragrance.name).toEqual([]);
    });
  });

  it("sizes the segments as the catalog stands (3 Arabic, 20 niche, 71 designer fragrances)", () => {
    const count = (segment) => fragrances.filter(({ brand }) => getBrandMarketSegment(brand) === segment).length;

    expect([count("arabic"), count("designer"), count("niche")]).toEqual([3, 71, 20]);
  });
});
