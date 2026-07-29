import { getPerfumeNoteIds } from "../../../utils/noteUtils.js";

export function buildScentLibraryViewModel({
  selectedPerfumes = [],
  notes = {},
} = {}) {
  const safeSelectedPerfumes = Array.isArray(selectedPerfumes) ? selectedPerfumes : [];
  const safeNotes = notes && typeof notes === "object" ? notes : {};
  const entriesByNoteId = new Map();

  safeSelectedPerfumes.forEach((perfume) => {
    if (!perfume || typeof perfume !== "object") {
      return;
    }

    const uniqueNoteIds = new Set(getPerfumeNoteIds(perfume).filter(Boolean));

    uniqueNoteIds.forEach((noteId) => {
      const note = safeNotes[noteId];

      if (!note) {
        return;
      }

      if (!entriesByNoteId.has(noteId)) {
        entriesByNoteId.set(noteId, {
          noteId,
          name: note.name || formatNoteId(noteId),
          image: note.noteImage || note.image || "",
          perfumeCount: 0,
          perfumes: [],
        });
      }

      const entry = entriesByNoteId.get(noteId);
      entry.perfumes.push({
        perfumeId: perfume.id,
        name: perfume.name,
        shortName: perfume.shortName || "",
        brand: perfume.brand,
        image: perfume.image || "",
      });
    });
  });

  return [...entriesByNoteId.values()]
    .map((entry) => ({
      ...entry,
      perfumes: [...entry.perfumes].sort(comparePerfumes),
      perfumeCount: entry.perfumes.length,
    }))
    .sort(compareNotes);
}

function compareNotes(firstEntry, secondEntry) {
  const labelComparison = firstEntry.name.localeCompare(secondEntry.name, undefined, {
    sensitivity: "base",
  });

  if (labelComparison !== 0) {
    return labelComparison;
  }

  return firstEntry.noteId.localeCompare(secondEntry.noteId);
}

function comparePerfumes(firstPerfume, secondPerfume) {
  const nameComparison = firstPerfume.name.localeCompare(secondPerfume.name, undefined, {
    sensitivity: "base",
  });

  if (nameComparison !== 0) {
    return nameComparison;
  }

  return firstPerfume.perfumeId - secondPerfume.perfumeId;
}

function formatNoteId(noteId) {
  return String(noteId)
    .split(/(?=[A-Z])|[-_\s]/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
