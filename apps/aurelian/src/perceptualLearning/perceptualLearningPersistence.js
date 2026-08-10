// Local persistence adapter for Perceptual Learning (ADR-0021). Mirrors
// Collection's own builder-package persistence module: a schema-version +
// full-revalidate-on-read template, and a storage-injected-as-a-parameter
// shape (never reads window.localStorage itself -- the caller supplies it,
// keeping this module trivially testable and free of any environment
// assumption).
//
// Everything Perceptual Learning has persisted lives under one key: Learner
// identity plus all evidence. A single key is sufficient because v1 supports
// exactly one active Learner per device at a time -- see ADR-0021.
//
// writePerceptualLearningState is the ONLY write entry point, and it always
// writes the complete next state in one storage call. There is no separate
// "create the learner" write and no separate "create the encounter" write:
// the caller (the Perceptual Learning application layer, Phase 1) is
// responsible for composing a complete, valid next state in memory first --
// see docs/adr/0021-... and the approved Phase 0/1 plan for why a failed
// first Observation submission must never leave behind a durable Learner or
// an empty EncounterInstance.

import { isValidLearnerId } from "./learnerIdentity.js";

export const PERCEPTUAL_LEARNING_STORAGE_KEY = "aurelian-perceptual-learning-v1";
export const PERCEPTUAL_LEARNING_SCHEMA_VERSION = 1;

export function loadPerceptualLearningState({ storage } = {}) {
  const resolvedStorage = getAvailableStorage(storage);

  if (!resolvedStorage) {
    return emptyState();
  }

  let rawValue;

  try {
    rawValue = resolvedStorage.getItem(PERCEPTUAL_LEARNING_STORAGE_KEY);
  } catch {
    return emptyState();
  }

  if (!rawValue) {
    return emptyState();
  }

  let parsed;

  try {
    parsed = JSON.parse(rawValue);
  } catch {
    return emptyState();
  }

  return readValidatedState(parsed) ?? emptyState();
}

export function writePerceptualLearningState({ storage, nextState } = {}) {
  assertValidNextState(nextState);

  const resolvedStorage = getAvailableStorage(storage);

  if (!resolvedStorage) {
    return { persisted: false, state: null };
  }

  const payload = {
    schemaVersion: PERCEPTUAL_LEARNING_SCHEMA_VERSION,
    learnerId: nextState.learnerId,
    learnerCreatedAt: nextState.learnerCreatedAt ?? null,
    encounterInstances: nextState.encounterInstances,
    observations: nextState.observations,
  };

  try {
    resolvedStorage.setItem(PERCEPTUAL_LEARNING_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    return { persisted: false, state: null };
  }

  return { persisted: true, state: payload };
}

export function resetLearningData({ storage } = {}) {
  const resolvedStorage = getAvailableStorage(storage);

  if (!resolvedStorage) {
    return false;
  }

  try {
    resolvedStorage.removeItem(PERCEPTUAL_LEARNING_STORAGE_KEY);
    return true;
  } catch {
    return false;
  }
}

function emptyState() {
  return {
    learnerId: null,
    learnerCreatedAt: null,
    encounterInstances: [],
    observations: [],
  };
}

function getAvailableStorage(storage) {
  if (
    !storage ||
    typeof storage.getItem !== "function" ||
    typeof storage.setItem !== "function" ||
    typeof storage.removeItem !== "function"
  ) {
    return null;
  }

  return storage;
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function hasValidStringId(record, idField) {
  return (
    isPlainObject(record) &&
    typeof record[idField] === "string" &&
    record[idField].trim().length > 0
  );
}

// Top-level shape/version mismatches discard the whole payload -- the same
// all-or-nothing discipline builderPersistence.js already uses, since a
// version mismatch means the rest of the shape contract is untrustworthy.
// Individual malformed EncounterInstance/Observation records are dropped one
// at a time instead, so one corrupted local write doesn't cost someone their
// entire evidence history.
//
// This module only knows the generic shape (an array of records, each with a
// non-empty string id field) -- it does not validate the full
// EncounterInstance/Observation domain contract, which belongs to Phase 1's
// own factories and is out of this module's ownership.
function readValidatedState(parsed) {
  if (!isPlainObject(parsed) || parsed.schemaVersion !== PERCEPTUAL_LEARNING_SCHEMA_VERSION) {
    return null;
  }

  if (parsed.learnerId !== null && parsed.learnerId !== undefined && !isValidLearnerId(parsed.learnerId)) {
    return null;
  }

  return {
    learnerId: parsed.learnerId ?? null,
    learnerCreatedAt: typeof parsed.learnerCreatedAt === "string" ? parsed.learnerCreatedAt : null,
    encounterInstances: sanitizeRecordArray(parsed.encounterInstances, "encounterInstanceId"),
    observations: sanitizeRecordArray(parsed.observations, "observationId"),
  };
}

function sanitizeRecordArray(value, idField) {
  return Array.isArray(value) ? value.filter((record) => hasValidStringId(record, idField)) : [];
}

function assertValidNextState(nextState) {
  if (!isPlainObject(nextState)) {
    throw new Error(
      "perceptualLearningPersistence.writePerceptualLearningState: nextState must be a plain object."
    );
  }

  if (
    nextState.learnerId !== null &&
    nextState.learnerId !== undefined &&
    !isValidLearnerId(nextState.learnerId)
  ) {
    throw new Error(
      "perceptualLearningPersistence.writePerceptualLearningState: nextState.learnerId is invalid."
    );
  }

  if (
    !Array.isArray(nextState.encounterInstances) ||
    !nextState.encounterInstances.every((record) => hasValidStringId(record, "encounterInstanceId"))
  ) {
    throw new Error(
      "perceptualLearningPersistence.writePerceptualLearningState: nextState.encounterInstances must be " +
        "an array of records each with a valid encounterInstanceId."
    );
  }

  if (
    !Array.isArray(nextState.observations) ||
    !nextState.observations.every((record) => hasValidStringId(record, "observationId"))
  ) {
    throw new Error(
      "perceptualLearningPersistence.writePerceptualLearningState: nextState.observations must be an " +
        "array of records each with a valid observationId."
    );
  }
}
