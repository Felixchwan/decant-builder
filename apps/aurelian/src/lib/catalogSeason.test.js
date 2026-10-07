import { getExplicitSeasonWeight as getSharedExplicitSeasonWeight } from "@discovery-box/catalog";
import { describe, expect, it } from "vitest";
import { aurelianCatalog } from "../merchant/catalog.js";
import { SEASONAL_SLOTS } from "./seasonalSelection.js";
import {
  buildFullCatalogHref,
  filterCatalogBySeason,
  getCatalogSeasonLabel,
  getExplicitSeasonWeight,
  isSeasonCompatible,
  parseCatalogSeason,
  parseCatalogSeasonFromSearch,
  rankBySeasonalRelevance,
} from "./catalogSeason.js";
import { filterCatalog } from "./filterCatalog.js";

const SEASONS = ["spring", "summer", "fall", "winter"];

const fragrance = (id, seasons, extra = {}) => ({ id, name: `F${id}`, brand: "B", points: 1, seasons, ...extra });
describe("seasonal URL contract", () => {
  it("accepts exactly the four public keys", () => {
    for (const key of SEASONS) expect(parseCatalogSeason(key)).toBe(key);
    expect(SEASONAL_SLOTS.map(({ key }) => key)).toEqual(SEASONS);
  });

  it("ignores everything else gracefully instead of throwing", () => {
    const invalid = ["autumn", "primavera", "verano", "otoño", "invierno", "SPRING", "Fall", "", " spring", "spring ", "all", undefined, null, 1, {}, ["spring", "summer"], [], ["autumn"]];
    for (const bad of invalid) {
      expect(() => parseCatalogSeason(bad)).not.toThrow();
      expect(parseCatalogSeason(bad), String(bad)).toBeNull();
    }
    expect(parseCatalogSeason(["winter"])).toBe("winter");
  });

  it("parses a raw query string the same way, including repeats", () => {
    expect(parseCatalogSeasonFromSearch("?season=fall")).toBe("fall");
    expect(parseCatalogSeasonFromSearch("?season=fall&fragrance=210")).toBe("fall");
    expect(parseCatalogSeasonFromSearch("?season=autumn")).toBeNull();
    expect(parseCatalogSeasonFromSearch("?season=fall&season=winter")).toBeNull();
    expect(parseCatalogSeasonFromSearch("")).toBeNull();
    expect(parseCatalogSeasonFromSearch("?fragrance=5")).toBeNull();
  });

  it("names each season from the same slots the landing uses", () => {
    expect(getCatalogSeasonLabel("fall")).toEqual({ title: "Otoño", lower: "otoño" });
    expect(getCatalogSeasonLabel("spring").lower).toBe("primavera");
    expect(getCatalogSeasonLabel("autumn")).toBeNull();
  });

  it("keeps every other query param when leaving seasonal mode", () => {
    expect(buildFullCatalogHref({})).toBe("/catalogo");
    expect(buildFullCatalogHref(undefined)).toBe("/catalogo");
    expect(buildFullCatalogHref({ season: "fall" })).toBe("/catalogo");
    expect(buildFullCatalogHref({ season: "fall", fragrance: "210" })).toBe("/catalogo?fragrance=210");
    expect(buildFullCatalogHref({ season: ["fall", "winter"], fragrance: ["1", "2"] })).toBe("/catalogo?fragrance=1&fragrance=2");
  });
});

