import { describe, expect, it } from "vitest";
import { fragrances as catalogFragrances } from "@discovery-box/catalog";
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

// Composer Phase 3A: horizontal note-family calibration regression, run
// against the real catalog rather than synthetic fixtures. The underlying
// data (family membership, exact scores, unrelated-value preservation,
// pyramid immutability) is proven in
// packages/catalog/tests/noteProminenceHorizontalCalibration3A.test.js;
// this describe block only proves the existing, unmodified sort algorithm
// produces the approved relative order once given those calibrated scores
// -- packages/catalog must never import from packages/builder (ADR-0006),
// so the sort-specific assertions live here instead.
describe("Note Explorer 'Most prominent' sort reflects the Phase 3A calibrated order", () => {
  it("basil: (Concentré d'Orange Verte = Torino21, catalog order) > Mirto di Panarea > (YSL L'Homme = Orange X Santal, catalog order) > Bois Imperial > The One for Men EDP > Halloween Man (unscored, last)", () => {
    const matches = getNoteExplorerMatches({ catalogPerfumes: catalogFragrances, noteId: "basil" });
    expect(matches.map((match) => match.id).sort((a, b) => a - b)).toEqual([13, 14, 110, 117, 119, 303, 305, 408]);

    const sorted = sortNoteExplorerMatchesByProminence(matches, "basil");
    expect(sorted.map((match) => match.id)).toEqual([110, 408, 119, 117, 305, 303, 13, 14]);

    // Concentré d'Orange Verte -- the fragrance flagged as ranking too
    // weakly for basil -- now ties for first place, per the Phase 3A
    // canonical-data correction and horizontal calibration, rather than
    // ranking as a secondary/incidental note.
    const rank = new Map(sorted.map((match, index) => [match.id, index]));
    expect(rank.get(110)).toBe(0);
  });

  it("blackCurrant: (Loewe 7 Cobalt = Silver Mountain Water, catalog order) > Club de Nuit Intense Man > (Cedrat Boise = Torino21, catalog order) > Il Padrino (unscored, last)", () => {
    const matches = getNoteExplorerMatches({ catalogPerfumes: catalogFragrances, noteId: "blackCurrant" });
    expect(matches.map((match) => match.id).sort((a, b) => a - b)).toEqual([19, 115, 203, 401, 408, 410]);

    const sorted = sortNoteExplorerMatchesByProminence(matches, "blackCurrant");
    expect(sorted.map((match) => match.id)).toEqual([203, 401, 19, 115, 408, 410]);

    // The specific implausible ordering flagged before this phase --
    // Cedrat Boise and Torino21 outranking Loewe 7 Cobalt -- is resolved.
    // (Loewe 7 Cobalt and Club de Nuit Intense Man were swapped from an
    // earlier draft of this pass on explicit editorial instruction during
    // finalization; both remain well above Cedrat Boise/Torino21 either
    // way.)
    const rank = new Map(sorted.map((match, index) => [match.id, index]));
    expect(rank.get(203)).toBeLessThan(rank.get(115));
    expect(rank.get(203)).toBeLessThan(rank.get(408));
  });
});

// Composer Phase 3B: horizontal note-family calibration regression for the
// apple and mint canonical-key families, run against the real catalog.
// The underlying data (taxonomy audit, exact scores, unrelated-value
// preservation, pyramid immutability) is proven in
// packages/catalog/tests/noteProminenceHorizontalCalibration3B.test.js;
// this describe block only proves the existing, unmodified sort algorithm
// produces the approved relative order per canonical key, and that
// distinct apple/mint variants are never cross-matched by a note id that
// isn't theirs.
describe("Note Explorer 'Most prominent' sort reflects the Phase 3B calibrated order, per distinct canonical key", () => {
  it("apple (generic): Layton > YSL Y EDP > Tous Man > (Jaguar Pace = Game of Spades Wildcard, catalog order) > Club de Nuit Intense Man (unscored, last)", () => {
    const matches = getNoteExplorerMatches({ catalogPerfumes: catalogFragrances, noteId: "apple" });
    expect(matches.map((match) => match.id).sort((a, b) => a - b)).toEqual([19, 28, 33, 114, 213, 404]);

    const sorted = sortNoteExplorerMatchesByProminence(matches, "apple");
    expect(sorted.map((match) => match.id)).toEqual([404, 213, 28, 33, 114, 19]);
  });

  it("greenApple: only Carlisle carries it, and it stays unscored (last/only position)", () => {
    const matches = getNoteExplorerMatches({ catalogPerfumes: catalogFragrances, noteId: "greenApple" });
    expect(matches.map((match) => match.id)).toEqual([403]);

    const sorted = sortNoteExplorerMatchesByProminence(matches, "greenApple");
    expect(sorted.map((match) => match.id)).toEqual([403]);
  });

  it("redApple: Born In Roma Coral Fantasy > Legend EDT", () => {
    const matches = getNoteExplorerMatches({ catalogPerfumes: catalogFragrances, noteId: "redApple" });
    expect(matches.map((match) => match.id).sort((a, b) => a - b)).toEqual([4, 211]);

    const sorted = sortNoteExplorerMatchesByProminence(matches, "redApple");
    expect(sorted.map((match) => match.id)).toEqual([211, 4]);
  });

  it("candyApple: only Eros EDP carries it, now scored", () => {
    const matches = getNoteExplorerMatches({ catalogPerfumes: catalogFragrances, noteId: "candyApple" });
    expect(matches.map((match) => match.id)).toEqual([6]);

    const sorted = sortNoteExplorerMatchesByProminence(matches, "candyApple");
    expect(sorted.map((match) => match.id)).toEqual([6]);
  });

  it("mint: Torino21 > Le Male > Concentré d'Orange Verte > Eros EDP", () => {
    const matches = getNoteExplorerMatches({ catalogPerfumes: catalogFragrances, noteId: "mint" });
    expect(matches.map((match) => match.id).sort((a, b) => a - b)).toEqual([5, 6, 110, 408]);

    const sorted = sortNoteExplorerMatchesByProminence(matches, "mint");
    expect(sorted.map((match) => match.id)).toEqual([408, 5, 110, 6]);
  });

  it("spearmint: Legend Blue > Mandarino di Sicilia", () => {
    const matches = getNoteExplorerMatches({ catalogPerfumes: catalogFragrances, noteId: "spearmint" });
    expect(matches.map((match) => match.id).sort((a, b) => a - b)).toEqual([22, 103]);

    const sorted = sortNoteExplorerMatchesByProminence(matches, "spearmint");
    expect(sorted.map((match) => match.id)).toEqual([22, 103]);
  });

  it("never cross-matches distinct apple/mint variants -- searching one canonical key never returns a fragrance whose only relevant note is a different variant", () => {
    const appleMatches = getNoteExplorerMatches({ catalogPerfumes: catalogFragrances, noteId: "apple" });
    expect(appleMatches.map((match) => match.id)).not.toContain(403); // Carlisle: greenApple only
    expect(appleMatches.map((match) => match.id)).not.toContain(4); // Legend EDT: redApple only
    expect(appleMatches.map((match) => match.id)).not.toContain(211); // Born In Roma Coral Fantasy: redApple only
    expect(appleMatches.map((match) => match.id)).not.toContain(6); // Eros EDP: candyApple only

    const mintMatches = getNoteExplorerMatches({ catalogPerfumes: catalogFragrances, noteId: "mint" });
    expect(mintMatches.map((match) => match.id)).not.toContain(22); // Legend Blue: spearmint only
    expect(mintMatches.map((match) => match.id)).not.toContain(103); // Mandarino di Sicilia: spearmint only
  });
});

// Composer Phase 3C: horizontal note-family calibration regression for the
// vanilla and cedar canonical-key families, run against the real catalog.
// The underlying data (taxonomy audit, canonical-data sanity audit, exact
// scores, unrelated-value preservation, pyramid immutability) is proven in
// packages/catalog/tests/noteProminenceHorizontalCalibration3C.test.js;
// this describe block only proves the existing, unmodified sort algorithm
// produces the approved relative order per canonical key -- scored
// fragrances sort descending, ties preserve catalog order, unscored
// members trail after every scored one, and no cross-variant ranking
// occurs between e.g. cedar and cedarwood.
describe("Note Explorer 'Most prominent' sort reflects the Phase 3C calibrated order, per distinct canonical key", () => {
  it("vanilla (generic): scores descend (Le Male = Le Male Le Parfum = Spicebomb Extreme at 8, down to Replica By The Fireplace at 4), then every unscored member trails in catalog order", () => {
    // Gentleman EDP (205) is no longer a member: its canonical base note
    // was corrected to blackVanilla (see the "blackVanilla" case below
    // and noteProminenceHorizontalCalibration3C.test.js), so the vanilla
    // family is 18 members here, not 19.
    const matches = getNoteExplorerMatches({ catalogPerfumes: catalogFragrances, noteId: "vanilla" });
    expect(matches.map((match) => match.id).sort((a, b) => a - b)).toEqual([
      5, 6, 12, 14, 19, 20, 21, 29, 31, 113, 115, 116, 202, 204, 212, 403, 404, 410,
    ]);

    const sorted = sortNoteExplorerMatchesByProminence(matches, "vanilla");
    expect(sorted.map((match) => match.id)).toEqual([
      5, 113, 212, 6, 29, 404, 21, 14, 116, 202, 403, 410, 204, 12, 19, 20, 31, 115,
    ]);

    // The five unscored members (12, 19, 20, 31, 115) all trail after
    // every scored member, in their original catalog order.
    const rank = new Map(sorted.map((match, index) => [match.id, index]));
    const lastScoredRank = rank.get(204);
    for (const unscoredId of [12, 19, 20, 31, 115]) {
      expect(rank.get(unscoredId)).toBeGreaterThan(lastScoredRank);
    }
  });

  it("bourbonVanilla: Spicebomb Extreme > Tuxedo", () => {
    const matches = getNoteExplorerMatches({ catalogPerfumes: catalogFragrances, noteId: "bourbonVanilla" });
    expect(matches.map((match) => match.id).sort((a, b) => a - b)).toEqual([212, 501]);

    const sorted = sortNoteExplorerMatchesByProminence(matches, "bourbonVanilla");
    expect(sorted.map((match) => match.id)).toEqual([212, 501]);
  });

  it("madagascarVanilla: Divine Vanille > Allure Homme Edition Blanche EDP", () => {
    const matches = getNoteExplorerMatches({ catalogPerfumes: catalogFragrances, noteId: "madagascarVanilla" });
    expect(matches.map((match) => match.id).sort((a, b) => a - b)).toEqual([301, 304]);

    const sorted = sortNoteExplorerMatchesByProminence(matches, "madagascarVanilla");
    expect(sorted.map((match) => match.id)).toEqual([304, 301]);
  });

  it("blackVanilla: 212 VIP Black > Gentleman EDP", () => {
    // Gentleman EDP (205) joined this family via the approved canonical
    // correction (its base note is Black Vanilla per Givenchy's own
    // published note identity, not generic vanilla) -- this family now
    // has 2 members instead of 1.
    const matches = getNoteExplorerMatches({ catalogPerfumes: catalogFragrances, noteId: "blackVanilla" });
    expect(matches.map((match) => match.id).sort((a, b) => a - b)).toEqual([106, 205]);

    const sorted = sortNoteExplorerMatchesByProminence(matches, "blackVanilla");
    expect(sorted.map((match) => match.id)).toEqual([106, 205]);
  });

  it("cedar (generic): scores descend (Terre d'Hermès EDT = Cedrat Boise = Orphéon EDP at 6, down to a tied group at 4), then all 21 unscored members trail in catalog order", () => {
    const matches = getNoteExplorerMatches({ catalogPerfumes: catalogFragrances, noteId: "cedar" });
    expect(matches.map((match) => match.id).sort((a, b) => a - b)).toEqual([
      1, 3, 5, 6, 10, 13, 17, 22, 24, 27, 28, 29, 102, 103, 104, 108, 111, 114, 115, 117, 118, 119, 208, 213, 214, 405,
      406, 409,
    ]);

    const sorted = sortNoteExplorerMatchesByProminence(matches, "cedar");
    expect(sorted.map((match) => match.id)).toEqual([
      111, 115, 409, 3, 17, 22, 104, 117, 406, 1, 5, 6, 10, 13, 24, 27, 28, 29, 102, 103, 119, 108, 114, 118, 208, 214,
      213, 405,
    ]);

    // The scored prefix (9 fragrances) precedes every unscored member.
    const rank = new Map(sorted.map((match, index) => [match.id, index]));
    const lastScoredRank = rank.get(406);
    for (const unscoredId of [1, 5, 6, 10, 13, 24, 27, 28, 29, 102, 103, 119, 108, 114, 118, 208, 214, 213, 405]) {
      expect(rank.get(unscoredId)).toBeGreaterThan(lastScoredRank);
    }
  });

  it("cedarwood: (L.12.12 Blanc EDP = Allure Homme Sport Superleggera, catalog order) at 4, then unscored members trail in catalog order", () => {
    const matches = getNoteExplorerMatches({ catalogPerfumes: catalogFragrances, noteId: "cedarwood" });
    expect(matches.map((match) => match.id).sort((a, b) => a - b)).toEqual([18, 34, 109, 302, 406]);

    const sorted = sortNoteExplorerMatchesByProminence(matches, "cedarwood");
    expect(sorted.map((match) => match.id)).toEqual([18, 302, 34, 109, 406]);
  });

  it("texasCedar: only Divine Vanille carries it, and it stays unscored", () => {
    const matches = getNoteExplorerMatches({ catalogPerfumes: catalogFragrances, noteId: "texasCedar" });
    expect(matches.map((match) => match.id)).toEqual([304]);

    const sorted = sortNoteExplorerMatchesByProminence(matches, "texasCedar");
    expect(sorted.map((match) => match.id)).toEqual([304]);
  });

  it("never cross-matches distinct vanilla/cedar variants -- searching one canonical key never returns a fragrance whose only relevant note is a different variant", () => {
    const vanillaMatches = getNoteExplorerMatches({ catalogPerfumes: catalogFragrances, noteId: "vanilla" });
    expect(vanillaMatches.map((match) => match.id)).not.toContain(501); // Tuxedo: bourbonVanilla only
    expect(vanillaMatches.map((match) => match.id)).not.toContain(301); // Allure Homme Edition Blanche EDP: madagascarVanilla only
    expect(vanillaMatches.map((match) => match.id)).not.toContain(304); // Divine Vanille: madagascarVanilla only
    expect(vanillaMatches.map((match) => match.id)).not.toContain(106); // 212 VIP Black: blackVanilla only
    expect(vanillaMatches.map((match) => match.id)).not.toContain(205); // Gentleman EDP: blackVanilla only, since the Phase 3C correction

    const cedarMatches = getNoteExplorerMatches({ catalogPerfumes: catalogFragrances, noteId: "cedar" });
    expect(cedarMatches.map((match) => match.id)).not.toContain(18); // L.12.12 Blanc EDP: cedarwood only
    expect(cedarMatches.map((match) => match.id)).not.toContain(34); // Givenchy Pour Homme Blue Label: cedarwood only
    expect(cedarMatches.map((match) => match.id)).not.toContain(109); // K EDP Intense: cedarwood only
    expect(cedarMatches.map((match) => match.id)).not.toContain(302); // Allure Homme Sport Superleggera: cedarwood only
  });
});

