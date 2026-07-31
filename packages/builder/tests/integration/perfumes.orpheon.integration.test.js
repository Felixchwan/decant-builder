import { describe, expect, it } from "vitest";

import { fragrances, notes } from "@discovery-box/catalog";
import { discoveryDecantsConfig } from "../../../../src/merchants/discoveryDecants/config.js";
import { buildCatalogView } from "../../src/builder/internal/catalog/buildCatalogView.js";
import { buildCollectionSummary } from "../../src/builder/internal/intelligence/buildCollectionSummary.js";

const ORPHEON_ID = 409;
const orpheon = fragrances.find(({ id }) => id === ORPHEON_ID);

describe("Diptyque Orphéon Builder integration", () => {
  it("is searchable with accented and unaccented queries", () => {
    for (const searchQuery of ["Orphéon", "Orpheon"]) {
      expect(buildCatalogView({ catalog: fragrances, notes, searchQuery }).visiblePerfumes[0]?.id)
        .toBe(ORPHEON_ID);
    }
  });

  it("contributes exactly 4 points and 400 MXN under active pricing", () => {
    const summary = buildCollectionSummary({
      selectedPerfumes: [orpheon],
      catalog: fragrances,
      notes,
      config: discoveryDecantsConfig,
    });
    expect(summary.points.total).toBe(4);
    expect(summary.money.total).toBe(400);
  });
});
