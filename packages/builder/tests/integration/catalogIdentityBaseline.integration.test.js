import { describe, expect, it } from "vitest";

import { fragrances, notes } from "@discovery-box/catalog";
import { discoveryDecantsConfig } from "../../../../src/merchants/discoveryDecants/config.js";
import { buildCatalogView } from "../../src/builder/internal/catalog/buildCatalogView.js";
import { buildCollectionSummary } from "../../src/builder/internal/intelligence/buildCollectionSummary.js";
import { buildComposerRecommendations } from "../../src/builder/internal/recommendations/buildComposerRecommendations.js";
import { getTierData } from "../../src/utils/tierUtils.js";
import { CATALOG_IDENTITY_BASELINE } from "../../../catalog/tests/catalogIdentityBaseline.fixture.js";

describe("catalog identity Builder integration", () => {
  it("freezes Builder tier inference and points for every current ID", () => {
    expect(fragrances.map(({ id, points }) => [id, getTierData(id).name, points]))
      .toEqual(CATALOG_IDENTITY_BASELINE);
  });

  it("preserves decimal point totals and derives money from merchant pointValue", () => {
    const selectedPerfumes = [100, 301, 403].map((id) => fragrances.find((item) => item.id === id));
    const config = {
      ...discoveryDecantsConfig,
      commerce: { ...discoveryDecantsConfig.commerce, pointValue: 37 },
    };
    const summary = buildCollectionSummary({ selectedPerfumes, catalog: fragrances, notes, config });
    expect(summary.points.total).toBe(8.5);
    expect(summary.money).toMatchObject({ pointValue: 37, total: 314.5 });
  });

  it("does not mutate canonical records during representative Builder reads", () => {
    const beforePerfumes = JSON.stringify(fragrances);
    const beforeNotes = JSON.stringify(notes);
    const selectedPerfumes = fragrances.slice(0, 3);
    buildCatalogView({ catalog: fragrances, notes, searchQuery: "fresh", sortOption: "tier" });
    buildCollectionSummary({ selectedPerfumes, catalog: fragrances, notes, config: discoveryDecantsConfig });
    buildComposerRecommendations({
      perfumes: fragrances,
      selectedPerfumes,
      notes,
      config: discoveryDecantsConfig,
      limit: 1,
    });
    expect(JSON.stringify(fragrances)).toBe(beforePerfumes);
    expect(JSON.stringify(notes)).toBe(beforeNotes);
  });
});
