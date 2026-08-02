import { readdirSync, readFileSync } from "node:fs";
import { extname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const SOURCE_ROOT = fileURLToPath(new URL("../", import.meta.url));
const HOST_SOURCE_ROOT = fileURLToPath(new URL("../../../../src/", import.meta.url));
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
      join(SOURCE_ROOT, "BuilderRuntime.jsx"),
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

  it("keeps environment lookup in each host rather than shared Builder runtime", () => {
    const discoverySource = readFileSync(join(HOST_SOURCE_ROOT, "app", "DiscoveryDecantsApp.jsx"), "utf8");
    const aurelianPageSource = readFileSync(join(HOST_SOURCE_ROOT, "..", "apps", "aurelian", "src", "app", "build-your-box", "page.jsx"), "utf8");
    const aurelianClientSource = readFileSync(join(HOST_SOURCE_ROOT, "..", "apps", "aurelian", "src", "components", "BuilderExperience.jsx"), "utf8");
    expect(discoverySource).toContain("isDevelopment={import.meta.env.DEV}");
    expect(aurelianPageSource).toContain('process.env.NODE_ENV === "development"');
    expect(aurelianClientSource).not.toMatch(/import\.meta|process\.env/);
  });

  it("does not store deployment environment in merchant configuration", () => {
    const configFiles = [
      join(HOST_SOURCE_ROOT, "merchants", "discoveryDecants", "config.js"),
      join(HOST_SOURCE_ROOT, "..", "apps", "aurelian", "src", "merchant", "config.js"),
    ];
    for (const configFile of configFiles) {
      const source = readFileSync(configFile, "utf8");
      expect(source).not.toMatch(/isDevelopment|import\.meta|process\.env|VITE_|NODE_ENV/);
    }
  });
});
