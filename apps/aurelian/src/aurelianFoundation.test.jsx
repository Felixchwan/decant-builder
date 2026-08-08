import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { createMerchantCatalog, fragrances } from "@discovery-box/catalog";
import { validateBuilderConfig } from "@discovery-box/builder/config";
import { aurelianConfig } from "./merchant/config.js";
import { aurelianAvailableIds, aurelianCatalog } from "./merchant/catalog.js";
import { filterCatalog } from "./lib/filterCatalog.js";
import HomePage from "./app/page.jsx";
import { HeroMedia } from "./components/HeroMedia.jsx";
import HowItWorksPage, { metadata as howMetadata } from "./app/como-funciona/page.jsx";
import ContactPage, { metadata as contactMetadata } from "./app/contacto/page.jsx";
import CatalogPage, { metadata as catalogMetadata } from "./app/catalogo/page.jsx";
import BuilderPage, { metadata as builderMetadata } from "./app/build-your-box/page.jsx";
import sitemap from "./app/sitemap.js";
import robots from "./app/robots.js";

const APP_ROOT = fileURLToPath(new URL("../", import.meta.url));
const REPOSITORY_ROOT = fileURLToPath(new URL("../../../", import.meta.url));
const approvedColors = {
  background: "#090A09", surface: "rgba(17, 17, 15, 0.94)", surfaceElevated: "rgba(27, 25, 21, 0.96)",
  text: "#F2EBDD", textSecondary: "#C8BEAD", textMuted: "#938B7D", border: "rgba(200, 166, 101, 0.22)",
  accent: "#C8A665", accentStrong: "#9F7D43", accentContrast: "#171108", disabled: "rgba(147, 139, 125, 0.16)",
};

function productionFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return productionFiles(path);
    return /\.test\.[jt]sx?$/.test(entry.name) ? [] : [path];
  });
}

