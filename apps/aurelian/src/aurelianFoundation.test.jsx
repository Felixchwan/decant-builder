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
import { HeroMedia, HERO_MEDIA_SEQUENCE, nextHeroMediaIndex } from "./components/HeroMedia.jsx";
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

  it("owns an explicit 87-ID manifest and canonical projection", () => {
    expect(aurelianAvailableIds).toHaveLength(87);
    expect(new Set(aurelianAvailableIds).size).toBe(87);
    expect(aurelianCatalog).toHaveLength(87);
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
    expect(markup).toContain("muted");
    expect(markup).toContain("playsInline");
    expect(markup).toContain("poster=");
    expect(markup).toContain("/media/torino-21.mp4");
    expect(markup).not.toContain("/media/summer-hammer.mp4");
    expect(markup).not.toContain("loop");
    expect(markup.match(/class="hero-media__frame"/g)).toHaveLength(1);
    expect(markup.match(/class="hero-media__video"/g)).toHaveLength(1);
    expect(markup).toContain("hero-media__fallback");
    expect(HERO_MEDIA_SEQUENCE.map(({ src }) => src)).toEqual([
      "/media/torino-21.mp4",
      "/media/summer-hammer.mp4",
    ]);
    expect(nextHeroMediaIndex(0)).toBe(1);
    expect(nextHeroMediaIndex(1)).toBe(0);
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

  it("hides the redundant desktop CTA on the Builder route and labels it correctly elsewhere", () => {
    const headerSource = readFileSync(join(APP_ROOT, "src", "components", "SiteHeader.jsx"), "utf8");
    expect(headerSource).toContain('pathname.startsWith("/build-your-box")');
    expect(headerSource).toContain("{isBuilderRoute ? (");
    expect(headerSource).toContain('id="aurelian-builder-summary-slot"');
    expect(headerSource).toContain(">Construye tu caja</Link>");
    expect(headerSource).not.toContain(">Construye tu box</Link>");
  });

  it("docks the Builder summary into the header without the reserved slot competing with nav for width", () => {
    const stylesheet = readFileSync(join(APP_ROOT, "src", "app", "globals.css"), "utf8");
    // The nav's own margin-right is what reserves this horizontal region.
    // If the slot ALSO reserved width as a normal flex sibling, the two
    // reservations would stack and squeeze the nav into wrapping — this
    // is exactly the regression this test guards against. Taking the slot
    // out of flex flow (position:absolute) is what lets it overlay that
    // already-reserved region instead of reserving it a second time.
    expect(stylesheet).toMatch(/\.site-header__builder-slot\s*\{\s*position:absolute;/);
    expect(stylesheet).not.toMatch(/\.site-header__builder-slot\s*\{[^}]*align-self/);
    // The slot's containing block is .site-header itself (via its own
    // pre-existing position:sticky, asserted below), not a dedicated
    // position:relative on .site-header__inner--builder. Anchoring to the
    // narrower, centered .site-header__inner box left the docked card's
    // right edge misaligned with the actual panel column below at wide
    // viewports (confirmed live); anchoring to the full-width header
    // instead keeps them locked together. If .site-header__inner--builder
    // ever gets its own position:relative back, it would silently become
    // the nearer containing block again and reintroduce that misalignment.
    expect(stylesheet).not.toMatch(/\.site-header__inner--builder\s*\{[^}]*position:relative/);
    expect(stylesheet).toMatch(/\.site-header\s*\{[^}]*position:sticky/);
    // Mobile: the slot has nothing to dock into (no scroll-driven docking
    // there — see BuilderPanel's desktop-only matchMedia gate) and must not
    // occupy any space in the mobile header row, empty or not.
    expect(stylesheet).toMatch(/@media \(max-width:900px\) \{[^}]*\.site-header__builder-slot[^}]*display:none/s);
  });

  it("keeps the docked slot's right edge locked to the catalog/panel column's own centered-cap math, not a flat viewport-relative offset", () => {
    const stylesheet = readFileSync(join(APP_ROOT, "src", "app", "globals.css"), "utf8");
    // .builder-page > .builder-theme-root caps the whole catalog/panel area
    // at 1440px, centered (margin-inline:auto) -- a real, pre-existing
    // constraint this app applies on top of the shared package's own .app
    // container. A plain `right:12px` on the slot only matched the panel's
    // right edge at the one viewport width where that cap and the raw
    // viewport happened to coincide; confirmed live it was off by -232px
    // at 1920px. max(12px, calc(50% - 708px)) reproduces the same
    // half-the-overflow-past-1440px centering math domain the panel
    // itself uses, using percentages of the slot's own containing block
    // (.site-header's real, scrollbar-aware width) rather than 100vw.
    const slotMatch = stylesheet.match(/\.site-header__builder-slot\s*\{([^}]*)\}/);
    expect(slotMatch[1]).toMatch(/right:\s*max\(12px,\s*calc\(50% - 708px\)\)/);
    const capMatch = stylesheet.match(/\.builder-page > \.builder-theme-root\s*\{([^}]*)\}/);
    expect(capMatch[1]).toMatch(/width:\s*min\(1440px,\s*100%\)/);
    expect(capMatch[1]).toMatch(/margin-inline:\s*auto/);
  });

  it("gives the docked card the same background/blur as the header it visually sits inside, not the shared package's default surface", () => {
    const stylesheet = readFileSync(join(APP_ROOT, "src", "app", "globals.css"), "utf8");
    const headerMatch = stylesheet.match(/\.site-header\s*\{([^}]*)\}/);
    const cardMatch = stylesheet.match(
      /#aurelian-builder-summary-slot \.builder-panel-sticky-summary-card\s*\{([^}]*)\}/
    );
    const headerBackground = headerMatch[1].match(/background:\s*([^;]+);/)[1];
    const headerBlur = headerMatch[1].match(/backdrop-filter:\s*([^;]+);/)[1];
    expect(cardMatch[1]).toContain(`background:${headerBackground};`);
    expect(cardMatch[1]).toContain(`backdrop-filter:${headerBlur};`);
  });

  it("publishes only the approved WhatsApp contact and enables generic finalization", () => {
    const markup = renderToStaticMarkup(<ContactPage />);
    expect(markup).toContain("+52 81 29 80 0010");
    expect(markup).not.toMatch(/mailto:|tel:|@[a-z\d.-]+\.[a-z]{2,}/i);
    const builderSource = readFileSync(join(APP_ROOT, "src", "components", "BuilderExperience.jsx"), "utf8");
    expect(builderSource).toContain("finalizationAdapter");
    expect(builderSource).toContain("createWhatsAppFinalizationAdapter");
    expect(builderSource).toContain("phoneNumber: aurelianConfig.finalization.whatsappNumber");
    // Aurelian now owns a validating analytics wrapper (see
    // docs/adr/0013-analytics-provider-neutral-allowlist.md's Ownership
    // Boundary section) instead of passing noopAnalytics unconditionally --
    // no live vendor is wired today, so the only provider selected is the
    // console-only development logger (see analytics/README.md).
    expect(builderSource).toContain("createAnalytics");
    expect(builderSource).toContain("createDevelopmentAnalytics");
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

  it("opts into the Composer completion floor with its own configured minPoints, while Discovery Decants stays unopted-in", () => {
    // Aurelian intentionally declares this itself (see merchant/config.js) --
    // no longer just inherited from the shared default -- because it now
    // changes Composer completion behavior, not only informational copy.
    expect(aurelianConfig.box.minPoints).toBe(12);

    const experienceSource = readFileSync(
      join(APP_ROOT, "src", "components", "BuilderExperience.jsx"),
      "utf8"
    );
    // Proves BuilderExperience actually wires the capability, and that the
    // value threaded through is Aurelian's own config -- not a duplicated
    // literal -- so aurelianConfig.box.minPoints stays the single source of
    // truth for this behavior.
    expect(experienceSource).toContain(
      "composerMinimumPoints={aurelianConfig.box.minPoints}"
    );

    const discoveryEntrySource = readFileSync(
      join(REPOSITORY_ROOT, "src", "app", "DiscoveryDecantsApp.jsx"),
      "utf8"
    );
    // Discovery Decants' real production entry point must never opt in --
    // its <DiscoveryBoxBuilder> call simply never mentions the prop, so it
    // stays absent/null and Composer's completion behavior is unchanged.
    expect(discoveryEntrySource).not.toContain("composerMinimumPoints");
  });

  it("opts into the collapsible right-panel rail on desktop, while Discovery Decants stays unopted-in and mobile is untouched", () => {
    // Same opt-in-boundary shape as composerMinimumPoints above: the
    // capability lives in packages/builder (generic layout behavior), but
    // only Aurelian turns it on -- see BuilderExperience.jsx's own comment
    // for why (Discovery Decants keeps today's permanently-visible panel
    // column by simply never mentioning the prop).
    const experienceSource = readFileSync(
      join(APP_ROOT, "src", "components", "BuilderExperience.jsx"),
      "utf8"
    );
    expect(experienceSource).toContain("enablePanelCollapse");

    const discoveryEntrySource = readFileSync(
      join(REPOSITORY_ROOT, "src", "app", "DiscoveryDecantsApp.jsx"),
      "utf8"
    );
    expect(discoveryEntrySource).not.toContain("enablePanelCollapse");
  });

  // Regression guard for the catalog-density fix: this page's own
  // .catalog-controls (a label+input/label+select search-and-filter form)
  // used to be an unscoped selector. The Builder widget at /build-your-box
  // renders its own, differently-styled .catalog-controls (just a bare
  // search input, no label/select pair), scoped with :where(.builder-scope)
  // -- zero specificity by design (see
  // packages/builder/src/builder/styleNamespace.test.js). Without a page-
  // specific scope, this page's rule silently won the cascade wherever both
  // stylesheets loaded on the same page -- including inside the Builder
  // widget, which inherited this page's margin-top:3.5rem, 1.25rem padding,
  // border, and 2-column grid meant for a completely different form.
  it("never defines an unscoped .catalog-controls rule that could win the cascade inside the Builder widget", () => {
    const stylesheet = readFileSync(join(APP_ROOT, "src", "app", "globals.css"), "utf8");
    expect(stylesheet).not.toMatch(/(?<!\.catalog-page )\.catalog-controls\s*\{/);
    expect(stylesheet).not.toMatch(/(?<!\.catalog-page )\.catalog-controls (?:label|input|select)/);
  });

  it("keeps the /catalogo page's own catalog-controls styling intact under the .catalog-page scope", () => {
    const stylesheet = readFileSync(join(APP_ROOT, "src", "app", "globals.css"), "utf8");
    expect(stylesheet).toContain(
      ".catalog-page .catalog-controls { display:grid; grid-template-columns:1fr 14rem; gap:1rem; margin-top:3.5rem; padding:1.25rem; border:1px solid var(--border); background:var(--surface); }"
    );
    expect(stylesheet).toContain(".catalog-page .catalog-controls { grid-template-columns:1fr; }");
  });

  it("fully retires legacy Vite Aurelian ownership while preserving Discovery bootstrap", () => {
    const mainSource = readFileSync(join(REPOSITORY_ROOT, "src", "main.jsx"), "utf8");
    expect(mainSource).toContain("DiscoveryDecantsApp");
    expect(mainSource).not.toMatch(/VITE_MERCHANT|selectMerchantApp|Aurelian/);
    expect(() => readFileSync(join(REPOSITORY_ROOT, "src", "app", "AurelianApp.jsx"), "utf8")).toThrow();
  });
});
