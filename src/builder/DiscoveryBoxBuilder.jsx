import BuilderApp from "../App.jsx";
import { validateBuilderConfig } from "./config/index.js";

/**
 * Public reusable Builder entry point.
 *
 * @param {object} props
 * @param {Array<object>} props.catalog Perfume records supplied by the host. The Builder treats this array as read-only.
 * @param {Record<string, object>} props.notes Note metadata consumed by catalog/detail UI. Pass an empty object when notes are unavailable.
 * @param {object} props.config Normalized Builder config, usually produced by createBuilderConfig.
 * @param {object} props.analytics Provider-neutral analytics adapter. Defaults to no-op when omitted.
 * @param {object} props.finalizationAdapter Host-supplied delivery-channel adapter. Optional.
 */
export default function DiscoveryBoxBuilder({
  catalog,
  notes = {},
  config,
  analytics,
  finalizationAdapter,
}) {
  if (!config) {
    throw new Error("DiscoveryBoxBuilder requires a normalized builder config.");
  }

  if (!Array.isArray(catalog)) {
    throw new Error("DiscoveryBoxBuilder requires a catalog array.");
  }

  if (!notes || typeof notes !== "object" || Array.isArray(notes)) {
    throw new Error("DiscoveryBoxBuilder notes must be an object when provided.");
  }

  const validatedConfig = validateBuilderConfig(config);

  return (
    <BuilderApp
      catalog={catalog}
      notes={notes}
      config={validatedConfig}
      analytics={analytics}
      finalizationAdapter={finalizationAdapter}
    />
  );
}
