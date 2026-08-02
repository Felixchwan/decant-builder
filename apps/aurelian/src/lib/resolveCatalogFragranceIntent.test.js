import { describe, expect, it } from "vitest";
import { aurelianCatalog } from "../merchant/catalog.js";
import { resolveCatalogFragranceIntent } from "./resolveCatalogFragranceIntent.js";

describe("catalog fragrance intent", () => {
  it("resolves an available stable ID to its canonical record", () => {
    const expected = aurelianCatalog[12];
    expect(resolveCatalogFragranceIntent(`?fragrance=${expected.id}`, aurelianCatalog)).toBe(expected);
  });

  it("falls back safely for unknown or malformed IDs", () => {
    expect(resolveCatalogFragranceIntent("?fragrance=999999", aurelianCatalog)).toBeNull();
    expect(resolveCatalogFragranceIntent("?fragrance=not-an-id", aurelianCatalog)).toBeNull();
    expect(resolveCatalogFragranceIntent("", aurelianCatalog)).toBeNull();
  });
});
