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

## Phase 1 (this phase): note co-occurrence foundation

`noteRelationships.js` computes empirical note-to-note co-occurrence
statistics (support, frequency, conditional probability, Jaccard, lift)
across the current 87-fragrance catalog. `reportTopRelationships.js` is a
read-only console inspection script -- run it with:

```bash
node research/fragranceRelationshipLab/reportTopRelationships.js
```

Nothing it prints is a production relationship; results are for manual
research review only.

## Not yet implemented (future phases, each its own approved slice)

- Fragrance-to-fragrance similarity models
- Semantic discovery aliases
- Explanation generation
- Any external corpus (e.g. FragDB) -- not used anywhere in this lab yet
