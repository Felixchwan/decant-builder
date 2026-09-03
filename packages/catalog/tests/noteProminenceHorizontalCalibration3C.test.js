import { describe, expect, it } from "vitest";

import { fragrances as perfumes, notes } from "@discovery-box/catalog";
import { NOTE_PROMINENCE_BY_ID } from "../src/fragrances.js";

// Composer Phase 3C: narrow regression coverage for the third horizontal
// note-family calibration pass -- the vanilla and cedar canonical-key
// families, the largest yet audited (vanilla: 18 fragrances after the
// Gentleman EDP correction below moved id 205 to blackVanilla; cedar: 28).
// Same core rule as Phase 3B: vanilla, bourbonVanilla, madagascarVanilla,
// and blackVanilla are four distinct canonical keys (confirmed against
// notes.js and the live catalog below); cedar, cedarwood, and texasCedar
// are three distinct keys. Each is calibrated as its own separate peer
// group, never collapsed into one umbrella "vanilla" or "cedar" score.
//
// Taxonomy audit (Step 1) -- exact canonical keys found in notes.js:
//   Vanilla family: vanilla ("Vanilla"), bourbonVanilla ("Bourbon
//     Vanilla"), madagascarVanilla ("Madagascar Vanilla"), blackVanilla
//     ("Black Vanilla")
//   Cedar family: cedar ("Cedar"), cedarwood ("Cedarwood"), texasCedar
//     ("Texas Cedar")
// No other vanilla- or cedar-related canonical key exists in the
// taxonomy. Substring near-misses were checked and excluded as
// semantically unrelated: none exist for vanilla; for cedar, notes like
// "cashmirwood", "sandalwood", "brazilianRosewood", "amberwood", and
// "guaiacWood" all contain "wood" but are entirely different materials,
// and generic "woodyNotes" is deliberately excluded per this phase's own
// editorial caution against treating broad woodiness as cedar.
//
// Canonical-data sanity audit (Step 2): every existing vanilla/cedar-
// variant assignment was reviewed. Most held up as-is: Spicebomb Extreme
// (212) already explicitly lists both vanilla and bourbonVanilla as
// separate ingredients (the established Phase 2E precedent for scoring
// overlapping concepts independently); Divine Vanille (304) specifically
// names texasCedar, not generic cedar; Hacivat (406) coexists with both
// cedar and cedarwood as genuinely distinct notes in different pyramid
// tiers. One correction WAS made, on the same narrow basis as the Phase
// 3A basil fix for Concentré d'Orange Verte: Gentleman EDP (id 205) was
// generalized under plain vanilla, but Givenchy's own published note
// identity for this release explicitly names the base note Black Vanilla
// (Black Vanilla Husk in detailed fragrance references) -- not a
// perceptual "smells dark" read, but the fragrance's own documented note
// identity. Its baseNotes entry was corrected from "vanilla" to
// "blackVanilla", and its prominence score moved to the same numeric
// strength (6) under the corrected key. No other fragrance's canonical
// notes were found to warrant a correction.
//
// vanilla (generic) -- 18 fragrances (was 19 before the Gentleman EDP
// correction moved id 205 to blackVanilla). Final calibrated scores,
// high to low, with only the fragrances that materially changed
// annotated:
//   5   Le Male                    -- 8 (unchanged)
//   113 Le Male Le Parfum          -- 8 (unchanged)
//   212 Spicebomb Extreme          -- 8 (raised from 7: genuinely one of
//                                    the more vanilla-defining
//                                    fragrances in the catalog, sharing
//                                    billing with the already-defining
//                                    tobacco:9)
//   6   Eros EDP                   -- 7 (unchanged)
//   29  Versace Eros Flame         -- 7 (unchanged)
//   404 Layton                     -- 7 (unchanged: a genuine, widely
//                                    documented supporting sweetness
//                                    beneath its apple-lavender top)
//   21  Halloween Man Mystery      -- 6 (unchanged)
//   14  Halloween Man              -- 5 (unchanged)
//   116 Invictus Victory           -- 5 (unchanged)
//   202 Sauvage EDP                -- 5 (unchanged)
//   403 Carlisle                   -- 5 (unchanged: a deliberately
//                                    conservative Phase 2J score; no new
//                                    evidence in this pass to move it)
//   410 Il Padrino                 -- 5 (unchanged: same Phase 2J
//                                    conservatism, no new evidence)
//   204 Replica By The Fireplace   -- 4 (lowered from 5: unlike its
//                                    scored peers, "vanilla" is not one
//                                    of this fragrance's own listed
//                                    accords at all -- less confidence
//                                    than accord-corroborated cases at
//                                    the same tier)
//   12  CH Men                     -- unscored (no vanilla accord; 3rd of
//                                    9 crowded base notes; leather is the
//                                    real identity)
//   19  Club de Nuit Intense Man   -- unscored (no vanilla accord; last
//                                    of 4 base notes; real identity is
//                                    pineapple/birch/blackCurrant)
//   20  F by Ferragamo Black       -- unscored (no vanilla accord;
//                                    insufficient independent confidence)
//   31  Viking Cairo               -- unscored (no vanilla accord; low
//                                    overall confidence fragrance)
//   115 Cedrat Boise               -- unscored (no vanilla accord; 4th of
//                                    6 base notes, clearly secondary to
//                                    citron:8)
//
// bourbonVanilla -- 2 fragrances:
//   212 Spicebomb Extreme -- 8 (raised from 7, alongside generic vanilla
//                             above, preserving the established Phase 2E
//                             parity between the two independently-scored
//                             concepts in this one fragrance)
//   501 Tuxedo            -- 5 (unchanged: clearly secondary to the
//                             defining patchouli:9)
//
// madagascarVanilla -- 2 fragrances, unchanged:
//   304 Divine Vanille                    -- 10 (defining/signature --
//                                           this fragrance's entire
//                                           reason for existing)
//   301 Allure Homme Edition Blanche EDP  -- 6 (a genuine but secondary
//                                           sweetness beneath sandalwood)
//
// blackVanilla -- 2 fragrances (was 1 before the Gentleman EDP
// correction gave this family its first real peer):
//   106 212 VIP Black -- 7 (unchanged)
//   205 Gentleman EDP -- 6 (moved here from generic vanilla via the
//                        canonical-data correction above, at the same
//                        prominence value it held under the old key --
//                        "vanilla" was the #2 listed accord and this is
//                        a real base note, not a re-score)
//
// cedar (generic) -- 28 fragrances, the largest family audited so far.
// Per this phase's editorial caution, the large majority (21 of 28) stay
// unscored -- cedar is extremely common as one-of-several background
// base/middle notes across this catalog, and broad woodiness alone was
// never treated as evidence of a genuine, identifiable cedar character.
// Final calibrated scores, high to low, with only materially-changed
// entries annotated:
//   111 Terre d'Hermès EDT   -- 6 (unchanged: a genuine, well-documented
//                              component of one of the most acclaimed
//                              "woody earthy" compositions in modern
//                              perfumery, alongside vetiver:8)
//   409 Orphéon EDP          -- 6 (unchanged: a documented full-coverage
//                              exception fragrance, "woody" accord #2)
//   115 Cedrat Boise         -- 6 (raised from 5: first-listed of 6 base
//                              notes, "woody" accord #3, and the product
//                              name itself -- "Cedrat Boisé" -- signals
//                              woodiness as core to this release's own
//                              identity)
//   104 Armani Code EDT      -- 4 (unchanged: co-equal with tonkaBean:9
//                              as this fragrance's only 2 base notes, but
//                              genuinely secondary in real-world
//                              character)
//   117 YSL L'Homme          -- 4 (unchanged)
//   3   Versace Pour Homme   -- 4 (lowered from 5: no "woody" accord at
//                              all, unlike peers newly scored at the same
//                              tier with genuine accord corroboration)
//   17  Gentlemen Only       -- 4 (newly scored: "woody" is the #1
//                              listed accord, cedar sits among a
//                              genuinely wood-forward middle-note
//                              lineup with vetiver and patchouli)
//   22  Legend Blue          -- 4 (newly scored: "woody" is accord #2,
//                              and cedar is literally half of only 2
//                              middle notes, co-equal with the already-
//                              scored sandalwood:4)
//   406 Hacivat              -- 4 (lowered from 5: last of 3 base notes,
//                              behind the more prominent generic
//                              woodyNotes and the already-dominant
//                              oakmoss:8 -- distinguishing an
//                              identifiable cedar character from
//                              generic woodiness, per this phase's own
//                              caution)
//   [21 unscored members, e.g. Acqua di Gio EDT, Le Male, Eros EDP,
//    L'Homme Idéal EDT, The One for Men EDP, Legend Red, Touch for Men,
//    Tous Man, Versace Eros Flame, Fico di Amalfi, Mandarino di Sicilia,
//    Bad Boy Cobalt Parfum Electrique, Game of Spades Wildcard, La Nuit
//    de L'Homme, Mirto di Panarea, Prada L'Homme, YSL Y EDP, Prada
//    L'Homme L'Eau, Mefisto -- each reviewed individually and left
//    unscored: no "woody" accord, cedar buried deep in a crowded note
//    list, and/or the fragrance's real identity is clearly carried by
//    another already-scored note]
//
// cedarwood -- 5 fragrances:
//   18  L.12.12 Blanc EDP                   -- 4 (unchanged: half of only
//                                            2 base notes, "woody" accord
//                                            #1, but pine:7 is the real
//                                            top-billed wood-adjacent note)
//   302 Allure Homme Sport Superleggera     -- 4 (newly scored: literally
//                                            half of only 2 middle notes,
//                                            alongside generic
//                                            woodyNotes, "woody" accord
//                                            #2)
//   34  Givenchy Pour Homme Blue Label      -- unscored (last of 3 base
//                                            notes, vetiver/olibanum
//                                            already capture the base)
//   109 K EDP Intense                       -- unscored (last of 4 base
//                                            notes, leather clearly
//                                            dominant)
//   406 Hacivat                             -- unscored (last of 3
//                                            middle notes, too much
//                                            internal wood-note crowding
//                                            -- this fragrance already
//                                            carries its own separate,
//                                            lower-confidence cedar score)
//
// texasCedar -- 1 fragrance, unchanged (no peer to compare against):
//   304 Divine Vanille -- unscored (5th of 6 base notes, zero "woody"
//                         accord support, and this fragrance's entire
//                         identity is already its madagascarVanilla:10)
const VANILLA_FAMILY = {
  5: 8,
  6: 7,
  12: undefined,
  14: 5,
  19: undefined,
  20: undefined,
  21: 6,
  29: 7,
  31: undefined,
  113: 8,
  115: undefined,
  116: 5,
  202: 5,
  204: 4,
  212: 8,
  403: 5,
  404: 7,
  410: 5,
};

