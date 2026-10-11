import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import ContactPage, { metadata } from "./app/contacto/page.jsx";
import HomePage from "./app/page.jsx";
import { SocialFollow } from "./components/SocialFollow.jsx";
import { AURELIAN_SOCIAL_LINKS } from "./lib/socialLinks.js";
import { aurelianConfig } from "./merchant/config.js";

const APP_ROOT = fileURLToPath(new URL("..", import.meta.url));
const REPOSITORY_ROOT = fileURLToPath(new URL("../../..", import.meta.url));
const read = (...segments) => readFileSync(join(...segments), "utf8");

const markup = renderToStaticMarkup(<ContactPage />);
const source = read(APP_ROOT, "src", "app", "contacto", "page.jsx");
const css = read(APP_ROOT, "src", "app", "contact-page.css").replace(/\/\*[\s\S]*?\*\//g, "");
const rules = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(([, selector, body]) => ({ selector: selector.trim(), body })).filter(({ selector }) => !selector.startsWith("@"));
const ruleBody = (selector) => rules.find((rule) => rule.selector === selector)?.body;

const links = [...markup.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/g)].map(([, attrs, text]) => ({ attrs, text: text.replace(/<[^>]+>/g, "") }));
const attr = (attrs, name) => attrs.match(new RegExp(`${name}="([^"]*)"`))?.[1];

function sourceFiles(directory) {
  return readdirSync(directory).flatMap((entry) => {
    if (["node_modules", ".next", "dist"].includes(entry)) return [];
    const path = join(directory, entry);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.(?:[cm]?[jt]sx?|css)$/.test(entry) && !/\.test\.[cm]?[jt]sx?$/.test(entry) ? [path] : [];
  });
}

describe("/contacto: the approved facts and copy", () => {
  it("keeps the intro and its metadata", () => {
    expect(metadata.alternates.canonical).toBe("/contacto");
    expect(markup).toContain('<p class="eyebrow">Contacto</p>');
    expect(markup).toContain("<h1>Atención personal para cada selección.</h1>");
    expect(markup).toContain("Cuando tu Discovery Box cumpla los requisitos, podrás solicitar por WhatsApp una revisión de disponibilidad.");
  });

  it("states the three service / review / payment facts, in order, as an ordered list", () => {
    expect([...markup.matchAll(/<li class="contact-facts__item" data-fact="([a-z]+)"/g)].map((match) => match[1])).toEqual(["service", "review", "payment"]);
    expect([...markup.matchAll(/class="contact-facts__number">(\d\d)</g)].map((match) => match[1])).toEqual(["01", "02", "03"]);
    expect(markup).toContain("<h2>Área de servicio</h2><p>Monterrey y su área metropolitana durante la etapa inicial.</p>");
    expect(markup).toContain("<h2>Revisión de disponibilidad</h2><p>Cada selección se revisará manualmente; el catálogo no representa una promesa de inventario inmediato.</p>");
    expect(markup).toContain("<h2>Confirmación y pago</h2><p>Las instrucciones de pago se compartirán únicamente después de confirmar la disponibilidad.</p>");
    expect(markup.match(/<ol class="contact-facts" role="list">/g)).toHaveLength(1);
  });

  it("does not turn into a second 'Cómo funciona': no process, bonus or points detail here", () => {
    expect(markup).not.toMatch(/Curator|12 puntos|6–14|Proceso|Cómo se procesa/);
  });

  it("keeps a clean outline: one h1, then h2s only", () => {
    expect(markup.match(/<h1\b/g)).toHaveLength(1);
    expect([...markup.matchAll(/<h([1-6])\b/g)].map((match) => Number(match[1]))).toEqual([1, 2, 2, 2, 2]);
    expect([...markup.matchAll(/<h2>([^<]+)<\/h2>/g)].map((match) => match[1])).toEqual(["Área de servicio", "Revisión de disponibilidad", "Confirmación y pago", "WhatsApp"]);
  });
});

