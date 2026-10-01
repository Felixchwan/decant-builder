// Pure decision logic behind MetadataPreview's touch handling (see
// MetadataPreview.jsx). Kept separate so the exact event-ordering bug this
// guards against -- a touch's pointerup is immediately followed by a
// synthesized pointerleave, since a lifted touch has nothing left to
// "hover" -- can be unit tested directly, without a DOM/React renderer.
//
// onPointerUp, onPointerCancel, and onPointerLeave all route through this
// same decision for a given touch gesture. Only the FIRST of the three to
// fire actually decides the outcome; every later call for the same
// gesture is a no-op, so a trailing pointerleave can never re-run the
// decision with stale timer state and undo what pointerup already did.
export function resolveTouchGestureEnd({ alreadySettled, hadPendingLongPress, showOnTap }) {
  if (alreadySettled) {
    return { settled: true, action: "noop" };
  }

  // A quick tap releases before the long-press timer ever fires -- for a
  // showOnTap-enabled preview (a note with an active easter egg), that is
  // itself the trigger to open immediately, same as a real long press
  // would have. A release AFTER the long press already fired finds no
  // pending timer, so it still just closes the preview as before.
  if (hadPendingLongPress && showOnTap) {
    return { settled: true, action: "show" };
  }

  return { settled: true, action: "hide" };
}
