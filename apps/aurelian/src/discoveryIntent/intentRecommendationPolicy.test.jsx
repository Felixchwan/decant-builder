import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { DiscoveryBoxBuilder } from "@discovery-box/builder";
import { createCatalogAssetResolver, notes } from "@discovery-box/catalog";
import { getIntentRecommendationHint } from "./intentRecommendationPolicy.js";
import { aurelianCatalog } from "../merchant/catalog.js";
import { aurelianConfig } from "../merchant/config.js";

const assetResolver = createCatalogAssetResolver({ basePath: "/catalog-assets" });

// Real, confirmed taxonomy (packages/catalog/src/metadataAssets.js).
const KNOWN_OCCASION_KEYS = new Set([
  "day", "daily", "night", "office", "casual", "date", "evening", "formal", "gym", "club", "special", "vacation",
]);
const KNOWN_VIBE_KEYS = new Set([
  "approachable", "aquatic", "artistic", "bold", "bright", "calm", "citrus", "classic", "clean", "confident",
  "cozy", "dark", "earthy", "easy", "edgy", "elegant", "energetic", "fresh", "fruity", "green", "intense",
  "luxurious", "masculine", "mass appealing", "mediterranean", "modern", "mysterious", "natural", "playful",
  "powerful", "relaxed", "seductive", "smooth", "soft", "sophisticated", "sporty", "sweet", "tropical",
  "unique", "versatile", "warm",
]);
const KNOWN_STRATEGIES = new Set(["balanced", "versatile", "explorer", "signature"]);

// Recomputed independently from the real catalog, not copied from the module
// under test — this is what makes the "not a hardcoded Squid id" assertions
// below meaningful: if a different fragrance carried warningMessage
// tomorrow, this set (and the assertions built on it) would move with it.
const REAL_WARNING_MESSAGE_IDS = new Set(
  aurelianCatalog.filter((perfume) => Boolean(perfume.warningMessage)).map((perfume) => perfume.id),
);
const SQUID_ID = aurelianCatalog.find((perfume) => perfume.name === "Squid")?.id;

describe("getIntentRecommendationHint", () => {
  it("returns a policy for each of the three recommendation-bearing intents, expressed only in Composer vocabulary", () => {
    for (const intentId of ["fresh_everyday", "intentional_evening", "gift"]) {
      const hint = getIntentRecommendationHint(intentId);

      expect(hint).toBeTruthy();
      expect(KNOWN_STRATEGIES.has(hint.strategy)).toBe(true);
      (hint.preferredOccasions || []).forEach((value) => expect(KNOWN_OCCASION_KEYS.has(value)).toBe(true));
      (hint.preferredVibes || []).forEach((value) => expect(KNOWN_VIBE_KEYS.has(value)).toBe(true));
      expect(Array.isArray(hint.excludedPerfumeIds)).toBe(true);
    }
  });

  it("returns null for explore_freely and any unknown id — no policy, no recommendation intermediary", () => {
    expect(getIntentRecommendationHint("explore_freely")).toBeNull();
    expect(getIntentRecommendationHint("unknown_id")).toBeNull();
  });

  it("matches the exact per-intent policy accepted for this first production iteration", () => {
    expect(getIntentRecommendationHint("fresh_everyday")).toMatchObject({
      strategy: "signature",
      preferredOccasions: ["daily", "day"],
      preferredVibes: ["fresh", "clean", "approachable", "easy"],
    });
    expect(getIntentRecommendationHint("intentional_evening")).toMatchObject({
      strategy: "signature",
      preferredOccasions: ["night", "date", "evening"],
      preferredVibes: ["seductive", "confident", "elegant", "sophisticated", "warm"],
      excludedPerfumeIds: [],
    });
    expect(getIntentRecommendationHint("gift")).toMatchObject({
      strategy: "versatile",
      preferredOccasions: ["special"],
    });
  });

  it("derives the gift exclusion from the catalog's real warningMessage flag, not a hardcoded id", () => {
    expect(SQUID_ID).toBeDefined();
    expect(REAL_WARNING_MESSAGE_IDS.size).toBeGreaterThan(0);

    const giftExcluded = new Set(getIntentRecommendationHint("gift").excludedPerfumeIds);

    expect(giftExcluded).toEqual(REAL_WARNING_MESSAGE_IDS);
    // Squid happens to be the one flagged fragrance today — confirmed as a
    // consequence of the real flag, not asserted as a fixed id in the policy.
    expect(giftExcluded.has(SQUID_ID)).toBe(true);
  });

  it("does not exclude warningMessage fragrances for Noche con intención (no existing safety rule requires it)", () => {
    expect(getIntentRecommendationHint("intentional_evening").excludedPerfumeIds).toEqual([]);
  });
});

