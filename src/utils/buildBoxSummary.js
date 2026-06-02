import { getPerfumeNoteIds } from "./noteUtils";

export function buildBoxSummary(selectedPerfumes, notes) {
  const allOccasions = selectedPerfumes.flatMap((p) => p.occasions || []);
  const allSeasons = selectedPerfumes.flatMap((p) => p.seasons || []);
  const allVibes = selectedPerfumes.flatMap((p) => p.vibes || []);

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
  vibeCounts: buildCountMap(allVibes),
};

function buildCountMap(items) {
  return items.reduce((map, item) => {
    map[item] = (map[item] || 0) + 1;
    return map;
  }, {});
}
}