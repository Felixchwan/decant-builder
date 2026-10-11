import { useEffect, useId, useRef, useState } from "react";

// How many strengths show before the rest are folded away.
export const VISIBLE_STRENGTHS = 3;

// The "Box Analysis" strengths as a short list with a quiet disclosure (opt-in: `compactStrengths` on
// DiscoveryBoxBuilder). `items` is the existing, already-ordered and already-labelled strengths; this only
// decides how many show. The first VISIBLE_STRENGTHS are simply the first of the list, never re-ranked, and
// with that many or fewer there is no control at all.
//
// The control is a real button that toggles in place (no dialog). It stays mounted, so keyboard focus is never
// lost when the list grows or shrinks. Because the list sits above it, expanding pushes it down and collapsing
// pulls it up; if either would leave it out of view it is scrolled the least distance back (the host sets the
// scroll margins that keep it clear of what it pins), and the page is otherwise left alone.
export default function CollapsibleStrengths({ items, translator }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const buttonRef = useRef(null);
  const hasToggledRef = useRef(false);
  const listId = useId();
  const hiddenCount = items.length - VISIBLE_STRENGTHS;
  const visibleItems = isExpanded ? items : items.slice(0, VISIBLE_STRENGTHS);

  useEffect(() => {
    if (!hasToggledRef.current) {
      return;
    }

    buttonRef.current?.scrollIntoView?.({ block: "nearest", inline: "nearest", behavior: "instant" });
  }, [isExpanded]);

  return (
    <>
      <div id={listId} className="coverage-strengths">
        {visibleItems.map((item) => (
          <p key={item.key} className="coverage-strength">
            {item.text}
          </p>
        ))}
      </div>

      {hiddenCount > 0 && (
        <button
          ref={buttonRef}
          type="button"
          className="coverage-strengths-toggle"
          aria-expanded={isExpanded}
          aria-controls={listId}
          onClick={() => {
            hasToggledRef.current = true;
            setIsExpanded((expanded) => !expanded);
          }}
        >
          <span>
            {isExpanded
              ? translator?.t?.("collectionIntelligence.showLessStrengths") || "Show less"
              : translator?.t?.("collectionIntelligence.moreStrengths", { count: hiddenCount }) ||
                `+${hiddenCount} more strengths`}
          </span>
          <span className="coverage-strengths-chevron" aria-hidden="true" />
        </button>
      )}
    </>
  );
}
