import { describe, expect, it } from "vitest";

import { MARKET_SEGMENTS, fragrances, getBrandMarketSegment, notes } from "@discovery-box/catalog";
import { buildCatalogView } from "./buildCatalogView.js";

const ALL = [...MARKET_SEGMENTS];
const view = (input = {}) => buildCatalogView({ catalog: fragrances, notes, ...input });
const idsOf = (result) => result.visiblePerfumes.map(({ id }) => id).sort((a, b) => a - b);
const segmentOf = (perfume) => getBrandMarketSegment(perfume.brand);
const inSegments = (segments) => fragrances.filter((perfume) => segments.includes(segmentOf(perfume))).map(({ id }) => id).sort((a, b) => a - b);

describe("buildCatalogView: market segment filter", () => {
  it("shows the complete catalog when no segment filter is given, and when all three segments are enabled", () => {
    const everything = idsOf(view());

    expect(everything).toHaveLength(fragrances.length);
    expect(idsOf(view({ enabledMarketSegments: null }))).toEqual(everything);
    expect(idsOf(view({ enabledMarketSegments: undefined }))).toEqual(everything);
    expect(idsOf(view({ enabledMarketSegments: ALL }))).toEqual(everything);
    expect(view({ enabledMarketSegments: ALL }).hasActiveFilters).toBe(false);
  });

  it.each(ALL)("disabling %s hides exactly that segment's fragrances", (segment) => {
    const enabled = ALL.filter((candidate) => candidate !== segment);
    const result = view({ enabledMarketSegments: enabled });

    expect(idsOf(result)).toEqual(inSegments(enabled));
    expect(result.visiblePerfumes.some((perfume) => segmentOf(perfume) === segment)).toBe(false);
    expect(result.hasActiveFilters).toBe(true);
  });

  it("allows every combination, and each shows exactly the union of its enabled segments", () => {
    const combinations = [["arabic"], ["designer"], ["niche"], ["arabic", "niche"], ["arabic", "designer"], ["designer", "niche"], ALL];

    for (const enabled of combinations) {
      expect(idsOf(view({ enabledMarketSegments: enabled })), enabled.join("+")).toEqual(inSegments(enabled));
    }
    expect(inSegments(["arabic"])).toHaveLength(3);
  });

  it("shows nothing at all when no segment is enabled, with a zero count and nothing re-enabled", () => {
    const result = view({ enabledMarketSegments: [] });

    expect(result.visiblePerfumes).toEqual([]);
    expect(result.resultCount).toBe(0);
    expect(result.hasActiveFilters).toBe(true);
  });

  it("composes with search by AND", () => {
    const search = view({ searchQuery: "armani" });
    const withSegment = view({ searchQuery: "armani", enabledMarketSegments: ["niche"] });
    const designerOnly = view({ searchQuery: "armani", enabledMarketSegments: ["designer"] });

    expect(idsOf(search).length).toBeGreaterThan(0);
    expect(idsOf(withSegment)).toEqual([]); // Armani is a designer house
    expect(idsOf(designerOnly)).toEqual(idsOf(search));
    expect(idsOf(view({ searchQuery: "xerjoff", enabledMarketSegments: ["niche"] })).length).toBe(2);
    expect(idsOf(view({ searchQuery: "xerjoff", enabledMarketSegments: ["designer", "arabic"] }))).toEqual([]);
  });

  it.each([
    ["seasons", "summer"],
    ["occasions", "vacation"],
    ["vibes", "fresh"],
  ])("composes with the %s filter by AND", (category, value) => {
    const base = view({ activeFilters: { [category]: value } });
    const enabled = ["arabic", "niche"];
    const composed = view({ activeFilters: { [category]: value }, enabledMarketSegments: enabled });
    const expected = idsOf(base).filter((id) => enabled.includes(segmentOf(fragrances.find((perfume) => perfume.id === id))));

    expect(idsOf(base).length).toBeGreaterThan(idsOf(composed).length);
    expect(idsOf(composed)).toEqual(expected);
    expect(composed.visiblePerfumes.every((perfume) => perfume[category].includes(value))).toBe(true);
  });

  it("composes with all of them together", () => {
    const composed = view({ searchQuery: "e", activeFilters: { seasons: "summer", occasions: "daily", vibes: "fresh" }, enabledMarketSegments: ["designer"] });

    expect(composed.visiblePerfumes.every((perfume) => segmentOf(perfume) === "designer")).toBe(true);
    expect(composed.visiblePerfumes.every((perfume) => perfume.seasons.includes("summer") && perfume.vibes.includes("fresh"))).toBe(true);
  });

  it("keeps the count identical to the visible list, in every state", () => {
    for (const enabled of [ALL, ["niche"], ["arabic", "designer"], []]) {
      const result = view({ enabledMarketSegments: enabled, searchQuery: "a" });

      expect(result.resultCount).toBe(result.visiblePerfumes.length);
    }
  });

  it("fails open for a brand with no segment: never hidden by a partial selection, but an empty selection still shows nothing", () => {
    const unclassified = { ...fragrances[0], id: 9001, brand: "Some Future Brand", name: "Unclassified" };
    const catalog = [...fragrances, unclassified];
    const idsFor = (enabledMarketSegments) => buildCatalogView({ catalog, notes, enabledMarketSegments }).visiblePerfumes.map(({ id }) => id);

    expect(idsFor(["arabic"])).toContain(9001);
    expect(idsFor(["niche"])).toContain(9001);
    expect(idsFor(ALL)).toContain(9001);
    expect(idsFor([])).toEqual([]);
  });

  it("changes nothing but visibility: same records, tier-agnostic, no mutation of the catalog or the enabled list", () => {
    const before = JSON.stringify(fragrances);
    const enabled = Object.freeze(["niche"]);
    const result = view({ enabledMarketSegments: enabled });

    expect(JSON.stringify(fragrances)).toBe(before);
    expect(enabled).toEqual(["niche"]);
    result.visiblePerfumes.forEach((perfume) => expect(fragrances.includes(perfume)).toBe(true));
  });
});
