const STATUS_LABELS = {
  completed: "Discovery Box Proposal",
  partial: "Partial Discovery Box",
  already_complete: "Box Already Complete",
  at_max: "Box Full",
  invalid_selection: "Current Box Needs Attention",
  impossible: "No Proposal Available",
  failed: "No Proposal Available",
  malformed_input: "No Proposal Available",
};

const EXPLANATION_LABELS = {
  collection_completed: "Composer found a complete Discovery Box.",
  valid_partial_collection: "Composer found a valid partial box.",
  impossible_request: "Composer could not satisfy the current request.",
  invalid_composition_result: "Composer could not produce an applicable proposal.",
  excellent_preference_match: "Strong match to selected preferences.",
  strong_preference_match: "Good match to selected preferences.",
  partial_preference_match: "Some selected preferences are represented.",
  weak_preference_match: "Selected preferences are difficult to satisfy together.",
  balanced_identity: "Balanced collection profile.",
  versatile_identity: "Versatile collection profile.",
  explorer_diversity: "Discovery-oriented variety.",
  signature_aligned: "Aligned with a signature-style box.",
  signature_identity: "Signature-focused collection profile.",
  refinement_improved_quality: "Composer refinement improved the proposal.",
  refinement_no_change: "Composer refinement kept the strongest proposal.",
  excellent_budget_efficiency: "Uses the budget efficiently.",
  efficient_budget_use: "Stays within the selected budget.",
  strong_seasons_coverage: "Strong seasonal coverage.",
  strong_occasions_coverage: "Strong occasion coverage.",
  strong_vibes_coverage: "Strong vibe coverage.",
  strong_diversity: "Strong scent diversity.",
  strong_coherence: "Coherent scent direction.",
  season_gap: "Some seasonal coverage remains limited.",
  occasion_gap: "Some occasion coverage remains limited.",
  vibe_gap: "Some vibe coverage remains limited.",
  high_redundancy: "Some scent directions may be repetitive.",
  unmatched_preferences: "Some preferences remain underrepresented.",
  fill_remaining_slots: "Additional slots could still be filled.",
  relax_request_constraints: "Relax constraints to generate more options.",
};

export function getComposerProposalStatusLabel(status) {
  return STATUS_LABELS[status] || "Discovery Box Proposal";
}

export function getComposerProposalExplanationLabel(explanation = {}) {
  return EXPLANATION_LABELS[explanation.code] || "";
}
