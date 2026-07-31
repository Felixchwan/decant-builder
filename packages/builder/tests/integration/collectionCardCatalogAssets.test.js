import { describe, expect, it } from "vitest";

import {
  createCatalogAssetResolver,
  fragrances,
} from "@discovery-box/catalog";
import { buildCollectionCardItems } from "../../src/builder/internal/collectionCard/buildCollectionCardViewModel.js";

describe("Collection Card catalog asset integration", () => {
  it("passes host-resolved catalog artwork unchanged into collection-card items", () => {
    const resolveAsset = createCatalogAssetResolver({ basePath: "/catalog-assets" });
    const resolvedFragrances = fragrances.map((fragrance) => ({
      ...fragrance,
      image: resolveAsset(fragrance.imageAssetKey),
    }));
    const items = buildCollectionCardItems(resolvedFragrances);

    expect(items.map(({ image }) => image)).toEqual(
      resolvedFragrances.map(({ image }) => image),
    );
    expect(items.every(({ image }) => image.startsWith("/catalog-assets/perfumes/"))).toBe(true);
  });
});
