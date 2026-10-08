import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import HomePage from "./app/page.jsx";

const APP_ROOT = fileURLToPath(new URL("..", import.meta.url));
const REPOSITORY_ROOT = fileURLToPath(new URL("../../..", import.meta.url));
const read = (...segments) => readFileSync(join(...segments), "utf8");

const heroCss = read(APP_ROOT, "src", "app", "landing-hero.css");
const withoutComments = heroCss.replace(/\/\*[\s\S]*?\*\//g, "");

const rules = [...withoutComments.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
  .map(([, selector, body]) => ({ selector: selector.trim(), body }))
  .filter(({ selector }) => !selector.startsWith("@"));
const selectors = rules.flatMap(({ selector }) => selector.split(",").map((part) => part.trim()));

const heroMarkup = () => {
  const markup = renderToStaticMarkup(<HomePage />);
  const start = markup.indexOf('<div class="aurelian-hero-stage">');
  const end = markup.indexOf("</section></div>", start);
  return markup.slice(start, end + "</section></div>".length);
};

describe("Aurelian landing hero (host-owned, route-safe)", () => {
  it("is loaded by Aurelian's own layout, after the Builder stylesheets", () => {
    const layout = read(APP_ROOT, "src", "app", "layout.jsx");
    expect(layout.indexOf('import "./landing-hero.css";')).toBeGreaterThan(
      layout.indexOf('import "./builder-header.css";')
    );
  });

  it("is keyed only on landing-only hooks, so it can never reach the Builder or other routes", () => {
    expect(selectors.length).toBeGreaterThan(15);
    selectors.forEach((selector) => {
      expect(selector, selector).toMatch(
        /^\.aurelian-hero-stage/
      );
    });
    expect(withoutComments).not.toContain("!important");
  });

  it("references exactly one Aurelian-owned, light artwork, and degrades to nothing without it", () => {
    const urls = [...withoutComments.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/g)].map((match) => match[1]);
    expect(urls).toEqual(["/media/landing/landing-atelier-hero.webp"]);
    expect(withoutComments).toContain("var(--aurelian-hero-art, none)");

    const bytes = readFileSync(join(APP_ROOT, "public", "media", "landing", "landing-atelier-hero.webp"));
    expect(bytes.subarray(0, 4).toString("ascii")).toBe("RIFF");
    expect(bytes.subarray(8, 12).toString("ascii")).toBe("WEBP");
    expect(bytes.length).toBeLessThan(300 * 1024);
  });

  it("keeps three distinct artwork roles: the landing hero is not the Builder intro plate or the Builder background", () => {
    const sha = (...segments) => createHash("sha1").update(readFileSync(join(APP_ROOT, "public", "media", ...segments))).digest("hex");
    const hero = sha("landing", "landing-atelier-hero.webp");
    expect(hero).not.toBe(sha("atmosphere", "discovery-intro-renaissance.webp"));
    expect(hero).not.toBe(sha("atmosphere", "builder-renaissance-background.webp"));

    // Each role keeps its own path in its own stylesheet; the landing never points at the Builder's files.
    expect(withoutComments).not.toContain("/media/atmosphere/");
    expect(read(APP_ROOT, "src", "app", "builder-intro.css")).toContain("/media/atmosphere/discovery-intro-renaissance.webp");
    expect(read(APP_ROOT, "src", "app", "builder-zoning.css")).toContain("/media/atmosphere/builder-renaissance-background.webp");
    expect(read(APP_ROOT, "src", "app", "builder-intro.css")).not.toContain("/media/landing/");
    expect(read(APP_ROOT, "src", "app", "builder-zoning.css")).not.toContain("/media/landing/");
  });

  it("locks the art box to the image's own aspect ratio and sizes it from the stage, so it is never distorted", () => {
    const bytes = readFileSync(join(APP_ROOT, "public", "media", "landing", "landing-atelier-hero.webp"));
    // Canvas size from the WebP header: extended (VP8X, 24-bit minus one) or simple lossy (VP8, 14-bit).
    const chunk = bytes.subarray(12, 16).toString("ascii");
    expect(["VP8X", "VP8 "]).toContain(chunk);
    const width = chunk === "VP8X" ? 1 + bytes.readUIntLE(24, 3) : bytes.readUInt16LE(26) & 0x3fff;
    const height = chunk === "VP8X" ? 1 + bytes.readUIntLE(27, 3) : bytes.readUInt16LE(28) & 0x3fff;
    expect([width, height]).toEqual([1672, 941]);

    const art = rules.find(({ selector }) => selector === ".aurelian-hero-stage::before");
    expect(art.body).toContain(`aspect-ratio: ${width} / ${height};`);
    expect(art.body).toMatch(/width:\s*var\(--hero-art-w\);/);
    expect(art.body).toMatch(/background-size:\s*100% 100%;/);
    expect(withoutComments).toMatch(/--hero-art-w:\s*min\(100cqw,\s*1500px\);/);
    expect(withoutComments).toMatch(/--hero-art-w:\s*max\(100cqw,\s*460px\);/);
    expect(withoutComments).not.toMatch(/background-size:[^;]*(?:cover|contain)/);
  });

  it("sets the copy in the picture's dark middle, clear of the bust on the left and the arch on the right", () => {
    const start = Number(withoutComments.match(/--hero-copy-start:\s*([\d.]+);/)[1]);
    const width = Number(withoutComments.match(/--hero-copy-w:\s*([\d.]+);/)[1]);
    // Bust and drape end near 25-33% of the picture; the arch pillar and the right-hand still life begin near 70-74%.
    expect(start).toBeGreaterThanOrEqual(0.33);
    expect(start + width).toBeLessThanOrEqual(0.74);
    const copy = rules.find(({ selector }) => selector === ".aurelian-hero-stage .aurelian-hero__copy");
    expect(copy.body).toContain("var(--hero-copy-start) * var(--hero-art-w)");
  });

  it("never sizes the hero by the viewport", () => {
    // The existing principle: content-driven hero height, nothing viewport-sized, no overflow tricks.
    expect(withoutComments).not.toMatch(/\d(?:vh|svh|dvh|lvh)\b|100vw|min-height|min-block-size/);
    expect(withoutComments).not.toMatch(/background-attachment:\s*fixed/);
  });

  it("keeps the hero copy approved and free of invented claims", () => {
    const hero = heroMarkup();
    expect(hero).toContain('class="aurelian-hero page-shell"');
    expect(hero).toContain("<h1>Descubre antes de elegir.</h1>");
    expect(hero).toContain("Antes de una botella completa, compara con calma.");
    expect(hero).not.toMatch(/env[ií]o|garant[ií]a|gratis|exclusiv|precio|\$\d|disponibilidad inmediata|en stock/i);
  });

  it("keeps a clear CTA hierarchy: one brass primary to the Builder, one restrained secondary to the catalog", () => {
    const hero = heroMarkup();
    const buttons = [...hero.matchAll(/<a class="(button[^"]*)" href="([^"]+)">([^<]+)<\/a>/g)].map((match) => ({
      className: match[1],
      href: match[2],
      label: match[3],
    }));
    expect(buttons).toEqual([
      { className: "button", href: "/build-your-box", label: "Arma tu Discovery Box" },
      { className: "button button--outline", href: "/catalogo", label: "Explora el catálogo" },
    ]);
    // The primary keeps the shared brass fill (never repainted here); the secondary is dark and outlined.
    expect(withoutComments).not.toMatch(/\.aurelian-hero-stage \.button\s*\{[^}]*background/);
    const outline = rules.find(({ selector }) => selector === ".aurelian-hero-stage .button--outline");
    expect(outline.body).toMatch(/background:\s*rgba\(8, 7, 7/);
    // Tailored geometry (the approved 8px), not pills.
    const geometry = rules.find(({ selector }) => selector === ".aurelian-hero-stage .button");
    expect(geometry.body).toMatch(/border-radius:\s*8px;/);
  });

  it("leaves HeroMedia and the 4.6MB promotional video out of the landing's first view (the component is kept)", () => {
    const page = read(APP_ROOT, "src", "app", "page.jsx");
    expect(page).not.toMatch(/HeroMedia|torino-21/);
    expect(heroMarkup()).not.toContain("hero-media");
    expect(read(APP_ROOT, "src", "components", "HeroMedia.jsx")).toContain("export function HeroMedia");
  });

  it("leaves the shared header's skin to site-header.css, so the hero stylesheet holds only hero rules", () => {
    expect(withoutComments).not.toMatch(/site-header|desktop-nav|desktop-cta|mobile-menu|--site-header-height/);
    expect(selectors.some((selector) => selector.startsWith("body:has") || selector.startsWith(":root:has"))).toBe(false);
  });

  it("does not touch the pinned hero rules in globals.css", () => {
    const globals = read(APP_ROOT, "src", "app", "globals.css");
    expect(globals).toMatch(/\.aurelian-hero\s*\{[^}]*padding-block:0/);
    expect(globals).toMatch(/\.aurelian-hero__copy\s*\{[^}]*padding-block:clamp\(3rem,6vw,5rem\)/);
    expect(globals).toMatch(/\.hero-media__frame\s*\{[^}]*aspect-ratio:9\/20/);
  });

  it("is absent from the shared Builder package, the catalog and Discovery Decants", () => {
    expect(read(REPOSITORY_ROOT, "packages", "builder", "styles.css")).not.toMatch(
      /landing-hero|aurelian-hero-stage|media\/landing/
    );
    expect(read(REPOSITORY_ROOT, "src", "main.jsx")).not.toMatch(/landing-hero/);
  });
});
