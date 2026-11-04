import { useSyncExternalStore } from "react";

// The Builder's own "go to my box" action, made available to the site header.
//
// SiteHeader and the Builder are siblings under the root layout, so they share no React ancestor: the same situation, and
// the same answer, as the summary slot (see builderSummarySlot.js). The Builder owns the real action (the one its floating
// "Ver caja" tab runs: switch to the box, remember where the catalog was, restore it on the way back, move focus) and
// publishes it through its generic `onBoxShortcutChange` hook; this tiny store hands it on to whoever subscribes. Nothing
// here re-implements any of it, and nothing here is persisted: the action only exists while a Builder is mounted.
//
//   { count, open }   the number of fragrances in the box, and the Builder's stable box action
//   null              no Builder is mounted (any other route, the server render)
let shortcut = null;
const listeners = new Set();

export function registerBuilderBoxShortcut(next) {
  const value = next ?? null;
  const isSame = value === shortcut || (value && shortcut && value.count === shortcut.count && value.open === shortcut.open);

  if (isSame) return;
  shortcut = value;
  listeners.forEach((listener) => listener());
}

export function subscribeToBuilderBoxShortcut(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getBuilderBoxShortcut() {
  return shortcut;
}

export function useBuilderBoxShortcut() {
  return useSyncExternalStore(subscribeToBuilderBoxShortcut, getBuilderBoxShortcut, () => null);
}
