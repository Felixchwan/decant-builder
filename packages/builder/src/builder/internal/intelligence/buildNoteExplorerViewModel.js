import { getNoteProminenceLevel } from "@discovery-box/catalog";

import { getPerfumeNoteIds } from "../../../utils/noteUtils.js";

// Composer Phase 2A: Note Explorer. Containment-based only -- a perfume
// either carries a note (in any of topNotes/middleNotes/baseNotes/
// generalNotes, via the same getPerfumeNoteIds helper the perfume-details
// modal and Scent Library already use) or it does not. No prominence/weight
// signal exists here, matching buildScentLibraryViewModel.js's own scope --
// this file is the catalog-wide sibling of that box-scoped view model, not a
// replacement for it.

// `resolveLabel(noteId, fallbackName)` is an optional caller-supplied hook
// (e.g. `(noteId, fallback) => translator.label("notes", noteId, fallback)`)
// for the CURRENT localized display label -- this file has no i18n
// dependency of its own and never will (packages/builder's i18n lives
// alongside it, but this view-model stays a pure function of catalog data
// plus whatever label a caller hands it, so it works identically whether or
// not a host ever localizes note names). Omitting resolveLabel keeps every
// existing caller's exact prior behavior: label falls back to the raw
// catalog name, so sorting/search behave exactly as before localization was
// introduced. `locale` (a BCP47 tag, or omitted for the runtime default)
// only affects collation order via Intl.Collator below -- it never affects
// which notes are included or how they're counted.
export function buildNoteExplorerNoteOptions({ catalogPerfumes = [], notes = {}, locale, resolveLabel } = {}) {
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
        const name = note.name || formatNoteId(noteId);

        optionsByNoteId.set(noteId, {
          noteId,
          name,
          label: typeof resolveLabel === "function" ? resolveLabel(noteId, name) : name,
          image: note.noteImage || "",
          perfumeCount: 0,
        });
      }

      optionsByNoteId.get(noteId).perfumeCount += 1;
    });
  });

  // sensitivity: "base" matches the case/diacritic-insensitive comparison
  // this project already uses elsewhere for note text (see
  // normalizeNoteSearchText in BuilderPanel.jsx) -- ties still resolve to a
  // deterministic order via the canonical id, never left to collator
  // implementation-defined stability.
  const collator = new Intl.Collator(locale || undefined, { sensitivity: "base" });

  return [...optionsByNoteId.values()].sort((firstOption, secondOption) =>
    compareNoteOptions(firstOption, secondOption, collator)
  );
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

// Progressive co-occurrence facet filtering: AND semantics across every
// selected note, built strictly on top of the same containment primitive
// (getPerfumeNoteIds) getNoteExplorerMatches itself uses -- never a second,
// competing interpretation of "does this perfume carry this note". Kept as
// its own function (rather than changing getNoteExplorerMatches' signature)
// so every existing single-note caller/test is untouched; the two are
// equivalent when noteIds has exactly one entry.
export function getNoteExplorerMatchesForNoteIds({ catalogPerfumes = [], noteIds = [] } = {}) {
  const safeCatalogPerfumes = Array.isArray(catalogPerfumes) ? catalogPerfumes : [];
  const safeNoteIds = (Array.isArray(noteIds) ? noteIds : []).filter(Boolean);

  if (safeNoteIds.length === 0) {
    return [];
  }

  return safeCatalogPerfumes.filter((perfume) => {
    if (!perfume || typeof perfume !== "object") {
      return false;
    }

    const perfumeNoteIds = new Set(getPerfumeNoteIds(perfume));
    return safeNoteIds.every((noteId) => perfumeNoteIds.has(noteId));
  });
}

