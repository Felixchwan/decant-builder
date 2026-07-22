export const COMPOSER_MODES = Object.freeze({
  FAST: "fast",
  BEST: "best",
});

export const DEFAULT_COMPOSER_MODE = COMPOSER_MODES.BEST;

export function normalizeComposerMode(mode) {
  if (mode === COMPOSER_MODES.FAST || mode === COMPOSER_MODES.BEST) {
    return {
      mode,
      inputIssue: null,
    };
  }

  if (mode === undefined || mode === null || mode === "") {
    return {
      mode: DEFAULT_COMPOSER_MODE,
      inputIssue: null,
    };
  }

  return {
    mode: DEFAULT_COMPOSER_MODE,
    inputIssue: {
      code: "UNKNOWN_COMPOSER_MODE",
      mode,
      defaultMode: DEFAULT_COMPOSER_MODE,
    },
  };
}
