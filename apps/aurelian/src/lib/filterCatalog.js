export function filterCatalog(catalog, query, points) {
  const normalized = query.trim().toLocaleLowerCase("es-MX");
  return catalog.filter((item) => {
    const matchesQuery = !normalized
      || `${item.brand} ${item.name}`.toLocaleLowerCase("es-MX").includes(normalized);
    return matchesQuery && (points === "all" || item.points === Number(points));
  });
}
