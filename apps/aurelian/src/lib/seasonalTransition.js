import { rotateSeasonalSelection, SEASONAL_SLOTS } from "./seasonalSelection.js";

export const SEASONAL_TRANSITION_TIMING = Object.freeze({
  holdMs: 2000,
  staggerMs: 300,
  fadeMs: 350,
});

export function buildSeasonalCycleSchedule(timing = SEASONAL_TRANSITION_TIMING) {
  return SEASONAL_SLOTS.flatMap((_, slot) => {
    const start = timing.holdMs + (slot * timing.staggerMs);
    return [
      Object.freeze({ at: start, phase: "exiting", slot }),
      Object.freeze({ at: start + timing.fadeMs, phase: "advance", slot }),
      Object.freeze({ at: start + (timing.fadeMs * 2), phase: "visible", slot }),
    ];
  }).sort((left, right) => left.at - right.at || left.slot - right.slot);
}

export function createSeasonalTransitionState(rotation) {
  return {
    rotation,
    phases: SEASONAL_SLOTS.map(() => "visible"),
    cycle: 0,
  };
}

export function applySeasonalTransitionEvent(state, event, catalog, random = Math.random) {
  if (event.phase === "settle") {
    return {
      rotation: { ...state.rotation, nextSlot: 0 },
      phases: state.phases.map(() => "visible"),
      cycle: state.cycle + 1,
    };
  }

  const phases = state.phases.map((phase, index) => index === event.slot ? event.phase : phase);
  if (event.phase === "exiting") return { ...state, phases };

  if (event.phase === "advance") {
    if (state.rotation.nextSlot !== event.slot) return state;
    return {
      ...state,
      rotation: rotateSeasonalSelection(state.rotation, catalog, random),
      phases: phases.map((phase, index) => index === event.slot ? "entering" : phase),
    };
  }

  if (event.phase === "visible") {
    return {
      ...state,
      phases,
      cycle: event.slot === SEASONAL_SLOTS.length - 1 ? state.cycle + 1 : state.cycle,
    };
  }

  return state;
}
