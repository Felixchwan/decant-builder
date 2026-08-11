// Local persistence adapter for Perceptual Learning (ADR-0021, ADR-0022).
// Mirrors Collection's own builder-package persistence module: a
// schema-version + full-revalidate-on-read template, and a
// storage-injected-as-a-parameter shape (never reads window.localStorage
// itself -- the caller supplies it, keeping this module trivially testable
// and free of any environment assumption).
//
// Everything Perceptual Learning has persisted lives under one key: Learner
// identity plus all evidence. A single key is sufficient because v1/v2
// support exactly one active Learner per device at a time -- see ADR-0021.
// The key name itself does not track the internal schemaVersion and is not
// renamed when the schema evolves -- see ADR-0022.
//
// writePerceptualLearningState is the ONLY write entry point, and it always
// writes the complete next state in one storage call. There is no separate
// "create the learner" write and no separate "create the encounter" write:
// the caller (the Perceptual Learning application layer) is responsible for
// composing a complete, valid next state in memory first -- see
// docs/adr/0021-... and docs/adr/0022-... for why a failed first
// Observation/Comparison submission must never leave behind a durable
// Learner or an empty EncounterInstance.
//
// Schema v2 (ADR-0022) adds a `comparisons` array alongside the existing
// `encounterInstances`/`observations`. A legacy v1 payload (no `comparisons`
// field) is recognized and migrated in memory -- learnerId, learnerCreatedAt,
// encounterInstances, and observations are preserved exactly as v1 validated
// them, and `comparisons` defaults to []. Nothing is written during a read;
// the next successful write naturally persists the state under the current
// (v2) schemaVersion, since every write stamps that constant fresh.

import { isValidLearnerId } from "./learnerIdentity.js";
import { isValidPersistedEncounterInstance } from "./encounterInstance.js";
import { isValidPersistedObservation } from "./observation.js";
import { isValidPersistedComparison } from "./comparison.js";

export const PERCEPTUAL_LEARNING_STORAGE_KEY = "aurelian-perceptual-learning-v1";
export const PERCEPTUAL_LEARNING_SCHEMA_VERSION = 2;
const LEGACY_SUPPORTED_SCHEMA_VERSION = 1;

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
    comparisons: nextState.comparisons,
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
    comparisons: [],
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

function isSupportedSchemaVersion(version) {
  return version === LEGACY_SUPPORTED_SCHEMA_VERSION || version === PERCEPTUAL_LEARNING_SCHEMA_VERSION;
}

// Top-level shape/version mismatches discard the whole payload -- the same
// all-or-nothing discipline builderPersistence.js already uses, since an
// unrecognized version means the rest of the shape contract is
// untrustworthy. Both the legacy (1) and current (2) schema versions are
// recognized top-level shapes; anything else is discarded entirely.
//
// Individual malformed EncounterInstance/Observation/Comparison records are
// dropped one at a time instead, so one corrupted local write doesn't cost
// someone their entire evidence history. Records are validated against
// their complete domain shapes (isValidPersistedEncounterInstance /
// isValidPersistedObservation / isValidPersistedComparison) -- deliberately
// NOT against the live catalog. A fragranceId that no longer resolves to a
// current catalog item does not invalidate a historical EncounterInstance;
// none of these predicates has a catalog dependency.
//
// A Comparison additionally cannot be meaningfully displayed if either
// EncounterInstance it references was itself dropped -- such an orphaned
// Comparison is filtered out here, after encounterInstances has already
// been sanitized, rather than being left dangling.
function readValidatedState(parsed) {
  if (!isPlainObject(parsed) || !isSupportedSchemaVersion(parsed.schemaVersion)) {
    return null;
  }

  if (parsed.learnerId !== null && parsed.learnerId !== undefined && !isValidLearnerId(parsed.learnerId)) {
    return null;
  }

  const encounterInstances = sanitizeRecordArray(
    parsed.encounterInstances,
    isValidPersistedEncounterInstance
  );
  const encounterInstanceIds = new Set(
    encounterInstances.map((encounter) => encounter.encounterInstanceId)
  );

  // A legacy v1 payload never had a `comparisons` field -- sanitizeRecordArray
  // already treats a missing/non-array value as [], so this naturally
  // produces the v1 -> v2 migration's required default with no
  // version-specific branching needed here.
  const comparisons = sanitizeRecordArray(parsed.comparisons, isValidPersistedComparison).filter(
    (comparison) =>
      encounterInstanceIds.has(comparison.firstEncounterInstanceId) &&
      encounterInstanceIds.has(comparison.secondEncounterInstanceId)
  );

  return {
    learnerId: parsed.learnerId ?? null,
    learnerCreatedAt: typeof parsed.learnerCreatedAt === "string" ? parsed.learnerCreatedAt : null,
    encounterInstances,
    observations: sanitizeRecordArray(parsed.observations, isValidPersistedObservation),
    comparisons,
  };
}

function sanitizeRecordArray(value, isValidRecord) {
  return Array.isArray(value) ? value.filter((record) => isValidRecord(record)) : [];
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
    !nextState.encounterInstances.every((record) => isValidPersistedEncounterInstance(record))
  ) {
    throw new Error(
      "perceptualLearningPersistence.writePerceptualLearningState: nextState.encounterInstances must be " +
        "an array of records each matching the complete EncounterInstance persisted shape."
    );
  }

  if (
    !Array.isArray(nextState.observations) ||
    !nextState.observations.every((record) => isValidPersistedObservation(record))
  ) {
    throw new Error(
      "perceptualLearningPersistence.writePerceptualLearningState: nextState.observations must be an " +
        "array of records each matching the complete Observation persisted shape."
    );
  }

  if (
    !Array.isArray(nextState.comparisons) ||
    !nextState.comparisons.every((record) => isValidPersistedComparison(record))
  ) {
    throw new Error(
      "perceptualLearningPersistence.writePerceptualLearningState: nextState.comparisons must be an " +
        "array of records each matching the complete Comparison persisted shape."
    );
  }

  const encounterInstanceById = new Map(
    nextState.encounterInstances.map((encounter) => [encounter.encounterInstanceId, encounter])
  );

  nextState.comparisons.forEach((comparison) => {
    const first = encounterInstanceById.get(comparison.firstEncounterInstanceId);
    const second = encounterInstanceById.get(comparison.secondEncounterInstanceId);

    if (!first || !second) {
      throw new Error(
        "perceptualLearningPersistence.writePerceptualLearningState: a Comparison must reference two " +
          "EncounterInstances present in nextState.encounterInstances."
      );
    }

    if (first.learnerId !== comparison.learnerId || second.learnerId !== comparison.learnerId) {
      throw new Error(
        "perceptualLearningPersistence.writePerceptualLearningState: a Comparison's referenced " +
          "EncounterInstances must both belong to the Comparison's learnerId."
      );
    }
  });
}
