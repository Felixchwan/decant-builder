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

// Tabbable descendants of the container, in document order, that are actually
// laid out (display:none content is skipped).
export function getFocusableElements(container) {
  if (!container || typeof container.querySelectorAll !== "function") {
    return [];
  }

  return Array.from(container.querySelectorAll(FOCUSABLE_SELECTOR)).filter(isRendered);
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
