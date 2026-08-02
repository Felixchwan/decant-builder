import { describe, expect, it } from "vitest";
import { parseFragranceIntent } from "./parseFragranceIntent.js";

describe("parseFragranceIntent", () => {
  it("accepts one positive safe integer ID and ignores unrelated query values", () => {
    expect(parseFragranceIntent("?fragrance=104&utm_source=preview")).toBe(104);
  });

  it.each([
    ["", null],
    ["?fragrance=", null],
    ["?fragrance=0", null],
    ["?fragrance=-1", null],
    ["?fragrance=1.5", null],
    ["?fragrance=abc", null],
    ["?fragrance=1&fragrance=2", null],
    ["?fragrance=9007199254740992", null],
  ])("handles %s safely", (search, expected) => {
    expect(parseFragranceIntent(search)).toBe(expected);
  });
});
