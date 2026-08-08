import { describe, expect, it } from "vitest";

import {
  DISCOVERY_INTENT_OPTIONS,
  getDiscoveryIntentCatalogFilters,
} from "./discoveryIntentOptions.js";

// Real, confirmed occasion taxonomy keys (packages/catalog/src/metadataAssets.js).
const KNOWN_OCCASION_KEYS = new Set([
  "day",
  "daily",
  "night",
  "office",
  "casual",
  "date",
  "evening",
  "formal",
  "gym",
  "club",
  "special",
  "vacation",
]);

describe("discoveryIntentOptions", () => {
  it("defines exactly the four required options, in order, with no Mood terminology", () => {
    expect(DISCOVERY_INTENT_OPTIONS.map((option) => option.id)).toEqual([
      "fresh_everyday",
      "intentional_evening",
      "gift",
      "explore_freely",
    ]);
    DISCOVERY_INTENT_OPTIONS.forEach((option) => {
      expect(option.id).not.toMatch(/mood/i);
      expect(option.title).not.toMatch(/mood/i);
      expect(option.description).not.toMatch(/mood/i);
    });
  });

  it("maps every filtering option to real, existing catalog taxonomy values only", () => {
    DISCOVERY_INTENT_OPTIONS.filter((option) => option.filters).forEach((option) => {
      Object.entries(option.filters).forEach(([facet, value]) => {
        expect(["seasons", "occasions", "vibes"]).toContain(facet);
        if (facet === "occasions") {
          expect(KNOWN_OCCASION_KEYS.has(value)).toBe(true);
        }
      });
    });
  });

  it("leaves Explore Freely unfiltered", () => {
    expect(getDiscoveryIntentCatalogFilters("explore_freely")).toBeNull();
    expect(getDiscoveryIntentCatalogFilters("unknown_id")).toBeNull();
  });

  it("resolves each defined option's own filters", () => {
    expect(getDiscoveryIntentCatalogFilters("fresh_everyday")).toEqual({ occasions: "daily" });
    expect(getDiscoveryIntentCatalogFilters("intentional_evening")).toEqual({ occasions: "night" });
    expect(getDiscoveryIntentCatalogFilters("gift")).toEqual({ occasions: "special" });
  });
});
