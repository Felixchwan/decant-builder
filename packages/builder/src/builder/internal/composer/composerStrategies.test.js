import { describe, expect, it } from "vitest";

import {
  COMPOSER_STRATEGIES,
  DEFAULT_COMPOSER_STRATEGY_ID,
  getComposerStrategies,
  getComposerStrategy,
} from "./composerStrategies.js";

describe("composerStrategies", () => {
  it("exposes the exact v1 strategy registry in stable order", () => {
    expect(DEFAULT_COMPOSER_STRATEGY_ID).toBe("balanced");
    expect(COMPOSER_STRATEGIES).toEqual([
      {
        id: "balanced",
        label: "Balanced",
        description: "Broad, coherent coverage across the collection.",
      },
      {
        id: "versatile",
        label: "Versatile",
        description: "Prioritizes practical wearability across common contexts.",
      },
      {
        id: "explorer",
        label: "Explorer",
        description: "Prioritizes variety, contrast, and discovery.",
      },
      {
        id: "signature",
        label: "Signature",
        description: "Prioritizes stronger identity and premium focal selections.",
      },
    ]);
    expect(getComposerStrategies()).toBe(COMPOSER_STRATEGIES);
    expect(getComposerStrategies().map(({ id }) => id)).toEqual([
      "balanced",
      "versatile",
      "explorer",
      "signature",
    ]);
  });

  it("looks up known strategies and falls back to balanced for missing or unknown IDs", () => {
    expect(getComposerStrategy("signature")).toEqual({
      id: "signature",
      label: "Signature",
      description: "Prioritizes stronger identity and premium focal selections.",
    });
    expect(getComposerStrategy("missing")).toBe(getComposerStrategy("balanced"));
    expect(getComposerStrategy("")).toBe(getComposerStrategy("balanced"));
    expect(getComposerStrategy(null)).toBe(getComposerStrategy("balanced"));
    expect(getComposerStrategy(undefined)).toBe(getComposerStrategy("balanced"));
  });

  it("returns frozen strategy data deterministically", () => {
    expect(Object.isFrozen(COMPOSER_STRATEGIES)).toBe(true);
    COMPOSER_STRATEGIES.forEach((strategy) => {
      expect(Object.isFrozen(strategy)).toBe(true);
    });
    expect(getComposerStrategies()).toBe(getComposerStrategies());
    expect(getComposerStrategy("explorer")).toBe(getComposerStrategy("explorer"));
  });
});
