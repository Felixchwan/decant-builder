import { describe, expect, it } from "vitest";
import {
  getFocusableElements,
  getOpenerFromEvent,
  getTabWrapTarget,
  isRestorableFocusTarget,
  resolveFocusRestoreTarget,
} from "./modalFocus.js";

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

  it("skips controls inside an inert subtree: the browser would not give them focus, so a wrap onto one would strand it", () => {
    const form = { name: "form", getClientRects: () => [{}], closest: (selector) => (selector === "[inert]" ? {} : null) };
    const close = { name: "close", getClientRects: () => [{}], closest: () => null };

    expect(getFocusableElements(fakeContainer([close, form]))).toEqual([close]);
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

describe("getOpenerFromEvent", () => {
  const button = (inDialog = false) => ({ nodeType: 1, closest: (selector) => (selector === '[role="dialog"]' && inDialog ? {} : null) });

  it("is the control the click landed on, even where the browser never focuses a button on click", () => {
    const opener = button();

    expect(getOpenerFromEvent({ currentTarget: opener })).toBe(opener);
  });

  it("is null when the dialog was not opened by a click on an element", () => {
    expect(getOpenerFromEvent(undefined)).toBeNull();
    expect(getOpenerFromEvent({})).toBeNull();
    expect(getOpenerFromEvent({ currentTarget: { nodeType: 3 } })).toBeNull();
  });

  it("is undefined for a click inside another dialog (a Back button that reopens this one): keep what was remembered", () => {
    expect(getOpenerFromEvent({ currentTarget: button(true) })).toBeUndefined();
  });
});

describe("resolveFocusRestoreTarget", () => {
  const body = { name: "body" };
  const ok = (name) => ({ name, focus() {}, isConnected: true, disabled: false, closest: () => null, getClientRects: () => [{}] });

  it("takes the first candidate that can still take focus, in the caller's order", () => {
    const clicked = ok("clicked");
    const active = ok("active");

    expect(resolveFocusRestoreTarget([clicked, active, ok("fallback")], body)).toBe(clicked);
    expect(resolveFocusRestoreTarget([{ ...ok("gone"), isConnected: false }, active], body)).toBe(active);
    expect(resolveFocusRestoreTarget([null, { ...ok("off"), disabled: true }, ok("fallback")], body).name).toBe("fallback");
  });

  it("never picks <body>, and is null (leave focus alone) when nothing qualifies", () => {
    expect(resolveFocusRestoreTarget([body, null, undefined], body)).toBeNull();
    expect(resolveFocusRestoreTarget([], body)).toBeNull();
  });
});