describe("seasonal compatibility", () => {
  it("is membership in the declared seasons list: non-exclusive, and nothing else", () => {
    const both = fragrance(1, ["spring", "summer"], { accords: ["fresh"], vibes: ["winter"], brand: "Winter", seasonWeights: { spring: 9, summer: 9, fall: 0, winter: 0 } });
    expect(isSeasonCompatible(both, "spring")).toBe(true);
    expect(isSeasonCompatible(both, "summer")).toBe(true);
    expect(isSeasonCompatible(both, "fall")).toBe(false);
    expect(isSeasonCompatible(both, "winter")).toBe(false);
    expect(isSeasonCompatible({ id: 2 }, "spring")).toBe(false);
  });

  it("never lets a positive weight pull an undeclared fragrance into a season", () => {
    const heavyButUndeclared = fragrance(1, ["summer"], { seasonWeights: { spring: 10, summer: 4, fall: 0, winter: 0 } });
    expect(filterCatalogBySeason([heavyButUndeclared], "spring")).toEqual([]);
  });

  it("matches the declared seasons of the real catalog, which also holds weights that disagree with them", () => {
    for (const key of SEASONS) {
      const result = filterCatalogBySeason(aurelianCatalog, key);
      expect(result.length).toBeGreaterThan(0);
      expect(result.every((item) => item.seasons.includes(key))).toBe(true);
      expect(result).toHaveLength(aurelianCatalog.filter((item) => item.seasons.includes(key)).length);
    }
    expect(aurelianCatalog.some((item) => item.seasonWeights.spring > 0 && !item.seasons.includes("spring"))).toBe(true);
  });

  it("returns the very same catalog when no season is active", () => {
    expect(filterCatalogBySeason(aurelianCatalog, null)).toBe(aurelianCatalog);
  });
});

describe("seasonal relevance ranking", () => {
  // Ranking asks a weight source per item; here it is a plain lookup so each
  // case states its own editorial table. null = unscored.
  const ranked = (items, table) => rankBySeasonalRelevance(items, "spring", (item) => table[item.id] ?? null).map(({ id }) => id);
  const items = (...ids) => ids.map((id) => fragrance(id, ["spring"]));

  it("orders scored matches by descending explicit weight", () => {
    expect(ranked(items(1, 2, 3), { 1: 6, 2: 9, 3: 7 })).toEqual([2, 3, 1]);
  });

  it("keeps the existing catalog order between equal weights", () => {
    expect(ranked(items(5, 2, 9, 1), { 5: 8, 2: 8, 9: 8, 1: 8 })).toEqual([5, 2, 9, 1]);
  });

  it("puts compatible fragrances with no explicit weight after every scored one, in catalog order", () => {
    expect(ranked(items(1, 2, 3, 4), { 2: 3, 4: 8 })).toEqual([4, 2, 1, 3]);
  });

  it("treats a missing weight as UNSCORED, not zero, and an explicit zero as scored", () => {
    expect(ranked(items(1, 2), { 2: 0 })).toEqual([2, 1]);
  });

  it("does not mutate its input", () => {
    const input = items(1, 2);
    rankBySeasonalRelevance(input, "spring", (item) => (item.id === 2 ? 9 : 1));
    expect(input.map(({ id }) => id)).toEqual([1, 2]);
  });

  it("ranks by the shared catalog's explicit weights by default, ignoring the merged seasonWeights placeholder", () => {
    // 120 has no editorial entry: its merged seasonWeights say 6, which must NOT read as a score.
    const unscored = aurelianCatalog.find((item) => item.id === 120);
    expect(unscored.seasonWeights.spring).toBe(6);
    expect(getExplicitSeasonWeight(unscored, "spring")).toBeNull();
    const scoredSix = aurelianCatalog.find((item) => item.id === 211);
    expect(getExplicitSeasonWeight(scoredSix, "spring")).toBe(getSharedExplicitSeasonWeight(211, "spring"));
    expect(rankBySeasonalRelevance([unscored, scoredSix], "spring").map(({ id }) => id)).toEqual([211, 120]);
  });
});

