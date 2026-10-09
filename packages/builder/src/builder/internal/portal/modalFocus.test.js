import { describe, expect, it } from "vitest";
import { getFocusableElements, getTabWrapTarget, isRestorableFocusTarget } from "./modalFocus.js";

// Minimal DOM-like fakes: the helpers only need contains / querySelectorAll /
// getClientRects / closest / focus, so the decisions are testable without a browser.
function fakeContainer(children = []) {
  const container = {
    children,
    querySelectorAll: () => children,
    contains: (node) => node === container || children.includes(node),
  };
  return container;
}

const control = (name, { rendered = true } = {}) => ({
  name,
  getClientRects: () => (rendered ? [{}] : []),
});

describe("getFocusableElements", () => {
  it("returns the container's tabbable descendants that are laid out, in order", () => {
    const close = control("close");
    const hidden = control("hidden", { rendered: false });
    const next = control("next");

    expect(getFocusableElements(fakeContainer([close, hidden, next]))).toEqual([close, next]);
  });

  it("is safe on a missing container", () => {
    expect(getFocusableElements(null)).toEqual([]);
    expect(getFocusableElements({})).toEqual([]);
  });
});

describe("getTabWrapTarget", () => {
  const close = control("close");
  const add = control("add");
  const next = control("next");
  const container = fakeContainer([close, add, next]);
  const focusable = [close, add, next];
  const wrap = (active, shiftKey = false) => getTabWrapTarget({ container, focusable, active, shiftKey });

  it("wraps Tab from the last control to the first, and Shift+Tab from the first to the last", () => {
    expect(wrap(next)).toBe(close);
    expect(wrap(close, true)).toBe(next);
  });

  it("leaves Tab alone anywhere in the middle (the browser's own move is already inside the dialog)", () => {
    expect(wrap(close)).toBeNull();
    expect(wrap(add)).toBeNull();
    expect(wrap(add, true)).toBeNull();
    expect(wrap(next, true)).toBeNull();
  });

  it("treats the dialog container itself (focusable with tabindex -1) as 'before the first control'", () => {
    expect(wrap(container)).toBeNull();
    expect(wrap(container, true)).toBe(next);
  });

  it("pulls focus back in when it is somewhere outside the dialog", () => {
    const behind = control("behind-the-overlay");

    expect(wrap(behind)).toBe(close);
    expect(wrap(behind, true)).toBe(next);
    expect(wrap(null)).toBe(close);
  });

  it("keeps focus on the container when the dialog has nothing tabbable", () => {
    expect(getTabWrapTarget({ container, focusable: [], active: container, shiftKey: false })).toBe(container);
  });

  it("does nothing without a container", () => {
    expect(getTabWrapTarget({ container: null, focusable: [], active: null, shiftKey: false })).toBeNull();
  });
});

describe("isRestorableFocusTarget", () => {
  const focusable = (overrides = {}) => ({
    focus() {},
    isConnected: true,
    disabled: false,
    closest: () => null,
    getClientRects: () => [{}],
    ...overrides,
  });

  it("accepts a connected, enabled, laid-out element outside any inert subtree", () => {
    expect(isRestorableFocusTarget(focusable())).toBe(true);
  });

  it.each([
    ["no element", null],
    ["something that can't take focus", { isConnected: true }],
    ["a removed element", focusable({ isConnected: false })],
    ["a disabled element", focusable({ disabled: true })],
    ["a hidden element", focusable({ getClientRects: () => [] })],
    ["an element inside an inert subtree", focusable({ closest: (selector) => (selector === "[inert]" ? {} : null) })],
  ])("rejects %s, so focus falls back to a stable surface instead of <body>", (_label, element) => {
    expect(isRestorableFocusTarget(element)).toBe(false);
  });
});