const BOURBON_VANILLA_FAMILY = {
  212: 8,
  501: 5,
};

const MADAGASCAR_VANILLA_FAMILY = {
  301: 6,
  304: 10,
};

const BLACK_VANILLA_FAMILY = {
  106: 7,
  205: 6,
};

const CEDAR_FAMILY = {
  1: undefined,
  3: 4,
  5: undefined,
  6: undefined,
  10: undefined,
  13: undefined,
  17: 4,
  22: 4,
  24: undefined,
  27: undefined,
  28: undefined,
  29: undefined,
  102: undefined,
  103: undefined,
  104: 4,
  108: undefined,
  111: 6,
  114: undefined,
  115: 6,
  117: 4,
  118: undefined,
  119: undefined,
  208: undefined,
  213: undefined,
  214: undefined,
  405: undefined,
  406: 4,
  409: 6,
};

const CEDARWOOD_FAMILY = {
  18: 4,
  34: undefined,
  109: undefined,
  302: 4,
  406: undefined,
};

const TEXAS_CEDAR_FAMILY = {
  304: undefined,
};

const ALL_FAMILIES = {
  vanilla: VANILLA_FAMILY,
  bourbonVanilla: BOURBON_VANILLA_FAMILY,
  madagascarVanilla: MADAGASCAR_VANILLA_FAMILY,
  blackVanilla: BLACK_VANILLA_FAMILY,
  cedar: CEDAR_FAMILY,
  cedarwood: CEDARWOOD_FAMILY,
  texasCedar: TEXAS_CEDAR_FAMILY,
};

