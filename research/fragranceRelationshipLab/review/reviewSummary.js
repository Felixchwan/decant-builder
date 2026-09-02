// Fragrance Relationship Lab -- Phase 3: review-summary helper.
//
// Pure, read-only summarization of human ratings that have already been
// entered separately (e.g. by hand-editing the generated review JSON).
// This module never assigns a rating, never blends signals, and never
// picks a "winner" -- it only counts and averages what a human has
// already recorded, per signal, so the completed review can eventually be
// read at a glance. Works safely on a matrix where every rating is still
// null (the freshly-generated state).
//
// Invalid-value policy (documented, not silent): humanSimilarityRating
// must be exactly one of 0, 1, 2, 3 to count as a completed rating;
// rightReasonRating must be exactly one of "yes", "partially", "no" to
// count. Any other value -- null, undefined, an out-of-range number, a
// typo'd string -- is treated as "not yet rated" and excluded from every
// count/mean/distribution below, rather than throwing or coercing it into
// a bucket it doesn't belong in.

const VALID_HUMAN_SIMILARITY_RATINGS = new Set([0, 1, 2, 3]);
const VALID_RIGHT_REASON_RATINGS = new Set(["yes", "partially", "no"]);

function isValidHumanSimilarityRating(value) {
  return VALID_HUMAN_SIMILARITY_RATINGS.has(value);
}

function isValidRightReasonRating(value) {
  return VALID_RIGHT_REASON_RATINGS.has(value);
}

export function summarizeSignalReviews(rows, signal) {
  const safeRows = Array.isArray(rows) ? rows : [];
  const relevantRows = safeRows.filter((row) => row.signal === signal);
  const reviewedRows = relevantRows.filter((row) => isValidHumanSimilarityRating(row.humanSimilarityRating));

  const distribution = { 0: 0, 1: 0, 2: 0, 3: 0 };
  reviewedRows.forEach((row) => {
    distribution[row.humanSimilarityRating] += 1;
  });

  const rightReasonCounts = { yes: 0, partially: 0, no: 0 };
  relevantRows.forEach((row) => {
    if (isValidRightReasonRating(row.rightReasonRating)) {
      rightReasonCounts[row.rightReasonRating] += 1;
    }
  });

  const meanHumanSimilarityRating =
    reviewedRows.length > 0
      ? reviewedRows.reduce((sum, row) => sum + row.humanSimilarityRating, 0) / reviewedRows.length
      : null;

  return {
    signal,
    totalRows: relevantRows.length,
    numberReviewed: reviewedRows.length,
    meanHumanSimilarityRating,
    distribution,
    rightReasonCounts,
  };
}

export function summarizeAllSignals(rows, signals) {
  const safeSignals = Array.isArray(signals) ? signals : ["notes", "accords", "vibes", "prominence"];
  return safeSignals.map((signal) => summarizeSignalReviews(rows, signal));
}

// Signal-agreement metadata only -- explicitly not a similarity score.
// Ranks distinct (anchor, candidate) pairs purely by how many independent
// signals' own top-5 lists contained that candidate for that anchor, with
// a fully deterministic tie-break (signal count desc, then anchorId asc,
// then candidateId asc). Its purpose is to point a human at pairs worth
// extra attention -- it is never used to pick a winning signal or to
// compute a combined score.
export function summarizeConvergence(rows) {
  const safeRows = Array.isArray(rows) ? rows : [];
  const seenPairs = new Map();

  safeRows.forEach((row) => {
    const key = `${row.anchorId}::${row.candidateId}`;
    if (!seenPairs.has(key)) {
      seenPairs.set(key, {
        anchorId: row.anchorId,
        anchorName: row.anchorName,
        candidateId: row.candidateId,
        candidateName: row.candidateName,
        signalsPresent: row.signalsPresent,
        signalCount: row.signalsPresent.length,
      });
    }
  });

  return [...seenPairs.values()].sort((a, b) => {
    if (b.signalCount !== a.signalCount) return b.signalCount - a.signalCount;
    if (a.anchorId !== b.anchorId) return a.anchorId - b.anchorId;
    return a.candidateId - b.candidateId;
  });
}
