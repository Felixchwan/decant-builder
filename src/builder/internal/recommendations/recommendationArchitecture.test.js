import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, extname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const projectRoot = dirname(
  dirname(dirname(dirname(dirname(fileURLToPath(import.meta.url)))))
);
const srcRoot = join(projectRoot, "src");
const builderRecommendationEntry = "src\\builder\\internal\\recommendations\\buildComposerRecommendations.js";

function getSourceFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = join(directory, entry.name);

    if (entry.isDirectory()) {
      return getSourceFiles(fullPath);
    }

    if (![".js", ".jsx"].includes(extname(entry.name)) || entry.name.endsWith(".test.js")) {
      return [];
    }

    return [fullPath];
  });
}

function toProjectPath(filePath) {
  return relative(projectRoot, filePath);
}

describe("recommendation architecture", () => {
  it("keeps the removed legacy generator out of production code", () => {
    expect(existsSync(join(projectRoot, "src", "utils", "buildRecommendations.js"))).toBe(false);

    const references = getSourceFiles(srcRoot)
      .map((filePath) => ({
        filePath: toProjectPath(filePath),
        source: readFileSync(filePath, "utf8"),
      }))
      .filter(({ source }) => /buildRecommendations/.test(source))
      .map(({ filePath }) => filePath);

    expect(references).toEqual([]);
  });

  it("routes Builder recommendations through one Composer-facing adapter", () => {
    const sourceFiles = getSourceFiles(srcRoot).map((filePath) => ({
      filePath: toProjectPath(filePath),
      source: readFileSync(filePath, "utf8"),
    }));
    const composerCoreImports = sourceFiles
      .filter(
        ({ filePath }) =>
          !filePath.startsWith("src\\builder\\internal\\composer\\")
      )
      .filter(({ source }) =>
        /composeCollection|deriveComposerReasoningFacts|deriveComposerExplanations/.test(source)
      )
      .map(({ filePath }) => filePath);

    expect(composerCoreImports).toEqual([builderRecommendationEntry]);

    const appSource = readFileSync(join(projectRoot, "src", "App.jsx"), "utf8");
    expect(appSource).toMatch(/buildComposerRecommendations/);
    expect(appSource).not.toMatch(
      /composeCollection|deriveComposerReasoningFacts|deriveComposerExplanations/
    );
  });

  it("keeps Composer Core independent from Builder presentation adapters", () => {
    const composerFiles = getSourceFiles(join(srcRoot, "builder", "internal", "composer"))
      .map((filePath) => ({
        filePath: toProjectPath(filePath),
        source: readFileSync(filePath, "utf8"),
      }))
      .filter(({ source }) => /builder\/presentation|components\//.test(source))
      .map(({ filePath }) => filePath);

    expect(composerFiles).toEqual([]);
  });
});
