// Aurelian-owned seasonal browsing mode for the standalone /catalogo route.
//
// The public contract is `/catalogo?season=<spring|summer|fall|winter>` -- the
// same four semantic roles the landing's seasonal cards already use
// (SEASONAL_SLOTS). The URL never carries the Spanish label or the "autumn"
// artwork name. This module is host-owned and merchant-neutral in shape, but
// stays in the Aurelian app: nothing here belongs in packages/catalog.
//
// Two separate questions, deliberately kept apart:
//   COMPATIBILITY  decided only by the fragrance's declared `seasons` list.
//   RELEVANCE      decided only by explicit editorial `seasonWeights`, and only
//                  to ORDER an already-compatible subset.
import { getExplicitSeasonWeight as getCatalogExplicitSeasonWeight } from "@discovery-box/catalog";
import { FRAGRANCE_ID_PATTERN, FRAGRANCE_QUERY_PARAM } from "./parseFragranceIntent.js";
import { SEASONAL_SLOTS } from "./seasonalSelection.js";

export const CATALOG_SEASON_PARAM = "season";

const SEASON_KEYS = Object.freeze(SEASONAL_SLOTS.map(({ key }) => key));

// Single value, exact lowercase public key; anything else is "no season", so a
// bad or repeated value degrades to the full catalog instead of a broken state.
export function parseCatalogSeason(value) {
  const values = Array.isArray(value) ? value : [value];
  if (values.length !== 1) return null;
  return SEASON_KEYS.includes(values[0]) ? values[0] : null;
}

export function parseCatalogSeasonFromSearch(search = "") {
  return parseCatalogSeason(new URLSearchParams(search).getAll(CATALOG_SEASON_PARAM));
}

// Presentation facts for a valid season key, taken from SEASONAL_SLOTS so the
// landing and the catalog can never disagree about a season's name.
export function getCatalogSeasonLabel(season) {
  const slot = SEASONAL_SLOTS.find(({ key }) => key === season);
  return slot ? { title: slot.label, lower: slot.label.toLowerCase() } : null;
}

// Declared compatibility: the season is listed on the fragrance. Never derived
// from accords, notes, vibes, brand, points or weights, and never exclusive.
export function isSeasonCompatible(item, season) {
  return Array.isArray(item.seasons) && item.seasons.includes(season);
}

// The explicit editorial weight for a season, or null when there is none
// (UNSCORED -- never zero). The exported catalog fills `seasonWeights` for every
// fragrance, with a placeholder default where no editorial entry exists, so the
// merged numbers cannot say which is which; packages/catalog answers that
// directly from its editorial table.
export function getExplicitSeasonWeight(item, season) {
  return getCatalogExplicitSeasonWeight(item.id, season);
}

// Scored matches first (highest weight first), then compatible-but-unscored
// fragrances; every tie keeps the catalog's existing order.
export function rankBySeasonalRelevance(items, season, weightOf = getExplicitSeasonWeight) {
  return items
    .map((item, index) => ({ item, index, weight: weightOf(item, season) }))
    .sort((a, b) => {
      if (a.weight === null && b.weight === null) return a.index - b.index;
      if (a.weight === null) return 1;
      if (b.weight === null) return -1;
      return b.weight - a.weight || a.index - b.index;
    })
    .map(({ item }) => item);
}

export function filterCatalogBySeason(catalog, season) {
  return season ? catalog.filter((item) => isSeasonCompatible(item, season)) : catalog;
}

// Where a landing seasonal card leads: the season AND the card's own fragrance, so the
// catalog can open the seasonal subset and bring that exact fragrance into view. It is the
// catalog's existing `?fragrance=` intent (resolveCatalogFragranceIntent), never the Builder's
// add or details contracts. A season key that is not valid yields the plain catalog; a
// fragrance id that is not a plain positive integer is left off, so the link degrades to the
// season alone instead of carrying a value the catalog would ignore anyway.
export function buildSeasonalFragranceHref(season, fragranceId) {
  const params = new URLSearchParams();
  const valid = parseCatalogSeason(season);
  if (valid) params.set(CATALOG_SEASON_PARAM, valid);
  if (FRAGRANCE_ID_PATTERN.test(String(fragranceId))) params.set(FRAGRANCE_QUERY_PARAM, String(fragranceId));
  const query = params.toString();
  return query ? `/catalogo?${query}` : "/catalogo";
}

// The /catalogo URL after choosing a season in the manual filter. `search` is the
// current query string; every param but `season` is kept as it is (`fragrance=`
// included). A valid season key sets the single `season` param in place;
// null ("Todas") removes it, and with it any repeated or invalid values.
export function buildCatalogSeasonHref(search = "", season = null) {
  const params = new URLSearchParams(search);
  const valid = parseCatalogSeason(season);
  if (valid) params.set(CATALOG_SEASON_PARAM, valid);
  else params.delete(CATALOG_SEASON_PARAM);
  const query = params.toString();
  return query ? `/catalogo?${query}` : "/catalogo";
}

// Where "Ver catálogo completo" leads: /catalogo with every query param except
// `season` kept, so leaving seasonal mode never drops a compatible param such
// as ?fragrance=. `searchParams` is Next's already-resolved object
// ({ key: string | string[] }).
export function buildFullCatalogHref(searchParams) {
  const rest = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams ?? {})) {
    if (key === CATALOG_SEASON_PARAM) continue;
    for (const entry of Array.isArray(value) ? value : [value]) {
      if (typeof entry === "string") rest.append(key, entry);
    }
  }
  const query = rest.toString();
  return query ? `/catalogo?${query}` : "/catalogo";
}
