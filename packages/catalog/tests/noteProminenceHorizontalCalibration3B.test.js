import { describe, expect, it } from "vitest";

import { fragrances as perfumes, notes } from "@discovery-box/catalog";
import { NOTE_PROMINENCE_BY_ID } from "../src/fragrances.js";

// Composer Phase 3B: narrow regression coverage for the second horizontal
// note-family calibration pass -- the apple and mint canonical-key
// families. This phase's core rule is the OPPOSITE of collapsing: apple,
// greenApple, redApple, and candyApple are four distinct canonical keys
// (confirmed against notes.js and the live catalog below) and are
// calibrated as four separate peer groups, never merged into one "apple
// family" score; likewise mint and spearmint stay two separate groups.
// pineapple was investigated and excluded -- it is a semantically
// unrelated fruit note, not an apple variant, despite the substring match.
//
// Taxonomy audit (Step 1) -- exact canonical keys found in notes.js:
//   Apple family: apple ("Apple"), greenApple ("Green Apple"),
//     redApple ("Red Apple"), candyApple ("Candy Apple")
//   Mint family: mint ("Mint"), spearmint ("Spearmint")
// No other apple- or mint-related canonical key exists in the taxonomy.
//
// apple (generic) -- 6 fragrances. Final calibrated scores, high to low:
//   404 Layton                    -- 9 (raised from 8: real-world, this
//                                    is one of the most singularly
//                                    "apple-identified" fragrances in
//                                    modern niche/prestige perfumery --
//                                    a genuinely defining/signature case
//                                    within this generic-apple peer group)
//   213 YSL Y EDP                 -- 8 (raised from 5: real-world widely
//                                    perceived as strongly apple-forward
//                                    -- see the canonical-data finding
//                                    below for why this stays under the
//                                    generic apple key rather than being
//                                    reclassified to greenApple)
//   28  Tous Man                  -- 5 (unchanged: 1 of 2 middle notes,
//                                    "fruity" accord support)
//   33  Jaguar Pace                -- 4 (unchanged: 1 of 3 top notes, no
//                                    "fruity" accord support)
//   114 Game of Spades Wildcard   -- 4 (unchanged: 1 of 3 top notes, no
//                                    "fruity" accord support)
//   19  Club de Nuit Intense Man  -- unscored (5th-billed top note in a
//                                    composition whose real identity is
//                                    already covered by pineapple/birch/
//                                    blackCurrant/ambergris; genuine
//                                    confidence for an independent apple
//                                    signal is insufficient)
//
// greenApple -- 1 fragrance (Carlisle, id 403). No peer to compare
// against. Stays unscored, consistent with Carlisle's deliberately
// conservative Phase 2J treatment (previously dropped from an earlier
// Phase 2C draft for leaning on textual consensus) -- no new evidence
// emerged in this pass to justify a score.
//
// redApple -- 2 fragrances. Final calibrated scores, high to low:
//   211 Born In Roma Coral Fantasy -- 7 (raised from 5: real-world
//                                     strongly associated with red apple,
//                                     one of only 3 top notes in a
//                                     simpler, fruit-forward flanker)
//   4   Legend EDT                 -- 6 (unchanged: a genuine, well-
//                                     documented supporting note in
//                                     Montblanc Legend's classic
//                                     lavender-apple-tonka formula, but
//                                     1 of 6 middle notes in a more
//                                     crowded composition)
//
// candyApple -- 1 fragrance (Eros EDP, id 6). No peer to compare against.
// Newly scored (was unscored): 5 -- a real, "sweet"-accord-corroborated
// top-note facet of this well-known mainstream fragrance's playful
// character, judged on its own compositional merits.
//
// mint -- 4 fragrances. Final calibrated scores, high to low:
//   408 Torino21                  -- 9 (unchanged from Phase 3A: the
//                                    flagship mint-forward reference in
//                                    the catalog)
//   5   Le Male                   -- 7 (raised from 6: mint-lavender is
//                                    the well-documented, genuinely
//                                    signature top-note pairing this
//                                    fragrance is famous for pioneering)
//   110 Concentré d'Orange Verte  -- 6 (unchanged: a real, moderate
//                                    presence corroborated by its "green"
//                                    accord, 1 of 8 generalNotes)
//   6   Eros EDP                  -- 5 (unchanged: a well-known, quite
//                                    noticeable icy-fresh top accord)
//
// spearmint -- 2 fragrances. Final calibrated scores, high to low:
//   22  Legend Blue               -- 7 (raised from 6: co-equal billing
//                                    with lavender as 1 of only 2 top
//                                    notes, a meaningfully concentrated
//                                    composition)
//   103 Mandarino di Sicilia      -- 5 (unchanged: a supporting facet
//                                    beneath the dominant greenMandarin
//                                    citrus identity)
//
// Canonical-data finding (Step 2), reported rather than silently acted
// on: YSL Y EDP (213) uses the generic apple key, and is real-world
// widely perceived as green-apple-forward. This was judged NOT clearly
// enough defensible to reclassify as greenApple -- most official/
// perfumer note breakdowns for this exact release still say "apple," not
// "green apple," unlike Carlisle's genuinely distinct greenApple listing
// -- so its canonical key is left unchanged, and its strong real-world
// apple association is instead reflected as a high score (8) under the
// generic apple key it already carries. No canonical note data was
// changed in this phase.
const APPLE_FAMILY = {
  19: undefined,
  28: 5,
  33: 4,
  114: 4,
  213: 8,
  404: 9,
};

