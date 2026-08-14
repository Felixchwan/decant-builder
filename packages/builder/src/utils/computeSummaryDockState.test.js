import { describe, expect, it } from "vitest";
import { computeSummaryDockState } from "./computeSummaryDockState.js";

describe("computeSummaryDockState", () => {
  it("docks as soon as the sentinel's top has scrolled above the viewport", () => {
    expect(computeSummaryDockState({ sentinelTop: -0.5, isDesktopViewport: true })).toBe(true);
    expect(computeSummaryDockState({ sentinelTop: -1, isDesktopViewport: true })).toBe(true);
    expect(computeSummaryDockState({ sentinelTop: -400, isDesktopViewport: true })).toBe(true);
  });

  it("stays undocked while the sentinel is still at or below the viewport top", () => {
    expect(computeSummaryDockState({ sentinelTop: 0, isDesktopViewport: true })).toBe(false);
    expect(computeSummaryDockState({ sentinelTop: 1, isDesktopViewport: true })).toBe(false);
    expect(computeSummaryDockState({ sentinelTop: 500, isDesktopViewport: true })).toBe(false);
  });

  it("never docks outside the desktop breakpoint, regardless of scroll position", () => {
    expect(computeSummaryDockState({ sentinelTop: -400, isDesktopViewport: false })).toBe(false);
    expect(computeSummaryDockState({ sentinelTop: 0, isDesktopViewport: false })).toBe(false);
  });

  it("is a single deterministic boundary -- crossing back and forth around 0 flips the decision every time, with no dead zone", () => {
    const sequence = [10, -1, 5, -5, 0.5, -0.5];
    const results = sequence.map((sentinelTop) =>
      computeSummaryDockState({ sentinelTop, isDesktopViewport: true })
    );
    expect(results).toEqual([false, true, false, true, false, true]);
  });
});
