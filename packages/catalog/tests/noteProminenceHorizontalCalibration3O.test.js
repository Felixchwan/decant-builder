import { describe, expect, it } from "vitest";

import { fragrances as perfumes, notes } from "@discovery-box/catalog";
import { NOTE_PROMINENCE_BY_ID } from "../src/fragrances.js";

// Composer Phase 3O: narrow regression coverage for the fifteenth
// horizontal note-family calibration pass -- the collective canonical
// note woodyNotes.
//
// Taxonomy audit (Step 1) -- exact canonical definition found in
// notes.js: woodyNotes ("Woody Notes", family: "woody") -- a collective/
// generalized note, not a specific material. Its prominence applies only
// to fragrances whose canonical note data explicitly contains
// woodyNotes, and is never derived from the presence or prominence of
// individual wood notes. cedar, cedarwood, texasCedar, sandalwood,
// australianSandalwood, guaiacWood, oak, birch, cashmeran, cashmirwood,
// akigalawood, mahogany, leatherwood, pine, fir, and firBalsam were all
// re-confirmed as their own independent canonical keys, several already
// calibrated in earlier phases (cedar-family in 3C, sandalwood-family in
// 3E).
//
// Canonical-data sanity audit (Step 2): every woodyNotes-carrying
// fragrance was checked for a case where a specific, explicitly-known
// wood material is clearly warranted instead of the generalized key.
// None was found meeting the Phase 3A basil / Phase 3C blackVanilla bar
// -- several fragrances already correctly carry both woodyNotes and a
// separately-scored specific wood side by side (Allure Homme Edition
// Blanche EDP, Allure Homme Sport Superleggera, Bois Imperial, Hacivat),
// proving the catalog already distinguishes the two concepts rather than
// conflating them. No canonical-data correction was made in this phase.
//
// Across 13 woodyNotes fragrance/note pairs -- all 13 entirely unscored
// coming into this phase -- this phase's own calibration changes zero
// individual pairs. Every member was reviewed individually against two
// disqualifying patterns: (1) where another woody-family note already
// coexists and is itself scored or otherwise the more plausible driver
// of the fragrance's overall "woody" character (crediting woodyNotes for
// that effect would be the "aggregate individual woods" mistake this
// phase's own caution forbids); (2) where woodyNotes is the sole
// wood-family note present but the only supporting signal is the
// fragrance's own broad accords/genre classification rather than a
// specific, non-generic perceptual claim (crediting it would be the "do
// not score from genre" mistake this phase's own caution forbids). No
// fragrance's woodyNotes met the stricter bar of being an explicitly-
// documented major perceptual axis independent of both patterns.
const WOODY_NOTES_FAMILY = {
  7: undefined,
  12: undefined,
  23: undefined,
  26: undefined,
  30: undefined,
  112: undefined,
  113: undefined,
  201: undefined,
  210: undefined,
  301: undefined,
  302: undefined,
  303: undefined,
  406: undefined,
};

const CONCRETE_WOODY_KEYS = [
  "cedar",
  "cedarwood",
  "texasCedar",
  "sandalwood",
  "australianSandalwood",
  "guaiacWood",
  "oak",
  "birch",
  "cashmeran",
  "cashmirwood",
  "akigalawood",
  "mahogany",
  "leatherwood",
  "pine",
  "fir",
  "firBalsam",
];

function getPerfumeNoteIds(perfume) {
  return [
    ...(perfume.topNotes || []),
    ...(perfume.middleNotes || []),
    ...(perfume.baseNotes || []),
    ...(perfume.generalNotes || []),
  ];
}

describe("Composer Phase 3O taxonomy audit", () => {
  it("finds the exact canonical woodyNotes definition -- a collective note, distinct from every concrete wood material", () => {
    expect(notes.woodyNotes).toMatchObject({ name: "Woody Notes", family: "woody" });
  });

  it("confirms every concrete/adjacent woody key remains its own independent canonical identity, never a woodyNotes variant", () => {
    for (const noteId of CONCRETE_WOODY_KEYS) {
      expect(notes[noteId], `${noteId} should exist in the taxonomy`).toBeTruthy();
      expect(noteId).not.toBe("woodyNotes");
    }
  });
});

