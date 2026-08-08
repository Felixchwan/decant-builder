import { existsSync, readdirSync, readFileSync } from "node:fs";
import { extname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const projectRoot = fileURLToPath(new URL("../../../../../../", import.meta.url));
const srcRoot = join(projectRoot, "packages", "builder", "src");
const builderRecommendationEntry = "packages\\builder\\src\\builder\\internal\\recommendations\\buildComposerRecommendations.js";
const builderCompositionEntry = "packages\\builder\\src\\builder\\internal\\composition\\buildComposerBoxProposal.js";

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

  it("routes Builder Composer usage through the approved Builder-facing adapters", () => {
    const sourceFiles = getSourceFiles(srcRoot).map((filePath) => ({
      filePath: toProjectPath(filePath),
      source: readFileSync(filePath, "utf8"),
    }));
    const composerCoreImports = sourceFiles
      .filter(
        ({ filePath }) =>
          !filePath.startsWith("packages\\builder\\src\\builder\\internal\\composer\\")
      )
      .filter(({ source }) =>
        /composeCollection|deriveComposerReasoningFacts|deriveComposerExplanations/.test(source)
      )
      .map(({ filePath }) => filePath);

    expect(composerCoreImports.sort()).toEqual([
      builderCompositionEntry,
      builderRecommendationEntry,
    ]);

    const appSource = readFileSync(join(srcRoot, "BuilderRuntime.jsx"), "utf8");
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

  it("keeps recommendation-policy vocabulary (intent ids, merchant-specific labels) out of shared Builder code", () => {
    // These are Aurelian's real Discovery Intent ids and Spanish labels
    // (apps/aurelian/src/discoveryIntent/*). Shared Builder code must only
    // ever see Composer's own vocabulary (strategy/preferred*/excluded*) —
    // it has no concept of what a host's intent means or is called.
    const forbiddenTerms = [
      "fresh_everyday",
      "intentional_evening",
      "explore_freely",
      "Fresco y cotidiano",
      "Noche con intención",
      "Es un regalo",
      "Quiero explorar todo",
      "Aurelian",
      "aurelian",
    ];
    const offenders = getSourceFiles(srcRoot)
      // getSourceFiles only strips ".test.js" — production vocabulary is
      // the concern here, not what merchant name a ".test.jsx" fixture
      // happens to use for unrelated coverage (e.g. theme rendering).
      .filter((filePath) => !filePath.endsWith(".test.jsx"))
      .map((filePath) => ({
        filePath: toProjectPath(filePath),
        source: readFileSync(filePath, "utf8"),
      }))
      .filter(({ source }) => forbiddenTerms.some((term) => source.includes(term)))
      .map(({ filePath }) => filePath);

    expect(offenders).toEqual([]);
  });
});
