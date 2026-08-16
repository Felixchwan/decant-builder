"use client";

import { useEffect, useState } from "react";
import { DiscoveryBoxBuilder } from "@discovery-box/builder";
import { createWhatsAppFinalizationAdapter } from "@discovery-box/builder/finalization";
import { createCatalogAssetResolver, notes } from "@discovery-box/catalog";
import { aurelianCatalog } from "../merchant/catalog.js";
import { aurelianConfig } from "../merchant/config.js";
import { parseFragranceIntent, FRAGRANCE_QUERY_PARAM } from "../lib/parseFragranceIntent.js";
import { getIntentRecommendationHint } from "../discoveryIntent/intentRecommendationPolicy.js";
import { explainRecommendation } from "../discoveryIntent/recommendationExplanation.js";
import { createAnalytics, buildAnalyticsContext } from "../analytics/createAnalytics.js";
import { createDevelopmentAnalytics } from "../analytics/developmentAnalytics.js";
import { DiscoveryIntentScreen } from "./DiscoveryIntentScreen.jsx";
import { useIntroPreference } from "./IntroPreferenceProvider.jsx";

const assetResolver = createCatalogAssetResolver({ basePath: "/catalog-assets" });
const finalizationAdapter = createWhatsAppFinalizationAdapter({
  phoneNumber: aurelianConfig.finalization.whatsappNumber,
});
const analyticsCommonContext = buildAnalyticsContext(aurelianConfig);

// Exported so tests can verify this stays in agreement with the pre-hydration
// header-visibility script in app/build-your-box/page.jsx, which performs
// the same shallow check ahead of this component ever mounting.
export function hasPersistedBox() {
  if (typeof window === "undefined") {
    return false;
  }

  try {
    return window.localStorage.getItem(aurelianConfig.persistence.storageKey) !== null;
  } catch {
    return false;
  }
}

export function BuilderExperience({
  isDevelopment = false,
  analyticsDebugEnabled = false,
}) {
  const [initialFragranceId] = useState(() =>
    typeof window === "undefined" ? null : parseFragranceIntent(window.location.search),
  );
  const [skipsDiscoveryIntent] = useState(
    () => initialFragranceId !== null || hasPersistedBox(),
  );
  const [selectedIntentId, setSelectedIntentId] = useState(null);
  // Read directly from the provider wrapping this component's own subtree
  // in app/build-your-box/page.jsx (see BuilderIntroHeader.jsx, the other
  // consumer) rather than threading it through BuilderMount as a prop --
  // BuilderMount has nothing else to do with this value. Only restoreIntro
  // is used here: the catalog-header info button below exists purely to
  // undo a dismissal, so it only ever renders once dismissed, and never
  // needs to read isIntroDismissed for anything else.
  const { isIntroDismissed, restoreIntro } = useIntroPreference();
  // SiteHeader (a sibling tree, not an ancestor of this component — see
  // app/layout.jsx) reserves this slot in its own right-hand region whenever
  // the current route is the Builder. Looked up by id, lazily on first
  // render, rather than threaded through React state/context, because the
  // two trees don't share a common ancestor closer than the root layout —
  // the pre-hydration script in build-your-box/page.jsx already establishes
  // this exact getElementById bridging pattern between them. This component
  // is itself mounted ssr:false (see BuilderMount.jsx), so by the time it
  // renders at all, the surrounding page — including SiteHeader's slot —
  // has already committed to the DOM.
  const [stickySummaryPortalTarget] = useState(() =>
    typeof document === "undefined" ? null : document.getElementById("aurelian-builder-summary-slot"),
  );

  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.has(FRAGRANCE_QUERY_PARAM)) {
      url.searchParams.delete(FRAGRANCE_QUERY_PARAM);
      window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
    }
  }, []);

  // The one composition point in this app that decides which analytics
  // provider Builder events reach. Analytics is currently paused as a
  // product priority (portfolio/engineering-learning focus, not live
  // business telemetry) -- see apps/aurelian/src/analytics/README.md --
  // so the only provider wired here is the console-only development
  // logger, which behaves as a no-op unless a developer explicitly opts
  // in locally (analyticsDebugEnabled, gated by isDevelopment too). No
  // production vendor is selected, and none is required: the validating
  // wrapper (createAnalytics) still runs on every Builder event exactly as
  // it would with a real provider wired in, so the privacy/allowlist
  // boundary is exercised and provable even with analytics effectively
  // disabled. A future real provider plugs in by adding one adapter file
  // implementing { track(eventName, payload) } and passing it as
  // `provider` here -- no redesign of this component, createAnalytics.js,
  // or the Builder integration required. Constructed fresh on every
  // render rather than memoized, mirroring Discovery Decants' own
  // DiscoveryDecantsApp.jsx composition exactly -- createAnalytics()
  // returns a frozen, stateless object, so this is cheap.
  const analytics = createAnalytics({
    commonContext: analyticsCommonContext,
    provider: createDevelopmentAnalytics({
      enabled: isDevelopment && analyticsDebugEnabled,
    }),
  });

  if (!skipsDiscoveryIntent && selectedIntentId === null) {
    return <DiscoveryIntentScreen onSelect={setSelectedIntentId} />;
  }

  return (
    <DiscoveryBoxBuilder
      analytics={analytics}
      assetResolver={assetResolver}
      catalog={aurelianCatalog}
      config={aurelianConfig}
      isDevelopment={isDevelopment}
      initialFragranceId={initialFragranceId}
      initialRecommendationHint={getIntentRecommendationHint(selectedIntentId)}
      explainRecommendation={explainRecommendation}
      finalizationAdapter={finalizationAdapter}
      notes={notes}
      stickySummaryPortalTarget={stickySummaryPortalTarget}
      // Aurelian has its own intro presentation above the Builder
      // (#builder-entry-header, see BuilderIntroHeader.jsx), so it opts out
      // of the Builder's own shared hero section rather than showing both.
      showBuilderHero={false}
      // Only passed once the intro is actually dismissed -- the catalog
      // header's compact info button (packages/builder) only renders when
      // this handler is present, so presence itself is the visibility
      // gate; the Builder never needs a separate boolean for it.
      onCatalogInfoRequest={isIntroDismissed ? restoreIntro : undefined}
      // Aurelian's Discovery Box has a fixed minimum-points requirement
      // (already surfaced informationally elsewhere via box.minPoints, e.g.
      // buildCollectionSummary.js and the como-funciona copy) -- opting into
      // composerMinimumPoints makes "Compose my box" actually honor it,
      // instead of only describing it after the fact.
      composerMinimumPoints={aurelianConfig.box.minPoints}
      // Aurelian desktop only opts into the collapsible right-panel rail;
      // Discovery Decants never passes this, so it keeps today's
      // permanently-visible panel column unchanged by default.
      enablePanelCollapse
    />
  );
}
