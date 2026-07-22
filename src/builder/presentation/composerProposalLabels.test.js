import { describe, expect, it } from "vitest";
import {
  getComposerProposalExplanationLabel,
  getComposerProposalStatusLabel,
} from "./composerProposalLabels.js";

describe("composerProposalLabels", () => {
  it("maps supported proposal statuses and explanation codes", () => {
    expect(getComposerProposalStatusLabel("completed")).toBe("Proposal Ready");
    expect(getComposerProposalStatusLabel("partial")).toBe("Partial Proposal");
    expect(
      getComposerProposalExplanationLabel({
        code: "excellent_preference_match",
        severity: "positive",
        evidence: {},
      })
    ).toBe("Strong match to selected preferences.");
  });

  it("fails gracefully for unknown status and explanation codes", () => {
    expect(getComposerProposalStatusLabel("future_status")).toBe("Composer Proposal");
    expect(getComposerProposalExplanationLabel({ code: "future_code" })).toBe("");
  });
});
