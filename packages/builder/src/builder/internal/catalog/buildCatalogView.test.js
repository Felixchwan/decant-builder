import { describe, expect, it } from "vitest";

import { buildCatalogView } from "./buildCatalogView.js";

const notes = {
  bergamot: { name: "Bergamot" },
  cedar: { name: "Cedar" },
  iris: { name: "Iris" },
  amber: { name: "Amber" },
  vanilla: { name: "Vanilla" },
  mint: { name: "Mint" },
  leather: { name: "Leather" },
  lemon: { name: "Lemon" },
  basil: { name: "Basil" },
  marine: { name: "Marine Accord" },
  lavender: { name: "Lavender" },
  smoke: { name: "Smoke" },
};

const fixtures = {
  bronzeFresh: {
    id: 11,
    name: "Azure Office",
    shortName: "Office Blue",
    brand: "Maison Test",
    points: 1,
    accords: ["citrus", "aromatic"],
    topNotes: ["bergamot", "mint"],
    middleNotes: ["lavender"],
    baseNotes: ["cedar"],
    seasons: ["spring", "summer"],
    occasions: ["office", "casual"],
    vibes: ["fresh", "clean"],
  },
  bronzeWarm: {
    id: 12,
    name: "Amber Date",
    shortName: "Date Amber",
    brand: "Atelier Warm",
    points: 1,
    accords: ["amber", "vanilla"],
    generalNotes: ["amber", "vanilla"],
    seasons: ["fall", "winter"],
    occasions: ["date", "night"],
    vibes: ["warm", "seductive"],
  },
  silverMarine: {
    id: 101,
    name: "Marine Shirt",
    shortName: "Marine",
    brand: "Coastal House",
    points: 1.5,
    accords: ["aquatic", "citrus"],
    topNotes: ["marine", "lemon"],
    seasons: ["summer"],
    occasions: ["office", "casual"],
    vibes: ["fresh", "relaxed"],
  },
  silverIris: {
    id: 102,
    name: "Iris Ledger",
    shortName: "Ledger",
    brand: "Atelier Warm",
    points: 1.5,
    accords: ["powdery", "woody"],
    middleNotes: ["iris"],
    baseNotes: ["cedar"],
    seasons: ["spring", "fall"],
    occasions: ["office", "formal"],
    vibes: ["elegant", "clean"],
  },
  goldLeather: {
    id: 201,
    name: "Nocturne Leather",
    shortName: "Nocturne",
    brand: "Maison Test",
    points: 2,
    accords: ["leather", "smoky"],
    baseNotes: ["leather", "smoke"],
    seasons: ["fall", "winter"],
    occasions: ["date", "formal"],
    vibes: ["dark", "bold"],
  },
  goldCitrus: {
    id: 202,
    name: "Citrus Reserve",
    shortName: "Reserve",
    brand: "Bright Lab",
    points: 2,
    accords: ["citrus", "fresh"],
    topNotes: ["lemon", "bergamot"],
    seasons: ["spring", "summer"],
    occasions: ["casual", "day"],
    vibes: ["fresh", "bright"],
  },
  platinumGreen: {
    id: 301,
    name: "Verdant Formal",
    shortName: "Verdant",
    brand: "Green Studio",
    points: 2.5,
    accords: ["green", "aromatic"],
    topNotes: ["basil"],
    middleNotes: ["iris"],
    baseNotes: ["cedar"],
    seasons: ["spring", "fall"],
    occasions: ["formal", "office"],
    vibes: ["green", "elegant"],
  },
  diamondVanilla: {
    id: 401,
    name: "Vanilla Summit",
    shortName: "Summit",
    brand: "Summit Parfums",
    points: 4,
    accords: ["vanilla", "amber"],
    generalNotes: ["vanilla", "amber"],
    seasons: ["winter"],
    occasions: ["date", "night"],
    vibes: ["warm", "luxurious"],
  },
  mythicMarine: {
    id: 501,
    name: "Ocean Myth",
    shortName: "Myth",
    brand: "Mythic Lab",
    points: 5,
    accords: ["aquatic", "mineral"],
    topNotes: ["marine"],
    seasons: ["summer", "spring"],
    occasions: ["casual", "vacation"],
    vibes: ["fresh", "unique"],
  },
  brandTieA: {
    id: 103,
    name: "A Brand Tie",
    shortName: "Tie A",
    brand: "Tie House",
    points: 1.5,
    accords: ["woody"],
    baseNotes: ["cedar"],
    seasons: ["fall"],
    occasions: ["office"],
    vibes: ["classic"],
  },
  brandTieZ: {
    id: 104,
    name: "Z Brand Tie",
    shortName: "Tie Z",
    brand: "Tie House",
    points: 1.5,
    accords: ["woody"],
    baseNotes: ["cedar"],
    seasons: ["fall"],
    occasions: ["office"],
    vibes: ["classic"],
  },
  incomplete: {
    id: 601,
    name: "Bare Bones",
    brand: "Sparse House",
    points: 6,
  },
};

