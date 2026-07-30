import { DiscoveryBoxBuilder } from "../builder/index.js";
import AppErrorBoundary from "../components/AppErrorBoundary.jsx";
import { perfumes } from "../data/perfumes";
import { notes } from "../data/notes";
import { createMerchantCatalog } from "../catalog/createMerchantCatalog.js";
import { discoveryDecantsConfig } from "../merchants/discoveryDecants/config.js";
import { discoveryDecantsAvailableIds } from "../merchants/discoveryDecants/catalog.js";
import { createAnalytics, buildAnalyticsContext } from "../analytics/createAnalytics.js";
import { createDevelopmentAnalytics } from "../analytics/developmentAnalytics.js";
import { createWhatsAppFinalizationAdapter } from "../finalization/createWhatsAppFinalizationAdapter.js";

const finalizationAdapter = createWhatsAppFinalizationAdapter({
  phoneNumber: discoveryDecantsConfig.finalization.whatsappNumber,
});
const discoveryDecantsCatalog = createMerchantCatalog({
  source: perfumes,
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
      />
    </AppErrorBoundary>
  );
}
