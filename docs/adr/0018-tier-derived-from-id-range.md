# ADR-0018: [Demoted]

**Status:** Demoted — this entry is retired, not deleted, to preserve the ADR numbering sequence and audit trail.

This number originally covered "fragrance tier is derived from catalog ID range rather than stored explicitly." On governance review, this was judged to be an accreted implementation detail rather than a decision genuinely weighed among architectural alternatives — it doesn't shape system structure, doesn't affect multiple subsystems, and shows no evidence of deliberate trade-off analysis. It was demoted out of the ADR log to a tracked data-integrity backlog note.

Its content, rationale, and the concrete follow-up action it implies are preserved at:
**[`docs/backlog/tier-id-range-integrity.md`](../backlog/tier-id-range-integrity.md)**

Do not reuse ADR-0018 for a new, unrelated decision.
