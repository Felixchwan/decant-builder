// Fragrance Relationship Lab -- Phase 2: signal-agnostic nearest-neighbor
// ranking helper.
//
// Takes an anchor fragrance, a catalog, and any scoring function shaped
// like (anchor, candidate) => evidenceObject (where evidenceObject has a
// `score` field, plus whatever signal-specific evidence/support fields
// that signal returns), and produces a ranked candidate list. This module
// has no concept of notes, accords, vibes, or prominence -- it is reused
// identically by all four Phase 2 signals -- and no concept of Composer or
// recommendations at all.

// Ranking treats a null/non-finite score (Signal D's "zero mutually-scored
// notes" case) as sorting after every real score, mirroring the existing
// "unscored trails scored" convention already established in
// packages/builder/src/builder/internal/intelligence/buildNoteExplorerViewModel.js's
// sortNoteExplorerMatchesByProminence -- this never rewrites the actual
// score field, it only affects sort position.
function comparableScore(entry) {
  return typeof entry.score === "number" && Number.isFinite(entry.score) ? entry.score : -Infinity;
}

// Deterministic: candidates are pre-sorted by ascending fragrance id (a
// stable, canonical tie-break) before the descending score sort runs.
// Array.prototype.sort's stability (guaranteed since ES2019, and already
// relied on elsewhere in this monorepo) is what makes equal-score ties
// preserve that ascending-id order rather than depending on input order.
export function findNearestNeighbors(anchor, catalog, scoreFn) {
  const safeCatalog = Array.isArray(catalog) ? catalog : [];

  if (!anchor || typeof scoreFn !== "function") {
    return [];
  }

  const scored = safeCatalog
    .filter((candidate) => candidate && candidate.id !== anchor.id)
    .map((candidate) => ({ candidate, ...scoreFn(anchor, candidate) }));

  const canonicallyOrdered = [...scored].sort((a, b) => a.candidate.id - b.candidate.id);

  return canonicallyOrdered.sort((a, b) => comparableScore(b) - comparableScore(a));
}
