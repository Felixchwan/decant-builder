import { useMemo } from "react";
import { perfumePlaceholderAssetKey } from "@discovery-box/catalog";
import BuilderApp from "../BuilderRuntime.jsx";
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
 * @param {number|null} props.initialFragranceId Optional stable catalog ID to select once after persisted state is restored.
 * @param {(assetKey: string) => string} props.assetResolver Host-supplied catalog asset resolver.
 * @param {boolean} props.isDevelopment Host-supplied development capability. Defaults to false.
 */
export default function DiscoveryBoxBuilder({
  catalog,
  notes = {},
  config,
  analytics,
  finalizationAdapter,
  initialFragranceId = null,
  assetResolver,
  isDevelopment = false,
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

  if (typeof assetResolver !== "function") {
    throw new Error("DiscoveryBoxBuilder requires an assetResolver function.");
  }

  const validatedConfig = validateBuilderConfig(config);
  const perfumeImageFallback = assetResolver(perfumePlaceholderAssetKey);
  const resolvedCatalog = useMemo(
    () =>
      catalog.map((perfume) => ({
        ...perfume,
        image: assetResolver(perfume.imageAssetKey),
        imageFallback: perfumeImageFallback,
      })),
    [assetResolver, catalog, perfumeImageFallback],
  );
  const resolvedNotes = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(notes).map(([noteId, note]) => [
          noteId,
          {
            ...note,
            noteImage: note.noteImageAssetKey
              ? assetResolver(note.noteImageAssetKey)
              : "",
          },
        ]),
      ),
    [assetResolver, notes],
  );

  return (
    <BuilderApp
      catalog={resolvedCatalog}
      notes={resolvedNotes}
      config={validatedConfig}
      analytics={analytics}
      finalizationAdapter={finalizationAdapter}
      initialFragranceId={initialFragranceId}
      assetResolver={assetResolver}
      isDevelopment={isDevelopment}
    />
  );
}
