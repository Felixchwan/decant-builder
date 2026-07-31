import { describe, expect, it } from "vitest";
import { discoveryDecantsConfig } from "../../../../../src/merchants/discoveryDecants/config.js";
import {
  buildComposerBudgetBonusFeedback,
  buildComposerProposalBonusStatus,
  deriveCuratorBonusThreshold,
} from "./composerBonusStatus.js";

const config = discoveryDecantsConfig;

describe("composerBonusStatus", () => {
  it("derives the Curator Bonus monetary threshold from config", () => {
    expect(deriveCuratorBonusThreshold(config)).toMatchObject({
      targetPoints: 12,
      pointValue: 100,
      monetaryThreshold: 1200,
      currencySymbol: "$",
    });
  });

  it("describes finite budget eligibility without claiming unlock", () => {
    expect(buildComposerBudgetBonusFeedback({ budget: 600, config })).toMatchObject({
      state: "below_threshold",
      label: "$600 to Bonus eligibility.",
    });
    expect(buildComposerBudgetBonusFeedback({ budget: 1100, config })).toMatchObject({
      state: "below_threshold",
      label: "$100 to Bonus eligibility.",
    });
    expect(buildComposerBudgetBonusFeedback({ budget: 1200, config })).toMatchObject({
      state: "eligible",
      label: "Bonus-eligible budget.",
    });
    expect(buildComposerBudgetBonusFeedback({ budget: 1500, config })).toMatchObject({
      state: "eligible",
      label: "Bonus-eligible budget.",
    });
  });

  it("keeps No Limit copy tied to actual composed points", () => {
    expect(buildComposerBudgetBonusFeedback({ budget: null, config })).toMatchObject({
      state: "no_limit",
      label: "Bonus unlocks at 12 points.",
    });
  });

  it("uses actual proposal points for proposal Curator Bonus state", () => {
    expect(buildComposerProposalBonusStatus({ totalPoints: 10, config })).toMatchObject({
      state: "progress",
      value: "10 / 12 pts",
    });
    expect(buildComposerProposalBonusStatus({ totalPoints: 12, config })).toMatchObject({
      state: "unlocked",
      value: "Unlocked",
    });
    expect(buildComposerProposalBonusStatus({ totalPoints: 13.5, config })).toMatchObject({
      state: "unlocked",
      value: "Unlocked",
    });
  });
});
