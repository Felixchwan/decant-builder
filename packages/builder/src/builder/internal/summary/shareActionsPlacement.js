// Where the Collection Card share actions (download / native share) render.
//
//   "panel"    in the panel's own flow, exactly where they have always been (the default)
//   "summary"  inside the docked summary card, behind a stable anchor
//              (.builder-panel-summary-accessory) a host can position beside the box
//
// Opt-in only: a host that never passes `dockShareActions` always gets "panel". Even when
// opted in, the actions only move while the summary card is docked into the host's slot AND
// expanded -- a collapsed dock has no box to sit beside, and below the docking breakpoint the
// summary renders inline in the panel, so in both cases they stay in the panel flow. It is one
// block of markup with one set of handlers either way; this only decides which parent hosts it.
export function getShareActionsPlacement({
  dockShareActions = false,
  isSummaryDocked = false,
  isSummaryCollapsed = false,
} = {}) {
  return dockShareActions === true && isSummaryDocked === true && isSummaryCollapsed !== true
    ? "summary"
    : "panel";
}
