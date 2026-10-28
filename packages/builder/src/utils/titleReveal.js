// One-line fragrance titles that reveal their full name on demand.
//
// A title that does not fit its card is cut with an ellipsis at rest. When the person hovers the card (or
// reaches it with the keyboard) the title slides left until its last character is visible, holds there for
// a couple of seconds, then eases back to the start and stays there. It never loops: a new cycle only runs
// after the pointer/focus has left and come back.
//
// This module is deliberately DOM-light and clock-injected so the whole sequence is testable without a
// browser: `createTitleReveal` drives a single element's `scrollLeft` (a scroll position, so the clipping and
// the measured distance always agree with the real rendered text) and owns every timer it starts.

export const TITLE_REVEAL_TUNING = Object.freeze({
  startDelayMs: 320, // a short beat before moving, so a pointer merely crossing the card does not set it off
  outboundPxPerSecond: 40, // calm, readable reading speed (target band 35-50 px/s)
  returnPxPerSecond: 85, // the way back is allowed to be brisker than the way out
  holdMs: 2000, // rest on the full name
  minOutboundMs: 700, // a tiny overflow still moves like a glide, never a flick
  maxOutboundMs: 7000,
  minReturnMs: 450,
  maxReturnMs: 2500,
  minCancelReturnMs: 260, // leaving mid-way: settle home promptly but smoothly
});

export const REVEALING_CLASS = "perfume-card-name--revealing";

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";
const FINE_HOVER_QUERY = "(hover: hover) and (pointer: fine)";

