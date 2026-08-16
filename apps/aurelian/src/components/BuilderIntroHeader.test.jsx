import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { BuilderIntroHeader } from "./BuilderIntroHeader.jsx";
import { IntroPreferenceContext } from "./IntroPreferenceProvider.jsx";

const componentSource = readFileSync(
  new URL("./BuilderIntroHeader.jsx", import.meta.url),
  "utf8",
);

function withPreference(value, children) {
  return (
    <IntroPreferenceContext.Provider value={value}>{children}</IntroPreferenceContext.Provider>
  );
}

// isIntroDismissed now comes from IntroPreferenceProvider's context, not
// this component's own state -- both branches are real, directly
// renderable markup differences driven by a plain prop, so (unlike the
// scroll/effect-driven isSummaryDocked in BuilderPanel) both are exercised
// here with renderToStaticMarkup, not just source-contract checks. The
// actual dismiss->restore click interaction and the persisted-preference
// pickup on mount still can't run under this harness (no jsdom/testing-
// library, no real click events) -- those are verified by browser
// acceptance.
describe("BuilderIntroHeader", () => {
  it("renders the original intro content unchanged when not dismissed, with id/classes the pre-hydration script and CSS still depend on", () => {
    const markup = renderToStaticMarkup(<BuilderIntroHeader />);
    expect(markup).toContain('id="builder-entry-header"');
    expect(markup).toContain('class="page-shell page-intro page-intro--compact"');
    expect(markup).toContain("Tu Discovery Box");
    expect(markup).toContain("Elige 6–14 fragancias.");
    expect(markup).toContain("Revisar cómo funciona");
    expect(markup).not.toContain("builder-intro-restore");
  });

  it("falls back to the context's own expanded default when rendered outside any provider", () => {
    const markup = renderToStaticMarkup(<BuilderIntroHeader />);
    expect(markup).toContain('id="builder-entry-header"');
  });

  it("gives the dismiss control a real button with a localized accessible name", () => {
    const markup = renderToStaticMarkup(<BuilderIntroHeader />);
    expect(markup).toMatch(/<button[^>]*class="builder-intro-dismiss"[^>]*aria-label="Ocultar introducción[^"]*"/);
  });

  it("renders nothing at all when the preference says dismissed -- restoring is owned elsewhere now", () => {
    const markup = renderToStaticMarkup(
      withPreference(
        { isIntroDismissed: true, dismissIntro: () => {}, restoreIntro: () => {} },
        <BuilderIntroHeader />,
      ),
    );
    expect(markup).toBe("");
    expect(markup).not.toContain('id="builder-entry-header"');
    expect(markup).not.toContain("Elige 6–14 fragancias.");
    expect(markup).not.toContain("Revisar cómo funciona");
  });

  it("wires the dismiss button to the context's own action, never a second, locally-owned mechanism, and no longer reads restoreIntro at all", () => {
    expect(componentSource).toContain("onClick={dismissIntro}");
    expect(componentSource).not.toContain("restoreIntro");
    expect(componentSource).toContain("useIntroPreference()");
    expect(componentSource).not.toMatch(/useState/);
  });

  it("never touches storage directly and never imports merchant config or Builder/domain state -- a pure presentational leaf", () => {
    expect(componentSource).not.toMatch(/localStorage|sessionStorage/);
    expect(componentSource).not.toMatch(/aurelianConfig|BuilderExperience|selectedPerfumes|onAddPerfume/);
  });
});
