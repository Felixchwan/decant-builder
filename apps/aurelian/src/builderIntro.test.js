import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const APP_ROOT = fileURLToPath(new URL("..", import.meta.url));
const REPOSITORY_ROOT = fileURLToPath(new URL("../../..", import.meta.url));
const read = (...segments) => readFileSync(join(...segments), "utf8");

const introCss = read(APP_ROOT, "src", "app", "builder-intro.css");
const withoutComments = introCss.replace(/\/\*[\s\S]*?\*\//g, "");

const rules = [...withoutComments.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
  .map(([, selector, body]) => ({ selector: selector.trim(), body }))
  .filter(({ selector }) => !selector.startsWith("@"));
const selectors = rules.flatMap(({ selector }) => selector.split(",").map((part) => part.trim()));

describe("Aurelian intro panel styling (host-owned, presentation-only)", () => {
  it("is loaded by Aurelian's own layout, after globals.css", () => {
    const layout = read(APP_ROOT, "src", "app", "layout.jsx");
    expect(layout.indexOf('import "./builder-intro.css";')).toBeGreaterThan(
      layout.indexOf('import "./globals.css";')
    );
  });

  it("only targets the intro block and its dismiss control, scoped under .builder-page", () => {
    expect(selectors.length).toBeGreaterThan(8);
    selectors.forEach((selector) => {
      expect(selector, selector).toMatch(/^\.builder-page #builder-entry-header(?:[\s:]|$)/);
    });
  });

  it("never uses !important and references exactly one Aurelian-owned, light artwork", () => {
    expect(withoutComments).not.toContain("!important");
    const urls = [...withoutComments.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/g)].map((match) => match[1]);
    expect(urls).toEqual(["/media/atmosphere/discovery-intro-renaissance.webp"]);
    // The artwork layer degrades to nothing if the asset is missing.
    expect(withoutComments).toContain("var(--aurelian-intro-art, none)");

    const asset = join(APP_ROOT, "public", "media", "atmosphere", "discovery-intro-renaissance.webp");
    const bytes = readFileSync(asset);
    expect(bytes.subarray(0, 4).toString("ascii")).toBe("RIFF");
    expect(bytes.subarray(8, 12).toString("ascii")).toBe("WEBP");
    expect(bytes.length).toBeLessThan(300 * 1024);
  });

  it("leaves the pinned width/margin match and any sizing of the header to globals.css", () => {
    // The header's own box: no width, horizontal margin or hiding.
    rules
      .filter(({ selector }) => selector === ".builder-page #builder-entry-header")
      .forEach(({ selector, body }) => {
        expect(body, selector).not.toMatch(
          /(?:^|[;\s])(?:margin[\w-]*|width|min-width|max-width)\s*:/
        );
      });
    // Nothing may hide the header or reintroduce horizontal margins anywhere.
    rules.forEach(({ selector, body }) => {
      expect(body, selector).not.toMatch(/(?:^|[;\s])margin-(?:left|right|inline[\w-]*)\s*:/);
      expect(body, selector).not.toMatch(/display\s*:\s*none/);
    });
    // Only the header's own box may carry padding (the desktop width match
    // lives in globals.css and the panel offset is measured from real height).
    rules
      .filter(({ body }) => /(?:^|[;\s])padding[\w-]*\s*:/.test(body))
      .forEach(({ selector }) => {
        expect(selector).toMatch(/^\.builder-page #builder-entry-header(?:\s+\.text-link)?$/);
      });
  });

  it("keeps decorative pseudo-elements out of the pointer path", () => {
    ["::before", "::after"].forEach((pseudo) => {
      const frame = rules.find(({ selector }) => selector === `.builder-page #builder-entry-header${pseudo}`);
      expect(frame.body).toMatch(/pointer-events:\s*none;/);
    });
  });

  it("does not touch the component markup contract the pre-hydration script and tests rely on", () => {
    const component = read(APP_ROOT, "src", "components", "BuilderIntroHeader.jsx");
    expect(component).toContain('id="builder-entry-header"');
    expect(component).toContain('className="builder-intro-dismiss"');
  });

  it("is absent from the shared Builder package and the Discovery Decants host", () => {
    const shared = read(REPOSITORY_ROOT, "packages", "builder", "styles.css");
    expect(shared).not.toMatch(/builder-intro\.css/);
    const layout = read(REPOSITORY_ROOT, "src", "main.jsx");
    expect(layout).not.toMatch(/builder-intro\.css|builder-zoning\.css/);
  });
});
