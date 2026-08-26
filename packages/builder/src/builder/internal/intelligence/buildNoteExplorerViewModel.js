import { getPerfumeNoteIds } from "../../../utils/noteUtils.js";

// Composer Phase 2A: Note Explorer. Containment-based only -- a perfume
// either carries a note (in any of topNotes/middleNotes/baseNotes/
// generalNotes, via the same getPerfumeNoteIds helper the perfume-details
// modal and Scent Library already use) or it does not. No prominence/weight
// signal exists here, matching buildScentLibraryViewModel.js's own scope --
// this file is the catalog-wide sibling of that box-scoped view model, not a
// replacement for it.

export function buildNoteExplorerNoteOptions({ catalogPerfumes = [], notes = {} } = {}) {
  const safeCatalogPerfumes = Array.isArray(catalogPerfumes) ? catalogPerfumes : [];
  const safeNotes = notes && typeof notes === "object" ? notes : {};
  const optionsByNoteId = new Map();

  safeCatalogPerfumes.forEach((perfume) => {
    if (!perfume || typeof perfume !== "object") {
      return;
    }

    const uniqueNoteIds = new Set(getPerfumeNoteIds(perfume).filter(Boolean));

    uniqueNoteIds.forEach((noteId) => {
      const note = safeNotes[noteId];

      if (!note) {
        return;
      }

      if (!optionsByNoteId.has(noteId)) {
        optionsByNoteId.set(noteId, {
          noteId,
          name: note.name || formatNoteId(noteId),
          image: note.noteImage || "",
          perfumeCount: 0,
        });
      }

      optionsByNoteId.get(noteId).perfumeCount += 1;
    });
  });

  return [...optionsByNoteId.values()].sort(compareNoteOptions);
}

// Catalog-order filter, not a sort -- Phase 2A deliberately infers no
// prominence, so results preserve whatever order the host's catalog array
// already uses rather than ranking matches against each other.
export function getNoteExplorerMatches({ catalogPerfumes = [], noteId } = {}) {
  const safeCatalogPerfumes = Array.isArray(catalogPerfumes) ? catalogPerfumes : [];

  if (!noteId) {
    return [];
  }

  return safeCatalogPerfumes.filter((perfume) => {
    if (!perfume || typeof perfume !== "object") {
      return false;
    }

    return getPerfumeNoteIds(perfume).includes(noteId);
  });
}

function compareNoteOptions(firstOption, secondOption) {
  const labelComparison = firstOption.name.localeCompare(secondOption.name, undefined, {
    sensitivity: "base",
  });

  if (labelComparison !== 0) {
    return labelComparison;
  }

  return String(firstOption.noteId).localeCompare(String(secondOption.noteId));
}

function formatNoteId(noteId) {
  return String(noteId)
    .split(/(?=[A-Z])|[-_\s]/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
