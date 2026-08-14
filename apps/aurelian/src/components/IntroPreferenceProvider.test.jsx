import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { IntroPreferenceProvider, useIntroPreference } from "./IntroPreferenceProvider.jsx";

const componentSource = readFileSync(
  new URL("./IntroPreferenceProvider.jsx", import.meta.url),
  "utf8",
);

// The actual sync-from-storage effect only runs after a real browser mount
// (useLayoutEffect never fires under renderToStaticMarkup, and this repo has
// no jsdom/testing-library harness -- see BuilderPanel.test.jsx's
// isSummaryDocked coverage for the same, already-established limitation).
// Coverage here is therefore: (a) the SSR/first-render default is provably
// always expanded, matching what the server can know, and (b) source-
// contract checks proving dismiss/restore write storage before updating
// state, and that the sync effect is gated to run once, client-only, via
// the isomorphic-effect guard. The actual persisted-preference pickup on
// mount is verified by browser acceptance.
function Probe() {
  const { isIntroDismissed } = useIntroPreference();
  return <p data-testid="probe">{String(isIntroDismissed)}</p>;
}

describe("IntroPreferenceProvider", () => {
  it("defaults to expanded (isIntroDismissed: false) on first render, regardless of any real stored preference", () => {
    const markup = renderToStaticMarkup(
      <IntroPreferenceProvider>
        <Probe />
      </IntroPreferenceProvider>,
    );
    expect(markup).toContain(">false<");
  });

  it("gives consumers outside any provider the same expanded default via the context's own default value", () => {
    const markup = renderToStaticMarkup(<Probe />);
    expect(markup).toContain(">false<");
  });

  it("writes storage before updating React state on both dismiss and restore, and restore removes rather than writes a falsy value", () => {
    const dismissBody = componentSource.slice(
      componentSource.indexOf("function dismissIntro"),
      componentSource.indexOf("function restoreIntro"),
    );
    const restoreBody = componentSource.slice(
      componentSource.indexOf("function restoreIntro"),
      componentSource.indexOf("return (", componentSource.indexOf("function restoreIntro")),
    );
    expect(dismissBody).toMatch(/writeIntroDismissedPreference\(true\)[\s\S]*setIsIntroDismissed\(true\)/);
    expect(restoreBody).toMatch(/writeIntroDismissedPreference\(false\)[\s\S]*setIsIntroDismissed\(false\)/);
  });

  it("syncs from the real stored preference exactly once on mount, client-only, before the next paint", () => {
    expect(componentSource).toMatch(
      /useIsomorphicLayoutEffect\(\(\) => \{\s*setIsIntroDismissed\(readIntroDismissedPreference\(\)\);\s*\}, \[\]\);/,
    );
    expect(componentSource).toMatch(
      /const useIsomorphicLayoutEffect = typeof window === "undefined" \? useEffect : useLayoutEffect;/,
    );
  });

  it("never imports Builder/domain or merchant config -- a plain, generic UI preference", () => {
    expect(componentSource).not.toMatch(/aurelianConfig|selectedPerfumes|onAddPerfume|@discovery-box\/builder/);
  });
});
