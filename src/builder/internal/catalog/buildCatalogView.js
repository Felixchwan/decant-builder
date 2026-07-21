import { buildFilterOptions } from "../../../utils/filterUtils.js";
import { getPerfumeNoteIds } from "../../../utils/noteUtils.js";

const EMPTY_FILTERS = {};
const EMPTY_NOTES = {};

export function buildCatalogView({
  catalog,
  notes = EMPTY_NOTES,
  searchQuery = "",
  activeFilters = EMPTY_FILTERS,
  sortOption = "bestMatch",
}) {
  if (!Array.isArray(catalog)) {
    throw new Error("buildCatalogView requires catalog to be an array.");
  }

  const normalizedSearchQuery = String(searchQuery || "").trim().toLowerCase();
  const filterOptions = buildFilterOptions(catalog);
  const visiblePerfumes = sortPerfumes(
    catalog.filter((perfume) =>
      matchesActiveFilters(perfume, activeFilters) &&
      matchesSearch(perfume, notes || EMPTY_NOTES, normalizedSearchQuery)
    ),
    sortOption,
    normalizedSearchQuery
  );

  return {
    visiblePerfumes,
    resultCount: visiblePerfumes.length,
    normalizedSearchQuery,
    hasActiveSearch: Boolean(normalizedSearchQuery),
    hasActiveFilters: hasActiveFilters(activeFilters),
    filterOptions,
  };
}

function matchesActiveFilters(perfume, activeFilters = EMPTY_FILTERS) {
  const matchesSeason =
    !activeFilters.seasons ||
    perfume.seasons.includes(activeFilters.seasons);

  const matchesOccasion =
    !activeFilters.occasions ||
    perfume.occasions.includes(activeFilters.occasions);

  const matchesVibe =
    !activeFilters.vibes || perfume.vibes.includes(activeFilters.vibes);

  return matchesSeason && matchesOccasion && matchesVibe;
}

function matchesSearch(perfume, notes, normalizedSearchQuery) {
  return (
    !normalizedSearchQuery ||
    getSearchText(perfume, notes).includes(normalizedSearchQuery)
  );
}

function hasActiveFilters(activeFilters = EMPTY_FILTERS) {
  return Boolean(
    activeFilters.seasons ||
      activeFilters.occasions ||
      activeFilters.vibes
  );
}

function getSearchText(perfume, notes) {
  const noteIds = getPerfumeNoteIds(perfume);
  const noteNames = noteIds
    .map((noteId) => notes[noteId]?.name)
    .filter(Boolean);

  return [
    perfume.name,
    perfume.brand,
    ...(perfume.accords || []),
    ...(perfume.vibes || []),
    ...noteIds,
    ...noteNames,
  ]
    .join(" ")
    .toLowerCase();
}

function sortPerfumes(perfumesToSort, sortOption, searchQuery) {
  return [...perfumesToSort].sort((a, b) => {
    if (sortOption === "pointsAsc") {
      return a.points - b.points || compareNames(a, b);
    }

    if (sortOption === "pointsDesc") {
      return b.points - a.points || compareNames(a, b);
    }

    if (sortOption === "brandAsc") {
      return (
        a.brand.localeCompare(b.brand) ||
        compareNames(a, b)
      );
    }

    if (sortOption === "tier") {
      return (
        getTierRank(a.id) - getTierRank(b.id) ||
        a.points - b.points ||
        compareNames(a, b)
      );
    }

    if (sortOption === "alphabetical") {
      return compareNames(a, b);
    }

    if (searchQuery) {
      return (
        getBestMatchRank(a, searchQuery) -
          getBestMatchRank(b, searchQuery) ||
        compareNames(a, b)
      );
    }

    return 0;
  });
}

function getBestMatchRank(perfume, searchQuery) {
  if (perfume.name.toLowerCase().includes(searchQuery)) {
    return 0;
  }

  if (perfume.brand.toLowerCase().includes(searchQuery)) {
    return 1;
  }

  const accordOrVibeMatch = [
    ...(perfume.accords || []),
    ...(perfume.vibes || []),
  ].some((item) => item.toLowerCase().includes(searchQuery));

  if (accordOrVibeMatch) {
    return 2;
  }

  return 3;
}

function getTierRank(id) {
  if (id < 100) return 0;
  if (id < 200) return 1;
  if (id < 300) return 2;
  if (id < 400) return 3;
  if (id < 500) return 4;
  return 5;
}

function compareNames(a, b) {
  return a.name.localeCompare(b.name);
}
