import { describe, expect, it } from "vitest";
import { fragrances, notes } from "@discovery-box/catalog";
import { buildBoxSummary } from "../../../utils/buildBoxSummary.js";
import {
  CLOSED_ACCORD_EVIDENCE,
  getAccordEvidencePerfumes,
  getActiveAccordEvidence,
  reduceAccordEvidence,
} from "./accordEvidence.js";

describe("accord evidence: which fragrances stand behind a count", () => {
  it("lists exactly the fragrances buildBoxSummary counted for every accord, in the same order", () => {
    [fragrances.slice(0, 4), fragrances.slice(10, 22), fragrances.slice(40, 49)].forEach((selected) => {
      const { accordMap } = buildBoxSummary(selected, notes);

      Object.entries(accordMap).forEach(([accord, names]) => {
        const evidence = getAccordEvidencePerfumes(selected, accord);

        expect(evidence.map((perfume) => perfume.name)).toEqual(names);
        expect(evidence.every((perfume) => perfume.accords.includes(accord))).toBe(true);
      });
    });
  });

  it("returns nothing for an accord no selected fragrance has, and tolerates a missing selection", () => {
    expect(getAccordEvidencePerfumes(fragrances.slice(0, 3), "not-an-accord")).toEqual([]);
    expect(getAccordEvidencePerfumes(undefined, "citrus")).toEqual([]);
    expect(getAccordEvidencePerfumes([{ id: 1 }], "citrus")).toEqual([]);
  });
});

describe("accord evidence: when the card is open (hover < focus < pinned)", () => {
  const run = (...events) => events.reduce(reduceAccordEvidence, CLOSED_ACCORD_EVIDENCE);
  const active = (...events) => getActiveAccordEvidence(run(...events));

  it("starts closed, with nothing holding it open", () => {
    expect(getActiveAccordEvidence(CLOSED_ACCORD_EVIDENCE)).toBeNull();
  });

  it("B. pointer: hover previews, a click pins, a second click closes", () => {
    expect(active({ type: "hover", accord: "citrus" })).toBe("citrus");
    expect(active({ type: "hover", accord: "citrus" }, { type: "hoverEnd" })).toBeNull();

    const pinned = run({ type: "hover", accord: "citrus" }, { type: "toggle", accord: "citrus" });

    expect(getActiveAccordEvidence(pinned)).toBe("citrus");
    expect(getActiveAccordEvidence(reduceAccordEvidence(pinned, { type: "hoverEnd" }))).toBe("citrus");
    expect(getActiveAccordEvidence(reduceAccordEvidence(pinned, { type: "toggle", accord: "citrus" }))).toBeNull();
  });

  it("works with touch alone: a tap opens it with no hover and no focus event at all", () => {
    expect(active({ type: "toggle", accord: "citrus" })).toBe("citrus");
  });

  it("A. keyboard: focus opens the card, and it stays open until focus leaves", () => {
    expect(active({ type: "focus", accord: "woody" })).toBe("woody");
    // focus moving from the chip into its own card is still the same accord
    expect(active({ type: "focus", accord: "woody" }, { type: "focus", accord: "woody" })).toBe("woody");
    expect(active({ type: "focus", accord: "woody" }, { type: "focusLeft" })).toBeNull();
  });

  it("C. mixed input: hover never steals a card that focus is showing", () => {
    const focused = run({ type: "focus", accord: "citrus" });
    const hoveringAnother = reduceAccordEvidence(focused, { type: "hover", accord: "woody" });

    expect(getActiveAccordEvidence(hoveringAnother)).toBe("citrus");
  });

  it("C. mixed input: moving the pointer away does not close a card focus is still holding", () => {
    const state = run(
      { type: "focus", accord: "citrus" },
      { type: "hover", accord: "citrus" },
      { type: "hoverEnd" }
    );

    expect(getActiveAccordEvidence(state)).toBe("citrus");
  });

  it("C. mixed input: focus leaving does not close a card the mouse is still previewing", () => {
    const state = run({ type: "hover", accord: "citrus" }, { type: "focus", accord: "citrus" }, { type: "focusLeft" });

    expect(getActiveAccordEvidence(state)).toBe("citrus");
  });

  it("C. mixed input: a pinned card is not replaced by hovering or by an unrelated hover end", () => {
    const pinned = run({ type: "toggle", accord: "citrus" });

    expect(getActiveAccordEvidence(reduceAccordEvidence(pinned, { type: "hover", accord: "woody" }))).toBe("citrus");
    expect(getActiveAccordEvidence(reduceAccordEvidence(pinned, { type: "hoverEnd" }))).toBe("citrus");
  });

  it("keyboard focus moving to another chip is a new choice: it replaces a pin on the previous one", () => {
    const state = run({ type: "toggle", accord: "citrus" }, { type: "focus", accord: "woody" });

    expect(state.pinned).toBeNull();
    expect(getActiveAccordEvidence(state)).toBe("woody");
  });

  it("the focus that a click itself causes does not undo its pin", () => {
    const state = run({ type: "focus", accord: "citrus" }, { type: "toggle", accord: "citrus" });

    expect(state.pinned).toBe("citrus");
    expect(getActiveAccordEvidence(reduceAccordEvidence(state, { type: "focus", accord: "citrus" }))).toBe("citrus");
    expect(reduceAccordEvidence(state, { type: "focus", accord: "citrus" }).pinned).toBe("citrus");
  });

  it("a second click on the pinned chip closes the card even though focus is still on it", () => {
    expect(active({ type: "focus", accord: "citrus" }, { type: "toggle", accord: "citrus" }, { type: "toggle", accord: "citrus" })).toBeNull();
  });

  it("dismiss (Escape, outside press) closes everything, and a resting mouse does not reopen it", () => {
    expect(active({ type: "toggle", accord: "citrus" }, { type: "dismiss" })).toBeNull();
    expect(active({ type: "hover", accord: "citrus" }, { type: "dismiss" })).toBeNull();
    expect(active({ type: "focus", accord: "citrus" }, { type: "hover", accord: "citrus" }, { type: "dismiss" })).toBeNull();
  });

  it("ignores unknown events and returns the same object when nothing changes", () => {
    expect(reduceAccordEvidence(CLOSED_ACCORD_EVIDENCE, { type: "nonsense" })).toBe(CLOSED_ACCORD_EVIDENCE);
    expect(reduceAccordEvidence(CLOSED_ACCORD_EVIDENCE, undefined)).toBe(CLOSED_ACCORD_EVIDENCE);
    expect(reduceAccordEvidence(CLOSED_ACCORD_EVIDENCE, { type: "hoverEnd" })).toBe(CLOSED_ACCORD_EVIDENCE);
  });
});