describe("Aurelian application foundation", () => {
  it("owns and preserves the approved merchant rules and theme", () => {
    expect(validateBuilderConfig(aurelianConfig)).toBe(aurelianConfig);
    expect(aurelianConfig.locale).toBe("es-MX");
    expect(aurelianConfig.box).toMatchObject({ minSelectableSlots: 6, maxSelectableSlots: 14, minPoints: 12, totalPhysicalSlots: 16, bonusSlotCount: 2 });
    expect(aurelianConfig.curatorBonus.targetPoints).toBe(12);
    expect(aurelianConfig.persistence.storageKey).toBe("aurelian-builder-v1");
    expect(aurelianConfig.theme.colors).toEqual(approvedColors);
    expect(aurelianConfig.finalization).toMatchObject({ mode: "whatsapp", whatsappNumber: "528129800010" });
    expect(aurelianConfig.features.whatsappFinalization).toBe(true);
    expect(aurelianConfig.finalization.visibleCustomerFields).toEqual(["name", "city"]);
    expect(aurelianConfig.finalization.customerFieldLabels.city).toBe("Municipio");
  });

  it("owns an explicit 84-ID manifest and canonical projection", () => {
    expect(aurelianAvailableIds).toHaveLength(84);
    expect(new Set(aurelianAvailableIds).size).toBe(84);
    expect(aurelianCatalog).toHaveLength(84);
    const projection = createMerchantCatalog({ source: fragrances, availableIds: aurelianAvailableIds });
    projection.forEach((record, index) => expect(record).toBe(aurelianCatalog[index]));
  });

  it("filters by brand, fragrance, and points without duplicating catalog data", () => {
    expect(filterCatalog(aurelianCatalog, "Armani", "all").every((item) => `${item.brand} ${item.name}`.toLowerCase().includes("armani"))).toBe(true);
    expect(filterCatalog(aurelianCatalog, "Acqua di Gio", "1").every((item) => item.points === 1)).toBe(true);
    expect(filterCatalog(aurelianCatalog, "no-existe", "all")).toEqual([]);
  });

  it("renders Spanish route content and declares canonical metadata", () => {
    const pages = [HomePage, HowItWorksPage, ContactPage, CatalogPage, BuilderPage];
    pages.forEach((Page) => expect(() => renderToStaticMarkup(<Page />)).not.toThrow());
    const howMarkup = renderToStaticMarkup(<HowItWorksPage />);
    expect(howMarkup).toContain("Selecciona 6–14 fragancias");
    expect(howMarkup).toContain("Monterrey");
    for (const [metadata, route] of [[howMetadata, "/como-funciona"], [contactMetadata, "/contacto"], [catalogMetadata, "/catalogo"], [builderMetadata, "/build-your-box"]]) {
      expect(metadata.alternates.canonical).toBe(route);
    }
    expect(sitemap()).toHaveLength(5);
    expect(robots().rules.allow).toBe("/");
  });

  it("exposes every canonical point value through the catalog filter", () => {
    const markup = renderToStaticMarkup(<CatalogPage />);
    for (const points of [1, 1.5, 2, 2.5, 4, 4.5, 5]) {
      expect(markup).toContain(`value="${points}"`);
    }
  });

  it("states the launch rules and service area without unsupported commerce claims", () => {
    const markup = [HomePage, HowItWorksPage, ContactPage, CatalogPage, BuilderPage]
      .map((Page) => renderToStaticMarkup(<Page />))
      .join("\n");
    expect(markup).toMatch(/6[–-]14 fragancias/);
    expect(markup).toContain("Monterrey");
    expect(markup).toContain("área metropolitana");
    expect(markup).toContain("revisa manualmente");
    expect(markup).toContain("después de confirmar disponibilidad");
    expect(markup).not.toMatch(/compra ahora|pago en línea|inventario garantizado|envío nacional|disponibilidad garantizada/i);
  });

  it("keeps public copy oriented toward criterio-building rather than sales-maximization language", () => {
    const markup = [HomePage, HowItWorksPage, ContactPage, CatalogPage, BuilderPage]
      .map((Page) => renderToStaticMarkup(<Page />))
      .join("\n");
    // Principio durable: la popularidad/el margen nunca se presentan como argumento de venta.
    expect(markup).not.toMatch(/los favoritos de (todos|la temporada)|recomendado por expertos|el mejor perfume|oferta especial|descuento|últimas unidades/i);
    // Principio durable: el sitio declara, en alguna de varias redacciones posibles, que la
    // selección no está ordenada por popularidad, ventas o margen.
    expect(markup).toMatch(/no (?:est[aá] ordenad[oa]|prioriza\w*|deja\w* que) .{0,40}\b(popularidad|lo m[aá]s vendido|margen)\b/i);
  });

  it("keeps promotional media decorative, silent, resilient, and motion-aware", () => {
    const markup = renderToStaticMarkup(<HeroMedia />);
    expect(markup).toContain("autoPlay");
    expect(markup).toContain("loop");
    expect(markup).toContain("muted");
    expect(markup).toContain("playsInline");
    expect(markup).toContain("poster=");
    expect(markup).toContain("/media/torino-21.mp4");
    expect(markup).toContain("hero-media__fallback");
    const stylesheet = readFileSync(join(APP_ROOT, "src", "app", "globals.css"), "utf8");
    expect(stylesheet).toMatch(/prefers-reduced-motion[\s\S]*\.hero-media__video\s*\{\s*display:none/);
  });

  it("uses content-driven section density and an editorial portrait media treatment", () => {
    const homeMarkup = renderToStaticMarkup(<HomePage />);
    const stylesheet = readFileSync(join(APP_ROOT, "src", "app", "globals.css"), "utf8");

    expect(homeMarkup).toContain('class="aurelian-hero page-shell"');
    expect(stylesheet).not.toContain("100svh");
    expect(stylesheet).not.toMatch(/\.aurelian-hero\s*\{[^}]*min-(?:height|block-size)/);
    expect(stylesheet).toMatch(/\.aurelian-hero\s*\{[^}]*padding-block:0/);
    expect(stylesheet).toMatch(/\.aurelian-hero__copy\s*\{[^}]*padding-block:clamp\(3rem,6vw,5rem\)/);
    expect(stylesheet).toMatch(/\.hero-media\s*\{[^}]*width:clamp\(17\.5rem,24vw,20rem\)/);
    expect(stylesheet).toMatch(/\.hero-media__frame\s*\{[^}]*aspect-ratio:9\/20/);
    expect(stylesheet).toMatch(/\.hero-media__video\s*\{[^}]*object-fit:cover;[^}]*object-position:56% 50%/);
    expect(stylesheet).toMatch(/@media \(max-width:900px\)[\s\S]*\.hero-media__frame\s*\{\s*aspect-ratio:4\/5/);
    expect(stylesheet).toMatch(/\.page-intro--compact\s*\{\s*padding-block:/);
    expect(stylesheet).toMatch(/\.section\s*\{\s*padding-block:clamp\(2\.5rem,3\.3vw,3rem\)/);
    expect(stylesheet).toMatch(/\.final-cta\s*\{\s*padding-block:3rem/);
    expect(stylesheet).toMatch(/\.service-band p:last-child\s*\{\s*margin-bottom:0/);
    expect(stylesheet).not.toMatch(/(?:\.aurelian-hero|\.section|\.service-band|\.final-cta)\s*\{[^}]*(?:100s?vh|min-(?:height|block-size))/);
    expect(stylesheet).not.toMatch(/(^|\n)\.hero\s*\{/);
    expect(homeMarkup).toContain("<h3><span>01</span>Prueba antes de decidir</h3>");
    expect(homeMarkup).toContain("<h3><span>01</span>Explora</h3>");
    expect(homeMarkup).not.toMatch(/<article><span>0[1-4]<\/span><h3>/);
    expect(homeMarkup).not.toMatch(/<article><b>[1-3]<\/b>/);
    expect(stylesheet).not.toMatch(/\.feature-grid article\s*\{[^}]*min-height/);
    expect(stylesheet).not.toMatch(/\.steps b\s*\{/);
  });

  it("renders four stable, accessible seasonal slots without layout-shift-prone image frames", () => {
    const markup = renderToStaticMarkup(<HomePage />);
    const stylesheet = readFileSync(join(APP_ROOT, "src", "app", "globals.css"), "utf8");
    expect(markup.match(/Selección de (?:primavera|verano|otoño|invierno)/g)).toHaveLength(4);
    expect(markup.match(/aria-label="Ver [^"]+ en el catálogo"/g)).toHaveLength(4);
    expect(markup.match(/href="\/catalogo\?fragrance=\d+"/g)).toHaveLength(4);
    expect(markup.match(/width="240"/g)).toHaveLength(4);
    expect(markup.match(/height="240"/g)).toHaveLength(4);
    expect(stylesheet).toMatch(/\.seasonal-card__image\s*\{[^}]*aspect-ratio:1\/1/);
  });

  it("keeps seasonal timing and catalog highlighting host-owned and safely paused", () => {
    const seasonalSource = readFileSync(join(APP_ROOT, "src", "components", "SeasonalFeaturedSelection.jsx"), "utf8");
    const catalogSource = readFileSync(join(APP_ROOT, "src", "components", "CatalogExplorer.jsx"), "utf8");
    const stylesheet = readFileSync(join(APP_ROOT, "src", "app", "globals.css"), "utf8");
    expect(seasonalSource).toContain("buildSeasonalCycleSchedule");
    expect(seasonalSource).toContain("prefers-reduced-motion: reduce");
    expect(seasonalSource).toContain("visibilitychange");
    expect(seasonalSource).toContain("onPointerEnter");
    expect(seasonalSource).toContain("onFocus");
    expect(seasonalSource).toContain("window.clearTimeout(timer)");
    expect(seasonalSource).toContain('removeEventListener("visibilitychange"');
    expect(catalogSource).toContain("resolveCatalogFragranceIntent(window.location.search, aurelianCatalog)");
    expect(catalogSource).toContain("scrollIntoView");
    expect(catalogSource).toContain("product-card--highlighted");
    expect(catalogSource).toContain("window.requestAnimationFrame");
    expect(seasonalSource).toContain("aria-disabled={interactive ? undefined : true}");
    expect(seasonalSource).toContain("tabIndex={interactive ? undefined : -1}");
    expect(stylesheet).toMatch(/\.seasonal-card--exiting \.seasonal-card__link\s*\{[^}]*opacity:0;[^}]*pointer-events:none/);
  });

  it("gives every catalog fragrance an explicit stable-ID Builder action", () => {
    const markup = renderToStaticMarkup(<CatalogPage />);
    expect(markup.match(/Agregar a mi Discovery Box/g)).toHaveLength(aurelianCatalog.length);
    expect(markup.match(/aria-label="Agregar [^"]+ a mi Discovery Box"/g)).toHaveLength(aurelianCatalog.length);
    expect(markup).toContain('class="product-card__actions"');
    expect(markup).toContain('class="product-card__points"');
    expect(markup).not.toContain("product-card__accords");
    for (const fragrance of aurelianCatalog) {
      expect(markup).toContain(`/build-your-box?fragrance=${fragrance.id}`);
    }
  });

  it("provides owned mobile-navigation focus, Escape, and route-state behavior", () => {
    const headerSource = readFileSync(join(APP_ROOT, "src", "components", "SiteHeader.jsx"), "utf8");
    expect(headerSource).toContain('event.key === "Escape"');
    expect(headerSource).toContain("summaryRef.current?.focus()");
    expect(headerSource).toContain('aria-current={isCurrent(href) ? "page" : undefined}');
    expect(headerSource).toContain("onClick={() => closeMenu()}");
  });

  it("publishes only the approved WhatsApp contact and enables generic finalization", () => {
    const markup = renderToStaticMarkup(<ContactPage />);
    expect(markup).toContain("+52 81 29 80 0010");
    expect(markup).not.toMatch(/mailto:|tel:|@[a-z\d.-]+\.[a-z]{2,}/i);
    const builderSource = readFileSync(join(APP_ROOT, "src", "components", "BuilderExperience.jsx"), "utf8");
    expect(builderSource).toContain("finalizationAdapter");
    expect(builderSource).toContain("createWhatsAppFinalizationAdapter");
    expect(builderSource).toContain("phoneNumber: aurelianConfig.finalization.whatsappNumber");
    expect(builderSource).toContain("noopAnalytics");
  });

  it("consumes package names only and keeps host ownership outside shared packages", () => {
    const appSources = productionFiles(join(APP_ROOT, "src")).map((path) => readFileSync(path, "utf8")).join("\n");
    expect(appSources).not.toMatch(/packages\/(?:builder|catalog)\/src|@discovery-box\/(?:builder|catalog)\/src/);
    expect(appSources).not.toMatch(/src\/merchants\/aurelian/);
    for (const packageName of ["builder", "catalog"]) {
      const packageSources = productionFiles(join(REPOSITORY_ROOT, "packages", packageName, "src")).map((path) => readFileSync(path, "utf8")).join("\n");
      expect(packageSources).not.toMatch(/Aurelian|aurelian|VITE_MERCHANT/);
      expect(packageSources).not.toContain("528129800010");
    }
  });

  it("keeps asset delivery and the client Builder boundary explicit", () => {
    const packageJson = readFileSync(join(APP_ROOT, "package.json"), "utf8");
    const builderSource = readFileSync(join(APP_ROOT, "src", "components", "BuilderExperience.jsx"), "utf8");
    expect(packageJson).toContain("catalog-sync-assets --destination public/catalog-assets");
    expect(builderSource.startsWith('"use client"')).toBe(true);
    expect(builderSource).toContain('basePath: "/catalog-assets"');
    const mountSource = readFileSync(join(APP_ROOT, "src", "components", "BuilderMount.jsx"), "utf8");
    expect(mountSource).toContain("ssr: false");
    const experienceSource = readFileSync(join(APP_ROOT, "src", "components", "BuilderExperience.jsx"), "utf8");
    expect(experienceSource).toContain("parseFragranceIntent(window.location.search)");
    expect(experienceSource).toContain("window.history.replaceState");
    expect(experienceSource).toContain("initialFragranceId={initialFragranceId}");
    expect(mountSource).not.toContain("aurelianCatalog");
    expect(readFileSync(join(REPOSITORY_ROOT, ".gitignore"), "utf8")).toContain("/apps/aurelian/public/catalog-assets/");
  });

  it("fully retires legacy Vite Aurelian ownership while preserving Discovery bootstrap", () => {
    const mainSource = readFileSync(join(REPOSITORY_ROOT, "src", "main.jsx"), "utf8");
    expect(mainSource).toContain("DiscoveryDecantsApp");
    expect(mainSource).not.toMatch(/VITE_MERCHANT|selectMerchantApp|Aurelian/);
    expect(() => readFileSync(join(REPOSITORY_ROOT, "src", "app", "AurelianApp.jsx"), "utf8")).toThrow();
  });
});
