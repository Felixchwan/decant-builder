import { describe, expect, it } from "vitest";
import { createBuilderConfig } from "../../config/createBuilderConfig.js";
import {
  buildComposerBoxProposal,
  buildComposerProposalInputKey,
  isComposerBoxProposalStale,
} from "./buildComposerBoxProposal.js";
import {
  addSelectedPerfume,
  canAddPerfume,
  removeSelectedPerfumeAtIndex,
} from "../selection/selectionState.js";

// Composer Phase 1: individual suggestion selection. These tests exercise the
// boundary between a generated Composer proposal (buildComposerBoxProposal,
// untouched by this feature) and the sanctioned selection-state mutation path
// (selectionState.js, likewise untouched) that the Composer proposal modal's
// per-suggestion "Add" action calls into -- the same path every other "add a
// suggested perfume" affordance in BuilderPanel already uses (DNA modal
// expansion picks, RecommendationCard, hidden curator picks). No new state
// container or mutation path is introduced; these tests prove the
// composition holds, not any new primitive.
//
// Which of the fixture catalog's 5 perfumes actually become
// proposal.addedPerfumes is decided by Composer's own diversity/greedy
// scoring (untouched here) -- e.g. two similarly-"warm/dark" fixtures may
// not both be picked even with slots to spare. Tests below read the real
// addedPerfumes list back off the generated proposal rather than assuming
// which named fixtures survive, so they stay valid regardless of exactly
// which subset Composer's own intelligence selects.
//
// The second half of this file exercises the stale-proposal distinction:
// individually consuming this proposal's OWN suggestions must not disable
// the whole-proposal Apply action, but a genuinely invalidating change (an
// unrelated selection edit, or a changed Composer input) still must. See
// BuilderRuntime.jsx's composerProposalAddedIds/
// selectedPerfumesForComposerStaleCheck/composerInputKey for the real
// wiring; buildStaleCheckInputKey below mirrors that exact filtering logic
// against the real buildComposerProposalInputKey/isComposerBoxProposalStale
// functions (BuilderRuntime's App component is never rendered directly in
// this package's own tests -- see BuilderRuntime.test.jsx -- so the wiring
// itself is covered there as a source-contract check; this file proves the
// underlying primitives compose to the intended behavior).

const config = createBuilderConfig({
  brand: {
    businessName: "Discovery Decants",
    displayName: "Discovery Decants",
    shortName: "Discovery",
    heading: "Discovery Decants",
  },
  box: {
    minSelectableSlots: 3,
    maxSelectableSlots: 4,
    defaultTargetSlots: 4,
  },
  commerce: {
    pointValue: 100,
    currency: "USD",
  },
  collectionCard: {
    brandHeading: "Discovery Decants",
  },
  finalization: {
    whatsappNumber: "528129800010",
  },
});

function perfume(id, overrides = {}) {
  return {
    id,
    name: `Perfume ${id}`,
    shortName: `P${id}`,
    brand: "Test House",
    points: 1,
    tier: "bronze",
    image: `/images/${id}.png`,
    seasons: ["spring"],
    occasions: ["day"],
    vibes: ["fresh"],
    accords: ["citrus", "aromatic"],
    topNotes: ["bergamot"],
    middleNotes: ["lavender"],
    baseNotes: ["cedar"],
    seasonWeights: { spring: 8, summer: 8, fall: 2, winter: 0 },
    ...overrides,
  };
}

const fresh = perfume(1, { vibes: ["fresh", "clean"] });
const green = perfume(2, { vibes: ["green", "clean"] });
const amber = perfume(3, { vibes: ["warm", "dark"], points: 1.5, tier: "silver" });
const formal = perfume(4, { vibes: ["elegant", "woody"], points: 2, tier: "gold" });
const smoky = perfume(5, { vibes: ["warm", "cozy", "dark"], points: 2.5, tier: "platinum" });
const catalog = [fresh, green, amber, formal, smoky];
// Deliberately outside the catalog Composer was given -- stands in for an
// unrelated perfume the user adds manually that has nothing to do with this
// proposal's own suggestions.
const outsider = perfume(6, { name: "Outsider" });

const baseComposerArgs = {
  excludedPerfumeIds: [],
  strategy: "balanced",
  collectionStyle: "balanced_mix",
  budget: null,
  targetSlots: 4,
  minSlots: 3,
  maxSlots: 4,
  seasons: [],
  occasions: [],
  vibes: [],
  catalog,
  config,
};

function buildProposal(options = {}) {
  return buildComposerBoxProposal({
    selectedPerfumes: [],
    notes: {},
    ...baseComposerArgs,
    ...options,
  });
}

