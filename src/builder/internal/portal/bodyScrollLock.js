const lockStateByDocument = new WeakMap();

const noopRelease = () => {};

export function acquireBodyScrollLock(documentLike) {
  const body = documentLike?.body;

  if (!body?.style || (typeof documentLike !== "object" && typeof documentLike !== "function")) {
    return noopRelease;
  }

  let state = lockStateByDocument.get(documentLike);

  if (!state) {
    state = {
      body,
      count: 0,
      previousOverflow: "",
    };
    lockStateByDocument.set(documentLike, state);
  }

  if (state.count === 0) {
    try {
      state.previousOverflow = body.style.overflow;
      body.style.overflow = "hidden";
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
      currentState.body.style.overflow = currentState.previousOverflow;
    } catch {
      // A detached or restricted body should not make cleanup fail.
    }
  };
}
