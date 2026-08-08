import { describe, expect, it } from "vitest";

import { explainRecommendation } from "./recommendationExplanation.js";

const FORBIDDEN_VOCABULARY = /enseñ|aprend|percepci|desarroll/i;
const OVERREACHING_CLAIMS = /accesible|personalidad|regalar|regalo/i;

function recommendation(explanations) {
  return { explanations };
}

function explanation(code, evidence = {}) {
  return { code, severity: "positive", evidence };
}

describe("explainRecommendation", () => {
  it("builds a short phrase from real matched vibes only, capped at three", () => {
    expect(
      explainRecommendation(recommendation([explanation("preference_anchor", { matchedVibes: ["fresh"] })])),
    ).toBe("Fresco.");

    expect(
      explainRecommendation(
        recommendation([explanation("preference_anchor", { matchedVibes: ["fresh", "clean"] })]),
      ),
    ).toBe("Fresco y limpio.");

    expect(
      explainRecommendation(
        recommendation([
          explanation("preference_anchor", { matchedVibes: ["fresh", "clean", "approachable", "easy"] }),
        ]),
      ),
    ).toBe("Fresco, limpio y accesible."); // capped at 3 — never claims a 4th matched vibe as fact
  });

  it("falls back to a matched-occasion phrase only when no vibes matched, gated to the exact occasions present", () => {
    expect(
      explainRecommendation(
        recommendation([explanation("preference_anchor", { matchedOccasions: ["night", "date"] })]),
      ),
    ).toBe("Pensado para noche y citas.");

    expect(
      explainRecommendation(recommendation([explanation("preference_anchor", { matchedOccasions: ["night"] })])),
    ).toBe("Pensado para la noche.");

    expect(
      explainRecommendation(recommendation([explanation("preference_anchor", { matchedOccasions: ["date"] })])),
    ).toBe("Pensado para citas.");

    expect(
      explainRecommendation(recommendation([explanation("preference_anchor", { matchedOccasions: ["daily"] })])),
    ).toBe("Versátil para uso diario.");

    expect(
      explainRecommendation(recommendation([explanation("preference_anchor", { matchedOccasions: ["special"] })])),
    ).toBe("Pensado para ocasiones especiales.");
  });

  it("returns a narrowly-worded versatility statement only above the real breadth threshold", () => {
    expect(
      explainRecommendation(recommendation([explanation("versatility_anchor", { occasionCount: 5 })])),
    ).toBe("Versátil: funciona en distintas ocasiones.");

    expect(
      explainRecommendation(recommendation([explanation("versatility_anchor", { seasonCount: 4 })])),
    ).toBe("Versátil: funciona en distintas ocasiones.");

    // Below threshold — real evidence exists, but not enough to support the claim.
    expect(
      explainRecommendation(
        recommendation([explanation("versatility_anchor", { occasionCount: 1, seasonCount: 1 })]),
      ),
    ).toBeNull();
  });

  it("never manufactures a reason from composer_balance_pick alone — the tightened evidence rule", () => {
    expect(explainRecommendation(recommendation([explanation("composer_balance_pick", { lane: "intentRecommendation" })]))).toBeNull();

    // Paired with other collection-centric codes that don't describe this
    // fragrance's own character — still null, never inferred.
    expect(
      explainRecommendation(
        recommendation([
          explanation("composer_balance_pick"),
          explanation("coverage_anchor", { seasons: ["fall"] }),
          explanation("diversity_anchor", { accords: ["oud"] }),
          explanation("signature_anchor", { points: 5, locked: false }),
          explanation("redundancy_driver", { similarityCount: 2 }),
        ]),
      ),
    ).toBeNull();
  });

  it("returns null for empty/missing explanations rather than guessing", () => {
    expect(explainRecommendation(recommendation([]))).toBeNull();
    expect(explainRecommendation({})).toBeNull();
    expect(explainRecommendation(undefined)).toBeNull();
  });

  it("prefers preference_anchor over versatility_anchor when both are present", () => {
    expect(
      explainRecommendation(
        recommendation([
          explanation("preference_anchor", { matchedVibes: ["warm"] }),
          explanation("versatility_anchor", { occasionCount: 6 }),
        ]),
      ),
    ).toBe("Cálido.");
  });

  it("never produces perceptual-learning/teaching vocabulary or an unsupported claim, across every real code combination", () => {
    const cases = [
      [explanation("preference_anchor", { matchedVibes: ["fresh", "clean"] })],
      [explanation("preference_anchor", { matchedOccasions: ["night", "date"] })],
      [explanation("preference_anchor", { matchedOccasions: ["special"] })],
      [explanation("versatility_anchor", { occasionCount: 5, seasonCount: 4 })],
      [explanation("composer_balance_pick")],
      [explanation("coverage_anchor", { seasons: ["fall"] })],
    ];

    cases.forEach((explanations) => {
      const result = explainRecommendation(recommendation(explanations));
      if (result) {
        expect(result).not.toMatch(FORBIDDEN_VOCABULARY);
        expect(result).not.toMatch(OVERREACHING_CLAIMS);
      }
    });
  });
});
