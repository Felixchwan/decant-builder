import { getPerfumeNoteIds } from "./noteUtils";

export function buildBoxSummary(selectedPerfumes, notes) {
  const allOccasions = selectedPerfumes.flatMap((p) => p.occasions || []);
  const allSeasons = selectedPerfumes.flatMap((p) => p.seasons || []);
  const allVibes = selectedPerfumes.flatMap((p) => p.vibes || []);
  const seasonStrengths = selectedPerfumes.reduce(
    (strengths, perfume) => {
      const weights = getSeasonWeights(perfume);

      Object.entries(weights).forEach(([season, weight]) => {
        strengths[season] = (strengths[season] || 0) + weight;
      });

      return strengths;
    },
    { spring: 0, summer: 0, fall: 0, winter: 0 }
  );

  const allNotes = selectedPerfumes
    .flatMap((p) => getPerfumeNoteIds(p))
    .map((noteId) => notes[noteId]?.name)
    .filter(Boolean);

  const accordMap = selectedPerfumes.reduce((map, perfume) => {
    (perfume.accords || []).forEach((accord) => {
      if (!map[accord]) {
        map[accord] = [];
      }

      map[accord].push(perfume.name);
    });

    return map;
  }, {});

  return {
    occasions: [...new Set(allOccasions)],
    seasons: [...new Set(allSeasons)],
    notes: [...new Set(allNotes)],
    vibes: [...new Set(allVibes)],
    accordMap,

    occasionCounts: buildCountMap(allOccasions),
    seasonCounts: buildCountMap(allSeasons),
    seasonStrengths,
    vibeCounts: buildCountMap(allVibes),
  };
}

function buildCountMap(items) {
  return items.reduce((map, item) => {
    map[item] = (map[item] || 0) + 1;
    return map;
  }, {});
}

function getSeasonWeights(perfume) {
  if (perfume.seasonWeights) {
    return perfume.seasonWeights;
  }

  return Object.fromEntries(
    ["spring", "summer", "fall", "winter"].map((season) => [
      season,
      perfume.seasons?.includes(season) ? 6 : 0,
    ])
  );
}
