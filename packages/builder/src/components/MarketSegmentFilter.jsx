import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { MARKET_SEGMENTS } from "@discovery-box/catalog";

// The compact "Type" control beside the catalog count: a button that discloses three native checkboxes (arabic, designer,
// niche). Opt-in (`features.marketSegmentFilter`); a host that never turns it on never renders any of this.
//
// A plain disclosure, deliberately not a menu: no role="menu", no arrow-key model. The button toggles the group (Enter and
// Space are clicks); Tab walks the checkboxes in order; Escape closes it and puts focus back on the button; a press
// outside the group closes it, and so does focus leaving the button and the group. It never traps focus.
//
// The selection is owned by the caller (the Builder keeps it in plain state, never in storage), so every fresh page load
// starts with all three on. Any combination may be switched off, the last one included.
export default function MarketSegmentFilter({ t, enabledSegments, onToggleSegment }) {
  const [isOpen, setIsOpen] = useState(false);
  const [alignEnd, setAlignEnd] = useState(false);
  const groupRef = useRef(null);
  const buttonRef = useRef(null);
  const panelRef = useRef(null);
  const panelId = useId();
  const titleId = useId();

  const label = t("filter.marketSegment.label");
  const enabledCount = MARKET_SEGMENTS.filter((segment) => enabledSegments.includes(segment)).length;
  const isFiltered = enabledCount < MARKET_SEGMENTS.length;

  // Opening must never leave the group outside the viewport: if it would run past the right edge it hangs from the
  // button's right edge instead. Nothing else moves; the group overlays what is under it.
  useLayoutEffect(() => {
    const panel = panelRef.current;

    if (!isOpen || !panel) {
      setAlignEnd(false);
      return;
    }

    const edge = 12;

    if (panel.getBoundingClientRect().right > window.innerWidth - edge) {
      setAlignEnd(true);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    const dismissOutside = (event) => {
      if (groupRef.current && !groupRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    const dismissOnEscape = (event) => {
      if (event.key !== "Escape") {
        return;
      }

      if (groupRef.current?.contains(document.activeElement)) {
        buttonRef.current?.focus();
      }

      setIsOpen(false);
    };

    document.addEventListener("pointerdown", dismissOutside);
    document.addEventListener("keydown", dismissOnEscape);

    return () => {
      document.removeEventListener("pointerdown", dismissOutside);
      document.removeEventListener("keydown", dismissOnEscape);
    };
  }, [isOpen]);

  const handleBlur = (event) => {
    // Focus moving between the button and the checkboxes stays inside the group; only leaving it closes the group. The panel
    // is focusable (tabIndex -1) so that a press on a row's label, which is not itself focusable, lands focus on the panel
    // rather than on nothing: without that, the press would close the group before its click could toggle the checkbox.
    if (!groupRef.current?.contains(event.relatedTarget)) {
      setIsOpen(false);
    }
  };

  return (
    <div
      ref={groupRef}
      className={`market-segment-filter${isOpen ? " is-open" : ""}${isFiltered ? " is-filtered" : ""}`}
      onBlur={handleBlur}
    >
      <button
        ref={buttonRef}
        type="button"
        className="market-segment-filter__trigger"
        aria-expanded={isOpen}
        aria-controls={isOpen ? panelId : undefined}
        aria-label={t("filter.marketSegment.triggerAria", { label, count: enabledCount, total: MARKET_SEGMENTS.length })}
        onClick={() => setIsOpen((open) => !open)}
      >
        <span className="market-segment-filter__label" aria-hidden="true">
          {isFiltered ? `${label} · ${enabledCount}` : label}
        </span>
        <span className="market-segment-filter__chevron" aria-hidden="true" />
      </button>

      {isOpen && (
        <div
          ref={panelRef}
          id={panelId}
          className={`market-segment-filter__panel${alignEnd ? " is-end" : ""}`}
          role="group"
          aria-labelledby={titleId}
          tabIndex={-1}
        >
          <span id={titleId} className="market-segment-filter__title">
            {t("filter.marketSegment.group")}
          </span>

          {MARKET_SEGMENTS.map((segment) => (
            <label key={segment} className="market-segment-filter__option">
              <input
                type="checkbox"
                checked={enabledSegments.includes(segment)}
                onChange={(event) => onToggleSegment(segment, event.target.checked)}
              />
              <span className="market-segment-filter__option-label">{t(`filter.marketSegment.${segment}`)}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
