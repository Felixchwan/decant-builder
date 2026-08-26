import { describe, expect, it } from "vitest";
import {
  buildNoteExplorerNoteOptions,
  getNoteExplorerMatches,
  sortNoteExplorerMatchesByProminence,
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

// Composer Phase 2D: prominence sorting is a strictly separate, opt-in
// reordering of an already-computed match list -- it never changes which
// perfumes appear (containment stays exactly getNoteExplorerMatches' job),
// only the order they're presented in.
describe("sortNoteExplorerMatchesByProminence", () => {
  // Catalog order is A, B, C, D, E. A and B are deliberately tied at the
  // same score to exercise the tie-break rule; C and E are both unscored
  // for amber (D has a real but lower score) to exercise unscored-order
  // preservation with a gap between them.
  const perfumeA = perfume(1, { name: "A", noteProminence: { amber: 9 } });
  const perfumeB = perfume(2, { name: "B", noteProminence: { amber: 9 } });
  const perfumeC = perfume(3, { name: "C", noteProminence: {} });
  const perfumeD = perfume(4, { name: "D", noteProminence: { amber: 5 } });
  const perfumeE = perfume(5, { name: "E", noteProminence: {} });
  const amberMatches = [perfumeA, perfumeB, perfumeC, perfumeD, perfumeE];

  it("places every scored match before every unscored match", () => {
    const sorted = sortNoteExplorerMatchesByProminence(amberMatches, "amber");
    const scoredNames = ["A", "B", "D"];
    const sortedNames = sorted.map((p) => p.name);

    expect(sortedNames.slice(0, 3).sort()).toEqual(scoredNames.sort());
    expect(sortedNames.slice(3)).toEqual(["C", "E"]);
  });

  it("sorts scored matches descending by perfume.noteProminence[noteId]", () => {
    const sorted = sortNoteExplorerMatchesByProminence(amberMatches, "amber");
    expect(sorted.map((p) => p.name)).toEqual(["A", "B", "D", "C", "E"]);
  });

  it("preserves catalog order for tied scores (A and B both score 9, A came first)", () => {
    const sorted = sortNoteExplorerMatchesByProminence(amberMatches, "amber");
    const indexOfA = sorted.findIndex((p) => p.name === "A");
    const indexOfB = sorted.findIndex((p) => p.name === "B");
    expect(indexOfA).toBeLessThan(indexOfB);
  });

  it("preserves catalog order among unscored matches (C came before E)", () => {
    const sorted = sortNoteExplorerMatchesByProminence(amberMatches, "amber");
    const indexOfC = sorted.findIndex((p) => p.name === "C");
    const indexOfE = sorted.findIndex((p) => p.name === "E");
    expect(indexOfC).toBeLessThan(indexOfE);
  });

  it("treats a missing score as unscored, never as zero -- an unscored perfume never outranks or is conflated with a genuinely low explicit score", () => {
    const zeroIsUnscoredCase = [
      perfume(10, { name: "Unscored", noteProminence: {} }),
      perfume(11, { name: "ScoredOne", noteProminence: { iris: 1 } }),
    ];
    const sorted = sortNoteExplorerMatchesByProminence(zeroIsUnscoredCase, "iris");
    expect(sorted.map((p) => p.name)).toEqual(["ScoredOne", "Unscored"]);
  });

  it("never hides a matching fragrance, however sparse the prominence data -- same ids in, same ids out", () => {
    const sorted = sortNoteExplorerMatchesByProminence(amberMatches, "amber");
    expect(new Set(sorted.map((p) => p.id))).toEqual(new Set(amberMatches.map((p) => p.id)));
    expect(sorted).toHaveLength(amberMatches.length);
  });

  it("does not mutate the input array", () => {
    const original = [...amberMatches];
    sortNoteExplorerMatchesByProminence(amberMatches, "amber");
    expect(amberMatches).toEqual(original);
  });

  it("returns matches unchanged (still a new array) when no note is selected", () => {
    const sorted = sortNoteExplorerMatchesByProminence(amberMatches, null);
    expect(sorted).toEqual(amberMatches);
    expect(sorted).not.toBe(amberMatches);
  });

  it("never infers a score from top/middle/base/general pyramid position -- a perfume with the note only in its pyramid and no noteProminence entry is always unscored", () => {
    const pyramidOnly = perfume(20, { name: "PyramidOnly", topNotes: ["oud"], noteProminence: {} });
    const sorted = sortNoteExplorerMatchesByProminence([pyramidOnly], "oud");
    expect(sorted).toEqual([pyramidOnly]);
  });
});
