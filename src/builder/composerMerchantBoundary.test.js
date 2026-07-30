import { readdirSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const builderRoot = fileURLToPath(new URL("./", import.meta.url));
const composerRoots = [
  fileURLToPath(new URL("./internal/composer/", import.meta.url)),
  fileURLToPath(new URL("./internal/composition/", import.meta.url)),
];

function productionModules(root) {
  return readdirSync(root, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => `${entry.parentPath}/${entry.name}`)
    .filter((file) => /\.(js|jsx)$/.test(file))
    .filter((file) => !/\.(test|fixture)\.(js|jsx)$/.test(file));
}

describe("shared Builder merchant boundary", () => {
  it("keeps all shared production modules independent from merchant modules", () => {
    productionModules(builderRoot).forEach((file) => {
      const source = readFileSync(file, "utf8");
      expect(source, file).not.toMatch(/(?:from|import\()\s*["'][^"']*merchants\//);
      expect(source, file).not.toContain("discoveryDecantsConfig");
    });
  });

  it("keeps Composer and composition free of merchant identity control flow", () => {
    composerRoots.flatMap(productionModules).forEach((file) => {
      const source = readFileSync(file, "utf8");
      expect(source, file).not.toMatch(/merchantId|businessName|discovery-decants|Aurelian/);
    });
  });

  it("does not expose merchant configuration from shared Builder barrels", () => {
    ["./index.js", "./config/index.js"].forEach((relativePath) => {
      const source = readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), "utf8");
      expect(source).not.toMatch(/merchants\/|discoveryDecantsConfig/);
    });
  });

  it("imports pure Composer modules in plain Node without browser globals", () => {
    const moduleUrls = [
      new URL("./internal/composer/composeCollection.js", import.meta.url).href,
      new URL("./internal/composition/buildComposerBoxProposal.js", import.meta.url).href,
    ];
    const result = spawnSync(
      process.execPath,
      ["--input-type=module", "--eval", `await Promise.all(${JSON.stringify(moduleUrls)}.map((url) => import(url)))`],
      { encoding: "utf8" },
    );

    expect(result.status, result.stderr).toBe(0);
  });
});