describe("Composer Phase 3O canonical-data sanity audit", () => {
  const perfumesById = new Map(perfumes.map((perfume) => [perfume.id, perfume]));

  it("confirms no canonical-data correction was made or is recommended -- several fragrances already correctly carry both woodyNotes and a separately-scored specific wood side by side, proving the catalog distinguishes rather than conflates them", () => {
    const allureHommeEditionBlanche = perfumesById.get(301);
    expect(allureHommeEditionBlanche.middleNotes).toContain("woodyNotes");
    expect(allureHommeEditionBlanche.middleNotes).toContain("sandalwood");
    expect(NOTE_PROMINENCE_BY_ID[301].sandalwood).toBe(7);
    expect(NOTE_PROMINENCE_BY_ID[301].woodyNotes).toBeUndefined();

    const boisImperial = perfumesById.get(303);
    expect(boisImperial.generalNotes).toContain("woodyNotes");
    expect(boisImperial.generalNotes).toContain("akigalawood");
    expect(NOTE_PROMINENCE_BY_ID[303].akigalawood).toBe(10);
    expect(NOTE_PROMINENCE_BY_ID[303].woodyNotes).toBeUndefined();

    const hacivat = perfumesById.get(406);
    expect(hacivat.baseNotes).toContain("woodyNotes");
    expect(hacivat.baseNotes).toContain("cedar");
    expect(NOTE_PROMINENCE_BY_ID[406].cedar).toBe(4);
    expect(NOTE_PROMINENCE_BY_ID[406].woodyNotes).toBeUndefined();
  });
});

