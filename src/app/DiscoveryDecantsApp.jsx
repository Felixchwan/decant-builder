import { DiscoveryBoxBuilder } from "@discovery-box/builder";
import AppErrorBoundary from "../components/AppErrorBoundary.jsx";
import {
  createCatalogAssetResolver,
  createMerchantCatalog,
  fragrances,
  notes,
} from "@discovery-box/catalog";
import { discoveryDecantsConfig } from "../merchants/discoveryDecants/config.js";
import { discoveryDecantsAvailableIds } from "../merchants/discoveryDecants/catalog.js";
import { createAnalytics, buildAnalyticsContext } from "../analytics/createAnalytics.js";
import { createDevelopmentAnalytics } from "../analytics/developmentAnalytics.js";
import { createWhatsAppFinalizationAdapter } from "../finalization/createWhatsAppFinalizationAdapter.js";

const finalizationAdapter = createWhatsAppFinalizationAdapter({
  phoneNumber: discoveryDecantsConfig.finalization.whatsappNumber,
});
const assetResolver = createCatalogAssetResolver({ basePath: "/catalog-assets" });
const discoveryDecantsCatalog = createMerchantCatalog({
  source: fragrances,
  availableIds: discoveryDecantsAvailableIds,
});

export default function DiscoveryDecantsApp() {
  const analytics = createAnalytics({
    commonContext: buildAnalyticsContext(discoveryDecantsConfig),
    provider: createDevelopmentAnalytics({
      enabled: import.meta.env.DEV && import.meta.env.VITE_ANALYTICS_DEBUG === "true",
    }),
  });

  return (
    <AppErrorBoundary
      platformName={discoveryDecantsConfig.software.name}
      productName={discoveryDecantsConfig.software.name}
      recoveryCopy={discoveryDecantsConfig.recovery}
      storageKey={discoveryDecantsConfig.persistence.storageKey}
      analytics={analytics}
    >
      <DiscoveryBoxBuilder
        catalog={discoveryDecantsCatalog}
        notes={notes}
        config={discoveryDecantsConfig}
        analytics={analytics}
        finalizationAdapter={finalizationAdapter}
        assetResolver={assetResolver}
        isDevelopment={import.meta.env.DEV}
      />
    </AppErrorBoundary>
  );
}
