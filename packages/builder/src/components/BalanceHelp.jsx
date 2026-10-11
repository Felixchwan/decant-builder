import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";

// The heading of "Collection Balance" together with the one small info button that explains how to read it
// (opt-in: `showBalanceHelp` on DiscoveryBoxBuilder). ONE component and ONE copy for every viewport: a host's
// CSS decides how wide the help is; nothing here branches on the viewport and nothing depends on hover.
//
// A plain disclosure. A click or tap on the button toggles the help (Enter and Space are clicks), and keyboard
// focus arriving on the button opens it (only keyboard focus: a pointer press focuses the button too, and
// must not open it just before its own click toggles it shut). The help closes on Escape, on a press outside,
// and when focus leaves the button and the help.
//
// Keyboard: the help is rendered right after its button. Escape returns focus to the button. The help is one
// absolutely positioned element under the heading: it overlays the rows and never reflows them.
export default function BalanceHelp({ label, model }) {
  const [isOpen, setIsOpen] = useState(false);
  const groupRef = useRef(null);
  const buttonRef = useRef(null);
  const panelRef = useRef(null);
  const panelId = useId();

  // Opening must never leave the help outside the viewport (a phone scrolled to the Balance section, a short
  // window). The help hangs from the heading, so the heading is what stays put: the page scrolls only as far
  // as needed to give the help its room, and never so far that the heading slides under what the host keeps
  // pinned to the top (the heading's scroll-margin-top says how much that is). If there is still not enough
  // room, the help is capped to what is left and scrolls inside itself.
  useLayoutEffect(() => {
    const group = groupRef.current;
    const panel = panelRef.current;

    if (!isOpen || !group || !panel) {
      return;
    }

    const edge = 12;
    const clearance = Number.parseFloat(window.getComputedStyle(group).scrollMarginTop) || 0;
    const headingTop = group.getBoundingClientRect().top;
    const naturalHeight = panel.scrollHeight + 2;
    const roomBelow = window.innerHeight - edge - panel.getBoundingClientRect().top;
    const shortfall = naturalHeight - roomBelow;
    const delta = shortfall > 0 ? Math.min(shortfall, Math.max(0, headingTop - clearance)) : 0;

    if (delta > 0) {
      window.scrollBy({ top: delta, behavior: "instant" });
    }

    const remaining = window.innerHeight - edge - panel.getBoundingClientRect().top;

    if (remaining < naturalHeight) {
      panel.style.maxHeight = `${Math.max(remaining, 224)}px`;
    }

    // A help that has to scroll inside itself must be reachable by keyboard, or its last lines would not be.
    if (panel.scrollHeight > panel.clientHeight + 1) {
      panel.tabIndex = 0;
    }
  }, [isOpen]);

  // While open: a press outside the group closes it, and Escape closes it wherever focus is.
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

      // Focus goes back to the button first. If it was elsewhere in the group, that focus event asks to open
      // the help, and the close queued right after it wins (both are batched), so the help ends closed.
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

  const handleButtonFocus = (event) => {
    if (event.currentTarget.matches(":focus-visible")) {
      setIsOpen(true);
    }
  };

  const handleBlur = (event) => {
    // Focus moving between the button and the help stays inside the group; only leaving it closes the help.
    if (!groupRef.current?.contains(event.relatedTarget)) {
      setIsOpen(false);
    }
  };

  return (
    <div ref={groupRef} className="collection-balance-heading" onBlur={handleBlur}>
      <span className="collection-balance-title">{label}</span>

      <button
        ref={buttonRef}
        type="button"
        className={`balance-help-button${isOpen ? " is-open" : ""}`}
        aria-expanded={isOpen}
        aria-controls={isOpen ? panelId : undefined}
        aria-label={model.title}
        onFocus={handleButtonFocus}
        onClick={() => setIsOpen((open) => !open)}
      >
        <span aria-hidden="true">i</span>
      </button>

      {isOpen && (
        <div ref={panelRef} id={panelId} className="balance-help-panel" role="region" aria-label={model.title} tabIndex={-1}>
          <strong className="balance-help-title">{model.title}</strong>
          <p className="balance-help-intro">{model.intro}</p>

          <dl className="balance-help-list">
            {model.items.map((item) => (
              <div className="balance-help-item" key={item.label}>
                <dt>{item.name}</dt>
                <dd>{item.description}</dd>
              </div>
            ))}
          </dl>

          <p className="balance-help-footer">{model.footer}</p>
        </div>
      )}
    </div>
  );
}