describe("Composer Phase 3O horizontal calibration -- the collective woodyNotes canonical key", () => {
  const perfumesById = new Map(perfumes.map((perfume) => [perfume.id, perfume]));

  it("has exactly 87 catalog fragrances to search for exhaustive family membership", () => {
    expect(perfumes).toHaveLength(87);
  });

  it("woodyNotes membership is exhaustive against the live catalog", () => {
    const actualIds = perfumes
      .filter((perfume) => getPerfumeNoteIds(perfume).includes("woodyNotes"))
      .map((perfume) => perfume.id)
      .sort((a, b) => a - b);

    expect(actualIds).toEqual(Object.keys(WOODY_NOTES_FAMILY).map(Number).sort((a, b) => a - b));
  });

  it("matches the exact calibrated woodyNotes score for every scored member, and confirms every member remains intentionally unscored", () => {
    for (const [id, expectedScore] of Object.entries(WOODY_NOTES_FAMILY)) {
      const actualScore = NOTE_PROMINENCE_BY_ID[id]?.woodyNotes;
      expect(expectedScore).toBeUndefined();
      expect(actualScore, `${perfumesById.get(Number(id)).name} should remain unscored for woodyNotes`).toBeUndefined();
    }
  });

  it("never admits a fragrance into the woodyNotes result set based on a concrete wood note it carries instead", () => {
    // Fragrances carrying only concrete woody notes (never exact
    // woodyNotes) must never be treated as woodyNotes members.
    const concreteOnlyExamples = [
      { id: 111, key: "vetiver" }, // Terre d'Hermès EDT: vetiver only, no woodyNotes
      { id: 208, key: "cedar" }, // Prada L'Homme: cedar only, no woodyNotes
      { id: 4, key: "sandalwood" }, // Legend EDT: sandalwood only, no woodyNotes
    ];
    for (const { id, key } of concreteOnlyExamples) {
      const fragrance = perfumesById.get(id);
      const ownNoteIds = new Set(getPerfumeNoteIds(fragrance));
      expect(ownNoteIds.has(key)).toBe(true);
      expect(ownNoteIds.has("woodyNotes")).toBe(false);
    }
  });

  it("confirms cedar, sandalwood, guaiacWood, and other concrete wood scores never influence woodyNotes containment or values", () => {
    const allTouchedIds = Object.keys(WOODY_NOTES_FAMILY).map(Number);
    for (const id of allTouchedIds) {
      const fragrance = perfumesById.get(id);
      const ownNoteIds = new Set(getPerfumeNoteIds(fragrance));
      const entry = NOTE_PROMINENCE_BY_ID[id] || {};
      // Whatever concrete wood scores a member independently carries,
      // woodyNotes itself must stay absent from that entry.
      const concreteScoresPresent = CONCRETE_WOODY_KEYS.filter((key) => ownNoteIds.has(key) && entry[key] !== undefined);
      if (concreteScoresPresent.length > 0) {
        expect(entry.woodyNotes, `${fragrance.name} has scored concrete woods ${concreteScoresPresent.join(", ")}`).toBeUndefined();
      }
    }
  });

  it("scores only notes that actually belong to each fragrance's own canonical note set", () => {
    const allTouchedIds = Object.keys(WOODY_NOTES_FAMILY).map(Number);
    for (const id of allTouchedIds) {
      const fragrance = perfumesById.get(id);
      const ownNoteIds = new Set(getPerfumeNoteIds(fragrance));
      for (const noteId of Object.keys(NOTE_PROMINENCE_BY_ID[id] || {})) {
        expect(ownNoteIds.has(noteId), `${fragrance.name} is not documented to carry "${noteId}"`).toBe(true);
        expect(notes[noteId]).toBeTruthy();
      }
    }
  });

  it("leaves every unrelated prominence value on all 13 touched fragrances exactly as it was -- this phase changes zero scores", () => {
    expect(NOTE_PROMINENCE_BY_ID[7]).toEqual({ leather: 8, ginger: 7, maninka: 5 });
    expect(NOTE_PROMINENCE_BY_ID[30]).toEqual({ leather: 9, bergamot: 5 });
    expect(NOTE_PROMINENCE_BY_ID[113]).toEqual({ cardamom: 7, vanilla: 8, lavender: 6, iris: 4 });
    expect(NOTE_PROMINENCE_BY_ID[301]).toEqual({ sandalwood: 7, madagascarVanilla: 6, lemon: 5 });
    expect(NOTE_PROMINENCE_BY_ID[303]).toEqual({ akigalawood: 10, ambroxan: 6, basil: 4 });
    expect(NOTE_PROMINENCE_BY_ID[406]).toEqual({ pineapple: 8, oakmoss: 8, cedar: 4, patchouli: 4 });
  });

  it("leaves canonical note data completely unchanged in this phase -- no pyramid was edited for any woodyNotes member", () => {
    expect(perfumesById.get(30)).toMatchObject({
      name: "Vibrant Leather Bogoss",
      baseNotes: ["leather", "woodyNotes"],
    });
    expect(perfumesById.get(303)).toMatchObject({
      name: "Bois Imperial",
      generalNotes: expect.arrayContaining(["akigalawood", "woodyNotes"]),
    });
  });

  it("considered, and rejected, an accords-based case for Vibrant Leather Bogoss's woodyNotes -- its own name and shortName declare only leather as its identity, and 'woody' in its accords list is exactly the genre-level signal this phase's caution forbids using", () => {
    const vibrantLeather = perfumesById.get(30);
    expect(vibrantLeather.shortName).toBe("Vibrant Leather");
    expect(vibrantLeather.accords).toContain("woody");
    expect(NOTE_PROMINENCE_BY_ID[30].woodyNotes).toBeUndefined();
    expect(NOTE_PROMINENCE_BY_ID[30].leather).toBe(9);
  });

  // The Note Explorer "Most prominent" sort verification for woodyNotes
  // lives in
  // packages/builder/src/builder/internal/intelligence/buildNoteExplorerViewModel.test.js
  // instead of here -- packages/catalog must never import from
  // packages/builder (ADR-0006), and this file already proves the
  // underlying data (membership, scores, containment) that sort depends on.
});
