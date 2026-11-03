import { describe, expect, it } from "vitest";

import { fragrances as perfumes } from "@discovery-box/catalog";

// The Valentino fragrance formerly titled "Valentino Uomo Born In Roma Yellow
// Dream" is displayed as "Born in Roma Yellow Dream", the naming pattern of the
// other Born in Roma entries. Looked up by shortName so the pin follows the
// fragrance rather than a catalog ID.
describe("Born in Roma Yellow Dream display name", () => {
  const yellowDream = perfumes.find((perfume) => perfume.shortName === "Yellow Dream");

  it("is exactly 'Born in Roma Yellow Dream', still a Valentino Silver entry", () => {
    expect(yellowDream).toBeTruthy();
    expect(perfumes.filter((perfume) => perfume.shortName === "Yellow Dream")).toHaveLength(1);
    expect(yellowDream.name).toBe("Born in Roma Yellow Dream");
    expect(yellowDream.brand).toBe("Valentino");
    expect(yellowDream.points).toBe(1.5);
  });

  it("leaves no catalog entry carrying the old 'Valentino Uomo' prefix", () => {
    expect(perfumes.filter((perfume) => /valentino uomo/i.test(perfume.name))).toEqual([]);
    expect(perfumes.filter((perfume) => /Yellow Dream/i.test(perfume.name)).map((perfume) => perfume.name)).toEqual([
      "Born in Roma Yellow Dream",
    ]);
  });

  it("does not rename the other Valentino entries", () => {
    expect(perfumes.filter((perfume) => perfume.brand === "Valentino" && perfume !== yellowDream).map((perfume) => perfume.name).sort()).toEqual([
      "Born In Roma Coral Fantasy",
      "Born In Roma EDT",
    ]);
  });
});
