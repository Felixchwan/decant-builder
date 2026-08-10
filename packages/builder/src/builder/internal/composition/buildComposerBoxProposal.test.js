import { describe, expect, it } from "vitest";
import { fragrances as realCatalog, notes as realNotes } from "@discovery-box/catalog";
import { discoveryDecantsConfig } from "../../../../../../src/merchants/discoveryDecants/config.js";
import { createBuilderConfig } from "../../config/createBuilderConfig.js";
import {
  buildComposerBoxProposal,
  buildComposerProposalInputKey,
  COMPOSER_BOX_PROPOSAL_STATUSES,
  isComposerBoxProposalStale,
  moveComposerProposalSlotAlternative,
  selectComposerProposalSlotAlternative,
} from "./buildComposerBoxProposal.js";
import { buildComposerSlotAlternatives } from "./buildComposerSlotAlternatives.js";

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

const fresh = perfume(1, {
  seasons: ["spring", "summer"],
  occasions: ["day", "office", "casual"],
  vibes: ["fresh", "clean"],
  accords: ["citrus", "aromatic", "green"],
  seasonWeights: { spring: 8, summer: 10, fall: 2, winter: 0 },
});

const green = perfume(2, {
  seasons: ["spring", "fall"],
  occasions: ["office", "casual"],
  vibes: ["green", "clean"],
  accords: ["green", "woody", "aromatic"],
  seasonWeights: { spring: 8, summer: 5, fall: 6, winter: 2 },
});

const amber = perfume(3, {
  seasons: ["fall", "winter"],
  occasions: ["date", "night", "formal"],
  vibes: ["warm", "dark"],
  accords: ["amber", "woody", "spicy"],
  points: 1.5,
  tier: "silver",
  seasonWeights: { spring: 2, summer: 0, fall: 9, winter: 10 },
});

const formal = perfume(4, {
  seasons: ["spring", "fall", "winter"],
  occasions: ["office", "formal"],
  vibes: ["elegant", "woody"],
  accords: ["woody", "powdery", "iris"],
  points: 2,
  tier: "gold",
  seasonWeights: { spring: 6, summer: 2, fall: 8, winter: 7 },
});

const smoky = perfume(5, {
  seasons: ["fall", "winter"],
  occasions: ["date", "night"],
  vibes: ["warm", "cozy", "dark"],
  accords: ["smoky", "amber", "woody"],
  points: 2.5,
  tier: "platinum",
  seasonWeights: { spring: 0, summer: 0, fall: 8, winter: 9 },
});

const catalog = [fresh, green, amber, formal, smoky];

function build(options = {}) {
  return buildComposerBoxProposal({
    selectedPerfumes: [],
    excludedPerfumeIds: [],
    strategy: "balanced",
    budget: null,
    targetSlots: 4,
    minSlots: 3,
    maxSlots: 4,
    seasons: [],
    occasions: [],
    vibes: [],
    catalog,
    notes: {},
    config,
    ...options,
  });
}

function expectSerializable(value) {
  expect(JSON.parse(JSON.stringify(value))).toEqual(value);
  expect(JSON.stringify(value)).not.toMatch(/undefined|NaN|Infinity/);
}

