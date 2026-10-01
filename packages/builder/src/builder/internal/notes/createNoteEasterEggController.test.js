import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createNoteEasterEggController } from "./createNoteEasterEggController.js";

describe("createNoteEasterEggController", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("activates immediately and restores after the default ~2 second duration", () => {
    const onChange = vi.fn();
    const controller = createNoteEasterEggController({ onChange });

    controller.trigger();
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenLastCalledWith(true);

    vi.advanceTimersByTime(1999);
    expect(onChange).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(1);
    expect(onChange).toHaveBeenCalledTimes(2);
    expect(onChange).toHaveBeenLastCalledWith(false);
  });

  it("honors a host-supplied custom duration", () => {
    const onChange = vi.fn();
    const controller = createNoteEasterEggController({ durationMs: 500, onChange });

    controller.trigger();
    vi.advanceTimersByTime(499);
    expect(onChange).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(1);
    expect(onChange).toHaveBeenCalledTimes(2);
    expect(onChange).toHaveBeenLastCalledWith(false);
  });

  it("restarts the duration cleanly on retrigger without an intermediate restore", () => {
    const onChange = vi.fn();
    const controller = createNoteEasterEggController({ onChange });

    controller.trigger();
    vi.advanceTimersByTime(1500);
    controller.trigger();

    // Retriggering re-affirms the active state but must not flip it off in
    // between -- every call so far has only ever reported `true`.
    expect(onChange).toHaveBeenCalledTimes(2);
    expect(onChange.mock.calls.every(([value]) => value === true)).toBe(true);

    // The original timer must have been cancelled: at the point it would
    // have fired (500ms after the first trigger), nothing happens.
    vi.advanceTimersByTime(500);
    expect(onChange).toHaveBeenCalledTimes(2);

    // The restarted timer completes a full fresh duration from the retrigger.
    vi.advanceTimersByTime(1500);
    expect(onChange).toHaveBeenCalledTimes(3);
    expect(onChange).toHaveBeenLastCalledWith(false);
  });

  it("never calls onChange after dispose, even if a timer was already pending", () => {
    const onChange = vi.fn();
    const controller = createNoteEasterEggController({ onChange });

    controller.trigger();
    expect(onChange).toHaveBeenCalledTimes(1);

    controller.dispose();
    vi.advanceTimersByTime(5000);

    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it("is safe to dispose repeatedly or before any trigger", () => {
    const onChange = vi.fn();
    const controller = createNoteEasterEggController({ onChange });

    expect(() => controller.dispose()).not.toThrow();
    expect(() => controller.dispose()).not.toThrow();
    expect(onChange).not.toHaveBeenCalled();
  });
});
