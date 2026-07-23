import { DiscoveryBoxBuilder } from "../builder/index.js";
import AppErrorBoundary from "../components/AppErrorBoundary.jsx";
import { perfumes } from "../data/perfumes";
import { notes } from "../data/notes";
import { discoveryDecantsConfig } from "../merchants/discoveryDecants/config.js";

export default function DiscoveryDecantsApp() {
  return (
    <AppErrorBoundary
      platformName={discoveryDecantsConfig.software.name}
      productName={discoveryDecantsConfig.software.name}
      recoveryCopy={discoveryDecantsConfig.recovery}
      storageKey={discoveryDecantsConfig.persistence.storageKey}
    >
      <DiscoveryBoxBuilder
        catalog={perfumes}
        notes={notes}
        config={discoveryDecantsConfig}
      />
    </AppErrorBoundary>
  );
}
