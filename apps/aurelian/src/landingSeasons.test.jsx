import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import HomePage from "./app/page.jsx";
import { aurelianCatalog } from "./merchant/catalog.js";
import { SEASONAL_SLOTS } from "./lib/seasonalSelection.js";

const APP_ROOT = fileURLToPath(new URL("..", import.meta.url));
const REPOSITORY_ROOT = fileURLToPath(new URL("../../..", import.meta.url));
const read = (...segments) => readFileSync(join(...segments), "utf8");

const css = read(APP_ROOT, "src", "app", "landing-seasons.css");
const withoutComments = css.replace(/\/\*[\s\S]*?\*\//g, "");
const rules = [...withoutComments.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
  .map(([, selector, body]) => ({ selector: selector.trim(), body }))
  .filter(({ selector }) => !selector.startsWith("@"));
const selectors = rules.flatMap(({ selector }) => selector.split(",").map((part) => part.trim()));

// Slot key -> artwork filename. The slot says "fall"; the file says "autumn".
const EXPECTED_ART = {
  spring: "catalog-spring-editorial.webp",
  summer: "catalog-summer-editorial.webp",
  fall: "catalog-autumn-editorial.webp",
  winter: "catalog-winter-editorial.webp",
};
const ART_DIR = join(APP_ROOT, "public", "media", "landing", "seasons");

describe("Aurelian landing seasonal editorial cards (host-owned, decorative)", () => {
  it("exposes exactly four season roles, taken from the card's slot", () => {
    const markup = renderToStaticMarkup(<HomePage />);
    const seasons = [...markup.matchAll(/data-season="([^"]+)"/g)].map((match) => match[1]);
    expect(seasons).toEqual(SEASONAL_SLOTS.map(({ key }) => key));
    expect(seasons).toEqual(["spring", "summer", "fall", "winter"]);

    const source = read(APP_ROOT, "src", "components", "SeasonalFeaturedSelection.jsx");
    expect(source).toContain("data-season={season.key}");
    // The role comes from the slot, never from the fragrance that happens to fill it.
    expect(source).not.toMatch(/data-season=\{item\./);
  });

  it("maps presentation by season role only: never by fragrance id, brand, name or position", () => {
    const seasonRules = rules.filter(({ selector }) => selector.includes("data-season"));
    expect(seasonRules).toHaveLength(4);
    expect(seasonRules.map(({ selector }) => selector.match(/data-season="([^"]+)"/)[1]).sort()).toEqual(
      ["fall", "spring", "summer", "winter"]
    );
    selectors.forEach((selector) => {
      expect(selector, selector).toMatch(/^\.seasonal-featured /);
      expect(selector, selector).not.toMatch(/data-fragrance|nth-child|nth-of-type|first-child|last-child|:has\(/);
    });
    const lowered = withoutComments.toLowerCase();
    for (const fragrance of aurelianCatalog) {
      expect(lowered, String(fragrance.name)).not.toContain(String(fragrance.name).toLowerCase());
      expect(lowered, String(fragrance.brand)).not.toContain(String(fragrance.brand).toLowerCase());
    }
  });

  it("keeps the artwork host-owned: four slots under landing/seasons, nowhere in shared code or catalog data", () => {
    const urls = [...withoutComments.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/g)].map((match) => match[1]);
    expect(urls.sort()).toEqual(
      Object.values(EXPECTED_ART)
        .map((file) => `/media/landing/seasons/${file}`)
        .sort()
    );
    expect(read(REPOSITORY_ROOT, "packages", "builder", "styles.css")).not.toMatch(/landing-seasons|landing\/seasons/);
    expect(read(REPOSITORY_ROOT, "src", "main.jsx")).not.toMatch(/landing-seasons|landing\/seasons/);
    expect(read(APP_ROOT, "src", "merchant", "catalog.js")).not.toContain("landing/seasons");
    // Each slot's artwork is declared on its own season role.
    for (const [key, file] of Object.entries(EXPECTED_ART)) {
      const rule = rules.find(({ selector }) => selector.includes(`data-season="${key}"`));
      expect(rule.body).toContain(`/media/landing/seasons/${file}`);
    }
  });

  it("ships exactly the four artwork files: light, WebP, a portrait ratio close to 2:3", () => {
    expect(existsSync(ART_DIR)).toBe(true);
    const present = readdirSync(ART_DIR).filter((file) => /\.webp$/i.test(file));
    expect(present.sort()).toEqual(Object.values(EXPECTED_ART).sort());
    let total = 0;
    present.forEach((file) => {
      expect(Object.values(EXPECTED_ART), file).toContain(file);
      const bytes = readFileSync(join(ART_DIR, file));
      total += bytes.length;
      expect(bytes.subarray(0, 4).toString("ascii"), file).toBe("RIFF");
      expect(bytes.subarray(8, 12).toString("ascii"), file).toBe("WEBP");
      expect(bytes.length, file).toBeLessThan(150 * 1024);
      const chunk = bytes.subarray(12, 16).toString("ascii");
      const width = chunk === "VP8X" ? 1 + bytes.readUIntLE(24, 3) : chunk === "VP8 " ? bytes.readUInt16LE(26) & 0x3fff : null;
      const height = chunk === "VP8X" ? 1 + bytes.readUIntLE(27, 3) : chunk === "VP8 " ? bytes.readUInt16LE(28) & 0x3fff : null;
      if (width && height) expect(width / height, file).toBeGreaterThan(0.6);
      if (width && height) expect(width / height, file).toBeLessThan(0.72);
    });
    expect(total).toBeLessThan(500 * 1024);
  });

  it("keeps the artwork decorative: the text labels remain the only carriers of the season", () => {
    const markup = renderToStaticMarkup(<HomePage />);
    expect(markup.match(/Selección de (?:primavera|verano|otoño|invierno)/g)).toHaveLength(4);
    // No pseudo-element text, no alt text for the artwork (it is a background, never an <img>).
    const contents = [...withoutComments.matchAll(/(?:^|[;\s])content\s*:\s*([^;]+);/g)].map((match) => match[1].trim());
    contents.forEach((value) => expect(value).toBe('""'));
    expect(markup).not.toMatch(/editorial\.webp/);
  });

  it("layers art and veil behind the existing content without touching layout, the bottle or the data", () => {
    expect(withoutComments).not.toContain("!important");
    rules.forEach(({ selector, body }) => {
      expect(body, selector).not.toMatch(
        /(?:^|[;\s])(?:display|grid[\w-]*|flex[\w-]*|gap|width|height|min-[\w-]+|max-[\w-]+|margin[\w-]*|padding[\w-]*|order|float)\s*:/
      );
    });
    const card = rules.find(({ selector }) => selector === ".seasonal-featured .seasonal-card");
    expect(card.body).toMatch(/isolation:\s*isolate;/);
    expect(card.body).toMatch(/border-radius:\s*10px;/);
    const layers = rules.find(({ selector }) => selector.includes(".seasonal-card::before"));
    expect(layers.body).toMatch(/z-index:\s*-1;/);
    expect(layers.body).toMatch(/pointer-events:\s*none;/);
    // The bottle gets a grounding shadow only: no glow, no resize, no new source.
    const bottle = rules.find(({ selector }) => selector.includes(".seasonal-card__image img"));
    expect(bottle.body.replace(/\s+/g, " ").trim()).toMatch(/^filter: drop-shadow\(0 12px 14px rgba\(0, 0, 0, 0\.5\)\);$/);
  });

  it("keeps keyboard focus clearly visible inside the card and reveals a little more season on hover or focus", () => {
    const focus = rules.find(({ selector }) => selector.includes(".seasonal-card__link:focus-visible"));
    expect(focus.body).toMatch(/outline-offset:\s*-4px;/);
    expect(withoutComments).not.toMatch(/outline\s*:\s*none/);
    const reveal = rules.find(({ selector }) => selector.includes(":hover") && selector.includes(":focus-within"));
    expect(reveal.body).toMatch(/--season-art-strength:/);
    // Motion is limited to short opacity / border-color fades, which the global reduced-motion rule already neutralizes.
    expect(withoutComments).not.toMatch(/transform|animation|@keyframes|scale\(|translate/);
  });

  it("leaves the existing seasonal logic, tests' pinned CSS and the rest of the landing alone", () => {
    const globals = read(APP_ROOT, "src", "app", "globals.css");
    expect(globals).toMatch(/\.seasonal-card__image\s*\{[^}]*aspect-ratio:1\/1/);
    expect(globals).toMatch(/\.seasonal-card--exiting \.seasonal-card__link\s*\{[^}]*opacity:0;[^}]*pointer-events:none/);
    const layout = read(APP_ROOT, "src", "app", "layout.jsx");
    expect(layout.indexOf('import "./landing-seasons.css";')).toBeGreaterThan(layout.indexOf('import "./landing-video.css";'));
  });
});
