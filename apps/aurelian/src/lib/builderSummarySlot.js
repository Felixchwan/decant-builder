import { useSyncExternalStore } from "react";

// The header slot the Builder docks its box summary into (`#aurelian-builder-summary-slot`, rendered
// by SiteHeader on the Builder route only).
//
// SiteHeader and the Builder are siblings under the root layout, so they share no React ancestor to
// pass the slot through. They used to meet through a single `document.getElementById` read made while
// the Builder's first render ran. That read is only valid if the slot is already in the DOM at that
// moment, which is true on a direct load (the header is server-rendered, and the Builder mounts after
// hydration) and false on a client-side navigation to the Builder once its chunk is already loaded:
// the header and the Builder render in the SAME commit, so during the Builder's render the slot has
// not been committed yet. The read returned null, was kept for the life of the component, and the box
// stayed in the inline panel for the whole visit.
//
// This tiny store replaces that one-shot read. The header's slot element registers itself through a
// callback ref the moment it is attached (and unregisters when it goes away); the Builder subscribes
// with useSyncExternalStore, so it renders with null if it must and is re-rendered with the element as
// soon as it exists -- before the browser paints, since a store change that lands during a commit is
// flushed synchronously. Whichever of the two mounts first, the Builder ends up with the live element.
let slot = null;
const listeners = new Set();

export function registerBuilderSummarySlot(element) {
  const next = element ?? null;
  if (next === slot) return;
  slot = next;
  listeners.forEach((listener) => listener());
}

export function subscribeToBuilderSummarySlot(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getBuilderSummarySlot() {
  return slot;
}

// What the Builder host passes as `stickySummaryPortalTarget`: the slot element, or null while there
// is none (server render, other routes), re-evaluated whenever the slot appears, changes or goes.
export function useBuilderSummarySlot() {
  return useSyncExternalStore(subscribeToBuilderSummarySlot, getBuilderSummarySlot, () => null);
}