// Composer Phase 3D: horizontal note-family calibration regression for the
// citrus/orange and musk canonical-key families, run against the real
// catalog. The underlying data (taxonomy audit, canonical-data sanity
// audit, exact scores, unrelated-value preservation, pyramid immutability)
// is proven in packages/catalog/tests/noteProminenceHorizontalCalibration3D.test.js;
// this describe block only proves the existing, unmodified sort algorithm
// produces the approved relative order per canonical key -- scored
// fragrances sort descending, ties preserve catalog order, unscored
// members trail after every scored one, and exact canonical variants
// (e.g. bergamot vs. bloodOrange, musk vs. whiteMusk) never cross-rank.
describe("Note Explorer 'Most prominent' sort reflects the Phase 3D calibrated order, per distinct canonical key", () => {
  it("bergamot (40 members): scores descend ((Acqua di Gio EDT = Essenza = Sauvage EDP) at 7, down to Silver Mountain Water at 5), then all 34 unscored members trail in catalog order", () => {
    const matches = getNoteExplorerMatches({ catalogPerfumes: catalogFragrances, noteId: "bergamot" });
    expect(matches.map((match) => match.id).sort((a, b) => a - b)).toEqual([
      1, 3, 4, 5, 7, 12, 17, 19, 23, 25, 30, 31, 34, 35, 100, 101, 102, 103, 107, 114, 115, 117, 118, 119, 201, 202,
      205, 207, 209, 211, 213, 301, 306, 401, 404, 405, 406, 407, 410, 501,
    ]);

    const sorted = sortNoteExplorerMatchesByProminence(matches, "bergamot");
    expect(sorted.map((match) => match.id)).toEqual([
      1, 101, 202, 3, 30, 401, 4, 5, 7, 12, 17, 19, 23, 25, 31, 34, 35, 100, 102, 103, 119, 107, 114, 115, 117, 118,
      201, 205, 207, 209, 211, 213, 301, 306, 404, 405, 406, 407, 410, 501,
    ]);

    const rank = new Map(sorted.map((match, index) => [match.id, index]));
    const lastScoredRank = rank.get(401);
    expect(rank.get(4)).toBeGreaterThan(lastScoredRank); // an unscored member trails every scored one
  });

  it("orange: Concentré d'Orange Verte = Terre d'Hermès EDT > Tous Man, then unscored members trail in catalog order", () => {
    const matches = getNoteExplorerMatches({ catalogPerfumes: catalogFragrances, noteId: "orange" });
    expect(matches.map((match) => match.id).sort((a, b) => a - b)).toEqual([1, 9, 28, 31, 100, 101, 105, 110, 111]);

    const sorted = sortNoteExplorerMatchesByProminence(matches, "orange");
    expect(sorted.map((match) => match.id)).toEqual([110, 111, 28, 1, 9, 31, 100, 101, 105]);
  });

  it("mandarinOrange: only Scandal Pour Homme is scored, then unscored members trail in catalog order", () => {
    const matches = getNoteExplorerMatches({ catalogPerfumes: catalogFragrances, noteId: "mandarinOrange" });
    expect(matches.map((match) => match.id).sort((a, b) => a - b)).toEqual([1, 6, 7, 11, 14, 21, 27, 29, 101]);

    const sorted = sortNoteExplorerMatchesByProminence(matches, "mandarinOrange");
    expect(sorted.map((match) => match.id)).toEqual([11, 1, 6, 7, 14, 21, 27, 29, 101]);
  });

  it("bitterOrange: Orange X Santal > (L'Homme Idéal EDT = Concentré d'Orange Verte, catalog order), then Eros EDP (unscored, last)", () => {
    const matches = getNoteExplorerMatches({ catalogPerfumes: catalogFragrances, noteId: "bitterOrange" });
    expect(matches.map((match) => match.id).sort((a, b) => a - b)).toEqual([6, 10, 110, 305]);

    const sorted = sortNoteExplorerMatchesByProminence(matches, "bitterOrange");
    expect(sorted.map((match) => match.id)).toEqual([305, 10, 110, 6]);
  });

  it("grapefruit: (Polo Red EDT = Givenchy Pour Homme Blue Label = Terre d'Hermès EDT = Allure Homme Sport Superleggera, catalog order) at 7, down through Legend Red's newly-approved score, then unscored members trail in catalog order", () => {
    const matches = getNoteExplorerMatches({ catalogPerfumes: catalogFragrances, noteId: "grapefruit" });
    expect(matches.map((match) => match.id).sort((a, b) => a - b)).toEqual([
      12, 13, 16, 24, 26, 34, 101, 102, 111, 207, 302, 402, 405, 406,
    ]);

    const sorted = sortNoteExplorerMatchesByProminence(matches, "grapefruit");
    expect(sorted.map((match) => match.id)).toEqual([26, 34, 111, 302, 13, 24, 405, 12, 16, 101, 102, 207, 402, 406]);

    // Legend Red (24) is the one newly-approved grapefruit score this
    // phase added, scored independently alongside its existing
    // bloodOrange:6, never collapsed into that other citrus variant.
    const rank = new Map(sorted.map((match, index) => [match.id, index]));
    expect(rank.get(24)).toBeLessThan(rank.get(12));
  });

  it("citron: Cedrat Boise > Fico di Amalfi", () => {
    const matches = getNoteExplorerMatches({ catalogPerfumes: catalogFragrances, noteId: "citron" });
    expect(matches.map((match) => match.id).sort((a, b) => a - b)).toEqual([102, 115]);

    const sorted = sortNoteExplorerMatchesByProminence(matches, "citron");
    expect(sorted.map((match) => match.id)).toEqual([115, 102]);
  });

  it("greenMandarin: Mandarino di Sicilia > Armani Code EDT, then unscored members trail in catalog order", () => {
    const matches = getNoteExplorerMatches({ catalogPerfumes: catalogFragrances, noteId: "greenMandarin" });
    expect(matches.map((match) => match.id).sort((a, b) => a - b)).toEqual([17, 103, 104, 306]);

    const sorted = sortNoteExplorerMatchesByProminence(matches, "greenMandarin");
    expect(sorted.map((match) => match.id)).toEqual([103, 104, 17, 306]);
  });

  it("bloodOrange: Legend Red > Mandarino di Sicilia's newly-approved score, then K EDP Intense (unscored, last)", () => {
    const matches = getNoteExplorerMatches({ catalogPerfumes: catalogFragrances, noteId: "bloodOrange" });
    expect(matches.map((match) => match.id).sort((a, b) => a - b)).toEqual([24, 103, 109]);

    const sorted = sortNoteExplorerMatchesByProminence(matches, "bloodOrange");
    expect(sorted.map((match) => match.id)).toEqual([24, 103, 109]);
  });

  it("mandarin: Silver Mountain Water's newly-approved score outranks every unscored member, in catalog order", () => {
    const matches = getNoteExplorerMatches({ catalogPerfumes: catalogFragrances, noteId: "mandarin" });
    expect(matches.map((match) => match.id).sort((a, b) => a - b)).toEqual([110, 206, 302, 401, 404]);

    const sorted = sortNoteExplorerMatchesByProminence(matches, "mandarin");
    expect(sorted.map((match) => match.id)).toEqual([401, 110, 206, 302, 404]);
  });

  it("musk (23 members): Fierce > Versace Pour Homme > Silver Mountain Water > Summer Hammer, then all 19 unscored members trail in catalog order", () => {
    const matches = getNoteExplorerMatches({ catalogPerfumes: catalogFragrances, noteId: "musk" });
    expect(matches.map((match) => match.id).sort((a, b) => a - b)).toEqual([
      3, 9, 14, 17, 19, 28, 31, 32, 100, 101, 103, 105, 106, 107, 114, 207, 209, 304, 401, 405, 407, 408, 500,
    ]);

    const sorted = sortNoteExplorerMatchesByProminence(matches, "musk");
    expect(sorted.map((match) => match.id)).toEqual([
      9, 3, 401, 407, 14, 17, 19, 32, 28, 31, 100, 101, 103, 105, 106, 107, 114, 207, 209, 304, 405, 408, 500,
    ]);

    const rank = new Map(sorted.map((match, index) => [match.id, index]));
    const lastScoredRank = rank.get(407);
    expect(rank.get(14)).toBeGreaterThan(lastScoredRank); // an unscored member trails every scored one
  });

  it("whiteMusk: Touch for Men = Allure Homme Sport Superleggera > Acqua di Gio EDT, then Cedrat Boise (unscored, last)", () => {
    const matches = getNoteExplorerMatches({ catalogPerfumes: catalogFragrances, noteId: "whiteMusk" });
    expect(matches.map((match) => match.id).sort((a, b) => a - b)).toEqual([1, 27, 115, 302]);

    const sorted = sortNoteExplorerMatchesByProminence(matches, "whiteMusk");
    expect(sorted.map((match) => match.id)).toEqual([27, 302, 1, 115]);
  });

  it("never cross-matches distinct citrus/musk variants -- searching one canonical key never returns a fragrance whose only relevant note is a different variant", () => {
    const orangeMatches = getNoteExplorerMatches({ catalogPerfumes: catalogFragrances, noteId: "orange" });
    expect(orangeMatches.map((match) => match.id)).not.toContain(24); // Legend Red: bloodOrange only
    expect(orangeMatches.map((match) => match.id)).not.toContain(103); // Mandarino di Sicilia: greenMandarin/bloodOrange only
    expect(orangeMatches.map((match) => match.id)).not.toContain(305); // Orange X Santal: bitterOrange only

    const mandarinOrangeMatches = getNoteExplorerMatches({ catalogPerfumes: catalogFragrances, noteId: "mandarinOrange" });
    expect(mandarinOrangeMatches.map((match) => match.id)).not.toContain(100); // Arancia di Capri: sicilianMandarin only
    expect(mandarinOrangeMatches.map((match) => match.id)).not.toContain(401); // Silver Mountain Water: mandarin (generic) only

    const muskMatches = getNoteExplorerMatches({ catalogPerfumes: catalogFragrances, noteId: "musk" });
    expect(muskMatches.map((match) => match.id)).not.toContain(1); // Acqua di Gio EDT: whiteMusk only
    expect(muskMatches.map((match) => match.id)).not.toContain(27); // Touch for Men: whiteMusk only
    expect(muskMatches.map((match) => match.id)).not.toContain(302); // Allure Homme Sport Superleggera: whiteMusk only
  });
});

