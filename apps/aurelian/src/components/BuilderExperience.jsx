"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { DiscoveryBoxBuilder } from "@discovery-box/builder";
import { createWhatsAppFinalizationAdapter } from "@discovery-box/builder/finalization";
import { createCatalogAssetResolver, notes } from "@discovery-box/catalog";
import { aurelianCatalog } from "../merchant/catalog.js";
import { aurelianConfig } from "../merchant/config.js";
import { FRAGRANCE_QUERY_PARAM } from "../lib/parseFragranceIntent.js";
import { useBuilderSummarySlot } from "../lib/builderSummarySlot.js";
import { resolveBuilderIntentsFromSearch, DETAILS_QUERY_PARAM } from "../lib/parseDetailsIntent.js";
import { createAnalytics, buildAnalyticsContext } from "../analytics/createAnalytics.js";
import { createDevelopmentAnalytics } from "../analytics/developmentAnalytics.js";
import { useIntroPreference } from "./IntroPreferenceProvider.jsx";

const assetResolver = createCatalogAssetResolver({ basePath: "/catalog-assets" });
const finalizationAdapter = createWhatsAppFinalizationAdapter({
  phoneNumber: aurelianConfig.finalization.whatsappNumber,
});
const analyticsCommonContext = buildAnalyticsContext(aurelianConfig);

export function BuilderExperience({
  isDevelopment = false,
  analyticsDebugEnabled = false,
}) {
  // Two separate deep links, read once at mount: ?fragrance=<id> adds to the box,
  // ?details=<id> only opens that perfume's details. A valid add intent wins if both
  // are present (see resolveBuilderIntentsFromSearch).
  //
  // The query comes from Next's own useSearchParams(), NOT window.location. On a
  // client-side navigation with this component's chunk already loaded (every visit
  // after the first in a session), the component renders in the same commit that
  // updates the URL -- and during that render window.location still holds the PREVIOUS
  // page's URL, so the intent would be read as empty and then stripped by the effect
  // below. The router's value is already the new one in that render (the same reason
  // ObservationCaptureFlow reads it). window.location is only the fallback when there is
  // no App Router context (unit tests, a bare render).
  const searchParams = useSearchParams();
  const [{ initialFragranceId, initialDetailFragranceId }] = useState(() =>
    resolveBuilderIntentsFromSearch(
      searchParams ? searchParams.toString() : typeof window === "undefined" ? "" : window.location.search,
    ),
  );
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
  // the current route is the Builder. The two trees share no ancestor closer
  // than the root layout, so the slot reaches this component through a small
  // store the header's slot registers itself in (lib/builderSummarySlot.js).
  // It is NOT a one-time getElementById at first render: that is only valid
  // on a direct load. On a client-side navigation to the Builder (once its
  // chunk is loaded) the header and this component render in the same
  // commit, the slot is not in the DOM yet while this component renders, and
  // a one-time read kept null for the whole visit -- the box stayed in the
  // inline panel on desktop. Subscribing means this renders with null if it
  // must and is re-rendered with the slot the moment it exists.
  const stickySummaryPortalTarget = useBuilderSummarySlot();

  useEffect(() => {
    // Both intents are one-shot: once consumed (valid or not) they leave the URL,
    // so a reload or a shared link can't repeat them. Only these two params go.
    const url = new URL(window.location.href);
    const consumed = [FRAGRANCE_QUERY_PARAM, DETAILS_QUERY_PARAM].filter((param) => url.searchParams.has(param));
    if (consumed.length > 0) {
      consumed.forEach((param) => url.searchParams.delete(param));
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

  return (
    <DiscoveryBoxBuilder
      analytics={analytics}
      assetResolver={assetResolver}
      catalog={aurelianCatalog}
      config={aurelianConfig}
      isDevelopment={isDevelopment}
      initialFragranceId={initialFragranceId}
      initialDetailFragranceId={initialDetailFragranceId}
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
      // Aurelian positions the Collection Card actions as a rail beside the
      // docked box (builder-collection-card.css); the package only provides
      // the anchor. Discovery Decants never passes this.
      dockShareActions
      // Aurelian shows a catalog card's add button as filled "Agregado" once the fragrance is in
      // the box (builder-card-actions.css); Discovery Decants never passes this.
      showAddedState
      // Aurelian labels the two individual recommendations with a lens (Versatilidad / Afinidad,
      // painted in builder-recommendations.css); Discovery Decants never passes this.
      showRecommendationLenses
      // Aurelian opens a Dominant Accords evidence card (bottle, name and house of each fragrance behind a
      // count) on hover, focus or tap (painted in builder-intelligence.css); Discovery Decants never
      // passes this and keeps its hover tooltip.
      showAccordEvidence
      // Aurelian gives the Collection Balance heading one small info button that explains how to read the five
      // indicators (painted in builder-balance-help.css); Discovery Decants never passes this.
      showBalanceHelp
      // Aurelian folds the Box Analysis strengths to the first three behind a quiet "+N fortalezas más" button
      // (painted in builder-intelligence.css); Discovery Decants never passes this and keeps the full list.
      compactStrengths
    />
  );
}
