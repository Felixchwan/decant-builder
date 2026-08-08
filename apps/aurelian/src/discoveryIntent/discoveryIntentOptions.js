// Aurelian-owned Discovery Intent definitions. Not shared Builder config, not
// merchant config, and never imported by @discovery-box/builder. The Builder
// package only ever receives the resulting catalog filter values (existing
// season/occasion/vibe taxonomy), never these option ids, titles, or order.
export const DISCOVERY_INTENT_OPTIONS = Object.freeze([
  Object.freeze({
    id: "fresh_everyday",
    title: "Fresco y cotidiano",
    description: "Para el día a día.",
    filters: Object.freeze({ occasions: "daily" }),
  }),
  Object.freeze({
    id: "intentional_evening",
    title: "Noche con intención",
    description: "Para ocasiones que piden más.",
    filters: Object.freeze({ occasions: "night" }),
  }),
  Object.freeze({
    id: "gift",
    title: "Es un regalo",
    description: "Para compartir una experiencia premium.",
    // "special" is the closest existing occasion tag, not a real match for
    // "gift-worthy." The catalog has no taxonomy for gifting intent, so this
    // is a temporary, approximate stand-in — not a claim that "special" and
    // "gift" mean the same thing. Revisit if/when the catalog grows a
    // dedicated concept for this, rather than treating this mapping as settled.
    filters: Object.freeze({ occasions: "special" }),
  }),
  Object.freeze({
    id: "explore_freely",
    title: "Quiero explorar todo",
    description: "Ver las 84 fragancias del catálogo.",
    filters: null,
  }),
]);

export function getDiscoveryIntentCatalogFilters(intentId) {
  const option = DISCOVERY_INTENT_OPTIONS.find((item) => item.id === intentId);
  return option?.filters || null;
}
