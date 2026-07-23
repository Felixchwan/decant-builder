import { DiscoveryBoxBuilder } from "../builder/index.js";
import AppErrorBoundary from "../components/AppErrorBoundary.jsx";
import { perfumes } from "../data/perfumes";
import { notes } from "../data/notes";
import { aurelianConfig } from "../merchants/aurelian/config.js";

// Development switch: import this app from main.jsx to run the Aurelian merchant implementation.
export default function AurelianApp() {
  return (
    <AppErrorBoundary
      platformName={aurelianConfig.software.name}
      productName={aurelianConfig.software.name}
      storageKey={aurelianConfig.persistence.storageKey}
    >
      <DiscoveryBoxBuilder
        catalog={perfumes}
        notes={notes}
        config={aurelianConfig}
      />
    </AppErrorBoundary>
  );
}
