import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { metadata } from "./app/layout.jsx";

const APP_ROOT = fileURLToPath(new URL("..", import.meta.url));
const REPOSITORY_ROOT = fileURLToPath(new URL("../../..", import.meta.url));
const SHARE_PATH = "/media/share/aurelian-share.jpg";

// The size of a baseline or progressive JPEG, read from its first start-of-frame marker.
function jpegSize(bytes) {
  let offset = 2;

  while (offset < bytes.length) {
    if (bytes[offset] !== 0xff) {
      offset += 1;
      continue;
    }

    const marker = bytes[offset + 1];

    if ([0xc0, 0xc1, 0xc2].includes(marker)) {
      return { height: bytes.readUInt16BE(offset + 5), width: bytes.readUInt16BE(offset + 7) };
    }

    offset += 2 + bytes.readUInt16BE(offset + 2);
  }

  return null;
}

describe("Aurelian share preview (Open Graph / X card)", () => {
  it("names one brand image for every route, absolute through metadataBase, with its real size and a description", () => {
    const [image] = metadata.openGraph.images;

    expect(metadata.metadataBase.href).toBe("https://aurelianperfumes.com/");
    expect(metadata.openGraph.images).toHaveLength(1);
    expect(image.url).toBe(SHARE_PATH);
    expect(image).toMatchObject({ width: 1200, height: 630, type: "image/jpeg" });
    expect(image.alt).toMatch(/Aurelian/);
    expect(new URL(image.url, metadata.metadataBase).href).toBe(`https://aurelianperfumes.com${SHARE_PATH}`);
  });

  it("asks X and other card readers for the large image card, with the same picture", () => {
    expect(metadata.twitter.card).toBe("summary_large_image");
    expect(metadata.twitter.images).toEqual([{ url: SHARE_PATH, alt: metadata.openGraph.images[0].alt }]);
  });

  it("keeps title and description coherent between the page, Open Graph and the card", () => {
    expect(metadata.openGraph.title).toBe("Aurelian Perfumes");
    expect(metadata.twitter.title).toBe(metadata.openGraph.title);
    expect(metadata.twitter.description).toBe(metadata.openGraph.description);
    expect(metadata.openGraph.description).toBe("Descubre fragancias antes de elegir una botella. Crea una Discovery Box personal con una selección curada por Aurelian Perfumes.");
    expect(metadata.openGraph).toMatchObject({ siteName: "Aurelian Perfumes", locale: "es_MX", type: "website" });
    expect(metadata.title.default).toContain("Aurelian Perfumes");
  });

  it("does not pin og:url to the home page for every route: each page's own canonical link identifies it", () => {
    expect(metadata.openGraph.url).toBeUndefined();
    expect(metadata.alternates.canonical).toBe("/");
  });

  it("ships the file it names: a real 1200x630 JPEG that is light enough for a link preview", () => {
    const path = join(APP_ROOT, "public", ...SHARE_PATH.split("/").filter(Boolean));
    const bytes = readFileSync(path);

    expect([bytes[0], bytes[1]]).toEqual([0xff, 0xd8]);
    expect(jpegSize(bytes)).toEqual({ width: 1200, height: 630 });
    expect(statSync(path).size).toBeGreaterThan(20 * 1024);
    // well under every platform's limit (Facebook allows 8 MB; a preview should not be heavy)
    expect(statSync(path).size).toBeLessThan(600 * 1024);
  });

  it("does not let a page undo it: no route overrides openGraph or twitter, and none names a catalog image", () => {
    const walk = (directory) =>
      readdirSync(directory).flatMap((entry) => {
        const path = join(directory, entry);

        return statSync(path).isDirectory() ? walk(path) : /\.(jsx?|js)$/.test(entry) && !/\.test\./.test(entry) ? [path] : [];
      });

    walk(join(APP_ROOT, "src", "app"))
      .filter((path) => !path.endsWith(`${"app"}${"\\"}layout.jsx`) && !path.endsWith("app/layout.jsx"))
      .forEach((path) => {
        const source = readFileSync(path, "utf8");

        expect(source, path).not.toMatch(/openGraph\s*:|twitter\s*:|og:image/);
      });
  });

  it("is host-only: Discovery Decants and the shared packages know nothing about it", () => {
    const walk = (directory) =>
      readdirSync(directory).flatMap((entry) => {
        const path = join(directory, entry);

        return statSync(path).isDirectory() ? walk(path) : /\.(jsx?|html)$/.test(entry) && !/\.test\./.test(entry) ? [path] : [];
      });

    [...walk(join(REPOSITORY_ROOT, "src")), join(REPOSITORY_ROOT, "index.html")].forEach((path) => {
      expect(readFileSync(path, "utf8"), path).not.toMatch(/aurelian-share|media\/share/);
    });
  });
});
