import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { createTranslator } from "./createTranslator.js";
import { enUS } from "./locales/en-US.js";
import { esMX } from "./locales/es-MX.js";

const builderPanelSource = readFileSync(
  new URL("../components/BuilderPanel.jsx", import.meta.url),
  "utf8"
);

// Presentation-boundary regression guard for the Aurelian Curator-panel
// localization work: `packages/builder/src/components/BuilderPanel.jsx`
// resolves every badge/character/performance/curator-note/strength/
// opportunity/identity value through `t(key, params)` instead of a hardcoded
// English literal. This file enumerates every key that refactor introduced
// and asserts, per key: the en-US value is the original hardcoded English
// string (Discovery Decants' output is unchanged), the es-MX value exists,
// is genuinely different from the English string, and is not the raw key
// itself (i.e. translation actually happened, not a silent fallback).
//
// This does not replace real interaction: the shared component can't be
// exercised through this file's existing `renderToStaticMarkup` harness
// (the Review modal only opens via internal state, and the modal renders
// through a real-DOM portal), so end-to-end verification of these keys
// rendering correctly inside the Curator panel was done live in a browser
// across several materially different real boxes, per CLAUDE.md's
// browser-acceptance expectations for UI/runtime-behavior changes.

const enTranslator = createTranslator("en-US");
const esTranslator = createTranslator("es-MX");

function expectLocalizedKey(key, expectedEnglish) {
  expect(enUS[key]).toBe(expectedEnglish);
  expect(enTranslator.t(key)).toBe(expectedEnglish);

  const esValue = esMX[key];
  expect(esValue, `missing es-MX entry for ${key}`).toBeTruthy();
  expect(esValue).not.toBe(key);
  expect(esValue).not.toBe(expectedEnglish);
  expect(esTranslator.t(key)).toBe(esValue);
}

describe("Curator-panel identity locale keys", () => {
  const identityIds = [
    "in-progress",
    "fresh-daily",
    "mediterranean",
    "balanced",
    "everyday-luxury",
    "executive",
    "refined",
    "evening",
    "golden-hour",
    "signature",
    "collector",
  ];

  it.each(identityIds)("gives identity '%s' a title, subtitle, and articled phrase in both locales", (id) => {
    ["title", "subtitle", "articledLower"].forEach((field) => {
      const key = `identity.${id}.${field}`;
      const enValue = enUS[key];
      expect(enValue, `missing en-US entry for ${key}`).toBeTruthy();

      const esValue = esMX[key];
      expect(esValue, `missing es-MX entry for ${key}`).toBeTruthy();
      expect(esValue).not.toBe(key);
      expect(esValue).not.toBe(enValue);
    });
  });
});

describe("Curator-panel assessment badge locale keys", () => {
  it.each([
    ["review.badge.developingCollection", "Developing Collection"],
    ["review.badge.confidentEveningCharacter", "Confident Evening Character"],
    ["review.badge.versatileAfterDarkProfile", "Versatile After-Dark Profile"],
    ["review.badge.refinedDailyWear", "Refined Daily Wear"],
    ["review.badge.strongDailyRotation", "Strong Daily Rotation"],
    ["review.badge.excellentBalance", "Excellent Balance"],
    ["review.badge.highlyVersatile", "Highly Versatile"],
    ["review.badge.distinctiveCharacter", "Distinctive Character"],
    ["review.badge.wellRounded", "Well Rounded"],
  ])("resolves badge key %s", (key, english) => {
    expectLocalizedKey(key, english);
  });
});

describe("Curator-panel character/performance phrase locale keys", () => {
  it.each([
    ["review.character.polishedFreshVersatility", "a polished fresh character and clean versatility"],
    ["review.character.warmEveningSignature", "warm texture, evening depth and a confident signature"],
    ["review.character.refinedSignature", "refined structure, elegance and signature-scent potential"],
    ["review.character.eveningDepthCharacter", "a clear evening character and enough depth for after-dark wear"],
    ["review.character.freshDailyEase", "freshness, clarity and easy daily wear"],
    ["review.character.balancedFreshWarmth", "balanced freshness and warmth"],
    ["review.performance.dayToEvening", "moving comfortably from daytime wear into evening use"],
    ["review.performance.reliableDaily", "built for reliable everyday wear"],
    ["review.performance.afterDarkFocus", "with a clear after-dark point of view"],
    ["review.performance.variedRange", "with enough range for varied settings"],
    ["review.performance.focusedFlexible", "with a focused but still flexible profile"],
  ])("resolves phrase key %s", (key, english) => {
    expectLocalizedKey(key, english);
  });

  it("composes the assessment summary sentence from locale-owned templates, not English grammar helpers", () => {
    expect(enUS["review.assessmentSummary"]).toBe(
      "{identityPhrase} with {character}, {performance}.{strengthPhrase}"
    );
    expect(esMX["review.assessmentSummary"]).toBe(
      "{identityPhrase}, con {character}, {performance}.{strengthPhrase}"
    );
    // getArticle() (the a/an English-grammar helper the assessment-summary
    // sentence used to concatenate itself with) was removed entirely once
    // sentence assembly moved to locale-owned templates -- if it reappears,
    // some code path regressed to gluing English grammar onto translated
    // text instead of letting each locale's own template own word order.
    expect(builderPanelSource).not.toMatch(/function getArticle/);
  });
});

