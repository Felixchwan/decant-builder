// Fragrance Relationship Lab -- Phase 3: human review matrix.
//
// This module builds a research-only, machine-readable review artifact
// from Phase 2's already-computed, already-tested independent similarity
// signals. It changes none of Phase 2's formulas -- it only reshapes each
// signal's existing result object into a reviewable row, per anchor, per
// signal, top 5 only, with signal-specific evidence preserved exactly (no
// new scent descriptors are invented here).
//
// Preserves the same core boundary as the rest of this lab:
//   canonical identity != prominence != semantic relationship != recommendation
//   similarity != recommendation
// A review row is a place for a HUMAN to record a judgment -- the three
// human-authored fields (humanSimilarityRating, rightReasonRating,
// reviewerNotes) always start null here. No automatic judgment ever
// populates them, and this module never aggregates them into a single
// score (see reviewSummary.js for read-only summarization of ratings a
// human has already entered separately).

import { compareAccordSimilarity } from "../accordSimilarity.js";
import { compareNoteSimilarity } from "../noteSimilarity.js";
import { findNearestNeighbors } from "../nearestNeighbors.js";
import { compareProminenceSimilarity } from "../prominenceSimilarity.js";
import { compareVibeSimilarity } from "../vibeSimilarity.js";

export const TOP_N = 5;

// One entry per Phase 2 signal. `toEvidence`/`toSupport` read directly off
// the object findNearestNeighbors returns for that candidate (which is
// `{ candidate, ...compareFn(anchor, candidate) }`) -- never recomputed,
// never reinterpreted. `isEligible` is the only place Signal D's ranking
// rule lives: an entry with fewer than 2 mutually-scored notes is real
// data (Phase 2 already proved this), but it is never presented as a
// normal ranked review row.
const SIGNAL_DEFINITIONS = [
  {
    signal: "notes",
    compare: compareNoteSimilarity,
    isEligible: () => true,
    toEvidence: (entry) => entry.sharedNotes,
    toSupport: (entry) => ({ unionSize: entry.unionSize }),
  },
  {
    signal: "accords",
    compare: compareAccordSimilarity,
    isEligible: () => true,
    toEvidence: (entry) => entry.sharedAccords,
    toSupport: (entry) => ({ unionSize: entry.unionSize }),
  },
  {
    signal: "vibes",
    compare: compareVibeSimilarity,
    isEligible: () => true,
    toEvidence: (entry) => entry.sharedVibes,
    toSupport: (entry) => ({ unionSize: entry.unionSize }),
  },
  {
    signal: "prominence",
    compare: compareProminenceSimilarity,
    isEligible: (entry) => entry.isSufficientForRanking === true,
    toEvidence: (entry) => entry.mutuallyScoredNotes,
    toSupport: (entry) => ({
      mutuallyScoredCount: entry.mutuallyScoredCount,
      coverageFraction: entry.coverageFraction,
    }),
  },
];

function buildRowsForSignal(anchor, catalog, definition) {
  const ranked = findNearestNeighbors(anchor, catalog, definition.compare);
  const eligible = ranked.filter((entry) => definition.isEligible(entry));
  const top = eligible.slice(0, TOP_N);

  return top.map((entry, index) => ({
    anchorId: anchor.id,
    anchorName: anchor.name,
    signal: definition.signal,
    rank: index + 1,
    candidateId: entry.candidate.id,
    candidateName: entry.candidate.name,
    score: entry.score,
    sharedEvidence: definition.toEvidence(entry),
    support: definition.toSupport(entry),
    humanSimilarityRating: null,
    rightReasonRating: null,
    reviewerNotes: null,
  }));
}

// Derived, non-hybrid metadata: which independent signals (among the ones
// that produced a top-5 row for this anchor) also ranked this same
// candidate. This is signal-agreement bookkeeping only -- it is never
// combined into a score, and every row for the same (anchor, candidate)
// pair carries the identical signalsPresent list regardless of which
// signal that particular row itself belongs to.
function annotateSignalsPresent(rowsForOneAnchor) {
  const signalsByCandidateId = new Map();

  rowsForOneAnchor.forEach((row) => {
    const existing = signalsByCandidateId.get(row.candidateId) || new Set();
    existing.add(row.signal);
    signalsByCandidateId.set(row.candidateId, existing);
  });

  return rowsForOneAnchor.map((row) => ({
    ...row,
    signalsPresent: [...signalsByCandidateId.get(row.candidateId)].sort(),
  }));
}

export function buildReviewRowsForAnchor(anchor, catalog) {
  const rows = SIGNAL_DEFINITIONS.flatMap((definition) => buildRowsForSignal(anchor, catalog, definition));
  return annotateSignalsPresent(rows);
}

export function buildReviewMatrix(anchorNames, catalog) {
  const safeCatalog = Array.isArray(catalog) ? catalog : [];
  const safeAnchorNames = Array.isArray(anchorNames) ? anchorNames : [];

  const foundAnchors = safeAnchorNames
    .map((name) => safeCatalog.find((perfume) => perfume?.name === name))
    .filter(Boolean);

  return foundAnchors.flatMap((anchor) => buildReviewRowsForAnchor(anchor, safeCatalog));
}

// Preserves lower-support prominence evidence separately from the main
// review rows, exactly as Phase 3 requires ("preserve lower-support raw
// evidence separately if useful") -- this is raw inspection material, not
// a reviewable row, and is never mixed into buildReviewMatrix's output.
export function buildInsufficientProminenceEvidence(anchor, catalog) {
  const ranked = findNearestNeighbors(anchor, catalog, compareProminenceSimilarity);

  return ranked
    .filter((entry) => entry.mutuallyScoredCount >= 1 && entry.isSufficientForRanking === false)
    .map((entry) => ({
      anchorId: anchor.id,
      anchorName: anchor.name,
      candidateId: entry.candidate.id,
      candidateName: entry.candidate.name,
      score: entry.score,
      mutuallyScoredNotes: entry.mutuallyScoredNotes,
      mutuallyScoredCount: entry.mutuallyScoredCount,
      coverageFraction: entry.coverageFraction,
    }));
}
