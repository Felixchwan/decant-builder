// The proposal rows the Composer proposal modal is showing right now: each slot's
// currently selected alternative, in display order. The modal renders these, and
// the details opened from a row navigate within exactly this set.
export function buildVisibleProposalItems(proposal) {
  if (!Array.isArray(proposal?.slotAlternatives) || proposal.slotAlternatives.length === 0) {
    return null;
  }

  return proposal.slotAlternatives
    .map((slot) => {
      const selectedIndex = Number.isInteger(slot.selectedAlternativeIndex)
        ? slot.selectedAlternativeIndex
        : 0;
      const selectedAlternative = slot.alternatives?.[selectedIndex];

      if (!selectedAlternative?.perfume) {
        return null;
      }

      return {
        slotId: slot.slotId,
        slotIndex: slot.slotIndex,
        id: selectedAlternative.id,
        perfume: selectedAlternative.perfume,
        preserved: Boolean(slot.preserved),
        newlyAdded: !slot.preserved,
        reasons: (selectedAlternative.reasons || []).slice(0, 3),
        alternatives: slot.alternatives || [],
        selectedAlternativeIndex: selectedIndex,
      };
    })
    .filter(Boolean);
}
