// EncounterInstance -- an Aggregate Root recording what Aurelian attempted to
// provoke in a specific Learner, at a specific moment (see
// docs/domain/PERCEPTUAL_LEARNING_DOMAIN_MODEL.md §4). Deliberately has no
// status field and no lifecycle taxonomy in Phase 1 -- a "revisit" is
// modeled by creating a *new* EncounterInstance for the same fragrance, not
// a state transition on this one. Never copies notes/accords/catalog
// metadata -- fragranceDisplaySnapshot carries only the minimal
// {fragranceId, name, brand} needed for resilient display if the catalog
// item later changes or disappears (mirrors the existing Order.items
// snapshot precedent in Finalization).

const ENCOUNTER_INSTANCE_KEYS = new Set([
  "encounterInstanceId",
  "learnerId",
  "fragranceId",
  "fragranceDisplaySnapshot",
  "basedOnDesignId",
  "designSnapshot",
  "createdAt",
]);

export function createEncounterInstance({
  learnerId,
  fragranceId,
  fragranceDisplaySnapshot = null,
  basedOnDesignId,
  designSnapshot,
  createdAt,
}) {
  // Phase 1 callers never need to supply these -- they're always persisted
  // as null. But EncounterDesign doesn't exist yet, so a caller that
  // explicitly supplies a real value here is using vocabulary from a future
  // phase; failing loudly is safer than silently discarding that intent.
  if (basedOnDesignId !== undefined && basedOnDesignId !== null) {
    throw new Error(
      "createEncounterInstance: basedOnDesignId is not supported in Phase 1 (EncounterDesign does not exist yet)."
    );
  }

  if (designSnapshot !== undefined && designSnapshot !== null) {
    throw new Error(
      "createEncounterInstance: designSnapshot is not supported in Phase 1 (EncounterDesign does not exist yet)."
    );
  }

  if (typeof learnerId !== "string" || learnerId.trim().length === 0) {
    throw new Error("createEncounterInstance: learnerId is required.");
  }

  if (!Number.isInteger(fragranceId)) {
    throw new Error("createEncounterInstance: fragranceId must be an integer.");
  }

  const snapshot = normalizeDisplaySnapshot(fragranceDisplaySnapshot, fragranceId);

  return Object.freeze({
    encounterInstanceId: createId(),
    learnerId,
    fragranceId,
    fragranceDisplaySnapshot: snapshot,
    basedOnDesignId: null,
    designSnapshot: null,
    createdAt: typeof createdAt === "string" ? createdAt : new Date().toISOString(),
  });
}

// Pure structural predicate, used by the persistence adapter to validate a
// persisted record on read. Intentionally never resolves fragranceId
// against the live catalog -- a removed/renamed catalog item must not
// invalidate historical evidence.
export function isValidPersistedEncounterInstance(record) {
  if (!isPlainObject(record)) {
    return false;
  }

  if (Object.keys(record).some((key) => !ENCOUNTER_INSTANCE_KEYS.has(key))) {
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

  if (!Number.isInteger(record.fragranceId)) {
    return false;
  }

  if (
    record.fragranceDisplaySnapshot !== null &&
    !isValidDisplaySnapshot(record.fragranceDisplaySnapshot, record.fragranceId)
  ) {
    return false;
  }

  if (record.basedOnDesignId !== null || record.designSnapshot !== null) {
    return false;
  }

  return typeof record.createdAt === "string" && record.createdAt.trim().length > 0;
}

function normalizeDisplaySnapshot(fragranceDisplaySnapshot, fragranceId) {
  if (fragranceDisplaySnapshot === null || fragranceDisplaySnapshot === undefined) {
    return null;
  }

  if (!isValidDisplaySnapshot(fragranceDisplaySnapshot, fragranceId)) {
    throw new Error(
      "createEncounterInstance: fragranceDisplaySnapshot must be {fragranceId, name, brand} and its " +
        "fragranceId must match fragranceId."
    );
  }

  return Object.freeze({
    fragranceId,
    name: fragranceDisplaySnapshot.name,
    brand: fragranceDisplaySnapshot.brand,
  });
}

function isValidDisplaySnapshot(snapshot, fragranceId) {
  return (
    isPlainObject(snapshot) &&
    snapshot.fragranceId === fragranceId &&
    typeof snapshot.name === "string" &&
    snapshot.name.trim().length > 0 &&
    typeof snapshot.brand === "string" &&
    snapshot.brand.trim().length > 0
  );
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function createId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `encounter_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`;
}
