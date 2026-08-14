import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// BuilderRuntime's App component is never rendered directly in this
// package's own tests (see DiscoveryBoxBuilder.test.jsx, which mocks it
// away specifically to avoid needing a full, real catalog/config fixture)
// -- source-contract checks are the established pattern here instead (see
// stylesOwnership.test.js, which reads this same file for an unrelated
// boundary). isIntroCollapsed itself is a plain, always-available prop
// (no scroll/effect-driven state involved, unlike isSummaryDocked), so the
// prop-forwarding half of this contract is exercised directly, with real
// rendering, in DiscoveryBoxBuilder.test.jsx's
// "defaults hero-section suppression to false..." test.
const runtimeSource = readFileSync(new URL("./BuilderRuntime.jsx", import.meta.url), "utf8");

describe("BuilderRuntime hero-section intro-collapse boundary", () => {
  it("defaults isIntroCollapsed to false, preserving today's hero rendering for every host that doesn't opt in", () => {
    expect(runtimeSource).toMatch(/isIntroCollapsed\s*=\s*false,/);
  });

  it("gates the shared hero section behind isIntroCollapsed, never removing it from hosts that never pass the prop", () => {
    const heroIndex = runtimeSource.indexOf('<section className="hero">');
    expect(heroIndex).toBeGreaterThan(-1);
    const beforeHero = runtimeSource.slice(Math.max(0, heroIndex - 40), heroIndex);
    expect(beforeHero).toMatch(/\{!isIntroCollapsed && \(\s*$/);
  });
});
