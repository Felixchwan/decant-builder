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

  return (
    <div className="filters">
      {Object.entries(filterOptions).map(([category, options]) => (
        <select
          key={category}
          value={activeFilters[category]}
          onChange={(event) =>
            handleFilterChange(category, event.target.value)
          }
        >
          <option value="">
            {t("filter.all", { category: t(`taxonomy.${category}`) })}
          </option>

          {options.map((option) => (
            <option
              key={option}
              value={option}
            >
              {formatLabel(category, option)}
            </option>
          ))}
        </select>
      ))}

      <select
        value={sortOption}
        onChange={(event) => setSortOption(event.target.value)}
      >
        <option value="bestMatch">{t("filter.sort.bestMatch")}</option>
        <option value="pointsAsc">{t("filter.sort.pointsAsc")}</option>
        <option value="pointsDesc">{t("filter.sort.pointsDesc")}</option>
        <option value="brandAsc">{t("filter.sort.brandAsc")}</option>
        <option value="tier">{t("filter.sort.tier")}</option>
        <option value="alphabetical">{t("filter.sort.alphabetical")}</option>
      </select>
    </div>
  );
}

export default FilterBar;
