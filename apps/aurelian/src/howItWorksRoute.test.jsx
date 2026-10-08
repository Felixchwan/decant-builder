import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import HomePage from "./app/page.jsx";
import HowItWorksPage, { metadata } from "./app/como-funciona/page.jsx";
import sitemap from "./app/sitemap.js";
import { HOW_IT_WORKS_STEPS } from "./components/LandingHowItWorks.jsx";
import { LandingHowItWorksTeaser } from "./components/LandingHowItWorksTeaser.jsx";
import { aurelianCatalog } from "./merchant/catalog.js";
import { aurelianConfig } from "./merchant/config.js";

const APP_ROOT = fileURLToPath(new URL("..", import.meta.url));
const REPOSITORY_ROOT = fileURLToPath(new URL("../../..", import.meta.url));
const read = (...segments) => readFileSync(join(...segments), "utf8");

const route = renderToStaticMarkup(<HowItWorksPage />);
const home = renderToStaticMarkup(<HomePage />);
const teaser = renderToStaticMarkup(<LandingHowItWorksTeaser />);
const actsSection = route.slice(route.indexOf('<section class="section section--surface landing-how"'), route.indexOf('<section class="section page-shell landing-how-details"'));
const details = route.slice(route.indexOf('<section class="section page-shell landing-how-details"'));

function sourceFiles(directory) {
  return readdirSync(directory).flatMap((entry) => {
    if (["node_modules", ".next", "dist"].includes(entry)) return [];
    const path = join(directory, entry);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.(?:[cm]?[jt]sx?|css)$/.test(entry) && !/\.test\.[cm]?[jt]sx?$/.test(entry) ? [path] : [];
  });
}