describe("/contacto: WhatsApp as the primary channel", () => {
  it("shows the approved number and sentence, and no other contact channel of its own", () => {
    expect(aurelianConfig.finalization.whatsappDisplayNumber).toBe("+52 81 29 80 0010");
    expect(markup).toContain('<p class="contact-channel__number">+52 81 29 80 0010</p>');
    expect(markup).toContain("Este canal recibe solicitudes de disponibilidad; no confirma pedidos ni pagos automáticamente.");
    expect(markup).not.toMatch(/mailto:|tel:|@[a-z\d.-]+\.[a-z]{2,}/i);
  });

  it("has exactly one WhatsApp link, built from the host config's number, opening in a new tab safely", () => {
    const whatsapp = links.filter(({ attrs }) => /wa\.me/.test(attrs));
    expect(whatsapp).toHaveLength(1);
    expect(attr(whatsapp[0].attrs, "href")).toBe("https://wa.me/528129800010");
    expect(attr(whatsapp[0].attrs, "href")).toBe(`https://wa.me/${aurelianConfig.finalization.whatsappNumber}`);
    expect(attr(whatsapp[0].attrs, "target")).toBe("_blank");
    expect(attr(whatsapp[0].attrs, "rel")).toBe("noopener noreferrer");
    expect(attr(whatsapp[0].attrs, "aria-label")).toBe("Escribir por WhatsApp (se abre en una pestaña nueva)");
    expect(whatsapp[0].text).toBe("Escribir por WhatsApp");
    // The number lives in the host config only: never hardcoded in the page or its styles.
    expect(source).toContain("aurelianConfig.finalization.whatsappNumber");
    expect(source).not.toContain("528129800010");
    expect(css).not.toContain("528129800010");
  });

  it("promises nothing: no instant confirmation, guaranteed stock, automatic payment or immediate reply", () => {
    const text = markup.replace(/<[^>]+>/g, " ");
    expect(text).not.toMatch(/inmediat[ao]s? (?:respuesta|confirmación)|respuesta inmediata|al instante|garant|automáticamente (?:confirm|se)|en minutos|24 ?\/ ?7|siempre disponible/i);
  });
});

describe("/contacto: social links reuse the host-owned cluster", () => {
  it("uses SocialFollow and socialLinks.js with its own 'Síguenos en' wording, and hardcodes no URL of its own", () => {
    expect(source).toContain('import { SocialFollow } from "../../components/SocialFollow.jsx";');
    expect(source).toContain("<SocialFollow />");
    expect(source).not.toMatch(/<SocialFollow\s+label=/);
    expect(source).not.toMatch(/facebook\.com|instagram\.com/);
    expect(markup).toContain('<span class="landing-follow__label">Síguenos en</span>');
    expect(markup).not.toContain("También puedes encontrarnos en");
    expect(markup).toContain(renderToStaticMarkup(<SocialFollow />));
  });

  it("links the two approved accounts with accessible names, a new tab and noopener noreferrer", () => {
    const social = links.filter(({ attrs }) => /landing-follow__link/.test(attrs));
    expect(social.map(({ attrs }) => attr(attrs, "href"))).toEqual(["https://www.facebook.com/share/19g6gNspA3/", "https://www.instagram.com/aurelianperfumes"]);
    expect(social.map(({ attrs }) => attr(attrs, "href"))).toEqual(AURELIAN_SOCIAL_LINKS.map(({ href }) => href));
    expect(social.map(({ attrs }) => attr(attrs, "aria-label"))).toEqual(["Aurelian en Facebook (se abre en una pestaña nueva)", "Aurelian en Instagram (se abre en una pestaña nueva)"]);
    social.forEach(({ attrs }) => {
      expect(attr(attrs, "target")).toBe("_blank");
      expect(attr(attrs, "rel")).toBe("noopener noreferrer");
    });
    // The icons are decorative: the names carry the meaning.
    expect(markup.match(/<svg aria-hidden="true" focusable="false"/g)).toHaveLength(2);
  });

  it("leaves the landing's own wording as it was", () => {
    expect(renderToStaticMarkup(<HomePage />)).toContain('<span class="landing-follow__label">Síguenos en</span>');
    expect(renderToStaticMarkup(<SocialFollow />)).toContain("Síguenos en");
  });
});

