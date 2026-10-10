import { useEffect, useId, useLayoutEffect, useReducer, useRef, useState } from "react";
import { metadataAssets } from "@discovery-box/catalog";
import { formatIntelligenceLabel } from "../builder/internal/intelligence/buildCollectionIntelligenceViewModel.js";
import {
  CLOSED_ACCORD_EVIDENCE,
  getAccordEvidencePerfumes,
  getActiveAccordEvidence,
  reduceAccordEvidence,
} from "../builder/internal/intelligence/accordEvidence.js";

// How long the card outlives the pointer leaving a chip, so a mouse can cross the gap between the chip and
// the card (and wheel-scroll the list) without the card vanishing under it.
const HOVER_BRIDGE_MS = 140;

// The "Dominant Accords" chips of the expanded Collection Intelligence, as an opt-in alternative to the
// hover-only name tooltip (see `showAccordEvidence` on DiscoveryBoxBuilder). Each chip is a real button;
// its evidence card lists the fragrances behind the count with their bottle and house.
//
// A card is open for one of three reasons (see accordEvidence.js): a resting mouse (preview), keyboard
// focus on the chip or inside its card, or a click / tap (or Enter / Space), which pins it. None is the
// only way in, and a hover never replaces what focus or a pin is showing.
//
// Keyboard: the card is rendered right after the chip it belongs to, so Tab goes chip -> card list -> next
// chip. The list is a tab stop only while it scrolls, so every fragrance behind a count can be reached.
// Escape closes the card (from anywhere) and, if focus was inside the group, returns it to the chip.
// The card is one absolutely positioned element under the active chip's row: it cannot be clipped by, or
// crowd, its neighbours.
export default function AccordEvidenceGroup({
  accordMap,
  selectedPerfumes,
  assetResolver,
  translator,
}) {
  const [state, dispatch] = useReducer(reduceAccordEvidence, CLOSED_ACCORD_EVIDENCE);
  const [cardTop, setCardTop] = useState(0);
  const groupRef = useRef(null);
  const triggerRefs = useRef(new Map());
  const hoverTimerRef = useRef(null);
  const isRestoringFocusRef = useRef(false);
  const cardId = useId();
  const t = translator?.t || ((key) => key);
  const entries = Object.entries(accordMap || {});
  const requestedAccord = getActiveAccordEvidence(state);
  const activeAccord = entries.some(([accord]) => accord === requestedAccord) ? requestedAccord : null;

  const cancelHoverEnd = () => {
    window.clearTimeout(hoverTimerRef.current);
    hoverTimerRef.current = null;
  };
  const hoverStart = (event, accord) => {
    if (event.pointerType === "mouse") {
      cancelHoverEnd();
      dispatch({ type: "hover", accord });
    }
  };
  const hoverEnd = (event) => {
    if (event.pointerType === "mouse") {
      cancelHoverEnd();
      hoverTimerRef.current = window.setTimeout(() => dispatch({ type: "hoverEnd" }), HOVER_BRIDGE_MS);
    }
  };

  useEffect(() => cancelHoverEnd, []);

  // The card sits just under the active chip. offsetTop is relative to the group (the card's offset
  // parent), and is re-read whenever the active chip changes or the chips reflow.
  useLayoutEffect(() => {
    if (activeAccord === null) {
      return undefined;
    }

    const place = () => {
      const trigger = triggerRefs.current.get(activeAccord);

      if (trigger) {
        setCardTop(trigger.offsetTop + trigger.offsetHeight + 6);
      }
    };

    place();
    window.addEventListener("resize", place);

    return () => window.removeEventListener("resize", place);
  }, [activeAccord, entries.length]);

  // While a card is open: a press outside the group closes it, and Escape closes it wherever focus is
  // (a hover-opened card has no focus inside the group, and must still be dismissible without moving it).
  useEffect(() => {
    if (activeAccord === null) {
      return undefined;
    }

    const dismissOutside = (event) => {
      if (groupRef.current && !groupRef.current.contains(event.target)) {
        cancelHoverEnd();
        dispatch({ type: "dismiss" });
      }
    };
    const dismissOnEscape = (event) => {
      if (event.key !== "Escape") {
        return;
      }

      const originatingTrigger = triggerRefs.current.get(activeAccord);
      const wasFocusInside = groupRef.current?.contains(document.activeElement);

      cancelHoverEnd();
      dispatch({ type: "dismiss" });

      if (wasFocusInside && originatingTrigger) {
        // Returning focus to the chip must not read as the user focusing it (which would reopen the card).
        isRestoringFocusRef.current = true;
        originatingTrigger.focus();
        isRestoringFocusRef.current = false;
      }
    };

    document.addEventListener("pointerdown", dismissOutside);
    document.addEventListener("keydown", dismissOnEscape);

    return () => {
      document.removeEventListener("pointerdown", dismissOutside);
      document.removeEventListener("keydown", dismissOnEscape);
    };
  }, [activeAccord]);

  const handleFocus = (accord) => {
    if (!isRestoringFocusRef.current) {
      dispatch({ type: "focus", accord });
    }
  };

  const handleBlur = (event) => {
    // Focus moving between the chips and the card stays inside the group; only leaving it releases focus.
    if (!groupRef.current?.contains(event.relatedTarget)) {
      dispatch({ type: "focusLeft" });
    }
  };

  const countLabel = (count) =>
    t(count === 1 ? "collectionIntelligence.accordEvidence.countOne" : "collectionIntelligence.accordEvidence.countMany", {
      count,
    });

  return (
    <div ref={groupRef} className="summary-tags accord-evidence-group" onBlur={handleBlur}>
      {entries.flatMap(([accord, perfumeNames]) => {
        const displayLabel = formatIntelligenceLabel(accord);
        const isOpen = accord === activeAccord;
        const assetKey = metadataAssets.accords?.[accord] || null;
        const asset = assetKey && assetResolver ? assetResolver(assetKey) : null;
        const trigger = (
          <button
            key={accord}
            ref={(node) => {
              if (node) {
                triggerRefs.current.set(accord, node);
              } else {
                triggerRefs.current.delete(accord);
              }
            }}
            type="button"
            className={`summary-metadata-chip accord-evidence-trigger${asset ? " detail-asset-chip" : ""}${
              isOpen ? " is-open" : ""
            }`}
            aria-expanded={isOpen}
            aria-controls={isOpen ? cardId : undefined}
            aria-label={`${displayLabel}: ${countLabel(perfumeNames.length)}`}
            onPointerEnter={(event) => hoverStart(event, accord)}
            onPointerLeave={hoverEnd}
            onFocus={() => handleFocus(accord)}
            onClick={() => {
              cancelHoverEnd();
              dispatch({ type: "toggle", accord });
            }}
          >
            {asset && (
              <img
                src={asset}
                alt=""
                loading="lazy"
                onError={(event) => {
                  event.currentTarget.remove();
                }}
              />
            )}
            <span className="accord-evidence-name">{displayLabel}</span>
            <span className="accord-evidence-count" aria-hidden="true">
              {perfumeNames.length}
            </span>
          </button>
        );

        return isOpen
          ? [
              trigger,
              <AccordEvidenceCard
                key={`${accord}-evidence`}
                id={cardId}
                accord={accord}
                perfumes={getAccordEvidencePerfumes(selectedPerfumes, accord)}
                top={cardTop}
                countLabel={countLabel}
                onPointerEnter={(event) => hoverStart(event, accord)}
                onPointerLeave={hoverEnd}
                onFocus={() => handleFocus(accord)}
              />,
            ]
          : [trigger];
      })}
    </div>
  );
}