// The exact, unrelated prominence values on every touched fragrance,
// pinned so this phase is provably scoped to only the seven keys above.
const UNRELATED_VALUES_BY_ID = {
  3: { bergamot: 6, musk: 6 },
  17: { birchLeaf: 7, incense: 5, pinkPepper: 4 },
  22: { spearmint: 7, ambroxan: 5, sandalwood: 4 },
  115: { citron: 8, blackCurrant: 3 },
  204: { guaiacWood: 9, chestnut: 7, cloves: 6 },
  205: { iris: 8, patchouli: 6, benzoin: 6, cloves: 5 },
  212: { tobacco: 9, cinnamon: 6, blackPepper: 5 },
  302: { grapefruit: 7, whiteMusk: 6, amber: 5 },
  406: { pineapple: 8, oakmoss: 8, patchouli: 4 },
};

function getPerfumeNoteIds(perfume) {
  return [
    ...(perfume.topNotes || []),
    ...(perfume.middleNotes || []),
    ...(perfume.baseNotes || []),
    ...(perfume.generalNotes || []),
  ];
}

describe("Composer Phase 3C taxonomy audit", () => {
  it("finds exactly these 4 canonical vanilla-family keys in the note dictionary, with distinct display names", () => {
    expect(notes.vanilla).toMatchObject({ name: "Vanilla" });
    expect(notes.bourbonVanilla).toMatchObject({ name: "Bourbon Vanilla" });
    expect(notes.madagascarVanilla).toMatchObject({ name: "Madagascar Vanilla" });
    expect(notes.blackVanilla).toMatchObject({ name: "Black Vanilla" });
  });

  it("finds exactly these 3 canonical cedar-family keys in the note dictionary, with distinct display names", () => {
    expect(notes.cedar).toMatchObject({ name: "Cedar" });
    expect(notes.cedarwood).toMatchObject({ name: "Cedarwood" });
    expect(notes.texasCedar).toMatchObject({ name: "Texas Cedar" });
  });

  it("excludes semantically unrelated wood notes from the cedar family despite containing 'wood'", () => {
    const unrelatedWoodNotes = ["cashmirwood", "sandalwood", "brazilianRosewood", "amberwood", "guaiacWood", "woodyNotes"];
    for (const noteId of unrelatedWoodNotes) {
      expect(notes[noteId]).toBeTruthy();
      expect(CEDAR_FAMILY).not.toHaveProperty(noteId);
      expect(CEDARWOOD_FAMILY).not.toHaveProperty(noteId);
    }
  });
});

