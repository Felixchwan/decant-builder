import { createHash } from "node:crypto";
import { Buffer } from "node:buffer";
import { lstatSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import {
  brandAssets,
  fragrances,
  metadataAssets,
  notes,
  perfumePlaceholderAssetKey,
} from "./index.js";

const ASSET_ROOT = fileURLToPath(new URL("../assets/", import.meta.url));
const APPROVED_FILE_COUNT = 368;
const APPROVED_TREE_HASH = "ec854bb7f47adda2cd45e8fe94f4d2c22b52c8a8ab788832c9982f22aaf4b9e9";

function walk(directory = ASSET_ROOT, relativeDirectory = "") {
  return readdirSync(directory, { withFileTypes: true })
    .sort((left, right) => left.name.localeCompare(right.name, "en"))
    .flatMap((entry) => {
      const relativePath = relativeDirectory ? `${relativeDirectory}/${entry.name}` : entry.name;
      const absolutePath = join(directory, entry.name);
      const details = lstatSync(absolutePath);
      expect(details.isSymbolicLink(), `unexpected symlink ${relativePath}`).toBe(false);
      return details.isDirectory() ? walk(absolutePath, relativePath) : [relativePath];
    });
}

function flattenAssetValues(value) {
  return Object.values(value).flatMap((entry) =>
    typeof entry === "string" ? [entry] : flattenAssetValues(entry)
  );
}

function treeHash(files) {
  const aggregate = createHash("sha256");
  files.forEach((relativePath) => {
    const sourceBytes = readFileSync(join(ASSET_ROOT, ...relativePath.split("/")));
    const bytes = relativePath.endsWith(".svg")
      ? Buffer.from(sourceBytes.toString("utf8").replaceAll("\r\n", "\n"), "utf8")
      : sourceBytes;
    const hash = createHash("sha256").update(bytes).digest("hex");
    aggregate.update(`${relativePath}\0${hash}\n`);
  });
  return aggregate.digest("hex");
}

describe("catalog package asset tree", () => {
  const files = walk();
  const canonicalKeys = [
    ...fragrances.map(({ imageAssetKey }) => imageAssetKey),
    ...Object.values(notes).map(({ noteImageAssetKey }) => noteImageAssetKey).filter(Boolean),
    ...flattenAssetValues(brandAssets),
    ...flattenAssetValues(metadataAssets),
    perfumePlaceholderAssetKey,
  ];

  it("preserves the complete approved pre-move inventory and bytes", () => {
    expect(files).toHaveLength(APPROVED_FILE_COUNT);
    expect(treeHash(files)).toBe(APPROVED_TREE_HASH);
  });

  it("has no duplicate or case-insensitive-colliding relative paths", () => {
    expect(new Set(files).size).toBe(files.length);
    expect(new Set(files.map((path) => path.toLocaleLowerCase("en-US"))).size).toBe(files.length);
  });

  it("contains every canonical key at exact casing", () => {
    const exactPaths = new Set(files);
    canonicalKeys.forEach((key) => expect(exactPaths.has(key), key).toBe(true));
  });

  it("retains the intentionally unreferenced catalog asset pending cleanup review", () => {
    expect(files.filter((path) => !new Set(canonicalKeys).has(path))).toEqual([
      "perfumes/platinum/allure-homme-edition-blanche.png",
    ]);
  });
});
