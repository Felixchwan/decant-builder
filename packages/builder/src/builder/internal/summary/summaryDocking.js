// Whether the box summary card is docked into the host's slot.
//
// Docking is a pure function of two facts: the host has supplied a portal target, and the viewport is
// desktop-sized. Both can change after the first render -- the viewport on a live resize, and the target
// when a host can only produce it after mount (a header slot that is committed in the same commit as the
// Builder, for example) -- so the docked state has to be re-derived whenever either does, not captured
// once from the first render's values.
export function getSummaryDockedState({ hasTarget, isDesktop }) {
  return Boolean(hasTarget) && Boolean(isDesktop);
}
