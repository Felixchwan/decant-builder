import { DiscoveryBoxBuilder } from "../builder/index.js";
import AppErrorBoundary from "../components/AppErrorBoundary.jsx";
import { perfumes } from "../data/perfumes";
import { notes } from "../data/notes";
import { createMerchantCatalog } from "../catalog/createMerchantCatalog.js";
import { aurelianConfig } from "../merchants/aurelian/config.js";
import { aurelianAvailableIds } from "../merchants/aurelian/catalog.js";
import { createAnalytics, buildAnalyticsContext } from "../analytics/createAnalytics.js";
import { createDevelopmentAnalytics } from "../analytics/developmentAnalytics.js";

const aurelianCatalog = createMerchantCatalog({
  source: perfumes,
  availableIds: aurelianAvailableIds,
});

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
      />
    </AppErrorBoundary>
  );
}
