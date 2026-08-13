import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { BuilderIntroHeader } from "./BuilderIntroHeader.jsx";

const componentSource = readFileSync(
  new URL("./BuilderIntroHeader.jsx", import.meta.url),
  "utf8"
);

// isCollapsed is internal useState -- there is no prop seam, and
// renderToStaticMarkup renders once, statically, so the collapsed branch
// (reached only by a post-hydration click) cannot be exercised through
// this harness. Coverage here is: the default (expanded) render's exact
// structural contract, and source-contract checks proving the collapsed
// branch's shape, non-persistence, and domain independence. The actual
// dismiss->restore interaction is verified by browser acceptance.
describe("BuilderIntroHeader", () => {
  it("renders the original intro content unchanged, with id/classes the pre-hydration script and CSS still depend on", () => {
    const markup = renderToStaticMarkup(<BuilderIntroHeader />);
    expect(markup).toContain('id="builder-entry-header"');
    expect(markup).toContain('class="page-shell page-intro page-intro--compact"');
    expect(markup).toContain("Tu Discovery Box");
    expect(markup).toContain("Elige 6–14 fragancias.");
    expect(markup).toContain("Revisar cómo funciona");
    expect(markup).not.toContain("builder-intro-restore");
  });

  it("gives the dismiss control a real button with a localized accessible name", () => {
    const markup = renderToStaticMarkup(<BuilderIntroHeader />);
    expect(markup).toMatch(/<button[^>]*class="builder-intro-dismiss"[^>]*aria-label="Ocultar introducción[^"]*"/);
  });

  it("never persists the collapse preference and never touches Builder/domain state", () => {
    expect(componentSource).not.toMatch(/localStorage|sessionStorage/);
    // A pure presentational leaf: no merchant config, catalog, or Builder
    // imports at all -- collapsing this section cannot reach box/domain
    // state because there is no code path into it from this file.
    expect(componentSource).not.toMatch(/aurelianConfig|BuilderExperience|selectedPerfumes|onAddPerfume/);
  });

  it("keeps the restore control compact and distinctly labeled, using the same collapse state rather than a second mechanism", () => {
    expect(componentSource).toMatch(/const \[isCollapsed, setIsCollapsed\] = useState\(false\)/);
    expect(componentSource).toMatch(/aria-label="Mostrar introducción[^"]*"/);
    expect(componentSource).toContain("setIsCollapsed(false)");
    expect(componentSource).toContain("setIsCollapsed(true)");
  });
});