describe("buildComposerBoxProposal", () => {
  it("returns a stable serializable proposal shape", () => {
    const proposal = build();

    expect(proposal).toMatchObject({
      proposalAvailable: true,
      status: expect.stringMatching(/^(completed|partial)$/),
      collection: expect.any(Array),
      collectionIds: expect.any(Array),
      addedPerfumes: expect.any(Array),
      preservedPerfumes: [],
      totalPoints: expect.any(Number),
      orderTotal: expect.any(Number),
      targetSlots: 4,
      minSlots: 3,
      maxSlots: 4,
      minimumReached: true,
      targetReached: expect.any(Boolean),
      compositionResult: expect.any(Object),
      reasoningFacts: expect.any(Object),
      explanations: expect.any(Object),
      preview: expect.any(Object),
      diagnostics: expect.any(Object),
      apply: {
        available: true,
        collectionIds: expect.any(Array),
      },
    });
    expectSerializable(proposal);
  });

  it("is deterministic and catalog-order independent", () => {
    const first = build();
    const second = build({ catalog: [...catalog].reverse() });

    expect(first.collectionIds).toEqual(second.collectionIds);
    expect(first.totalPoints).toBe(second.totalPoints);
    expect(first.preview.headline).toEqual(second.preview.headline);
  });

  it("preserves current selections as locked anchors and appends additions", () => {
    const proposal = build({
      selectedPerfumes: [green, fresh],
      seasons: ["winter"],
      occasions: ["formal"],
      vibes: ["warm"],
    });

    expect(proposal.preservedPerfumes.map((perfume) => perfume.id)).toEqual([2, 1]);
    expect(proposal.collectionIds.slice(0, 2)).toEqual([2, 1]);
    expect(proposal.collectionIds).toEqual(expect.arrayContaining([1, 2]));
    expect(new Set(proposal.collectionIds).size).toBe(proposal.collectionIds.length);
    expect(proposal.diagnostics.selectedIdsPreserved).toBe(true);
  });

  it("propagates exclusions, strategy, budget, and preferences to Composer", () => {
    const proposal = build({
      selectedPerfumes: [fresh],
      excludedPerfumeIds: [smoky.id],
      strategy: "signature",
      budget: 500,
      seasons: ["winter"],
      occasions: ["formal"],
      vibes: ["warm"],
    });

    expect(proposal.collectionIds).not.toContain(smoky.id);
    expect(proposal.totalPoints).toBeLessThanOrEqual(5);
    expect(proposal.compositionResult.normalizedRequest).toMatchObject({
      budget: 500,
      maxPoints: 5,
      strategy: {
        id: "signature",
      },
      preferredSeasons: ["winter"],
      preferredOccasions: ["formal"],
      preferredVibes: ["warm"],
      excludedPerfumeIds: [smoky.id],
    });
  });

  it("treats UI budget as money and lets Composer convert it once to max points", () => {
    const nineHundred = build({ budget: 900 });
    const thirteenFifty = build({ budget: 1350 });
    const unlimited = build({ budget: null });

    expect(nineHundred.compositionResult.normalizedRequest).toMatchObject({
      budget: 900,
      pointValue: 100,
      maxPoints: 9,
    });
    expect(thirteenFifty.compositionResult.normalizedRequest).toMatchObject({
      budget: 1350,
      pointValue: 100,
      maxPoints: 13.5,
    });
    expect(unlimited.compositionResult.normalizedRequest).toMatchObject({
      budget: null,
      maxPoints: null,
    });
    expect(thirteenFifty.orderTotal).toBe(thirteenFifty.totalPoints * 100);
  });

  it("includes selected perfume points in the total budget", () => {
    const proposal = build({
      selectedPerfumes: [formal, amber],
      budget: 500,
    });

    expect(proposal.totalPoints).toBeLessThanOrEqual(5);
    expect(proposal.orderTotal).toBeLessThanOrEqual(500);
    expect(proposal.collectionIds).toEqual(expect.arrayContaining([formal.id, amber.id]));
  });

  it("keeps Curator Bonus separate by targeting only customer-selectable slots", () => {
    const physicalConfig = createBuilderConfig({
      ...config,
      box: {
        minSelectableSlots: 3,
        maxSelectableSlots: 4,
        totalPhysicalSlots: 6,
        defaultTargetSlots: 4,
        bonusSlotCount: 2,
      },
    });
    const proposal = build({ config: physicalConfig, maxSlots: 4, targetSlots: 4 });

    expect(proposal.maxSlots).toBe(4);
    expect(proposal.targetSlots).toBe(4);
    expect(proposal.collection.length).toBeLessThanOrEqual(4);
  });

  it("fails safely for restrictive budgets and unavailable selected perfumes", () => {
    const restrictive = build({ budget: 100 });
    expect(restrictive.proposalAvailable).toBe(false);
    expect(restrictive.apply.available).toBe(false);
    expect([COMPOSER_BOX_PROPOSAL_STATUSES.IMPOSSIBLE, COMPOSER_BOX_PROPOSAL_STATUSES.FAILED]).toContain(
      restrictive.status
    );

    const unavailable = build({
      selectedPerfumes: [perfume(999)],
    });
    expect(unavailable.status).toBe(COMPOSER_BOX_PROPOSAL_STATUSES.INVALID_SELECTION);
    expect(unavailable.proposalAvailable).toBe(false);
    expect(unavailable.diagnostics.issues).toContain("SELECTED_PERFUME_MISSING:999");
  });

  it("returns non-destructive states for target, full, and over-max boxes", () => {
    const atTarget = build({
      selectedPerfumes: [fresh, green, amber, formal],
      targetSlots: 4,
    });
    expect(atTarget.status).toBe(COMPOSER_BOX_PROPOSAL_STATUSES.AT_MAX);
    expect(atTarget.collectionIds).toEqual([1, 2, 3, 4]);
    expect(atTarget.addedPerfumes).toEqual([]);

    const overMax = build({
      selectedPerfumes: [fresh, green, amber, formal, smoky],
      maxSlots: 4,
    });
    expect(overMax.status).toBe(COMPOSER_BOX_PROPOSAL_STATUSES.INVALID_SELECTION);
    expect(overMax.apply.available).toBe(false);
  });

  it("does not mutate frozen inputs", () => {
    const frozenCatalog = Object.freeze(catalog.map((item) => Object.freeze({ ...item })));
    const frozenSelected = Object.freeze([Object.freeze({ ...fresh })]);

    expect(() =>
      build({
        catalog: frozenCatalog,
        selectedPerfumes: frozenSelected,
      })
    ).not.toThrow();
  });

  it("creates deterministic stale keys for relevant input changes", () => {
    const proposal = build({ selectedPerfumes: [fresh], strategy: "balanced" });
    const matchingKey = buildComposerProposalInputKey({
      selectedPerfumes: [fresh],
      excludedPerfumeIds: [],
      strategy: "balanced",
      budget: null,
      targetSlots: 4,
      minSlots: 3,
      maxSlots: 4,
      seasons: [],
      occasions: [],
      vibes: [],
      catalog,
      config,
    });
    const changedKey = buildComposerProposalInputKey({
      selectedPerfumes: [fresh],
      excludedPerfumeIds: [],
      strategy: "signature",
      budget: null,
      targetSlots: 4,
      minSlots: 3,
      maxSlots: 4,
      seasons: [],
      occasions: [],
      vibes: [],
      catalog,
      config,
    });

    expect(isComposerBoxProposalStale(proposal, matchingKey)).toBe(false);
    expect(isComposerBoxProposalStale(proposal, changedKey)).toBe(true);
  });

  it("regresses the real 1500 MXN unrestricted empty-box proposal", () => {
    const proposal = buildComposerBoxProposal({
      selectedPerfumes: [],
      excludedPerfumeIds: [],
      strategy: "balanced",
      budget: 1500,
      targetSlots: discoveryDecantsConfig.box.defaultTargetSlots,
      minSlots: discoveryDecantsConfig.box.minSelectableSlots,
      maxSlots: discoveryDecantsConfig.box.maxSelectableSlots,
      seasons: [],
      occasions: [],
      vibes: [],
      catalog: realCatalog,
      notes: realNotes,
      config: discoveryDecantsConfig,
    });

    expect(proposal.proposalAvailable).toBe(true);
    expect(proposal.apply.available).toBe(true);
    expect(proposal.collection.length).toBeGreaterThanOrEqual(
      discoveryDecantsConfig.box.minSelectableSlots
    );
    expect(proposal.compositionResult.status).not.toBe("impossible");
    expect(proposal.compositionResult.normalizedRequest).toMatchObject({
      budget: 1500,
      maxPoints: 15,
      preferredSeasons: [],
      preferredOccasions: [],
      preferredVibes: [],
      lockedPerfumeIds: [],
      excludedPerfumeIds: [],
    });
    expect(proposal.totalPoints).toBeLessThanOrEqual(15);
    expect(proposal.orderTotal).toBeLessThanOrEqual(1500);
    expect(new Set(proposal.collectionIds).size).toBe(proposal.collectionIds.length);
  });

  it("lets More Variety prioritize feasible slot count for the real 1500 MXN box", () => {
    const premiumFocus = buildComposerBoxProposal({
      selectedPerfumes: [],
      excludedPerfumeIds: [],
      strategy: "balanced",
      collectionStyle: "premium_focus",
      budget: 1500,
      targetSlots: discoveryDecantsConfig.box.defaultTargetSlots,
      minSlots: discoveryDecantsConfig.box.minSelectableSlots,
      maxSlots: discoveryDecantsConfig.box.maxSelectableSlots,
      seasons: [],
      occasions: [],
      vibes: [],
      catalog: realCatalog,
      notes: realNotes,
      config: discoveryDecantsConfig,
    });
    const moreVariety = buildComposerBoxProposal({
      selectedPerfumes: [],
      excludedPerfumeIds: [],
      strategy: "balanced",
      collectionStyle: "more_variety",
      budget: 1500,
      targetSlots: discoveryDecantsConfig.box.defaultTargetSlots,
      minSlots: discoveryDecantsConfig.box.minSelectableSlots,
      maxSlots: discoveryDecantsConfig.box.maxSelectableSlots,
      seasons: [],
      occasions: [],
      vibes: [],
      catalog: realCatalog,
      notes: realNotes,
      config: discoveryDecantsConfig,
    });

    expect(premiumFocus.proposalAvailable).toBe(true);
    expect(moreVariety.proposalAvailable).toBe(true);
    expect(moreVariety.collection.length).toBeGreaterThan(premiumFocus.collection.length);
    expect(moreVariety.collection.length).toBe(discoveryDecantsConfig.box.defaultTargetSlots);
    expect(moreVariety.totalPoints).toBeLessThanOrEqual(15);
    expect(moreVariety.compositionResult.normalizedRequest.collectionStyle.id).toBe("more_variety");
    expect(new Set(moreVariety.collectionIds).size).toBe(moreVariety.collectionIds.length);
    expect(moreVariety.compositionResult.constraintResult.valid).toBe(true);
  }, 15000);

  it("attaches deterministic per-fragrance preference and preserved reasons", () => {
    const proposal = build({
      selectedPerfumes: [fresh],
      seasons: ["summer"],
      occasions: ["office"],
      vibes: ["fresh"],
    });
    const preservedItem = proposal.proposalItems.find((item) => item.id === fresh.id);
    const reasonKeys = preservedItem.reasons.map((reason) => [
      reason.type,
      reason.preferenceType,
      reason.preferenceValue,
    ]);

    expect(preservedItem).toMatchObject({
      preserved: true,
      newlyAdded: false,
    });
    expect(reasonKeys).toEqual([
      ["preserved", null, null],
      ["preference_match", "season", "summer"],
      ["preference_match", "occasion", "office"],
      ["preference_match", "vibe", "fresh"],
    ]);
    expect(new Set(preservedItem.reasons.map((reason) => reason.code)).size).toBe(
      preservedItem.reasons.length
    );
  });

  it("exposes slot alternatives with the original Composer choice first", () => {
    const proposal = build({
      seasons: ["summer"],
      occasions: ["office"],
      vibes: ["fresh"],
    });
    const newSlot = proposal.slotAlternatives.find((slot) => slot.newlyAdded);

    expect(newSlot).toBeTruthy();
    expect(newSlot.alternatives.length).toBeGreaterThan(1);
    expect(newSlot.alternatives.length).toBeLessThanOrEqual(3);
    expect(newSlot.selectedAlternativeIndex).toBe(0);
    expect(newSlot.selectedPerfumeId).toBe(newSlot.alternatives[0].id);
    expect(newSlot.alternatives[0].id).toBe(proposal.proposalItems[newSlot.slotIndex].id);
    expect(new Set(newSlot.alternatives.map((item) => item.id)).size).toBe(
      newSlot.alternatives.length
    );
    expectSerializable(proposal.slotAlternatives);
  });

  it("keeps preserved slots single-option and marked preserved", () => {
    const proposal = build({
      selectedPerfumes: [fresh],
      seasons: ["summer"],
      occasions: ["office"],
      vibes: ["fresh"],
    });
    const preservedSlot = proposal.slotAlternatives.find((slot) => slot.preserved);

    expect(preservedSlot).toMatchObject({
      selectedAlternativeIndex: 0,
      selectedPerfumeId: fresh.id,
      preserved: true,
      newlyAdded: false,
    });
    expect(preservedSlot.alternatives).toHaveLength(1);
    expect(preservedSlot.alternatives[0].reasons.map((reason) => reason.type)).toContain(
      "preserved"
    );
  });

  it("moves proposal alternatives without changing the original proposal object", () => {
    const proposal = build({
      seasons: ["summer"],
      occasions: ["office"],
      vibes: ["fresh"],
    });
    const slot = proposal.slotAlternatives.find(
      (item) => item.newlyAdded && item.alternatives.length > 1
    );
    const originalIds = proposal.apply.collectionIds;
    const nextProposal = moveComposerProposalSlotAlternative({
      proposal: Object.freeze(proposal),
      slotId: slot.slotId,
      direction: 1,
    });

    expect(nextProposal).not.toBe(proposal);
    expect(proposal.apply.collectionIds).toEqual(originalIds);
    expect(nextProposal.slotAlternatives[slot.slotIndex].selectedAlternativeIndex).toBe(1);
    expect(nextProposal.collectionIds[slot.slotIndex]).toBe(slot.alternatives[1].id);
    expect(nextProposal.apply.collectionIds).toEqual(nextProposal.collectionIds);
    expect(nextProposal.totalPoints).toBe(
      nextProposal.collection.reduce((sum, perfume) => sum + perfume.points, 0)
    );
    expect(nextProposal.orderTotal).toBe(nextProposal.totalPoints * config.commerce.pointValue);
    expect(new Set(nextProposal.collectionIds).size).toBe(nextProposal.collectionIds.length);
    expectSerializable(nextProposal);
  });

  it("rejects selecting an alternative already selected in another proposal slot", () => {
    const proposal = build({
      seasons: ["summer"],
      occasions: ["office"],
      vibes: ["fresh"],
    });
    const duplicatedAlternative = proposal.slotAlternatives[0].alternatives[0];
    const duplicateProposal = {
      ...proposal,
      slotAlternatives: proposal.slotAlternatives.map((slot, index) =>
        index === 1
          ? {
              ...slot,
              alternatives: [
                slot.alternatives[0],
                duplicatedAlternative,
              ],
            }
          : slot
      ),
    };
    const selectedProposal = selectComposerProposalSlotAlternative({
      proposal: duplicateProposal,
      slotId: duplicateProposal.slotAlternatives[1].slotId,
      selectedAlternativeIndex: 1,
    });

    expect(selectedProposal.slotAlternatives[1].selectedAlternativeIndex).toBe(0);
    expect(selectedProposal.collectionIds).toEqual(proposal.collectionIds);
    expect(new Set(selectedProposal.collectionIds).size).toBe(
      selectedProposal.collectionIds.length
    );
  });

  it("keeps alternative ordering deterministic and catalog-order independent", () => {
    const first = build({
      seasons: ["summer"],
      occasions: ["office"],
      vibes: ["fresh"],
    });
    const second = build({
      catalog: [...catalog].reverse(),
      seasons: ["summer"],
      occasions: ["office"],
      vibes: ["fresh"],
    });

    expect(
      first.slotAlternatives.map((slot) => slot.alternatives.map((item) => item.id))
    ).toEqual(
      second.slotAlternatives.map((slot) => slot.alternatives.map((item) => item.id))
    );
  });

  it("derives factual gain/loss tradeoffs against the original Composer choice", () => {
    const result = buildComposerSlotAlternatives({
      collection: [fresh, amber, formal],
      selectedIds: new Set(),
      request: {
        budget: null,
        minSlots: 3,
        maxSlots: 3,
        targetSlots: 3,
        preferredSeasons: ["summer"],
        preferredOccasions: ["office"],
        preferredVibes: ["fresh"],
        strategy: "balanced",
      },
      catalog,
      notes: {},
      config,
    });
    const freshSlot = result.slots[0];
    const alternativeWithLoss = freshSlot.alternatives.find(
      (alternative) => alternative.id !== fresh.id && alternative.tradeoff.lost.length > 0
    );

    expect(freshSlot.alternatives[0]).toMatchObject({
      id: fresh.id,
      tradeoff: {
        gained: [],
        lost: [],
      },
    });
    expect(alternativeWithLoss.tradeoff.lost.map((item) => item.reason.preferenceValue)).toContain(
      "summer"
    );
    expect(alternativeWithLoss.tradeoff.unchanged.map((item) => item.reason.type)).toContain(
      "strategy_contribution"
    );
  });

  it("normalizes multi-preference stale keys with order independence and no literal Any", () => {
    const firstKey = buildComposerProposalInputKey({
      selectedPerfumes: [fresh],
      excludedPerfumeIds: [],
      strategy: "balanced",
      collectionStyle: "balanced_mix",
      budget: 900,
      targetSlots: 4,
      minSlots: 3,
      maxSlots: 4,
      seasons: ["summer", "spring", "spring"],
      occasions: ["date", "office"],
      vibes: ["fresh", "elegant"],
      catalog,
      config,
    });
    const secondKey = buildComposerProposalInputKey({
      selectedPerfumes: [fresh],
      excludedPerfumeIds: [],
      strategy: "balanced",
      collectionStyle: "balanced_mix",
      budget: 900,
      targetSlots: 4,
      minSlots: 3,
      maxSlots: 4,
      seasons: ["spring", "summer"],
      occasions: ["office", "date"],
      vibes: ["elegant", "fresh"],
      catalog,
      config,
    });
    const clearedKey = buildComposerProposalInputKey({
      selectedPerfumes: [fresh],
      excludedPerfumeIds: [],
      strategy: "balanced",
      collectionStyle: "more_variety",
      budget: 900,
      targetSlots: 4,
      minSlots: 3,
      maxSlots: 4,
      seasons: [],
      occasions: [],
      vibes: [],
      catalog,
      config,
    });

    expect(firstKey).toBe(secondKey);
    expect(firstKey).not.toContain("Any");
    expect(firstKey).not.toBe(clearedKey);
  });

  describe("points floor completion (minimumPoints)", () => {
    it("leaves floorRequested/floorMet null when no floor is requested", () => {
      const proposal = build();

      expect(proposal.floorRequested).toBeNull();
      expect(proposal.floorMet).toBeNull();
      expect(proposal.proposalAvailable).toBe(true);
    });

    it("reports floorMet true and keeps normal apply availability when the floor is already satisfied", () => {
      const proposal = build({ minimumPoints: 3 });

      expect(proposal.status).toBe(COMPOSER_BOX_PROPOSAL_STATUSES.COMPLETED);
      expect(proposal.floorRequested).toBe(3);
      expect(proposal.floorMet).toBe(true);
      expect(proposal.totalPoints).toBe(6.5);
      expect(proposal.proposalAvailable).toBe(true);
      expect(proposal.apply.available).toBe(true);
    });

    it("keeps AT_MAX a real success when the floor is already met", () => {
      const proposal = build({
        selectedPerfumes: [fresh, green, amber, formal],
        targetSlots: 4,
        minimumPoints: 5,
      });

      expect(proposal.status).toBe(COMPOSER_BOX_PROPOSAL_STATUSES.AT_MAX);
      expect(proposal.floorRequested).toBe(5);
      expect(proposal.floorMet).toBe(true);
      expect(proposal.proposalAvailable).toBe(true);
      expect(proposal.apply.available).toBe(true);
    });

    it("treats AT_MAX with an unmet explicit floor as IMPOSSIBLE, not a false completion", () => {
      const proposal = build({
        selectedPerfumes: [fresh, green, amber, formal],
        targetSlots: 4,
        minimumPoints: 6,
      });

      expect(proposal.status).toBe(COMPOSER_BOX_PROPOSAL_STATUSES.IMPOSSIBLE);
      expect(proposal.floorRequested).toBe(6);
      expect(proposal.floorMet).toBe(false);
      expect(proposal.proposalAvailable).toBe(false);
      expect(proposal.apply.available).toBe(false);
      expect(proposal.diagnostics.reason).toBe("customer-slots-full-below-points-floor");
      expectSerializable(proposal);
    });

    it("falls through past ALREADY_COMPLETE to extend the box when the floor is unmet and slots remain", () => {
      const extendableConfig = createBuilderConfig({
        ...config,
        box: {
          minSelectableSlots: 3,
          maxSelectableSlots: 5,
          defaultTargetSlots: 4,
        },
      });
      const proposal = build({
        config: extendableConfig,
        selectedPerfumes: [fresh, green, amber, formal],
        targetSlots: 4,
        maxSlots: 5,
        minimumPoints: 7,
      });

      expect(proposal.status).toBe(COMPOSER_BOX_PROPOSAL_STATUSES.COMPLETED);
      expect(proposal.floorRequested).toBe(7);
      expect(proposal.floorMet).toBe(true);
      expect(proposal.totalPoints).toBe(8);
      expect(proposal.collectionIds).toEqual([1, 2, 3, 4, 5]);
      expect(proposal.addedPerfumes.map((perfume) => perfume.id)).toEqual([5]);
      expect(proposal.compositionResult.terminationReason).toBe("points-floor-reached");
      expect(proposal.proposalAvailable).toBe(true);
      expect(proposal.apply.available).toBe(true);
    });

    it("treats a genuinely unreachable floor as unavailable, not a false completion", () => {
      const extendableConfig = createBuilderConfig({
        ...config,
        box: {
          minSelectableSlots: 3,
          maxSelectableSlots: 5,
          defaultTargetSlots: 4,
        },
      });
      const proposal = build({
        config: extendableConfig,
        selectedPerfumes: [fresh, green, amber, formal],
        targetSlots: 4,
        maxSlots: 5,
        minimumPoints: 100,
      });

      expect(proposal.floorRequested).toBe(100);
      expect(proposal.floorMet).toBe(false);
      expect(proposal.proposalAvailable).toBe(false);
      expect(proposal.apply.available).toBe(false);
      expect([COMPOSER_BOX_PROPOSAL_STATUSES.IMPOSSIBLE, COMPOSER_BOX_PROPOSAL_STATUSES.FAILED]).toContain(
        proposal.status
      );
      expectSerializable(proposal);
    });

    it("keeps floorRequested/floorMet null-shaped on invalid-selection failures", () => {
      const proposal = build({ selectedPerfumes: [perfume(999)] });

      expect(proposal.status).toBe(COMPOSER_BOX_PROPOSAL_STATUSES.INVALID_SELECTION);
      expect(proposal.floorRequested).toBeNull();
      expect(proposal.floorMet).toBeNull();
    });

    it("includes minimumPoints in the stale-key computation", () => {
      const baseKey = buildComposerProposalInputKey({
        selectedPerfumes: [fresh],
        excludedPerfumeIds: [],
        strategy: "balanced",
        budget: null,
        targetSlots: 4,
        minSlots: 3,
        maxSlots: 4,
        seasons: [],
        occasions: [],
        vibes: [],
        catalog,
        config,
      });
      const floorKey = buildComposerProposalInputKey({
        selectedPerfumes: [fresh],
        excludedPerfumeIds: [],
        strategy: "balanced",
        budget: null,
        targetSlots: 4,
        minSlots: 3,
        maxSlots: 4,
        seasons: [],
        occasions: [],
        vibes: [],
        catalog,
        config,
        minimumPoints: 5,
      });

      expect(baseKey).not.toBe(floorKey);
    });
  });
});
