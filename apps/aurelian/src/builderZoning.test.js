import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const APP_ROOT = fileURLToPath(new URL("..", import.meta.url));
const REPOSITORY_ROOT = fileURLToPath(new URL("../../..", import.meta.url));
const read = (...segments) => readFileSync(join(...segments), "utf8");

const zoningCss = read(APP_ROOT, "src", "app", "builder-zoning.css");
const zoningWithoutComments = zoningCss.replace(/\/\*[\s\S]*?\*\//g, "");

// Flattens nested @media blocks too: inner rules never nest further, so a
// plain `selector { declarations }` pattern finds every rule.
const rules = [...zoningWithoutComments.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
  .map(([, selector, body]) => ({ selector: selector.trim(), body }))
  .filter(({ selector }) => !selector.startsWith("@"));

const selectors = rules.flatMap(({ selector }) => selector.split(",").map((part) => part.trim()));

function sourceFiles(directory) {
  return readdirSync(directory).flatMap((entry) => {
    if (entry === "node_modules" || entry === ".next" || entry === "dist") return [];
    const path = join(directory, entry);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.(?:[cm]?[jt]sx?|css)$/.test(entry) && !/\.test\.[cm]?[jt]sx?$/.test(entry) ? [path] : [];
  });
}

describe("Aurelian Phase 1 atmospheric zoning (host-owned)", () => {
  it("is loaded by Aurelian's own layout, after globals.css", () => {
    const layout = read(APP_ROOT, "src", "app", "layout.jsx");
    expect(layout.indexOf('import "./globals.css";')).toBeGreaterThan(-1);
    expect(layout.indexOf('import "./builder-zoning.css";')).toBeGreaterThan(
      layout.indexOf('import "./globals.css";')
    );
  });

  it("maps the approved palette to host-scoped variables", () => {
    expect(zoningCss).toContain("--aur-charcoal: #2a2a2a;");
    expect(zoningCss).toContain("--aur-burgundy: #4a0f1f;");
    expect(zoningCss).toContain("--aur-green: #173c32;");
    expect(zoningCss).toContain("--aur-brass: #a9824f;");
    expect(zoningCss).toContain("--aur-ivory: #e7ddcf;");
  });

  it("scopes every rule to the Builder page, the docked summary slot, or the Builder-route header", () => {
    expect(selectors.length).toBeGreaterThan(20);
    selectors.forEach((selector) => {
      expect(selector, selector).toMatch(
        /^(?:\.builder-page|#aurelian-builder-summary-slot|\.site-header:has\(\.site-header__inner--builder\))/
      );
    });
  });

  it("never uses !important", () => {
    expect(zoningWithoutComments).not.toContain("!important");
  });

  it("uses burgundy and deep green only as surface/border/glow, never as foreground text", () => {
    rules.forEach(({ selector, body }) => {
      const foreground = [...body.matchAll(/(?:^|[;\s])color:\s*([^;]+);/g)].map((match) => match[1]);
      foreground.forEach((value) => {
        expect(value, `${selector} color`).not.toMatch(
          /aur-burgundy|aur-green|#4a0f1f|#173c32|74,\s*15,\s*31|23,\s*60,\s*50/i
        );
      });
    });
  });

  it("references exactly one Aurelian-owned artwork, which ships with the app and stays light", () => {
    const urls = [...zoningWithoutComments.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/g)].map((match) => match[1]);
    expect(urls).toEqual(["/media/atmosphere/builder-renaissance-background.webp"]);
    // The layer degrades to nothing if the asset is missing.
    expect(zoningWithoutComments).toContain("var(--aurelian-atmosphere-art, none)");

    const asset = join(APP_ROOT, "public", "media", "atmosphere", "builder-renaissance-background.webp");
    expect(existsSync(asset)).toBe(true);
    const bytes = readFileSync(asset);
    expect(bytes.subarray(0, 4).toString("ascii")).toBe("RIFF");
    expect(bytes.subarray(8, 12).toString("ascii")).toBe("WEBP");
    // Atmosphere art sits behind a ~1440px app: keep it a light WebP.
    expect(bytes.length).toBeLessThan(300 * 1024);
  });

  it("never pins the artwork to the viewport (no fixed attachment) and keeps its cost bounded", () => {
    const atmosphere = rules.find(({ selector }) => selector === ".builder-page::before");
    expect(atmosphere.body).toMatch(/background-attachment:\s*scroll;/);
    expect(zoningWithoutComments).not.toMatch(/background-attachment:[^;]*fixed/);
    expect(atmosphere.body).not.toMatch(/background-size:[^;]*cover/);
  });

  it("keeps the atmosphere inside the Builder section so it can never cover the footer", () => {
    const atmosphere = rules.find(({ selector }) => selector === ".builder-page::before");
    expect(atmosphere.body).toMatch(/position:\s*absolute;/);
    expect(atmosphere.body).not.toMatch(/position:\s*fixed;/);
    expect(atmosphere.body).not.toMatch(/\bfilter:/);
    expect(atmosphere.body).toMatch(/pointer-events:\s*none;/);
  });

  it("changes no layout: no sizing, spacing, grid, flex or display declarations", () => {
    rules.forEach(({ selector, body }) => {
      expect(body, selector).not.toMatch(
        /(?:^|[;\s])(?:margin|padding|gap|display|width|min-width|max-width|grid-template[\w-]*|flex[\w-]*)\s*:/
      );
    });
    expect(zoningWithoutComments.match(/@media/g)).toHaveLength(1);
    expect(zoningWithoutComments).toContain("@media (max-width: 980px)");
  });

  it("does not target the semantic color systems or Phase-2 internals", () => {
    selectors.forEach((selector) => {
      expect(selector, selector).not.toMatch(
        /tier-|perfume-card-points|\.slot-progress|\.collection-card|curator-lock|curator-bonus-icon|bonus-vial|confidence|recommendation|season|note-|perfume-details|modal|final-summary/
      );
    });
  });

  it("does not touch Aurelian's pinned Builder theme tokens", () => {
    const config = read(APP_ROOT, "src", "merchant", "config.js");
    expect(config).toContain('accent: "#C8A665"');
    expect(config).toContain('accentStrong: "#9F7D43"');
    expect(config).toContain('background: "#090A09"');
    expect(config).not.toMatch(/4A0F1F|173C32|A9824F|E7DDCF/i);
  });
});

describe("merchant boundaries: the zoning palette never reaches shared or Discovery Decants code", () => {
  const palette = /4a0f1f|173c32|a9824f|e7ddcf|--aur-|aurelian-atmosphere|builder-zoning|builder-intro\.css|builder-geometry\.css|builder-header\.css|landing-hero\.css|landing-video\.css|landing-seasons\.css|catalog-seasons\.css|catalog-atmosphere|aurelian-hero-stage|media\/landing|builder-renaissance-background|discovery-intro-renaissance|media\/atmosphere/i;

  it("is absent from the shared Builder package (source and stylesheet)", () => {
    const files = [
      ...sourceFiles(join(REPOSITORY_ROOT, "packages", "builder", "src")),
      join(REPOSITORY_ROOT, "packages", "builder", "styles.css"),
      ...sourceFiles(join(REPOSITORY_ROOT, "packages", "catalog", "src")),
    ];
    files.forEach((file) => expect(readFileSync(file, "utf8"), file).not.toMatch(palette));
  });

  it("is absent from the Discovery Decants host", () => {
    sourceFiles(join(REPOSITORY_ROOT, "src")).forEach((file) =>
      expect(readFileSync(file, "utf8"), file).not.toMatch(palette)
    );
  });
});
