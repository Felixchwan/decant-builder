import { filterCatalogBySeason, rankBySeasonalRelevance } from "./catalogSeason.js";

// With no `season` this is exactly the full-catalog filter it has always been.
// With a valid season: compatibility first, then the existing text/points
// filters inside that subset, then seasonal relevance ordering.
export function filterCatalog(catalog, query, points, season = null) {
  const normalized = query.trim().toLocaleLowerCase("es-MX");
  const matches = filterCatalogBySeason(catalog, season).filter((item) => {
    const matchesQuery = !normalized
      || `${item.brand} ${item.name}`.toLocaleLowerCase("es-MX").includes(normalized);
    return matchesQuery && (points === "all" || item.points === Number(points));
  });
  return season ? rankBySeasonalRelevance(matches, season) : matches;
}
