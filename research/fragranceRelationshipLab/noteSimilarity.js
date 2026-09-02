// Fragrance Relationship Lab -- Phase 2, Signal A: exact-note similarity.
//
// Jaccard over each fragrance's exact canonical note membership (via the
// same containment already established in Phase 1 -- see
// noteRelationships.js's getPerfumeNoteIds, reused here rather than
// duplicated, since it is already research-local and boundary-safe). This
// signal answers "how much raw material do these two fragrances share,"
// never "do these two smell alike" -- see accordSimilarity.js/
// vibeSimilarity.js for the other independent axes, and README.md for the
// full boundary rule this lab preserves.

import { getPerfumeNoteIds } from "./noteRelationships.js";

function jaccard(setA, setB) {
  const shared = [...setA].filter((item) => setB.has(item));
  const unionSize = new Set([...setA, ...setB]).size;

  return {
    score: unionSize > 0 ? shared.length / unionSize : 0,
    shared,
    unionSize,
  };
}

// Evidence is never hidden behind the bare score: sharedNotes and
// unionSize are always returned alongside it.
export function compareNoteSimilarity(anchor, candidate) {
  const anchorNotes = new Set(getPerfumeNoteIds(anchor).filter(Boolean));
  const candidateNotes = new Set(getPerfumeNoteIds(candidate).filter(Boolean));
  const { score, shared, unionSize } = jaccard(anchorNotes, candidateNotes);

  return { score, sharedNotes: shared, unionSize };
}
