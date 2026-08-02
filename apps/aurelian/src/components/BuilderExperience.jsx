"use client";

import { useEffect, useState } from "react";
import { DiscoveryBoxBuilder } from "@discovery-box/builder";
import { noopAnalytics } from "@discovery-box/builder/analytics";
import { createWhatsAppFinalizationAdapter } from "@discovery-box/builder/finalization";
import { createCatalogAssetResolver, notes } from "@discovery-box/catalog";
import { aurelianCatalog } from "../merchant/catalog.js";
import { aurelianConfig } from "../merchant/config.js";
import { parseFragranceIntent } from "../lib/parseFragranceIntent.js";

const assetResolver = createCatalogAssetResolver({ basePath: "/catalog-assets" });
const finalizationAdapter = createWhatsAppFinalizationAdapter({
  phoneNumber: aurelianConfig.finalization.whatsappNumber,
});

export function BuilderExperience({ isDevelopment = false }) {
  const [initialFragranceId] = useState(() =>
    typeof window === "undefined" ? null : parseFragranceIntent(window.location.search),
  );

  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.has("fragrance")) {
      url.searchParams.delete("fragrance");
      window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
    }
  }, []);

  return (
    <DiscoveryBoxBuilder
      analytics={noopAnalytics}
      assetResolver={assetResolver}
      catalog={aurelianCatalog}
      config={aurelianConfig}
      isDevelopment={isDevelopment}
      initialFragranceId={initialFragranceId}
      finalizationAdapter={finalizationAdapter}
      notes={notes}
    />
  );
}
