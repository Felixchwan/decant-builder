import { describe, expect, it } from "vitest";

import { compareFragrancesForDisplay, fragrances, sortFragrancesForDisplay } from "@discovery-box/catalog";
import { aurelianAvailableIds, aurelianCatalog } from "../../../apps/aurelian/src/merchant/catalog.js";
import { discoveryDecantsAvailableIds } from "../../../src/merchants/discoveryDecants/catalog.js";

// A fragrance's ID is its PERMANENT IDENTITY. It is stored in saved boxes (decant-builder-v1 / aurelian-builder-v1), in
// Perceptual Learning evidence and in `?fragrance=<id>` / `?details=<id>` links, none of which can be migrated from the
// repo. IDs are therefore never reassigned to change how the catalog reads: presentation order (tier, brand, name) is
// derived by sortFragrancesForDisplay and applied where a host composes its catalog.
//
// If this file fails because an ID moved, the change is wrong -- not the table. New fragrances take a NEW, unused ID.

// [id, brand, name] of every fragrance. Append new fragrances; never edit or renumber an existing row.
const PINNED_IDENTITIES = [
  [1, "Giorgio Armani", "Acqua di Gio EDT"],
  [2, "Dolce & Gabbana", "Light Blue Pour Homme EDT"],
  [3, "Versace", "Versace Pour Homme"],
  [4, "Montblanc", "Legend EDT"],
  [5, "Jean Paul Gaultier", "Le Male"],
  [6, "Versace", "Eros EDP"],
  [7, "Hugo Boss", "The Scent EDT"],
  [8, "Azzaro", "The Most Wanted"],
  [9, "Abercrombie & Fitch", "Fierce"],
  [10, "Guerlain", "L'Homme Idéal EDT"],
  [11, "Jean Paul Gaultier", "Scandal Pour Homme"],
  [12, "Carolina Herrera", "CH Men"],
  [13, "Dolce & Gabbana", "The One for Men EDP"],
  [14, "Halloween", "Halloween Man"],
  [15, "Ralph Lauren", "Polo Black"],
  [16, "Salvatore Ferragamo", "Uomo Signature"],
  [17, "Givenchy", "Gentlemen Only"],
  [18, "Lacoste", "L.12.12 Blanc EDP"],
  [19, "Armaf", "Club de Nuit Intense Man"],
  [20, "Salvatore Ferragamo", "F by Ferragamo Black"],
  [21, "Halloween", "Halloween Man Mystery"],
  [22, "Montblanc", "Legend Blue"],
  [23, "Montblanc", "Legend EDP"],
  [24, "Montblanc", "Legend Red"],
  [25, "Montblanc", "Montblanc Explorer"],
  [26, "Ralph Lauren", "Polo Red EDT"],
  [27, "Burberry", "Touch for Men"],
  [28, "Tous", "Tous Man"],
  [29, "Versace", "Versace Eros Flame"],
  [30, "Zara", "Vibrant Leather Bogoss"],
  [31, "Bharara", "Viking Cairo"],
  [32, "Guess", "Guess Man Gold"],
  [33, "Jaguar", "Jaguar Pace"],
  [34, "Givenchy", "Givenchy Pour Homme Blue Label"],
  [35, "Bath & Body Works", "Graphite"],
  [36, "Rayhaan", "Aquatica"],
  [100, "Acqua di Parma", "Arancia di Capri"],
  [101, "Acqua di Parma", "Essenza"],
  [102, "Acqua di Parma", "Fico di Amalfi"],
  [103, "Acqua di Parma", "Mandarino di Sicilia"],
  [104, "Giorgio Armani", "Armani Code EDT"],
  [105, "Bvlgari", "Bvlgari Man Rain Essence"],
  [106, "Carolina Herrera", "212 VIP Black"],
  [107, "Carolina Herrera", "Birds of Paradise for Him"],
  [108, "Carolina Herrera", "Bad Boy Cobalt Parfum Electrique"],
  [109, "Dolce & Gabbana", "K EDP Intense"],
  [110, "Hermès", "Concentré d'Orange Verte"],
  [111, "Hermès", "Terre d'Hermès EDT"],
  [112, "Jean Paul Gaultier", "Le Beau Le Parfum"],
  [113, "Jean Paul Gaultier", "Le Male Le Parfum"],
  [114, "Jo Milano", "Game of Spades Wildcard"],
  [115, "Mancera", "Cedrat Boise"],
  [116, "Paco Rabanne", "Invictus Victory"],
  [117, "YSL", "YSL L'Homme"],
  [118, "YSL", "La Nuit de L'Homme"],
  [119, "Acqua di Parma", "Mirto di Panarea"],
  [120, "Ralph Lauren", "Ralph's Club"],
  [121, "Valentino", "Born in Roma Yellow Dream"],
  [201, "Dior", "Dior Homme Sport"],
  [202, "Dior", "Sauvage EDP"],
  [203, "Loewe", "Loewe 7 Cobalt"],
  [204, "Maison Martin Margiela", "Replica By The Fireplace"],
  [205, "Givenchy", "Gentleman EDP"],
  [206, "Ralph Lauren", "Polo Blue Parfum"],
  [207, "Ralph Lauren", "Polo Deep Blue Parfum"],
  [208, "Prada", "Prada L'Homme"],
  [209, "Prada", "Luna Rossa Black"],
  [210, "Valentino", "Born In Roma EDT"],
  [211, "Valentino", "Born In Roma Coral Fantasy"],
  [212, "Viktor&Rolf", "Spicebomb Extreme"],
  [213, "Yves Saint Laurent", "YSL Y EDP"],
  [214, "Prada", "Prada L'Homme L'Eau"],
  [215, "Ralph Lauren", "Ralph's Club Elixir"],
  [216, "Viktor&Rolf", "Spicebomb Night Vision Eau de Parfum"],
  [217, "Montblanc", "Patchouli Ink"],
  [218, "Dior", "Dior Homme Cologne 2022"],
  [301, "Chanel", "Allure Homme Edition Blanche EDP"],
  [302, "Chanel", "Allure Homme Sport Superleggera"],
  [303, "Essential Parfums", "Bois Imperial"],
  [304, "Essential Parfums", "Divine Vanille"],
  [305, "Essential Parfums", "Orange X Santal"],
  [306, "Giorgio Armani", "Acqua di Gio Elixir"],
  [401, "Creed", "Silver Mountain Water"],
  [402, "Dior", "Sauvage Elixir"],
  [403, "Parfums de Marly", "Carlisle"],
  [404, "Parfums de Marly", "Layton"],
  [405, "Casamorati", "Mefisto"],
  [406, "Nishane", "Hacivat"],
  [408, "Xerjoff", "Torino21"],
  [409, "Diptyque", "Orphéon EDP"],
  [410, "Sospiro Perfumes", "Il Padrino"],
  [411, "Xerjoff", "Renaissance"],
  [500, "Zoologist", "Squid"],
  [501, "Yves Saint Laurent", "Tuxedo"],
];

