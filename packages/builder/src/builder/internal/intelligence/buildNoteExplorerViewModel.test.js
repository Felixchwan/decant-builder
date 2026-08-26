import { describe, expect, it } from "vitest";
import {
  buildNoteExplorerNoteOptions,
  getNoteExplorerMatches,
} from "./buildNoteExplorerViewModel.js";

// Composer Phase 2A: Note Explorer regression coverage. Containment-based
// only -- these tests assert membership (does this perfume carry this note
// anywhere in its pyramid/general notes) and deterministic ordering, never
// prominence, weight, or a "more of this note" ranking.

function perfume(id, overrides = {}) {
  return {
    id,
    name: `Perfume ${id}`,
    brand: "Test House",
    points: 1,
    topNotes: [],
    middleNotes: [],
    baseNotes: [],
    generalNotes: [],
    ...overrides,
  };
}

const notes = {
  bergamot: { name: "Bergamot", noteImageAssetKey: "notes/bergamot.jpg", noteImage: "/img/bergamot.jpg" },
  vanilla: { name: "Vanilla" },
  patchouli: { name: "Patchouli" },
  // Present in the raw notes dictionary but never referenced by any perfume
  // in this catalog -- must never surface as an explorable option (mirrors
  // the real-world case where a merchant's note dictionary is broader than
  // its own filtered perfume catalog).
  saffron: { name: "Saffron" },
};

// Deliberately exercises all four pyramid/general-note shapes at once:
// - topPerfume carries bergamot only as a top note
// - middlePerfume carries bergamot only as a middle note
// - basePerfume carries vanilla only as a base note
// - generalPerfume carries vanilla only via the flat generalNotes shape
// - noMatchPerfume carries neither bergamot nor vanilla anywhere
const topPerfume = perfume(1, { topNotes: ["bergamot"] });
const middlePerfume = perfume(2, { middleNotes: ["bergamot"] });
const basePerfume = perfume(3, { baseNotes: ["vanilla"] });
const generalPerfume = perfume(4, { generalNotes: ["vanilla"] });
const noMatchPerfume = perfume(5, { topNotes: ["patchouli"] });
const catalog = [topPerfume, middlePerfume, basePerfume, generalPerfume, noMatchPerfume];

describe("buildNoteExplorerNoteOptions", () => {
  it("derives note options only from notes actually referenced by the live catalog", () => {
    const options = buildNoteExplorerNoteOptions({ catalogPerfumes: catalog, notes });
    const noteIds = options.map((option) => option.noteId);

    expect(noteIds).toEqual(expect.arrayContaining(["bergamot", "vanilla", "patchouli"]));
    expect(noteIds).not.toContain("saffron");
  });

  it("counts every perfume that carries the note across any of top/middle/base/general shapes", () => {
    const options = buildNoteExplorerNoteOptions({ catalogPerfumes: catalog, notes });
    const bergamotOption = options.find((option) => option.noteId === "bergamot");
    const vanillaOption = options.find((option) => option.noteId === "vanilla");

    expect(bergamotOption.perfumeCount).toBe(2);
    expect(vanillaOption.perfumeCount).toBe(2);
  });

  it("carries the raw catalog note name and resolved image through for display, without transforming them", () => {
    const options = buildNoteExplorerNoteOptions({ catalogPerfumes: catalog, notes });
    const bergamotOption = options.find((option) => option.noteId === "bergamot");

    expect(bergamotOption.name).toBe("Bergamot");
    expect(bergamotOption.image).toBe("/img/bergamot.jpg");
  });

  it("falls back to a formatted id when the note dictionary has no name, without ever exposing the raw camelCase id", () => {
    const options = buildNoteExplorerNoteOptions({
      catalogPerfumes: [perfume(6, { topNotes: ["whiteMusk"] })],
      notes: { whiteMusk: {} },
    });

    expect(options[0].name).toBe("White Musk");
  });

  it("orders options deterministically (by display name, then canonical id) regardless of catalog input order", () => {
    const forward = buildNoteExplorerNoteOptions({ catalogPerfumes: catalog, notes });
    const reversed = buildNoteExplorerNoteOptions({ catalogPerfumes: [...catalog].reverse(), notes });

    expect(forward.map((option) => option.noteId)).toEqual(reversed.map((option) => option.noteId));
    expect(forward.map((option) => option.name)).toEqual(["Bergamot", "Patchouli", "Vanilla"]);
  });

  it("returns no options for an empty catalog", () => {
    expect(buildNoteExplorerNoteOptions({ catalogPerfumes: [], notes })).toEqual([]);
  });
});

describe("getNoteExplorerMatches", () => {
  it("returns every catalog fragrance that contains the selected note, regardless of which pyramid tier or generalNotes carries it", () => {
    const matches = getNoteExplorerMatches({ catalogPerfumes: catalog, noteId: "bergamot" });
    expect(matches.map((item) => item.id)).toEqual([topPerfume.id, middlePerfume.id]);

    const vanillaMatches = getNoteExplorerMatches({ catalogPerfumes: catalog, noteId: "vanilla" });
    expect(vanillaMatches.map((item) => item.id)).toEqual([basePerfume.id, generalPerfume.id]);
  });

  it("excludes fragrances that do not carry the selected note anywhere", () => {
    const matches = getNoteExplorerMatches({ catalogPerfumes: catalog, noteId: "bergamot" });
    expect(matches.some((item) => item.id === noMatchPerfume.id)).toBe(false);
  });

  it("preserves catalog order rather than inferring or fabricating a prominence-based ranking", () => {
    const forwardMatches = getNoteExplorerMatches({ catalogPerfumes: catalog, noteId: "bergamot" });
    const shuffledCatalog = [middlePerfume, noMatchPerfume, topPerfume, basePerfume, generalPerfume];
    const shuffledMatches = getNoteExplorerMatches({ catalogPerfumes: shuffledCatalog, noteId: "bergamot" });

    expect(forwardMatches.map((item) => item.id)).toEqual([1, 2]);
    expect(shuffledMatches.map((item) => item.id)).toEqual([2, 1]);
  });

  it("returns no matches when no note is selected", () => {
    expect(getNoteExplorerMatches({ catalogPerfumes: catalog, noteId: null })).toEqual([]);
  });

  it("returns an empty array for a note nothing in the catalog carries", () => {
    expect(getNoteExplorerMatches({ catalogPerfumes: catalog, noteId: "saffron" })).toEqual([]);
  });
});
