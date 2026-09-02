// Fragrance Relationship Lab -- Phase 2, Signal B: accord similarity.
//
// Jaccard over each fragrance's own curated `accords` set. Accords are
// already a human-curated distillation of overall scent structure -- this
// signal is independent from, and not derived from, Signal A's raw note
// overlap or Signal D's note prominence. See README.md for the full
// boundary rule this lab preserves.

function jaccard(setA, setB) {
  const shared = [...setA].filter((item) => setB.has(item));
  const unionSize = new Set([...setA, ...setB]).size;

  return {
    score: unionSize > 0 ? shared.length / unionSize : 0,
    shared,
    unionSize,
  };
}

// Evidence is never hidden behind the bare score: sharedAccords and
// unionSize are always returned alongside it. Values are deduplicated via
// Set before comparison, so a duplicated accord string never inflates a
// score.
export function compareAccordSimilarity(anchor, candidate) {
  const anchorAccords = new Set((anchor?.accords || []).filter(Boolean));
  const candidateAccords = new Set((candidate?.accords || []).filter(Boolean));
  const { score, shared, unionSize } = jaccard(anchorAccords, candidateAccords);

  return { score, sharedAccords: shared, unionSize };
}
