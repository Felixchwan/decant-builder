import { parseFragranceIntent } from "./parseFragranceIntent.js";

export function resolveCatalogFragranceIntent(search, catalog) {
  const id = parseFragranceIntent(search);
  return id === null ? null : catalog.find((fragrance) => fragrance.id === id) ?? null;
}