describe("/como-funciona: the dedicated destination", () => {
  it("is a real Aurelian route with its canonical metadata and a sitemap entry", () => {
    expect(existsSync(join(APP_ROOT, "src", "app", "como-funciona", "page.jsx"))).toBe(true);
    expect(metadata.alternates.canonical).toBe("/como-funciona");
    expect(metadata.title).toBeTruthy();
    expect(sitemap().map(({ url }) => url)).toContain("https://aurelianperfumes.com/como-funciona");
  });

  it("opens with the approved three acts, in order, under the page's one h1", () => {
    expect(actsSection.length).toBeGreaterThan(0);
    expect(route.match(/<h1\b/g)).toHaveLength(1);
    expect(route.match(/<h1\b[^>]*>Cómo funciona<\/h1>/g)).toHaveLength(1);
    expect(route).toContain("Tres pasos para construir criterio.");
    expect([...actsSection.matchAll(/<li class="landing-how__chapter" data-step="([a-z]+)"/g)].map((match) => match[1])).toEqual(["explore", "build", "discover"]);
    expect(HOW_IT_WORKS_STEPS.map(({ key }) => key)).toEqual(["explore", "build", "discover"]);
    expect([...actsSection.matchAll(/<h2>([^<]+)<\/h2>/g)].map((match) => match[1])).toEqual([
      "Explora sin comprometerte",
      "Construye tu selección",
      "Prueba, compara y decide",
    ]);
    expect(actsSection.match(/<ol class="landing-how__chapters"/g)).toHaveLength(1);
    expect([...actsSection.matchAll(/class="landing-how__number">(\d\d)</g)].map((match) => match[1])).toEqual(["01", "02", "03"]);
  });

  it("keeps a clean outline: one h1; h2 for the acts, the operational section and the Curator Bonus; h3 only for the five steps", () => {
    expect(route).not.toMatch(/<h4|<h5|<h6/);
    expect([...route.matchAll(/<h([123])\b/g)].map((match) => Number(match[1]))).toEqual([1, 2, 2, 2, 2, 3, 3, 3, 3, 3, 2]);
    expect(details.match(/<h3>/g)).toHaveLength(5);
    expect(actsSection).not.toContain("<h3");
  });

  it("ends the three acts with the one approved CTA to the Builder, and the availability note", () => {
    const links = [...actsSection.matchAll(/<a\b[^>]*href="([^"]+)"[^>]*>([^<]*)<\/a>/g)];
    expect(links).toHaveLength(1);
    expect(links[0][1]).toBe("/build-your-box");
    expect(links[0][2]).toBe("Arma tu Discovery Box");
    expect(actsSection).toContain("Aurelian revisa disponibilidad y después comparte las instrucciones de pago.");
    // One Builder call to action on the page, not a second competing one further down.
    expect(route.match(/href="\/build-your-box"/g)).toHaveLength(1);
  });

  it("keeps the artwork decorative: no <img> and no art in markup", () => {
    expect(route).not.toMatch(/<img|<picture|<video|\.webp/);
    expect(route.match(/<div aria-hidden="true" class="landing-how__visual"><\/div>/g)).toHaveLength(3);
    // The Curator Bonus has its own decorative visual, after its copy.
    expect(route.match(/<div aria-hidden="true" class="landing-how__visual" data-art="curator"><\/div>/g)).toHaveLength(1);
    const bonus = route.slice(route.indexOf('<aside class="landing-how-bonus">'));
    expect(bonus.indexOf("landing-how-bonus__copy")).toBeLessThan(bonus.indexOf("landing-how__visual"));
    expect(bonus).toContain("Dos espacios para ampliar el descubrimiento.");
  });

  it("keeps the complete ordering details and the Curator Bonus rules, below the three acts", () => {
    expect(route.indexOf("landing-how-details")).toBeGreaterThan(route.indexOf("landing-how__cta"));
    expect(details).toContain('<h2 class="landing-how-details__heading">Cómo se procesa tu pedido</h2>');
    expect(route).not.toContain("Proceso completo");
    expect(details).toContain("Una Discovery Box reúne distintas experiencias olfativas para ayudarte a conocer perfumes antes de decidir qué merece un lugar mayor en tu colección, y, con el tiempo, a desarrollar tu propio criterio.");
    for (const title of ["Explora el catálogo", `Selecciona ${aurelianConfig.box.minSelectableSlots}–${aurelianConfig.box.maxSelectableSlots} fragancias`, "Comparte tus datos al finalizar", "Revisamos disponibilidad", "Recibe las instrucciones de pago"]) {
      expect(details).toContain(`<h3>${title}</h3>`);
    }
    expect(details).toContain(`puntos de las ${aurelianCatalog.length} fragancias`);
    expect(details).toContain(`hasta alcanzar al menos ${aurelianConfig.box.minPoints} puntos. Los puntos equilibran la composición de la caja; no son el precio de una botella.`);
    expect(details).toContain("Nuestro objetivo no es solo entregarte fragancias, sino ayudarte a comparar cada vez con más criterio.");
    expect(details).toContain("Dos espacios para ampliar el descubrimiento.");
    expect(details).toContain("Las opciones dependen de disponibilidad.");
    expect(details).toContain(`capacidad física de ${aurelianConfig.box.totalPhysicalSlots} espacios`);
    expect(details).toContain(`Al alcanzar ${aurelianConfig.curatorBonus.targetPoints} puntos`);
    expect(details).toContain("solicitarás por WhatsApp una revisión de disponibilidad");
    expect(details).toContain("Aurelian revisa manualmente tu selección.");
    expect(details).toContain("no una promesa de inventario inmediato");
    expect(details).toContain("Solo después de confirmar disponibilidad compartiremos cómo continuar.");
    expect(details).toContain("Monterrey y su área metropolitana");
    expect(details).toContain("Curator Bonus");
    expect(details).toContain(`${aurelianConfig.box.bonusSlotCount} espacios Curator Bonus`);
  });
});