// Related-note facets for progressive exploration: given the perfumes that
// already match every currently-selected note, collect every OTHER
// canonical note those perfumes carry, with a count of how many of them
// carry it -- i.e. "how many of the current matches would remain if this
// note were added too". Selected notes are excluded (selecting one again is
// a no-op, never an option). Never touches the full catalog or re-derives
// containment differently from getNoteExplorerMatchesForNoteIds above --
// matchingPerfumes is expected to already be that function's own output.
export function buildNoteExplorerRelatedNoteFacets({
  notes = {},
  matchingPerfumes = [],
  selectedNoteIds = [],
} = {}) {
  const safeNotes = notes && typeof notes === "object" ? notes : {};
  const safeMatches = Array.isArray(matchingPerfumes) ? matchingPerfumes : [];
  const excludedNoteIds = new Set((Array.isArray(selectedNoteIds) ? selectedNoteIds : []).filter(Boolean));

  const countByNoteId = new Map();

  safeMatches.forEach((perfume) => {
    if (!perfume || typeof perfume !== "object") {
      return;
    }

    const uniqueNoteIds = new Set(getPerfumeNoteIds(perfume).filter(Boolean));

    uniqueNoteIds.forEach((noteId) => {
      if (excludedNoteIds.has(noteId) || !safeNotes[noteId]) {
        return;
      }

      countByNoteId.set(noteId, (countByNoteId.get(noteId) || 0) + 1);
    });
  });

  // The note dictionary's own key order is its canonical order (see
  // packages/catalog/src/notes.js's own "Canonical fragrance-note
  // dictionary" heading) -- used only to break ties deterministically,
  // never to reshuffle notes with different counts.
  const canonicalIndexByNoteId = new Map(Object.keys(safeNotes).map((noteId, index) => [noteId, index]));

  return [...countByNoteId.entries()]
    .map(([noteId, count]) => {
      const note = safeNotes[noteId];
      return {
        noteId,
        name: note.name || formatNoteId(noteId),
        image: note.noteImage || "",
        count,
      };
    })
    .sort((firstFacet, secondFacet) => {
      if (secondFacet.count !== firstFacet.count) {
        return secondFacet.count - firstFacet.count;
      }

      const firstIndex = canonicalIndexByNoteId.has(firstFacet.noteId)
        ? canonicalIndexByNoteId.get(firstFacet.noteId)
        : Number.MAX_SAFE_INTEGER;
      const secondIndex = canonicalIndexByNoteId.has(secondFacet.noteId)
        ? canonicalIndexByNoteId.get(secondFacet.noteId)
        : Number.MAX_SAFE_INTEGER;

      return firstIndex - secondIndex;
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

// Qualitative-prominence consumer layer: a purely additive annotation step
// that must run strictly after containment (getNoteExplorerMatches) and
// after any sort (sortNoteExplorerMatchesByProminence) have already
// decided membership and order. This function never filters and never
// reorders -- every match passed in comes back out, exactly once, in the
// same order -- so containment and sorting stay the sole responsibility of
// the functions above. Each returned entry is a new shallow copy of its
// input carrying one extra field, noteProminenceLevel, derived exclusively
// via the catalog package's own getNoteProminenceLevel(score) -- the
// shared public single source of truth for the numeric-to-qualitative
// mapping (9-10 defining, 7-8 veryEvident, 4-6 clearlyPerceptible, 1-3
// secondary, otherwise null). The threshold logic itself is never
// duplicated here. A perfume that canonically carries the note but has no
// numeric score yields noteProminenceLevel: null -- "no calibrated
// perceptual level", never the string "unscored", and never confused with
// the note being absent (that question was already answered by
// containment, before this function ever runs). The field is
// display/explanation-only: nothing here is consulted by sorting,
// filtering, containment, or recommendation logic.
export function annotateNoteExplorerMatchesWithProminenceLevel(matches, noteId) {
  const safeMatches = Array.isArray(matches) ? matches : [];

  return safeMatches.map((perfume) => ({
    ...perfume,
    noteProminenceLevel: noteId ? getNoteProminenceLevel(perfume?.noteProminence?.[noteId]) : null,
  }));
}

// Sorts by the CURRENT localized label (falls back to the raw catalog name
// when no resolveLabel was supplied -- see buildNoteExplorerNoteOptions
// above), via the caller's locale-aware collator, so the master list reads
// alphabetically in whichever language is actually on screen. Canonical id
// is only ever the deterministic tie-break, never the primary sort key.
function compareNoteOptions(firstOption, secondOption, collator) {
  const labelComparison = collator.compare(firstOption.label, secondOption.label);

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