describe("full-catalog accessibility, end-to-end against the real DiscoveryBoxBuilder", () => {
  it.each(["fresh_everyday", "intentional_evening", "gift"])(
    "leaves the full catalog count unchanged for intent %s",
    (intentId) => {
      const markup = renderToStaticMarkup(
        <DiscoveryBoxBuilder
          catalog={aurelianCatalog}
          notes={notes}
          config={aurelianConfig}
          assetResolver={assetResolver}
          initialRecommendationHint={getIntentRecommendationHint(intentId)}
        />,
      );

      expect(markup).toContain(`${aurelianCatalog.length} fragancias disponibles`);
      expect(markup).toContain("intent-recommendations");
    },
    15000,
  );

  it("bypasses the recommendation surface entirely for Quiero explorar todo, catalog count still unchanged", () => {
    const markup = renderToStaticMarkup(
      <DiscoveryBoxBuilder
        catalog={aurelianCatalog}
        notes={notes}
        config={aurelianConfig}
        assetResolver={assetResolver}
        initialRecommendationHint={getIntentRecommendationHint("explore_freely")}
      />,
    );

    expect(getIntentRecommendationHint("explore_freely")).toBeNull();
    expect(markup).not.toContain("intent-recommendations");
    expect(markup).not.toContain("Recomendado para ti");
    expect(markup).toContain(`${aurelianCatalog.length} fragancias disponibles`);
  });

  it("renders the recommendation surface and the full catalog simultaneously, and preserves existing box contents", { timeout: 15000 }, () => {
    const anyFragranceId = aurelianCatalog[0].id;
    const markup = renderToStaticMarkup(
      <DiscoveryBoxBuilder
        catalog={aurelianCatalog}
        notes={notes}
        config={aurelianConfig}
        assetResolver={assetResolver}
        initialFragranceId={anyFragranceId}
        initialRecommendationHint={getIntentRecommendationHint("fresh_everyday")}
      />,
    );

    // Both surfaces are present in the same render — there is no
    // hide/unmount toggle between them, so switching between them can never
    // lose box state.
    expect(markup).toContain("intent-recommendations");
    expect(markup).toContain(`${aurelianCatalog.length} fragancias disponibles`);
    // The fragrance pre-selected via initialFragranceId is still reflected
    // in the box count, proving it survived the recommendation surface
    // mounting alongside it.
    expect(markup).toContain("Mi caja <span>1</span>");
  });
});

describe("gift recommendations rendered end-to-end against the real catalog", () => {
  it("never shows Squid inside the recommendation surface, while the full catalog below still does", { timeout: 15000 }, () => {
    const markup = renderToStaticMarkup(
      <DiscoveryBoxBuilder
        catalog={aurelianCatalog}
        notes={notes}
        config={aurelianConfig}
        assetResolver={assetResolver}
        initialRecommendationHint={getIntentRecommendationHint("gift")}
      />,
    );

    expect(markup).toContain("Recomendado para ti");

    // Isolate the recommendation section's own markup — Squid legitimately
    // (and must) still appear in the full, untouched catalog grid below it;
    // this is a Gift-specific claim about the recommendation surface, not
    // about the whole page.
    const sectionStart = markup.indexOf('class="intent-recommendations"');
    const sectionEnd = markup.indexOf('class="catalog-controls"', sectionStart);
    expect(sectionStart).toBeGreaterThan(-1);
    expect(sectionEnd).toBeGreaterThan(sectionStart);
    const recommendationSectionMarkup = markup.slice(sectionStart, sectionEnd);

    expect(recommendationSectionMarkup).toContain("perfume-card");
    expect(recommendationSectionMarkup).not.toContain("Squid");
    expect(markup).toContain("Squid"); // still present in the full catalog grid
  });
});
