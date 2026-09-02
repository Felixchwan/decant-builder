# Fragrance Relationship Lab

A research-only, offline measurement layer over the current curated catalog.
It is not a production package, not a published dependency, and not a
consumer of Composer/Builder/Aurelian -- and nothing under `packages/`,
`apps/`, or the root Discovery Decants `src/` may import from here. That
direction is enforced structurally by `researchBoundary.test.js`, not left
as a convention.

```
research -> catalog        (allowed)
catalog/builder/apps/src -> research   (never; enforced by test)
```

## Core boundary

A statistical or empirical finding produced by this lab is evidence for a
human to review -- never a mutation source. It must never automatically
change:

- canonical note identity (`packages/catalog/src/notes.js`)
- note prominence (`NOTE_PROMINENCE_BY_ID`, `getNoteProminenceLevel`)
- fragrance metadata (accords/vibes/seasons/occasions/etc.)
- Composer recommendation behavior

```
canonical identity  !=  prominence  !=  semantic relationship  !=  recommendation
similarity          !=  recommendation
```

## Phase 1: note co-occurrence foundation

`noteRelationships.js` computes empirical note-to-note co-occurrence
statistics (support, frequency, conditional probability, Jaccard, lift)
across the current 87-fragrance catalog. `reportTopRelationships.js` is a
read-only console inspection script -- run it with:

```bash
node research/fragranceRelationshipLab/reportTopRelationships.js
```

Nothing it prints is a production relationship; results are for manual
research review only.

## Phase 2: independent fragrance similarity signals

Four independent, never-blended similarity signals, each its own module:
`noteSimilarity.js` (exact-note Jaccard), `accordSimilarity.js` (accord
Jaccard), `vibeSimilarity.js` (vibe Jaccard), and `prominenceSimilarity.js`
(Ruzicka/weighted Jaccard over mutually-scored notes only -- cosine was
evaluated and rejected as mathematically degenerate at one shared
dimension). `nearestNeighbors.js` is one signal-agnostic ranking helper
reused by all four. `reportNearestNeighbors.js` prints top-5 neighbors per
signal for the seven named anchor fragrances -- run it with:

```bash
node research/fragranceRelationshipLab/reportNearestNeighbors.js
```

No hybrid score exists anywhere in this lab: the four signals are always
reported side by side, never combined into one number.

## Phase 3: human review matrix

`review/buildReviewMatrix.js` reshapes Phase 2's already-computed results
into reviewable rows (one per anchor/signal/candidate, top 5 only, or fewer
for prominence where `mutuallyScoredCount < 2` candidates are excluded from
ranking per Phase 2's own rule). `review/reviewSummary.js` is a pure,
read-only helper for summarizing human ratings once they've been entered
by hand -- it never assigns or aggregates a rating itself. Generate the
review artifact (a JSON file a human edits directly, plus a companion
Markdown table) with:

```bash
node research/fragranceRelationshipLab/review/generateReviewMatrix.js
```

`humanSimilarityRating` (0-3) and `rightReasonRating` (yes/partially/no)
always start `null` in generated output -- no automatic judgment is ever
written to them.

## Not yet implemented (future phases, each its own approved slice)

- Hybrid/aggregate similarity scoring -- explicitly out of scope; the four
  Phase 2 signals stay independent by design
- Semantic discovery aliases
- Explanation generation for customers
- Composer/Aurelian integration
- Any external corpus (e.g. FragDB) -- not used anywhere in this lab yet
