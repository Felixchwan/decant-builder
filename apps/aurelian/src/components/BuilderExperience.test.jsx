import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

const builderCalls = vi.hoisted(() => []);
// What the App Router's useSearchParams() currently reports. null = no router context (a
// bare render), which is how every test below that doesn't navigate runs.
const routerState = vi.hoisted(() => ({ search: null }));

vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal()),
  useSearchParams: () => (routerState.search === null ? null : new URLSearchParams(routerState.search)),
}));

vi.mock("@discovery-box/builder", () => ({
  DiscoveryBoxBuilder(props) {
    builderCalls.push(props);
    return <div data-testid="merchant-builder" />;
  },
}));

import { BuilderExperience } from "./BuilderExperience.jsx";
import { IntroPreferenceContext } from "./IntroPreferenceProvider.jsx";
import { aurelianConfig } from "../merchant/config.js";
import { ANALYTICS_EVENTS } from "@discovery-box/builder/analytics";

const originalWindow = globalThis.window;

function mockWindow({ storedValue = null, search = "", viewportWidth } = {}) {
  globalThis.window = {
    // a viewport that answers every media query, so a test can prove the width changes nothing
    ...(viewportWidth === undefined ? {} : { innerWidth: viewportWidth, matchMedia: (query) => ({ matches: /max-width:s*(d+)px/.test(query) ? viewportWidth <= Number(query.match(/max-width:s*(d+)px/)[1]) : false }) }),
    localStorage: {
      getItem: (key) => (key === aurelianConfig.persistence.storageKey ? storedValue : null),
    },
    location: { href: `https://aurelianperfumes.com/build-your-box${search}`, search },
    history: { replaceState: () => {} },
  };
}

afterEach(() => {
  globalThis.window = originalWindow;
  builderCalls.length = 0;
  routerState.search = null;
});

describe("BuilderExperience entry: straight into the Builder, at every width", () => {
  it("renders the Builder for a genuine first-time visitor, with no chooser", () => {
    mockWindow();

    const markup = renderToStaticMarkup(<BuilderExperience />);

    expect(markup).not.toContain("¿Qué buscas hoy?");
    expect(markup).not.toContain("discovery-intent");
    ["Fresco y cotidiano", "Noche con intención", "Es un regalo", "Quiero explorar todo"].forEach((title) =>
      expect(markup).not.toContain(title)
    );
    expect(builderCalls).toHaveLength(1);
    expect(builderCalls[0].initialFragranceId).toBeNull();
    expect(builderCalls[0].initialDetailFragranceId).toBeNull();
  });

  it("does the same on a phone, a tablet and a desktop viewport: the width decides nothing", () => {
    [375, 390, 428, 768, 980, 981, 1100, 1440].forEach((viewportWidth) => {
      builderCalls.length = 0;
      mockWindow({ viewportWidth });

      const markup = renderToStaticMarkup(<BuilderExperience />);

      expect(markup, String(viewportWidth)).not.toContain("¿Qué buscas hoy?");
      expect(builderCalls, String(viewportWidth)).toHaveLength(1);
    });
  });

  it("restores silently when a persisted box already exists", () => {
    mockWindow({ storedValue: "{}" });

    const markup = renderToStaticMarkup(<BuilderExperience />);

    expect(markup).not.toContain("¿Qué buscas hoy?");
    expect(builderCalls).toHaveLength(1);
  });

  it("passes a deep-linked fragrance straight to the Builder", () => {
    mockWindow({ search: "?fragrance=1" });

    const markup = renderToStaticMarkup(<BuilderExperience />);

    expect(markup).not.toContain("¿Qué buscas hoy?");
    expect(builderCalls).toHaveLength(1);
    expect(builderCalls[0].initialFragranceId).toBe(1);
  });

  it("no longer feeds the Builder a recommendation hint or an explainer: there is no choice to translate", () => {
    mockWindow();

    renderToStaticMarkup(<BuilderExperience />);

    expect(builderCalls[0]).not.toHaveProperty("initialRecommendationHint");
    expect(builderCalls[0]).not.toHaveProperty("explainRecommendation");
  });

  it("carries no trace of the chooser, its viewport gate or its pre-hydration script", () => {
    const source = readFileSync(new URL("./BuilderExperience.jsx", import.meta.url), "utf8");
    const page = readFileSync(new URL("../app/build-your-box/page.jsx", import.meta.url), "utf8");
    const globals = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");

    expect(source).not.toMatch(/DiscoveryIntentScreen|discoveryIntent|selectedIntentId|skipsDiscoveryIntent|hasPersistedBox|matchMedia|mobileBuilderViewport/);
    expect(page).not.toMatch(/dangerouslySetInnerHTML|<script|ENTRY_HEADER_VISIBILITY_SCRIPT|matchMedia|localStorage/);
    expect(page).toContain("<BuilderIntroHeader /><BuilderMount");
    expect(globals).not.toContain("discovery-intent");
  });
});