describe("Composer Phase 3C canonical-data sanity audit", () => {
  const perfumesById = new Map(perfumes.map((perfume) => [perfume.id, perfume]));

  it("confirms every other vanilla/cedar-variant assignment held up under review, with no correction warranted", () => {
    // Spicebomb Extreme explicitly lists both vanilla and bourbonVanilla
    // as separate ingredients (the Phase 2E precedent for independently
    // scoring overlapping concepts) -- not a mismatch.
    const spicebomb = perfumesById.get(212);
    expect(spicebomb.baseNotes).toEqual(expect.arrayContaining(["vanilla", "bourbonVanilla"]));

    // Divine Vanille specifically names texasCedar, not generic cedar.
    const divineVanille = perfumesById.get(304);
    expect(divineVanille.baseNotes).toContain("texasCedar");
    expect(divineVanille.baseNotes).not.toContain("cedar");

    // Hacivat coexists with both cedar and cedarwood as genuinely
    // distinct notes in different pyramid tiers -- not collapsed.
    const hacivat = perfumesById.get(406);
    expect(hacivat.baseNotes).toContain("cedar");
    expect(hacivat.middleNotes).toContain("cedarwood");
  });

  it("confirms the approved Gentleman EDP correction: its base note is canonically blackVanilla, not generic vanilla", () => {
    // Givenchy's own published note identity for this release explicitly
    // names the base note Black Vanilla (Black Vanilla Husk in detailed
    // fragrance references) -- not a perceptual "smells dark" read, but
    // the fragrance's own documented note identity. This is the narrow
    // correction the Phase 3A basil fix set the bar for.
    const gentlemanEdp = perfumesById.get(205);
    expect(gentlemanEdp.baseNotes).toContain("blackVanilla");
    expect(gentlemanEdp.baseNotes).not.toContain("vanilla");

    // Every other canonical note is preserved exactly.
    expect(gentlemanEdp.topNotes).toEqual(["blackPepper", "lavender", "bergamot"]);
    expect(gentlemanEdp.middleNotes).toEqual(["iris", "cloves", "cinnamon"]);
    expect(gentlemanEdp.baseNotes).toEqual(["blackVanilla", "tonkaBean", "benzoin", "patchouli"]);

    // The prominence score moved to the corrected key at the same
    // numeric strength (6) -- a key rename, not a re-score.
    expect(NOTE_PROMINENCE_BY_ID[205].blackVanilla).toBe(6);
    expect(NOTE_PROMINENCE_BY_ID[205].vanilla).toBeUndefined();
  });
});

