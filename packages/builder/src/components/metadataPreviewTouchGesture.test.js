import { describe, expect, it } from "vitest";
import { resolveTouchGestureEnd } from "./metadataPreviewTouchGesture.js";

describe("resolveTouchGestureEnd", () => {
  it("shows immediately on a quick tap when showOnTap is enabled", () => {
    const result = resolveTouchGestureEnd({
      alreadySettled: false,
      hadPendingLongPress: true,
      showOnTap: true,
    });

    expect(result).toEqual({ settled: true, action: "show" });
  });

  it("hides (does nothing, since it was never shown) on a quick tap when showOnTap is disabled -- every other note's existing touch behavior", () => {
    const result = resolveTouchGestureEnd({
      alreadySettled: false,
      hadPendingLongPress: true,
      showOnTap: false,
    });

    expect(result).toEqual({ settled: true, action: "hide" });
  });

  it("hides on release after a genuine long press (no pending timer left), regardless of showOnTap", () => {
    expect(
      resolveTouchGestureEnd({ alreadySettled: false, hadPendingLongPress: false, showOnTap: true })
    ).toEqual({ settled: true, action: "hide" });
    expect(
      resolveTouchGestureEnd({ alreadySettled: false, hadPendingLongPress: false, showOnTap: false })
    ).toEqual({ settled: true, action: "hide" });
  });

  // This is the exact regression this module exists to prevent: a touch's
  // pointerup is immediately followed by a synthesized pointerleave (a
  // lifted touch has nothing left to "hover"), which previously re-ran this
  // same decision with the timer already cleared by pointerup, reading as
  // "not a quick tap" and closing the preview the same tap had just opened.
  it("is a no-op for every call after the gesture has already settled -- the trailing pointerleave after pointerup never undoes it", () => {
    // First call: pointerup decides to show (the fix under test).
    const first = resolveTouchGestureEnd({
      alreadySettled: false,
      hadPendingLongPress: true,
      showOnTap: true,
    });
    expect(first).toEqual({ settled: true, action: "show" });

    // Second call: the trailing pointerleave, same gesture, timer now
    // cleared by the first call -- must not re-decide and close it.
    const second = resolveTouchGestureEnd({
      alreadySettled: first.settled,
      hadPendingLongPress: false,
      showOnTap: true,
    });
    expect(second).toEqual({ settled: true, action: "noop" });
  });

  it("stays a no-op even for a third call (pointercancel arriving after both pointerup and pointerleave)", () => {
    const third = resolveTouchGestureEnd({
      alreadySettled: true,
      hadPendingLongPress: false,
      showOnTap: true,
    });
    expect(third).toEqual({ settled: true, action: "noop" });
  });
});
