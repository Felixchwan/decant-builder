# ADR-0023: Collection Intelligence — One Seasonal Model and Presentation Metrics Separate from Composer Scoring

**Status:** Accepted
**Related:** Sibling of ADR-0007 (Composer Core kept merchant-agnostic and isolated) — this ADR keeps the Composer's inputs exactly as they were and gives Collection Intelligence its own metrics. Extends ADR-0008's pattern of enforcing boundaries with tests. Shared Builder code only (ADR-0004/0006): nothing here is merchant-specific.
**Evidence:** Adopted prospectively, ahead of implementation, after an audit of the shipped Collection Intelligence (Collection Balance stars, season radar, profile chips, season coverage, Box Intelligence, exported Collection Card). Once merged, evidence is `packages/builder/src/builder/internal/intelligence/seasonalEvidence.js`, `collectionMetrics.js`, and `collectionIntelligenceConsistency.test.js`.

## Context
Collection Intelligence told several stories about the same box that did not agree:
- **Season Balance** scored 4–5★ for 15 of 15 random boxes whose radar clearly leaned Spring/Summer. The formula gave 45 points merely because every season had a non-zero weight (always true for real fragrances), so the realistic range was about 3★–5★.
- **Coverage thresholds** were absolute summed weights (strong ≥ 16, covered ≥ 4), so "Strong Fall Coverage" was claimed at a 30% seasonal level, and a seasonal gap almost never fired (299 of 300 boxes had none) while Box Intelligence reported "Limited winter depth".
- **Versatility** (distinct tags) and **Signature Potential** (the old label; a raw count that includes `woody`, present in most of the catalog) saturated: 89% and 100% of realistic boxes at 4–5★.
- **Profile chips** added accord arrays to numbers (`getAccordCounts` returned the accord→names map), producing strings, so "Fresh-Leaning" / "Warm-Leaning" were decided by string comparison.
- The Collection Card identity engine carried its own copy of the flawed season formula.

The metrics were also not separable by consumer: `scentDna.scores` (versatility, depth, season balance) is an input to the Composer's quality scoring (`composerQualityDimensions.js`), so correcting those formulas in place would silently change Composer proposals and the Opportunity recommendation.

## Decision
1. **One seasonal model.** `seasonalEvidence.js` turns season strengths into per-season *levels* (mean season weight as a percentage, so box size cancels) and derives everything else from them: **Season Balance** = how evenly the box serves the four seasons = weakest level ÷ strongest level (scaled so the most even real box reads as full), the 1–5★ score, the shape sentence under the radar ("balanced" ⇔ 4–5★, otherwise it leans on one season or an adjacent pair), the coverage bands (strong ≥ 50, covered ≥ 30, a gap below 30) and the gap list. The radar, the stars, the coverage strengths and gaps, the profile chips, Box Intelligence's gap and the exported card all read it; nothing recomputes it. There is no presence bonus: a token non-zero weight earns nothing.
2. **Presentation metrics are separate from `scentDna`.** `collectionMetrics.js` computes the five Collection Balance scores once per box. `buildScentDna` and everything the Composer reads are unchanged; a test pins that the Composer never imports the presentation modules.
3. **Metrics measure effective breadth, not tag counts.** Versatility (occasions, vibes, seasons), Breadth (accords, notes) use the inverse Simpson index (the number of equally common categories that would spread the box as evenly as it really is) between anchors set at the observed 5th–95th percentile of realistic boxes. **Signature Coherence** (es: "Coherencia de firma"; formerly "Signature Potential" / "Potencial de firma") is the box's coherence: the mean pairwise similarity (the same measure behind "Afinidad"), which is a mean and so does not grow with box size. High = the box follows one strong, recognizable olfactory thread; low = the box is intentionally heterogeneous and has no single dominant identity. It is independent of Versatility, so a repetitive near-twin box scores high on Signature Coherence and low on Versatility; that is not a contradiction (one tight thread, few situations served). The profile chip that reads it is "Coherent Signature" (formerly "Signature Ready").
4. **Stars are equal 20-point bands** (`ceil(score / 20)`), with a floor of 1★ for a non-empty box (Signature needs 3 fragrances).
5. **"Profundidad" is renamed "Amplitud olfativa" (en: "Scent Breadth").** It measures breadth of accords and notes, not how dark or rich a box is. Redefining it as depth would duplicate Freshness (its inverse) and Season Balance and need a subjective taxonomy of "deep" accords.
6. **Profile chips and Box Intelligence read the same fresh/warm lean**, computed per fragrance as numbers; "Balanced and versatile" / "Balanced Rotation" is one predicate; an unclassified, unbalanced box is "Mixed character". The "Spring/Summer" and "Fall/Winter Specialist" chips are the radar's own sentence as a chip (derived from the same seasonal shape, never from a separate rule), and they sit right after the balance chip so the card's top three always carry the seasonal story.