// Composer Phase 3E: horizontal note-family calibration regression for the
// sandalwood and patchouli canonical-key families, run against the real
// catalog. The underlying data (taxonomy audit, canonical-data sanity
// audit, exact scores, unrelated-value preservation, pyramid immutability)
// is proven in packages/catalog/tests/noteProminenceHorizontalCalibration3E.test.js;
// this describe block only proves the existing, unmodified sort algorithm
// produces the approved relative order per canonical key -- scored
// fragrances sort descending, ties preserve catalog order, unscored
// members trail after every scored one, and sandalwood/australianSandalwood
// (and patchouli/patchouliNoir) never cross-rank against each other.
describe("Note Explorer 'Most prominent' sort reflects the Phase 3E calibrated order, per distinct canonical key", () => {
  it("sandalwood (22 members): Allure Homme Edition Blanche EDP > Polo Black > Legend Blue, then all 19 unscored members trail in catalog order", () => {
    const matches = getNoteExplorerMatches({ catalogPerfumes: catalogFragrances, noteId: "sandalwood" });
    expect(matches.map((match) => match.id).sort((a, b) => a - b)).toEqual([
      4, 5, 6, 9, 12, 15, 22, 29, 32, 107, 112, 115, 208, 214, 301, 302, 401, 402, 404, 405, 407, 410,
    ]);

    const sorted = sortNoteExplorerMatchesByProminence(matches, "sandalwood");
    expect(sorted.map((match) => match.id)).toEqual([
      301, 15, 22, 4, 5, 6, 9, 12, 32, 29, 107, 112, 115, 208, 214, 302, 401, 402, 404, 405, 407, 410,
    ]);

    const rank = new Map(sorted.map((match, index) => [match.id, index]));
    const lastScoredRank = rank.get(22);
    expect(rank.get(4)).toBeGreaterThan(lastScoredRank); // an unscored member trails every scored one
  });

  it("australianSandalwood: only Orange X Santal carries it", () => {
    const matches = getNoteExplorerMatches({ catalogPerfumes: catalogFragrances, noteId: "australianSandalwood" });
    expect(matches.map((match) => match.id)).toEqual([305]);

    const sorted = sortNoteExplorerMatchesByProminence(matches, "australianSandalwood");
    expect(sorted.map((match) => match.id)).toEqual([305]);
  });

  it("patchouli (33 members): Tuxedo's defining score leads, down through Terre d'Hermès EDT's Phase 3E addition, then 18 unscored members trail in catalog order", () => {
    const matches = getNoteExplorerMatches({ catalogPerfumes: catalogFragrances, noteId: "patchouli" });
    expect(matches.map((match) => match.id).sort((a, b) => a - b)).toEqual([
      1, 2, 6, 15, 16, 17, 19, 21, 25, 29, 33, 101, 103, 109, 110, 111, 115, 205, 206, 207, 208, 209, 211, 302, 303,
      304, 306, 402, 403, 404, 406, 410, 501,
    ]);

    const sorted = sortNoteExplorerMatchesByProminence(matches, "patchouli");
    expect(sorted.map((match) => match.id)).toEqual([
      501, 306, 205, 206, 209, 410, 21, 33, 109, 110, 111, 2, 25, 101, 406, 1, 6, 15, 16, 17, 19, 29, 103, 115, 207,
      208, 211, 302, 303, 304, 402, 403, 404,
    ]);

    // Light Blue Pour Homme EDT (2) and Terre d'Hermès EDT (111) are the
    // two Phase 3E additions, each scored independently and correctly
    // outranked by every already-established higher score.
    const rank = new Map(sorted.map((match, index) => [match.id, index]));
    expect(rank.get(2)).toBeLessThan(rank.get(1));
    expect(rank.get(111)).toBeLessThan(rank.get(115));
  });

  it("never cross-matches distinct sandalwood/patchouli variants -- searching one canonical key never returns a fragrance whose only relevant note is a different variant", () => {
    const sandalwoodMatches = getNoteExplorerMatches({ catalogPerfumes: catalogFragrances, noteId: "sandalwood" });
    expect(sandalwoodMatches.map((match) => match.id)).not.toContain(305); // Orange X Santal: australianSandalwood only

    const patchouliMatches = getNoteExplorerMatches({ catalogPerfumes: catalogFragrances, noteId: "patchouli" });
    // patchouliNoir has zero catalog membership, so there is no
    // fragrance to assert an exclusion for -- confirmed in
    // noteProminenceHorizontalCalibration3E.test.js instead.
    expect(patchouliMatches.map((match) => match.id)).toContain(501); // Tuxedo genuinely carries generic patchouli
  });
});

// Composer Phase 3F: horizontal note-family calibration regression for the
// vetiver and amber canonical-key families, run against the real catalog.
// The underlying data (taxonomy audit, canonical-data sanity audit, exact
// scores, canonical-pyramid immutability) is proven in
// packages/catalog/tests/noteProminenceHorizontalCalibration3F.test.js;
// this describe block only proves the existing, unmodified sort algorithm
// produces the approved relative order per canonical key -- scored
// fragrances sort descending, ties preserve catalog order, unscored
// members trail after every scored one, and vetiver/haitianVetiver never
// cross-rank against each other. Phase 3F changed zero prominence values,
// so every order below is identical to the pre-Phase-3F catalog.
describe("Note Explorer 'Most prominent' sort reflects the Phase 3F calibrated order, per distinct canonical key", () => {
  it("vetiver (22 members): Terre d'Hermès EDT leads, down through 3 tied members at score 6, then 14 unscored members trail in catalog order", () => {
    const matches = getNoteExplorerMatches({ catalogPerfumes: catalogFragrances, noteId: "vetiver" });
    expect(matches.map((match) => match.id).sort((a, b) => a - b)).toEqual([
      9, 10, 11, 12, 17, 27, 34, 101, 108, 109, 111, 117, 118, 203, 206, 210, 211, 213, 301, 303, 306, 407,
    ]);

    const sorted = sortNoteExplorerMatchesByProminence(matches, "vetiver");
    expect(sorted.map((match) => match.id)).toEqual([
      111, 34, 206, 210, 9, 27, 306, 118, 10, 11, 12, 17, 101, 108, 109, 117, 203, 211, 213, 301, 303, 407,
    ]);

    // 34, 206, and 210 tie at score 6 -- the sort preserves their
    // ascending catalog-array order (34 before 206 before 210) rather
    // than forcing an artificial rank difference.
    const rank = new Map(sorted.map((match, index) => [match.id, index]));
    expect(rank.get(34)).toBeLessThan(rank.get(206));
    expect(rank.get(206)).toBeLessThan(rank.get(210));
    const lastScoredRank = rank.get(118);
    expect(rank.get(10)).toBeGreaterThan(lastScoredRank); // an unscored member trails every scored one
  });

  it("haitianVetiver: only Montblanc Explorer (scored) and Sauvage Elixir (unscored) carry it", () => {
    const matches = getNoteExplorerMatches({ catalogPerfumes: catalogFragrances, noteId: "haitianVetiver" });
    expect(matches.map((match) => match.id).sort((a, b) => a - b)).toEqual([25, 402]);

    const sorted = sortNoteExplorerMatchesByProminence(matches, "haitianVetiver");
    expect(sorted.map((match) => match.id)).toEqual([25, 402]); // scored (25) leads, unscored (402) trails
  });

  it("amber (26 members): The One for Men EDP and F by Ferragamo Black tie for the lead, down through 7 tied members at score 5, then 17 unscored members trail in catalog order", () => {
    const matches = getNoteExplorerMatches({ catalogPerfumes: catalogFragrances, noteId: "amber" });
    expect(matches.map((match) => match.id).sort((a, b) => a - b)).toEqual([
      1, 3, 5, 12, 13, 14, 20, 26, 28, 31, 32, 101, 107, 112, 114, 116, 119, 201, 208, 209, 214, 302, 402, 405, 407,
      410,
    ]);

    const sorted = sortNoteExplorerMatchesByProminence(matches, "amber");
    expect(sorted.map((match) => match.id)).toEqual([
      13, 20, 32, 26, 28, 31, 208, 209, 302, 1, 3, 5, 12, 14, 101, 119, 107, 112, 114, 116, 201, 214, 402, 405, 407,
      410,
    ]);

    // 13 and 20 tie at score 6, and 32/26/28/31/208/209/302 tie at score 5
    // -- the sort preserves ascending catalog-array order within each tie
    // group rather than forcing an artificial rank difference.
    const rank = new Map(sorted.map((match, index) => [match.id, index]));
    expect(rank.get(13)).toBeLessThan(rank.get(20));
    expect(rank.get(32)).toBeLessThan(rank.get(26));
    expect(rank.get(26)).toBeLessThan(rank.get(28));
    expect(rank.get(28)).toBeLessThan(rank.get(31));
    expect(rank.get(31)).toBeLessThan(rank.get(208));
    expect(rank.get(208)).toBeLessThan(rank.get(209));
    expect(rank.get(209)).toBeLessThan(rank.get(302));
    const lastScoredRank = rank.get(302);
    expect(rank.get(1)).toBeGreaterThan(lastScoredRank); // an unscored member trails every scored one
  });

  it("never cross-matches distinct vetiver variants, and never treats an amber-adjacent material as the canonical amber key -- searching one canonical key never returns a fragrance whose only relevant note is a different variant", () => {
    const vetiverMatches = getNoteExplorerMatches({ catalogPerfumes: catalogFragrances, noteId: "vetiver" });
    expect(vetiverMatches.map((match) => match.id)).not.toContain(25); // Montblanc Explorer: haitianVetiver only
    expect(vetiverMatches.map((match) => match.id)).not.toContain(402); // Sauvage Elixir: haitianVetiver only

    const haitianVetiverMatches = getNoteExplorerMatches({ catalogPerfumes: catalogFragrances, noteId: "haitianVetiver" });
    expect(haitianVetiverMatches.map((match) => match.id)).not.toContain(111); // Terre d'Hermès EDT: generic vetiver only

    const amberMatches = getNoteExplorerMatches({ catalogPerfumes: catalogFragrances, noteId: "amber" });
    expect(amberMatches.map((match) => match.id)).not.toContain(202); // Sauvage EDP: ambroxan only
    expect(amberMatches.map((match) => match.id)).not.toContain(19); // Club de Nuit Intense Man: ambergris only
    expect(amberMatches.map((match) => match.id)).not.toContain(8); // The Most Wanted: amberwood only
    expect(amberMatches.map((match) => match.id)).not.toContain(404); // Layton: ambermax only
    expect(amberMatches.map((match) => match.id)).not.toContain(102); // Fico di Amalfi: benzoin only
    expect(amberMatches.map((match) => match.id)).not.toContain(403); // Carlisle: opoponax only
    expect(amberMatches.map((match) => match.id)).not.toContain(113); // Le Male Le Parfum: orientalNotes only
  });
});

// Composer Phase 3G: horizontal note-family calibration regression for the
// iris and leather canonical-key families, run against the real catalog.
// The underlying data (taxonomy audit, canonical-data sanity audit, exact
// scores, unrelated-value preservation, pyramid immutability) is proven in
// packages/catalog/tests/noteProminenceHorizontalCalibration3G.test.js;
// this describe block only proves the existing, unmodified sort algorithm
// produces the approved relative order per canonical key -- scored
// fragrances sort descending, ties preserve catalog order, unscored
// members trail after every scored one, and leather/suede never cross-
// rank against each other.
describe("Note Explorer 'Most prominent' sort reflects the Phase 3G calibrated order, per distinct canonical key", () => {
  it("iris (7 members): Prada L'Homme leads, down through 2 tied members at score 6, then 2 unscored members trail in catalog order", () => {
    const matches = getNoteExplorerMatches({ catalogPerfumes: catalogFragrances, noteId: "iris" });
    expect(matches.map((match) => match.id).sort((a, b) => a - b)).toEqual([33, 112, 113, 205, 208, 214, 405]);

    const sorted = sortNoteExplorerMatchesByProminence(matches, "iris");
    expect(sorted.map((match) => match.id)).toEqual([208, 205, 214, 405, 113, 33, 112]);

    // 214 and 405 tie at score 6 -- the sort preserves their ascending
    // catalog-array order rather than forcing an artificial rank
    // difference.
    const rank = new Map(sorted.map((match, index) => [match.id, index]));
    expect(rank.get(214)).toBeLessThan(rank.get(405));
    const lastScoredRank = rank.get(113);
    expect(rank.get(33)).toBeGreaterThan(lastScoredRank); // an unscored member trails every scored one
  });

  it("leather (12 members): Vibrant Leather Bogoss's Phase 3G addition leads, down through several tied groups, then 2 unscored members trail in catalog order", () => {
    const matches = getNoteExplorerMatches({ catalogPerfumes: catalogFragrances, noteId: "leather" });
    expect(matches.map((match) => match.id).sort((a, b) => a - b)).toEqual([
      6, 7, 10, 12, 14, 16, 23, 25, 30, 109, 115, 306,
    ]);

    const sorted = sortNoteExplorerMatchesByProminence(matches, "leather");
    expect(sorted.map((match) => match.id)).toEqual([30, 7, 12, 25, 14, 16, 109, 23, 306, 10, 6, 115]);

    // Vibrant Leather Bogoss (30) now leads the whole family at its raised
    // score of 9 -- the sole Phase 3G change. 12 and 25 tie at score 7,
    // and 14/16/109 tie at score 6 -- the sort preserves ascending
    // catalog-array order within each tie group.
    const rank = new Map(sorted.map((match, index) => [match.id, index]));
    expect(rank.get(30)).toBe(0);
    expect(rank.get(12)).toBeLessThan(rank.get(25));
    expect(rank.get(14)).toBeLessThan(rank.get(16));
    expect(rank.get(16)).toBeLessThan(rank.get(109));
    const lastScoredRank = rank.get(10);
    expect(rank.get(6)).toBeGreaterThan(lastScoredRank); // an unscored member trails every scored one
  });

  it("suede: only CH Men and Guess Man Gold carry it, each scored independently of the fragrance's own generic leather value", () => {
    const matches = getNoteExplorerMatches({ catalogPerfumes: catalogFragrances, noteId: "suede" });
    expect(matches.map((match) => match.id).sort((a, b) => a - b)).toEqual([12, 32]);

    const sorted = sortNoteExplorerMatchesByProminence(matches, "suede");
    expect(sorted.map((match) => match.id)).toEqual([12, 32]);
  });

  it("never cross-matches distinct leather variants -- searching one canonical key never returns a fragrance whose only relevant note is a different variant (iris has no other in-catalog variant to guard against)", () => {
    const leatherMatches = getNoteExplorerMatches({ catalogPerfumes: catalogFragrances, noteId: "leather" });
    expect(leatherMatches.map((match) => match.id)).not.toContain(32); // Guess Man Gold: suede only

    const suedeMatches = getNoteExplorerMatches({ catalogPerfumes: catalogFragrances, noteId: "suede" });
    expect(suedeMatches.map((match) => match.id)).not.toContain(30); // Vibrant Leather Bogoss: generic leather only
    expect(suedeMatches.map((match) => match.id)).toContain(12); // CH Men genuinely carries both, independently scored
  });
});

