"use client";

import { createContext, useContext, useEffect, useLayoutEffect, useState } from "react";
import { readIntroDismissedPreference, writeIntroDismissedPreference } from "../lib/introPreference.js";

// useLayoutEffect warns when it runs during SSR (it does nothing there);
// on the client it's exactly what avoids a visible flash between "React
// hydrates with the SSR default" and "the real stored preference applies"
// -- it fires synchronously before the browser's next paint, unlike
// useEffect. This is the standard isomorphic-effect guard for that pair
// of concerns.
const useIsomorphicLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

// Single source of truth for "has this visitor dismissed the
// /build-your-box intro text", shared between BuilderIntroHeader (static,
// server-rendered, mounts immediately) and the Builder's own shared hero
// section (packages/builder, mounts later via BuilderMount's ssr:false
// chunk). Deliberately a plain boolean + two actions, not the storage
// value itself -- both consumers react to state changes the normal React
// way; only this provider touches localStorage.
//
// SSR/first-paint default is always "expanded" (isIntroDismissed: false),
// matching what the server can know. useIsomorphicLayoutEffect corrects
// this from the real stored value immediately after mount, before the
// browser's next paint -- a brief flash of the expanded intro is possible
// on a cold load for a visitor who previously dismissed it (the same
// class of gap the pre-hydration script in build-your-box/page.jsx closes
// for the unrelated first-time-visitor case), but the state itself is
// never wrong once mounted, and no hydration mismatch occurs since the
// component's own first render always matches the server's.
export const IntroPreferenceContext = createContext({
  isIntroDismissed: false,
  dismissIntro: () => {},
  restoreIntro: () => {},
});

export function IntroPreferenceProvider({ children }) {
  const [isIntroDismissed, setIsIntroDismissed] = useState(false);

  useIsomorphicLayoutEffect(() => {
    setIsIntroDismissed(readIntroDismissedPreference());
  }, []);

  function dismissIntro() {
    writeIntroDismissedPreference(true);
    setIsIntroDismissed(true);
  }

  function restoreIntro() {
    writeIntroDismissedPreference(false);
    setIsIntroDismissed(false);
  }

  return (
    <IntroPreferenceContext.Provider value={{ isIntroDismissed, dismissIntro, restoreIntro }}>
      {children}
    </IntroPreferenceContext.Provider>
  );
}

export function useIntroPreference() {
  return useContext(IntroPreferenceContext);
}
