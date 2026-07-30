import { readdirSync, statSync } from "node:fs";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { buildCollectionCardItems } from "../builder/internal/collectionCard/buildCollectionCardViewModel.js";
import {
  brandAssets,
  createCatalogAssetResolver,
  fragrances as perfumes,
  metadataAssets,
  notes,
  perfumePlaceholderAssetKey,
} from "@discovery-box/catalog";

const PACKAGE_ASSET_ROOT = fileURLToPath(new URL("../../packages/catalog/assets/", import.meta.url));
const resolveAsset = createCatalogAssetResolver({ basePath: "/catalog-assets" });

function assertExactCasePackageAsset(publicUrl) {
  expect(publicUrl).toMatch(/^\/catalog-assets\//);
  let currentDirectory = PACKAGE_ASSET_ROOT;

  for (const segment of publicUrl.replace(/^\/catalog-assets\//, "").split("/")) {
    const exactEntry = readdirSync(currentDirectory).find((entry) => entry === segment);
    expect(exactEntry, `${publicUrl} has incorrect or missing path segment ${segment}`).toBe(segment);
    currentDirectory = join(currentDirectory, exactEntry);
  }

  expect(statSync(currentDirectory).isFile()).toBe(true);
  expect(currentDirectory).toBe(join(PACKAGE_ASSET_ROOT, ...publicUrl.replace(/^\/catalog-assets\//, "").split("/")));
}

function unique(values) {
  return [...new Set(values)];
}

describe("catalog asset integrity", () => {
  const perfumeAssetKeys = unique(perfumes.map(({ imageAssetKey }) => imageAssetKey));
  const noteAssetKeys = unique(Object.values(notes).map(({ noteImageAssetKey }) => noteImageAssetKey).filter(Boolean));
  const brandAssetKeys = unique(Object.values(brandAssets));
  const perfumeImages = perfumeAssetKeys.map(resolveAsset);
  const noteImages = noteAssetKeys.map(resolveAsset);
  const brandImages = brandAssetKeys.map(resolveAsset);
  const metadataImages = unique(
    Object.values(metadataAssets).flatMap((assets) => Object.values(assets))
  ).map(resolveAsset);

  it("maps every runtime asset URL deterministically to package assets with exact casing", () => {
    for (const path of [
      ...perfumeImages,
      ...noteImages,
      ...brandImages,
      ...metadataImages,
      resolveAsset(perfumePlaceholderAssetKey),
    ]) {
      assertExactCasePackageAsset(path);
    }
  });

  it("preserves the expected extension for each asset class", () => {
    expect(perfumeImages.every((path) => [".png", ".avif"].includes(extname(path)))).toBe(true);
    expect(noteImages.every((path) => extname(path) === ".jpg")).toBe(true);
    expect(brandImages.every((path) => extname(path) === ".png")).toBe(true);
    expect(metadataImages.every((path) => extname(path) === ".svg")).toBe(true);
    expect(extname(perfumePlaceholderAssetKey)).toBe(".svg");
  });

  it("keeps canonical references root-agnostic and host resolution same-origin", () => {
    for (const key of [
      ...perfumeAssetKeys,
      ...noteAssetKeys,
      ...brandAssetKeys,
      ...Object.values(metadataAssets).flatMap((assets) => Object.values(assets)),
      perfumePlaceholderAssetKey,
    ]) {
      expect(key).not.toMatch(/^(?:\/|[a-z][a-z\d+.-]*:)/i);
    }

    expect(perfumeImages.every((path) => path.startsWith("/catalog-assets/perfumes/"))).toBe(true);
    expect(noteImages.every((path) => path.startsWith("/catalog-assets/notes/"))).toBe(true);
    expect(brandImages.every((path) => path.startsWith("/catalog-assets/brands/"))).toBe(true);
    expect(metadataImages.every((path) => path.startsWith("/catalog-assets/metadata/"))).toBe(true);

    for (const path of [...perfumeImages, ...noteImages, ...brandImages, ...metadataImages]) {
      const resolved = new URL(path, "https://discovery.example/builder");
      expect(resolved.origin).toBe("https://discovery.example");
      expect(resolved.pathname).toBe(path);
    }
  });

  it("passes unchanged, resolvable image paths into collection-card items", () => {
    const resolvedPerfumes = perfumes.map((perfume) => ({
      ...perfume,
      image: resolveAsset(perfume.imageAssetKey),
    }));
    const items = buildCollectionCardItems(resolvedPerfumes);
    expect(items.map(({ image }) => image)).toEqual(resolvedPerfumes.map(({ image }) => image));
    items.forEach(({ image }) => assertExactCasePackageAsset(image));
  });

  it("keeps duplicate logical asset references valid", () => {
    expect(noteImages.length).toBeLessThan(Object.values(notes).filter(({ noteImageAssetKey }) => noteImageAssetKey).length);
    expect(brandImages.length).toBeLessThan(Object.values(brandAssets).length);
    expect(metadataImages.length).toBeLessThan(
      Object.values(metadataAssets).reduce((count, assets) => count + Object.keys(assets).length, 0)
    );
  });
});
