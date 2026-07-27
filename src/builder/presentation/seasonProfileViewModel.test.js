import { describe, expect, it } from "vitest";

import { createTranslator } from "../../i18n/createTranslator.js";
import { buildSeasonProfileViewModel } from "./seasonProfileViewModel.js";

const translator = createTranslator("en-US");

function buildRows(scores) {
  return ["spring", "summer", "fall", "winter"].map((season) => ({
    id: season,
    label: season,
    count: scores[season] || 0,
    percent: scores[season] || 0,
  }));
}

describe("buildSeasonProfileViewModel", () => {
  it("summarizes the strongest single season deterministically", () => {
    const model = buildSeasonProfileViewModel({
      seasonRows: buildRows({ spring: 72, summer: 58, fall: 36, winter: 18 }),
      translator,
    });

    expect(model.summary.label).toBe("Leans Spring");
    expect(model.accessibleSummary).toBe("Season profile leans toward Spring.");
    expect(model.polygonPoints).toMatch(/\d/);
  });

  it("summarizes adjacent seasonal ties as a pair", () => {
    const model = buildSeasonProfileViewModel({
      seasonRows: buildRows({ spring: 74, summer: 68, fall: 30, winter: 18 }),
      translator,
    });

    expect(model.summary.label).toBe("Leans Spring and Summer");
    expect(model.accessibleSummary).toBe("Season profile leans toward Spring and Summer.");
  });

  it("summarizes even seasonal strength as balanced", () => {
    const model = buildSeasonProfileViewModel({
      seasonRows: buildRows({ spring: 62, summer: 58, fall: 55, winter: 51 }),
      translator,
    });

    expect(model.summary.label).toBe("Balanced across seasons");
    expect(model.isEmpty).toBe(false);
  });

  it("returns an empty accessible state without exposing raw scores", () => {
    const model = buildSeasonProfileViewModel({
      seasonRows: buildRows({}),
      translator,
    });

    expect(model.isEmpty).toBe(true);
    expect(model.summary.label).toBe("Add fragrances to reveal seasonal shape.");
    expect(model.accessibleSummary).not.toMatch(/\d/);
  });
});
