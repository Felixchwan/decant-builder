import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import HomePage from "./app/page.jsx";
import { HOW_IT_WORKS_STEPS, LandingHowItWorks } from "./components/LandingHowItWorks.jsx";
import { aurelianCatalog } from "./merchant/catalog.js";

const APP_ROOT = fileURLToPath(new URL("..", import.meta.url));
const REPOSITORY_ROOT = fileURLToPath(new URL("../../..", import.meta.url));
const read = (...segments) => readFileSync(join(...segments), "utf8");

const css = read(APP_ROOT, "src", "app", "landing-how-it-works.css");
const withoutComments = css.replace(/\/\*[\s\S]*?\*\//g, "");
const rules = [...withoutComments.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
  .map(([, selector, body]) => ({ selector: selector.trim(), body }))
  .filter(({ selector }) => !selector.startsWith("@"));
const selectors = rules.flatMap(({ selector }) => selector.split(",").map((part) => part.trim()));

const section = renderToStaticMarkup(<LandingHowItWorks />);
const homeMarkup = renderToStaticMarkup(<HomePage />);

const ART_DIR = join(APP_ROOT, "public", "media", "landing", "how-it-works");
const EXPECTED_ART = {
  explore: "how-it-works-explore.webp",
  build: "how-it-works-build.webp",
  discover: "how-it-works-discover.webp",
};

function sourceFiles(directory) {
  return readdirSync(directory).flatMap((entry) => {
    if (["node_modules", ".next", "dist"].includes(entry)) return [];
    const path = join(directory, entry);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.(?:[cm]?[jt]sx?|css)$/.test(entry) && !/\.test\.[cm]?[jt]sx?$/.test(entry) ? [path] : [];
  });
}

describe("landing 'Cómo funciona': three chapters of one ritual", () => {
  it("is exactly three semantic steps, in order: explore, build, discover", () => {
    expect(HOW_IT_WORKS_STEPS.map(({ key }) => key)).toEqual(["explore", "build", "discover"]);
    expect([...section.matchAll(/<li class="landing-how__chapter" data-step="([a-z]+)"/g)].map((match) => match[1])).toEqual(["explore", "build", "discover"]);
    expect(section.match(/<ol class="landing-how__chapters"/g)).toHaveLength(1);
    expect(section.match(/<li\b/g)).toHaveLength(3);
  });

  it("numbers the chapters 01, 02, 03 as quiet decorative markers", () => {
    expect([...section.matchAll(/<p aria-hidden="true" class="landing-how__number">(\d\d)<\/p>/g)].map((match) => match[1])).toEqual(["01", "02", "03"]);
  });

  it("keeps a clean heading hierarchy: one h2, then three h3 chapter titles", () => {
    expect(section.match(/<h2\b[^>]*>Cómo funciona<\/h2>/g)).toHaveLength(1);
    expect([...section.matchAll(/<h3>([^<]+)<\/h3>/g)].map((match) => match[1])).toEqual([
      "Explora sin comprometerte",
      "Construye tu selección",
      "Prueba, compara y decide",
    ]);
    expect(section).not.toMatch(/<h1|<h4|<h5|<h6/);
    expect(section).toContain("Tres pasos para construir criterio.");
  });

  it("says the three acts in the approved copy and keeps the approved product facts", () => {
    expect(section).toContain(`Conoce perfiles, notas y estilos de las ${aurelianCatalog.length} fragancias del catálogo, sin tener que decidirte por una botella completa.`);
    expect(section).toContain("Elige 6–14 fragancias, alcanza el mínimo de 12 puntos y arma una Discovery Box que tenga sentido para ti.");
    expect(section).toContain("Úsalas en tu rutina real y descubre cuáles merecen de verdad un lugar en tu colección.");
    expect(section).toContain("Aurelian revisa disponibilidad y después comparte las instrucciones de pago.");
  });

  it("introduces no promises, guarantees or exclusivity", () => {
    const text = section.replace(/<[^>]+>/g, " ");
    expect(text).not.toMatch(/envío|entrega|garant|gratis|exclusiv|limitad|sin costo|devoluci|reembols|oferta|descuento|stock|inventario/i);
  });

  it("offers one clear action, to the existing Builder route, and no competing links", () => {
    const links = [...section.matchAll(/<a\b[^>]*href="([^"]+)"[^>]*>([^<]*)<\/a>/g)];
    expect(links).toHaveLength(1);
    expect(links[0][1]).toBe("/build-your-box");
    expect(links[0][2]).toBe("Arma tu Discovery Box");
    expect(section).toMatch(/<a class="button" href="\/build-your-box">/);
  });

  it("keeps the meaning in text: the visuals are decorative, empty and never an image", () => {
    expect(section.match(/<div aria-hidden="true" class="landing-how__visual"><\/div>/g)).toHaveLength(3);
    expect(section).not.toMatch(/<img|<picture|<video|<svg|alt=/);
    expect(section).not.toMatch(/\.webp|how-it-works-/);
  });

  it("sits where it did: after the bias section and before the featured selection, with the approved sections intact", () => {
    const hero = homeMarkup.indexOf('class="aurelian-hero-stage"');
    const explain = homeMarkup.indexOf("Qué es una Discovery Box");
    const bias = homeMarkup.indexOf('class="section page-shell landing-bias"');
    const how = homeMarkup.indexOf('class="section section--surface landing-how"');
    const featured = homeMarkup.indexOf("Selección destacada");
    const boxStory = homeMarkup.indexOf("De 6 a 14 formas de explorar.");
    expect([hero, explain, bias, how, featured, boxStory].every((index) => index > -1)).toBe(true);
    expect(hero).toBeLessThan(explain);
    expect(explain).toBeLessThan(bias);
    expect(bias).toBeLessThan(how);
    expect(how).toBeLessThan(featured);
    expect(featured).toBeLessThan(boxStory);
    expect(homeMarkup.match(/Cómo funciona/g)).toHaveLength(1);
    // The sections around it are untouched.
    expect(homeMarkup).toContain("<h1>Descubre antes de elegir.</h1>");
    expect(homeMarkup).toContain("Nuestro sesgo declarado");
    expect(homeMarkup).toContain('class="featured-grid seasonal-featured"');
    expect(homeMarkup.match(/data-season="/g)).toHaveLength(4);
    expect(homeMarkup).toContain("Construye una colección que se sienta tuya.");
  });

  it("is the only thing the page imports for this section, with no inline copy left behind", () => {
    const page = read(APP_ROOT, "src", "app", "page.jsx");
    expect(page).toContain('import { LandingHowItWorks } from "../components/LandingHowItWorks.jsx";');
    expect(page).toContain("<LandingHowItWorks />");
    expect(page).not.toContain("De la curiosidad a una selección propia.");
    expect(page).not.toContain("steps--three");
  });
});

describe("landing 'Cómo funciona' presentation (host-owned, decorative, semantic)", () => {
  it("keys every rule on the section's own classes", () => {
    expect(selectors.length).toBeGreaterThan(10);
    selectors.forEach((selector) => expect(selector, selector).toMatch(/^\.landing-how/));
    expect(withoutComments).not.toContain("!important");
  });

  it("alternates by the step's semantic key, never by position", () => {
    expect(withoutComments).not.toMatch(/nth-child|nth-of-type|first-child|last-child|:has\(|:nth-/);
    const mirrored = selectors.filter((selector) => selector.includes('data-step="build"') && !selector.includes("--how"));
    expect(mirrored.length).toBeGreaterThan(0);
    // Only the Build chapter mirrors; explore and discover use the default composition.
    expect(withoutComments).not.toMatch(/data-step="(?:explore|discover)"[^{]*\{[^}]*grid-column/);
    // Presentation, not reading order: the copy comes first in the DOM for every chapter.
    for (const [chapter] of section.matchAll(/<li class="landing-how__chapter"[\s\S]*?<\/li>/g)) {
      expect(chapter.indexOf("landing-how__copy")).toBeLessThan(chapter.indexOf("landing-how__visual"));
    }
  });

  it("stacks narrow screens in one reading sequence", () => {
    const narrow = withoutComments.slice(withoutComments.indexOf("@media (max-width: 900px)"));
    expect(narrow).toMatch(/grid-template-columns:\s*minmax\(0,\s*1fr\)/);
    expect(narrow).toMatch(/\[data-step="build"\] \.landing-how__copy[\s\S]*grid-column:\s*1;[\s\S]*grid-row:\s*auto/);
    expect(narrow).toMatch(/\[data-step="build"\] \.landing-how__visual/);
  });

  it("is quiet: no card shells, heavy borders, filters, blur, motion or fixed art", () => {
    expect(withoutComments).not.toMatch(/(?:^|[;\s{])(?:backdrop-)?filter\s*:|blur\(|transform|animation|@keyframes|transition|translate|parallax|background-attachment|position:\s*fixed/);
    const border = [...withoutComments.matchAll(/border(?:-(?:top|right|bottom|left))?:\s*(\d+)px/g)].map((match) => Number(match[1]));
    border.forEach((width) => expect(width).toBeLessThanOrEqual(1));
    const chapter = rules.find(({ selector }) => selector === ".landing-how__chapter");
    expect(chapter.body).not.toMatch(/border|background|box-shadow|padding/);
    const frame = rules.find(({ selector }) => selector === ".landing-how__visual");
    expect(frame.body).toMatch(/border-radius:\s*10px;/);
  });

  it("maps each semantic step to one Aurelian-owned artwork slot, with a dark fallback underneath", () => {
    const urls = [...withoutComments.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/g)].map((match) => match[1]);
    expect(urls.sort()).toEqual(Object.values(EXPECTED_ART).map((file) => `/media/landing/how-it-works/${file}`).sort());
    for (const [key, file] of Object.entries(EXPECTED_ART)) {
      const rule = rules.find(({ selector, body }) => selector === `.landing-how__chapter[data-step="${key}"] .landing-how__visual` && body.includes("--how-art"));
      expect(rule.body).toContain(`/media/landing/how-it-works/${file}`);
      expect(rule.body).toContain("--how-tint:");
    }
    const frame = rules.find(({ selector }) => selector === ".landing-how__visual");
    expect(frame.body).toMatch(/var\(--how-art\)[^,]*,\s*var\(--how-tint\),\s*#0b0a09/);
  });

  it("ships exactly the three artwork files: light WebP, 5:4, mapped by semantic step key", () => {
    expect(existsSync(ART_DIR)).toBe(true);
    const present = readdirSync(ART_DIR).filter((file) => /\.webp$/i.test(file));
    expect(present.sort()).toEqual(Object.values(EXPECTED_ART).sort());
    for (const [key, file] of Object.entries(EXPECTED_ART)) {
      // The file name carries the semantic step key, the stylesheet maps that key to the file.
      expect(file).toBe(`how-it-works-${key}.webp`);
      expect(HOW_IT_WORKS_STEPS.some((step) => step.key === key)).toBe(true);
    }
    let total = 0;
    present.forEach((file) => {
      const bytes = readFileSync(join(ART_DIR, file));
      total += bytes.length;
      expect(bytes.subarray(0, 4).toString("ascii"), file).toBe("RIFF");
      expect(bytes.subarray(8, 12).toString("ascii"), file).toBe("WEBP");
      expect(bytes.length, file).toBeLessThan(180 * 1024);
      const chunk = bytes.subarray(12, 16).toString("ascii");
      const width = chunk === "VP8X" ? 1 + bytes.readUIntLE(24, 3) : chunk === "VP8 " ? bytes.readUInt16LE(26) & 0x3fff : null;
      const height = chunk === "VP8X" ? 1 + bytes.readUIntLE(27, 3) : chunk === "VP8 " ? bytes.readUInt16LE(28) & 0x3fff : null;
      expect(width && height, `${file} dimensions`).toBeTruthy();
      expect(width / height, file).toBeGreaterThan(1.2);
      expect(width / height, file).toBeLessThan(1.3);
      expect(width, file).toBeLessThanOrEqual(1600);
    });
    expect(total).toBeLessThan(540 * 1024);
  });

  it("is loaded by Aurelian's own layout, after the other landing styles", () => {
    const layout = read(APP_ROOT, "src", "app", "layout.jsx");
    expect(layout.indexOf('import "./landing-how-it-works.css";')).toBeGreaterThan(layout.indexOf('import "./catalog-seasons.css";'));
    expect(layout.indexOf('import "./landing-how-it-works.css";')).toBeGreaterThan(layout.indexOf('import "./landing-video.css";'));
  });

  it("leaves the generic steps styles other pages rely on exactly as they were", () => {
    const globals = read(APP_ROOT, "src", "app", "globals.css");
    expect(globals).toMatch(/\.steps\s*\{\s*display:grid;\s*grid-template-columns:repeat\(4,1fr\)/);
    expect(globals).toMatch(/\.steps--three\s*\{\s*grid-template-columns:repeat\(3,1fr\)/);
    expect(globals).toMatch(/\.section--surface\s*\{\s*width:100%;/);
  });
});

describe("boundaries: Builder, shared packages and Discovery Decants never see the section", () => {
  it("keeps it out of the Builder, the catalog page and the other landing sections", () => {
    const trace = /landing-how|LandingHowItWorks|HOW_IT_WORKS_STEPS|how-it-works-/;
    for (const file of ["BuilderExperience.jsx", "BuilderMount.jsx", "BuilderIntroHeader.jsx", "CatalogExplorer.jsx", "CatalogPageView.jsx", "SeasonalFeaturedSelection.jsx", "LandingVideo.jsx", "HeroMedia.jsx"]) {
      expect(read(APP_ROOT, "src", "components", file), file).not.toMatch(trace);
    }
    for (const file of ["landing-hero.css", "landing-video.css", "landing-seasons.css", "catalog-seasons.css", "builder-zoning.css", "builder-intro.css", "builder-geometry.css", "builder-header.css"]) {
      expect(read(APP_ROOT, "src", "app", file), file).not.toMatch(trace);
    }
    expect(read(APP_ROOT, "src", "app", "catalogo", "page.jsx")).not.toMatch(trace);
    expect(read(APP_ROOT, "src", "app", "build-your-box", "page.jsx")).not.toMatch(trace);
  });

  it("leaves no trace of it in the shared packages or the Discovery Decants host", () => {
    const trace = /landing-how|LandingHowItWorks|HOW_IT_WORKS_STEPS|how-it-works/;
    const files = [
      ...sourceFiles(join(REPOSITORY_ROOT, "packages", "builder", "src")),
      join(REPOSITORY_ROOT, "packages", "builder", "styles.css"),
      ...sourceFiles(join(REPOSITORY_ROOT, "packages", "catalog", "src")),
      ...sourceFiles(join(REPOSITORY_ROOT, "src")),
    ];
    files.forEach((file) => expect(read(file), file).not.toMatch(trace));
  });
});