describe("Curator-panel curator-note locale keys", () => {
  it.each([
    [
      "review.curatorNote.opening.large",
      "This is the kind of box that should feel satisfying over repeated wear, with enough range to avoid becoming predictable.",
    ],
    [
      "review.curatorNote.opening.medium",
      "This box should feel easy to live with, giving you several reliable moods without asking you to overthink the choice.",
    ],
    [
      "review.curatorNote.opening.small",
      "This box should feel like a clear starting point, with enough personality to make each wear feel intentional.",
    ],
    [
      "review.curatorNote.performance.dayToEvening",
      "You will likely reach for it across office, casual and date-night situations, which is where its range starts to show.",
    ],
    [
      "review.curatorNote.performance.daily",
      "Its most natural strength is day-to-day wear: polished, dependable and easy to return to.",
    ],
    [
      "review.curatorNote.performance.evening",
      "It will feel most at home after dark, where texture and presence matter more than simple freshness.",
    ],
    [
      "review.curatorNote.performance.varied",
      "There is enough flexibility here to move across several settings while still feeling considered.",
    ],
    [
      "review.curatorNote.performance.focused",
      "It remains focused for now, which gives future additions a clear role rather than adding noise.",
    ],
    [
      "review.curatorNote.defaultOpportunity",
      "Future additions can be chosen for personal taste rather than correcting a major gap.",
    ],
  ])("resolves curator-note key %s", (key, english) => {
    expectLocalizedKey(key, english);
  });
});

describe("Curator-panel opportunity-sentence locale keys", () => {
  it.each([
    [
      "review.opportunitySentence.freshLift",
      "For future growth, a brighter fresh fragrance would add lift and keep the rotation from feeling too concentrated.",
    ],
    [
      "review.opportunitySentence.texturedShadow",
      "For future growth, a richer textured fragrance would add shadow and make the wardrobe feel more dimensional.",
    ],
    [
      "review.opportunitySentence.formalPolish",
      "For future growth, a more formal fragrance would add polish for dinners, events and dressed-up occasions.",
    ],
    [
      "review.opportunitySentence.contrastBroaden",
      "For future growth, one more contrasting fragrance would broaden the wardrobe without disturbing its current mood.",
    ],
  ])("resolves opportunity-sentence key %s", (key, english) => {
    expectLocalizedKey(key, english);
  });
});

