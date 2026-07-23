export function clearSavedBuilderState(storageKey) {
  if (!storageKey || typeof window === "undefined") {
    return false;
  }

  try {
    window.localStorage?.removeItem(storageKey);
    return true;
  } catch {
    return false;
  }
}