const displayLabel = ({ brand, name }) => `${brand} / ${name}`;

describe("fragrance identity is independent of catalog presentation order", () => {
  it("pins every canonical ID to its fragrance", () => {
    expect(fragrances.map(({ id, brand, name }) => [id, brand, name])).toEqual(
      expect.arrayContaining(PINNED_IDENTITIES)
    );
    expect(fragrances).toHaveLength(PINNED_IDENTITIES.length);
  });

  it("leaves the canonical source order alone: it is not the presentation order and is never reshuffled to look alphabetical", () => {
    // the first canonical entries are the original flagship picks, not the alphabetical first
    expect(fragrances[0]).toMatchObject({ id: 1, name: "Acqua di Gio EDT" });
    expect(sortFragrancesForDisplay(fragrances)[0]).toMatchObject({ id: 9, name: "Fierce" });
  });

  it("resolves an ID to the same fragrance whatever the display order is (`?fragrance=<id>` stays identity-correct)", () => {
    const resolve = (catalog, id) => catalog.find((item) => item.id === id);

    for (const [id, brand, name] of PINNED_IDENTITIES) {
      expect(displayLabel(resolve(aurelianCatalog, id)), `id ${id}`).toBe(`${brand} / ${name}`);
      expect(resolve(sortFragrancesForDisplay(fragrances), id)).toBe(resolve(fragrances, id));
    }
    expect(aurelianCatalog.find((item) => item.id === 9).name).toBe("Fierce");
    expect(aurelianCatalog.find((item) => item.id === 36).name).toBe("Aquatica");
  });
});

