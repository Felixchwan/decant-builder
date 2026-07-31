import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const sourceRoot = fileURLToPath(new URL("..", import.meta.url));
const mainSource = readFileSync(new URL("../main.jsx", import.meta.url), "utf8");
const appSource = readFileSync(new URL("../App.jsx", import.meta.url), "utf8");
const hostCss = readFileSync(new URL("../App.css", import.meta.url), "utf8");
const builderCss = readFileSync(new URL("./styles.css", import.meta.url), "utf8");

const expectedKeyframes = [
  "restore-message-fade",
  "curatorChainsRelease",
  "curatorPanelUnlockGlow",
  "curatorUnlockMessage",
  "curatorChainUpperRelease",
  "curatorChainLowerRelease",
  "curatorLockFade",
  "nextSlotBreath",
  "nextSlotPlusBreath",
  "perfume-details-hint-fade",
  "metadata-preview-in",
  "collectionDnaChipSheen",
  "dnaAccordIn",
  "recommendationLaneEmphasis",
];

function productionSources(directory) {
  return readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);
    if (statSync(path).isDirectory()) return productionSources(path);
    if (!/\.[cm]?[jt]sx?$/.test(entry) || /\.test\.[cm]?[jt]sx?$/.test(entry)) return [];
    return [[path, readFileSync(path, "utf8")]];
  });
}

describe("Builder stylesheet ownership", () => {
  it("loads host and Builder styles once in the approved production order", () => {
    expect(mainSource).toMatch(
      /import ['"]\.\/index\.css['"];?\s*import ['"]\.\/App\.css['"];?\s*import ['"]\.\/builder\/styles\.css['"];?/,
    );
    expect(appSource).not.toMatch(/import\s+['"][^'"]+\.css['"]/);

    const cssImports = productionSources(sourceRoot).flatMap(([path, source]) =>
      [...source.matchAll(/import\s+['"]([^'"]+\.css)['"]/g)].map((match) => [path, match[1]]),
    );
    expect(cssImports).toHaveLength(3);
    expect(cssImports.map(([, cssPath]) => cssPath)).toEqual([
      "./index.css",
      "./App.css",
      "./builder/styles.css",
    ]);
  });

  it("keeps host globals and error UI separate from Builder component styles", () => {
    expect(hostCss).toMatch(/^\*\s*\{/);
    expect(hostCss).toMatch(/^body\s*\{/m);
    expect(hostCss).toContain(".app-error-shell {");
    expect(hostCss).toContain(".app-error-card {");
    expect(hostCss.trimEnd()).toMatch(/\.app-error-actions\s*\{[\s\S]*\}$/);
    expect(hostCss).not.toMatch(
      /^(?:\.app(?:\s|,|\{)|\.(?:builder-|hero|layout|catalog|perfume-|box-|composer-))/m,
    );

    expect(builderCss).toMatch(/^:where\(\.builder-scope\)\s*\{/);
    expect(builderCss).toContain(":where(.builder-scope).builder-theme-root {");
    expect(builderCss).toContain(":where(.builder-scope) .perfume-card {");
    expect(builderCss).toContain(":where(.builder-scope) .builder-panel {");
    expect(builderCss).not.toMatch(
      /^(?:\*|html|body|#root|\.app-error-shell|\.app-error-card)\s*(?:,|\{)/m,
    );
  });

  it("retains every Builder keyframe in its original order", () => {
    const keyframes = [...builderCss.matchAll(/@keyframes\s+([\w-]+)/g)].map((match) => match[1]);
    expect(keyframes).toEqual(expectedKeyframes);
  });
});