describe("/contacto: contact only (the Builder call to action is not repeated here)", () => {
  it("carries no Builder link or 'Preparar mi Discovery Box' action: the site header owns that", () => {
    const builder = links.filter(({ attrs }) => attr(attrs, "href") === "/build-your-box");

    expect(builder).toHaveLength(0);
    expect(markup).not.toContain("Preparar mi Discovery Box");
    expect(markup).not.toContain("contact-channel__cta");
    expect(source).not.toContain("next/link");
    expect(css).not.toContain(".contact-channel__cta");
    // the only links left are WhatsApp and the two social accounts
    expect(links.map(({ attrs }) => attr(attrs, "href"))).toEqual([
      "https://wa.me/528129800010",
      "https://www.facebook.com/share/19g6gNspA3/",
      "https://www.instagram.com/aurelianperfumes",
    ]);
  });

  it("reads: intro, the three facts, WhatsApp, the QR code, then the social links as the closing detail", () => {
    const at = (needle) => markup.indexOf(needle);
    const sequence = ["<h1>", "data-fact=\"service\"", "data-fact=\"review\"", "data-fact=\"payment\"", "<h2>WhatsApp</h2>", "contact-channel__number", "wa.me", "contact-qr", "landing-follow"].map(at);
    expect(sequence.every((index) => index > -1)).toBe(true);
    expect([...sequence].sort((a, b) => a - b)).toEqual(sequence);
  });

  it("shows the WhatsApp QR as a described image with a caption, at a size that scans", () => {
    const image = markup.match(/<img\b[^>]*contact-qr__image[^>]*>/)?.[0] ?? "";

    expect(image).toContain('src="/media/contact/whatsapp-qr.svg"');
    expect(image).toContain('alt="Código QR para escribir a Aurelian por WhatsApp"');
    expect(image).toContain('width="176"');
    expect(image).toContain('height="176"');
    expect(markup).toMatch(/<figure class="contact-qr">[\s\S]*<figcaption class="contact-qr__caption">Escanéalo con tu teléfono para abrir WhatsApp\.<\/figcaption><\/figure>/);
    expect(markup.match(/<figure\b/g)).toHaveLength(1);
    // never smaller than 10rem (160px) on any screen: a code shown on a phone is scanned by another phone
    expect(css).toMatch(/\.contact-qr__image\s*\{[^}]*width:\s*clamp\(10rem,\s*14vw,\s*11rem\)/);
    expect(css).toMatch(/\.contact-qr__image\s*\{\s*width:\s*10rem;/);
    // its light ground comes from the file itself (a QR needs its quiet zone), framed by a hairline
    expect(ruleBody(".contact-qr__image")).toMatch(/outline:\s*1px solid/);
  });

  it("ships a QR file for the same WhatsApp link the page opens, and pins it to the host config's number", () => {
    const qr = read(APP_ROOT, "public", "media", "contact", "whatsapp-qr.svg");
    const recorded = qr.match(/^<!-- WhatsApp QR for (https:\/\/wa\.me\/\d+)\./)?.[1];

    expect(qr).toMatch(/<svg\b[^>]*viewBox="0 0 \d+ \d+"/);
    // an XML comment may not contain a double hyphen, or the browser refuses to draw the image
    expect(qr.match(/^<!--([\s\S]*?)-->/)[1]).not.toContain("--");
    // the recorded URL is the page's own link; change the number without regenerating the file and this fails
    expect(recorded).toBe(`https://wa.me/${aurelianConfig.finalization.whatsappNumber}`);
    expect(qr).not.toMatch(/<script|<image|href=/i);
  });

  it("keeps the social cluster under the QR on one left edge, on desktop and when stacked", () => {
    const css = readFileSync(join(APP_ROOT, "src", "app", "contact-page.css"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
    const desktop = css.split("@media")[0];
    const follow = (text) => text.match(/\.contact-channel \.landing-follow\s*\{([^}]*)\}/)?.[1] ?? "";

    expect(follow(desktop)).toMatch(/align-self:\s*flex-start;/);
    expect(follow(desktop)).toMatch(/justify-content:\s*flex-start;/);
    expect(ruleBody(".contact-channel__secondary")).toMatch(/flex-direction:\s*column/);
    // stacked: the caption moves beside the code, and on the narrowest phones back under it
    expect(css).toMatch(/@media \(max-width: 900px\)[\s\S]*\.contact-qr\s*\{\s*grid-template-columns:\s*auto minmax\(0,\s*1fr\)/);
    expect(css).toMatch(/@media \(max-width: 420px\)\s*\{\s*[\s\S]*\.contact-qr\s*\{\s*grid-template-columns:\s*minmax\(0,\s*1fr\)/);
  });
});

describe("/contacto: editorial layout (host-owned CSS)", () => {
  it("keys every rule on the contact page and loads after the generic styles", () => {
    expect(rules.length).toBeGreaterThan(10);
    rules.forEach(({ selector }) => selector.split(",").forEach((part) => expect(part.trim(), part).toMatch(/^\.contact-/)));
    expect(css).not.toContain("!important");
    const layout = read(APP_ROOT, "src", "app", "layout.jsx");
    expect(layout.indexOf('import "./contact-page.css";')).toBeGreaterThan(layout.indexOf('import "./globals.css";'));
    expect(layout.indexOf('import "./contact-page.css";')).toBeGreaterThan(layout.indexOf('import "./landing-closing.css";'));
  });

  it("is open and hairline-based: no card shells, fills, shadows or rounded boxes for the facts and channels", () => {
    for (const selector of [".contact-facts", ".contact-facts__item", ".contact-channel", ".contact-channel__primary", ".contact-channel__secondary"]) {
      expect(ruleBody(selector), selector).not.toMatch(/background|box-shadow|border-radius/);
    }
    expect(ruleBody(".contact-facts__item")).toMatch(/border-top:\s*1px solid/);
    expect(ruleBody(".contact-facts")).toMatch(/grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/);
    expect(css).not.toMatch(/(?:^|[;\s{])transform\s*:|animation|@keyframes|filter:/);
  });

  it("stacks the same sequence on narrow screens without visual reordering, and keeps the type untouched", () => {
    expect(css).toMatch(/@media \(max-width: 900px\)[\s\S]*\.contact-facts\s*\{\s*grid-template-columns:\s*minmax\(0,\s*1fr\)/);
    expect(css).toMatch(/@media \(max-width: 900px\)[\s\S]*\.contact-channel\s*\{\s*grid-template-columns:\s*minmax\(0,\s*1fr\)/);
    expect(css).not.toMatch(/(?:^|[;\s{])order\s*:|-reverse|direction:\s*rtl/);
    expect(ruleBody(".contact-page > h1")).not.toMatch(/font-size/);
  });

  it("retires the old boxed cards and note", () => {
    const globals = read(APP_ROOT, "src", "app", "globals.css");
    expect(globals).not.toMatch(/\.contact-grid|\.pending-note/);
    expect(markup).not.toMatch(/contact-grid|pending-note/);
  });
});

describe("/contacto: boundaries", () => {
  it("leaves no trace in the shared packages, the Builder or Discovery Decants", () => {
    const trace = /contact-page\.css|contact-channel|contact-facts|contactPage/;
    const files = [
      ...sourceFiles(join(REPOSITORY_ROOT, "packages", "builder", "src")),
      join(REPOSITORY_ROOT, "packages", "builder", "styles.css"),
      ...sourceFiles(join(REPOSITORY_ROOT, "packages", "catalog", "src")),
      ...sourceFiles(join(REPOSITORY_ROOT, "src")),
    ];
    files.forEach((file) => expect(read(file), file).not.toMatch(trace));
    for (const file of ["BuilderExperience.jsx", "CatalogExplorer.jsx", "SeasonalFeaturedSelection.jsx", "LandingVideo.jsx", "SiteFooter.jsx", "SiteHeader.jsx"]) {
      expect(read(APP_ROOT, "src", "components", file), file).not.toMatch(trace);
    }
    expect(read(APP_ROOT, "src", "app", "page.jsx")).not.toMatch(trace);
    expect(read(APP_ROOT, "src", "app", "como-funciona", "page.jsx")).not.toMatch(trace);
  });
});
