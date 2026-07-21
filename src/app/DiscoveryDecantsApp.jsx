import { DiscoveryBoxBuilder, discoveryDecantsConfig } from "../builder/index.js";
import { perfumes } from "../data/perfumes";
import { notes } from "../data/notes";

export default function DiscoveryDecantsApp() {
  return (
    <DiscoveryBoxBuilder
      catalog={perfumes}
      notes={notes}
      config={discoveryDecantsConfig}
    />
  );
}
