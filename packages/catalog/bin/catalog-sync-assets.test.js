import { createHash } from "node:crypto";
import {
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join, parse } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { afterEach, describe, expect, it } from "vitest";

import { CATALOG_ASSET_SOURCE, syncCatalogAssets } from "./catalog-sync-assets.js";

const SCRIPT = fileURLToPath(new URL("./catalog-sync-assets.js", import.meta.url));
const PACKAGE_ROOT = fileURLToPath(new URL("../", import.meta.url));
const REPOSITORY_ROOT = fileURLToPath(new URL("../../../", import.meta.url));
const temporaryRoots = [];

function temporaryRoot() {
  const root = mkdtempSync(join(tmpdir(), "catalog-sync-assets-"));
  temporaryRoots.push(root);
  return root;
}

function walk(directory, relativeDirectory = "") {
  return readdirSync(directory, { withFileTypes: true })
    .sort((left, right) => left.name.localeCompare(right.name, "en"))
    .flatMap((entry) => {
      const relativePath = relativeDirectory ? `${relativeDirectory}/${entry.name}` : entry.name;
      const absolutePath = join(directory, entry.name);
      const details = lstatSync(absolutePath);
      expect(details.isSymbolicLink()).toBe(false);
      return details.isDirectory() ? walk(absolutePath, relativePath) : [relativePath];
    });
}

function hash(directory, relativePath) {
  return createHash("sha256")
    .update(readFileSync(join(directory, ...relativePath.split("/"))))
    .digest("hex");
}

afterEach(() => {
  temporaryRoots.splice(0).forEach((root) => rmSync(root, { recursive: true, force: true }));
});

describe("catalog-sync-assets", () => {
  it("reproduces the complete source tree, hashes, and removes stale files", async () => {
    const root = temporaryRoot();
    const destination = join(root, "catalog-assets");
    mkdirSync(destination);
    writeFileSync(join(destination, "stale.txt"), "stale");

    const result = await syncCatalogAssets({ destination });
    const sourceFiles = walk(CATALOG_ASSET_SOURCE);
    const destinationFiles = walk(destination);

    expect(result).toEqual({ copied: 384, destination });
    expect(destinationFiles).toEqual(sourceFiles);
    destinationFiles.forEach((relativePath) => {
      expect(hash(destination, relativePath)).toBe(hash(CATALOG_ASSET_SOURCE, relativePath));
    });
    expect(destinationFiles).not.toContain("stale.txt");
  }, 15000);

  it.each([
    ["missing destination", undefined],
    ["filesystem root", parse(REPOSITORY_ROOT).root],
    ["repository root", REPOSITORY_ROOT],
    ["home directory", homedir()],
    ["package source directory", join(PACKAGE_ROOT, "src")],
    ["package asset source", CATALOG_ASSET_SOURCE],
    ["wrong final directory name", join(tmpdir(), "not-catalog-assets")],
  ])("rejects %s", async (_label, destination) => {
    await expect(syncCatalogAssets({ destination })).rejects.toThrow();
  });

  it("does not delete unrelated files when destination validation fails", async () => {
    const root = temporaryRoot();
    const unrelated = join(root, "keep.txt");
    writeFileSync(unrelated, "keep");

    await expect(syncCatalogAssets({ destination: join(root, "wrong-name") })).rejects.toThrow();

    expect(readFileSync(unrelated, "utf8")).toBe("keep");
  });

  it("fails nonzero without a CLI destination using process.execPath", () => {
    expect(() => execFileSync(process.execPath, [SCRIPT], { stdio: "pipe" })).toThrow(
      expect.objectContaining({ status: 1 }),
    );
  });
});
