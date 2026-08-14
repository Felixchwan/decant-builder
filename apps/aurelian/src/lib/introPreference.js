// Aurelian-owned UI preference, unrelated to Builder/domain persistence
// (aurelianConfig.persistence.storageKey, the box itself): this only
// remembers whether the visitor dismissed the /build-your-box intro text.
// No schema, no versioning -- a single boolean flag is the entire contract.
export const INTRO_DISMISSED_STORAGE_KEY = "aurelian-intro-dismissed-v1";

export function readIntroDismissedPreference() {
  if (typeof window === "undefined") {
    return false;
  }

  try {
    return window.localStorage.getItem(INTRO_DISMISSED_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

export function writeIntroDismissedPreference(isDismissed) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    if (isDismissed) {
      window.localStorage.setItem(INTRO_DISMISSED_STORAGE_KEY, "true");
    } else {
      window.localStorage.removeItem(INTRO_DISMISSED_STORAGE_KEY);
    }
  } catch {
    // Best-effort only -- unavailable storage (private browsing, quota)
    // should never block the Builder.
  }
}
