import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { discoveryDecantsConfig } from "./builder/config/discoveryDecantsConfig.js";

const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const publicRoot = join(projectRoot, "public");
const indexHtml = readFileSync(join(projectRoot, "index.html"), "utf8");

function extractMeta(attribute, key) {
  const pattern = new RegExp(
    `<meta\\s+[^>]*${attribute}="${key}"[^>]*content="([^"]+)"[^>]*>`,
    "i"
  );
  return indexHtml.match(pattern)?.[1] || null;
}

describe("production browser identity", () => {
  it("uses the neutral Decant Builder document title", () => {
    expect(indexHtml).toContain("<title>Decant Builder</title>");
    expect(indexHtml).not.toContain("<title>decant-builder</title>");
    expect(indexHtml).not.toContain("Aurelian");
  });

  it("provides safe baseline browser and social metadata", () => {
    expect(extractMeta("name", "description")).toBe(
      "Build a personalized fragrance discovery box from a curated catalog."
    );
    expect(extractMeta("name", "theme-color")).toBe("#07100b");
    expect(extractMeta("property", "og:type")).toBe("website");
    expect(extractMeta("property", "og:title")).toBe("Decant Builder");
    expect(extractMeta("property", "og:description")).toBe(
      "Build a personalized fragrance discovery box from a curated catalog."
    );
    expect(extractMeta("property", "og:site_name")).toBe("Decant Builder");
    expect(extractMeta("name", "twitter:card")).toBe("summary");
    expect(extractMeta("name", "twitter:title")).toBe("Decant Builder");
    expect(extractMeta("name", "twitter:description")).toBe(
      "Build a personalized fragrance discovery box from a curated catalog."
    );
    expect(extractMeta("property", "og:image")).toBeNull();
  });

  it("keeps software identity separate from merchant identity", () => {
    expect(discoveryDecantsConfig.software.name).toBe("Decant Builder");
    expect(discoveryDecantsConfig.brand.businessName).toBe("Discovery Decants");
    expect(indexHtml).not.toContain(discoveryDecantsConfig.brand.businessName);
    expect(discoveryDecantsConfig.commerce.totalLabel).toBe("Order Total");
  });

  it("does not reference an unsuitable or missing favicon", () => {
    const faviconHref = indexHtml.match(/<link\s+[^>]*rel="icon"[^>]*href="([^"]+)"/i)?.[1];

    if (faviconHref) {
      expect(existsSync(join(publicRoot, faviconHref.replace(/^\//, "")))).toBe(true);
    }

    expect(faviconHref).toBeUndefined();
  });
});
