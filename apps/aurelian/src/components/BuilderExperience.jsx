"use client";

import { DiscoveryBoxBuilder } from "@discovery-box/builder";
import { noopAnalytics } from "@discovery-box/builder/analytics";
import { createWhatsAppFinalizationAdapter } from "@discovery-box/builder/finalization";
import { createCatalogAssetResolver, notes } from "@discovery-box/catalog";
import { aurelianCatalog } from "../merchant/catalog.js";
import { aurelianConfig } from "../merchant/config.js";

const assetResolver = createCatalogAssetResolver({ basePath: "/catalog-assets" });
const finalizationAdapter = createWhatsAppFinalizationAdapter({
  phoneNumber: aurelianConfig.finalization.whatsappNumber,
});

export function BuilderExperience({ isDevelopment = false }) {
  return (
    <DiscoveryBoxBuilder
      analytics={noopAnalytics}
      assetResolver={assetResolver}
      catalog={aurelianCatalog}
      config={aurelianConfig}
      isDevelopment={isDevelopment}
      finalizationAdapter={finalizationAdapter}
      notes={notes}
    />
  );
}
