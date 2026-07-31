import { describe, expect, it } from "vitest";
import { buildComposerContributionReasons } from "../internal/composition/composerProposalReasons.js";
import { getComposerProposalItemReasonLabels } from "./composerAlternativeTradeoffLabels.js";
import { getComposerContributionLabel } from "./composerContributionLabels.js";

describe("composerContributionLabels", () => {
  it("maps coverage contribution facts to concise labels", () => {
    const [reason] = buildComposerContributionReasons([
      {
        type: "coverage_contribution",
        category: "season",
        value: "winter",
        strength: "unique",
        evidence: {},
      },
    ]);

    expect(getComposerContributionLabel(reason)).toBe("Adds Winter versatility");
  });

  it("maps known accord facts to fragrance-user language", () => {
    const [leather, aquatic] = buildComposerContributionReasons([
      {
        type: "accord_contribution",
        category: "accord",
        value: "leather",
        strength: "unique",
        evidence: {},
      },
      {
        type: "accord_contribution",
        category: "accord",
        value: "aquatic",
        strength: "unique",
        evidence: {},
      },
    ]);

    expect(getComposerContributionLabel(leather)).toBe("Introduces leather");
    expect(getComposerContributionLabel(aquatic)).toBe("Aquatic freshness");
  });

  it("maps occasion and vibe contributions without technical wording", () => {
    const [office, elegant, soft] = buildComposerContributionReasons([
      {
        type: "coverage_contribution",
        category: "occasion",
        value: "office",
        strength: "unique",
        evidence: {},
      },
      {
        type: "coverage_contribution",
        category: "vibe",
        value: "elegant",
        strength: "unique",
        evidence: {},
      },
      {
        type: "coverage_contribution",
        category: "vibe",
        value: "soft",
        strength: "unique",
        evidence: {},
      },
    ]);
    const labels = [
      getComposerContributionLabel(office),
      getComposerContributionLabel(elegant),
      getComposerContributionLabel(soft),
    ];

    expect(labels).toEqual(["Great for Office", "Elegant style", "Soft impression"]);
    expect(labels.join(" ")).not.toMatch(/\b(character|coverage)\b/i);
  });

  it("prioritizes unique contribution labels over simple preference matches", () => {
    const [contribution] = buildComposerContributionReasons([
      {
        type: "accord_contribution",
        category: "accord",
        value: "leather",
        strength: "unique",
        evidence: {},
      },
    ]);
    const labels = getComposerProposalItemReasonLabels([
      {
        type: "preference_match",
        preferenceType: "vibe",
        preferenceValue: "seductive",
        evidence: {},
      },
      contribution,
      {
        type: "strategy_contribution",
        evidence: { strategyId: "balanced" },
      },
    ]);

    expect(labels).toEqual(["Introduces leather", "Seductive"]);
  });
});
