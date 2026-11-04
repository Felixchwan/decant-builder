import { useEffect } from "react";

// Keeps the phone edge tabs off the footer's links.
//
// The edge tab "Sugerencias" floats at the left edge, at a fixed height above the bottom of the screen. Everywhere in the catalog
// that edge is empty (see builder-suggestions.css), but at the very end of the page the footer scrolls up into it and the tab
// would sit over the first few pixels of the footer's links. Nothing about the footer can move, shrink or be covered, so the tab
// steps aside: while the footer is in the tab's band it is not displayed (the host CSS reads the attribute below).
//
// One IntersectionObserver on the footer, created once when the Builder mounts and disconnected when it goes: the browser reports
// only the moment the footer enters or leaves the band, so nothing listens to scroll or polls. The attribute is the whole state,
// it lives on <html> only while the Builder is mounted, and nothing is stored.
//
// The band: the tab's bottom edge sits `EDGE_TAB_BOTTOM_PX` above the bottom of the screen (the same 120px minimum as its CSS:
// `max(120px, env(safe-area-inset-bottom) + 104px)`). The observer's root is shrunk from the bottom by that distance plus a margin,
// so "the footer intersects the root" means "the footer's top edge has reached the tab's bottom edge, or is about to". The margin
// also covers a phone whose bottom safe area lifts the tab above 120px (up to 56px more) without reading `env()` from script.
export const FOOTER_NEAR_ATTRIBUTE = "data-footer-near";
export const EDGE_TAB_BOTTOM_PX = 120;
export const EDGE_TAB_ZONE_MARGIN_PX = 40;

// Pure over its arguments, so it can be exercised without a browser. Returns the cleanup.
export function observeFooterNearEdgeTab({
  doc,
  ObserverClass = typeof IntersectionObserver === "function" ? IntersectionObserver : null,
  footerSelector = "footer.site-footer",
}) {
  const footer = doc?.querySelector?.(footerSelector);

  if (!footer || !ObserverClass) {
    return () => {};
  }

  const root = doc.documentElement;
  const observer = new ObserverClass(
    (entries) => {
      const latest = entries[entries.length - 1];

      if (latest?.isIntersecting) {
        root.setAttribute(FOOTER_NEAR_ATTRIBUTE, "");
      } else {
        root.removeAttribute(FOOTER_NEAR_ATTRIBUTE);
      }
    },
    { rootMargin: `0px 0px -${EDGE_TAB_BOTTOM_PX + EDGE_TAB_ZONE_MARGIN_PX}px 0px` }
  );

  observer.observe(footer);

  return () => {
    observer.disconnect();
    root.removeAttribute(FOOTER_NEAR_ATTRIBUTE);
  };
}

export function useFooterNearEdgeTab() {
  useEffect(() => observeFooterNearEdgeTab({ doc: document }), []);
}
