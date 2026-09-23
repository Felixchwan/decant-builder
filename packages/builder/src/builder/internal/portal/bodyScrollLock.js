const lockStateByDocument = new WeakMap();

const noopRelease = () => {};

// The vertical scrollbar's own rendered width, measured live rather than
// assumed: `overflow: hidden` on body makes that scrollbar disappear, and on
// a platform where it takes up real layout space (most desktop browsers with
// a classic, non-overlay scrollbar), the page content reflows wider by
// exactly that width -- a visible horizontal shift the moment a modal opens.
// Comparing the window's own width to the root element's content width
// (both real, current measurements, taken BEFORE overflow is touched, while
// the scrollbar is still present) gives that width directly; it degrades to
// 0 -- no compensation, not a guessed fallback -- wherever either isn't
// available (a documentLike without a view/root, e.g. this module's own
// tests, or a platform with an overlay scrollbar that never reserved space
// to begin with, where clientWidth already equals innerWidth).
function measureScrollbarWidth(documentLike) {
  const view = documentLike?.defaultView;
  const root = documentLike?.documentElement;

  if (!view || !root || typeof view.innerWidth !== "number" || typeof root.clientWidth !== "number") {
    return 0;
  }

  const width = view.innerWidth - root.clientWidth;
  return width > 0 ? width : 0;
}

export function acquireBodyScrollLock(documentLike) {
  const body = documentLike?.body;

  if (!body?.style || (typeof documentLike !== "object" && typeof documentLike !== "function")) {
    return noopRelease;
  }

  // The element that actually scrolls in standards mode is
  // document.documentElement (<html>) via document.scrollingElement, NOT
  // <body> -- confirmed live: with only body.style.overflow set to
  // "hidden", window.scrollBy still moved the real page, because <html>'s
  // own overflow was untouched and it is the element actually holding the
  // scroll position. Both are locked here (documentElement, the one that
  // matters in standards mode; body too, for the older/quirks-mode browsers
  // that use it instead) rather than branching on which one
  // document.scrollingElement reports, since locking the element that
  // turns out not to be scrolling is inert, not harmful.
  const htmlElement = documentLike?.documentElement || null;

  if (!lockStateByDocument.has(documentLike)) {
    lockStateByDocument.set(documentLike, {
      body,
      htmlElement,
      count: 0,
      previousBodyOverflow: "",
      previousHtmlOverflow: "",
      previousPaddingRight: "",
    });
  }

  const state = lockStateByDocument.get(documentLike);

  if (state.count === 0) {
    try {
      // Measured (and, if needed, compensated for) only on this 0->1
      // transition -- so a second, nested acquire while already locked
      // never re-measures or stacks a second helping of compensation on
      // top of the first.
      const scrollbarWidth = measureScrollbarWidth(documentLike);
      state.previousBodyOverflow = body.style.overflow;
      state.previousPaddingRight = body.style.paddingRight;
      body.style.overflow = "hidden";

      if (htmlElement?.style) {
        state.previousHtmlOverflow = htmlElement.style.overflow;
        htmlElement.style.overflow = "hidden";
      }

      if (scrollbarWidth > 0) {
        const existingPaddingRight = parseFloat(state.previousPaddingRight) || 0;
        body.style.paddingRight = `${existingPaddingRight + scrollbarWidth}px`;
      }
    } catch {
      lockStateByDocument.delete(documentLike);
      return noopRelease;
    }
  }

  state.count += 1;
  let released = false;

  return () => {
    if (released) {
      return;
    }

    released = true;
    const currentState = lockStateByDocument.get(documentLike);

    if (!currentState) {
      return;
    }

    currentState.count -= 1;

    if (currentState.count > 0) {
      return;
    }

    lockStateByDocument.delete(documentLike);

    try {
      currentState.body.style.overflow = currentState.previousBodyOverflow;
      currentState.body.style.paddingRight = currentState.previousPaddingRight;

      if (currentState.htmlElement?.style) {
        currentState.htmlElement.style.overflow = currentState.previousHtmlOverflow;
      }
    } catch {
      // A detached or restricted body/html should not make cleanup fail.
    }
  };
}
