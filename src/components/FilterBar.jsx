function FilterBar({
  filterOptions,
  activeFilters,
  handleFilterChange,
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
    </div>
  );
}

export default FilterBar;