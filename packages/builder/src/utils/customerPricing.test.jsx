import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { fragrances } from "@discovery-box/catalog";
import PerfumeCard from "../components/PerfumeCard.jsx";
import { createBuilderConfig } from "../builder/config/index.js";
import {
  buildComposerBudgetBonusFeedback,
  buildComposerProposalBonusStatus,
} from "../builder/presentation/composerBonusStatus.js";
import { createTranslator } from "../i18n/createTranslator.js";
import { enUS } from "../i18n/locales/en-US.js";
import { esMX } from "../i18n/locales/es-MX.js";
import { createCustomerPricing, DEFAULT_CUSTOMER_PRICING } from "./customerPricing.js";
import { getTierData } from "./tierUtils.js";

// Customer-facing price display is opt-in per host (commerce.priceDisplay). These tests pin both
// halves of that contract: the default keeps every existing host on points, and "price" words the
// same numbers as MXN amounts without changing what they mean.

const priceConfig = {
  commerce: { priceDisplay: "price", pointValue: 100, currencySymbol: "$", currency: "MXN", locale: "es-MX" },
};

describe("createCustomerPricing", () => {
  it("defaults to the unchanged points presentation", () => {
    const points = createCustomerPricing(null);

    expect(points.isPriceDisplay).toBe(false);
    expect(points.formatPoints(1)).toBe("1 pt");
    expect(points.formatPoints(1.5)).toBe("1.5 pt");
    expect(points.formatPointsForAssistiveTech(2.5)).toBe("2.5 pt");
    expect(DEFAULT_CUSTOMER_PRICING.formatPoints(4)).toBe("4 pt");
    expect(createCustomerPricing({ commerce: { priceDisplay: "points", pointValue: 100 } }).formatPoints(2)).toBe("2 pt");
  });

  it("words a fragrance's value as its MXN amount (points x point value) when the host opts in", () => {
    const price = createCustomerPricing(priceConfig);

    expect(price.isPriceDisplay).toBe(true);
    expect([1, 1.5, 2, 2.5, 4, 5].map(price.formatPoints)).toEqual(["$100", "$150", "$200", "$250", "$400", "$500"]);
    expect(price.formatPoints(4.5)).toBe("$450");
    expect(price.formatPointsForAssistiveTech(1)).toBe("$100 MXN");
    expect(price.formatAmount(1900)).toBe("$1,900");
    expect(price.formatAmountWithCurrency(1200)).toBe("$1,200 MXN");
    expect(price.pointsToAmount(12)).toBe(1200);
    // never says "pt" or "points"
    [0.5, 1, 1.5, 2, 2.5, 4, 4.5, 5].forEach((value) => expect(price.formatPoints(value)).not.toMatch(/pt|point/i));
  });

  it("follows commerce.pointValue instead of hardcoding 100", () => {
    const custom = createCustomerPricing({ commerce: { ...priceConfig.commerce, pointValue: 37 } });

    expect(custom.formatPoints(2)).toBe("$74");
    expect(custom.pointsToAmount(12)).toBe(444);
  });

  it("prices every catalog fragrance by its tier: Bronze $100, Silver $150, Gold $200, Platinum $250, Diamond $400, Mythic $500", () => {
    const price = createCustomerPricing(priceConfig);
    const expectedByTier = { Bronze: "$100", Silver: "$150", Gold: "$200", Platinum: "$250", Diamond: "$400", Mythic: "$500" };
    const seen = {};

    fragrances.forEach((perfume) => {
      const tier = getTierData(perfume.id).name;
      (seen[tier] ||= new Set()).add(price.formatPoints(perfume.points));
    });

    Object.entries(expectedByTier).forEach(([tier, expected]) => {
      expect(seen[tier].has(expected), `${tier} should include ${expected}`).toBe(true);
    });
    // The chip is the real amount the total adds up: Carlisle is the one catalog entry priced above its
    // tier's usual $400 (4.5 points), so its chip says $450 rather than disagreeing with the total.
    const stray = fragrances.filter((perfume) => price.formatPoints(perfume.points) !== expectedByTier[getTierData(perfume.id).name]);
    expect(stray.map((perfume) => [perfume.name, price.formatPoints(perfume.points)])).toEqual([["Carlisle", "$450"]]);
  });
});

