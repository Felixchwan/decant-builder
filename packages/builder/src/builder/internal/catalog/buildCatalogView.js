import { MARKET_SEGMENTS, getBrandMarketSegment } from "@discovery-box/catalog";
import { buildFilterOptions } from "../../../utils/filterUtils.js";
import { getPerfumeNoteIds } from "../../../utils/noteUtils.js";

const EMPTY_FILTERS = {};
const EMPTY_NOTES = {};

export function buildCatalogView({
  catalog,
  notes = EMPTY_NOTES,
  searchQuery = "",
  activeFilters = EMPTY_FILTERS,
  // Which market segments (arabic / designer / niche) the catalog shows. Omitted (undefined or null) means no segment filter
  // at all; an array is the exact set of enabled segments, so an empty array shows nothing.
  enabledMarketSegments = null,
  sortOption = "bestMatch",
}) {
  if (!Array.isArray(catalog)) {
    throw new Error("buildCatalogView requires catalog to be an array.");
  }

  const normalizedSearchQuery = normalizeSearchText(searchQuery);
  const filterOptions = buildFilterOptions(catalog);
  const visiblePerfumes = sortPerfumes(
    catalog.filter((perfume) =>
      matchesActiveFilters(perfume, activeFilters) &&
      matchesMarketSegment(perfume, enabledMarketSegments) &&
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
    hasActiveFilters: hasActiveFilters(activeFilters) || hasActiveMarketSegmentFilter(enabledMarketSegments),
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

// A fragrance is shown when its brand's segment is enabled. A brand with no segment is never hidden by the segment filter
// (it fails open), except when no segment at all is enabled: an empty selection shows nothing.
function matchesMarketSegment(perfume, enabledMarketSegments) {
  if (!Array.isArray(enabledMarketSegments)) {
    return true;
  }

  if (enabledMarketSegments.length === 0) {
    return false;
  }

  const segment = getBrandMarketSegment(perfume.brand);

  return segment === undefined || enabledMarketSegments.includes(segment);
}

function hasActiveMarketSegmentFilter(enabledMarketSegments) {
  return (
    Array.isArray(enabledMarketSegments) &&
    MARKET_SEGMENTS.some((segment) => !enabledMarketSegments.includes(segment))
  );
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
    .toLowerCase()
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "");
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
  if (normalizeRequiredSearchText(perfume.name).includes(searchQuery)) {
    return 0;
  }

  if (normalizeRequiredSearchText(perfume.brand).includes(searchQuery)) {
    return 1;
  }

  const accordOrVibeMatch = [
    ...(perfume.accords || []),
    ...(perfume.vibes || []),
  ].some((item) => normalizeSearchText(item).includes(searchQuery));

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

function normalizeSearchText(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "");
}

function normalizeRequiredSearchText(value) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "");
}
