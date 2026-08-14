// The docking boundary decision, kept independent of any browser observation
// primitive (IntersectionObserver, scroll events, ResizeObserver, ...) so it
// can be exercised with plain numbers in a unit test, without a real DOM or
// compositor. sentinelTop is the docking sentinel's current
// getBoundingClientRect().top -- the sentinel sits at the summary card's
// natural (pre-dock) position, so a negative top means the page has been
// scrolled past that point and the card should relocate into the host's
// header slot.
export function computeSummaryDockState({ sentinelTop, isDesktopViewport }) {
  if (!isDesktopViewport) {
    return false;
  }
  return sentinelTop < 0;
}
