import { describe, expect, it } from "vitest";
import { aurelianCatalog } from "../merchant/catalog.js";
import { createSeasonalRotationState, SEASONAL_SLOTS } from "./seasonalSelection.js";
import { applySeasonalTransitionEvent, buildSeasonalCycleSchedule, createSeasonalTransitionState, SEASONAL_TRANSITION_TIMING } from "./seasonalTransition.js";

describe("seasonal transition schedule", () => {
  it("starts slots in seasonal order after the all-visible hold", () => {
    const schedule = buildSeasonalCycleSchedule();
    const exits = schedule.filter(({ phase }) => phase === "exiting");
    expect(exits.map(({ slot }) => slot)).toEqual([0, 1, 2, 3]);
    expect(exits.map(({ at }) => at)).toEqual([2000, 2300, 2600, 2900]);
    expect(schedule.at(-1)).toEqual({ at: 3600, phase: "visible", slot: 3 });
    expect(SEASONAL_TRANSITION_TIMING.fadeMs * 2).toBe(700);
  });

  it("changes exactly one compatible slot at each advancement and renews a full cycle", () => {
    let state = createSeasonalTransitionState(createSeasonalRotationState(aurelianCatalog));
    const initialIds = state.rotation.selection.map(({ id }) => id);
    for (let slot = 0; slot < SEASONAL_SLOTS.length; slot += 1) {
      state = applySeasonalTransitionEvent(state, { phase: "exiting", slot }, aurelianCatalog, () => 0.5);
      const before = state.rotation.selection.map(({ id }) => id);
      state = applySeasonalTransitionEvent(state, { phase: "advance", slot }, aurelianCatalog, () => 0.5);
      const after = state.rotation.selection.map(({ id }) => id);
      expect(after.filter((id, index) => id !== before[index])).toHaveLength(1);
      expect(after[slot]).not.toBe(before[slot]);
      expect(state.rotation.selection[slot].seasons).toContain(SEASONAL_SLOTS[slot].key);
      expect(new Set(after).size).toBe(4);
      state = applySeasonalTransitionEvent(state, { phase: "visible", slot }, aurelianCatalog);
    }
    expect(state.rotation.selection.map(({ id }) => id).every((id, index) => id !== initialIds[index])).toBe(true);
    expect(state.cycle).toBe(1);
  });

  it("settles every card visibly and restarts the next cycle from spring", () => {
    let state = createSeasonalTransitionState(createSeasonalRotationState(aurelianCatalog));
    state = applySeasonalTransitionEvent(state, { phase: "exiting", slot: 0 }, aurelianCatalog);
    state = applySeasonalTransitionEvent(state, { phase: "advance", slot: 0 }, aurelianCatalog, () => 0.25);
    state = applySeasonalTransitionEvent(state, { phase: "settle" }, aurelianCatalog);
    expect(state.phases).toEqual(["visible", "visible", "visible", "visible"]);
    expect(state.rotation.nextSlot).toBe(0);
    expect(state.cycle).toBe(1);
  });

  it("keeps canonical records unmodified across transition events", () => {
    const before = JSON.stringify(aurelianCatalog);
    let state = createSeasonalTransitionState(createSeasonalRotationState(aurelianCatalog));
    state = applySeasonalTransitionEvent(state, { phase: "exiting", slot: 0 }, aurelianCatalog);
    applySeasonalTransitionEvent(state, { phase: "advance", slot: 0 }, aurelianCatalog, () => 0.1);
    expect(JSON.stringify(aurelianCatalog)).toBe(before);
  });
});