// Composer Phase 3H: horizontal note-family calibration regression for the
// tobacco and coffee canonical-key families, run against the real
// catalog. The underlying data (taxonomy audit, canonical-data sanity
// audit, exact scores, canonical-pyramid immutability) is proven in
// packages/catalog/tests/noteProminenceHorizontalCalibration3H.test.js;
// this describe block only proves the existing, unmodified sort algorithm
// produces the approved relative order per canonical key -- scored
// fragrances sort descending, and tobacco/roastedCoffeeBeans never
// cross-rank against each other. Phase 3H changed zero prominence values
// (both families were already fully scored, with no unscored member and
// no tie to guard order for), so every order below is identical to the
// pre-Phase-3H catalog.
describe("Note Explorer 'Most prominent' sort reflects the Phase 3H calibrated order, per distinct canonical key", () => {
  it("tobacco (3 members, all scored): Spicebomb Extreme leads, down through The One for Men EDP, then Born In Roma Coral Fantasy", () => {
    const matches = getNoteExplorerMatches({ catalogPerfumes: catalogFragrances, noteId: "tobacco" });
    expect(matches.map((match) => match.id).sort((a, b) => a - b)).toEqual([13, 211, 212]);

    const sorted = sortNoteExplorerMatchesByProminence(matches, "tobacco");
    expect(sorted.map((match) => match.id)).toEqual([212, 13, 211]);
  });

  it("roastedCoffeeBeans (2 members, both scored): Uomo Signature leads, then Polo Red EDT", () => {
    const matches = getNoteExplorerMatches({ catalogPerfumes: catalogFragrances, noteId: "roastedCoffeeBeans" });
    expect(matches.map((match) => match.id).sort((a, b) => a - b)).toEqual([16, 26]);

    const sorted = sortNoteExplorerMatchesByProminence(matches, "roastedCoffeeBeans");
    expect(sorted.map((match) => match.id)).toEqual([16, 26]);
  });

  it("never cross-matches tobacco and roastedCoffeeBeans -- no fragrance carries both, and searching one canonical key never returns the other's member", () => {
    const tobaccoMatches = getNoteExplorerMatches({ catalogPerfumes: catalogFragrances, noteId: "tobacco" });
    expect(tobaccoMatches.map((match) => match.id)).not.toContain(16); // Uomo Signature: roastedCoffeeBeans only
    expect(tobaccoMatches.map((match) => match.id)).not.toContain(26); // Polo Red EDT: roastedCoffeeBeans only

    const coffeeMatches = getNoteExplorerMatches({ catalogPerfumes: catalogFragrances, noteId: "roastedCoffeeBeans" });
    expect(coffeeMatches.map((match) => match.id)).not.toContain(13); // The One for Men EDP: tobacco only
    expect(coffeeMatches.map((match) => match.id)).not.toContain(211); // Born In Roma Coral Fantasy: tobacco only
    expect(coffeeMatches.map((match) => match.id)).not.toContain(212); // Spicebomb Extreme: tobacco only
  });
});

// Composer Phase 3I: horizontal note-family calibration regression for the
// rose and jasmine canonical-key families, run against the real catalog.
// The underlying data (taxonomy audit, canonical-data sanity audit, exact
// scores, canonical-pyramid immutability) is proven in
// packages/catalog/tests/noteProminenceHorizontalCalibration3I.test.js;
// this describe block only proves the existing, unmodified sort algorithm
// produces the approved relative order per canonical key -- scored
// fragrances sort descending, ties preserve catalog order, unscored
// members trail after every scored one, and rose/roseDeMai never
// cross-rank against each other. Phase 3I changed zero prominence values,
// so every order below is identical to the pre-Phase-3I catalog.
describe("Note Explorer 'Most prominent' sort reflects the Phase 3I calibrated order, per distinct canonical key", () => {
  it("rose (10 members): Mefisto is the sole scored member, then 9 unscored members trail in catalog order", () => {
    const matches = getNoteExplorerMatches({ catalogPerfumes: catalogFragrances, noteId: "rose" });
    expect(matches.map((match) => match.id).sort((a, b) => a - b)).toEqual([1, 4, 9, 19, 29, 101, 119, 403, 405, 501]);

    const sorted = sortNoteExplorerMatchesByProminence(matches, "rose");
    expect(sorted.map((match) => match.id)).toEqual([405, 1, 4, 9, 19, 29, 101, 119, 403, 501]);

    const rank = new Map(sorted.map((match, index) => [match.id, index]));
    expect(rank.get(405)).toBe(0);
    expect(rank.get(1)).toBeGreaterThan(rank.get(405)); // an unscored member trails the sole scored one
  });

  it("roseDeMai: only Versace Pour Homme carries it, and it remains unscored", () => {
    const matches = getNoteExplorerMatches({ catalogPerfumes: catalogFragrances, noteId: "roseDeMai" });
    expect(matches.map((match) => match.id)).toEqual([3]);

    const sorted = sortNoteExplorerMatchesByProminence(matches, "roseDeMai");
    expect(sorted.map((match) => match.id)).toEqual([3]);
  });

  it("jasmine (14 members): 3 tied members at score 5 lead, down through 2 more scored members, then 10 unscored members trail in catalog order", () => {
    const matches = getNoteExplorerMatches({ catalogPerfumes: catalogFragrances, noteId: "jasmine" });
    expect(matches.map((match) => match.id).sort((a, b) => a - b)).toEqual([
      1, 9, 12, 19, 23, 101, 102, 115, 119, 404, 406, 407, 408, 409,
    ]);

    const sorted = sortNoteExplorerMatchesByProminence(matches, "jasmine");
    expect(sorted.map((match) => match.id)).toEqual([1, 101, 409, 23, 9, 12, 19, 102, 119, 115, 404, 406, 407, 408]);

    // 1, 101, and 409 tie at score 5 -- the sort preserves their
    // ascending catalog-array order rather than forcing an artificial
    // rank difference.
    const rank = new Map(sorted.map((match, index) => [match.id, index]));
    expect(rank.get(1)).toBeLessThan(rank.get(101));
    expect(rank.get(101)).toBeLessThan(rank.get(409));
    const lastScoredRank = rank.get(23);
    expect(rank.get(9)).toBeGreaterThan(lastScoredRank); // an unscored member trails every scored one
  });

  it("never cross-matches rose and roseDeMai -- searching one canonical key never returns a fragrance whose only relevant note is a different variant", () => {
    const roseMatches = getNoteExplorerMatches({ catalogPerfumes: catalogFragrances, noteId: "rose" });
    expect(roseMatches.map((match) => match.id)).not.toContain(3); // Versace Pour Homme: roseDeMai only

    const roseDeMaiMatches = getNoteExplorerMatches({ catalogPerfumes: catalogFragrances, noteId: "roseDeMai" });
    expect(roseDeMaiMatches.map((match) => match.id)).not.toContain(405); // Mefisto: generic rose only
  });
});

// Composer Phase 3J: horizontal note-family calibration regression for the
// tonka bean and lavender canonical-key families, run against the real
// catalog. The underlying data (taxonomy audit, canonical-data sanity
// audit, exact scores, unrelated-value preservation, pyramid immutability)
// is proven in packages/catalog/tests/noteProminenceHorizontalCalibration3J.test.js;
// this describe block only proves the existing, unmodified sort algorithm
// produces the approved relative order per canonical key -- scored
// fragrances sort descending, ties preserve catalog order, and unscored
// members trail after every scored one.
describe("Note Explorer 'Most prominent' sort reflects the Phase 3J calibrated order, per distinct canonical key", () => {
  it("tonkaBean (22 members): Armani Code EDT leads, down through several tied groups, then 6 unscored members trail in catalog order", () => {
    const matches = getNoteExplorerMatches({ catalogPerfumes: catalogFragrances, noteId: "tonkaBean" });
    expect(matches.map((match) => match.id).sort((a, b) => a - b)).toEqual([
      3, 4, 5, 10, 11, 15, 16, 20, 21, 24, 27, 29, 104, 112, 116, 117, 203, 205, 213, 304, 403, 409,
    ]);

    const sorted = sortNoteExplorerMatchesByProminence(matches, "tonkaBean");
    expect(sorted.map((match) => match.id)).toEqual([
      104, 4, 10, 11, 16, 304, 5, 20, 29, 112, 116, 117, 403, 15, 24, 409, 3, 21, 27, 203, 205, 213,
    ]);

    // 4/10/11/16/304 tie at score 6, 5/20/29/112/116/117 tie at score 5,
    // and 15/24/409 tie at score 4 -- the sort preserves ascending
    // catalog-array order within each tie group rather than forcing an
    // artificial rank difference.
    const rank = new Map(sorted.map((match, index) => [match.id, index]));
    expect(rank.get(4)).toBeLessThan(rank.get(10));
    expect(rank.get(10)).toBeLessThan(rank.get(11));
    expect(rank.get(11)).toBeLessThan(rank.get(16));
    expect(rank.get(16)).toBeLessThan(rank.get(304));
    expect(rank.get(5)).toBeLessThan(rank.get(20));
    expect(rank.get(20)).toBeLessThan(rank.get(29));
    expect(rank.get(15)).toBeLessThan(rank.get(24));
    expect(rank.get(24)).toBeLessThan(rank.get(409));
    const lastScoredRank = rank.get(409);
    expect(rank.get(3)).toBeGreaterThan(lastScoredRank); // an unscored member trails every scored one
  });

  it("lavender (29 members): Le Male and Layton tie for the lead at 9 (Layton's Phase 3J addition), down through several tied groups, then 22 unscored members trail in catalog order", () => {
    const matches = getNoteExplorerMatches({ catalogPerfumes: catalogFragrances, noteId: "lavender" });
    expect(matches.map((match) => match.id).sort((a, b) => a - b)).toEqual([
      4, 5, 7, 14, 20, 21, 22, 31, 32, 33, 34, 104, 106, 107, 108, 113, 114, 116, 118, 202, 205, 206, 211, 212, 306,
      402, 404, 405, 408,
    ]);

    const sorted = sortNoteExplorerMatchesByProminence(matches, "lavender");
    expect(sorted.map((match) => match.id)).toEqual([
      5, 404, 4, 20, 104, 113, 118, 7, 14, 32, 21, 22, 31, 33, 34, 106, 107, 108, 114, 116, 202, 205, 206, 211, 212,
      306, 402, 405, 408,
    ]);

    // Le Male (5) and Layton (404) tie at score 9 -- Layton's Phase 3J
    // addition -- preserving ascending catalog-array order (5 before
    // 404) rather than forcing an artificial rank difference. 4 and 20
    // tie at score 7.
    const rank = new Map(sorted.map((match, index) => [match.id, index]));
    expect(rank.get(5)).toBeLessThan(rank.get(404));
    expect(rank.get(4)).toBeLessThan(rank.get(20));
    const lastScoredRank = rank.get(118);
    expect(rank.get(7)).toBeGreaterThan(lastScoredRank); // an unscored member trails every scored one
  });

  it("never treats an adjacent aromatic herb as lavender, despite sharing lavender's own family: \"aromatic\" tag -- searching lavender never returns a fragrance whose only relevant note is a different herb", () => {
    const lavenderMatches = getNoteExplorerMatches({ catalogPerfumes: catalogFragrances, noteId: "lavender" });
    expect(lavenderMatches.map((match) => match.id)).not.toContain(15); // Polo Black: sage only, no lavender
    expect(lavenderMatches.map((match) => match.id)).not.toContain(9); // Fierce: rosemary only, no lavender
  });
});

