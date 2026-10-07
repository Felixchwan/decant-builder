import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import HomePage from "./app/page.jsx";
import { HERO_MEDIA_SEQUENCE, HeroMedia } from "./components/HeroMedia.jsx";
import { LandingVideo, LANDING_VIDEO_VISIBLE_RATIO } from "./components/LandingVideo.jsx";
import { LANDING_VIDEO_POSTER, LANDING_VIDEO_SRC } from "./lib/landingMedia.js";

const APP_ROOT = fileURLToPath(new URL("..", import.meta.url));
const REPOSITORY_ROOT = fileURLToPath(new URL("../../..", import.meta.url));
const read = (...segments) => readFileSync(join(...segments), "utf8");

const css = read(APP_ROOT, "src", "app", "landing-video.css");
const withoutComments = css.replace(/\/\*[\s\S]*?\*\//g, "");
const rules = [...withoutComments.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
  .map(([, selector, body]) => ({ selector: selector.trim(), body }))
  .filter(({ selector }) => !selector.startsWith("@"));
const selectors = rules.flatMap(({ selector }) => selector.split(",").map((part) => part.trim()));

describe("Aurelian landing video section (lazy, editorial, landing-owned)", () => {
  it("lives once: one shared path, one file on disk, never loaded by the page's server markup", () => {
    expect(LANDING_VIDEO_SRC).toBe("/media/torino-21.mp4");
    // HeroMedia (kept, tested, no longer rendered on the landing) reads the very same constant.
    expect(HERO_MEDIA_SEQUENCE.map(({ src }) => src)).toEqual([LANDING_VIDEO_SRC]);
    expect(read(APP_ROOT, "src", "components", "HeroMedia.jsx")).toContain("LANDING_VIDEO_SRC");

    const mp4s = readdirSync(join(APP_ROOT, "public", "media"), { recursive: true }).filter((file) => /\.mp4$/i.test(String(file)));
    expect(mp4s.map(String)).toEqual(["torino-21.mp4"]);
    expect(read(APP_ROOT, "src", "app", "page.jsx")).not.toContain("torino-21");
  });

  it("lives inside the 'Nuestro sesgo declarado' section: no standalone video section, never in the hero", () => {
    const markup = renderToStaticMarkup(<HomePage />);
    const hero = markup.indexOf('class="aurelian-hero-stage"');
    const explain = markup.indexOf("Qué es una Discovery Box");
    const bias = markup.indexOf('class="section page-shell landing-bias"');
    const steps = markup.indexOf("Cómo funciona");
    expect(hero).toBeGreaterThan(-1);
    expect(hero).toBeLessThan(explain);
    expect(explain).toBeLessThan(bias);
    expect(bias).toBeLessThan(steps);

    // The standalone section (and its redundant headline) is gone for good.
    expect(markup).not.toContain("landing-video-section");
    expect(markup).not.toContain("El ritual empieza antes de la botella.");
    expect(markup).not.toContain("Discovery experience");
    expect(markup.match(/<section[^>]*>/g).filter((tag) => /video/.test(tag))).toEqual([]);

    // The one video is rendered inside the bias section, after its copy (the right-hand column on desktop).
    const biasSection = markup.slice(bias, markup.indexOf("</section>", bias));
    expect(biasSection).toContain("Nuestro sesgo declarado");
    expect((biasSection.match(/<video/g) ?? []).length).toBe(1);
    expect(biasSection.indexOf("landing-bias__copy")).toBeLessThan(biasSection.indexOf('class="landing-video"'));
    expect((markup.match(/<video/g) ?? []).length).toBe(1);

    const heroMarkup = markup.slice(hero, markup.indexOf("</section></div>", hero));
    expect(heroMarkup).not.toMatch(/<video|landing-video|hero-media/);
    expect(heroMarkup).toContain("<h1>Descubre antes de elegir.</h1>");
  });

  it("preserves the approved bias copy verbatim, with no invented claims", () => {
    const markup = renderToStaticMarkup(<HomePage />);
    const section = markup.slice(markup.indexOf('class="section page-shell landing-bias"'), markup.indexOf("</section>", markup.indexOf('class="section page-shell landing-bias"')));
    expect(section).toContain('<p class="eyebrow">Nuestro sesgo declarado</p>');
    expect(section).toContain(
      '<h2 class="display-heading">No estamos aquí para vender más. Estamos aquí para ayudarte a distinguir lo que de verdad es tuyo.</h2>'
    );
    expect(section).toContain(
      '<p class="section-lede">No priorizamos por margen ni por lo que más se vende. Priorizamos ayudarte a construir tu propio criterio — aunque eso signifique que, con el tiempo, compres menos.</p>'
    );
    // Only the existing, quiet caption accompanies the video.
    expect(section).toContain("Una mirada breve al universo de la perfumería.");
    expect(section).not.toMatch(/env[ií]o|garant[ií]a|gratis|exclusiv|precio|\$\d|en stock|disponibilidad inmediata/i);
  });

  it("does not behave like an eager asset: no preload, no autoplay attribute, a real poster, muted and inline", () => {
    const markup = renderToStaticMarkup(<LandingVideo />);
    expect(markup).toContain('preload="none"');
    expect(markup).not.toMatch(/autoPlay|autoplay/);
    expect(markup).toContain("muted");
    expect(markup).toContain("playsInline");
    expect(markup).toContain("loop");
    expect(markup).toContain(`poster="${LANDING_VIDEO_POSTER}"`);
    expect(markup).toContain(`<source src="${LANDING_VIDEO_SRC}" type="video/mp4"/>`);
    expect((markup.match(/<video/g) ?? []).length).toBe(1);
    expect((markup.match(/<source/g) ?? []).length).toBe(1);
    // A real frame of the video, light and in the video's own ratio.
    const poster = readFileSync(join(APP_ROOT, "public", "media", "landing", "landing-video-poster.webp"));
    expect(poster.subarray(0, 4).toString("ascii")).toBe("RIFF");
    expect(poster.subarray(8, 12).toString("ascii")).toBe("WEBP");
    expect(poster.length).toBeLessThan(60 * 1024);
    expect([poster.readUInt16LE(26) & 0x3fff, poster.readUInt16LE(28) & 0x3fff]).toEqual([540, 960]);
  });

  it("starts the first state paused and offers one accessible toggle", () => {
    const markup = renderToStaticMarkup(<LandingVideo />);
    expect(markup).toContain('aria-label="Reproducir video"');
    expect((markup.match(/<button/g) ?? []).length).toBe(1);
    expect(markup).toContain('type="button"');
  });

  it("plays only while meaningfully visible, pauses when it leaves, and respects reduced motion", () => {
    const source = read(APP_ROOT, "src", "components", "LandingVideo.jsx");
    expect(LANDING_VIDEO_VISIBLE_RATIO).toBeGreaterThanOrEqual(0.25);
    expect(LANDING_VIDEO_VISIBLE_RATIO).toBeLessThanOrEqual(0.5);
    expect(source).toContain("IntersectionObserver");
    expect(source).toContain("intersectionRatio >= LANDING_VIDEO_VISIBLE_RATIO");
    expect(source).toMatch(/\}\s*else\s*\{\s*video\.pause\(\);/);
    expect(source).toContain("(prefers-reduced-motion: reduce)");
    // Reduced motion and a visitor's own pause both suppress automatic play.
    expect(source).toMatch(/!reducedMotionRef\.current\s*&&\s*!userPausedRef\.current/);
    expect(source).toMatch(/attempt\.catch\(\(\) => \{\}\)/);
  });

  it("keeps HeroMedia's own tested contract intact", () => {
    const markup = renderToStaticMarkup(<HeroMedia />);
    expect(markup).toContain("autoPlay");
    expect(markup).toContain("/media/torino-21.mp4");
    expect(markup).not.toContain("loop");
  });

  it("is styled only through landing hooks, with tailored geometry and a 44px control", () => {
    expect(selectors.length).toBeGreaterThan(8);
    selectors.forEach((selector) => expect(selector, selector).toMatch(/^\.landing-(?:video|bias)/));
    expect(withoutComments).not.toContain("!important");
    expect(withoutComments).not.toMatch(/url\(|\d(?:vh|svh|dvh)\b|100vw|min-height/);

    const frame = rules.find(({ selector }) => selector === ".landing-video__frame");
    expect(frame.body).toMatch(/border-radius:\s*10px;/);
    expect(frame.body).toMatch(/border:\s*1px solid rgba\(169, 130, 79/);
    // Desktop: a 3:4 crop of the portrait footage, so the frame never outgrows the text block beside it.
    expect(frame.body).toMatch(/aspect-ratio:\s*3 \/ 4;/);
    expect(frame.body).not.toMatch(/rgba\(255,\s*255,\s*255/);

    const toggle = rules.find(({ selector }) => selector === ".landing-video__toggle");
    expect(toggle.body).toMatch(/width:\s*2\.75rem;/);
    expect(toggle.body).toMatch(/height:\s*2\.75rem;/);
  });

  it("splits copy and video on desktop and tablet (copy about two thirds), and stacks copy-first on phones", () => {
    const bias = rules.find(({ selector }) => selector === ".landing-bias");
    // Copy takes the remaining row; the video column is capped at 24rem (about 35% of the content width).
    expect(bias.body).toMatch(/grid-template-columns:\s*minmax\(0, 1fr\) clamp\(16rem, 32vw, 24rem\);/);
    // The section keeps its default section padding: no extra luxury spacing was added to replace the removed block.
    expect(bias.body).not.toMatch(/(?:^|[;\s])padding[\w-]*\s*:/);

    const narrow = withoutComments.slice(withoutComments.indexOf("@media (max-width: 720px)"));
    expect(narrow).toMatch(/grid-template-columns:\s*minmax\(0, 1fr\);/);
    expect(narrow).toMatch(/row-gap:\s*2rem;/);
    // Phones: the frame is cropped to 4:5 rather than a screen-tall portrait, full content width up to 22rem.
    expect(narrow).toMatch(/aspect-ratio:\s*4 \/ 5;/);
    expect(narrow).toMatch(/width:\s*min\(100%, 22rem\);/);
    // The stacking breakpoint is a phone width; tablets keep the restrained split.
    expect(withoutComments.match(/@media/g)).toHaveLength(1);
  });

  it("is absent from the shared Builder package and Discovery Decants", () => {
    expect(read(REPOSITORY_ROOT, "packages", "builder", "styles.css")).not.toMatch(/landing-video|landingMedia/);
    expect(read(REPOSITORY_ROOT, "src", "main.jsx")).not.toMatch(/landing-video|landingMedia/);
  });
});
