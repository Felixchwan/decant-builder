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
      expect(selector, selector).toMatch(
        /^\.builder-page(?::has\(\.layout--panel-collapsed\))? #builder-entry-header(?:[\s:]|$)/
      );
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

  it("only ever styles the collapsed-panel state inside the desktop media query, never mobile or tablet", () => {
    const occurrences = [...withoutComments.matchAll(/\.builder-page:has\(\.layout--panel-collapsed\)/g)];
    expect(occurrences.length).toBeGreaterThan(0);
    occurrences.forEach((match) => {
      const enclosing = withoutComments.slice(withoutComments.lastIndexOf("@media", match.index));
      expect(enclosing).toMatch(/^@media\s*\(min-width:\s*981px\)/);
    });
  });

  it("expands the plate, not the copy: the copy keeps a capped editorial measure when collapsed", () => {
    const copyRule = (collapsed) =>
      rules.find(
        ({ selector }) =>
          selector.includes(".eyebrow") &&
          selector.includes(".lede") &&
          selector.includes(".layout--panel-collapsed") === collapsed
      );
    expect(copyRule(false).body).toMatch(/max-width:\s*62%;/);
    expect(copyRule(true).body).toMatch(/max-width:\s*min\(62%,\s*36rem\);/);
  });

  it("keeps the approved expanded composition as the default and never distorts the artwork", () => {
    const base = rules.find(({ selector }) => selector === ".builder-page #builder-entry-header");
    expect(base.body).toMatch(/--intro-art-size:\s*auto 100%;/);
    expect(base.body).toMatch(/--intro-art-position:\s*right center;/);
    // The original readability mask is the default (collapsed overrides it, expanded never does).
    expect(base.body).toMatch(
      /--intro-mask:\s*linear-gradient\(\s*90deg,\s*rgba\(8, 7, 7, 0\.97\) 0%,\s*rgba\(8, 7, 7, 0\.95\) 40%,\s*rgba\(8, 7, 7, 0\.7\) 58%,\s*rgba\(8, 7, 7, 0\.28\) 78%,\s*rgba\(8, 7, 7, 0\.08\) 100%\s*\);/
    );
    // The art is only ever sized by its height: aspect ratio preserved, no stretching.
    const sizes = [...withoutComments.matchAll(/--intro-art-size:\s*([^;]+);/g)].map((match) => match[1].trim());
    expect(sizes.length).toBeGreaterThanOrEqual(3);
    sizes.forEach((size) => expect(size).toMatch(/^auto \d+%$/));
    expect(withoutComments).not.toMatch(/background-size:[^;]*(?:cover|contain|100% 100%)/);
  });

  it("clears the header's docked summary card with the collapsed art, and fades rather than cuts it", () => {
    const collapsed = rules.find(
      ({ selector }) => selector === ".builder-page:has(.layout--panel-collapsed) #builder-entry-header"
    );
    expect(collapsed.body).toMatch(/--intro-dock-clearance:\s*340px;/);
    expect(collapsed.body).toMatch(/--intro-art-position:\s*right var\(--intro-dock-clearance\) top;/);
    expect(collapsed.body).toMatch(/--intro-art-edge:/);
  });

  it("follows the Builder's own collapsed class (no duplicate state), widening the plate to the catalog track on desktop only", () => {
    const globals = read(APP_ROOT, "src", "app", "globals.css");
    const runtime = read(REPOSITORY_ROOT, "packages", "builder", "src", "BuilderRuntime.jsx");

    // The hook is the shared runtime's own class, and the intro component adds no state of its own for it.
    expect(runtime).toContain("layout--panel-collapsed");
    expect(read(APP_ROOT, "src", "components", "BuilderIntroHeader.jsx")).not.toMatch(/collapsed/i);

    const base = globals.search(/\n\s*#builder-entry-header\s*\{\s*width:\s*auto;/);
    const collapsed = globals.search(/\.builder-page:has\(\.layout--panel-collapsed\)\s+#builder-entry-header\s*\{/);
    expect(base).toBeGreaterThan(-1);
    // Later in the cascade than the expanded base rule, inside the same desktop media query.
    expect(collapsed).toBeGreaterThan(base);
    expect(globals.slice(base, collapsed)).not.toMatch(/@media/);
    expect(globals.slice(globals.lastIndexOf("@media", base), base)).toMatch(/^@media\s*\(min-width:\s*981px\)/);

    // Measured collapsed geometry: .app padding 12px; rail 20px + gap 16px = 48px on the right.
    const rule = globals.slice(collapsed).match(/\{([^}]*)\}/)[1];
    expect(rule).toMatch(/margin-left:\s*max\(12px,\s*calc\(50%\s*-\s*1088px\)\)/);
    expect(rule).toMatch(/margin-right:\s*max\(48px,\s*calc\(50%\s*-\s*1052px\)\)/);

    // The expanded base rule itself is untouched.
    const baseRule = globals.slice(base).match(/\{([^}]*)\}/)[1];
    expect(baseRule).toMatch(/margin-left:\s*max\(12px,\s*calc\(50%\s*-\s*708px\)\)/);
    expect(baseRule).toMatch(/margin-right:\s*max\(418px,\s*calc\(50%\s*-\s*302px\)\)/);
  });

  it("is absent from the shared Builder package and the Discovery Decants host", () => {
    const shared = read(REPOSITORY_ROOT, "packages", "builder", "styles.css");
    expect(shared).not.toMatch(/builder-intro\.css/);
    const layout = read(REPOSITORY_ROOT, "src", "main.jsx");
    expect(layout).not.toMatch(/builder-intro\.css|builder-zoning\.css/);
  });
});
