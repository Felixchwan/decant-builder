import { describe, expect, it } from "vitest";

import { ANALYTICS_EVENTS } from "../../analytics/events.js";
import {
  applyOnboardingAction,
  buildOnboardingPathSelectionModel,
  isComposerOnboardingAvailable,
  ONBOARDING_ACTIONS,
  resolveOnboardingAction,
} from "./onboardingPathSelection.js";

const config = {
  features: {
    composer: true,
  },
  copy: {
    introAriaLabel: "Intro",
    onboardingTitle: "Welcome",
    onboardingIntro: "Choose a path.",
    onboardingDesktopDescription: "Build manually or try Composer.",
    onboardingManualTitle: "Explore the catalog yourself",
    onboardingManualDescription: "Browse by hand.",
    onboardingManualAction: "Explore Catalog",
    onboardingComposerTitle: "Let Composer build a proposal",
    onboardingComposerDescription: "Review a proposal first.",
    onboardingComposerAction: "Use Composer",
    onboardingDesktopComposerAction: "Try Composer",
    onboardingSwitchNote: "Switch any time.",
    onboardingCloseLabel: "Close onboarding",
    introDismissLabel: "Got it",
  },
};

describe("onboarding path selection", () => {
  it("builds separate mobile path choices and compact desktop actions", () => {
    const model = buildOnboardingPathSelectionModel({ config });

    expect(model.mobile.paths.map((path) => path.id)).toEqual([
      ONBOARDING_ACTIONS.MOBILE_MANUAL,
      ONBOARDING_ACTIONS.MOBILE_COMPOSER,
    ]);
    expect(model.desktop.dismissLabel).toBe("Got it");
    expect(model.desktop.composerLabel).toBe("Try Composer");
    expect(model.mobileCloseLabel).toBe("Close onboarding");
  });

  it("hides Composer actions when config disables Composer", () => {
    const disabledConfig = {
      ...config,
      features: {
        composer: false,
      },
    };
    const model = buildOnboardingPathSelectionModel({ config: disabledConfig });

    expect(isComposerOnboardingAvailable(disabledConfig)).toBe(false);
    expect(model.composerAvailable).toBe(false);
    expect(model.mobile.paths.map((path) => path.id)).toEqual([
      ONBOARDING_ACTIONS.MOBILE_MANUAL,
    ]);
  });

  it("keeps mobile manual selection non-composer and returns to catalog", () => {
    const action = resolveOnboardingAction(ONBOARDING_ACTIONS.MOBILE_MANUAL);

    expect(action).toMatchObject({
      dismiss: true,
      openComposer: false,
      mobileTab: "catalog",
      analytics: {
        eventName: ANALYTICS_EVENTS.ONBOARDING_PATH_SELECTED,
        payload: {
          path: "manual",
          presentation: "mobile",
        },
      },
    });
  });

  it("opens Composer setup from mobile and desktop without selecting fragrances", () => {
    expect(resolveOnboardingAction(ONBOARDING_ACTIONS.MOBILE_COMPOSER)).toMatchObject({
      dismiss: true,
      openComposer: true,
      mobileTab: "box",
      analytics: {
        payload: {
          path: "composer",
          presentation: "mobile",
        },
      },
    });

    expect(resolveOnboardingAction(ONBOARDING_ACTIONS.DESKTOP_COMPOSER)).toMatchObject({
      dismiss: true,
      openComposer: true,
      mobileTab: null,
      analytics: {
        payload: {
          path: "composer",
          presentation: "desktop",
        },
      },
    });
  });

  it("treats desktop Got it as dismissal only", () => {
    expect(resolveOnboardingAction(ONBOARDING_ACTIONS.DESKTOP_DISMISS)).toEqual({
      dismiss: true,
      openComposer: false,
      mobileTab: null,
      analytics: null,
    });
  });

  it("treats mobile close as dismissal, not a construction path", () => {
    const action = resolveOnboardingAction(ONBOARDING_ACTIONS.MOBILE_DISMISS);

    expect(action).toEqual({
      dismiss: true,
      openComposer: false,
      mobileTab: "box",
      analytics: {
        eventName: ANALYTICS_EVENTS.ONBOARDING_DISMISSED,
        payload: {
          presentation: "mobile",
        },
      },
    });
    expect(action.analytics.eventName).not.toBe(ANALYTICS_EVENTS.ONBOARDING_PATH_SELECTED);
  });

  it("applies mobile close without opening Composer or switching to catalog", () => {
    const calls = [];
    const selectedPerfumeIds = [1, 2, 3];

    const result = applyOnboardingAction(ONBOARDING_ACTIONS.MOBILE_DISMISS, {
      dismiss: () => calls.push("dismiss"),
      onMobileTabChange: (tab) => calls.push(`tab:${tab}`),
      openComposer: () => calls.push("composer"),
      track: (eventName, payload) => calls.push({ eventName, payload }),
    });

    expect(result).toMatchObject({
      dismissed: true,
      openedComposer: false,
      tracked: true,
    });
    expect(calls).toEqual([
      "dismiss",
      {
        eventName: ANALYTICS_EVENTS.ONBOARDING_DISMISSED,
        payload: {
          presentation: "mobile",
        },
      },
      "tab:box",
    ]);
    expect(selectedPerfumeIds).toEqual([1, 2, 3]);
  });

  it("lets mobile close dismiss even when analytics throws", () => {
    const calls = [];

    const result = applyOnboardingAction(ONBOARDING_ACTIONS.MOBILE_DISMISS, {
      dismiss: () => calls.push("dismiss"),
      onMobileTabChange: (tab) => calls.push(`tab:${tab}`),
      openComposer: () => calls.push("composer"),
      track: () => {
        throw new Error("analytics unavailable");
      },
    });

    expect(result).toMatchObject({
      dismissed: true,
      openedComposer: false,
      tracked: false,
    });
    expect(calls).toEqual(["dismiss", "tab:box"]);
  });

  it("keeps existing manual and Composer actions unchanged", () => {
    expect(applyOnboardingAction(ONBOARDING_ACTIONS.MOBILE_MANUAL, {}).action).toMatchObject({
      mobileTab: "catalog",
      openComposer: false,
    });
    expect(applyOnboardingAction(ONBOARDING_ACTIONS.MOBILE_COMPOSER, {}).action).toMatchObject({
      mobileTab: "box",
      openComposer: true,
    });
    expect(applyOnboardingAction(ONBOARDING_ACTIONS.DESKTOP_COMPOSER, {}).action).toMatchObject({
      mobileTab: null,
      openComposer: true,
    });
  });
});
