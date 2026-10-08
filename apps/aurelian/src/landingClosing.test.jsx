import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import HomePage from "./app/page.jsx";
import { SocialFollow } from "./components/SocialFollow.jsx";
import { AURELIAN_SOCIAL_LINKS } from "./lib/socialLinks.js";

const APP_ROOT = fileURLToPath(new URL("..", import.meta.url));
const REPOSITORY_ROOT = fileURLToPath(new URL("../../..", import.meta.url));
const read = (...segments) => readFileSync(join(...segments), "utf8");

const home = renderToStaticMarkup(<HomePage />);
const follow = renderToStaticMarkup(<SocialFollow />);
const closing = home.slice(home.indexOf('<section class="final-cta page-shell"'));
const css = read(APP_ROOT, "src", "app", "landing-closing.css").replace(/\/\*[\s\S]*?\*\//g, "");

function sourceFiles(directory) {
  return readdirSync(directory).flatMap((entry) => {
    if (["node_modules", ".next", "dist"].includes(entry)) return [];
    const path = join(directory, entry);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.(?:[cm]?[jt]sx?|css)$/.test(entry) && !/\.test\.[cm]?[jt]sx?$/.test(entry) ? [path] : [];
  });
}

describe("Home ending", () => {
  it("no longer carries the 'De 6 a 14 formas' block or the 'Servicio inicial' band", () => {
    for (const text of ["De 6 a 14 formas de explorar.", "Servicio inicial", "Monterrey y área metropolitana", "Entender puntos y Curator Bonus", "box-story", "service-band", "16 espacios físicos"]) {
      expect(home, text).not.toContain(text);
    }
    expect(home).not.toContain("La disponibilidad se confirma personalmente antes de compartir instrucciones de pago.");
    const page = read(APP_ROOT, "src", "app", "page.jsx");
    expect(page).not.toMatch(/box-story|service-band|Servicio inicial/);
  });

  it("ends with the final CTA, exactly as it was, and nothing after it but the footer", () => {
    expect(home.match(/<section class="final-cta page-shell"/g)).toHaveLength(1);
    expect(closing).toContain('<p class="eyebrow">Tu siguiente descubrimiento</p>');
    expect(closing).toContain("<h2>Construye una colección que se sienta tuya.</h2>");
    expect(closing).toContain("No hay una fragancia perfecta ni una lista de más vendidos que seguir: solo la que tú decidas que es tuya. Elige 6–14 fragancias. Revisaremos disponibilidad antes de continuar con el pago.");
    expect(closing).toMatch(/<a class="button" href="\/build-your-box">Construye tu Discovery Box<\/a>/);
    expect(closing.match(/<section\b/g)).toHaveLength(1);
    expect(closing.trim().endsWith("</section>")).toBe(true);
    // The featured selection still comes right before the closing.
    expect(home.indexOf("Selección destacada")).toBeLessThan(home.indexOf("Tu siguiente descubrimiento"));
  });

  it("keeps one Builder call to action in the closing, with the follow cluster after it", () => {
    expect(closing.match(/href="\/build-your-box"/g)).toHaveLength(1);
    expect(closing.indexOf("Construye tu Discovery Box")).toBeLessThan(closing.indexOf("Síguenos en"));
    expect(closing).toContain('<div class="landing-closing__foot">');
  });
});

describe("the follow cluster", () => {
  it("says 'Síguenos en', then two accessible, external links: Facebook and Instagram", () => {
    expect(follow).toContain('<nav aria-label="Redes sociales de Aurelian" class="landing-follow">');
    expect(follow).toContain('<span class="landing-follow__label">Síguenos en</span>');
    const links = [...follow.matchAll(/<a [^>]*aria-label="([^"]+)"[^>]*href="([^"]+)"[^>]*>/g)];
    expect(links.map((match) => match[1])).toEqual(["Aurelian en Facebook (se abre en una pestaña nueva)", "Aurelian en Instagram (se abre en una pestaña nueva)"]);
    expect(links.map((match) => match[2])).toEqual(AURELIAN_SOCIAL_LINKS.map(({ href }) => href));
    expect(follow.match(/target="_blank"/g)).toHaveLength(2);
    expect(follow.match(/rel="noopener noreferrer"/g)).toHaveLength(2);
    expect(follow.match(/<svg aria-hidden="true" focusable="false"/g)).toHaveLength(2);
    expect(follow).not.toMatch(/<img|<h[1-6]/);
  });

  it("points at Aurelian's accounts over https, with no tracking or share-session parameters", () => {
    expect(AURELIAN_SOCIAL_LINKS.map(({ key }) => key)).toEqual(["facebook", "instagram"]);
    const [facebook, instagram] = AURELIAN_SOCIAL_LINKS.map(({ href }) => new URL(href));
    expect(facebook.protocol).toBe("https:");
    expect(facebook.hostname).toBe("www.facebook.com");
    expect(instagram.protocol).toBe("https:");
    expect(instagram.hostname).toBe("www.instagram.com");
    expect(instagram.pathname.replace(/\//g, "")).toBe("aurelianperfumes");
    for (const { href } of AURELIAN_SOCIAL_LINKS) {
      expect(new URL(href).search, href).toBe("");
      expect(href).not.toMatch(/stkn|utm_|fbclid|igshid/i);
    }
  });

  it("is a quiet closing detail: bottom-right on wide screens, stacked and centred on narrow ones, no band or card", () => {
    const body = (selector) => [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].find(([, sel]) => sel.trim() === selector)?.[2];
    expect(body(".landing-closing__foot")).toMatch(/grid-template-columns:\s*minmax\(0,\s*1fr\)\s*auto\s*minmax\(0,\s*1fr\)/);
    expect(body(".landing-follow")).toMatch(/justify-content:\s*flex-end/);
    expect(body(".landing-follow")).not.toMatch(/background|box-shadow|border/);
    expect(body(".landing-follow__link")).toMatch(/border-radius:\s*8px/);
    expect(css).toContain("@media (max-width: 720px)");
    expect(css).not.toMatch(/!important|transform|animation|@keyframes|position:\s*(?:absolute|fixed)/);
    expect(css.match(/(?:^|\n)\s*([^{}@\n]+)\s*\{/g).map((rule) => rule.replace(/[{\n]/g, "").trim()).every((selector) => /^\.landing-(?:closing|follow)/.test(selector))).toBe(true);
  });

  it("is host-owned: never in the shared packages, the Builder or Discovery Decants", () => {
    const trace = /SocialFollow|landing-follow|landing-closing|socialLinks|AURELIAN_SOCIAL_LINKS|aurelianperfumes|19g6gNspA3/;
    const files = [
      ...sourceFiles(join(REPOSITORY_ROOT, "packages", "builder", "src")),
      join(REPOSITORY_ROOT, "packages", "builder", "styles.css"),
      ...sourceFiles(join(REPOSITORY_ROOT, "packages", "catalog", "src")),
      ...sourceFiles(join(REPOSITORY_ROOT, "src")),
    ];
    files.forEach((file) => expect(read(file), file).not.toMatch(trace));
    for (const file of ["BuilderExperience.jsx", "CatalogExplorer.jsx", "SeasonalFeaturedSelection.jsx", "LandingVideo.jsx", "LandingHowItWorksTeaser.jsx"]) {
      expect(read(APP_ROOT, "src", "components", file), file).not.toMatch(trace);
    }
    expect(read(APP_ROOT, "src", "merchant", "config.js")).not.toMatch(trace);
    const layout = read(APP_ROOT, "src", "app", "layout.jsx");
    expect(layout.indexOf('import "./landing-closing.css";')).toBeGreaterThan(layout.indexOf('import "./landing-how-it-works.css";'));
  });
});
