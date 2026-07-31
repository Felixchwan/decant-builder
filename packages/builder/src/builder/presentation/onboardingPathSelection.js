import { ANALYTICS_EVENTS } from "../../analytics/events.js";

export const ONBOARDING_PATHS = Object.freeze({
  MANUAL: "manual",
  COMPOSER: "composer",
});

export const ONBOARDING_PRESENTATIONS = Object.freeze({
  MOBILE: "mobile",
  DESKTOP: "desktop",
});

export const ONBOARDING_ACTIONS = Object.freeze({
  MOBILE_MANUAL: "mobile_manual",
  MOBILE_COMPOSER: "mobile_composer",
  MOBILE_DISMISS: "mobile_dismiss",
  DESKTOP_DISMISS: "desktop_dismiss",
  DESKTOP_COMPOSER: "desktop_composer",
});

export function isComposerOnboardingAvailable(config = {}) {
  return config?.features?.composer !== false;
}

export function buildOnboardingPathSelectionModel({
  config = {},
  composerAvailable = isComposerOnboardingAvailable(config),
} = {}) {
  const copy = config.copy || {};

  return {
    ariaLabel: copy.introAriaLabel || "Discovery Box introduction",
    title: copy.onboardingTitle || copy.introTitle || "Welcome to Discovery Box",
    intro:
      copy.onboardingIntro ||
      "Choose how you want to start building your Discovery Box.",
    desktopDescription:
      copy.onboardingDesktopDescription ||
      copy.introDescription ||
      "Build manually or let Composer prepare a proposal from your preferences.",
    switchNote:
      copy.onboardingSwitchNote ||
      "You can switch between both methods at any time.",
    mobileCloseLabel: copy.onboardingCloseLabel || "Close onboarding",
    composerAvailable,
    mobile: {
      paths: [
        {
          id: ONBOARDING_ACTIONS.MOBILE_MANUAL,
          path: ONBOARDING_PATHS.MANUAL,
          title:
            copy.onboardingManualTitle ||
            "Explore the catalog yourself",
          description:
            copy.onboardingManualDescription ||
            "Browse fragrances, open details, and add each pick by hand.",
          actionLabel: copy.onboardingManualAction || "Explore Catalog",
        },
        ...(composerAvailable
          ? [
              {
                id: ONBOARDING_ACTIONS.MOBILE_COMPOSER,
                path: ONBOARDING_PATHS.COMPOSER,
                title:
                  copy.onboardingComposerTitle ||
                  "Let Composer build a proposal",
                description:
                  copy.onboardingComposerDescription ||
                  "Choose preferences and review a complete box proposal before applying it.",
                actionLabel: copy.onboardingComposerAction || "Use Composer",
              },
            ]
          : []),
      ],
    },
    desktop: {
      dismissLabel: copy.introDismissLabel || "Got it",
      composerLabel: copy.onboardingDesktopComposerAction || "Try Composer",
    },
  };
}

export function resolveOnboardingAction(actionId) {
  if (actionId === ONBOARDING_ACTIONS.MOBILE_MANUAL) {
    return {
      dismiss: true,
      openComposer: false,
      mobileTab: "catalog",
      analytics: {
        eventName: ANALYTICS_EVENTS.ONBOARDING_PATH_SELECTED,
        payload: {
          path: ONBOARDING_PATHS.MANUAL,
          presentation: ONBOARDING_PRESENTATIONS.MOBILE,
        },
      },
    };
  }

  if (actionId === ONBOARDING_ACTIONS.MOBILE_COMPOSER) {
    return {
      dismiss: true,
      openComposer: true,
      mobileTab: "box",
      analytics: {
        eventName: ANALYTICS_EVENTS.ONBOARDING_PATH_SELECTED,
        payload: {
          path: ONBOARDING_PATHS.COMPOSER,
          presentation: ONBOARDING_PRESENTATIONS.MOBILE,
        },
      },
    };
  }

  if (actionId === ONBOARDING_ACTIONS.DESKTOP_COMPOSER) {
    return {
      dismiss: true,
      openComposer: true,
      mobileTab: null,
      analytics: {
        eventName: ANALYTICS_EVENTS.ONBOARDING_PATH_SELECTED,
        payload: {
          path: ONBOARDING_PATHS.COMPOSER,
          presentation: ONBOARDING_PRESENTATIONS.DESKTOP,
        },
      },
    };
  }

  if (actionId === ONBOARDING_ACTIONS.MOBILE_DISMISS) {
    return {
      dismiss: true,
      openComposer: false,
      mobileTab: "box",
      analytics: {
        eventName: ANALYTICS_EVENTS.ONBOARDING_DISMISSED,
        payload: {
          presentation: ONBOARDING_PRESENTATIONS.MOBILE,
        },
      },
    };
  }

  if (actionId === ONBOARDING_ACTIONS.DESKTOP_DISMISS) {
    return {
      dismiss: true,
      openComposer: false,
      mobileTab: null,
      analytics: null,
    };
  }

  return null;
}

export function applyOnboardingAction(
  actionId,
  {
    composerAvailable = true,
    dismiss,
    onMobileTabChange,
    openComposer,
    track,
  } = {}
) {
  const action = resolveOnboardingAction(actionId);

  if (!action) {
    return {
      action: null,
      dismissed: false,
      openedComposer: false,
      tracked: false,
    };
  }

  if (action.openComposer && !composerAvailable) {
    dismiss?.();
    return {
      action,
      dismissed: Boolean(action.dismiss),
      openedComposer: false,
      tracked: false,
    };
  }

  if (action.dismiss) {
    dismiss?.();
  }

  let tracked = false;

  if (action.analytics && typeof track === "function") {
    try {
      track(action.analytics.eventName, action.analytics.payload);
      tracked = true;
    } catch {
      tracked = false;
    }
  }

  if (action.mobileTab) {
    onMobileTabChange?.(action.mobileTab);
  }

  if (action.openComposer) {
    openComposer?.();
  }

  return {
    action,
    dismissed: Boolean(action.dismiss),
    openedComposer: Boolean(action.openComposer),
    tracked,
  };
}