// Composer Phase 3K: horizontal note-family calibration regression for the
// cardamom and cinnamon canonical-key families, run against the real
// catalog. The underlying data (taxonomy audit, canonical-data sanity
// audit, exact scores, canonical-pyramid immutability) is proven in
// packages/catalog/tests/noteProminenceHorizontalCalibration3K.test.js;
// this describe block only proves the existing, unmodified sort algorithm
// produces the approved relative order per canonical key -- scored
// fragrances sort descending, ties preserve catalog order, and unscored
// members trail after every scored one. Phase 3K changed zero prominence
// values, so every order below is identical to the pre-Phase-3K catalog.
describe("Note Explorer 'Most prominent' sort reflects the Phase 3K calibrated order, per distinct canonical key", () => {
  it("cardamom (18 members): La Nuit de L'Homme leads, down through a 3-way tie, then 11 unscored members trail in catalog order", () => {
    const matches = getNoteExplorerMatches({ catalogPerfumes: catalogFragrances, noteId: "cardamom" });
    expect(matches.map((match) => match.id).sort((a, b) => a - b)).toEqual([
      5, 8, 9, 13, 16, 18, 24, 31, 34, 100, 109, 113, 118, 206, 208, 211, 402, 404,
    ]);

    const sorted = sortNoteExplorerMatchesByProminence(matches, "cardamom");
    expect(sorted.map((match) => match.id)).toEqual([
      118, 8, 113, 13, 24, 31, 404, 5, 9, 16, 18, 34, 100, 109, 206, 208, 211, 402,
    ]);

    // 13, 24, and 31 tie at score 5 -- the sort preserves ascending
    // catalog-array order rather than forcing an artificial rank
    // difference.
    const rank = new Map(sorted.map((match, index) => [match.id, index]));
    expect(rank.get(13)).toBeLessThan(rank.get(24));
    expect(rank.get(24)).toBeLessThan(rank.get(31));
    const lastScoredRank = rank.get(404);
    expect(rank.get(5)).toBeGreaterThan(lastScoredRank); // an unscored member trails every scored one
  });

  it("cinnamon (8 members): Divine Vanille and Sauvage Elixir tie for the lead, down through a 3-way tie, then 2 unscored members trail in catalog order", () => {
    const matches = getNoteExplorerMatches({ catalogPerfumes: catalogFragrances, noteId: "cinnamon" });
    expect(matches.map((match) => match.id).sort((a, b) => a - b)).toEqual([5, 14, 16, 21, 205, 212, 304, 402]);

    const sorted = sortNoteExplorerMatchesByProminence(matches, "cinnamon");
    expect(sorted.map((match) => match.id)).toEqual([304, 402, 212, 14, 16, 21, 5, 205]);

    // 304 and 402 tie at score 7, and 14/16/21 tie at score 5 -- the sort
    // preserves ascending catalog-array order within each tie group.
    const rank = new Map(sorted.map((match, index) => [match.id, index]));
    expect(rank.get(304)).toBeLessThan(rank.get(402));
    expect(rank.get(14)).toBeLessThan(rank.get(16));
    expect(rank.get(16)).toBeLessThan(rank.get(21));
    const lastScoredRank = rank.get(21);
    expect(rank.get(5)).toBeGreaterThan(lastScoredRank); // an unscored member trails every scored one
  });

  it("never treats an adjacent warm spice as cardamom or cinnamon, despite several sharing their own family: \"spicy\" tag -- searching one canonical key never returns a fragrance whose only relevant note is a different spice", () => {
    const cardamomMatches = getNoteExplorerMatches({ catalogPerfumes: catalogFragrances, noteId: "cardamom" });
    expect(cardamomMatches.map((match) => match.id)).not.toContain(1); // Acqua di Gio EDT: nutmeg only
    expect(cardamomMatches.map((match) => match.id)).not.toContain(20); // F by Ferragamo Black: blackPepper only

    const cinnamonMatches = getNoteExplorerMatches({ catalogPerfumes: catalogFragrances, noteId: "cinnamon" });
    expect(cinnamonMatches.map((match) => match.id)).not.toContain(101); // Essenza: cloves only
    expect(cinnamonMatches.map((match) => match.id)).not.toContain(20); // F by Ferragamo Black: blackPepper only
  });
});

// Composer Phase 3L: horizontal note-family calibration regression for the
// pepper canonical-key families, run against the real catalog. The
// underlying data (taxonomy audit, canonical-data sanity audit, exact
// scores, canonical-pyramid immutability) is proven in
// packages/catalog/tests/noteProminenceHorizontalCalibration3L.test.js;
// this describe block only proves the existing, unmodified sort algorithm
// produces the approved relative order per canonical key -- scored
// fragrances sort descending, ties preserve catalog order, and unscored
// members trail after every scored one. Phase 3L changed zero prominence
// values, so every order below is identical to the pre-Phase-3L catalog.
describe("Note Explorer 'Most prominent' sort reflects the Phase 3L calibrated order, per distinct canonical pepper key", () => {
  it("pepper (4 members): Terre d'Hermès EDT is the sole scored member, then 3 unscored members trail in catalog order", () => {
    const matches = getNoteExplorerMatches({ catalogPerfumes: catalogFragrances, noteId: "pepper" });
    expect(matches.map((match) => match.id).sort((a, b) => a - b)).toEqual([29, 34, 111, 404]);

    const sorted = sortNoteExplorerMatchesByProminence(matches, "pepper");
    expect(sorted.map((match) => match.id)).toEqual([111, 29, 34, 404]);

    const rank = new Map(sorted.map((match, index) => [match.id, index]));
    expect(rank.get(111)).toBe(0);
    expect(rank.get(29)).toBeGreaterThan(rank.get(111)); // an unscored member trails the sole scored one
  });

  it("blackPepper (10 members): Spicebomb Extreme is the sole scored member, then 9 unscored members trail in catalog order", () => {
    const matches = getNoteExplorerMatches({ catalogPerfumes: catalogFragrances, noteId: "blackPepper" });
    expect(matches.map((match) => match.id).sort((a, b) => a - b)).toEqual([20, 21, 29, 33, 114, 205, 208, 212, 304, 501]);

    const sorted = sortNoteExplorerMatchesByProminence(matches, "blackPepper");
    expect(sorted.map((match) => match.id)).toEqual([212, 20, 21, 29, 33, 114, 205, 208, 304, 501]);

    const rank = new Map(sorted.map((match, index) => [match.id, index]));
    expect(rank.get(212)).toBe(0);
    expect(rank.get(20)).toBeGreaterThan(rank.get(212)); // an unscored member trails the sole scored one
  });

  it("pinkPepper (12 members): Polo Blue Parfum leads, down through a tie, then 9 unscored members trail in catalog order", () => {
    const matches = getNoteExplorerMatches({ catalogPerfumes: catalogFragrances, noteId: "pinkPepper" });
    expect(matches.map((match) => match.id).sort((a, b) => a - b)).toEqual([
      16, 17, 25, 102, 107, 108, 116, 201, 203, 204, 206, 500,
    ]);

    const sorted = sortNoteExplorerMatchesByProminence(matches, "pinkPepper");
    expect(sorted.map((match) => match.id)).toEqual([206, 17, 116, 16, 25, 102, 107, 108, 201, 203, 204, 500]);

    // 17 and 116 tie at score 4 -- the sort preserves ascending
    // catalog-array order rather than forcing an artificial rank
    // difference.
    const rank = new Map(sorted.map((match, index) => [match.id, index]));
    expect(rank.get(17)).toBeLessThan(rank.get(116));
    const lastScoredRank = rank.get(116);
    expect(rank.get(16)).toBeGreaterThan(lastScoredRank); // an unscored member trails every scored one
  });

  it("sichuanPepper: Sauvage EDP (scored) leads, Tous Man (unscored) trails", () => {
    const matches = getNoteExplorerMatches({ catalogPerfumes: catalogFragrances, noteId: "sichuanPepper" });
    expect(matches.map((match) => match.id).sort((a, b) => a - b)).toEqual([28, 202]);

    const sorted = sortNoteExplorerMatchesByProminence(matches, "sichuanPepper");
    expect(sorted.map((match) => match.id)).toEqual([202, 28]);
  });

  it("whitePepper (3 members, all unscored): preserves catalog order with no forced ranking", () => {
    const matches = getNoteExplorerMatches({ catalogPerfumes: catalogFragrances, noteId: "whitePepper" });
    expect(matches.map((match) => match.id).sort((a, b) => a - b)).toEqual([27, 32, 117]);

    const sorted = sortNoteExplorerMatchesByProminence(matches, "whitePepper");
    expect(sorted.map((match) => match.id)).toEqual([32, 27, 117]);
  });

  it("never cross-matches distinct pepper variants, or treats an adjacent spice as a pepper variant -- searching one canonical pepper key never returns a fragrance whose only relevant note is a different variant or spice", () => {
    const pinkPepperMatches = getNoteExplorerMatches({ catalogPerfumes: catalogFragrances, noteId: "pinkPepper" });
    expect(pinkPepperMatches.map((match) => match.id)).not.toContain(33); // Jaguar Pace: blackPepper only
    expect(pinkPepperMatches.map((match) => match.id)).not.toContain(28); // Tous Man: sichuanPepper only

    const blackPepperMatches = getNoteExplorerMatches({ catalogPerfumes: catalogFragrances, noteId: "blackPepper" });
    expect(blackPepperMatches.map((match) => match.id)).not.toContain(500); // Squid: pinkPepper only
    expect(blackPepperMatches.map((match) => match.id)).not.toContain(32); // Guess Man Gold: whitePepper only
    expect(blackPepperMatches.map((match) => match.id)).not.toContain(118); // La Nuit de L'Homme: cardamom only, no pepper key
    expect(blackPepperMatches.map((match) => match.id)).not.toContain(1); // Acqua di Gio EDT: nutmeg only, no pepper key

    const whitePepperMatches = getNoteExplorerMatches({ catalogPerfumes: catalogFragrances, noteId: "whitePepper" });
    expect(whitePepperMatches.map((match) => match.id)).not.toContain(33); // Jaguar Pace: blackPepper only
  });
});

// Composer Phase 3M: horizontal note-family calibration regression for the
// ginger, nutmeg, and clove canonical-key families, run against the real
// catalog. The underlying data (taxonomy audit, canonical-data sanity
// audit, exact scores, canonical-pyramid immutability) is proven in
// packages/catalog/tests/noteProminenceHorizontalCalibration3M.test.js;
// this describe block only proves the existing, unmodified sort algorithm
// produces the approved relative order per canonical key -- scored
// fragrances sort descending, ties preserve catalog order, and unscored
// members trail after every scored one. Phase 3M changed zero prominence
// values, so every order below is identical to the pre-Phase-3M catalog.
describe("Note Explorer 'Most prominent' sort reflects the Phase 3M calibrated order, per distinct canonical key", () => {
  it("ginger (9 members): The Scent EDT leads, down through a tie, then 6 unscored members trail in catalog order", () => {
    const matches = getNoteExplorerMatches({ catalogPerfumes: catalogFragrances, noteId: "ginger" });
    expect(matches.map((match) => match.id).sort((a, b) => a - b)).toEqual([7, 13, 28, 32, 112, 117, 210, 213, 214]);

    const sorted = sortNoteExplorerMatchesByProminence(matches, "ginger");
    expect(sorted.map((match) => match.id)).toEqual([7, 117, 213, 13, 32, 28, 112, 214, 210]);

    // 117 and 213 tie at score 6 -- the sort preserves ascending
    // catalog-array order rather than forcing an artificial rank
    // difference.
    const rank = new Map(sorted.map((match, index) => [match.id, index]));
    expect(rank.get(117)).toBeLessThan(rank.get(213));
    const lastScoredRank = rank.get(213);
    expect(rank.get(13)).toBeGreaterThan(lastScoredRank); // an unscored member trails every scored one
  });

  it("nutmeg (9 members): Sauvage Elixir is the sole scored member, then 8 unscored members trail in catalog order", () => {
    const matches = getNoteExplorerMatches({ catalogPerfumes: catalogFragrances, noteId: "nutmeg" });
    expect(matches.map((match) => match.id).sort((a, b) => a - b)).toEqual([1, 12, 17, 27, 32, 202, 306, 402, 403]);

    const sorted = sortNoteExplorerMatchesByProminence(matches, "nutmeg");
    expect(sorted.map((match) => match.id)).toEqual([402, 1, 12, 17, 32, 27, 202, 306, 403]);

    const rank = new Map(sorted.map((match, index) => [match.id, index]));
    expect(rank.get(402)).toBe(0);
    expect(rank.get(1)).toBeGreaterThan(rank.get(402)); // an unscored member trails the sole scored one
  });

  it("cloves (4 members): Replica By The Fireplace leads, down to Loewe 7 Cobalt, then Essenza (unscored) trails", () => {
    const matches = getNoteExplorerMatches({ catalogPerfumes: catalogFragrances, noteId: "cloves" });
    expect(matches.map((match) => match.id).sort((a, b) => a - b)).toEqual([101, 203, 204, 205]);

    const sorted = sortNoteExplorerMatchesByProminence(matches, "cloves");
    expect(sorted.map((match) => match.id)).toEqual([204, 205, 203, 101]);

    const rank = new Map(sorted.map((match, index) => [match.id, index]));
    const lastScoredRank = rank.get(203);
    expect(rank.get(101)).toBeGreaterThan(lastScoredRank); // the unscored member trails every scored one
  });

  it("never treats gingerFlower as a ginger variant, or an adjacent spice as ginger/nutmeg/cloves -- searching one canonical key never returns a fragrance whose only relevant note is a different variant or spice", () => {
    const gingerMatches = getNoteExplorerMatches({ catalogPerfumes: catalogFragrances, noteId: "ginger" });
    expect(gingerMatches.map((match) => match.id)).not.toContain(14); // Halloween Man: gingerFlower only

    const gingerFlowerMatches = getNoteExplorerMatches({ catalogPerfumes: catalogFragrances, noteId: "gingerFlower" });
    expect(gingerFlowerMatches.map((match) => match.id)).toEqual([14]);
    expect(gingerFlowerMatches.map((match) => match.id)).not.toContain(7); // The Scent EDT: generic ginger only

    const nutmegMatches = getNoteExplorerMatches({ catalogPerfumes: catalogFragrances, noteId: "nutmeg" });
    expect(nutmegMatches.map((match) => match.id)).not.toContain(118); // La Nuit de L'Homme: cardamom only, no nutmeg

    const clovesMatches = getNoteExplorerMatches({ catalogPerfumes: catalogFragrances, noteId: "cloves" });
    expect(clovesMatches.map((match) => match.id)).not.toContain(304); // Divine Vanille: cinnamon only, no cloves
  });
});

