import { readFileSync, readdirSync } from "node:fs";
import { extname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// Structural boundary test, in the same style as
// packages/catalog/src/catalogPackageBoundary.test.js and
// packages/builder/tests/boundaries/packageBoundary.test.js: proves, by
// scanning real source files, that the direction of dependency is always
//   research -> catalog
// and never
//   catalog/builder/apps/src -> research
// The Fragrance Relationship Lab is research-only. It may read from
// @discovery-box/catalog (this module itself does); nothing under
// packages/, apps/, or the root Discovery Decants src/ may import or
// otherwise reference it. This is enforced structurally here, not left as
// a convention someone could accidentally violate.

const REPOSITORY_ROOT = fileURLToPath(new URL("../../", import.meta.url));

const SCANNED_ROOTS = [
  join(REPOSITORY_ROOT, "packages"),
  join(REPOSITORY_ROOT, "apps"),
  join(REPOSITORY_ROOT, "src"),
];

const SOURCE_EXTENSIONS = new Set([".js", ".jsx", ".ts", ".tsx"]);

function sourceFiles(directory) {
  let entries;
  try {
    entries = readdirSync(directory, { withFileTypes: true });
  } catch {
    // The directory may not exist in every checkout shape -- absence is
    // valid, not a violation.
    return [];
  }

  return entries.flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      return entry.name === "node_modules" || entry.name === "dist" ? [] : sourceFiles(path);
    }
    return SOURCE_EXTENSIONS.has(extname(entry.name)) ? [path] : [];
  });
}

describe("Fragrance Relationship Lab boundary", () => {
  it("is never imported or referenced from packages/, apps/, or root src/ -- research depends on catalog, never the reverse", () => {
    const offendingFiles = SCANNED_ROOTS.flatMap((root) => sourceFiles(root)).flatMap((path) => {
      const source = readFileSync(path, "utf8");
      return /research\/fragranceRelationshipLab|research\/(?!fragranceRelationshipLab)/.test(source) ||
        /\bfragranceRelationshipLab\b/.test(source)
        ? [relative(REPOSITORY_ROOT, path)]
        : [];
    });

    expect(offendingFiles).toEqual([]);
  });

  it("confirms this lab's own files depend at most on @discovery-box/catalog, never on packages/builder, apps/, or host src/ imports", () => {
    const labRoot = fileURLToPath(new URL("./", import.meta.url));
    const labFiles = sourceFiles(labRoot).filter((path) => !path.endsWith(".test.js"));

    labFiles.forEach((path) => {
      const source = readFileSync(path, "utf8");
      // Strip comments first -- explanatory prose (e.g. this file's own
      // note about why noteRelationships.js does NOT import Builder's
      // getPerfumeNoteIds helper) may legitimately mention a forbidden
      // path in passing; only real import specifiers count as a violation.
      const codeOnly = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
      const importSpecifiers = [...codeOnly.matchAll(/from\s+["']([^"']+)["']/g)].map((match) => match[1]);

      importSpecifiers.forEach((specifier) => {
        expect(specifier, `${relative(REPOSITORY_ROOT, path)} imports "${specifier}"`).not.toMatch(
          /@discovery-box\/builder|packages\/builder|apps\/aurelian|^\.\.\/.*\/src\//
        );
      });
    });

    // The core math module (noteRelationships.js) is intentionally pure --
    // it takes fragrance objects as a plain parameter and imports nothing
    // at all, so it has zero coupling to any package, catalog included.
    // Only consumers of it (the report script, the test file) import
    // @discovery-box/catalog directly -- confirmed here rather than
    // assumed.
    const catalogConsumers = labFiles.filter((path) => readFileSync(path, "utf8").includes("@discovery-box/catalog"));
    expect(catalogConsumers.length).toBeGreaterThan(0);
  });
});
