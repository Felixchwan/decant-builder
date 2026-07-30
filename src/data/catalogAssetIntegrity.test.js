import { readdirSync, statSync } from "node:fs";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { buildCollectionCardItems } from "../builder/internal/collectionCard/buildCollectionCardViewModel.js";
import { brandAssets } from "./brandAssets.js";
import { metadataAssets } from "./metadataAssets.js";
import { notes } from "./notes.js";
import { perfumes } from "./perfumes.js";

const PUBLIC_ROOT = fileURLToPath(new URL("../../public/", import.meta.url));
const PERFUME_PLACEHOLDER = "/images/perfumes/placeholders/perfume-placeholder.svg";

function assertExactCasePublicAsset(publicUrl) {
  expect(publicUrl).toMatch(/^\/images\//);
  let currentDirectory = PUBLIC_ROOT;

  for (const segment of publicUrl.slice(1).split("/")) {
    const exactEntry = readdirSync(currentDirectory).find((entry) => entry === segment);
    expect(exactEntry, `${publicUrl} has incorrect or missing path segment ${segment}`).toBe(segment);
    currentDirectory = join(currentDirectory, exactEntry);
  }

  expect(statSync(currentDirectory).isFile()).toBe(true);
  expect(currentDirectory).toBe(join(PUBLIC_ROOT, ...publicUrl.slice(1).split("/")));
}

function unique(values) {
  return [...new Set(values)];
}

describe("catalog asset integrity", () => {
  const perfumeImages = unique(perfumes.map(({ image }) => image));
  const noteImages = unique(Object.values(notes).map(({ noteImage }) => noteImage).filter(Boolean));
  const brandImages = unique(Object.values(brandAssets));
  const metadataImages = unique(
    Object.values(metadataAssets).flatMap((assets) => Object.values(assets))
  );

  it("maps every runtime asset URL deterministically to public with exact casing", () => {
    for (const path of [
      ...perfumeImages,
      ...noteImages,
      ...brandImages,
      ...metadataImages,
      PERFUME_PLACEHOLDER,
    ]) {
      assertExactCasePublicAsset(path);
    }
  });

  it("preserves the expected extension for each asset class", () => {
    expect(perfumeImages.every((path) => [".png", ".avif"].includes(extname(path)))).toBe(true);
    expect(noteImages.every((path) => extname(path) === ".jpg")).toBe(true);
    expect(brandImages.every((path) => extname(path) === ".png")).toBe(true);
    expect(metadataImages.every((path) => extname(path) === ".svg")).toBe(true);
    expect(extname(PERFUME_PLACEHOLDER)).toBe(".svg");
  });

  it("freezes current host-root path conventions and same-origin resolution", () => {
    expect(perfumeImages.every((path) => path.startsWith("/images/perfumes/"))).toBe(true);
    expect(noteImages.every((path) => path.startsWith("/images/notes/"))).toBe(true);
    expect(brandImages.every((path) => path.startsWith("/images/brands/"))).toBe(true);
    expect(metadataImages.every((path) => path.startsWith("/images/metadata/"))).toBe(true);

    for (const path of [...perfumeImages, ...noteImages, ...brandImages, ...metadataImages]) {
      const resolved = new URL(path, "https://discovery.example/builder");
      expect(resolved.origin).toBe("https://discovery.example");
      expect(resolved.pathname).toBe(path);
    }
  });

  it("passes unchanged, resolvable image paths into collection-card items", () => {
    const items = buildCollectionCardItems(perfumes);
    expect(items.map(({ image }) => image)).toEqual(perfumes.map(({ image }) => image));
    items.forEach(({ image }) => assertExactCasePublicAsset(image));
  });

  it("keeps duplicate logical asset references valid", () => {
    expect(noteImages.length).toBeLessThan(Object.values(notes).filter(({ noteImage }) => noteImage).length);
    expect(brandImages.length).toBeLessThan(Object.values(brandAssets).length);
    expect(metadataImages.length).toBeLessThan(
      Object.values(metadataAssets).reduce((count, assets) => count + Object.keys(assets).length, 0)
    );
  });
});
