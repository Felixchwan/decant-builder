import { useEffect, useRef } from "react";
import {
  getFocusableElements,
  getTabWrapTarget,
  resolveFocusRestoreTarget,
} from "./modalFocus.js";

// The focus contract the Builder's other dialogs already keep (Note Explorer, Scent Library, Collection DNA,
// fragrance details): focus moves in when it opens, Tab and Shift+Tab stay inside it, and focus goes back to
// whatever opened it when it closes. Escape and the body scroll lock stay with the dialog (they already work
// and differ per dialog); this hook owns focus only.
//
//   dialogRef            ref to the dialog element (give it tabIndex={-1}, so it can hold focus when nothing in it can)
//   openerRef            optional ref to the control that opened it, read from the click (see getOpenerFromEvent)
//   fallbackSelector     optional selector of a stable control to land on if the opener is gone
//   initialFocusSelector optional selector of the control to focus on open; the first control when absent
//   suspended            true while another dialog is open on top of this one (fragrance details opened from a
//                        row): the Tab trap stands down so it never pulls focus out from under that layer, and
//                        when that layer closes, focus that fell to <body> is brought back in
//
// Merchant-neutral: it knows no class names of any host, only the ones its caller passes.
export function useModalFocus({ dialogRef, openerRef, fallbackSelector, initialFocusSelector, suspended = false }) {
  // In on open, to the control the caller names or else the first one (the header's Close: it never raises a
  // touch keyboard and never scrolls the page), and back to the opener on close, unless another dialog is
  // already open (a hand-off, as from the Composer's setup to its proposal, or from its proposal back to the
  // setup) -- that dialog owns focus now.
  useEffect(() => {
    const dialog = dialogRef.current;
    const doc = dialog?.ownerDocument || document;
    const clickedOpener = openerRef?.current;
    const mountOpener = doc.activeElement;
    const named = initialFocusSelector ? dialog?.querySelector(initialFocusSelector) : null;

    (named || getFocusableElements(dialog)[0] || dialog)?.focus({ preventScroll: true });

    return () => {
      const isHandedOff = Array.from(doc.querySelectorAll('[role="dialog"]')).some((other) => other !== dialog);

      if (isHandedOff) {
        return;
      }

      const fallback = fallbackSelector ? doc.querySelector(fallbackSelector) : null;

      resolveFocusRestoreTarget([clickedOpener, mountOpener, fallback], doc.body)?.focus({
        preventScroll: true,
      });
    };
    // Mount and unmount only: the refs and the selector are stable for a dialog's lifetime.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Tab / Shift+Tab wrap inside the dialog, including when focus was lost to <body> (the control that had it
  // was unmounted, or went inert) or sits somewhere behind it. Focus inside a different dialog layer is left
  // to that layer.
  useEffect(() => {
    if (suspended) {
      return undefined;
    }

    function handleKeyDown(event) {
      const dialog = dialogRef.current;

      if (event.key !== "Tab" || !dialog) {
        return;
      }

      const active = dialog.ownerDocument.activeElement;
      const otherLayer = active?.closest?.('[role="dialog"]');

      if (otherLayer && otherLayer !== dialog) {
        return;
      }

      const wrapTarget = getTabWrapTarget({
        container: dialog,
        focusable: getFocusableElements(dialog),
        active: !active || active === dialog.ownerDocument.body ? null : active,
        shiftKey: event.shiftKey,
      });

      if (wrapTarget) {
        event.preventDefault();
        wrapTarget.focus({ preventScroll: true });
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [dialogRef, suspended]);

  // When the layer on top closes it hands focus back to its own opener, which is a control in this dialog. If
  // it could not (the browser never focused that control on click), the Builder parks focus on its main surface
  // behind this dialog, after this effect has run (its effect belongs to a parent, so it runs later in the
  // same commit): bring it back in, to the same control as on open. One zero-delay timer, the same one the
  // Note Explorer uses for the same hand-back.
  const wasSuspendedRef = useRef(false);

  useEffect(() => {
    const wasSuspended = wasSuspendedRef.current;

    wasSuspendedRef.current = suspended;

    if (!wasSuspended || suspended) {
      return undefined;
    }

    const timer = window.setTimeout(() => {
      const dialog = dialogRef.current;

      if (!dialog) {
        return;
      }

      const active = dialog.ownerDocument.activeElement;

      // Only when focus is behind the dialog (<body>, or the page): not in this dialog, not in another one.
      if (active && active !== dialog.ownerDocument.body && (dialog.contains(active) || active.closest?.('[role="dialog"]'))) {
        return;
      }

      const named = initialFocusSelector ? dialog.querySelector(initialFocusSelector) : null;

      (named || getFocusableElements(dialog)[0] || dialog).focus({ preventScroll: true });
    }, 0);

    return () => window.clearTimeout(timer);
  }, [suspended, dialogRef, initialFocusSelector]);
}