function easeInOutSine(t) {
  return -(Math.cos(Math.PI * t) - 1) / 2;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function createTitleReveal({ element, env, tuning = TITLE_REVEAL_TUNING }) {
  // idle -> waiting -> out -> hold -> back -> idle
  let phase = "idle";
  let timerId = null;
  let frameId = null;
  const sources = new Set();

  const overflowDistance = () => Math.max(0, element.scrollWidth - element.clientWidth);
  const offset = () => element.scrollLeft;
  const setOffset = (value) => {
    element.scrollLeft = value;
  };

  function clearTimer() {
    if (timerId !== null) {
      env.clearTimeout(timerId);
      timerId = null;
    }
  }

  function stopTween() {
    if (frameId !== null) {
      env.cancelAnimationFrame(frameId);
      frameId = null;
    }
  }

  function settleAtRest() {
    clearTimer();
    stopTween();
    phase = "idle";
    setOffset(0);
    element.classList.remove(REVEALING_CLASS);
  }

  function animate(from, to, duration, done) {
    stopTween();
    const startedAt = env.now();
    const tick = () => {
      frameId = null;
      // A card removed mid-sequence (a filter change) must not keep timers or frames alive.
      if (element.isConnected === false) {
        clearTimer();
        phase = "idle";
        return;
      }
      const progress = clamp((env.now() - startedAt) / duration, 0, 1);
      setOffset(from + (to - from) * easeInOutSine(progress));
      if (progress >= 1) {
        done();
      } else {
        frameId = env.requestAnimationFrame(tick);
      }
    };
    frameId = env.requestAnimationFrame(tick);
  }

  function goBack(duration) {
    phase = "back";
    animate(offset(), 0, duration, settleAtRest);
  }

  function startBack() {
    timerId = null;
    goBack(clamp((offset() / tuning.returnPxPerSecond) * 1000, tuning.minReturnMs, tuning.maxReturnMs));
  }

  function startHold() {
    phase = "hold";
    timerId = env.setTimeout(startBack, tuning.holdMs);
  }

  function startOutbound() {
    timerId = null;
    // Measured now, from the real rendered text: where the last character comes into view.
    const target = overflowDistance();
    const from = offset();
    const remaining = target - from;
    if (target <= 1) {
      settleAtRest();
      return;
    }
    phase = "out";
    element.classList.add(REVEALING_CLASS);
    if (remaining <= 0.5) {
      startHold();
      return;
    }
    const duration = clamp((remaining / tuning.outboundPxPerSecond) * 1000, tuning.minOutboundMs, tuning.maxOutboundMs);
    animate(from, target, duration, startHold);
  }

  function begin() {
    clearTimer();
    stopTween();
    phase = "waiting";
    timerId = env.setTimeout(startOutbound, tuning.startDelayMs);
  }

  // The complete name must never depend on the animation: when it will not run, expose it natively.
  function exposeFullName() {
    if (overflowDistance() > 1 && !element.title) {
      element.title = element.textContent;
    }
  }

  function canAnimate(source) {
    if (env.matchMedia(REDUCED_MOTION_QUERY).matches) {
      return false;
    }
    return source === "focus" ? true : env.matchMedia(FINE_HOVER_QUERY).matches;
  }

  return {
    get phase() {
      return phase;
    },
    // A hover or focus began on the card. Only the FIRST source starts a cycle, so hovering a card the keyboard
    // already holds (or vice versa) can never begin a second one.
    enter(source) {
      const wasEmpty = sources.size === 0;
      sources.add(source);
      if (!wasEmpty) {
        return;
      }
      if (!canAnimate(source)) {
        exposeFullName();
        return;
      }
      if (overflowDistance() <= 1) {
        return; // fits: static, no animation state at all
      }
      if (phase === "idle" || phase === "back") {
        begin(); // from rest, or resuming from wherever a cancelled return had reached (no jump)
      }
    },
    // Hover/focus ended. When nothing holds the card any more, stop and glide home.
    leave(source) {
      sources.delete(source);
      if (sources.size > 0) {
        return;
      }
      if (phase === "waiting") {
        clearTimer();
        if (offset() > 0.5) {
          goBack(clamp((offset() / tuning.returnPxPerSecond) * 1000, tuning.minCancelReturnMs, tuning.maxReturnMs));
        } else {
          settleAtRest();
        }
      } else if (phase === "out" || phase === "hold") {
        clearTimer();
        stopTween();
        goBack(clamp((offset() / tuning.returnPxPerSecond) * 1000, tuning.minCancelReturnMs, tuning.maxReturnMs));
      }
    },
    destroy() {
      sources.clear();
      settleAtRest();
    },
  };
}

// ---- DOM glue (no React state, so the card stays a plain function) -------------------------------------------
const controllers = new WeakMap();

function browserEnv() {
  return {
    now: () => performance.now(),
    requestAnimationFrame: (callback) => window.requestAnimationFrame(callback),
    cancelAnimationFrame: (id) => window.cancelAnimationFrame(id),
    setTimeout: (callback, ms) => window.setTimeout(callback, ms),
    clearTimeout: (id) => window.clearTimeout(id),
    matchMedia: (query) => window.matchMedia(query),
  };
}

function controllerFor(card) {
  const title = card?.querySelector?.(".perfume-card-name");
  if (!title) {
    return null;
  }
  let controller = controllers.get(title);
  if (!controller) {
    controller = createTitleReveal({ element: title, env: browserEnv() });
    controllers.set(title, controller);
  }
  return controller;
}

function isMouseLike(event) {
  return !event.pointerType || event.pointerType === "mouse" || event.pointerType === "pen";
}

// Spread onto the card element. Touch never triggers a reveal; keyboard focus does (focus-visible only, so a
// mouse click on the Add button does not).
export const titleRevealHandlers = Object.freeze({
  onPointerEnter(event) {
    if (isMouseLike(event)) {
      controllerFor(event.currentTarget)?.enter("pointer");
    }
  },
  onPointerLeave(event) {
    if (isMouseLike(event)) {
      controllerFor(event.currentTarget)?.leave("pointer");
    }
  },
  onFocus(event) {
    if (event.target?.matches?.(":focus-visible")) {
      controllerFor(event.currentTarget)?.enter("focus");
    }
  },
  onBlur(event) {
    if (!event.currentTarget.contains(event.relatedTarget)) {
      controllerFor(event.currentTarget)?.leave("focus");
    }
  },
});
