// Deterministic qualitative projection of a numeric noteProminence score.
// Canonical note identity and note prominence are separate dimensions; this
// helper only re-expresses an already-existing numeric score as one of a
// fixed set of stable machine keys. It introduces no new editorial
// judgment, does not determine note containment, and does not influence
// sorting or recommendation scoring -- it is a pure display/explanatory
// projection, not a second scoring signal.
//
// Thresholds match the Phase 2C editorial rubric exactly (see
// packages/catalog/src/fragrances.js, near NOTE_PROMINENCE_BY_ID):
//   9-10 = defining/signature      -> "defining"
//   7-8  = very evident            -> "veryEvident"
//   4-6  = clearly perceptible     -> "clearlyPerceptible"
//   1-3  = secondary but identifiable -> "secondary"
//   anything else                  -> null
//
// A missing/invalid score means "no calibrated perceptual level" -- never
// score 0, never "note absent from this fragrance" (that is decided by the
// fragrance's own pyramid arrays, an entirely separate concern), and never
// a fifth "unscored" tier. null is the only representation of that state;
// this function never returns the string "unscored".
//
// Deliberately dependency-free: this module imports nothing (not
// fragrances, not notes, not any Builder or locale module) and depends
// only on its `score` argument, so it stays trivially merchant-neutral.
export function getNoteProminenceLevel(score) {
  if (!Number.isInteger(score) || score < 1 || score > 10) {
    return null;
  }

  if (score >= 9) {
    return "defining";
  }

  if (score >= 7) {
    return "veryEvident";
  }

  if (score >= 4) {
    return "clearlyPerceptible";
  }

  return "secondary";
}
