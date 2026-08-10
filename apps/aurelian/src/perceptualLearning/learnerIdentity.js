// Anonymous, local, per-device Learner identity (ADR-0021). Not an account,
// not linked to Customer -- see docs/domain/PERCEPTUAL_LEARNING_DOMAIN_MODEL.md
// §3 for why these are deliberately separate identities. Pure -- no storage
// access here; the persistence adapter decides when a resolved id is
// actually written.

export function createLearnerId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  // Mirrors src/analytics/createAnalytics.js's own fallback for environments
  // without crypto.randomUUID.
  return `learner_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`;
}

export function isValidLearnerId(value) {
  return typeof value === "string" && value.trim().length >= 8;
}

export function resolveLearnerId(currentLearnerId) {
  return isValidLearnerId(currentLearnerId) ? currentLearnerId : createLearnerId();
}
