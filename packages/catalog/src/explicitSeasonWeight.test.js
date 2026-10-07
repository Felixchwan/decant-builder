import { describe, expect, it } from "vitest";

import { fragrances, getExplicitSeasonWeight } from "./index.js";
import { SEASON_WEIGHTS_BY_ID } from "./fragrances.js";

const SEASONS = ["spring", "summer", "fall", "winter"];

describe("getExplicitSeasonWeight", () => {
  it("returns the hand-written editorial weight for a fragrance and season", () => {
    expect(getExplicitSeasonWeight(1, "summer")).toBe(10);
    expect(getExplicitSeasonWeight(8, "winter")).toBe(10);
    expect(getExplicitSeasonWeight(5, "fall")).toBe(8);
  });

  it("returns a real editorial 0 as 0, not as unscored", () => {
    expect(SEASON_WEIGHTS_BY_ID[2].winter).toBe(0);
    expect(getExplicitSeasonWeight(2, "winter")).toBe(0);
  });

  it("returns null (unscored) for a fragrance with no editorial entry", () => {
    const unscored = fragrances.filter(({ id }) => !(id in SEASON_WEIGHTS_BY_ID));
    expect(unscored.length).toBeGreaterThan(0);
    for (const { id } of unscored) {
      for (const season of SEASONS) {
        expect(getExplicitSeasonWeight(id, season), `${id}/${season}`).toBeNull();
      }
    }
  });

  it("returns null for unknown ids, unknown seasons and malformed input, never throwing", () => {
    for (const [id, season] of [[999999, "spring"], [1, "autumn"], [1, "primavera"], [1, ""], [1, undefined], [undefined, "spring"], [null, null], ["toString", "spring"], [1, "__proto__"], [1, "constructor"]]) {
      expect(() => getExplicitSeasonWeight(id, season)).not.toThrow();
      expect(getExplicitSeasonWeight(id, season), `${String(id)}/${String(season)}`).toBeNull();
    }
  });

  it("is independent of the declared seasons list: it reports the table, not compatibility", () => {
    const disagreeing = fragrances.find(
      (item) => item.id in SEASON_WEIGHTS_BY_ID && SEASONS.some((season) => !item.seasons.includes(season) && SEASON_WEIGHTS_BY_ID[item.id][season] > 0)
    );
    expect(disagreeing).toBeDefined();
    const season = SEASONS.find((key) => !disagreeing.seasons.includes(key) && SEASON_WEIGHTS_BY_ID[disagreeing.id][key] > 0);
    expect(getExplicitSeasonWeight(disagreeing.id, season)).toBe(SEASON_WEIGHTS_BY_ID[disagreeing.id][season]);
  });

  it("agrees with the merged seasonWeights wherever an editorial entry exists", () => {
    for (const item of fragrances) {
      if (!(item.id in SEASON_WEIGHTS_BY_ID)) continue;
      for (const season of SEASONS) {
        expect(getExplicitSeasonWeight(item.id, season), `${item.id}/${season}`).toBe(item.seasonWeights[season]);
      }
    }
  });

  it("is not part of the merged fragrance data: the catalog shape is unchanged", () => {
    expect(Object.keys(fragrances[0]).sort()).not.toContain("explicitSeasonWeights");
    expect(fragrances).toHaveLength(92);
  });
});
