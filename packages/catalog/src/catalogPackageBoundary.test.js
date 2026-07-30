import { readFileSync, readdirSync } from "node:fs";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import * as catalog from "./index.js";

const PACKAGE_SOURCE = fileURLToPath(new URL("./", import.meta.url));
const REPOSITORY_ROOT = fileURLToPath(new URL("../../../", import.meta.url));

function javascriptFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory()
      ? javascriptFiles(path)
      : [".js", ".jsx"].includes(extname(entry.name))
        ? [path]
        : [];
  });
}

describe("@discovery-box/catalog package boundary", () => {
  it("exports exactly the approved public API", () => {
    expect(Object.keys(catalog).sort()).toEqual([
      "brandAssets",
      "createMerchantCatalog",
      "fragrances",
      "metadataAssets",
      "notes",
    ]);
  });

  it("contains no merchant, React, browser, Vite, or host behavior", () => {
    const productionFiles = javascriptFiles(PACKAGE_SOURCE).filter(
      (path) => !path.endsWith(".test.js") && !path.endsWith(".test.jsx")
    );
    const source = productionFiles.map((path) => readFileSync(path, "utf8")).join("\n");

    expect(source).not.toMatch(/\b(?:Aurelian|Discovery Decants|discoveryDecants)\b/i);
    expect(source).not.toMatch(/\b(?:React|window|document|navigator|localStorage)\b/);
    expect(source).not.toContain("import.meta.env");
    expect(source).not.toMatch(/\b(?:persistence|analytics|finalization|inventory|stock|pointValue)\b/i);
  });

  it("keeps production consumers on the package entry and away from deleted legacy modules", () => {
    const productionFiles = javascriptFiles(join(REPOSITORY_ROOT, "src")).filter(
      (path) => !path.endsWith(".test.js") && !path.endsWith(".test.jsx")
    );
    const source = productionFiles.map((path) => readFileSync(path, "utf8")).join("\n");

    expect(source).not.toMatch(/@discovery-box\/catalog\//);
    expect(source).not.toMatch(/(?:data\/(?:perfumes|notes|brandAssets|metadataAssets)|catalog\/createMerchantCatalog)/);
    expect(source).not.toContain("catalogIdentityBaseline.fixture.js");
  });

  it("retains the approved mapping sizes and intentional aliases", () => {
    expect(catalog.fragrances).toHaveLength(84);
    expect(Object.keys(catalog.notes)).toHaveLength(169);
    expect(Object.keys(catalog.brandAssets)).toHaveLength(46);
    expect(
      Object.values(catalog.metadataAssets).reduce(
        (count, values) => count + Object.keys(values).length,
        0
      )
    ).toBe(94);
    expect(catalog.brandAssets.YSL).toBe(catalog.brandAssets["Yves Saint Laurent"]);
    expect(catalog.metadataAssets.occasions.daily).toBe(
      catalog.metadataAssets.occasions.day
    );
  });
});
