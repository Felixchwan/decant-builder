// Observation -- an Aggregate Root recording evidence reported by the
// Learner (see docs/domain/PERCEPTUAL_LEARNING_DOMAIN_MODEL.md §4). Never a
// user rating or a claim about the fragrance itself -- freeText is the
// Learner's own words, preserved verbatim, never rewritten or summarized.
// Append-only by architecture: this module exposes no update/mutate helper,
// only creation. A changed mind is a new Observation, not an edit to this
// one.

import { OBSERVATION_MOMENT_VALUES } from "./momentVocabulary.js";

const OBSERVATION_KEYS = new Set([
  "observationId",
  "encounterInstanceId",
  "learnerId",
  "moment",
  "freeText",
  "createdAt",
]);

export function createObservation({
  encounterInstanceId,
  learnerId,
  moment,
  freeText,
  createdAt,
  comparisonRef,
  structuredContrastAnswer,
  confidence,
}) {
  // These three are Phase-2 vocabulary (contrastive evidence, confidence)
  // that this schema version does not persist. A caller that explicitly
  // supplies a real value is using future-phase vocabulary; fail loudly
  // rather than silently discard it -- see the Phase-1 hardening note in
  // docs/adr/0021-....
  if (comparisonRef !== undefined && comparisonRef !== null) {
    throw new Error(
      "createObservation: comparisonRef is not supported in Phase 1 (contrastive evidence does not exist yet)."
    );
  }

  if (structuredContrastAnswer !== undefined && structuredContrastAnswer !== null) {
    throw new Error(
      "createObservation: structuredContrastAnswer is not supported in Phase 1 (contrastive evidence does not exist yet)."
    );
  }

  if (confidence !== undefined && confidence !== null) {
    throw new Error("createObservation: confidence is not supported in Phase 1.");
  }

  if (typeof encounterInstanceId !== "string" || encounterInstanceId.trim().length === 0) {
    throw new Error("createObservation: encounterInstanceId is required.");
  }

  if (typeof learnerId !== "string" || learnerId.trim().length === 0) {
    throw new Error("createObservation: learnerId is required.");
  }

  if (!OBSERVATION_MOMENT_VALUES.includes(moment)) {
    throw new Error(`createObservation: moment must be one of ${OBSERVATION_MOMENT_VALUES.join(", ")}.`);
  }

  // Trimmed only to decide blankness -- the stored freeText preserves
  // exactly what the Learner submitted, not a normalized/trimmed copy.
  if (typeof freeText !== "string" || freeText.trim().length === 0) {
    throw new Error("createObservation: freeText must be a non-blank string.");
  }

  return Object.freeze({
    observationId: createId(),
    encounterInstanceId,
    learnerId,
    moment,
    freeText,
    createdAt: typeof createdAt === "string" ? createdAt : new Date().toISOString(),
  });
}

// Pure structural predicate, used by the persistence adapter to validate a
// persisted record on read. Strict about the key set -- a Phase-2 field
// (comparisonRef, structuredContrastAnswer, confidence) present on a
// persisted record is a schema-v1 violation, not something to tolerate.
export function isValidPersistedObservation(record) {
  if (!isPlainObject(record)) {
    return false;
  }

  if (Object.keys(record).some((key) => !OBSERVATION_KEYS.has(key))) {
    return false;
  }

  if (typeof record.observationId !== "string" || record.observationId.trim().length === 0) {
    return false;
  }

  if (
    typeof record.encounterInstanceId !== "string" ||
    record.encounterInstanceId.trim().length === 0
  ) {
    return false;
  }

  if (typeof record.learnerId !== "string" || record.learnerId.trim().length === 0) {
    return false;
  }

  if (!OBSERVATION_MOMENT_VALUES.includes(record.moment)) {
    return false;
  }

  if (typeof record.freeText !== "string" || record.freeText.trim().length === 0) {
    return false;
  }

  return typeof record.createdAt === "string" && record.createdAt.trim().length > 0;
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function createId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `observation_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`;
}
