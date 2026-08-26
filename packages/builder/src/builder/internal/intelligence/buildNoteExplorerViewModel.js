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
// already uses rather than ranking matches against each other. Phase 2D's
// prominence sort is a strictly separate, opt-in reordering step (see
// sortNoteExplorerMatchesByProminence below) -- containment itself never
// changes, and noteProminence is never consulted here.
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

// Composer Phase 2D: an opt-in reordering of an already-computed match list
// (from getNoteExplorerMatches), never a filter -- every perfume passed in
// comes back out, exactly once, so containment/visibility is untouched by
// this function. Scored matches (an integer at perfume.noteProminence[noteId]
// -- never a fabricated/synthesized value) come first, sorted descending;
// unscored matches (score missing, i.e. not an integer -- a missing key is
// "unscored", never coerced to 0) keep their relative catalog order and
// follow after every scored match. Array.prototype.sort's stability
// (guaranteed by the spec since ES2019, and by every engine this project
// targets) is what makes equal-score ties preserve catalog order, and the
// unscored bucket is simply never sorted -- both groups are built by a
// single pass over `matches` in its original order.
export function sortNoteExplorerMatchesByProminence(matches, noteId) {
  const safeMatches = Array.isArray(matches) ? matches : [];

  if (!noteId) {
    return [...safeMatches];
  }

  const scored = [];
  const unscored = [];

  safeMatches.forEach((perfume) => {
    const score = perfume?.noteProminence?.[noteId];

    if (Number.isInteger(score)) {
      scored.push(perfume);
    } else {
      unscored.push(perfume);
    }
  });

  scored.sort((firstPerfume, secondPerfume) => {
    return secondPerfume.noteProminence[noteId] - firstPerfume.noteProminence[noteId];
  });

  return [...scored, ...unscored];
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
