import { describe, expect, it } from "vitest";

import { isCuratorBonusUnlockTransition } from "./isCuratorBonusUnlockTransition.js";

// What BuilderPanel's unlock effect does with the helper: it runs once per (re)mount and once per change of
// the unlocked flag, remembering the value it saw last. A React StrictMode dev mount runs it twice in a row.
function createUnlockObserver() {
  let previous = null;
  const transitions = [];

  return {
    runEffect(current) {
      transitions.push(isCuratorBonusUnlockTransition({ previous, current }));
      previous = current;
    },
    transitions,
  };
}

describe("isCuratorBonusUnlockTransition", () => {
  it("counts only a real locked -> unlocked change", () => {
    expect(isCuratorBonusUnlockTransition({ previous: false, current: true })).toBe(true);
    expect(isCuratorBonusUnlockTransition({ previous: true, current: true })).toBe(false);
    expect(isCuratorBonusUnlockTransition({ previous: true, current: false })).toBe(false);
    expect(isCuratorBonusUnlockTransition({ previous: false, current: false })).toBe(false);
  });

  it("does not treat the first look as a change: a box restored already unlocked is unlocked, not newly unlocked", () => {
    expect(isCuratorBonusUnlockTransition({ previous: null, current: true })).toBe(false);
    expect(isCuratorBonusUnlockTransition({ previous: null, current: false })).toBe(false);
  });

  describe("across the panel's effect runs", () => {
    it("restored already unlocked: never a transition, however often the effect runs", () => {
      const observer = createUnlockObserver();
      observer.runEffect(true);

      expect(observer.transitions).toEqual([false]);
    });

    it("restored already unlocked under StrictMode's double mount effect: still never a transition", () => {
      const observer = createUnlockObserver();
      observer.runEffect(true);
      observer.runEffect(true);

      expect(observer.transitions).toEqual([false, false]);
    });

    it("restored locked, then really unlocked while mounted: exactly one transition, at the unlock", () => {
      const observer = createUnlockObserver();
      observer.runEffect(false);
      observer.runEffect(true);

      expect(observer.transitions).toEqual([false, true]);
    });

    it("restored locked under StrictMode, then really unlocked: the double mount run adds no transition, the unlock still has one", () => {
      const observer = createUnlockObserver();
      observer.runEffect(false);
      observer.runEffect(false);
      observer.runEffect(true);

      expect(observer.transitions).toEqual([false, false, true]);
    });

    it("an empty box that fills up: a transition at the unlock; removing then re-adding the item is a second one", () => {
      const observer = createUnlockObserver();
      [false, true, false, true].forEach((unlocked) => observer.runEffect(unlocked));

      expect(observer.transitions).toEqual([false, true, false, true]);
    });
  });
});
