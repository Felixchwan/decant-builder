import { describe, expect, it } from "vitest";
import { parseEncounterIntent } from "./parseEncounterIntent.js";

describe("parseEncounterIntent", () => {
  it("accepts one non-blank encounter id and ignores unrelated query values", () => {
    expect(parseEncounterIntent("?encounter=enc-abc-123&utm_source=preview")).toBe("enc-abc-123");
  });

  it("accepts a real crypto.randomUUID-shaped id verbatim", () => {
    expect(parseEncounterIntent("?encounter=3fa85f64-5717-4562-b3fc-2c963f66afa6")).toBe(
      "3fa85f64-5717-4562-b3fc-2c963f66afa6"
    );
  });

  it.each([
    ["", null],
    ["?encounter=", null],
    ["?encounter=%20", null],
    ["?encounter=enc-1&encounter=enc-2", null],
    ["?fragrance=1", null],
  ])("handles %s safely", (search, expected) => {
    expect(parseEncounterIntent(search)).toBe(expected);
  });
});