describe("commerce.priceDisplay config", () => {
  const base = { brand: { businessName: "Test" }, finalization: { whatsappNumber: "5210000000000" } };

  it("defaults to points and rejects anything else", () => {
    expect(createBuilderConfig(base).commerce.priceDisplay).toBe("points");
    expect(createBuilderConfig({ ...base, commerce: { priceDisplay: "price" } }).commerce.priceDisplay).toBe("price");
    expect(() => createBuilderConfig({ ...base, commerce: { priceDisplay: "dollars" } })).toThrow(/commerce\.priceDisplay/);
  });
});

describe("PerfumeCard tier chip", () => {
  const tierData = { color: "#cbd5e1", background: "rgba(203,213,225,0.12)", emoji: "⚪", name: "Silver" };
  const perfume = { id: 101, name: "Essenza", brand: "Acqua di Parma", points: 1.5, image: "/x.png", imageFallback: "/y.svg" };
  const render = (extra = {}) =>
    renderToStaticMarkup(
      <PerfumeCard perfume={perfume} tierData={tierData} assetResolver={(key) => `/images/${key}`} onAddToBox={() => {}} onOpenDetails={() => {}} isDisabled={false} {...extra} />
    );

  it("keeps the original points chip when the host does not opt in", () => {
    const markup = render();

    expect(markup).toContain('aria-label="1.5 pt"');
    expect(markup).toContain("<span>1.5 pt</span>");
  });

  it("shows the MXN price instead of points when the host opts in, and says so to assistive technology", () => {
    const markup = render({ pricing: createCustomerPricing(priceConfig) });

    expect(markup).toContain('aria-label="$150 MXN"');
    expect(markup).toContain("<span>$150</span>");
    expect(markup).toContain('<span aria-hidden="true">⚪</span>');
    const chip = markup.match(/<div class="perfume-card-points"[\s\S]*?<\/div>/)[0];
    expect(chip.replace(/<[^>]*>/g, "")).toBe("⚪$150");
  });
});

describe("Composer bonus wording in price mode", () => {
  const translator = createTranslator("es-MX");
  const priceBonusConfig = { ...priceConfig, translator, curatorBonus: { targetPoints: 12 } };
  const pointsBonusConfig = { commerce: { pointValue: 100, currencySymbol: "$" }, translator, curatorBonus: { targetPoints: 12 } };

  it("words the threshold and progress as amounts", () => {
    expect(buildComposerBudgetBonusFeedback({ budget: null, config: priceBonusConfig }).label).toBe("El bonus se desbloquea con $1,200.");
    const progress = buildComposerProposalBonusStatus({ totalPoints: 2.5, config: priceBonusConfig });
    expect(progress.state).toBe("progress");
    expect(progress.label).toBe("$250 / $1,200 hacia Curator Bonus.");
    expect(progress.value).toBe("$250 / $1,200");
    expect(buildComposerProposalBonusStatus({ totalPoints: 12, config: priceBonusConfig }).state).toBe("unlocked");
  });

  it("keeps the points wording for hosts that did not opt in", () => {
    expect(buildComposerBudgetBonusFeedback({ budget: null, config: pointsBonusConfig }).label).toBe("El bonus se desbloquea con 12 puntos.");
    expect(buildComposerProposalBonusStatus({ totalPoints: 2.5, config: pointsBonusConfig }).label).toBe("2.5 / 12 puntos hacia Curator Bonus.");
  });

  it("falls back to readable English when no translator is supplied", () => {
    const bare = { commerce: priceConfig.commerce, curatorBonus: { targetPoints: 12 } };

    expect(buildComposerBudgetBonusFeedback({ budget: null, config: bare }).label).toBe("Bonus unlocks at $1,200.");
    expect(buildComposerProposalBonusStatus({ totalPoints: 2.5, config: bare }).label).toBe("$250 / $1,200 toward Curator Bonus.");
  });
});

describe("price-mode locale keys", () => {
  it.each(["curator.amountAway", "composer.bonus.noLimitAmount", "composer.bonus.progressAmount", "composer.bonus.valueProgressAmount"])(
    "defines %s in both locales with its placeholders",
    (key) => {
      expect(enUS[key]).toBeTruthy();
      expect(esMX[key]).toBeTruthy();
      const placeholders = (text) => text.match(/\{\w+\}/g)?.sort().join(",");
      expect(placeholders(esMX[key])).toBe(placeholders(enUS[key]));
    }
  );

  it("renders the Spanish amount-away copy", () => {
    expect(createTranslator("es-MX").t("curator.amountAway", { amount: "$950" })).toBe("Faltan $950 para desbloquear tu Curator Bonus");
    expect(createTranslator("en-US").t("curator.amountAway", { amount: "$950" })).toBe("$950 away from unlocking your Curator Bonus");
  });
});
