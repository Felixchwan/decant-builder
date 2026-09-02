// Fragrance Relationship Lab -- Phase 2, Signal C: vibe similarity.
//
// Jaccard over each fragrance's own curated `vibes` set -- an
// experiential/emotional-character signal, deliberately kept separate from
// scent/material similarity (Signals A/B/D). Two fragrances can share every
// vibe word and still share almost no notes or accords, and vice versa;
// this signal is reported independently so that distinction stays visible
// rather than being averaged away. See README.md for the full boundary
// rule this lab preserves.

function jaccard(setA, setB) {
  const shared = [...setA].filter((item) => setB.has(item));
  const unionSize = new Set([...setA, ...setB]).size;

  return {
    score: unionSize > 0 ? shared.length / unionSize : 0,
    shared,
    unionSize,
  };
}

// Evidence is never hidden behind the bare score: sharedVibes and
// unionSize are always returned alongside it. Values are deduplicated via
// Set before comparison.
export function compareVibeSimilarity(anchor, candidate) {
  const anchorVibes = new Set((anchor?.vibes || []).filter(Boolean));
  const candidateVibes = new Set((candidate?.vibes || []).filter(Boolean));
  const { score, shared, unionSize } = jaccard(anchorVibes, candidateVibes);

  return { score, sharedVibes: shared, unionSize };
}
