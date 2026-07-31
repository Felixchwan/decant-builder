import { describe, expect, it } from "vitest";

import { fragrances, notes } from "@discovery-box/catalog";
import { buildCatalogView } from "../../src/builder/internal/catalog/buildCatalogView.js";

describe("catalog reference Builder integration", () => {
  it("keeps canonical order stable through the unfiltered catalog view", () => {
    const result = buildCatalogView({ catalog: fragrances, notes });
    expect(result.visiblePerfumes.map(({ id }) => id)).toEqual(fragrances.map(({ id }) => id));
  });
});
