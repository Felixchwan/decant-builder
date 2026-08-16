import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// BuilderRuntime's App component is never rendered directly in this
// package's own tests (see DiscoveryBoxBuilder.test.jsx, which mocks it
// away specifically to avoid needing a full, real catalog/config fixture)
// -- source-contract checks are the established pattern here instead (see
// stylesOwnership.test.js, which reads this same file for an unrelated
// boundary). showBuilderHero itself is a plain, always-available prop (no
// scroll/effect-driven state involved, unlike isSummaryDocked), so the
// prop-forwarding half of this contract is exercised directly, with real
// rendering, in DiscoveryBoxBuilder.test.jsx's
// "defaults the shared hero section to visible..." test.
const runtimeSource = readFileSync(new URL("./BuilderRuntime.jsx", import.meta.url), "utf8");

describe("BuilderRuntime shared hero-section capability boundary", () => {
  it("defaults showBuilderHero to true, preserving today's hero rendering for every host that doesn't opt out", () => {
    expect(runtimeSource).toMatch(/showBuilderHero\s*=\s*true,/);
  });

  it("gates the shared hero section behind showBuilderHero, rendering it for any host that doesn't pass false", () => {
    const heroIndex = runtimeSource.indexOf('<section className="hero">');
    expect(heroIndex).toBeGreaterThan(-1);
    const beforeHero = runtimeSource.slice(Math.max(0, heroIndex - 40), heroIndex);
    expect(beforeHero).toMatch(/\{showBuilderHero && \(\s*$/);
  });

  it("holds no leftover isIntroCollapsed plumbing -- that represented a host's own persisted intro preference, which this generic render capability does not couple to", () => {
    expect(runtimeSource).not.toMatch(/isIntroCollapsed/);
  });
});

// onCatalogInfoRequest itself is a plain, always-available prop, same as
// showBuilderHero above -- the prop-forwarding half of this contract is
// exercised directly, with real rendering, in DiscoveryBoxBuilder.test.jsx's
// "renders a compact info button..." test.
describe("BuilderRuntime catalog-header info affordance boundary", () => {
  it("has no default value -- absent by default, rendering the catalog heading row exactly as it always has", () => {
    expect(runtimeSource).toMatch(/onCatalogInfoRequest,\s*\n\}\) \{/);
  });

  it("gates the info button behind onCatalogInfoRequest, inside the catalog panel-header row, never a second copy of the heading", () => {
    const panelHeaderIndex = runtimeSource.indexOf('<div className="catalog-title-group">');
    expect(panelHeaderIndex).toBeGreaterThan(-1);
    const panelHeaderSource = runtimeSource.slice(panelHeaderIndex, panelHeaderIndex + 700);
    expect(panelHeaderSource).toContain("{onCatalogInfoRequest && (");
    expect(panelHeaderSource).toContain('className="panel-header-actions"');
    expect(panelHeaderSource).toContain('className="catalog-info-button"');
    expect(panelHeaderSource).toContain('aria-label={t("general.catalogInfoAria")}');
    expect(panelHeaderSource).toContain("onClick={onCatalogInfoRequest}");
  });
});

// Same source-contract pattern as above, for the collapsible right-panel
// rail. Live behavior (natural-scroll-then-bottom-lock via a JS-computed
// negative top-sticky offset, the header-offset clamp for a short panel,
// rail top-stick while collapsed, 3->4+ catalog reflow, inert blocking
// focus/pointer interaction on the hidden panel, focus staying on the rail
// across a real click, state surviving a collapse/expand cycle,
// mobile/Discovery-Decants non-regression) was browser-verified directly
// -- see the session's verification notes -- rather than re-asserted here
// as markup strings, since none of it is expressible as a static
// source-contract check the way the hero-collapse boundary above is.
describe("BuilderRuntime collapsible right-panel boundary", () => {
  it("defaults enablePanelCollapse to false, so a host that never opts in renders no rail and no extra wrapper DOM", () => {
    expect(runtimeSource).toMatch(/enablePanelCollapse\s*=\s*false,/);
  });

  it("gates the entire rail + wrapper behind enablePanelCollapse, falling back to the bare boxPanel element otherwise", () => {
    expect(runtimeSource).toContain("{enablePanelCollapse ? (");
    expect(runtimeSource).toContain('className="builder-panel-collapsible-row"');
    expect(runtimeSource).toContain("builder-panel-collapse-rail");
    expect(runtimeSource).toMatch(/\) : \(\s*boxPanel\s*\)\}/);
  });

  it("marks the wrapped panel inert while collapsed -- the single mechanism blocking focus, pointer interaction, and AT exposure at once, while the component stays mounted", () => {
    expect(runtimeSource).toContain('<div className="builder-panel-column" inert={isPanelCollapsed}>');
  });

  it("does not add pending-focus-ref/useLayoutEffect machinery -- the rail is the only trigger, so focus already sits on it when collapse fires (confirmed via real-click browser testing, not just assumed)", () => {
    expect(runtimeSource).not.toMatch(/pendingRailFocusRef|collapseRailRef/);
  });

  it("keeps isPanelCollapsed local and non-persisted, matching BuilderPanel's own isSummaryCollapsed precedent", () => {
    expect(runtimeSource).toMatch(/const \[isPanelCollapsed, setIsPanelCollapsed\] = useState\(false\);/);
    expect(runtimeSource).not.toMatch(/isPanelCollapsed.*localStorage|localStorage.*[Pp]anelCollapse/);
  });
});
