function capitalize(text) {
  return typeof text === "string" && text.length > 0
    ? text.charAt(0).toUpperCase() + text.slice(1)
    : text;
}

function FilterBar({
  translator,
  filterOptions,
  activeFilters,
  handleFilterChange,
  sortOption,
  setSortOption,
}) {
  const t = translator?.t || ((key) => key);
  const formatLabel = translator?.label || ((_, value) => value);
  // A native <select>'s closed-state text is always whichever option is
  // currently selected -- there's no separate "always visible" label
  // element to prefix instead. Every option (not just the default) carries
  // the category/sort prefix so the closed select reads "Temporadas:
  // Primavera" once a value is chosen, not just "Todas" while unfiltered.
  const sortLabel = t("filter.sortLabel");

  return (
    <div className="filters">
      {Object.entries(filterOptions).map(([category, options]) => {
        const categoryLabel = capitalize(t(`taxonomy.${category}`));
        return (
          <select
            key={category}
            value={activeFilters[category]}
            onChange={(event) =>
              handleFilterChange(category, event.target.value)
            }
          >
            <option value="">
              {categoryLabel}: {t("filter.allValue")}
            </option>

            {options.map((option) => (
              <option
                key={option}
                value={option}
              >
                {categoryLabel}: {formatLabel(category, option)}
              </option>
            ))}
          </select>
        );
      })}

      <select
        value={sortOption}
        onChange={(event) => setSortOption(event.target.value)}
      >
        <option value="bestMatch">{sortLabel}: {t("filter.sort.bestMatch")}</option>
        <option value="pointsAsc">{sortLabel}: {t("filter.sort.pointsAsc")}</option>
        <option value="pointsDesc">{sortLabel}: {t("filter.sort.pointsDesc")}</option>
        <option value="brandAsc">{sortLabel}: {t("filter.sort.brandAsc")}</option>
        <option value="tier">{sortLabel}: {t("filter.sort.tier")}</option>
        <option value="alphabetical">{sortLabel}: {t("filter.sort.alphabetical")}</option>
      </select>
    </div>
  );
}

export default FilterBar;
