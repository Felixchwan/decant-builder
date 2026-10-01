const DEFAULT_EASTER_EGG_DURATION_MS = 2000;

// Framework-agnostic timer state machine behind the note-easter-egg
// capability (see useNoteEasterEgg.js for the thin React wrapper). Kept
// separate from React so retrigger/timeout/cleanup behavior can be unit
// tested directly with fake timers, independent of any rendering
// environment. Carries no note identity or copy -- it only schedules and
// cancels a plain boolean flip.
export function createNoteEasterEggController({ durationMs, onChange }) {
  let timeoutId = null;

  function clearPendingTimeout() {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
  }

  function trigger() {
    clearPendingTimeout();
    onChange(true);
    timeoutId = setTimeout(() => {
      timeoutId = null;
      onChange(false);
    }, durationMs || DEFAULT_EASTER_EGG_DURATION_MS);
  }

  function dispose() {
    clearPendingTimeout();
  }

  return { trigger, dispose };
}
