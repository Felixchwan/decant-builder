import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const REPOSITORY_ROOT = fileURLToPath(new URL("../../../", import.meta.url));
const PERCEPTUAL_LEARNING_DIR = join(
  REPOSITORY_ROOT,
  "apps",
  "aurelian",
  "src",
  "perceptualLearning"
);
const COMPOSER_DIRS = [
  join(REPOSITORY_ROOT, "packages", "builder", "src", "builder", "internal", "composer"),
  join(REPOSITORY_ROOT, "packages", "builder", "src", "builder", "internal", "composition"),
];

function listFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? listFiles(path) : [path];
  });
}

function readAll(paths) {
  return paths.map((path) => readFileSync(path, "utf8")).join("\n");
}

describe("perceptualLearningBoundary", () => {
  it("never deep-imports @discovery-box/builder internals from Perceptual Learning code", () => {
    const source = readAll(listFiles(PERCEPTUAL_LEARNING_DIR));

    expect(source).not.toMatch(/@discovery-box\/builder\/src|packages\/builder\/src/);
  });

  it("keeps Composer/composition modules unaware Perceptual Learning exists", () => {
    const source = COMPOSER_DIRS.map((dir) => readAll(listFiles(dir))).join("\n");

    expect(source).not.toMatch(/perceptualLearning|EncounterInstance|\bObservation\b|\bLearner\b/i);
  });

  it("keeps Perceptual Learning's storage key independent of Collection persistence's key", () => {
    const source = readAll(listFiles(PERCEPTUAL_LEARNING_DIR));

    expect(source).not.toContain("aurelian-builder-v1");
  });
});
