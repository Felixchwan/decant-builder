import { describe, expect, it } from "vitest";
import { parseFragranceIntent } from "./parseFragranceIntent.js";
import { DETAILS_QUERY_PARAM, parseDetailsIntent, resolveBuilderIntents } from "./parseDetailsIntent.js";

describe("parseDetailsIntent", () => {
  it("is its own param, distinct from the add-to-box ?fragrance= link", () => {
    expect(DETAILS_QUERY_PARAM).toBe("details");
    expect(parseDetailsIntent("?fragrance=1")).toBeNull();
    expect(parseFragranceIntent("?details=1")).toBeNull();
  });

  it("accepts one positive safe integer ID and ignores unrelated query values", () => {
    expect(parseDetailsIntent("?details=104&utm_source=preview")).toBe(104);
    expect(parseDetailsIntent("details=1")).toBe(1);
  });

  it.each([
    ["", null],
    ["?details=", null],
    ["?details=0", null],
    ["?details=-1", null],
    ["?details=1.5", null],
    ["?details=abc", null],
    ["?details=01", null],
    ["?details=1&details=2", null],
    ["?details=9007199254740992", null],
  ])("degrades %s safely to no intent", (search, expected) => {
    expect(parseDetailsIntent(search)).toBe(expected);
  });

  it("accepts a well-formed id that is not in the catalog (the Builder reports it, the parser doesn't throw)", () => {
    expect(parseDetailsIntent("?details=999999")).toBe(999999);
  });
});

describe("resolveBuilderIntents", () => {
  it("passes a lone add intent or a lone details intent straight through", () => {
    expect(resolveBuilderIntents({ fragranceId: 3, detailsId: null })).toEqual({ initialFragranceId: 3, initialDetailFragranceId: null });
    expect(resolveBuilderIntents({ fragranceId: null, detailsId: 4 })).toEqual({ initialFragranceId: null, initialDetailFragranceId: 4 });
    expect(resolveBuilderIntents({ fragranceId: null, detailsId: null })).toEqual({ initialFragranceId: null, initialDetailFragranceId: null });
  });

  it("never honors both: a valid add intent wins and the details request is dropped", () => {
    expect(resolveBuilderIntents({ fragranceId: 3, detailsId: 4 })).toEqual({ initialFragranceId: 3, initialDetailFragranceId: null });
  });

  it("lets a details link stand when the add param is invalid (an invalid add param is already no intent)", () => {
    const search = "?fragrance=abc&details=4";
    expect(resolveBuilderIntents({ fragranceId: parseFragranceIntent(search), detailsId: parseDetailsIntent(search) })).toEqual({
      initialFragranceId: null,
      initialDetailFragranceId: 4,
    });
  });
});