const GREEN_APPLE_FAMILY = {
  403: undefined,
};

const RED_APPLE_FAMILY = {
  4: 6,
  211: 7,
};

const CANDY_APPLE_FAMILY = {
  6: 5,
};

const MINT_FAMILY = {
  5: 7,
  6: 5,
  110: 6,
  408: 9,
};

const SPEARMINT_FAMILY = {
  22: 7,
  103: 5,
};

const ALL_FAMILIES = {
  apple: APPLE_FAMILY,
  greenApple: GREEN_APPLE_FAMILY,
  redApple: RED_APPLE_FAMILY,
  candyApple: CANDY_APPLE_FAMILY,
  mint: MINT_FAMILY,
  spearmint: SPEARMINT_FAMILY,
};

// The exact, unrelated prominence values on every touched fragrance,
// pinned so this phase is provably scoped to only the six keys above.
const UNRELATED_VALUES_BY_ID = {
  4: { lavender: 7, tonkaBean: 6 },
  5: { lavender: 9, vanilla: 8, tonkaBean: 5 },
  6: { ambroxan: 7, vanilla: 7 },
  19: { pineapple: 8, birch: 7, blackCurrant: 6, ambergris: 5 },
  22: { ambroxan: 5, sandalwood: 4 },
  28: { orange: 6, amber: 5 },
  33: { cashmeran: 6, patchouli: 5 },
  103: { greenMandarin: 7, petitgrain: 5 },
  110: { orange: 8, patchouli: 5, bitterOrange: 5, basil: 8 },
  114: { ambroxan: 6 },
  211: { tobacco: 6 },
  213: { ginger: 6, sage: 5 },
  403: { tonkaBean: 5, vanilla: 5 },
  404: { lavender: 8, vanilla: 7, cardamom: 4, coumarin: 4 },
  408: { basil: 8, rosemary: 5, blackCurrant: 3 },
};

function getPerfumeNoteIds(perfume) {
  return [
    ...(perfume.topNotes || []),
    ...(perfume.middleNotes || []),
    ...(perfume.baseNotes || []),
    ...(perfume.generalNotes || []),
  ];
}

describe("Composer Phase 3B taxonomy audit", () => {
  it("finds exactly these 4 canonical apple-family keys in the note dictionary, with distinct display names", () => {
    expect(notes.apple).toMatchObject({ name: "Apple" });
    expect(notes.greenApple).toMatchObject({ name: "Green Apple" });
    expect(notes.redApple).toMatchObject({ name: "Red Apple" });
    expect(notes.candyApple).toMatchObject({ name: "Candy Apple" });
  });

  it("finds exactly these 2 canonical mint-family keys in the note dictionary, with distinct display names", () => {
    expect(notes.mint).toMatchObject({ name: "Mint" });
    expect(notes.spearmint).toMatchObject({ name: "Spearmint" });
  });

  it("excludes pineapple -- it is a semantically unrelated fruit note, not an apple variant, despite the substring match", () => {
    expect(notes.pineapple).toMatchObject({ name: "Pineapple" });
    expect(APPLE_FAMILY).not.toHaveProperty("pineapple");
    // Confirm no fragrance's pineapple prominence was ever touched by this
    // phase by checking a representative pineapple-carrying fragrance.
    expect(NOTE_PROMINENCE_BY_ID[19].pineapple).toBe(8);
  });
});