// Mirrors BuilderRuntime.jsx's addPerfume()/handleApplyComposerProposal()
// exactly: addPerfume calls canAddPerfume then addSelectedPerfume; apply maps
// proposal.apply.collectionIds back through the live catalog.
function applyWholeProposal(proposal, liveCatalog) {
  const catalogById = new Map(liveCatalog.map((item) => [item.id, item]));
  const nextSelectedPerfumes = proposal.apply.collectionIds
    .map((id) => catalogById.get(id))
    .filter(Boolean);

  if (nextSelectedPerfumes.length !== proposal.apply.collectionIds.length) {
    return null;
  }

  return nextSelectedPerfumes;
}

// Mirrors BuilderRuntime.jsx's composerInputKey computation exactly:
// subtract the proposal's OWN current addedPerfumes ids from the live box
// before building the comparison key, so consuming the proposal's own
// suggestions individually is invisible to the staleness check, while any
// other live-selection change (or a changed strategy/budget/preference/
// catalog input) still changes the key and is still caught.
function buildStaleCheckInputKey(proposal, liveSelectedPerfumes, overrides = {}) {
  const addedIds = new Set((proposal?.addedPerfumes || []).map((item) => item.id));
  const filtered = liveSelectedPerfumes.filter((item) => !addedIds.has(item.id));
  return buildComposerProposalInputKey({
    selectedPerfumes: filtered,
    ...baseComposerArgs,
    ...overrides,
  });
}

function isStale(proposal, liveSelectedPerfumes, overrides = {}) {
  return isComposerBoxProposalStale(
    proposal,
    buildStaleCheckInputKey(proposal, liveSelectedPerfumes, overrides)
  );
}