describe("filterCatalog with and without a season", () => {
  it("is exactly the old full-catalog filter when no season is given", () => {
    const legacy = (catalog, query, points) => {
      const normalized = query.trim().toLocaleLowerCase("es-MX");
      return catalog.filter((item) => (!normalized || `${item.brand} ${item.name}`.toLocaleLowerCase("es-MX").includes(normalized)) && (points === "all" || item.points === Number(points)));
    };
    for (const [query, points] of [["", "all"], ["dior", "all"], ["", "1"], ["armani", "2"], ["zzzz", "all"]]) {
      expect(filterCatalog(aurelianCatalog, query, points)).toEqual(legacy(aurelianCatalog, query, points));
      expect(filterCatalog(aurelianCatalog, query, points, null)).toEqual(legacy(aurelianCatalog, query, points));
    }
    expect(filterCatalog(aurelianCatalog, "", "all")).toHaveLength(aurelianCatalog.length);
  });

  it("searches INSIDE the season, never leaking a non-seasonal result", () => {
    for (const key of SEASONS) {
      const result = filterCatalog(aurelianCatalog, "dior", "all", key);
      expect(result.every((item) => item.seasons.includes(key))).toBe(true);
      expect(result.every((item) => `${item.brand} ${item.name}`.toLowerCase().includes("dior"))).toBe(true);
    }
    const outsideFall = aurelianCatalog.find((item) => !item.seasons.includes("fall"));
    expect(filterCatalog(aurelianCatalog, outsideFall.name, "all", "fall").some((item) => item.id === outsideFall.id)).toBe(false);
    expect(filterCatalog(aurelianCatalog, outsideFall.name, "all", null).some((item) => item.id === outsideFall.id)).toBe(true);
  });

  it("applies the points filter inside the season too", () => {
    const result = filterCatalog(aurelianCatalog, "", "1", "winter");
    expect(result.length).toBeGreaterThan(0);
    expect(result.every((item) => item.points === 1 && item.seasons.includes("winter"))).toBe(true);
  });

  it("ranks the real catalog scored-first, descending, stable", () => {
    const catalogIndex = (id) => aurelianCatalog.findIndex((item) => item.id === id);
    for (const key of SEASONS) {
      const result = filterCatalog(aurelianCatalog, "", "all", key);
      const weights = result.map((item) => getExplicitSeasonWeight(item, key));
      const firstUnscored = weights.findIndex((weight) => weight === null);
      const scoredCount = firstUnscored === -1 ? weights.length : firstUnscored;
      expect(weights.slice(scoredCount).every((weight) => weight === null)).toBe(true);
      for (let index = 1; index < scoredCount; index += 1) {
        expect(weights[index - 1]).toBeGreaterThanOrEqual(weights[index]);
        if (weights[index - 1] === weights[index]) {
          expect(catalogIndex(result[index - 1].id)).toBeLessThan(catalogIndex(result[index].id));
        }
      }
      for (let index = scoredCount + 1; index < result.length; index += 1) {
        expect(catalogIndex(result[index - 1].id)).toBeLessThan(catalogIndex(result[index].id));
      }
    }
  });
});

describe("explicit weights come from the shared catalog, not from the numbers", () => {
  it("is the shared helper's answer for every Aurelian fragrance and season", () => {
    for (const item of aurelianCatalog) {
      for (const key of SEASONS) {
        expect(getExplicitSeasonWeight(item, key), `${item.id}/${key}`).toBe(getSharedExplicitSeasonWeight(item.id, key));
      }
    }
  });

  it("leaves the fragrances without an editorial entry unscored in every season, and scores the rest", () => {
    const unscored = aurelianCatalog.filter((item) => SEASONS.every((key) => getExplicitSeasonWeight(item, key) === null));
    expect(unscored.length).toBeGreaterThan(0);
    expect(unscored.length).toBeLessThan(aurelianCatalog.length / 2);
    for (const item of aurelianCatalog) {
      if (unscored.includes(item)) continue;
      for (const key of SEASONS) expect(typeof getExplicitSeasonWeight(item, key), `${item.id}/${key}`).toBe("number");
    }
  });

  it("never looks at an item's own seasonWeights", () => {
    const forged = { id: 120, seasons: ["spring"], seasonWeights: { spring: 10, summer: 10, fall: 10, winter: 10 } };
    expect(getExplicitSeasonWeight(forged, "spring")).toBeNull();
  });
});
