function FilterBar({
  filterOptions,
  activeFilters,
  handleFilterChange,
  sortOption,
  setSortOption,
}) {
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
            All {category}
          </option>

          {options.map((option) => (
            <option
              key={option}
              value={option}
            >
              {option}
            </option>
          ))}
        </select>
      ))}

      <select
        value={sortOption}
        onChange={(event) => setSortOption(event.target.value)}
      >
        <option value="bestMatch">Best match</option>
        <option value="pointsAsc">Points ascending</option>
        <option value="pointsDesc">Points descending</option>
        <option value="brandAsc">Brand A-Z</option>
        <option value="tier">Tier</option>
        <option value="alphabetical">Alphabetical</option>
      </select>
    </div>
  );
}

export default FilterBar;
