// Fragrance Relationship Lab -- Phase 1: note co-occurrence foundation.
//
// This is a research-only, offline, read-only measurement layer. It computes
// empirical statistical relationships between canonical notes using only the
// current curated catalog -- it never touches, infers, or overrides any of:
//   canonical note identity   (packages/catalog/src/notes.js)
//   note prominence           (packages/catalog/src/fragrances.js's
//                              NOTE_PROMINENCE_BY_ID, or getNoteProminenceLevel)
//   fragrance metadata        (accords/vibes/seasons/occasions/etc.)
//   Composer recommendation behavior
// A statistical co-occurrence relationship is evidence for a human to look
// at, never a mutation source for any of the above. See
// research/fragranceRelationshipLab/README.md for the full boundary rule.
//
// This module only reads from @discovery-box/catalog-shaped perfume objects
// (topNotes/middleNotes/baseNotes/generalNotes) -- it never imports from
// packages/builder or any other production package, so getPerfumeNoteIds is
// intentionally re-implemented here (identical in shape to
// packages/builder/src/utils/noteUtils.js's own helper) rather than
// imported, since that helper is a private Builder utility, not part of the
// catalog package's public surface this lab is allowed to depend on.

const PAIR_KEY_SEPARATOR = "::";

// Research display/acceptance threshold only -- never baked into the core
// math. Chosen from the live-catalog audit: of 2,155 co-occurring note
// pairs, 1,517 (70%) co-occur in exactly one fragrance and are noise; only
// 309 pairs (14%) reach this threshold, which is where the drop-off is
// sharpest.
export const DEFAULT_MIN_SUPPORT = 3;

export function getPerfumeNoteIds(perfume) {
  return [
    ...(perfume?.topNotes || []),
    ...(perfume?.middleNotes || []),
    ...(perfume?.baseNotes || []),
    ...(perfume?.generalNotes || []),
  ];
}

function safeDivide(numerator, denominator) {
  return denominator > 0 ? numerator / denominator : 0;
}

function pairKey(noteA, noteB) {
  return `${noteA}${PAIR_KEY_SEPARATOR}${noteB}`;
}

// Every unordered pair is generated from a per-fragrance note-id list that
// is sorted first -- so the same real-world pair always produces the same
// (noteA, noteB) ordering (noteA < noteB) regardless of which fragrance or
// pyramid position it was found in. This is what makes A/B and B/A collapse
// into one relationship without a separate normalization pass.
export function buildNoteRelationships(fragrances) {
  const safeFragrances = Array.isArray(fragrances) ? fragrances : [];
  const totalFragrances = safeFragrances.length;

  const frequencyByNote = new Map();
  const supportByPairKey = new Map();

  safeFragrances.forEach((perfume) => {
    const uniqueNoteIds = [...new Set(getPerfumeNoteIds(perfume).filter(Boolean))].sort();

    uniqueNoteIds.forEach((noteId) => {
      frequencyByNote.set(noteId, (frequencyByNote.get(noteId) || 0) + 1);
    });

    for (let i = 0; i < uniqueNoteIds.length; i += 1) {
      for (let j = i + 1; j < uniqueNoteIds.length; j += 1) {
        const key = pairKey(uniqueNoteIds[i], uniqueNoteIds[j]);
        supportByPairKey.set(key, (supportByPairKey.get(key) || 0) + 1);
      }
    }
  });

  const relationships = [];

  supportByPairKey.forEach((supportCount, key) => {
    const [noteA, noteB] = key.split(PAIR_KEY_SEPARATOR);
    const frequencyA = frequencyByNote.get(noteA) || 0;
    const frequencyB = frequencyByNote.get(noteB) || 0;
    const expectedCoOccurrenceIfIndependent = safeDivide(frequencyA * frequencyB, totalFragrances);

    relationships.push({
      noteA,
      noteB,
      supportCount,
      frequencyA,
      frequencyB,
      conditionalProbabilityA_given_B: safeDivide(supportCount, frequencyB),
      conditionalProbabilityB_given_A: safeDivide(supportCount, frequencyA),
      jaccard: safeDivide(supportCount, frequencyA + frequencyB - supportCount),
      lift: safeDivide(supportCount, expectedCoOccurrenceIfIndependent),
    });
  });

  return relationships;
}

// Separate, deliberately trivial filter -- keeps "measurement" (above) fully
// independent from "research display/acceptance threshold" (here). Lower-
// support pairs are never discarded by buildNoteRelationships itself; this
// is the only place a threshold is applied, and it's a parameter, not a
// hardcoded constant.
export function getSupportedNoteRelationships(relationships, { minSupport = DEFAULT_MIN_SUPPORT } = {}) {
  const safeRelationships = Array.isArray(relationships) ? relationships : [];
  return safeRelationships.filter((relationship) => relationship.supportCount >= minSupport);
}

// Deterministic descending sort by a numeric metric field, with ties broken
// by ascending canonical (noteA, noteB) key order. Array.prototype.sort's
// stability (guaranteed since ES2019, and already relied on elsewhere in
// this monorepo -- see sortNoteExplorerMatchesByProminence) is what makes
// pre-sorting by canonical key and then sorting by the metric preserve that
// canonical order among equal-metric ties.
function sortByMetricDescending(relationships, metricKey) {
  const safeRelationships = Array.isArray(relationships) ? relationships : [];
  const canonicallyOrdered = [...safeRelationships].sort((a, b) => {
    return a.noteA === b.noteA ? a.noteB.localeCompare(b.noteB) : a.noteA.localeCompare(b.noteA);
  });

  return canonicallyOrdered.sort((a, b) => b[metricKey] - a[metricKey]);
}

export function sortByHighestSupport(relationships) {
  return sortByMetricDescending(relationships, "supportCount");
}

export function sortByHighestLift(relationships) {
  return sortByMetricDescending(relationships, "lift");
}

export function sortByHighestJaccard(relationships) {
  return sortByMetricDescending(relationships, "jaccard");
}
