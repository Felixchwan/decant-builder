"use client";

import { useEffect, useState } from "react";
import { DiscoveryBoxBuilder } from "@discovery-box/builder";
import { noopAnalytics } from "@discovery-box/builder/analytics";
import { createWhatsAppFinalizationAdapter } from "@discovery-box/builder/finalization";
import { createCatalogAssetResolver, notes } from "@discovery-box/catalog";
import { aurelianCatalog } from "../merchant/catalog.js";
import { aurelianConfig } from "../merchant/config.js";
import { parseFragranceIntent, FRAGRANCE_QUERY_PARAM } from "../lib/parseFragranceIntent.js";
import { getIntentRecommendationHint } from "../discoveryIntent/intentRecommendationPolicy.js";
import { explainRecommendation } from "../discoveryIntent/recommendationExplanation.js";
import { DiscoveryIntentScreen } from "./DiscoveryIntentScreen.jsx";

const assetResolver = createCatalogAssetResolver({ basePath: "/catalog-assets" });
const finalizationAdapter = createWhatsAppFinalizationAdapter({
  phoneNumber: aurelianConfig.finalization.whatsappNumber,
});

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

export function BuilderExperience({ isDevelopment = false }) {
  const [initialFragranceId] = useState(() =>
    typeof window === "undefined" ? null : parseFragranceIntent(window.location.search),
  );
  const [skipsDiscoveryIntent] = useState(
    () => initialFragranceId !== null || hasPersistedBox(),
  );
  const [selectedIntentId, setSelectedIntentId] = useState(null);

  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.has(FRAGRANCE_QUERY_PARAM)) {
      url.searchParams.delete(FRAGRANCE_QUERY_PARAM);
      window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
    }
  }, []);

  if (!skipsDiscoveryIntent && selectedIntentId === null) {
    return <DiscoveryIntentScreen onSelect={setSelectedIntentId} />;
  }

  return (
    <DiscoveryBoxBuilder
      analytics={noopAnalytics}
      assetResolver={assetResolver}
      catalog={aurelianCatalog}
      config={aurelianConfig}
      isDevelopment={isDevelopment}
      initialFragranceId={initialFragranceId}
      initialRecommendationHint={getIntentRecommendationHint(selectedIntentId)}
      explainRecommendation={explainRecommendation}
      finalizationAdapter={finalizationAdapter}
      notes={notes}
    />
  );
}