describe("catalog display order: tier, then brand, then name", () => {
  const TIER_NAMES = ["Bronze", "Silver", "Gold", "Platinum", "Diamond", "Mythic"];
  const tierOf = (id) => TIER_NAMES[id < 100 ? 0 : Math.min(Math.floor(id / 100), 5)];
  const collator = new Intl.Collator("en", { sensitivity: "base" });
  const display = sortFragrancesForDisplay(fragrances);

  it("never mixes tiers, and keeps the Bronze..Mythic sequence", () => {
    const tiers = display.map(({ id }) => tierOf(id));
    const sequence = tiers.filter((tier, index) => index === 0 || tier !== tiers[index - 1]);

    expect(sequence).toEqual(TIER_NAMES);
  });

  for (const tier of TIER_NAMES) {
    it(`lists ${tier} alphabetically by brand, then by name (case- and accent-insensitive)`, () => {
      const members = display.filter(({ id }) => tierOf(id) === tier);
      const expected = [...members].sort((a, b) => collator.compare(a.brand, b.brand) || collator.compare(a.name, b.name));

      expect(members.map(displayLabel)).toEqual(expected.map(displayLabel));
    });

    it(`keeps each brand's ${tier} fragrances in one adjacent run`, () => {
      const brands = display.filter(({ id }) => tierOf(id) === tier).map(({ brand }) => brand);
      const runs = brands.filter((brand, index) => index === 0 || brand !== brands[index - 1]);

      expect(new Set(runs).size).toBe(runs.length);
    });
  }

  it("groups the examples a reader expects", () => {
    const labels = display.map(({ name }) => name);
    const adjacent = (names) => names.map((name) => labels.indexOf(name)).every((position, i, all) => i === 0 || position === all[i - 1] + 1);

    expect(adjacent(["Legend Blue", "Legend EDP", "Legend EDT", "Legend Red"])).toBe(true);
    expect(adjacent(["Arancia di Capri", "Essenza", "Fico di Amalfi", "Mandarino di Sicilia", "Mirto di Panarea"])).toBe(true);
    expect(adjacent(["Renaissance", "Torino21"])).toBe(true);
    expect(adjacent(["Born In Roma Coral Fantasy", "Born In Roma EDT"])).toBe(true);
    // Hermès sorts as "Hermes": between Giorgio Armani and Jean Paul Gaultier
    expect(display.filter(({ brand }) => brand === "Hermès").length).toBe(2);
  });

  it("is deterministic, does not mutate its input, and returns the very same records (IDs untouched)", () => {
    const before = fragrances.map((item) => item.id).join();
    const first = sortFragrancesForDisplay(fragrances);
    const second = sortFragrancesForDisplay([...fragrances].reverse());

    expect(first.map(({ id }) => id)).toEqual(second.map(({ id }) => id));
    expect(fragrances.map((item) => item.id).join()).toBe(before);
    first.forEach((record) => expect(fragrances.includes(record)).toBe(true));
    expect(first).not.toBe(fragrances);
  });

  it("orders by tier, brand and name only; an ID decides nothing but an exact tie", () => {
    const records = [
      { id: 1, brand: "Zeta", name: "A" },
      { id: 2, brand: "alpha", name: "B" },
      { id: 3, brand: "Alpha", name: "Á" },
      { id: 4, brand: "Alpha", name: "A" },
      { id: 150, brand: "Aardvark", name: "Z" },
    ];

    // tier first (150 is Silver, so last), then brand ignoring case, then name ignoring accents: "Á" ties "A" and the ID settles it
    expect(sortFragrancesForDisplay(records).map(({ id }) => id)).toEqual([3, 4, 2, 1, 150]);
    // an exact brand + name tie falls back to the ID
    expect(compareFragrancesForDisplay({ id: 2, brand: "B", name: "N" }, { id: 1, brand: "b", name: "n" })).toBeGreaterThan(0);
  });

  it("is what both hosts present, while their manifests only decide membership", () => {
    expect(aurelianCatalog.map(({ id }) => id)).toEqual(display.map(({ id }) => id));
    expect([...aurelianAvailableIds].sort((a, b) => a - b)).toEqual(fragrances.map(({ id }) => id).sort((a, b) => a - b));
    expect(discoveryDecantsAvailableIds).toEqual(aurelianAvailableIds);
  });
});
