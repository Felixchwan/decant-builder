// Fragrance Relationship Lab -- Phase 2, Signal D: prominence-supported
// similarity.
//
// Computed only over mutually-scored canonical notes -- notes present as a
// key in BOTH fragrances' noteProminence objects. A missing/unscored
// dimension is never converted to 0; it is simply excluded from the sum,
// exactly like Phase 1's own "missing prominence != score 0" discipline
// carried into this signal.
//
// Metric: Ruzicka / weighted Jaccard --
//   score = sum(min(x_i, y_i)) / sum(max(x_i, y_i))
// over the mutually-scored dimensions only.
//
// Cosine similarity was evaluated and rejected as the active metric here.
// With exactly one positive shared dimension, cosine similarity is always
// 1.0 regardless of score magnitude -- e.g. cosine([1], [10]) = 1 and
// cosine([9], [1]) = 1, because cosine measures the angle between vectors,
// which is undefined/degenerate (trivially 0 degrees) for any two
// positive scalars. Ruzicka does not have this defect: the same two pairs
// produce 1/10 = 0.1 and 1/9 ~= 0.111, correctly discriminating on
// magnitude even at n=1. See prominenceSimilarity.test.js for a
// regression proving this exact rejected behavior -- cosine is documented
// here and in that test only as the reason Ruzicka was chosen, and is
// never exposed as an active metric.
//
// Phase 2's own read-only audit found real, live evidence that
// mutuallyScoredCount stays below 2 for the overwhelming majority of
// candidate pairs given the catalog's current calibration sparsity (see
// README.md and the Phase 2 report). A single mutually-scored note is not
// enough to support an overall similarity claim, so any result with
// mutuallyScoredCount < 2 must never be presented as a normal ranked
// nearest-neighbor result -- it may still exist in raw output for
// inspection (isSufficientForRanking: false), but must be labeled
// single-dimension / insufficient comparative support, not silently
// treated as a real ranking. No fallback score is ever fabricated: a pair
// with zero mutually-scored notes returns score: null, never 0.

export const MIN_MUTUALLY_SCORED_COUNT_FOR_RANKING = 2;

export function compareProminenceSimilarity(anchor, candidate) {
  const anchorScores = anchor?.noteProminence || {};
  const candidateScores = candidate?.noteProminence || {};

  const mutuallyScoredNotes = Object.keys(anchorScores)
    .filter((noteId) => noteId in candidateScores)
    .map((noteId) => ({
      noteId,
      anchorScore: anchorScores[noteId],
      candidateScore: candidateScores[noteId],
    }));

  const mutuallyScoredCount = mutuallyScoredNotes.length;

  if (mutuallyScoredCount === 0) {
    return {
      score: null,
      mutuallyScoredNotes,
      mutuallyScoredCount,
      coverageFraction: 0,
      isSufficientForRanking: false,
    };
  }

  let minSum = 0;
  let maxSum = 0;
  mutuallyScoredNotes.forEach(({ anchorScore, candidateScore }) => {
    minSum += Math.min(anchorScore, candidateScore);
    maxSum += Math.max(anchorScore, candidateScore);
  });

  const anchorScoredCount = Object.keys(anchorScores).length;
  const candidateScoredCount = Object.keys(candidateScores).length;
  const smallerScoredCount = Math.min(anchorScoredCount, candidateScoredCount);

  return {
    score: maxSum > 0 ? minSum / maxSum : 0,
    mutuallyScoredNotes,
    mutuallyScoredCount,
    coverageFraction: smallerScoredCount > 0 ? mutuallyScoredCount / smallerScoredCount : 0,
    isSufficientForRanking: mutuallyScoredCount >= MIN_MUTUALLY_SCORED_COUNT_FOR_RANKING,
  };
}