const catalog = [
  fixtures.bronzeFresh,
  fixtures.bronzeWarm,
  fixtures.silverMarine,
  fixtures.silverIris,
  fixtures.goldLeather,
  fixtures.goldCitrus,
  fixtures.platinumGreen,
  fixtures.diamondVanilla,
  fixtures.mythicMarine,
  fixtures.brandTieZ,
  fixtures.brandTieA,
];

function ids(result) {
  return result.visiblePerfumes.map((perfume) => perfume.id);
}

function view(overrides = {}) {
  return buildCatalogView({
    catalog,
    notes,
    ...overrides,
  });
}

function deepFreeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    Object.values(value).forEach(deepFreeze);
  }

  return value;
}

describe("buildCatalogView", () => {
  it("returns the empty catalog fallback metadata without mutating inputs", () => {
    const emptyCatalog = Object.freeze([]);
    const emptyNotes = Object.freeze({});
    const activeFilters = Object.freeze({});

    const result = buildCatalogView({
      catalog: emptyCatalog,
      notes: emptyNotes,
      activeFilters,
      searchQuery: "  ",
    });

    expect(result).toEqual({
      visiblePerfumes: [],
      resultCount: 0,
      normalizedSearchQuery: "",
      hasActiveSearch: false,
      hasActiveFilters: false,
      filterOptions: {
        seasons: [],
        occasions: [],
        vibes: [],
      },
    });
    expect(emptyCatalog).toEqual([]);
    expect(activeFilters).toEqual({});
  });

  it("returns the default source-ordered catalog and derived filter options", () => {
    const result = view();

    expect(ids(result)).toEqual([11, 12, 101, 102, 201, 202, 301, 401, 501, 104, 103]);
    expect(result.resultCount).toBe(11);
    expect(result.normalizedSearchQuery).toBe("");
    expect(result.hasActiveSearch).toBe(false);
    expect(result.hasActiveFilters).toBe(false);
    expect(result.visiblePerfumes[0]).toBe(fixtures.bronzeFresh);
    expect(result.filterOptions).toEqual({
      seasons: ["fall", "spring", "summer", "winter"],
      occasions: ["casual", "date", "day", "formal", "night", "office", "vacation"],
      vibes: [
        "bold",
        "bright",
        "classic",
        "clean",
        "dark",
        "elegant",
        "fresh",
        "green",
        "luxurious",
        "relaxed",
        "seductive",
        "unique",
        "warm",
      ],
    });
  });

  it("searches the exact production fields and normalizes case and whitespace", () => {
    expect(ids(view({ searchQuery: " azure " }))).toEqual([11]);
    expect(ids(view({ searchQuery: "MAISON" }))).toEqual([11, 201]);
    expect(ids(view({ searchQuery: "citrus" }))).toEqual([202, 11, 101]);
    expect(ids(view({ searchQuery: "mint" }))).toEqual([11]);
    expect(ids(view({ searchQuery: "lavender" }))).toEqual([11]);
    expect(ids(view({ searchQuery: "leather" }))).toEqual([201]);
    expect(ids(view({ searchQuery: "vanilla" }))).toEqual([401, 12]);
    expect(ids(view({ searchQuery: "seductive" }))).toEqual([12]);
    expect(ids(view({ searchQuery: "marine accord" }))).toEqual([101, 501]);
    expect(ids(view({ searchQuery: "office maison" }))).toEqual([11]);
    expect(ids(view({ searchQuery: "zzzz" }))).toEqual([]);
  });

  it("characterizes fields that are not currently searchable", () => {
    expect(ids(view({ searchQuery: "Office Blue" }))).toEqual([]);
    expect(ids(view({ searchQuery: "11" }))).toEqual([]);
    expect(ids(view({ searchQuery: "spring" }))).toEqual([]);
    expect(ids(view({ searchQuery: "vacation" }))).toEqual([]);
  });

  it("orders default search results by best-match rank then name", () => {
    expect(ids(view({ searchQuery: "maison" }))).toEqual([11, 201]);
    expect(ids(view({ searchQuery: "citrus" }))).toEqual([202, 11, 101]);
    expect(ids(view({ searchQuery: "fresh" }))).toEqual([11, 202, 101, 501]);
  });

  it("lets explicit sort modes override search relevance", () => {
    expect(ids(view({ searchQuery: "citrus", sortOption: "pointsAsc" }))).toEqual([11, 101, 202]);
    expect(ids(view({ searchQuery: "citrus", sortOption: "brandAsc" }))).toEqual([202, 101, 11]);
    expect(ids(view({ searchQuery: "fresh", sortOption: "alphabetical" }))).toEqual([11, 202, 101, 501]);
  });

  it("filters by one scalar season and characterizes unsupported multiple values", () => {
    expect(ids(view({ activeFilters: { seasons: "winter" } }))).toEqual([12, 201, 401]);
    expect(ids(view({ activeFilters: { seasons: "summer" } }))).toEqual([11, 101, 202, 501]);
    expect(ids(view({ activeFilters: { seasons: "monsoon" } }))).toEqual([]);
    expect(ids(view({ activeFilters: { seasons: ["summer", "spring"] } }))).toEqual([]);
    expect(view({ activeFilters: { seasons: "" } }).hasActiveFilters).toBe(false);
  });

  it("filters by representative scalar occasions", () => {
    expect(ids(view({ activeFilters: { occasions: "office" } }))).toEqual([11, 101, 102, 301, 104, 103]);
    expect(ids(view({ activeFilters: { occasions: "casual" } }))).toEqual([11, 101, 202, 501]);
    expect(ids(view({ activeFilters: { occasions: "date" } }))).toEqual([12, 201, 401]);
    expect(ids(view({ activeFilters: { occasions: "formal" } }))).toEqual([102, 201, 301]);
    expect(ids(view({ activeFilters: { occasions: "club" } }))).toEqual([]);
  });

  it("filters by scalar vibes with exact case-sensitive values", () => {
    expect(ids(view({ activeFilters: { vibes: "fresh" } }))).toEqual([11, 101, 202, 501]);
    expect(ids(view({ activeFilters: { vibes: "warm" } }))).toEqual([12, 401]);
    expect(ids(view({ activeFilters: { vibes: ["fresh", "warm"] } }))).toEqual([]);
    expect(ids(view({ activeFilters: { vibes: "Fresh" } }))).toEqual([]);
    expect(ids(view({ activeFilters: { vibes: "unknown" } }))).toEqual([]);
  });

  it("does not support accord filters in the active filter contract", () => {
    expect(ids(view({ activeFilters: { accords: "citrus" } }))).toEqual([
      11,
      12,
      101,
      102,
      201,
      202,
      301,
      401,
      501,
      104,
      103,
    ]);
    expect(view({ activeFilters: { accords: "citrus" } }).hasActiveFilters).toBe(false);
  });

  it("composes supported filters with AND semantics", () => {
    expect(ids(view({ searchQuery: "citrus", activeFilters: { seasons: "summer" } }))).toEqual([202, 11, 101]);
    expect(ids(view({ activeFilters: { seasons: "fall", occasions: "formal" } }))).toEqual([102, 201, 301]);
    expect(ids(view({ activeFilters: { vibes: "fresh", occasions: "office" } }))).toEqual([11, 101]);
    expect(ids(view({ searchQuery: "cedar", activeFilters: { seasons: "spring", occasions: "formal", vibes: "elegant" } }))).toEqual([102, 301]);
    expect(ids(view({ searchQuery: "leather", activeFilters: { seasons: "summer", vibes: "fresh" } }))).toEqual([]);
  });

  it("sorts by points ascending with name tie-breaking and decimal support", () => {
    expect(ids(view({ sortOption: "pointsAsc" }))).toEqual([12, 11, 103, 102, 101, 104, 202, 201, 301, 401, 501]);
  });

  it("sorts by points descending with name tie-breaking", () => {
    expect(ids(view({ sortOption: "pointsDesc" }))).toEqual([501, 401, 301, 202, 201, 103, 102, 101, 104, 12, 11]);
  });

  it("sorts by brand A-Z then name", () => {
    expect(ids(view({ sortOption: "brandAsc" }))).toEqual([12, 102, 202, 101, 301, 11, 201, 501, 401, 103, 104]);
  });

  it("sorts by tier rank, points, and name", () => {
    expect(ids(view({ sortOption: "tier" }))).toEqual([12, 11, 103, 102, 101, 104, 202, 201, 301, 401, 501]);
  });

  it("sorts alphabetically by perfume name", () => {
    expect(ids(view({ sortOption: "alphabetical" }))).toEqual([103, 12, 11, 202, 102, 101, 201, 501, 401, 301, 104]);
  });

  it("characterizes undefined, null, unsupported, and bestMatch sort behavior", () => {
    expect(ids(view({ sortOption: undefined }))).toEqual([11, 12, 101, 102, 201, 202, 301, 401, 501, 104, 103]);
    expect(ids(view({ sortOption: null }))).toEqual([11, 12, 101, 102, 201, 202, 301, 401, 501, 104, 103]);
    expect(ids(view({ sortOption: "unsupported" }))).toEqual([11, 12, 101, 102, 201, 202, 301, 401, 501, 104, 103]);
    expect(ids(view({ sortOption: "bestMatch" }))).toEqual([11, 12, 101, 102, 201, 202, 301, 401, 501, 104, 103]);
    expect(ids(view({ sortOption: "unsupported", searchQuery: "fresh" }))).toEqual([11, 202, 101, 501]);
  });

  it("has no selected perfume or capacity contract", () => {
    const result = view({
      selectedPerfumeIds: [11],
      selectedPerfumes: [fixtures.bronzeFresh],
      maxSelectableSlots: 1,
    });

    expect(ids(result)).toEqual([11, 12, 101, 102, 201, 202, 301, 401, 501, 104, 103]);
    expect(result.visiblePerfumes[0]).toBe(fixtures.bronzeFresh);
    expect(result.visiblePerfumes[0]).not.toHaveProperty("selected");
    expect(result.visiblePerfumes[0]).not.toHaveProperty("addable");
  });

  it("characterizes incomplete catalog records with and without filters/search sorts", () => {
    const incompleteCatalog = [fixtures.incomplete];

    expect(ids(buildCatalogView({ catalog: incompleteCatalog, notes }))).toEqual([601]);
    expect(ids(buildCatalogView({ catalog: incompleteCatalog, notes, searchQuery: "bare" }))).toEqual([601]);
    expect(ids(buildCatalogView({ catalog: incompleteCatalog, notes, searchQuery: "sparse" }))).toEqual([601]);
    expect(ids(buildCatalogView({ catalog: incompleteCatalog, notes, sortOption: "pointsAsc" }))).toEqual([601]);
  });

  it("throws for non-array catalog and for records missing arrays when matching an active filter", () => {
    expect(() => buildCatalogView({ catalog: null })).toThrow("buildCatalogView requires catalog to be an array.");
    expect(() => buildCatalogView({ catalog: {} })).toThrow("buildCatalogView requires catalog to be an array.");
    expect(() =>
      buildCatalogView({
        catalog: [fixtures.incomplete],
        notes,
        activeFilters: { seasons: "spring" },
      })
    ).toThrow();
    expect(() =>
      buildCatalogView({
        catalog: [fixtures.incomplete],
        notes,
        activeFilters: { occasions: "office" },
      })
    ).toThrow();
  });

  it("characterizes missing names and brands under search ranking and explicit sorts", () => {
    const missingName = { ...fixtures.bronzeFresh, id: 31, name: undefined };
    const missingBrand = { ...fixtures.bronzeFresh, id: 32, brand: undefined };

    expect(() =>
      buildCatalogView({ catalog: [missingName, fixtures.bronzeFresh], notes, searchQuery: "mint" })
    ).toThrow();
    expect(() =>
      buildCatalogView({ catalog: [missingBrand, fixtures.bronzeFresh], notes, searchQuery: "mint" })
    ).toThrow();
    expect(ids(buildCatalogView({ catalog: [missingName, fixtures.bronzeFresh], notes, sortOption: "alphabetical" }))).toEqual([11, 31]);
    expect(ids(buildCatalogView({ catalog: [missingBrand, fixtures.bronzeFresh], notes, sortOption: "brandAsc" }))).toEqual([11, 32]);
    expect(() =>
      buildCatalogView({ catalog: [fixtures.bronzeFresh, missingName], notes, sortOption: "alphabetical" })
    ).toThrow();
    expect(() =>
      buildCatalogView({ catalog: [fixtures.bronzeFresh, missingBrand], notes, sortOption: "brandAsc" })
    ).toThrow();
  });

  it("does not mutate frozen catalog records, notes, filters, or nested arrays", () => {
    const frozenCatalog = deepFreeze([
      { ...fixtures.bronzeFresh, topNotes: [...fixtures.bronzeFresh.topNotes] },
      { ...fixtures.silverIris, middleNotes: [...fixtures.silverIris.middleNotes] },
      { ...fixtures.goldLeather, baseNotes: [...fixtures.goldLeather.baseNotes] },
    ]);
    const frozenNotes = deepFreeze({ ...notes });
    const activeFilters = deepFreeze({ seasons: "spring", occasions: "office" });

    const result = buildCatalogView({
      catalog: frozenCatalog,
      notes: frozenNotes,
      activeFilters,
      searchQuery: "cedar",
      sortOption: "pointsDesc",
    });

    expect(ids(result)).toEqual([102, 11]);
    expect(Object.isFrozen(frozenCatalog[0].topNotes)).toBe(true);
    expect(activeFilters).toEqual({ seasons: "spring", occasions: "office" });
    expect(frozenNotes.bergamot).toEqual({ name: "Bergamot" });
  });

  it("is deterministic for repeated identical inputs", () => {
    const first = view({
      searchQuery: "fresh",
      activeFilters: { seasons: "summer" },
      sortOption: "pointsAsc",
    });
    const second = view({
      searchQuery: "fresh",
      activeFilters: { seasons: "summer" },
      sortOption: "pointsAsc",
    });

    expect(second).toEqual(first);
    expect(ids(first)).toEqual([11, 101, 202, 501]);
  });

  it("preserves source order only for equal default sort values without search", () => {
    const equalCatalog = [
      fixtures.brandTieZ,
      fixtures.brandTieA,
      { ...fixtures.brandTieA, id: 105, name: "M Brand Tie" },
    ];

    expect(ids(buildCatalogView({ catalog: equalCatalog, notes }))).toEqual([104, 103, 105]);
    expect(ids(buildCatalogView({ catalog: equalCatalog, notes, sortOption: "pointsAsc" }))).toEqual([103, 105, 104]);
  });

  it("covers a realistic golden catalog exploration scenario", () => {
    const result = view({
      searchQuery: "cedar",
      activeFilters: {
        seasons: "spring",
        occasions: "office",
        vibes: "elegant",
      },
      sortOption: "pointsDesc",
      selectedPerfumeIds: [301],
    });

    expect(ids(result)).toEqual([301, 102]);
    expect(result.resultCount).toBe(2);
    expect(result.normalizedSearchQuery).toBe("cedar");
    expect(result.hasActiveSearch).toBe(true);
    expect(result.hasActiveFilters).toBe(true);
    expect(result.visiblePerfumes.map((perfume) => perfume.name)).toEqual([
      "Verdant Formal",
      "Iris Ledger",
    ]);
    expect(result.visiblePerfumes.map((perfume) => perfume.selected)).toEqual([
      undefined,
      undefined,
    ]);
    expect(result.filterOptions.seasons).toEqual(["fall", "spring", "summer", "winter"]);
  });
});