describe("Composer proposal individual selection", () => {
  it("adds exactly one suggested fragrance independently, leaving its siblings unselected", () => {
    const proposal = buildProposal();
    const [firstSuggestion, secondSuggestion] = proposal.addedPerfumes;

    const selectedAfterAdd = addSelectedPerfume({
      selectedPerfumes: [],
      perfume: firstSuggestion,
      maxSelectableSlots: config.box.maxSelectableSlots,
    });

    expect(selectedAfterAdd.map((item) => item.id)).toEqual([firstSuggestion.id]);
    expect(selectedAfterAdd.some((item) => item.id === secondSuggestion.id)).toBe(false);
  });

  it("refuses to duplicate a suggestion that was already added individually", () => {
    const proposal = buildProposal();
    const suggestion = proposal.addedPerfumes[0];
    const selectedPerfumes = addSelectedPerfume({
      selectedPerfumes: [],
      perfume: suggestion,
      maxSelectableSlots: config.box.maxSelectableSlots,
    });

    expect(
      canAddPerfume({ selectedPerfumes, perfume: suggestion, maxSelectableSlots: config.box.maxSelectableSlots })
    ).toEqual({ allowed: false, reason: "duplicate" });

    const secondAttempt = addSelectedPerfume({
      selectedPerfumes,
      perfume: suggestion,
      maxSelectableSlots: config.box.maxSelectableSlots,
    });
    expect(secondAttempt).toBe(selectedPerfumes);
    expect(secondAttempt.map((item) => item.id)).toEqual([suggestion.id]);
  });

  it("restores the addable state once an individually added suggestion is removed via the normal collection UI", () => {
    const proposal = buildProposal();
    const suggestion = proposal.addedPerfumes[0];
    let selectedPerfumes = addSelectedPerfume({
      selectedPerfumes: [],
      perfume: suggestion,
      maxSelectableSlots: config.box.maxSelectableSlots,
    });

    selectedPerfumes = removeSelectedPerfumeAtIndex({ selectedPerfumes, index: 0 });

    expect(selectedPerfumes).toEqual([]);
    expect(
      canAddPerfume({ selectedPerfumes, perfume: suggestion, maxSelectableSlots: config.box.maxSelectableSlots })
    ).toEqual({ allowed: true, reason: null });
  });

  // Named after the request's illustrative "A, B, C, D, E" scenario: two
  // non-adjacent suggestions (the 1st and 3rd of the proposal's own
  // addedPerfumes) are added individually, mirroring "add A and C".
  describe("whole-proposal action after partial individual consumption (suggestions A and C added from A/B/C/D)", () => {
    function addFirstAndThird(proposal) {
      const [suggestionA, suggestionB, suggestionC, ...restSuggestions] = proposal.addedPerfumes;
      let selectedPerfumes = addSelectedPerfume({
        selectedPerfumes: [],
        perfume: suggestionA,
        maxSelectableSlots: config.box.maxSelectableSlots,
      });
      selectedPerfumes = addSelectedPerfume({
        selectedPerfumes,
        perfume: suggestionC,
        maxSelectableSlots: config.box.maxSelectableSlots,
      });
      return { selectedPerfumes, suggestionA, suggestionB, suggestionC, restSuggestions };
    }

    it("adds A individually, then C individually, while B/D remain untouched and individually addable", () => {
      const proposal = buildProposal();
      expect(proposal.addedPerfumes.length).toBeGreaterThanOrEqual(3);
      const { selectedPerfumes, suggestionA, suggestionB, suggestionC, restSuggestions } =
        addFirstAndThird(proposal);

      expect(selectedPerfumes.map((item) => item.id)).toEqual([suggestionA.id, suggestionC.id]);

      // A and C now show as already-added (live membership); B and any
      // remaining suggestions stay eligible for their own individual Add.
      for (const suggestion of [suggestionA, suggestionC]) {
        expect(
          canAddPerfume({ selectedPerfumes, perfume: suggestion, maxSelectableSlots: config.box.maxSelectableSlots })
        ).toEqual({ allowed: false, reason: "duplicate" });
      }
      for (const suggestion of [suggestionB, ...restSuggestions]) {
        expect(
          canAddPerfume({ selectedPerfumes, perfume: suggestion, maxSelectableSlots: config.box.maxSelectableSlots })
        ).toEqual({ allowed: true, reason: null });
      }
    });

    it("keeps the whole-proposal action usable (not stale) after individually adding A and C", () => {
      const proposal = buildProposal();
      const { selectedPerfumes } = addFirstAndThird(proposal);

      expect(isStale(proposal, selectedPerfumes)).toBe(false);
    });

    it("applies the remaining eligible suggestions without duplicating A or C, respecting capacity", () => {
      const proposal = buildProposal();
      const { selectedPerfumes, suggestionA, suggestionC } = addFirstAndThird(proposal);

      expect(isStale(proposal, selectedPerfumes)).toBe(false);

      const applied = applyWholeProposal(proposal, catalog);

      expect(applied).not.toBeNull();
      const appliedIds = applied.map((item) => item.id);
      expect(appliedIds).toEqual(proposal.apply.collectionIds);
      expect(new Set(appliedIds).size).toBe(appliedIds.length);
      expect(appliedIds.filter((id) => id === suggestionA.id)).toHaveLength(1);
      expect(appliedIds.filter((id) => id === suggestionC.id)).toHaveLength(1);
      expect(appliedIds).toEqual(expect.arrayContaining(proposal.addedPerfumes.map((item) => item.id)));
      expect(applied.length).toBeLessThanOrEqual(config.box.maxSelectableSlots);
    });

    it("makes A's individual action available again after removing it, and returns the proposal to non-stale", () => {
      const proposal = buildProposal();
      const { selectedPerfumes: afterBothAdds, suggestionA, suggestionC } = addFirstAndThird(proposal);

      const indexOfA = afterBothAdds.findIndex((item) => item.id === suggestionA.id);
      const selectedPerfumes = removeSelectedPerfumeAtIndex({ selectedPerfumes: afterBothAdds, index: indexOfA });

      expect(selectedPerfumes.map((item) => item.id)).toEqual([suggestionC.id]);
      expect(
        canAddPerfume({ selectedPerfumes, perfume: suggestionA, maxSelectableSlots: config.box.maxSelectableSlots })
      ).toEqual({ allowed: true, reason: null });
      expect(isStale(proposal, selectedPerfumes)).toBe(false);
    });
  });

  describe("genuine staleness is preserved for actually invalidating changes", () => {
    it("marks the proposal stale when the live box gains a perfume the proposal never suggested", () => {
      const proposal = buildProposal();
      const selectedPerfumes = addSelectedPerfume({
        selectedPerfumes: [],
        perfume: outsider,
        maxSelectableSlots: config.box.maxSelectableSlots,
      });

      expect(isStale(proposal, selectedPerfumes)).toBe(true);
    });

    it("marks the proposal stale when a preserved (pre-existing) box item is removed, even though no proposal suggestion was touched", () => {
      const proposal = buildProposal({ selectedPerfumes: [green] });
      expect(proposal.preservedPerfumes.map((item) => item.id)).toEqual([green.id]);

      expect(isStale(proposal, [green])).toBe(false);

      // green removed from the live box via the normal collection UI.
      expect(isStale(proposal, [])).toBe(true);
    });

    it("marks the proposal stale when the Composer strategy/budget changes, independent of any selection edit", () => {
      const proposal = buildProposal();

      expect(isStale(proposal, [])).toBe(false);
      expect(isStale(proposal, [], { strategy: "signature" })).toBe(true);
      expect(isStale(proposal, [], { budget: 500 })).toBe(true);
    });
  });
});
