import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

const builderCalls = vi.hoisted(() => []);

vi.mock("@discovery-box/builder", () => ({
  DiscoveryBoxBuilder(props) {
    builderCalls.push(props);
    return <div data-testid="merchant-builder" />;
  },
}));

import { BuilderExperience, hasPersistedBox } from "./BuilderExperience.jsx";
import { aurelianConfig } from "../merchant/config.js";
import { parseFragranceIntent, FRAGRANCE_QUERY_PARAM } from "../lib/parseFragranceIntent.js";
import { ENTRY_HEADER_VISIBILITY_SCRIPT } from "../app/build-your-box/page.jsx";

const originalWindow = globalThis.window;

// Executes the literal script text that ships inline in page.jsx — not a
// re-implementation of it — against a fake window/document, so drift between
// the pre-hydration hint and BuilderExperience's real gate is caught even if
// only one side is edited in the future.
function runEntryHeaderVisibilityScript({ search, storedValue }) {
  let displayValue = "";
  const header = {
    style: {
      set display(value) {
        displayValue = value;
      },
      get display() {
        return displayValue;
      },
    },
  };
  const fakeWindow = {
    location: { search },
    localStorage: {
      getItem: (key) => (key === aurelianConfig.persistence.storageKey ? storedValue : null),
    },
  };
  const fakeDocument = {
    getElementById: (id) => (id === "builder-entry-header" ? header : null),
  };
  const run = new Function("window", "document", "URLSearchParams", ENTRY_HEADER_VISIBILITY_SCRIPT);
  run(fakeWindow, fakeDocument, URLSearchParams);
  return displayValue === "none";
}

function mockWindow({ storedValue = null, search = "" } = {}) {
  globalThis.window = {
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
});

describe("BuilderExperience entry routing", () => {
  it("shows the Discovery Intent screen for a genuine first-time visitor", () => {
    mockWindow();

    const markup = renderToStaticMarkup(<BuilderExperience />);

    expect(markup).toContain("¿Qué buscas hoy?");
    expect(markup).toContain("Fresco y cotidiano");
    expect(markup).toContain("Noche con intención");
    expect(markup).toContain("Es un regalo");
    expect(markup).toContain("Quiero explorar todo");
    expect(builderCalls).toHaveLength(0);
  });

  it("skips the Discovery Intent screen and restores silently when a persisted box already exists", () => {
    mockWindow({ storedValue: "{}" });

    const markup = renderToStaticMarkup(<BuilderExperience />);

    expect(markup).not.toContain("¿Qué buscas hoy?");
    expect(builderCalls).toHaveLength(1);
    expect(builderCalls[0].initialCatalogFilters).toBeNull();
  });

  it("skips the Discovery Intent screen when a deep-linked fragrance is present, and applies no catalog filter", () => {
    mockWindow({ search: "?fragrance=1" });

    const markup = renderToStaticMarkup(<BuilderExperience />);

    expect(markup).not.toContain("¿Qué buscas hoy?");
    expect(builderCalls).toHaveLength(1);
    expect(builderCalls[0].initialFragranceId).toBe(1);
    expect(builderCalls[0].initialCatalogFilters).toBeNull();
  });
});

describe("entry header pre-hydration visibility script", () => {
  it("agrees with BuilderExperience's real first-render gate across representative cases", () => {
    const cases = [
      { label: "first-time visitor", search: "", storedValue: null },
      { label: "returning visitor with a persisted box", search: "", storedValue: "{}" },
      { label: "deep-linked fragrance, no stored box", search: `?${FRAGRANCE_QUERY_PARAM}=1`, storedValue: null },
      { label: "deep-linked fragrance, with a stored box too", search: `?${FRAGRANCE_QUERY_PARAM}=1`, storedValue: "{}" },
      { label: "unrelated query param only", search: "?other=x", storedValue: null },
      { label: "malformed fragrance value", search: `?${FRAGRANCE_QUERY_PARAM}=abc`, storedValue: null },
    ];

    cases.forEach(({ label, search, storedValue }) => {
      const scriptHidesHeader = runEntryHeaderVisibilityScript({ search, storedValue });

      mockWindow({ storedValue, search });
      const realGateSkipsIntentScreen = parseFragranceIntent(search) !== null || hasPersistedBox();
      globalThis.window = originalWindow;

      // The inline script hides the header exactly when BuilderExperience is
      // about to show the Discovery Intent screen instead of skipping it —
      // if this ever disagrees, the pre-hydration hint and the real client
      // gate have drifted apart.
      expect(scriptHidesHeader, label).toBe(!realGateSkipsIntentScreen);
    });
  });
});