// Composer Phase 3N: horizontal note-family calibration regression for the
// sage family and geranium, run against the real catalog. The underlying
// data (taxonomy audit, canonical-data sanity audit, exact scores,
// canonical-pyramid immutability) is proven in
// packages/catalog/tests/noteProminenceHorizontalCalibration3N.test.js;
// this describe block only proves the existing, unmodified sort algorithm
// produces the approved relative order per canonical key -- scored
// fragrances sort descending, ties preserve catalog order, and unscored
// members trail after every scored one. Phase 3N changed zero prominence
// values (clarySage and geranium were, and remain, entirely unscored), so
// every order below is identical to the pre-Phase-3N catalog.
describe("Note Explorer 'Most prominent' sort reflects the Phase 3N calibrated order, per distinct canonical key", () => {
  it("sage (8 members): Loewe 7 Cobalt leads, down through a 3-way tie, then 4 unscored members trail in catalog order", () => {
    const matches = getNoteExplorerMatches({ catalogPerfumes: catalogFragrances, noteId: "sage" });
    expect(matches.map((match) => match.id).sort((a, b) => a - b)).toEqual([9, 15, 26, 35, 101, 203, 210, 213]);

    const sorted = sortNoteExplorerMatchesByProminence(matches, "sage");
    expect(sorted.map((match) => match.id)).toEqual([203, 9, 35, 213, 15, 26, 101, 210]);

    // 9, 35, and 213 tie at score 5 -- the sort preserves ascending
    // catalog-array order rather than forcing an artificial rank
    // difference.
    const rank = new Map(sorted.map((match, index) => [match.id, index]));
    expect(rank.get(9)).toBeLessThan(rank.get(35));
    expect(rank.get(35)).toBeLessThan(rank.get(213));
    const lastScoredRank = rank.get(213);
    expect(rank.get(15)).toBeGreaterThan(lastScoredRank); // an unscored member trails every scored one
  });

  it("clarySage (10 members, all unscored): preserves catalog order with no forced ranking", () => {
    const matches = getNoteExplorerMatches({ catalogPerfumes: catalogFragrances, noteId: "clarySage" });
    expect(matches.map((match) => match.id).sort((a, b) => a - b)).toEqual([3, 6, 11, 24, 25, 109, 206, 207, 211, 304]);

    const sorted = sortNoteExplorerMatchesByProminence(matches, "clarySage");
    expect(sorted.map((match) => match.id)).toEqual([3, 6, 11, 24, 25, 109, 206, 207, 211, 304]);
  });

  it("geranium (15 members, all unscored): preserves catalog order with no forced ranking", () => {
    const matches = getNoteExplorerMatches({ catalogPerfumes: catalogFragrances, noteId: "geranium" });
    expect(matches.map((match) => match.id).sort((a, b) => a - b)).toEqual([
      3, 4, 6, 29, 31, 107, 108, 109, 111, 114, 207, 208, 211, 213, 404,
    ]);

    const sorted = sortNoteExplorerMatchesByProminence(matches, "geranium");
    expect(sorted.map((match) => match.id)).toEqual([3, 4, 6, 29, 31, 107, 108, 109, 111, 114, 207, 208, 211, 213, 404]);
  });

  it("never treats an adjacent aromatic/floral material as sage, clarySage, or geranium -- searching one canonical key never returns a fragrance whose only relevant note is a different material", () => {
    const sageMatches = getNoteExplorerMatches({ catalogPerfumes: catalogFragrances, noteId: "sage" });
    expect(sageMatches.map((match) => match.id)).not.toContain(5); // Le Male: lavender/mint/artemisia only
    expect(sageMatches.map((match) => match.id)).not.toContain(1); // Acqua di Gio EDT: rosemary only

    const clarySageMatches = getNoteExplorerMatches({ catalogPerfumes: catalogFragrances, noteId: "clarySage" });
    expect(clarySageMatches.map((match) => match.id)).not.toContain(32); // Guess Man Gold: wormwood only

    const geraniumMatches = getNoteExplorerMatches({ catalogPerfumes: catalogFragrances, noteId: "geranium" });
    expect(geraniumMatches.map((match) => match.id)).not.toContain(13); // The One for Men EDP: basil only
    expect(geraniumMatches.map((match) => match.id)).not.toContain(14); // Halloween Man: violetLeaf only
  });
});

// Composer Phase 3O: horizontal note-family calibration regression for the
// collective canonical note woodyNotes, run against the real catalog. The
// underlying data (taxonomy audit, canonical-data sanity audit, exact
// scores, canonical-pyramid immutability) is proven in
// packages/catalog/tests/noteProminenceHorizontalCalibration3O.test.js;
// this describe block only proves the existing, unmodified sort algorithm
// produces the approved relative order -- with every member unscored,
// that order is simply the stable catalog-array order, and perfumes
// carrying only a concrete wood note (never exact woodyNotes) must never
// enter the result set. Phase 3O changed zero prominence values.
describe("Note Explorer 'Most prominent' sort reflects the Phase 3O calibrated order for woodyNotes", () => {
  it("woodyNotes (13 members, all unscored): preserves catalog order with no forced ranking", () => {
    const matches = getNoteExplorerMatches({ catalogPerfumes: catalogFragrances, noteId: "woodyNotes" });
    expect(matches.map((match) => match.id).sort((a, b) => a - b)).toEqual([
      7, 12, 23, 26, 30, 112, 113, 201, 210, 301, 302, 303, 406,
    ]);

    const sorted = sortNoteExplorerMatchesByProminence(matches, "woodyNotes");
    expect(sorted.map((match) => match.id)).toEqual([7, 12, 23, 26, 30, 112, 113, 201, 210, 301, 302, 303, 406]);
  });

  it("never admits a fragrance carrying only a concrete wood note into the exact woodyNotes result set", () => {
    const woodyNotesMatches = getNoteExplorerMatches({ catalogPerfumes: catalogFragrances, noteId: "woodyNotes" });
    expect(woodyNotesMatches.map((match) => match.id)).not.toContain(111); // Terre d'Hermès EDT: vetiver only
    expect(woodyNotesMatches.map((match) => match.id)).not.toContain(208); // Prada L'Homme: cedar only
    expect(woodyNotesMatches.map((match) => match.id)).not.toContain(4); // Legend EDT: sandalwood only

    // Conversely, searching a concrete wood key must never return a
    // fragrance whose only relevant note is the generalized woodyNotes.
    const cedarMatches = getNoteExplorerMatches({ catalogPerfumes: catalogFragrances, noteId: "cedar" });
    expect(cedarMatches.map((match) => match.id)).not.toContain(7); // The Scent EDT: woodyNotes only
  });
});

// Composer Phase 3P: horizontal note-family calibration regression for the
// violet family (violet, violetLeaf), run against the real catalog. The
// underlying data (taxonomy audit, canonical-data sanity audit, exact
// scores, canonical-pyramid immutability) is proven in
// packages/catalog/tests/noteProminenceHorizontalCalibration3P.test.js;
// this describe block only proves the existing, unmodified sort algorithm
// produces the approved relative order -- with every member unscored,
// that order is simply the stable catalog-array order, and violet/
// violetLeaf must never cross-rank against each other. Phase 3P changed
// zero prominence values.
describe("Note Explorer 'Most prominent' sort reflects the Phase 3P calibrated order, per distinct canonical key", () => {
  it("violet (4 members, all unscored): preserves catalog order with no forced ranking", () => {
    const matches = getNoteExplorerMatches({ catalogPerfumes: catalogFragrances, noteId: "violet" });
    expect(matches.map((match) => match.id).sort((a, b) => a - b)).toEqual([1, 12, 208, 404]);

    const sorted = sortNoteExplorerMatchesByProminence(matches, "violet");
    expect(sorted.map((match) => match.id)).toEqual([1, 12, 208, 404]);
  });

  it("violetLeaf (8 members, all unscored): preserves catalog order with no forced ranking", () => {
    const matches = getNoteExplorerMatches({ catalogPerfumes: catalogFragrances, noteId: "violetLeaf" });
    expect(matches.map((match) => match.id).sort((a, b) => a - b)).toEqual([14, 17, 23, 27, 117, 210, 306, 501]);

    const sorted = sortNoteExplorerMatchesByProminence(matches, "violetLeaf");
    expect(sorted.map((match) => match.id)).toEqual([14, 17, 23, 27, 117, 210, 306, 501]);
  });

  it("never cross-matches violet and violetLeaf, or admits an adjacent floral/green material -- searching one canonical key never returns a fragrance whose only relevant note is the other exact key or a different material", () => {
    const violetMatches = getNoteExplorerMatches({ catalogPerfumes: catalogFragrances, noteId: "violet" });
    expect(violetMatches.map((match) => match.id)).not.toContain(306); // Acqua di Gio Elixir: violetLeaf only
    expect(violetMatches.map((match) => match.id)).not.toContain(33); // Jaguar Pace: iris only

    const violetLeafMatches = getNoteExplorerMatches({ catalogPerfumes: catalogFragrances, noteId: "violetLeaf" });
    expect(violetLeafMatches.map((match) => match.id)).not.toContain(208); // Prada L'Homme: generic violet only
    expect(violetLeafMatches.map((match) => match.id)).not.toContain(3); // Versace Pour Homme: geranium only
    expect(violetLeafMatches.map((match) => match.id)).not.toContain(4); // Legend EDT: rose only
  });
});

// Composer Phase 3Q: horizontal note-family calibration regression for the
// two independent standalone canonical keys rosemary and ambroxan, run
// against the real catalog. The underlying data (taxonomy audit,
// canonical-data sanity audit, exact scores, canonical-pyramid
// immutability) is proven in
// packages/catalog/tests/noteProminenceHorizontalCalibration3Q.test.js;
// this describe block only proves the existing, unmodified sort algorithm
// produces the approved relative order per exact key -- scored fragrances
// sort descending, ties preserve catalog order, unscored members trail
// after every scored one, and containment stays strict per key. Phase 3Q
// changed zero prominence values, so every order below is identical to
// the pre-Phase-3Q catalog.
describe("Note Explorer 'Most prominent' sort reflects the Phase 3Q calibrated order, per distinct canonical key", () => {
  it("rosemary (8 members): Light Blue Pour Homme EDT and Torino21 tie for the lead, then 6 unscored members trail in catalog order", () => {
    const matches = getNoteExplorerMatches({ catalogPerfumes: catalogFragrances, noteId: "rosemary" });
    expect(matches.map((match) => match.id).sort((a, b) => a - b)).toEqual([1, 2, 9, 10, 29, 33, 101, 408]);

    const sorted = sortNoteExplorerMatchesByProminence(matches, "rosemary");
    expect(sorted.map((match) => match.id)).toEqual([2, 408, 1, 9, 10, 29, 33, 101]);

    // 2 and 408 tie at score 5 -- the sort preserves ascending
    // catalog-array order rather than forcing an artificial rank
    // difference.
    const rank = new Map(sorted.map((match, index) => [match.id, index]));
    expect(rank.get(2)).toBeLessThan(rank.get(408));
    const lastScoredRank = rank.get(408);
    expect(rank.get(1)).toBeGreaterThan(lastScoredRank); // an unscored member trails every scored one
  });

  it("ambroxan (7 members): Sauvage EDP leads, down through a tie, then Montblanc Explorer (unscored) trails", () => {
    const matches = getNoteExplorerMatches({ catalogPerfumes: catalogFragrances, noteId: "ambroxan" });
    expect(matches.map((match) => match.id).sort((a, b) => a - b)).toEqual([6, 22, 25, 114, 202, 207, 303]);

    const sorted = sortNoteExplorerMatchesByProminence(matches, "ambroxan");
    expect(sorted.map((match) => match.id)).toEqual([202, 6, 114, 303, 22, 207, 25]);

    // 114 and 303 tie at score 6 -- the sort preserves ascending
    // catalog-array order rather than forcing an artificial rank
    // difference.
    const rank = new Map(sorted.map((match, index) => [match.id, index]));
    expect(rank.get(114)).toBeLessThan(rank.get(303));
    const lastScoredRank = rank.get(207);
    expect(rank.get(25)).toBeGreaterThan(lastScoredRank); // the unscored member trails every scored one
  });

  it("never treats an adjacent herb as rosemary, or an adjacent amber/mineral material as ambroxan -- searching one canonical key never returns a fragrance whose only relevant note is a different material", () => {
    const rosemaryMatches = getNoteExplorerMatches({ catalogPerfumes: catalogFragrances, noteId: "rosemary" });
    expect(rosemaryMatches.map((match) => match.id)).not.toContain(15); // Polo Black: sage only
    expect(rosemaryMatches.map((match) => match.id)).not.toContain(4); // Legend EDT: lavender only
    expect(rosemaryMatches.map((match) => match.id)).not.toContain(13); // The One for Men EDP: basil only

    const ambroxanMatches = getNoteExplorerMatches({ catalogPerfumes: catalogFragrances, noteId: "ambroxan" });
    expect(ambroxanMatches.map((match) => match.id)).not.toContain(1); // Acqua di Gio EDT: amber only
    expect(ambroxanMatches.map((match) => match.id)).not.toContain(19); // Club de Nuit Intense Man: ambergris only
    expect(ambroxanMatches.map((match) => match.id)).not.toContain(8); // The Most Wanted: amberwood only
    expect(ambroxanMatches.map((match) => match.id)).not.toContain(404); // Layton: ambermax only

    // Game of Spades Wildcard legitimately carries both ambroxan and
    // generic amber, independently scored -- confirming coexistence
    // never causes cross-contamination between the two exact keys.
    expect(ambroxanMatches.map((match) => match.id)).toContain(114);
  });
});