## Alternatives Considered
- **Change `buildScentDna` in place** — rejected; it feeds the Composer, so every proposal and the Opportunity lane would shift as a side effect of a presentation fix.
- **Keep the old season formula and only relabel it** — rejected; the formula rewards presence, not balance, and no label makes 3★–5★-only a useful scale.
- **Per-metric star thresholds tuned to the observed distribution** — rejected; harder to explain than one rule (a star is a 20-point band), and the anchors on the underlying scores already spread the range.
- **Redefine Profundidad as "dark / rich"** — rejected, see Decision 5.
- **Shannon (order-1) effective numbers** — measured and rejected for the inverse Simpson index: a single stray tag moved Versatility about a third more.

## Trade-offs
**Gains**
- The surfaces cannot disagree: "balanced" is 4–5★ in the stars, the radar sentence, the chips and Box Intelligence; seasonal gaps, strengths and the Box Intelligence gap all name the same season.
- Scores use their range (4–5★ shares of realistic boxes: Versatility 89%→37%, Breadth 66%→27%, Season Balance 93%→44%, Signature 100%→28%); a Spring/Summer specialist scores 1★ for Season Balance.
- Same-shape boxes of different size read the same.

**Costs**
- Two notions of "season balance" now exist, deliberately: the presentation one (this ADR, `seasonalEvidence.js`) and `scentDna.scores.seasonBalance`, which is the Composer's **seasonal presence-and-spread index** (45% share of seasons with any weight + 55% closeness of the season totals to equal shares). In Composer terms it is an input to the `versatility` dimension (0.28 of it) and the `coherence` dimension (0.22 of it), i.e. about 6-12% of a collection's total quality depending on strategy (balanced 9.9%, versatile 12.0%, explorer 6.0%, signature 9.5%). It is not shown to customers, and no Composer explanation text reads it.
- The Composer index is compressed: over 240 realistic boxes it spans 63-95, and every Spring/Summer or Fall/Winter specialist that Collection Intelligence scores 1-2★ sits at 63-85 on it (86 of 86 at 60 or more). It orders boxes the same way as the presentation score (Pearson r = 0.96) but with about a third of the range, so the Composer already prefers a more even box; it just weights seasonal skew lightly.
- **Aligning the Composer to the presentation score was measured and deferred.** Swapping it in changed the top "To balance your box" pick for 64% of 240 realistic boxes (balanced boxes 69%, specialists 55%) and the Composer "signature" lane's top pick for 46%; it re-picked all eight empty-box proposals tested (overlap with the current proposal 14-60%) and broke 9 pinned Composer tests (golden compositions, refinement, and one lane-separation test). It did improve season evenness of the completed box (balance lane +7.6 points on average, 152 better vs 28 worse), but it is a three-fold increase in how much the Composer cares about seasons, i.e. a re-weighting decision, not a bug fix, and it also moves boxes that are already balanced. That decision belongs to a deliberate Composer change with its own re-baselined fixtures. Until then, the Composer's index should be read as a different quantity and its name should say so (see Consequences).
- The anchors are calibrated on the shared catalog's tag vocabulary; a materially different catalog needs them re-derived (the distribution tests will fail first).

## Consequences
- Any new Collection Intelligence statement about a season must take its numbers from `seasonalEvidence.js`, and any new box-level character signal from `collectionMetrics.js`.
- The Collection Card identity engine reads the same season balance; boxes it previously titled "Balanced Rotation" on seasonal grounds alone no longer are.
- `boxSummary` now carries `selectedCount` so coverage can be relative to the box.
- The Composer's `scentDna.scores.seasonBalance` keeps its formula and Composer role but is a different quantity from Season Balance here. It should be renamed (for example `seasonSpread`) in a Composer-scoped change that also updates the `versatility.seasonBalance` reasoning fact and the tests that pin it, so the name `seasonBalance` means one thing; that rename does not change any score and is separate from the weighting decision above. A third, local ratio named `seasonBalance` lives in the Builder panel's review-summary signals (`BuilderPanel.jsx`); it is outside Collection Intelligence and Composer and is noted here only so a later cleanup can fold it into `seasonalEvidence.js`.

## Revisit Criteria
Revisit if:
- The Composer's own season-balance objective is changed (then decide whether it should consume `seasonalEvidence.js`). The measured effect of doing so (above) is the baseline to compare against.
- The catalog changes enough that the distribution tests in `collectionIntelligenceConsistency.test.js` fail (re-derive the anchors from percentiles, do not loosen the tests).
- A host needs a different seasonal definition of "balanced" than 4–5★ / a weakest-to-strongest ratio of about 0.5 (make it configuration, do not fork the formula).
