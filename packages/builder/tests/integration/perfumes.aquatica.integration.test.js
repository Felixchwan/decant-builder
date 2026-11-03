import { describe, expect, it } from "vitest";

import { fragrances, notes } from "@discovery-box/catalog";
import { aurelianConfig } from "../../../../apps/aurelian/src/merchant/config.js";
import { discoveryDecantsConfig } from "../../../../src/merchants/discoveryDecants/config.js";
import { buildCatalogView } from "../../src/builder/internal/catalog/buildCatalogView.js";
import { buildCollectionSummary } from "../../src/builder/internal/intelligence/buildCollectionSummary.js";
import { getTierData } from "../../src/utils/tierUtils.js";
import { createCustomerPricing } from "../../src/utils/customerPricing.js";
import { createBuilderConfig } from "../../src/builder/config/index.js";

const AQUATICA_ID = 36;
const aquatica = fragrances.find(({ id }) => id === AQUATICA_ID);

describe("Rayhaan Aquatica Builder integration", () => {
  it("is searchable by fragrance and by brand", () => {
    for (const searchQuery of ["Aquatica", "aquatica", "Rayhaan"]) {
      expect(buildCatalogView({ catalog: fragrances, notes, searchQuery }).visiblePerfumes.map(({ id }) => id), searchQuery)
        .toContain(AQUATICA_ID);
    }
  });

  it("resolves to the Bronze tier", () => {
    expect(getTierData(AQUATICA_ID).name).toBe("Bronze");
  });

  it("contributes exactly 1 point and 100 MXN under active pricing in both hosts", () => {
    for (const config of [aurelianConfig, discoveryDecantsConfig]) {
      const summary = buildCollectionSummary({ selectedPerfumes: [aquatica], catalog: fragrances, notes, config });
      expect(summary.points.total).toBe(1);
      expect(summary.money.total).toBe(100);
    }
  });

  it("reads as $100 on Aurelian's price display", () => {
    const price = createCustomerPricing(createBuilderConfig(aurelianConfig));
    expect(price.formatPoints(aquatica.points)).toBe("$100");
  });
});
