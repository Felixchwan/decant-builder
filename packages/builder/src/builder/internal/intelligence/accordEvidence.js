// "Dominant Accords" evidence: which fragrances stand behind an accord's count, and when the card that
// lists them is open.
//
// The list is NOT a new analysis. `buildBoxSummary` already counts an accord once per selected fragrance
// whose `accords` include it (`accordMap[accord]` is those fragrances' names); the evidence card shows
// those same fragrances, so its rows always agree with the count on the chip. It only adds what a name
// alone cannot show (the bottle and the house).

export function getAccordEvidencePerfumes(selectedPerfumes, accord) {
  return (Array.isArray(selectedPerfumes) ? selectedPerfumes : []).filter((perfume) =>
    (perfume?.accords || []).includes(accord)
  );
}

// Three independent reasons a card can be open, each owned by one input:
//
//   hover   a mouse resting on a chip or on the card (a transient preview; never touch)
//   focus   keyboard focus on a chip or anywhere inside its card (stays while the pointer leaves)
//   pinned  a click or tap (or Enter / Space), the user's explicit choice
//
// The card shown is the first that exists, in this order: pinned, focus, hover. So a hover can never
// replace what focus or a pin is showing, and moving the pointer away only ends the hover: it cannot close
// a card that is still open because of focus or a pin.
export const CLOSED_ACCORD_EVIDENCE = Object.freeze({ pinned: null, focus: null, hover: null });

export function getActiveAccordEvidence(state) {
  return state.pinned ?? state.focus ?? state.hover ?? null;
}

export function reduceAccordEvidence(state, event) {
  switch (event?.type) {
    case "hover":
      return state.hover === event.accord ? state : { ...state, hover: event.accord };
    case "hoverEnd":
      return state.hover === null ? state : { ...state, hover: null };
    case "focus":
      // Moving keyboard focus to a different chip is a new choice: it replaces a pin on another accord.
      // Focus moving within the same accord (chip to its card) keeps whatever is already open.
      return state.focus === event.accord && (state.pinned === null || state.pinned === event.accord)
        ? state
        : { ...state, focus: event.accord, pinned: state.pinned === event.accord ? state.pinned : null };
    case "toggle":
      // A second click on the pinned chip closes the card whatever else was holding it open.
      return state.pinned === event.accord
        ? CLOSED_ACCORD_EVIDENCE
        : { ...state, pinned: event.accord, hover: event.accord };
    case "focusLeft":
      // Focus left the chips and the card altogether: nothing keeps the card open but a hovering mouse.
      return { ...state, focus: null, pinned: null };
    case "dismiss":
      // Escape, or a click outside: close everything. A mouse that is still resting on a chip does not
      // reopen it, because the hover state is gone until the pointer leaves and enters again.
      return CLOSED_ACCORD_EVIDENCE;
    default:
      return state;
  }
}
