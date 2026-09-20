// The Composer's proposal generation is SYNCHRONOUS, CPU-bound work
// (buildComposerBoxProposal) that can hold the main thread for several
// seconds. Setting a "loading" flag in the same task that then runs that work
// is not enough to show anything: the browser only paints between tasks, so
// the flag is committed to the DOM but never reaches the screen before the
// thread is blocked. scheduleAfterPaint is the narrow asynchronous boundary
// that fixes this without a fake delay: requestAnimationFrame fires just
// before the next paint (by which point React has committed the loading
// state), and the timeout queued from inside it can only run in a LATER task
// -- i.e. after that frame has actually been painted. Only then does the heavy
// work start. Without requestAnimationFrame (non-browser environments) it
// degrades to a plain macrotask.
//
// Browsers pause requestAnimationFrame entirely for hidden or occluded
// documents, which would leave the loading state up forever. FRAME_STALL_MS is
// a stall guard for that case only -- it is never the mechanism that makes the
// loading state appear (the flag is committed before this is called) and it is
// far longer than a frame, so in a normally painting page the frame path always
// wins and the guard is cancelled.
export const FRAME_STALL_MS = 250;

export function scheduleAfterPaint(callback, environment = globalThis) {
  const { requestAnimationFrame, cancelAnimationFrame, setTimeout, clearTimeout } = environment;

  if (typeof requestAnimationFrame !== "function") {
    const timeoutId = setTimeout(callback, 0);
    return () => clearTimeout(timeoutId);
  }

  let settled = false;
  let timeoutId = null;
  let stallGuardId = null;

  const fire = () => {
    if (settled) {
      return;
    }
    settled = true;
    clearTimeout(stallGuardId);
    callback();
  };

  const frameId = requestAnimationFrame(() => {
    if (settled) {
      return;
    }
    clearTimeout(stallGuardId);
    timeoutId = setTimeout(fire, 0);
  });
  stallGuardId = setTimeout(fire, FRAME_STALL_MS);

  return () => {
    settled = true;
    if (typeof cancelAnimationFrame === "function") {
      cancelAnimationFrame(frameId);
    }
    clearTimeout(stallGuardId);
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
    }
  };
}

// One in-flight generation at a time, tracked by the real lifecycle (not a
// timer for appearance): "running" begins synchronously inside run(), before
// any work executes, and ends only once the work has succeeded or failed (or
// been cancelled). A second run() while one is in flight is refused, which is
// what makes double-clicks unable to start duplicate generations even before
// React has re-rendered a disabled button. A cancelled run's result is
// discarded and never committed.
export function createGenerationRunner({ schedule = scheduleAfterPaint } = {}) {
  let currentId = 0;
  let running = false;
  let cancelScheduled = null;

  return {
    isRunning: () => running,

    run({ work, onStart, onSuccess, onFailure, onSettled }) {
      if (running) {
        return false;
      }

      currentId += 1;
      const runId = currentId;
      running = true;
      onStart?.();

      cancelScheduled = schedule(() => {
        cancelScheduled = null;

        try {
          const result = work();

          if (runId !== currentId) {
            return;
          }

          onSuccess?.(result);
        } catch (error) {
          if (runId !== currentId) {
            return;
          }

          onFailure?.(error);
        } finally {
          if (runId === currentId) {
            running = false;
            onSettled?.();
          }
        }
      });

      return true;
    },

    cancel() {
      currentId += 1;
      running = false;

      if (cancelScheduled) {
        cancelScheduled();
        cancelScheduled = null;
      }
    },
  };
}