// The card. `tabIndex={-1}` makes a click anywhere on it (a row, the heading) land focus on the card itself,
// inside the group, so a press inside never reads as focus leaving. The list becomes a tab stop only when it
// actually scrolls, so keyboard users can reach every row without an extra stop when there is nothing to
// scroll.
export function AccordEvidenceCard({
  id,
  accord,
  perfumes,
  top = 0,
  countLabel,
  onPointerEnter,
  onPointerLeave,
  onFocus,
}) {
  const listRef = useRef(null);
  const [isScrollable, setIsScrollable] = useState(false);
  const label = `${formatIntelligenceLabel(accord)}: ${countLabel(perfumes.length)}`;

  useLayoutEffect(() => {
    const list = listRef.current;

    if (list) {
      setIsScrollable(list.scrollHeight > list.clientHeight + 1);
    }
  }, [perfumes.length]);

  return (
    <div
      id={id}
      className="accord-evidence"
      role="region"
      aria-label={label}
      tabIndex={-1}
      style={{ top }}
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
      onFocus={onFocus}
    >
      <div className="accord-evidence-heading">
        <strong>{formatIntelligenceLabel(accord)}</strong>
        <span>{countLabel(perfumes.length)}</span>
      </div>

      <ul
        ref={listRef}
        className="accord-evidence-list"
        aria-label={label}
        tabIndex={isScrollable ? 0 : undefined}
      >
        {perfumes.map((perfume) => (
          <li key={perfume.id}>
            <img
              src={perfume.image || perfume.imageFallback}
              alt=""
              loading="lazy"
              onError={(event) => {
                event.currentTarget.onerror = null;

                if (perfume.imageFallback && event.currentTarget.src !== perfume.imageFallback) {
                  event.currentTarget.src = perfume.imageFallback;
                }
              }}
            />
            <span>
              <strong>{perfume.name}</strong>
              {perfume.brand && <em>{perfume.brand}</em>}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
