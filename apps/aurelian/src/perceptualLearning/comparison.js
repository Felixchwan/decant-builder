// Comparison -- a third Aggregate Root (ADR-0022), recording evidence about
// the relationship between two EncounterInstances: what the Learner
// perceives as different between them, in their own words. References
// EncounterInstances, not Observations or fragranceIds -- the thing being
// compared is the perceptual experience, not whichever specific note
// happened to get written about it, and not an abstract catalog record.
// Append-only by architecture: no mutation helper.
//
// Same-fragrance pairs are not a domain-level violation here -- the only
// hard invariant is that the two referenced encounters are distinct. See
// ADR-0022 for why (the domain must stay capable of self-temporal
// comparison later); steering the ordinary first-slice journey toward two
// different fragrances is a Phase 2.1 UI concern, not this factory's job.

const COMPARISON_KEYS = new Set([
  "comparisonId",
  "learnerId",
  "firstEncounterInstanceId",
  "secondEncounterInstanceId",
  "freeText",
  "createdAt",
]);

export function createComparison({
  learnerId,
  firstEncounterInstanceId,
  secondEncounterInstanceId,
  freeText,
  createdAt,
}) {
  if (typeof learnerId !== "string" || learnerId.trim().length === 0) {
    throw new Error("createComparison: learnerId is required.");
  }

  if (
    typeof firstEncounterInstanceId !== "string" ||
    firstEncounterInstanceId.trim().length === 0
  ) {
    throw new Error("createComparison: firstEncounterInstanceId is required.");
  }

  if (
    typeof secondEncounterInstanceId !== "string" ||
    secondEncounterInstanceId.trim().length === 0
  ) {
    throw new Error("createComparison: secondEncounterInstanceId is required.");
  }

  if (firstEncounterInstanceId === secondEncounterInstanceId) {
    throw new Error(
      "createComparison: firstEncounterInstanceId and secondEncounterInstanceId must be different."
    );
  }

  // Trimmed only to decide blankness -- the stored freeText preserves
  // exactly what the Learner submitted, not a normalized/trimmed copy.
  if (typeof freeText !== "string" || freeText.trim().length === 0) {
    throw new Error("createComparison: freeText must be a non-blank string.");
  }

  return Object.freeze({
    comparisonId: createId(),
    learnerId,
    firstEncounterInstanceId,
    secondEncounterInstanceId,
    freeText,
    createdAt: typeof createdAt === "string" ? createdAt : new Date().toISOString(),
  });
}

// Pure structural predicate, used by the persistence adapter to validate a
// persisted record on read. Cannot and does not check that the referenced
// EncounterInstances actually exist -- this predicate receives only the
// Comparison record itself, not the surrounding state. Referential
// integrity (both referenced ids present, both owned by the same learner)
// is enforced at the persistence/use-case boundary -- see
// perceptualLearningPersistence.js.
export function isValidPersistedComparison(record) {
  if (!isPlainObject(record)) {
    return false;
  }

  if (Object.keys(record).some((key) => !COMPARISON_KEYS.has(key))) {
    return false;
  }

  if (typeof record.comparisonId !== "string" || record.comparisonId.trim().length === 0) {
    return false;
  }

  if (typeof record.learnerId !== "string" || record.learnerId.trim().length === 0) {
    return false;
  }

  if (
    typeof record.firstEncounterInstanceId !== "string" ||
    record.firstEncounterInstanceId.trim().length === 0
  ) {
    return false;
  }

  if (
    typeof record.secondEncounterInstanceId !== "string" ||
    record.secondEncounterInstanceId.trim().length === 0
  ) {
    return false;
  }

  if (record.firstEncounterInstanceId === record.secondEncounterInstanceId) {
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

  return `comparison_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`;
}