describe("Composer Phase 3B horizontal calibration -- apple and mint canonical-key families", () => {
  const perfumesById = new Map(perfumes.map((perfume) => [perfume.id, perfume]));

  it("has exactly 87 catalog fragrances to search for exhaustive family membership", () => {
    expect(perfumes).toHaveLength(87);
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

  it("keeps every calibrated apple/mint-family value an integer from 1 to 10", () => {
    for (const family of Object.values(ALL_FAMILIES)) {
      for (const [id, score] of Object.entries(family)) {
        if (score === undefined) continue;
        expect(Number.isInteger(score), `id ${id}`).toBe(true);
        expect(score).toBeGreaterThanOrEqual(1);
        expect(score).toBeLessThanOrEqual(10);
      }
    }
  });

  it("never collapses distinct canonical keys into one another -- a fragrance scored under one apple/mint variant never also silently carries a different variant's score", () => {
    // Every fragrance in this phase belongs to exactly one apple-family
    // key and/or exactly one mint-family key (no fragrance carries two
    // variants of the same family in this catalog), so each entry's
    // apple-family keys and mint-family keys are each a singleton.
    const appleKeys = ["apple", "greenApple", "redApple", "candyApple"];
    const mintKeys = ["mint", "spearmint"];
    const allTouchedIds = new Set(Object.values(ALL_FAMILIES).flatMap((family) => Object.keys(family).map(Number)));

    for (const id of allTouchedIds) {
      const entry = NOTE_PROMINENCE_BY_ID[id] || {};
      const presentAppleKeys = appleKeys.filter((key) => key in entry);
      const presentMintKeys = mintKeys.filter((key) => key in entry);
      expect(presentAppleKeys.length, `${perfumesById.get(id).name} apple-family keys`).toBeLessThanOrEqual(1);
      expect(presentMintKeys.length, `${perfumesById.get(id).name} mint-family keys`).toBeLessThanOrEqual(1);
    }
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

  it("leaves every unrelated prominence value on each touched fragrance exactly as it was -- this phase only touches the six apple/mint canonical keys", () => {
    const appleKeys = ["apple", "greenApple", "redApple", "candyApple"];
    const mintKeys = ["mint", "spearmint"];

    for (const [id, unrelatedValues] of Object.entries(UNRELATED_VALUES_BY_ID)) {
      const liveEntry = { ...NOTE_PROMINENCE_BY_ID[id] };
      for (const key of [...appleKeys, ...mintKeys]) delete liveEntry[key];

      expect(liveEntry, `${perfumesById.get(Number(id)).name}`).toEqual(unrelatedValues);
    }
  });

  it("leaves every touched fragrance's canonical note pyramid exactly as it was -- no canonical note data was changed in this phase", () => {
    expect(perfumesById.get(4)).toMatchObject({
      name: "Legend EDT",
      middleNotes: ["redApple", "driedFruits", "oakmoss", "geranium", "coumarin", "rose"],
    });
    expect(perfumesById.get(5)).toMatchObject({
      name: "Le Male",
      topNotes: ["lavender", "mint", "cardamom", "bergamot", "artemisia"],
    });
    expect(perfumesById.get(6)).toMatchObject({
      name: "Eros EDP",
      topNotes: ["mint", "candyApple", "lemon", "mandarinOrange"],
    });
    expect(perfumesById.get(19)).toMatchObject({
      name: "Club de Nuit Intense Man",
      topNotes: ["lemon", "pineapple", "bergamot", "blackCurrant", "apple"],
    });
    expect(perfumesById.get(22)).toMatchObject({
      name: "Legend Blue",
      topNotes: ["spearmint", "lavender"],
    });
    expect(perfumesById.get(28)).toMatchObject({
      name: "Tous Man",
      middleNotes: ["apple", "pineapple"],
    });
    expect(perfumesById.get(33)).toMatchObject({
      name: "Jaguar Pace",
      topNotes: ["blackPepper", "apple", "rosemary"],
    });
    expect(perfumesById.get(103)).toMatchObject({
      name: "Mandarino di Sicilia",
      middleNotes: ["petitgrain", "spearmint"],
    });
    expect(perfumesById.get(110)).toMatchObject({
      name: "Concentré d'Orange Verte",
      generalNotes: expect.arrayContaining(["mint"]),
    });
    expect(perfumesById.get(114)).toMatchObject({
      name: "Game of Spades Wildcard",
      topNotes: ["bergamot", "lemon", "apple"],
    });
    expect(perfumesById.get(211)).toMatchObject({
      name: "Born In Roma Coral Fantasy",
      topNotes: ["redApple", "cardamom", "bergamot"],
    });
    expect(perfumesById.get(213)).toMatchObject({
      name: "YSL Y EDP",
      topNotes: ["apple", "ginger", "bergamot"],
    });
    expect(perfumesById.get(403)).toMatchObject({
      name: "Carlisle",
      topNotes: ["nutmeg", "greenApple", "saffron"],
    });
    expect(perfumesById.get(404)).toMatchObject({
      name: "Layton",
      topNotes: ["apple", "lavender", "bergamot", "mandarin"],
    });
    expect(perfumesById.get(408)).toMatchObject({
      name: "Torino21",
      topNotes: ["mint", "lemon", "basil"],
    });
  });

  // The Note Explorer "Most prominent" sort verification for each of the
  // six canonical keys against these exact calibrated scores lives in
  // packages/builder/src/builder/internal/intelligence/buildNoteExplorerViewModel.test.js
  // instead of here -- packages/catalog must never import from
  // packages/builder (ADR-0006), and this file already proves the
  // underlying data (membership, scores, containment) that sort depends on.
});
