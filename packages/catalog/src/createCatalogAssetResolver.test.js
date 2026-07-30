import { describe, expect, it } from "vitest";

import {
  createCatalogAssetResolver,
  perfumePlaceholderAssetKey,
} from "./index.js";

describe("createCatalogAssetResolver", () => {
  it("resolves the same key beneath independently supplied host roots", () => {
    const key = "perfumes/bronze/batch-01/acqua-di-gio-edt.png";
    const discoveryResolver = createCatalogAssetResolver({ basePath: "/catalog-assets" });
    const alternateResolver = createCatalogAssetResolver({ basePath: "/store-assets/" });

    expect(discoveryResolver(key)).toBe(`/catalog-assets/${key}`);
    expect(alternateResolver(key)).toBe(`/store-assets/${key}`);
    expect(discoveryResolver(perfumePlaceholderAssetKey)).toBe(
      "/catalog-assets/perfumes/placeholders/perfume-placeholder.svg",
    );
  });

  it("rejects missing or empty base paths", () => {
    expect(() => createCatalogAssetResolver()).toThrow(/basePath/);
    expect(() => createCatalogAssetResolver({ basePath: "" })).toThrow(/basePath/);
    expect(() => createCatalogAssetResolver({ basePath: "   " })).toThrow(/basePath/);
  });

  it.each([
    "",
    "   ",
    " perfumes/bottle.png",
    "/images/perfume.png",
    "//cdn.example/perfume.png",
    "https://cdn.example/perfume.png",
    "perfumes/../secret.png",
    "perfumes/./bottle.png",
    "perfumes\\bottle.png",
    "perfumes/bottle.png?size=2",
    "perfumes/bottle.png#preview",
    "perfumes//bottle.png",
  ])("rejects invalid asset key %j", (assetKey) => {
    const resolveAsset = createCatalogAssetResolver({ basePath: "/catalog-assets" });
    expect(() => resolveAsset(assetKey)).toThrow(/asset key/i);
  });

  it("is synchronous and safe to import without browser globals", async () => {
    const module = await import("./createCatalogAssetResolver.js");
    const resolveAsset = module.createCatalogAssetResolver({ basePath: "/assets" });

    expect(resolveAsset("brands/example.png")).toBe("/assets/brands/example.png");
  });
});
