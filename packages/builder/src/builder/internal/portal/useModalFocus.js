import { useEffect } from "react";
import {
  getFocusableElements,
  getTabWrapTarget,
  resolveFocusRestoreTarget,
} from "./modalFocus.js";

// The focus contract the Builder's other dialogs already keep (Note Explorer, Scent Library, Collection DNA,
// fragrance details), for a dialog that has no nested layer of its own: focus moves in when it opens, Tab and
// Shift+Tab stay inside it, and focus goes back to whatever opened it when it closes. Escape and the body
// scroll lock stay with the dialog (they already work and differ per dialog); this hook owns focus only.
//
//   dialogRef          ref to the dialog element (give it tabIndex={-1}, so it can hold focus when nothing in it can)
//   openerRef          optional ref to the control that opened it, read from the click (see getOpenerFromEvent)
//   fallbackSelector   optional selector of a stable control to land on if the opener is gone
//
// Merchant-neutral: it knows no class names of any host, only the ones its caller passes.
export function useModalFocus({ dialogRef, openerRef, fallbackSelector }) {
  // In on open, to the first control (the header's Close: it never raises a touch keyboard and never scrolls
  // the page), and back to the opener on close, unless another dialog is already open (a hand-off, as from
  // the Composer's setup to its proposal) -- that dialog owns focus now.
  useEffect(() => {
    const dialog = dialogRef.current;
    const doc = dialog?.ownerDocument || document;
    const clickedOpener = openerRef?.current;
    const mountOpener = doc.activeElement;

    (getFocusableElements(dialog)[0] || dialog)?.focus({ preventScroll: true });

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
  }, [dialogRef]);
}