describe("Curator-panel strength/opportunity item locale keys", () => {
  const strengthKeys = [
    ["review.strength.emptyStrengths", "A clear collection profile is beginning to take shape"],
    ["review.strength.dailyVersatility", "Excellent everyday versatility"],
    ["review.strength.officeWear", "Strong office and casual rotation"],
    ["review.strength.officeWearEvening", "Strong office and dressed-up rotation"],
    ["review.strength.warmCoolBalance", "Balanced warm and cool weather selection"],
    ["review.strength.coolWeatherDepth", "Strong cool-weather depth"],
    ["review.strength.seasonalBalance", "Wide seasonal flexibility"],
    ["review.strength.occasionRange", "Covers most daily situations confidently"],
    ["review.strength.signaturePotential", "Great signature scent potential"],
    ["review.strength.eveningDepth", "Confident evening presence"],
    ["review.strength.freshContrast", "Refined fresh-clean character"],
    ["review.strength.seasonal-range", "Strong seasonal coverage"],
    ["review.strength.daily-range", "Strong daily-range coverage"],
    ["review.strength.evening-range", "Strong evening-range coverage"],
    ["review.strength.polish", "Strong polished character"],
    ["review.strength.freshness", "Strong fresh character"],
    ["review.strength.depth", "Strong textured depth"],
    ["review.strength.strong-clean-coverage", "Strong clean coverage"],
    ["review.strength.clean-covered", "Clean covered"],
    ["review.strength.strong-versatile-coverage", "Strong versatile coverage"],
    ["review.strength.versatile-covered", "Versatile covered"],
    ["review.strength.strong-elegant-coverage", "Strong elegant coverage"],
    ["review.strength.elegant-covered", "Elegant covered"],
    ["review.strength.strong-bold-coverage", "Strong bold coverage"],
    ["review.strength.bold-covered", "Bold covered"],
    ["review.strength.strong-seductive-coverage", "Strong seductive coverage"],
    ["review.strength.seductive-covered", "Seductive covered"],
  ];

  const opportunityKeys = [
    ["review.opportunity.earthyDepth", "Could benefit from darker earthy or smoky depth"],
    ["review.opportunity.eveningDepth", "Could use richer evening character"],
    ["review.opportunity.spicyWarmth", "Limited spicy warmth"],
    ["review.opportunity.greenFreshness", "A greener aromatic profile would add freshness"],
    ["review.opportunity.formalElegance", "Could benefit from more formal elegance"],
    ["review.opportunity.freshContrast", "A brighter citrus profile would add contrast"],
    ["review.opportunity.coldWeatherWarmth", "Could use richer evening warmth"],
    ["review.opportunity.brighterFreshContrast", "Could use brighter fresh contrast"],
    ["review.opportunity.earthyDepthPlain", "Could benefit from darker earthy depth"],
    ["review.opportunity.greenAromaticLift", "Could use more green aromatic lift"],
    ["review.opportunity.texturedWarmth", "Could use richer textured warmth"],
    ["review.opportunity.coldWeatherCharacter", "Could use deeper cold-weather character"],
    ["review.opportunity.seasonal-range", "Limited seasonal coverage"],
    ["review.opportunity.daily-range", "Limited daily-range coverage"],
    ["review.opportunity.evening-range", "Limited evening-range coverage"],
    ["review.opportunity.polish", "Limited polished character"],
    ["review.opportunity.freshness", "Limited fresh character"],
    ["review.opportunity.depth", "Limited textured depth"],
    ["review.opportunity.improves-dressed-up-versatility", "Improves dressed-up versatility"],
    ["review.opportunity.adds-a-distinct-scent-direction", "Adds a distinct scent direction"],
    ["review.opportunity.expands-wearable-range", "Expands wearable range"],
  ];

  it.each(strengthKeys)("resolves strength key %s", (key, english) => {
    expectLocalizedKey(key, english);
  });

  it.each(opportunityKeys)("resolves opportunity key %s", (key, english) => {
    expectLocalizedKey(key, english);
  });

  it("gives every strength/opportunity key produced by the two English-text collisions its own distinct es-MX entry", () => {
    // rewriteReviewStrength/rewriteReviewOpportunity in BuilderPanel.jsx can
    // reach the same `key` (used for scoring/dedup) via two different code
    // paths that carried different English text -- resolved with a
    // `displayKey` override so each gets its own translation instead of one
    // path silently overwriting the other's meaning.
    expect(esMX["review.strength.officeWear"]).not.toBe(esMX["review.strength.officeWearEvening"]);
    expect(esMX["review.strength.warmCoolBalance"]).not.toBe(esMX["review.strength.coolWeatherDepth"]);
    expect(esMX["review.opportunity.spicyWarmth"]).not.toBe(esMX["review.opportunity.coldWeatherWarmth"]);
    expect(esMX["review.opportunity.freshContrast"]).not.toBe(esMX["review.opportunity.brighterFreshContrast"]);
    expect(esMX["review.opportunity.earthyDepth"]).not.toBe(esMX["review.opportunity.earthyDepthPlain"]);
  });
});

describe("Curator-panel season-coverage chart locale keys", () => {
  it("localizes season names via the existing taxonomy label system, not a new duplicate", () => {
    expect(esTranslator.label("seasons", "spring")).toBe("Primavera");
    expect(esTranslator.label("seasons", "summer")).toBe("Verano");
    expect(esTranslator.label("seasons", "fall")).toBe("Otoño");
    expect(esTranslator.label("seasons", "winter")).toBe("Invierno");
  });

  it("resolves the per-season coverage aria-label template in both locales", () => {
    expect(enUS["review.seasonCoverageAria"]).toBe("{season} coverage");
    expect(esMX["review.seasonCoverageAria"]).toBe("Cobertura de {season}");
    expect(enTranslator.t("review.seasonCoverageAria", { season: "Winter" })).toBe("Winter coverage");
    expect(esTranslator.t("review.seasonCoverageAria", { season: "Invierno" })).toBe("Cobertura de Invierno");
  });
});
