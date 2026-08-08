// Aurelian-owned Discovery Intent identity/copy. Not shared Builder config,
// not merchant config, and never imported by @discovery-box/builder. What an
// intent means for recommendations lives separately, in
// intentRecommendationPolicy.js — this file only defines what the visitor
// sees and picks from.
export const DISCOVERY_INTENT_OPTIONS = Object.freeze([
  Object.freeze({
    id: "fresh_everyday",
    title: "Fresco y cotidiano",
    description: "Para el día a día.",
  }),
  Object.freeze({
    id: "intentional_evening",
    title: "Noche con intención",
    description: "Para ocasiones que piden más.",
  }),
  Object.freeze({
    id: "gift",
    title: "Es un regalo",
    description: "Para compartir una experiencia premium.",
  }),
  Object.freeze({
    id: "explore_freely",
    title: "Quiero explorar todo",
    description: "Ver las 84 fragancias del catálogo.",
  }),
]);
