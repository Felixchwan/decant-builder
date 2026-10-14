import { describe, expect, it } from "vitest";
import {
  getDialogBeneath,
  getFocusableElements,
  getOpenerFromEvent,
  getTabWrapTarget,
  hasDialogTakenOver,
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

describe("hasDialogTakenOver", () => {
  const dialog = { name: "warning" };
  const details = { name: "fragrance details" };
  const proposal = { name: "composer proposal" };

  it("is a hand-off when a dialog that was not open at mount is open at close (the Composer's setup handing to its proposal)", () => {
    expect(hasDialogTakenOver({ dialog, openDialogs: [dialog, proposal], dialogsBelow: new Set() })).toBe(true);
  });

  it("is not a hand-off when the only other dialog was already open underneath at mount: a rare-selection confirmation over fragrance details gives focus back into them", () => {
    expect(hasDialogTakenOver({ dialog, openDialogs: [details, dialog], dialogsBelow: new Set([details]) })).toBe(false);
  });

  it("is still a hand-off when a new dialog opens while one stays underneath", () => {
    expect(hasDialogTakenOver({ dialog, openDialogs: [details, dialog, proposal], dialogsBelow: new Set([details]) })).toBe(true);
  });

  it("is not a hand-off when this dialog is the only one left, or when it is already gone from the document", () => {
    expect(hasDialogTakenOver({ dialog, openDialogs: [dialog], dialogsBelow: new Set() })).toBe(false);
    expect(hasDialogTakenOver({ dialog, openDialogs: [], dialogsBelow: new Set([details]) })).toBe(false);
  });
});

describe("getDialogBeneath", () => {
  const dialog = { name: "warning" };
  const noteExplorer = { name: "note explorer" };
  const details = { name: "fragrance details" };

  it("is the topmost dialog still open once this one closes (layers are mounted in stacking order)", () => {
    expect(getDialogBeneath({ dialog, openDialogs: [noteExplorer, details, dialog] })).toBe(details);
    expect(getDialogBeneath({ dialog, openDialogs: [noteExplorer, dialog] })).toBe(noteExplorer);
  });

  it("is null when the page itself is what is left behind", () => {
    expect(getDialogBeneath({ dialog, openDialogs: [dialog] })).toBeNull();
    expect(getDialogBeneath({ dialog, openDialogs: [] })).toBeNull();
  });
});

// The decision the rare-selection confirmation's close makes, end to end over the pure helpers: is another dialog a
// successor or the layer it sat on, and where does focus go when its opener cannot take it.
describe("closing a dialog that sat on top of another", () => {
  const body = { name: "body" };
  const control = (name, over = {}) => ({ name, focus() {}, isConnected: true, disabled: false, closest: () => null, getClientRects: () => [{}], ...over });
  const warning = { name: "warning" };
  const underneath = { name: "note explorer", querySelectorAll: () => [close, row], contains: () => true };
  const close = control("Close");
  const row = control("row Add");

  const landing = ({ openDialogs, dialogsBelow, opener, mountOpener = null }) => {
    if (hasDialogTakenOver({ dialog: warning, openDialogs, dialogsBelow })) {
      return "left alone: another dialog owns focus";
    }

    const beneath = getDialogBeneath({ dialog: warning, openDialogs });
    const fallbacks = beneath ? [getFocusableElements(beneath)[0]] : [];

    return resolveFocusRestoreTarget([opener, mountOpener, ...fallbacks], body)?.name ?? "nothing: focus left alone";
  };

  it("a dialog that existed underneath is not a successor: focus goes back to the exact opener inside it", () => {
    expect(landing({ openDialogs: [underneath, warning], dialogsBelow: new Set([underneath]), opener: row })).toBe("row Add");
  });

  it("a dialog that took over from the closing one is a successor: the closing one leaves focus alone", () => {
    const successor = { name: "composer proposal" };

    expect(landing({ openDialogs: [successor, warning], dialogsBelow: new Set(), opener: row })).toBe("left alone: another dialog owns focus");
  });

  it("with no other dialog the opener is restored, and with nothing restorable focus is left alone, never sent to <body>", () => {
    expect(landing({ openDialogs: [warning], dialogsBelow: new Set(), opener: row })).toBe("row Add");
    expect(landing({ openDialogs: [warning], dialogsBelow: new Set(), opener: null, mountOpener: body })).toBe("nothing: focus left alone");
  });

  it("when the opener is gone (disabled, or unmounted by what the confirmation did) the dialog underneath gets focus, on its first control", () => {
    const disabledRow = control("row Add", { disabled: true });
    const unmountedRow = control("row Add", { isConnected: false });

    expect(landing({ openDialogs: [underneath, warning], dialogsBelow: new Set([underneath]), opener: disabledRow })).toBe("Close");
    expect(landing({ openDialogs: [underneath, warning], dialogsBelow: new Set([underneath]), opener: unmountedRow })).toBe("Close");
    expect(landing({ openDialogs: [underneath, warning], dialogsBelow: new Set([underneath]), opener: null })).toBe("Close");
  });
});
