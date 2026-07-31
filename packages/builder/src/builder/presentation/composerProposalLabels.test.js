import { describe, expect, it } from "vitest";
import {
  getComposerProposalExplanationLabel,
  getComposerProposalStatusLabel,
  getLocalizedComposerProposalStatusLabel,
} from "./composerProposalLabels.js";
import { createTranslator } from "../../i18n/createTranslator.js";

describe("composerProposalLabels", () => {
  it("maps supported proposal statuses and explanation codes", () => {
    expect(getComposerProposalStatusLabel("completed")).toBe("Discovery Box Proposal");
    expect(getComposerProposalStatusLabel("partial")).toBe("Partial Discovery Box");
    expect(
      getComposerProposalExplanationLabel({
        code: "excellent_preference_match",
        severity: "positive",
        evidence: {},
      })
    ).toBe("Strong match to selected preferences.");
  });

  it("fails gracefully for unknown status and explanation codes", () => {
    expect(getComposerProposalStatusLabel("future_status")).toBe("Discovery Box Proposal");
    expect(getComposerProposalExplanationLabel({ code: "future_code" })).toBe("");
  });

  it("localizes proposal status and explanation labels through injected translator", () => {
    const translator = createTranslator("es-MX");

    expect(getLocalizedComposerProposalStatusLabel("partial", translator)).toBe(
      "Discovery Box parcial"
    );
    expect(
      getComposerProposalExplanationLabel(
        {
          code: "excellent_preference_match",
          severity: "positive",
          evidence: {},
        },
        translator
      )
    ).toBe("Coincide muy bien con las preferencias seleccionadas.");
  });
});
