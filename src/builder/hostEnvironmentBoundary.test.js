import { readdirSync, readFileSync } from "node:fs";
import { extname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const SOURCE_ROOT = fileURLToPath(new URL("../", import.meta.url));
const SHARED_ROOTS = [
  "builder",
  "components",
  "utils",
  "i18n",
  "analytics",
];
const FORBIDDEN_ENVIRONMENT_ACCESS = /import\.meta(?:\.env)?|process\.env|VITE_|NODE_ENV/;

function collectProductionFiles(path) {
  return readdirSync(path, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = join(path, entry.name);
    if (entry.isDirectory()) {
      return collectProductionFiles(entryPath);
    }
    if (![".js", ".jsx"].includes(extname(entry.name)) || entry.name.includes(".test.")) {
      return [];
    }
    return [entryPath];
  });
}

describe("Builder host environment boundary", () => {
  it("keeps the complete future Builder-owned production surface bundler-neutral", () => {
    const sharedFiles = [
      join(SOURCE_ROOT, "App.jsx"),
      ...SHARED_ROOTS.flatMap((root) => collectProductionFiles(join(SOURCE_ROOT, root))),
    ].filter((path) => !path.endsWith("AppErrorBoundary.jsx"));

    const violations = sharedFiles.flatMap((path) => {
      const source = readFileSync(path, "utf8");
      return FORBIDDEN_ENVIRONMENT_ACCESS.test(source)
        ? [relative(SOURCE_ROOT, path)]
        : [];
    });

    // AppErrorBoundary is deliberately host-owned and retains its Vite DEV diagnostic.
    expect(violations).toEqual([]);
  });

  it("keeps Vite environment lookup in both current merchant hosts", () => {
    for (const host of ["DiscoveryDecantsApp.jsx", "AurelianApp.jsx"]) {
      const source = readFileSync(join(SOURCE_ROOT, "app", host), "utf8");
      expect(source).toContain("isDevelopment={import.meta.env.DEV}");
    }
  });

  it("does not store deployment environment in merchant configuration", () => {
    for (const merchant of ["discoveryDecants", "aurelian"]) {
      const source = readFileSync(join(SOURCE_ROOT, "merchants", merchant, "config.js"), "utf8");
      expect(source).not.toMatch(/isDevelopment|import\.meta|process\.env|VITE_|NODE_ENV/);
    }
  });
});
