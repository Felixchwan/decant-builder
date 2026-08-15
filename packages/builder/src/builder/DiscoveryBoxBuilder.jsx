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
 * @param {{strategy?: string, preferredSeasons?: string[], preferredOccasions?: string[], preferredVibes?: string[], excludedPerfumeIds?: number[]}|null} props.initialRecommendationHint Optional starting recommendation bias, expressed only in Composer's existing request vocabulary (strategy, preferred seasons/occasions/vibes, excluded ids). When present, the Builder shows a curated recommendation set above the full catalog on first load; the catalog itself is never filtered or reduced by this. The Builder applies this once at startup and never interprets what the hint means beyond that vocabulary — it has no concept of why a host chose these values.
 * @param {(recommendation: object) => (string|null)} [props.explainRecommendation] Optional host-supplied presentation callback, separate from initialRecommendationHint (a policy-input contract, not a copy contract). Called once per card in the recommendation surface produced by initialRecommendationHint; its return value is rendered as a short reason line, or nothing when it returns null/undefined. The Builder never inspects the string or the recommendation's explanation codes itself — purely relayed, same as assetResolver/finalizationAdapter.
 * @param {(assetKey: string) => string} props.assetResolver Host-supplied catalog asset resolver.
 * @param {boolean} props.isDevelopment Host-supplied development capability. Defaults to false.
 * @param {HTMLElement|null} [props.stickySummaryPortalTarget] Optional host-supplied DOM node the compact box summary can relocate into once scrolled to the top of the viewport (e.g. a reserved slot in a host's own sticky page header). The Builder never assumes such a slot exists or where it lives — when omitted, the summary renders inline exactly as it always has.
 * @param {number|null} [props.composerMinimumPoints] Optional, opt-in lower bound on total points the "Compose my box" action must reach before its result counts as a completed proposal. Absent/null by default, which preserves today's Composer behavior exactly (any valid box within budget is a success). The Builder never derives this from its own config — a host that wants "my box isn't done until it hits N points" (e.g. a merchant with a fixed minimum-order requirement) computes N itself and passes it here.
 * @param {boolean} [props.showBuilderHero] Generic host capability for the Builder's own shared hero section (the title + description above the catalog). Defaults to true, which renders it exactly as it always has. A host with its own intro presentation above the Builder passes false to suppress this section entirely; the Builder holds no preference state of its own here and never reads storage for it.
 * @param {boolean} [props.enablePanelCollapse] Optional, opt-in desktop capability: renders a full-height collapse rail at the left edge of the box panel column, letting a user hide it so the catalog can reclaim that width. Defaults to false, which renders the box panel column exactly as it always has -- no rail, no extra DOM, no grid-track changes. Purely a local, non-persisted layout preference; the Builder never derives this from config or storage.
 */
export default function DiscoveryBoxBuilder({
  catalog,
  notes = {},
  config,
  analytics,
  finalizationAdapter,
  initialFragranceId = null,
  initialRecommendationHint = null,
  explainRecommendation,
  assetResolver,
  isDevelopment = false,
  stickySummaryPortalTarget = null,
  composerMinimumPoints = null,
  showBuilderHero = true,
  enablePanelCollapse = false,
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
      initialRecommendationHint={initialRecommendationHint}
      explainRecommendation={explainRecommendation}
      assetResolver={assetResolver}
      isDevelopment={isDevelopment}
      stickySummaryPortalTarget={stickySummaryPortalTarget}
      composerMinimumPoints={composerMinimumPoints}
      showBuilderHero={showBuilderHero}
      enablePanelCollapse={enablePanelCollapse}
    />
  );
}
