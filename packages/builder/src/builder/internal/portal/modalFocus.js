// Small, dependency-free focus helpers for the Builder's modal dialogs. They are
// pure over a DOM-like element (querySelectorAll / contains / getClientRects /
// closest), so the decisions can be tested without a browser; the effects that
// call them live with the modal that needs them.

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled]):not([type='hidden'])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

function isRendered(element) {
  return typeof element.getClientRects !== "function" || element.getClientRects().length > 0;
}

function isInert(element) {
  return typeof element.closest === "function" && Boolean(element.closest("[inert]"));
}

// Tabbable descendants of the container, in document order, that are actually
// laid out (display:none content is skipped) and not inside an inert subtree
// (the browser will not give those focus, so a wrap onto one would strand it).
export function getFocusableElements(container) {
  if (!container || typeof container.querySelectorAll !== "function") {
    return [];
  }

  return Array.from(container.querySelectorAll(FOCUSABLE_SELECTOR)).filter(
    (element) => isRendered(element) && !isInert(element)
  );
}

// Where Tab / Shift+Tab should be sent to keep focus inside `container`, or
// null when the browser's own move is already correct and should be left alone.
// `container` itself may be the active element (it is focusable with
// tabindex=-1 so clicks inside it keep focus in the dialog).
export function getTabWrapTarget({ container, focusable, active, shiftKey }) {
  if (!container) {
    return null;
  }

  if (focusable.length === 0) {
    return container;
  }

  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  const isInside = Boolean(active) && (active === container || container.contains(active));

  if (!isInside) {
    return shiftKey ? last : first;
  }

  if (shiftKey) {
    return active === first || active === container ? last : null;
  }

  return active === last ? first : null;
}

// Whether returning focus to a remembered element is safe: it must still be in
// the document, enabled, laid out, and not inside an inert subtree. Anything
// else (removed, hidden, disabled, inert) falls back to a stable surface
// rather than stranding focus on <body>.
export function isRestorableFocusTarget(element) {
  if (!element || typeof element.focus !== "function") {
    return false;
  }

  if (element.isConnected === false || element.disabled) {
    return false;
  }

  if (typeof element.closest === "function" && element.closest("[inert]")) {
    return false;
  }

  return isRendered(element);
}

// The control that opened a dialog, read from the click that opened it. Safari and Firefox on macOS do not
// focus a button on click, so document.activeElement at mount can be <body>; the event's currentTarget is the
// control either way. Returns the element, null when there is no usable one (an open that did not come from a
// click), or undefined when the click came from inside another dialog (a "back" button that reopens this one):
// the caller then keeps what it remembered before.
export function getOpenerFromEvent(event) {
  const element = event?.currentTarget;

  if (!element || element.nodeType !== 1) {
    return null;
  }

  if (typeof element.closest === "function" && element.closest('[role="dialog"]')) {
    return undefined;
  }

  return element;
}

// Whether another dialog has taken over from `dialog` as it closes (a hand-off, as from the Composer's setup to
// its proposal), in which case that dialog owns focus and this one must not move it. A dialog that was already
// open underneath when `dialog` opened (`dialogsBelow`, a Set read at mount) has not taken over anything: it is
// where the user was, so focus goes back there (a rare-selection confirmation closing over fragrance details).
export function hasDialogTakenOver({ dialog, openDialogs, dialogsBelow }) {
  return openDialogs.some((other) => other !== dialog && !dialogsBelow.has(other));
}

// The dialog that is left on top once `dialog` closes: the last (topmost, since layers are mounted in stacking
// order) of the other open dialogs, or null when the page itself is what is left behind.
export function getDialogBeneath({ dialog, openDialogs }) {
  const others = openDialogs.filter((other) => other !== dialog);

  return others.length > 0 ? others[others.length - 1] : null;
}

// Where focus goes when a dialog closes: the first candidate that can still take it (never <body>), in the
// caller's order of preference. Null when none can, so the caller leaves focus alone.
export function resolveFocusRestoreTarget(candidates, body) {
  return candidates.find((element) => element && element !== body && isRestorableFocusTarget(element)) || null;
}
