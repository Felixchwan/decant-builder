// Market segment of each brand: arabic, designer or niche. Classified once per BRAND, never per fragrance, and kept out of
// the fragrance records on purpose (a new fragrance by a known brand needs no extra field). The values are merchant-neutral
// industry segments; any wording a host shows for them (labels, order of presentation) belongs to that host.
//
// The three segments are mutually exclusive. YSL and Yves Saint Laurent are one house written two ways in the catalog, so
// both strings are listed and share a segment.
//
// A brand that is not listed here has no segment. Runtime consumers must treat that as "no opinion" (never hide it because of
// it); the completeness test in packages/catalog is what fails when a newly added brand is missing from this table.
export const MARKET_SEGMENTS = Object.freeze(["arabic", "designer", "niche"]);

export const brandMarketSegments = Object.freeze({
  // arabic
  Armaf: "arabic",
  Bharara: "arabic",
  Rayhaan: "arabic",

  // niche
  "Acqua di Parma": "niche",
  Casamorati: "niche",
  Creed: "niche",
  Diptyque: "niche",
  "Essential Parfums": "niche",
  "Jo Milano": "niche",
  Mancera: "niche",
  Nishane: "niche",
  "Parfums de Marly": "niche",
  "Sospiro Perfumes": "niche",
  Xerjoff: "niche",
  Zoologist: "niche",

  // designer
  "Abercrombie & Fitch": "designer",
  Azzaro: "designer",
  "Bath & Body Works": "designer",
  Burberry: "designer",
  Bvlgari: "designer",
  "Carolina Herrera": "designer",
  Chanel: "designer",
  Dior: "designer",
  "Dolce & Gabbana": "designer",
  "Giorgio Armani": "designer",
  Givenchy: "designer",
  Guerlain: "designer",
  Guess: "designer",
  Halloween: "designer",
  "Hermès": "designer",
  "Hugo Boss": "designer",
  Jaguar: "designer",
  "Jean Paul Gaultier": "designer",
  Lacoste: "designer",
  Loewe: "designer",
  "Maison Martin Margiela": "designer",
  Montblanc: "designer",
  "Paco Rabanne": "designer",
  Prada: "designer",
  "Ralph Lauren": "designer",
  "Salvatore Ferragamo": "designer",
  Tous: "designer",
  Valentino: "designer",
  Versace: "designer",
  "Viktor&Rolf": "designer",
  YSL: "designer",
  "Yves Saint Laurent": "designer",
  Zara: "designer",
});

// The brand's segment, or undefined for a brand that is not classified.
export function getBrandMarketSegment(brand) {
  return Object.hasOwn(brandMarketSegments, brand) ? brandMarketSegments[brand] : undefined;
}