describe("Composer Phase 3C horizontal calibration -- vanilla and cedar canonical-key families", () => {
  const perfumesById = new Map(perfumes.map((perfume) => [perfume.id, perfume]));

  it("has exactly 88 catalog fragrances to search for exhaustive family membership", () => {
    expect(perfumes).toHaveLength(88);
  });

  for (const [noteId, family] of Object.entries(ALL_FAMILIES)) {
    it(`${noteId} family membership is exhaustive against the live catalog`, () => {
      const actualIds = perfumes
        .filter((perfume) => getPerfumeNoteIds(perfume).includes(noteId))
        .map((perfume) => perfume.id)
        .sort((a, b) => a - b);

      expect(actualIds).toEqual(Object.keys(family).map(Number).sort((a, b) => a - b));
    });

    it(`matches the exact calibrated ${noteId} score for every scored member, and confirms intentionally-unscored members stay unscored`, () => {
      for (const [id, expectedScore] of Object.entries(family)) {
        const actualScore = NOTE_PROMINENCE_BY_ID[id]?.[noteId];
        if (expectedScore === undefined) {
          expect(actualScore, `${perfumesById.get(Number(id)).name} should remain unscored for ${noteId}`).toBeUndefined();
        } else {
          expect(actualScore, `${perfumesById.get(Number(id)).name} ${noteId} score`).toBe(expectedScore);
        }
      }
    });
  }

  it("keeps every calibrated vanilla/cedar-family value an integer from 1 to 10", () => {
    for (const family of Object.values(ALL_FAMILIES)) {
      for (const [id, score] of Object.entries(family)) {
        if (score === undefined) continue;
        expect(Number.isInteger(score), `id ${id}`).toBe(true);
        expect(score).toBeGreaterThanOrEqual(1);
        expect(score).toBeLessThanOrEqual(10);
      }
    }
  });

  it("never collapses distinct canonical keys into one another -- a fragrance never silently carries a score under the wrong vanilla/cedar variant", () => {
    const vanillaKeys = ["vanilla", "bourbonVanilla", "madagascarVanilla", "blackVanilla"];
    const cedarKeys = ["cedar", "cedarwood", "texasCedar"];
    const allTouchedIds = new Set(Object.values(ALL_FAMILIES).flatMap((family) => Object.keys(family).map(Number)));

    for (const id of allTouchedIds) {
      const entry = NOTE_PROMINENCE_BY_ID[id] || {};
      const fragrance = perfumesById.get(id);
      const ownNoteIds = new Set(getPerfumeNoteIds(fragrance));

      // Every scored vanilla/cedar key on this fragrance must actually be
      // one of its own canonical notes (no cross-key substitution).
      for (const key of [...vanillaKeys, ...cedarKeys]) {
        if (key in entry) {
          expect(ownNoteIds.has(key), `${fragrance.name} does not canonically carry "${key}"`).toBe(true);
        }
      }
    }

    // Spicebomb Extreme is the one fragrance carrying two vanilla-family
    // keys at once (vanilla and bourbonVanilla) -- confirmed as a
    // deliberate independent-judgment case, not a collapse.
    expect(Object.keys(NOTE_PROMINENCE_BY_ID[212]).filter((k) => vanillaKeys.includes(k)).sort()).toEqual(
      ["bourbonVanilla", "vanilla"]
    );
  });

  it("scores only notes that actually belong to each fragrance's own canonical note set", () => {
    const allTouchedIds = new Set(Object.values(ALL_FAMILIES).flatMap((family) => Object.keys(family).map(Number)));
    for (const id of allTouchedIds) {
      const fragrance = perfumesById.get(id);
      const ownNoteIds = new Set(getPerfumeNoteIds(fragrance));
      for (const noteId of Object.keys(NOTE_PROMINENCE_BY_ID[id] || {})) {
        expect(ownNoteIds.has(noteId), `${fragrance.name} is not documented to carry "${noteId}"`).toBe(true);
        expect(notes[noteId]).toBeTruthy();
      }
    }
  });

  it("leaves every unrelated prominence value on each touched fragrance exactly as it was -- this phase only touches the seven vanilla/cedar canonical keys", () => {
    const vanillaKeys = ["vanilla", "bourbonVanilla", "madagascarVanilla", "blackVanilla"];
    const cedarKeys = ["cedar", "cedarwood", "texasCedar"];

    for (const [id, unrelatedValues] of Object.entries(UNRELATED_VALUES_BY_ID)) {
      const liveEntry = { ...NOTE_PROMINENCE_BY_ID[id] };
      for (const key of [...vanillaKeys, ...cedarKeys]) delete liveEntry[key];

      expect(liveEntry, `${perfumesById.get(Number(id)).name}`).toEqual(unrelatedValues);
    }
  });

  it("leaves every touched fragrance's canonical note pyramid exactly as it was, except the one approved Gentleman EDP correction", () => {
    expect(perfumesById.get(3)).toMatchObject({
      name: "Versace Pour Homme",
      middleNotes: ["hyacinth", "cedar", "clarySage", "geranium"],
    });
    expect(perfumesById.get(17)).toMatchObject({
      name: "Gentlemen Only",
      middleNotes: ["vetiver", "cedar", "patchouli", "violetLeaf", "elemi"],
    });
    expect(perfumesById.get(22)).toMatchObject({
      name: "Legend Blue",
      middleNotes: ["sandalwood", "cedar"],
    });
    expect(perfumesById.get(115)).toMatchObject({
      name: "Cedrat Boise",
      baseNotes: ["cedar", "leather", "sandalwood", "vanilla", "whiteMusk", "oakmoss"],
    });
    expect(perfumesById.get(204)).toMatchObject({
      name: "Replica By The Fireplace",
      baseNotes: ["vanilla", "peruBalsam", "cashmeran"],
    });
    expect(perfumesById.get(205)).toMatchObject({
      name: "Gentleman EDP",
      baseNotes: ["blackVanilla", "tonkaBean", "benzoin", "patchouli"],
    });
    expect(perfumesById.get(212)).toMatchObject({
      name: "Spicebomb Extreme",
      baseNotes: ["tobacco", "vanilla", "bourbonVanilla"],
    });
    expect(perfumesById.get(302)).toMatchObject({
      name: "Allure Homme Sport Superleggera",
      middleNotes: ["woodyNotes", "cedarwood"],
    });
    expect(perfumesById.get(406)).toMatchObject({
      name: "Hacivat",
      middleNotes: ["jasmine", "patchouli", "cedarwood"],
      baseNotes: ["woodyNotes", "oakmoss", "cedar"],
    });
  });

  // The Note Explorer "Most prominent" sort verification for every
  // vanilla/cedar-family key with enough membership for a meaningful
  // ordering lives in
  // packages/builder/src/builder/internal/intelligence/buildNoteExplorerViewModel.test.js
  // instead of here -- packages/catalog must never import from
  // packages/builder (ADR-0006), and this file already proves the
  // underlying data (membership, scores, containment) that sort depends on.
});
