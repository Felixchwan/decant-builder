export function buildFilterOptions(perfumes) {
  return {
    seasons: getUniqueValues(perfumes, "seasons"),
    occasions: getUniqueValues(perfumes, "occasions"),
    vibes: getUniqueValues(perfumes, "vibes"),
  };
}

function getUniqueValues(items, key) {
  return [
    ...new Set(
      items.flatMap((item) => item[key] || [])
    ),
  ].sort();
}