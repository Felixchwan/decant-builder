import { describe, expect, it } from "vitest";
import {
  getComposerOptionPositionLabel,
  getComposerProposalItemReasonLabel,
  getComposerProposalItemReasonLabels,
  getComposerTradeoffLabel,
} from "./composerAlternativeTradeoffLabels.js";

function reason(type, evidence = {}) {
  return {
    type,
    preferenceType: evidence.preferenceType || null,
    preferenceValue: evidence.preferenceValue || null,
    evidence,
  };
}

describe("composerAlternativeTradeoffLabels", () => {
  it("suppresses strategy support when it is the only card reason", () => {
    expect(
      getComposerProposalItemReasonLabels([
        reason("strategy_contribution", { strategyId: "balanced" }),
      ])
    ).toEqual([]);
  });

  it("prioritizes concrete preference matches before strategy support", () => {
    expect(
      getComposerProposalItemReasonLabels([
        reason("strategy_contribution", { strategyId: "explorer" }),
        reason("preference_match", {
          preferenceType: "vibe",
          preferenceValue: "fresh",
        }),
        reason("preference_match", {
          preferenceType: "season",
          preferenceValue: "summer",
        }),
        reason("preference_match", {
          preferenceType: "occasion",
          preferenceValue: "office",
        }),
      ])
    ).toEqual(["Summer", "Office", "Fresh"]);
  });

  it("suppresses strategy support from normal card chips even with concrete evidence", () => {
    expect(
      getComposerProposalItemReasonLabels(
        [
          reason("preference_match", {
            preferenceType: "season",
            preferenceValue: "fall",
          }),
          reason("strategy_contribution", { strategyId: "signature" }),
        ],
        { max: 3 }
      )
    ).toEqual(["Fall"]);
  });

  it("deduplicates labels and enforces max reason count", () => {
    expect(
      getComposerProposalItemReasonLabels([
        reason("preference_match", {
          preferenceType: "season",
          preferenceValue: "summer",
        }),
        reason("preference_match", {
          preferenceType: "season",
          preferenceValue: "summer",
        }),
        reason("preference_match", {
          preferenceType: "occasion",
          preferenceValue: "office",
        }),
        reason("preference_match", {
          preferenceType: "vibe",
          preferenceValue: "fresh",
        }),
        reason("strategy_contribution", { strategyId: "balanced" }),
      ])
    ).toEqual(["Summer", "Office", "Fresh"]);
  });

  it("keeps strategy evidence available for factual tradeoff labels", () => {
    const strategyReason = reason("strategy_contribution", { strategyId: "balanced" });

    expect(getComposerProposalItemReasonLabel(strategyReason)).toBe(
      "Supports Balanced strategy"
    );
    expect(getComposerTradeoffLabel({ reason: strategyReason })).toBe(
      "Supports Balanced strategy"
    );
  });

  it("labels proposal carousel alternatives as options for customers", () => {
    expect(getComposerOptionPositionLabel(1, 3)).toBe("Option 1 of 3");
    expect(getComposerOptionPositionLabel(2, 3)).toBe("Option 2 of 3");
    expect(getComposerOptionPositionLabel(1, 3)).not.toBe("Alternative Fragrance 1 of 3");
  });
});