describe("BuilderExperience details-only deep link (?details=)", () => {
  it("hands the Builder the details id, with no add intent", () => {
    mockWindow({ search: "?details=1" });

    const markup = renderToStaticMarkup(<BuilderExperience />);

    expect(markup).not.toContain("¿Qué buscas hoy?");
    expect(builderCalls).toHaveLength(1);
    expect(builderCalls[0].initialDetailFragranceId).toBe(1);
    expect(builderCalls[0].initialFragranceId).toBeNull();
  });

  it("passes a well-formed id the catalog doesn't contain straight through (the Builder reports it)", () => {
    mockWindow({ search: "?details=999999" });

    renderToStaticMarkup(<BuilderExperience />);

    expect(builderCalls[0].initialDetailFragranceId).toBe(999999);
  });

  it("treats malformed or repeated details values as no intent: the Builder opens with nothing requested", () => {
    ["?details=abc", "?details=", "?details=0", "?details=1&details=2"].forEach((search) => {
      mockWindow({ search });
      builderCalls.length = 0;

      const markup = renderToStaticMarkup(<BuilderExperience />);

      expect(markup, search).not.toContain("¿Qué buscas hoy?");
      expect(builderCalls, search).toHaveLength(1);
      expect(builderCalls[0], search).toMatchObject({ initialFragranceId: null, initialDetailFragranceId: null });
    });
  });

  it("never combines the two links: a valid ?fragrance= wins and the details request is dropped", () => {
    mockWindow({ search: "?fragrance=1&details=2" });

    renderToStaticMarkup(<BuilderExperience />);

    expect(builderCalls[0].initialFragranceId).toBe(1);
    expect(builderCalls[0].initialDetailFragranceId).toBeNull();
  });

  it("leaves the add link exactly as it was: ?fragrance= alone sends no details intent", () => {
    mockWindow({ search: "?fragrance=1" });

    renderToStaticMarkup(<BuilderExperience />);

    expect(builderCalls[0].initialFragranceId).toBe(1);
    expect(builderCalls[0].initialDetailFragranceId).toBeNull();
  });

  it("consumes only the two intent params from the URL, with replaceState, and leaves everything else", () => {
    const source = readFileSync(new URL("./BuilderExperience.jsx", import.meta.url), "utf8");

    expect(source).toContain("[FRAGRANCE_QUERY_PARAM, DETAILS_QUERY_PARAM]");
    expect(source).toContain("window.history.replaceState(window.history.state,");
    expect(source).not.toMatch(/history\.pushState/);
    expect(source).not.toMatch(/searchParams\.(?:clear|set)\(/);
  });
});

describe("repeat client-side navigation: the intent is read from the router, not a stale window.location", () => {
  // On every catalog -> Builder visit after the first in a session, the Builder's chunk is
  // already loaded, so BuilderExperience renders in the SAME commit that updates the URL. In
  // that render window.location still holds the page being left (/catalogo, no query) while
  // the router's search params already hold the new query. Reading window.location therefore
  // saw "no intent" and the strip effect then removed the param. These tests keep
  // window.location stale on purpose, so they fail if the component ever reads it first.
  function navigateFromCatalog(routerSearch) {
    routerState.search = routerSearch;
    mockWindow({ search: "" });
    builderCalls.length = 0;

    const markup = renderToStaticMarkup(<BuilderExperience />);

    return { markup, props: builderCalls[0] };
  }

  it("resolves a details intent on the first AND the second visit, from a stale /catalogo location", () => {
    const first = navigateFromCatalog("details=1");
    expect(first.props.initialDetailFragranceId).toBe(1);
    expect(first.props.initialFragranceId).toBeNull();
    expect(first.markup).not.toContain("¿Qué buscas hoy?");

    // back to /catalogo, then another perfume
    const second = navigateFromCatalog("details=404");
    expect(second.props.initialDetailFragranceId).toBe(404);
    expect(second.markup).not.toContain("¿Qué buscas hoy?");

    const third = navigateFromCatalog("details=202");
    expect(third.props.initialDetailFragranceId).toBe(202);
  });

  it("resolves an add intent on every visit, so the second and third adds still execute", () => {
    expect(navigateFromCatalog("fragrance=1").props.initialFragranceId).toBe(1);
    expect(navigateFromCatalog("fragrance=2").props.initialFragranceId).toBe(2);
    expect(navigateFromCatalog("fragrance=3").props.initialFragranceId).toBe(3);
  });

  it("keeps every contract when the query comes from the router", () => {
    // add wins when both are valid; details alone opens details; an invalid add doesn't block a valid details
    expect(navigateFromCatalog("fragrance=1&details=2").props).toMatchObject({ initialFragranceId: 1, initialDetailFragranceId: null });
    expect(navigateFromCatalog("details=2&ref=x").props).toMatchObject({ initialFragranceId: null, initialDetailFragranceId: 2 });
    expect(navigateFromCatalog("fragrance=abc&details=2").props).toMatchObject({ initialFragranceId: null, initialDetailFragranceId: 2 });
    // unknown id: still passed through for the Builder to report
    expect(navigateFromCatalog("details=999999").props.initialDetailFragranceId).toBe(999999);
  });

  it("opens the Builder with nothing requested for a router query with no valid intent, whatever the stale location says", () => {
    ["", "details=abc", "fragrance=1&fragrance=2", "other=x"].forEach((search) => {
      const { markup, props } = navigateFromCatalog(search);

      expect(markup, search).not.toContain("¿Qué buscas hoy?");
      expect(props, search).toMatchObject({ initialFragranceId: null, initialDetailFragranceId: null });
    });
  });

  it("only falls back to window.location when there is no router context", () => {
    routerState.search = null;
    mockWindow({ search: "?details=7" });

    renderToStaticMarkup(<BuilderExperience />);

    expect(builderCalls[0].initialDetailFragranceId).toBe(7);
  });

  it("leaves the URL-cleanup effect as the one-shot, two-param replaceState it was", () => {
    const source = readFileSync(new URL("./BuilderExperience.jsx", import.meta.url), "utf8");

    expect(source).toContain("const searchParams = useSearchParams();");
    expect(source).toContain("[FRAGRANCE_QUERY_PARAM, DETAILS_QUERY_PARAM]");
    expect(source).toContain("window.history.replaceState(window.history.state,");
    expect(source).not.toMatch(/useRouter|router\.(?:replace|push)/);
  });
});

describe("shared Builder hero suppression", () => {
  it("always disables the Builder's own shared hero section, in favor of this app's own #builder-entry-header intro", () => {
    mockWindow({ storedValue: "{}" });

    renderToStaticMarkup(<BuilderExperience />);

    expect(builderCalls).toHaveLength(1);
    expect(builderCalls[0].showBuilderHero).toBe(false);
    // No leftover isIntroCollapsed plumbing -- Aurelian's own persisted
    // intro preference (see IntroPreferenceProvider.jsx) now controls only
    // BuilderIntroHeader, and never reaches the shared Builder at all.
    expect(builderCalls[0]).not.toHaveProperty("isIntroCollapsed");
  });
});

describe("catalog-header info restore wiring", () => {
  it("leaves onCatalogInfoRequest undefined while the intro is still visible, and wires it to the real restoreIntro once dismissed", () => {
    mockWindow({ storedValue: "{}" });

    // No provider: falls back to IntroPreferenceContext's own default value
    // (isIntroDismissed: false), same as BuilderIntroHeader does.
    renderToStaticMarkup(<BuilderExperience />);
    expect(builderCalls[0].onCatalogInfoRequest).toBeUndefined();

    builderCalls.length = 0;
    const restoreIntro = () => {};
    renderToStaticMarkup(
      <IntroPreferenceContext.Provider
        value={{ isIntroDismissed: true, dismissIntro: () => {}, restoreIntro }}
      >
        <BuilderExperience />
      </IntroPreferenceContext.Provider>,
    );
    // The real restoreIntro reference is forwarded unwrapped -- the catalog
    // info button's click handler is exactly the same action the old
    // restore control used, not a second, re-implemented path.
    expect(builderCalls[0].onCatalogInfoRequest).toBe(restoreIntro);
  });
});

describe("environment-based analytics provider selection", () => {
  // analyticsDebugEnabled arrives as a plain prop from the host page (see
  // hostEnvironmentBoundary.test.js) -- BuilderExperience itself never
  // reads process.env, so these tests drive selection by passing the prop
  // directly rather than mutating the environment. No live vendor provider
  // is wired today (see apps/aurelian/src/analytics/README.md): the only
  // provider BuilderExperience ever selects is the console-only
  // development logger, which is itself a no-op unless explicitly enabled.
  it("defaults to a silent, disabled logger with no console/network activity (tests/local, no debug flag)", () => {
    mockWindow({ storedValue: "{}" });
    const debugSpy = vi.spyOn(console, "debug").mockImplementation(() => {});

    renderToStaticMarkup(<BuilderExperience />);
    const result = builderCalls[0].analytics.track(ANALYTICS_EVENTS.APP_LOADED, {
      source: "system",
    });

    expect(result).toBe(true);
    expect(debugSpy).not.toHaveBeenCalled();
    debugSpy.mockRestore();
  });

  it("selects the console debug logger only when isDevelopment and the debug flag are both set", () => {
    mockWindow({ storedValue: "{}" });
    const debugSpy = vi.spyOn(console, "debug").mockImplementation(() => {});

    renderToStaticMarkup(<BuilderExperience isDevelopment analyticsDebugEnabled />);
    builderCalls[0].analytics.track(ANALYTICS_EVENTS.APP_LOADED, { source: "system" });

    expect(debugSpy).toHaveBeenCalledWith(
      "[analytics]",
      ANALYTICS_EVENTS.APP_LOADED,
      expect.objectContaining({ source: "system" })
    );
    debugSpy.mockRestore();
  });

  it("never enables the debug logger in a non-development environment, even if the debug flag is set", () => {
    mockWindow({ storedValue: "{}" });
    const debugSpy = vi.spyOn(console, "debug").mockImplementation(() => {});

    renderToStaticMarkup(<BuilderExperience isDevelopment={false} analyticsDebugEnabled />);
    builderCalls[0].analytics.track(ANALYTICS_EVENTS.APP_LOADED, { source: "system" });

    expect(debugSpy).not.toHaveBeenCalled();
    debugSpy.mockRestore();
  });

  it("still validates and rejects invalid events even with no live provider configured", () => {
    // Proves the privacy/allowlist boundary is genuinely active -- not
    // merely skipped because analytics is currently dormant -- by showing
    // an unknown event is rejected the same way it would be with a real
    // vendor wired in.
    mockWindow({ storedValue: "{}" });

    renderToStaticMarkup(<BuilderExperience />);

    expect(builderCalls[0].analytics.track("not_a_real_event", {})).toBe(false);
    expect(
      builderCalls[0].analytics.track(ANALYTICS_EVENTS.APP_LOADED, { customerName: "Leaked" })
    ).toBe(false);
  });
});