describe("the operational process: one page, one hand", () => {
  const css = read(APP_ROOT, "src", "app", "landing-how-it-works.css").replace(/\/\*[\s\S]*?\*\//g, "");
  const ruleBody = (selector) => {
    const rule = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].find(([, sel]) => sel.trim() === selector);
    return rule ? rule[2] : null;
  };

  it("is an ordered list of five steps in order, keyed by semantic step, with decorative numbers", () => {
    expect(details.match(/<ol class="landing-how-process" role="list">/g)).toHaveLength(1);
    expect([...details.matchAll(/<li class="landing-how-process__step" data-step="([a-z]+)"/g)].map((match) => match[1])).toEqual(["catalog", "selection", "request", "review", "payment"]);
    expect([...details.matchAll(/<p aria-hidden="true" class="landing-how-process__number">(\d\d)<\/p>/g)].map((match) => match[1])).toEqual(["01", "02", "03", "04", "05"]);
    // The old single-column list is gone.
    expect(route).not.toContain("process-list");
  });

  it("keeps the reading order 01 to 05 with the closing line and Curator Bonus last", () => {
    const at = (needle) => details.indexOf(needle);
    const sequence = ["Cómo se procesa tu pedido", 'data-step="catalog"', 'data-step="selection"', 'data-step="request"', 'data-step="review"', 'data-step="payment"', "landing-how-details__closing", "landing-how-bonus"].map(at);
    expect(sequence.every((index) => index > -1)).toBe(true);
    expect([...sequence].sort((a, b) => a - b)).toEqual(sequence);
  });

  it("uses the width by composition: two columns, the last step across both, never by visual reordering", () => {
    expect(ruleBody(".landing-how-process")).toMatch(/grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/);
    expect(ruleBody('.landing-how-process__step[data-step="payment"]')).toMatch(/grid-column:\s*1 \/ -1/);
    expect(css).not.toMatch(/(?:^|[;\s{])order\s*:/);
    expect(css).not.toMatch(/flex-direction:\s*(?:row|column)-reverse|direction:\s*rtl/);
    // One reading column on narrow screens.
    const narrow = css.slice(css.indexOf("@media (max-width: 900px)"), css.indexOf("@media (max-width: 720px)"));
    expect(narrow).toMatch(/\.landing-how-process\s*\{\s*grid-template-columns:\s*minmax\(0,\s*1fr\)/);
  });

  it("stays editorial: hairlines and numbers, no card shells, shadows, rounded boxes or icons", () => {
    for (const selector of [".landing-how-process", ".landing-how-process__step", ".landing-how-details__closing", ".landing-how__cta"]) {
      expect(ruleBody(selector), selector).not.toMatch(/background|box-shadow|border-radius/);
    }
    expect(ruleBody(".landing-how-process__step")).toMatch(/border-top:\s*1px solid/);
    expect(route).not.toMatch(/<svg|<img|<i\b|icon/i);
  });

  it("closes the three acts with a compact, centred call to action: button first, the availability line directly beneath, no band", () => {
    const cta = ruleBody(".landing-how__cta");
    expect(cta).toMatch(/flex-direction:\s*column/);
    expect(cta).toMatch(/align-items:\s*center/);
    expect(cta).toMatch(/text-align:\s*center/);
    expect(cta).not.toMatch(/border|background|padding/);
    expect(actsSection.indexOf("Arma tu Discovery Box")).toBeLessThan(actsSection.indexOf("Aurelian revisa disponibilidad"));
    // It lives inside the three-act section, not in a section of its own.
    expect(actsSection).toContain("landing-how__cta");
    expect(route.match(/landing-how__cta/g)).toHaveLength(1);
  });

  it("opens with a centred, compact page title", () => {
    expect(ruleBody(".landing-how__intro")).toMatch(/text-align:\s*center/);
    expect(ruleBody(".landing-how__intro :is(h1, h2)")).toMatch(/margin:\s*0 auto/);
  });

  it("centres the operational intro like the page title, while the five-step grid stays structured", () => {
    expect(ruleBody(".landing-how-details__intro")).toMatch(/text-align:\s*center/);
    expect(ruleBody(".landing-how-details__heading")).toMatch(/margin:\s*0 auto/);
    expect(ruleBody(".landing-how-details__intro > p")).toMatch(/margin:\s*0 auto/);
    // Only the intro is centred: the step grid and its cells are not.
    expect(ruleBody(".landing-how-process")).not.toMatch(/text-align/);
    expect(ruleBody(".landing-how-process__step")).not.toMatch(/text-align/);
  });

  it("frames the artwork by CSS cropping alone, with one shared position and no per-image transforms", () => {
    const frame = ruleBody(".landing-how__visual");
    expect(frame).toMatch(/center \/ cover no-repeat/);
    expect(css).not.toMatch(/transform|scale\(|object-position/);
    expect(css).not.toMatch(/\.landing-how__chapter\[data-step="[a-z]+"\] \.landing-how__visual\s*\{[^}]*background-(?:position|size)/);
  });
});

describe("navigation points at the route, not at a Home anchor", () => {
  it("links 'Cómo funciona' to /como-funciona in the header, mobile menu and footer", () => {
    const header = read(APP_ROOT, "src", "components", "SiteHeader.jsx");
    expect(header).toContain('["/como-funciona", "Cómo funciona"]');
    // One list feeds both the desktop and the mobile menu, with the existing active-route treatment.
    expect(header.match(/links\.map/g)).toHaveLength(2);
    expect(header).toContain('aria-current={isCurrent(href) ? "page" : undefined}');
    expect(read(APP_ROOT, "src", "components", "SiteFooter.jsx")).toContain('<Link href="/como-funciona">Cómo funciona</Link>');
  });

  it("leaves no Home anchor or hash link for it anywhere in the app", () => {
    expect(home).not.toMatch(/id="como-funciona"|id="how-it-works"|href="\/?#como-funciona"|href="#/);
    for (const file of sourceFiles(join(APP_ROOT, "src"))) {
      expect(read(file), file).not.toMatch(/#como-funciona|#how-it-works|\/#como/);
    }
  });
});

describe("Home keeps one compact teaser", () => {
  it("renders exactly one 'Cómo funciona' teaser, with one way in, to /como-funciona", () => {
    expect(home.match(/landing-how-teaser"/g)).toHaveLength(1);
    expect(home.match(/Cómo funciona/g)).toHaveLength(1);
    expect(teaser).toContain('<p class="eyebrow">Cómo funciona</p>');
    expect(teaser).toContain("<h2>Tres pasos para descubrir mejor.</h2>");
    expect(teaser).toContain("Explora sin comprometerte, arma tu selección y decide con criterio.");
    const links = [...teaser.matchAll(/<a\b[^>]*href="([^"]+)"[^>]*>([^<]*)<\/a>/g)];
    expect(links).toHaveLength(1);
    expect(links[0][1]).toBe("/como-funciona");
    expect(links[0][2]).toBe("Conoce el proceso");
    expect(home.match(/<h1\b/g)).toHaveLength(1);
  });

  it("is materially smaller than the experience it points to: no steps, no artwork, no Builder CTA", () => {
    expect(teaser).not.toMatch(/<img|<picture|<video|<svg|<ol|<li|\.webp|landing-how__|data-step/);
    expect(teaser).not.toContain("/build-your-box");
    for (const { title } of HOW_IT_WORKS_STEPS) {
      expect(teaser).not.toContain(`<h2>${title}</h2>`);
      expect(teaser).not.toContain(`<h3>${title}</h3>`);
    }
    const text = (markup) => markup.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    expect(text(teaser).length).toBeLessThan(text(actsSection).length / 3);
  });

  it("sits between the bias section and the featured selection", () => {
    expect(home.indexOf("landing-bias")).toBeLessThan(home.indexOf("landing-how-teaser"));
    expect(home.indexOf("landing-how-teaser")).toBeLessThan(home.indexOf("Selección destacada"));
    // The only way into the full process from Home is the teaser's one link.
    expect([...home.matchAll(/href="\/como-funciona"/g)]).toHaveLength(1);
  });
});

describe("boundaries", () => {
  it("keeps the route out of the Builder, the catalog and the other landing sections", () => {
    const trace = /LandingHowItWorks|landing-how|HOW_IT_WORKS_STEPS/;
    for (const file of ["BuilderExperience.jsx", "BuilderMount.jsx", "CatalogExplorer.jsx", "CatalogPageView.jsx", "SeasonalFeaturedSelection.jsx", "LandingVideo.jsx", "HeroMedia.jsx", "SiteHeader.jsx", "SiteFooter.jsx"]) {
      expect(read(APP_ROOT, "src", "components", file), file).not.toMatch(trace);
    }
    expect(read(APP_ROOT, "src", "app", "catalogo", "page.jsx")).not.toMatch(trace);
    expect(read(APP_ROOT, "src", "app", "build-your-box", "page.jsx")).not.toMatch(trace);
    expect(read(APP_ROOT, "src", "app", "contacto", "page.jsx")).not.toMatch(trace);
  });

  it("leaves no trace in the shared packages or the Discovery Decants host", () => {
    const trace = /LandingHowItWorks|landing-how|HOW_IT_WORKS_STEPS|how-it-works|como-funciona/;
    const files = [
      ...sourceFiles(join(REPOSITORY_ROOT, "packages", "builder", "src")),
      join(REPOSITORY_ROOT, "packages", "builder", "styles.css"),
      ...sourceFiles(join(REPOSITORY_ROOT, "packages", "catalog", "src")),
      ...sourceFiles(join(REPOSITORY_ROOT, "src")),
    ];
    files.forEach((file) => expect(read(file), file).not.toMatch(trace));
  });
});
