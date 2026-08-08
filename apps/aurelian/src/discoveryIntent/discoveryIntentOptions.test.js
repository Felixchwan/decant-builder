import { describe, expect, it } from "vitest";

import { DISCOVERY_INTENT_OPTIONS } from "./discoveryIntentOptions.js";

describe("discoveryIntentOptions", () => {
  it("defines exactly the four required options, in order, with no Mood terminology", () => {
    expect(DISCOVERY_INTENT_OPTIONS.map((option) => option.id)).toEqual([
      "fresh_everyday",
      "intentional_evening",
      "gift",
      "explore_freely",
    ]);
    DISCOVERY_INTENT_OPTIONS.forEach((option) => {
      expect(option.id).not.toMatch(/mood/i);
      expect(option.title).not.toMatch(/mood/i);
      expect(option.description).not.toMatch(/mood/i);
    });
  });

  it("carries identity/copy only — no catalog filter or recommendation vocabulary", () => {
    DISCOVERY_INTENT_OPTIONS.forEach((option) => {
      expect(Object.keys(option).sort()).toEqual(["description", "id", "title"]);
    });
  });
});
