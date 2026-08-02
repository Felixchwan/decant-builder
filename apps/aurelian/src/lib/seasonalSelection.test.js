import { describe, expect, it } from "vitest";
import { aurelianCatalog } from "../merchant/catalog.js";
import { createInitialSeasonalSelection, createSeasonalRotationState, rotateSeasonalSelection, SEASONAL_SLOTS, shouldRotateSeasonalSelection } from "./seasonalSelection.js";

describe("seasonal featured selection", () => {
  it("creates a deterministic, canonical, unique selection for all four seasons", () => {
    const first = createInitialSeasonalSelection(aurelianCatalog);
    const second = createInitialSeasonalSelection(aurelianCatalog);
    expect(first.map(({ id }) => id)).toEqual(second.map(({ id }) => id));
    expect(first).toHaveLength(4);
    expect(new Set(first.map(({ id }) => id)).size).toBe(4);
    first.forEach((fragrance, index) => {
      expect(fragrance.seasons).toContain(SEASONAL_SLOTS[index].key);
      expect(aurelianCatalog.find(({ id }) => id === fragrance.id)).toBe(fragrance);
    });
  });

  it("rotates one slot at a time without immediate repeats or cross-slot duplicates", () => {
    let state = createSeasonalRotationState(aurelianCatalog);
    for (let cycle = 0; cycle < 16; cycle += 1) {
      const previous = state;
      state = rotateSeasonalSelection(state, aurelianCatalog, () => 0.42);
      const changedSlot = previous.nextSlot;
      expect(state.selection[changedSlot].id).not.toBe(previous.selection[changedSlot].id);
      expect(new Set(state.selection.map(({ id }) => id)).size).toBe(4);
      state.selection.forEach((fragrance, index) => expect(fragrance.seasons).toContain(SEASONAL_SLOTS[index].key));
    }
  });

  it("never mutates canonical catalog records", () => {
    const before = JSON.stringify(aurelianCatalog);
    const initial = createSeasonalRotationState(aurelianCatalog);
    rotateSeasonalSelection(initial, aurelianCatalog, () => 0.25);
    expect(JSON.stringify(aurelianCatalog)).toBe(before);
  });

  it("pauses for reduced motion, hover, focus, and hidden documents", () => {
    expect(shouldRotateSeasonalSelection({ reducedMotion: false, hovered: false, focusWithin: false, hidden: false })).toBe(true);
    for (const paused of [
      { reducedMotion: true, hovered: false, focusWithin: false, hidden: false },
      { reducedMotion: false, hovered: true, focusWithin: false, hidden: false },
      { reducedMotion: false, hovered: false, focusWithin: true, hidden: false },
      { reducedMotion: false, hovered: false, focusWithin: false, hidden: true },
    ]) expect(shouldRotateSeasonalSelection(paused)).toBe(false);
  });
});