// Composer Phase 3R: horizontal note-family calibration regression for the
// three independent standalone canonical keys pineapple, seaNotes, and
// juniper, run against the real catalog. The underlying data (taxonomy
// audit, canonical-data sanity audit, exact scores, canonical-pyramid
// immutability) is proven in
// packages/catalog/tests/noteProminenceHorizontalCalibration3R.test.js;
// this describe block only proves the existing, unmodified sort algorithm
// produces the approved relative order per exact key -- scored fragrances
// sort descending, ties preserve catalog order, unscored members trail
// after every scored one, and containment stays strict per key. Phase 3R
// changed zero prominence values, so every order below is identical to
// the pre-Phase-3R catalog.
describe("Note Explorer 'Most prominent' sort reflects the Phase 3R calibrated order, per distinct canonical key", () => {
  it("pineapple (6 members): Club de Nuit Intense Man and Hacivat tie for the lead, down through a second tie, then 2 unscored members trail in catalog order", () => {
    const matches = getNoteExplorerMatches({ catalogPerfumes: catalogFragrances, noteId: "pineapple" });
    expect(matches.map((match) => match.id).sort((a, b) => a - b)).toEqual([4, 19, 28, 112, 406, 407]);

    const sorted = sortNoteExplorerMatchesByProminence(matches, "pineapple");
    expect(sorted.map((match) => match.id)).toEqual([19, 406, 112, 407, 4, 28]);

    // 19 and 406 tie at score 8, and 112 and 407 tie at score 6 -- the
    // sort preserves ascending catalog-array order within each tie group
    // rather than forcing an artificial rank difference.
    const rank = new Map(sorted.map((match, index) => [match.id, index]));
    expect(rank.get(19)).toBeLessThan(rank.get(406));
    expect(rank.get(112)).toBeLessThan(rank.get(407));
    const lastScoredRank = rank.get(407);
    expect(rank.get(4)).toBeGreaterThan(lastScoredRank); // an unscored member trails every scored one
  });

  it("seaNotes (6 members): Acqua di Gio EDT leads at the maximum score, down through a 3-way tie, then Fierce (unscored) trails", () => {
    const matches = getNoteExplorerMatches({ catalogPerfumes: catalogFragrances, noteId: "seaNotes" });
    expect(matches.map((match) => match.id).sort((a, b) => a - b)).toEqual([1, 9, 119, 207, 306, 407]);

    const sorted = sortNoteExplorerMatchesByProminence(matches, "seaNotes");
    expect(sorted.map((match) => match.id)).toEqual([1, 119, 207, 306, 407, 9]);

    // 119, 207, and 306 tie at score 6 -- the sort preserves ascending
    // catalog-array order rather than forcing an artificial rank
    // difference.
    const rank = new Map(sorted.map((match, index) => [match.id, index]));
    expect(rank.get(1)).toBe(0);
    expect(rank.get(119)).toBeLessThan(rank.get(207));
    expect(rank.get(207)).toBeLessThan(rank.get(306));
    const lastScoredRank = rank.get(407);
    expect(rank.get(9)).toBeGreaterThan(lastScoredRank); // the unscored member trails every scored one
  });

  it("juniper (6 members): Orphéon EDP is the sole scored member, then 5 unscored members trail in catalog order", () => {
    const matches = getNoteExplorerMatches({ catalogPerfumes: catalogFragrances, noteId: "juniper" });
    expect(matches.map((match) => match.id).sort((a, b) => a - b)).toEqual([24, 109, 119, 204, 213, 409]);

    const sorted = sortNoteExplorerMatchesByProminence(matches, "juniper");
    expect(sorted.map((match) => match.id)).toEqual([409, 24, 119, 109, 204, 213]);

    const rank = new Map(sorted.map((match, index) => [match.id, index]));
    expect(rank.get(409)).toBe(0);
    expect(rank.get(24)).toBeGreaterThan(rank.get(409)); // an unscored member trails the sole scored one
  });

  it("never treats an adjacent fruit, marine/mineral, or coniferous/aromatic material as pineapple, seaNotes, or juniper -- searching one canonical key never returns a fragrance whose only relevant note is a different material", () => {
    const pineappleMatches = getNoteExplorerMatches({ catalogPerfumes: catalogFragrances, noteId: "pineapple" });
    expect(pineappleMatches.map((match) => match.id)).not.toContain(33); // Jaguar Pace: apple only
    expect(pineappleMatches.map((match) => match.id)).not.toContain(15); // Polo Black: mango only
    expect(pineappleMatches.map((match) => match.id)).not.toContain(109); // K EDP Intense: fig only

    const seaNotesMatches = getNoteExplorerMatches({ catalogPerfumes: catalogFragrances, noteId: "seaNotes" });
    expect(seaNotesMatches.map((match) => match.id)).not.toContain(210); // Born In Roma EDT: seaSalt/mineralNotes only
    expect(seaNotesMatches.map((match) => match.id)).not.toContain(105); // Bvlgari Man Rain Essence: mineralNotes only

    const juniperMatches = getNoteExplorerMatches({ catalogPerfumes: catalogFragrances, noteId: "juniper" });
    expect(juniperMatches.map((match) => match.id)).not.toContain(18); // L.12.12 Blanc EDP: pine only
    expect(juniperMatches.map((match) => match.id)).not.toContain(9); // Fierce: fir only
    expect(juniperMatches.map((match) => match.id)).not.toContain(1); // Acqua di Gio EDT: rosemary only

    // Mirto di Panarea and Summer Hammer legitimately carry two in-scope
    // exact keys each, independently scored -- confirming coexistence
    // never causes cross-contamination between exact keys.
    expect(seaNotesMatches.map((match) => match.id)).toContain(119);
    expect(juniperMatches.map((match) => match.id)).toContain(119);
    expect(pineappleMatches.map((match) => match.id)).toContain(407);
    expect(seaNotesMatches.map((match) => match.id)).toContain(407);
  });
});

// Composer Phase 3S: horizontal note-family calibration regression for the
// three independent standalone canonical keys neroli, orangeBlossom, and
// petitgrain, run against the real catalog. The underlying data (taxonomy
// audit, canonical-data sanity audit, exact scores, canonical-pyramid
// immutability) is proven in
// packages/catalog/tests/noteProminenceHorizontalCalibration3S.test.js;
// this describe block only proves the existing, unmodified sort algorithm
// produces the approved relative order per exact key -- scored fragrances
// sort descending, ties preserve catalog order, unscored members trail
// after every scored one, and containment stays strict per key. Phase 3S
// changed zero prominence values, so every order below is identical to
// the pre-Phase-3S catalog.
describe("Note Explorer 'Most prominent' sort reflects the Phase 3S calibrated order, per distinct canonical key", () => {
  it("neroli (5 members): Prada L'Homme leads, down through Prada L'Homme L'Eau, then 3 unscored members trail in catalog order", () => {
    const matches = getNoteExplorerMatches({ catalogPerfumes: catalogFragrances, noteId: "neroli" });
    expect(matches.map((match) => match.id).sort((a, b) => a - b)).toEqual([1, 3, 101, 208, 214]);

    const sorted = sortNoteExplorerMatchesByProminence(matches, "neroli");
    expect(sorted.map((match) => match.id)).toEqual([208, 214, 1, 3, 101]);

    const rank = new Map(sorted.map((match, index) => [match.id, index]));
    expect(rank.get(208)).toBeLessThan(rank.get(214));
    const lastScoredRank = rank.get(214);
    expect(rank.get(1)).toBeGreaterThan(lastScoredRank); // an unscored member trails every scored one
  });

  it("orangeBlossom (5 members, all unscored): preserves catalog order with no forced ranking", () => {
    const matches = getNoteExplorerMatches({ catalogPerfumes: catalogFragrances, noteId: "orangeBlossom" });
    expect(matches.map((match) => match.id).sort((a, b) => a - b)).toEqual([5, 10, 13, 14, 204]);

    const sorted = sortNoteExplorerMatchesByProminence(matches, "orangeBlossom");
    expect(sorted.map((match) => match.id)).toEqual([5, 10, 13, 14, 204]);
  });

  it("petitgrain (5 members): Arancia di Capri and Mandarino di Sicilia tie for the lead, then 3 unscored members trail in catalog order", () => {
    const matches = getNoteExplorerMatches({ catalogPerfumes: catalogFragrances, noteId: "petitgrain" });
    expect(matches.map((match) => match.id).sort((a, b) => a - b)).toEqual([9, 100, 101, 103, 401]);

    const sorted = sortNoteExplorerMatchesByProminence(matches, "petitgrain");
    expect(sorted.map((match) => match.id)).toEqual([100, 103, 9, 101, 401]);

    // 100 and 103 tie at score 5 -- the sort preserves ascending
    // catalog-array order rather than forcing an artificial rank
    // difference.
    const rank = new Map(sorted.map((match, index) => [match.id, index]));
    expect(rank.get(100)).toBeLessThan(rank.get(103));
    const lastScoredRank = rank.get(103);
    expect(rank.get(9)).toBeGreaterThan(lastScoredRank); // an unscored member trails every scored one
  });

  it("never treats a calibrated citrus-fruit key or an adjacent floral material as neroli, orangeBlossom, or petitgrain -- searching one canonical key never returns a fragrance whose only relevant note is a different material", () => {
    const nonMemberExamples = [
      { noteId: "neroli", excludeId: 28, label: "Tous Man: orange only" },
      { noteId: "neroli", excludeId: 6, label: "Eros EDP: bitterOrange only" },
      { noteId: "orangeBlossom", excludeId: 4, label: "Legend EDT: bergamot/geranium only" },
      { noteId: "petitgrain", excludeId: 2, label: "Light Blue Pour Homme EDT: lemon only" },
      { noteId: "petitgrain", excludeId: 110, label: "Concentré d'Orange Verte: mandarin only" },
      { noteId: "neroli", excludeId: 12, label: "CH Men: jasmine only" },
      { noteId: "orangeBlossom", excludeId: 501, label: "Tuxedo: lilyOfTheValley only" },
    ];
    for (const { noteId, excludeId } of nonMemberExamples) {
      const matches = getNoteExplorerMatches({ catalogPerfumes: catalogFragrances, noteId });
      expect(matches.map((match) => match.id)).not.toContain(excludeId);
    }

    // Essenza legitimately carries both neroli and petitgrain,
    // independently unscored -- confirming coexistence never causes
    // cross-contamination between exact keys.
    const neroliMatches = getNoteExplorerMatches({ catalogPerfumes: catalogFragrances, noteId: "neroli" });
    const petitgrainMatches = getNoteExplorerMatches({ catalogPerfumes: catalogFragrances, noteId: "petitgrain" });
    expect(neroliMatches.map((match) => match.id)).toContain(101);
    expect(petitgrainMatches.map((match) => match.id)).toContain(101);
  });
});

// Composer Phase 3T: horizontal note-family calibration regression for the
// two related but exact-distinct canonical keys oakmoss and moss, run
// against the real catalog. The underlying data (taxonomy audit,
// canonical-data sanity audit, exact scores, canonical-pyramid
// immutability) is proven in
// packages/catalog/tests/noteProminenceHorizontalCalibration3T.test.js;
// this describe block only proves the existing, unmodified sort algorithm
// produces the approved relative order per exact key -- scored fragrances
// sort descending, unscored members trail after every scored one, and
// containment stays strict per key. Phase 3T changed zero prominence
// values, so every order below is identical to the pre-Phase-3T catalog.
describe("Note Explorer 'Most prominent' sort reflects the Phase 3T calibrated order, per distinct canonical key", () => {
  it("oakmoss (11 members): Hacivat leads, down through Legend EDP, then 9 unscored members trail in catalog order", () => {
    const matches = getNoteExplorerMatches({ catalogPerfumes: catalogFragrances, noteId: "oakmoss" });
    expect(matches.map((match) => match.id).sort((a, b) => a - b)).toEqual([1, 4, 9, 12, 23, 29, 101, 110, 115, 305, 406]);

    const sorted = sortNoteExplorerMatchesByProminence(matches, "oakmoss");
    expect(sorted.map((match) => match.id)).toEqual([406, 23, 1, 4, 9, 12, 29, 101, 110, 115, 305]);

    const rank = new Map(sorted.map((match, index) => [match.id, index]));
    expect(rank.get(406)).toBe(0);
    expect(rank.get(23)).toBe(1);
    const lastScoredRank = rank.get(23);
    expect(rank.get(1)).toBeGreaterThan(lastScoredRank); // an unscored member trails every scored one
  });

  it("moss (2 members, both unscored): preserves catalog order with no forced ranking", () => {
    const matches = getNoteExplorerMatches({ catalogPerfumes: catalogFragrances, noteId: "moss" });
    expect(matches.map((match) => match.id).sort((a, b) => a - b)).toEqual([22, 33]);

    const sorted = sortNoteExplorerMatchesByProminence(matches, "moss");
    expect(sorted.map((match) => match.id)).toEqual([22, 33]);
  });

  it("never treats an adjacent green/earthy/woody material as oakmoss or moss -- searching one canonical key never returns a fragrance whose only relevant note is a different material", () => {
    const nonMemberExamples = [
      { noteId: "oakmoss", excludeId: 10, label: "L'Homme Idéal EDT: vetiver only" },
      { noteId: "oakmoss", excludeId: 2, label: "Light Blue Pour Homme EDT: patchouli only" },
      { noteId: "oakmoss", excludeId: 3, label: "Versace Pour Homme: cedar only" },
      { noteId: "oakmoss", excludeId: 7, label: "The Scent EDT: woodyNotes only" },
      { noteId: "oakmoss", excludeId: 401, label: "Silver Mountain Water: galbanum only" },
      { noteId: "oakmoss", excludeId: 108, label: "Bad Boy Cobalt Parfum Electrique: oak only" },
      { noteId: "oakmoss", excludeId: 19, label: "Club de Nuit Intense Man: birch only" },
      { noteId: "moss", excludeId: 10, label: "L'Homme Idéal EDT: vetiver only" },
    ];
    for (const { noteId, excludeId } of nonMemberExamples) {
      const matches = getNoteExplorerMatches({ catalogPerfumes: catalogFragrances, noteId });
      expect(matches.map((match) => match.id)).not.toContain(excludeId);
    }
  });
});

