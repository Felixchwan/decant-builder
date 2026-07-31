import { DiscoveryBoxBuilder } from "@discovery-box/builder";
import AppErrorBoundary from "../components/AppErrorBoundary.jsx";
import {
  createCatalogAssetResolver,
  createMerchantCatalog,
  fragrances,
  notes,
} from "@discovery-box/catalog";
import { aurelianConfig } from "../merchants/aurelian/config.js";
import { aurelianAvailableIds } from "../merchants/aurelian/catalog.js";
import { createAnalytics, buildAnalyticsContext } from "../analytics/createAnalytics.js";
import { createDevelopmentAnalytics } from "../analytics/developmentAnalytics.js";

const aurelianCatalog = createMerchantCatalog({
  source: fragrances,
  availableIds: aurelianAvailableIds,
});
const assetResolver = createCatalogAssetResolver({ basePath: "/catalog-assets" });

// Development switch: import this app from main.jsx to run the Aurelian merchant implementation.
export default function AurelianApp() {
  const analytics = createAnalytics({
    commonContext: buildAnalyticsContext(aurelianConfig),
    provider: createDevelopmentAnalytics({
      enabled: import.meta.env.DEV && import.meta.env.VITE_ANALYTICS_DEBUG === "true",
    }),
  });

  return (
    <AppErrorBoundary
      platformName={aurelianConfig.software.name}
      productName={aurelianConfig.software.name}
      recoveryCopy={aurelianConfig.recovery}
      storageKey={aurelianConfig.persistence.storageKey}
      analytics={analytics}
    >
      <DiscoveryBoxBuilder
        catalog={aurelianCatalog}
        notes={notes}
        config={aurelianConfig}
        analytics={analytics}
        assetResolver={assetResolver}
        isDevelopment={import.meta.env.DEV}
      />
    </AppErrorBoundary>
  );
}
