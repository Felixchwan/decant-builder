import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { extname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { execPath } from "node:process";
import { describe, expect, it } from "vitest";

import * as builderEntry from "@discovery-box/builder";
import * as configEntry from "@discovery-box/builder/config";
import * as analyticsEntry from "@discovery-box/builder/analytics";

const packageRoot = fileURLToPath(new URL("../../", import.meta.url));
const repositoryRoot = fileURLToPath(new URL("../../../../", import.meta.url));
const packageSourceRoot = join(packageRoot, "src");
const hostSourceRoot = join(repositoryRoot, "src");

const productionExtensions = new Set([".js", ".jsx"]);

function productionFiles(root) {
  return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const path = join(root, entry.name);
    if (entry.isDirectory()) return productionFiles(path);
    if (!productionExtensions.has(extname(entry.name)) || entry.name.includes(".test.")) return [];
    return [path];
  });
}

function sources(root) {
  return productionFiles(root).map((path) => [path, readFileSync(path, "utf8")]);
}

describe("@discovery-box/builder public boundary", () => {
  it("exports only the approved members", () => {
    expect(Object.keys(builderEntry)).toEqual(["DiscoveryBoxBuilder"]);
    expect(Object.keys(configEntry).sort()).toEqual([
      "buildLocalizedConfigOverrides",
      "createBuilderConfig",
      "defaultBuilderConfig",
      "validateBuilderConfig",
    ]);
    expect(Object.keys(analyticsEntry).sort()).toEqual([
      "ANALYTICS_EVENTS",
      "ANALYTICS_EVENT_NAMES",
      "COMMON_CONTEXT_KEYS",
      "EVENT_PAYLOAD_KEYS",
      "PROHIBITED_ANALYTICS_KEYS",
      "noopAnalytics",
    ].sort());
  });

  it("keeps the client directive only on the main wrapper", () => {
    expect(readFileSync(join(packageRoot, "client.js"), "utf8")).toMatch(/^"use client";/);
    for (const path of [
      join(packageSourceRoot, "builder", "config", "index.js"),
      join(packageSourceRoot, "analytics", "index.js"),
    ]) {
      const source = readFileSync(path, "utf8");
      expect(source).not.toContain("use client");
      expect(source).not.toMatch(/\.jsx["']/);
      expect(source).not.toMatch(/window|document|navigator|import\.meta|process\.env|VITE_/);
    }
  });

  it("keeps production source merchant-, host-, and environment-neutral", () => {
    const violations = sources(packageSourceRoot).flatMap(([path, source]) =>
      /Aurelian|Discovery Decants|discovery-decants|src\/app|src\/merchants|VITE_|import\.meta\.env|process\.env|wa\.me/i.test(source)
        ? [relative(packageSourceRoot, path)]
        : [],
    );
    expect(violations).toEqual([]);
  });

  it("keeps hosts on public package subpaths", () => {
    const hostSources = sources(hostSourceRoot);
    const importedInternals = hostSources.flatMap(([path, source]) =>
      /(?:@discovery-box\/builder|packages\/builder)\/src\//.test(source)
        ? [relative(hostSourceRoot, path)]
        : [],
    );
    expect(importedInternals).toEqual([]);
    expect(readFileSync(join(hostSourceRoot, "analytics", "createAnalytics.js"), "utf8"))
      .toContain('from "@discovery-box/builder/analytics"');
    expect(readFileSync(join(hostSourceRoot, "components", "AppErrorBoundary.jsx"), "utf8"))
      .toContain('from "@discovery-box/builder/analytics"');
    for (const merchant of ["aurelian", "discoveryDecants"]) {
      expect(readFileSync(join(hostSourceRoot, "merchants", merchant, "config.js"), "utf8"))
        .toContain('from "@discovery-box/builder/config"');
    }
  });

  it("leaves no legacy Builder implementation in root src", () => {
    for (const path of ["builder", "i18n"]) {
      const legacyRoot = join(hostSourceRoot, path);
      let legacySources = [];
      try {
        legacySources = productionFiles(legacyRoot);
      } catch {
        // The directory is absent, which is also valid.
      }
      expect(legacySources).toEqual([]);
    }
    for (const path of [
      "App.jsx",
      "components/BuilderPanel.jsx",
      "components/CollectionCard.jsx",
      "components/FilterBar.jsx",
      "components/MetadataPreview.jsx",
      "components/PerfumeCard.jsx",
      "analytics/events.js",
      "analytics/noopAnalytics.js",
    ]) {
      expect(() => statSync(join(hostSourceRoot, path))).toThrow();
    }
  });

  it("resolves built entries and CSS through package exports in plain Node", () => {
    const script = [
      "const [b,c,a]=await Promise.all([",
      "import('@discovery-box/builder'),",
      "import('@discovery-box/builder/config'),",
      "import('@discovery-box/builder/analytics')]);",
      "console.log(JSON.stringify([Object.keys(b),Object.keys(c),Object.keys(a)]));",
    ].join("");
    expect(() => execFileSync(execPath, ["--input-type=module", "--eval", script], {
      cwd: repositoryRoot,
      stdio: "pipe",
    })).not.toThrow();
    expect(() => execFileSync(execPath, ["--eval", "console.log(require.resolve('@discovery-box/builder/styles.css'))"], {
      cwd: repositoryRoot,
      stdio: "pipe",
    })).not.toThrow();
  });
});