// Composer Phase 3U: horizontal note-family calibration regression for
// seven amber/resinous-adjacent standalone canonical keys (amberwood,
// ambergris, olibanum, labdanum, opoponax, peruBalsam, ambermax), run
// against the real catalog. The underlying data (taxonomy audit,
// canonical-data sanity audit, exact scores, canonical-pyramid
// immutability) is proven in
// packages/catalog/tests/noteProminenceHorizontalCalibration3U.test.js;
// this describe block only proves the existing, unmodified sort algorithm
// produces the approved relative order per exact key -- scored fragrances
// sort descending, unscored members trail after every scored one, and
// containment stays strict per key. Phase 3U changed zero prominence
// values, so every order below is identical to the pre-Phase-3U catalog.
describe("Note Explorer 'Most prominent' sort reflects the Phase 3U calibrated order, per distinct canonical key", () => {
  it("amberwood (5 members, all unscored): preserves catalog order with no forced ranking", () => {
    const matches = getNoteExplorerMatches({ catalogPerfumes: catalogFragrances, noteId: "amberwood" });
    expect(matches.map((match) => match.id).sort((a, b) => a - b)).toEqual([8, 33, 105, 213, 306]);

    const sorted = sortNoteExplorerMatchesByProminence(matches, "amberwood");
    expect(sorted.map((match) => match.id)).toEqual([8, 33, 105, 213, 306]);
  });

  it("ambergris (3 members): Squid leads, down through Club de Nuit Intense Man, then Tuxedo (unscored) trails", () => {
    const matches = getNoteExplorerMatches({ catalogPerfumes: catalogFragrances, noteId: "ambergris" });
    expect(matches.map((match) => match.id).sort((a, b) => a - b)).toEqual([19, 500, 501]);

    const sorted = sortNoteExplorerMatchesByProminence(matches, "ambergris");
    expect(sorted.map((match) => match.id)).toEqual([500, 19, 501]);

    const rank = new Map(sorted.map((match, index) => [match.id, index]));
    const lastScoredRank = rank.get(19);
    expect(rank.get(501)).toBeGreaterThan(lastScoredRank); // the unscored member trails every scored one
  });

  it("olibanum (5 members): Givenchy Pour Homme Blue Label is the sole scored member, then 4 unscored members trail in catalog order", () => {
    const matches = getNoteExplorerMatches({ catalogPerfumes: catalogFragrances, noteId: "olibanum" });
    expect(matches.map((match) => match.id).sort((a, b) => a - b)).toEqual([34, 116, 201, 206, 213]);

    const sorted = sortNoteExplorerMatchesByProminence(matches, "olibanum");
    expect(sorted.map((match) => match.id)).toEqual([34, 116, 201, 206, 213]);

    const rank = new Map(sorted.map((match, index) => [match.id, index]));
    expect(rank.get(34)).toBe(0);
    expect(rank.get(116)).toBeGreaterThan(rank.get(34)); // an unscored member trails the sole scored one
  });

  it("labdanum, opoponax, and peruBalsam (2 members each, all unscored): preserve catalog order with no forced ranking", () => {
    const labdanumMatches = getNoteExplorerMatches({ catalogPerfumes: catalogFragrances, noteId: "labdanum" });
    expect(labdanumMatches.map((match) => match.id)).toEqual([20, 410]);

    const opoponaxMatches = getNoteExplorerMatches({ catalogPerfumes: catalogFragrances, noteId: "opoponax" });
    expect(opoponaxMatches.map((match) => match.id)).toEqual([403, 500]);

    const peruBalsamMatches = getNoteExplorerMatches({ catalogPerfumes: catalogFragrances, noteId: "peruBalsam" });
    expect(peruBalsamMatches.map((match) => match.id)).toEqual([32, 204]);

    for (const [matches, noteId] of [
      [labdanumMatches, "labdanum"],
      [opoponaxMatches, "opoponax"],
      [peruBalsamMatches, "peruBalsam"],
    ]) {
      const sorted = sortNoteExplorerMatchesByProminence(matches, noteId);
      expect(sorted.map((match) => match.id)).toEqual(matches.map((match) => match.id));
    }
  });

  it("ambermax: Layton is the sole member and remains unscored", () => {
    const matches = getNoteExplorerMatches({ catalogPerfumes: catalogFragrances, noteId: "ambermax" });
    expect(matches.map((match) => match.id)).toEqual([404]);

    const sorted = sortNoteExplorerMatchesByProminence(matches, "ambermax");
    expect(sorted.map((match) => match.id)).toEqual([404]);
  });

  it("never treats amber, ambroxan, benzoin, siamBenzoin, incense, or elemi as one of the seven in-scope keys -- searching one canonical key never returns a fragrance whose only relevant note is a different material", () => {
    const nonMemberExamples = [
      { noteId: "amberwood", excludeId: 1, label: "Acqua di Gio EDT: amber only" },
      { noteId: "ambergris", excludeId: 6, label: "Eros EDP: ambroxan only" },
      { noteId: "olibanum", excludeId: 102, label: "Fico di Amalfi: benzoin only" },
      { noteId: "labdanum", excludeId: 304, label: "Divine Vanille: siamBenzoin only" },
      { noteId: "opoponax", excludeId: 17, label: "Gentlemen Only: incense/elemi only" },
      { noteId: "peruBalsam", excludeId: 17, label: "Gentlemen Only: incense/elemi only" },
      { noteId: "ambermax", excludeId: 1, label: "Acqua di Gio EDT: amber only" },
    ];
    for (const { noteId, excludeId } of nonMemberExamples) {
      const matches = getNoteExplorerMatches({ catalogPerfumes: catalogFragrances, noteId });
      expect(matches.map((match) => match.id)).not.toContain(excludeId);
    }

    // YSL Y EDP legitimately carries both amberwood and olibanum, and
    // Squid legitimately carries both ambergris and opoponax --
    // confirming coexistence never causes cross-contamination between
    // exact keys.
    const amberwoodMatches = getNoteExplorerMatches({ catalogPerfumes: catalogFragrances, noteId: "amberwood" });
    const olibanumMatches = getNoteExplorerMatches({ catalogPerfumes: catalogFragrances, noteId: "olibanum" });
    expect(amberwoodMatches.map((match) => match.id)).toContain(213);
    expect(olibanumMatches.map((match) => match.id)).toContain(213);

    const ambergrisMatches = getNoteExplorerMatches({ catalogPerfumes: catalogFragrances, noteId: "ambergris" });
    const opoponaxMatches = getNoteExplorerMatches({ catalogPerfumes: catalogFragrances, noteId: "opoponax" });
    expect(ambergrisMatches.map((match) => match.id)).toContain(500);
    expect(opoponaxMatches.map((match) => match.id)).toContain(500);
  });
});

// Composer Phase 3V: horizontal note-family calibration regression for
// four resinous canonical keys (benzoin, siamBenzoin, incense, elemi),
// run against the real catalog. The underlying data (taxonomy audit,
// canonical-data sanity audit, exact scores, canonical-pyramid
// immutability) is proven in
// packages/catalog/tests/noteProminenceHorizontalCalibration3V.test.js;
// this describe block only proves the existing, unmodified sort algorithm
// produces the approved relative order per exact key -- scored fragrances
// sort descending, unscored members trail after every scored one, and
// containment stays strict per key. Phase 3V changed zero prominence
// values, so every order below is identical to the pre-Phase-3V catalog.
describe("Note Explorer 'Most prominent' sort reflects the Phase 3V calibrated order, per distinct canonical key", () => {
  it("benzoin (4 members): Gentleman EDP is the sole scored member, then 3 unscored members trail in catalog order", () => {
    const matches = getNoteExplorerMatches({ catalogPerfumes: catalogFragrances, noteId: "benzoin" });
    expect(matches.map((match) => match.id).sort((a, b) => a - b)).toEqual([102, 111, 205, 500]);

    const sorted = sortNoteExplorerMatchesByProminence(matches, "benzoin");
    expect(sorted.map((match) => match.id)).toEqual([205, 102, 111, 500]);

    const rank = new Map(sorted.map((match, index) => [match.id, index]));
    expect(rank.get(205)).toBe(0);
    expect(rank.get(102)).toBeGreaterThan(rank.get(205)); // an unscored member trails the sole scored one
  });

  it("siamBenzoin (2 members, both unscored): preserves catalog order with no forced ranking", () => {
    const matches = getNoteExplorerMatches({ catalogPerfumes: catalogFragrances, noteId: "siamBenzoin" });
    expect(matches.map((match) => match.id)).toEqual([304, 410]);

    const sorted = sortNoteExplorerMatchesByProminence(matches, "siamBenzoin");
    expect(sorted.map((match) => match.id)).toEqual([304, 410]);
  });

  it("incense (4 members, all scored): Squid leads, down through Loewe 7 Cobalt, Gentlemen Only, and Divine Vanille in strictly descending order", () => {
    const matches = getNoteExplorerMatches({ catalogPerfumes: catalogFragrances, noteId: "incense" });
    expect(matches.map((match) => match.id).sort((a, b) => a - b)).toEqual([17, 203, 304, 500]);

    const sorted = sortNoteExplorerMatchesByProminence(matches, "incense");
    // Every member is scored, with no ties (7, 6, 5, 4) -- confirming a
    // strictly descending order with no tie-preservation cases to guard.
    expect(sorted.map((match) => match.id)).toEqual([500, 203, 17, 304]);
  });

  it("elemi (2 members): Dior Homme Sport leads, then Gentlemen Only (unscored) trails", () => {
    const matches = getNoteExplorerMatches({ catalogPerfumes: catalogFragrances, noteId: "elemi" });
    expect(matches.map((match) => match.id).sort((a, b) => a - b)).toEqual([17, 201]);

    const sorted = sortNoteExplorerMatchesByProminence(matches, "elemi");
    expect(sorted.map((match) => match.id)).toEqual([201, 17]);
  });

  it("never treats an adjacent resinous/amber material as one of the four in-scope keys -- searching one canonical key never returns a fragrance whose only relevant note is a different material", () => {
    const nonMemberExamples = [
      { noteId: "benzoin", excludeId: 34, label: "Givenchy Pour Homme Blue Label: olibanum only" },
      { noteId: "siamBenzoin", excludeId: 20, label: "F by Ferragamo Black: labdanum only" },
      { noteId: "incense", excludeId: 403, label: "Carlisle: opoponax only" },
      { noteId: "elemi", excludeId: 32, label: "Guess Man Gold: peruBalsam only" },
      { noteId: "benzoin", excludeId: 1, label: "Acqua di Gio EDT: amber only" },
      { noteId: "siamBenzoin", excludeId: 19, label: "Club de Nuit Intense Man: ambergris only" },
      { noteId: "incense", excludeId: 6, label: "Eros EDP: ambroxan only" },
      { noteId: "elemi", excludeId: 8, label: "The Most Wanted: amberwood only" },
      { noteId: "benzoin", excludeId: 404, label: "Layton: ambermax only" },
    ];
    for (const { noteId, excludeId } of nonMemberExamples) {
      const matches = getNoteExplorerMatches({ catalogPerfumes: catalogFragrances, noteId });
      expect(matches.map((match) => match.id)).not.toContain(excludeId);
    }

    // Squid legitimately carries both benzoin and incense, Gentlemen
    // Only legitimately carries both incense and elemi, and Divine
    // Vanille legitimately carries both siamBenzoin and incense --
    // confirming coexistence never causes cross-contamination between
    // exact keys.
    const benzoinMatches = getNoteExplorerMatches({ catalogPerfumes: catalogFragrances, noteId: "benzoin" });
    const incenseMatches = getNoteExplorerMatches({ catalogPerfumes: catalogFragrances, noteId: "incense" });
    const elemiMatches = getNoteExplorerMatches({ catalogPerfumes: catalogFragrances, noteId: "elemi" });
    const siamBenzoinMatches = getNoteExplorerMatches({ catalogPerfumes: catalogFragrances, noteId: "siamBenzoin" });
    expect(benzoinMatches.map((match) => match.id)).toContain(500);
    expect(incenseMatches.map((match) => match.id)).toContain(500);
    expect(incenseMatches.map((match) => match.id)).toContain(17);
    expect(elemiMatches.map((match) => match.id)).toContain(17);
    expect(siamBenzoinMatches.map((match) => match.id)).toContain(304);
    expect(incenseMatches.map((match) => match.id)).toContain(304);
  });
});
