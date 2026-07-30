import { describe, expect, it, vi } from "vitest";

import { createAnalytics } from "./analytics/createAnalytics.js";
import { ANALYTICS_EVENTS } from "./analytics/events.js";
import { isCuratorBonusUnlocked } from "./builder/internal/curatorBonus/isCuratorBonusUnlocked.js";
import { buildFinalizationModel } from "./builder/internal/finalization/buildFinalizationModel.js";
import { buildCollectionSummary } from "./builder/internal/intelligence/buildCollectionSummary.js";
import { validateBuilderConfig } from "./builder/config/validateBuilderConfig.js";
import { enUS } from "./i18n/locales/en-US.js";
import { esMX } from "./i18n/locales/es-MX.js";
import { aurelianConfig } from "./merchants/aurelian/config.js";
import { discoveryDecantsConfig } from "./merchants/discoveryDecants/config.js";

describe("Phase 1 platform-readiness baseline", () => {
  it("pins each merchant's runtime rules and distinct persistence identity", () => {
    expect(aurelianConfig.locale).toBe("es-MX");
    expect(aurelianConfig.commerce.locale).toBe("es-MX");
    expect(aurelianConfig.box).toMatchObject({
      minSelectableSlots: 6,
      maxSelectableSlots: 14,
      minPoints: 12,
      totalPhysicalSlots: 16,
      bonusSlotCount: 2,
    });
    expect(discoveryDecantsConfig.box).toMatchObject({
      minSelectableSlots: 6,
      maxSelectableSlots: 14,
      minPoints: 12,
      totalPhysicalSlots: 16,
      bonusSlotCount: 2,
    });
    expect(aurelianConfig.persistence.storageKey).toBe("aurelian-builder-v1");
    expect(discoveryDecantsConfig.persistence.storageKey).toBe("decant-builder-v1");
    expect(aurelianConfig.persistence.storageKey).not.toBe(
      discoveryDecantsConfig.persistence.storageKey
    );
  });

  it("accepts both complete merchant configurations", () => {
    expect(validateBuilderConfig(aurelianConfig)).toBe(aurelianConfig);
    expect(validateBuilderConfig(discoveryDecantsConfig)).toBe(discoveryDecantsConfig);
  });

  it("keeps shared locale dictionaries in parity and merchant-neutral", () => {
    expect(Object.keys(esMX).sort()).toEqual(Object.keys(enUS).sort());
    expect(Object.values({ ...enUS, ...esMX }).join("\n")).not.toMatch(
      /Discovery Decants|Aurelian/
    );
  });

  it("preserves production point and monetary-total calculation", () => {
    const selectedPerfumes = [
      { id: 1, name: "Bronze", brand: "Test", points: 1 },
      { id: 2, name: "Silver", brand: "Test", points: 1.5 },
    ];
    const summary = buildCollectionSummary({
      selectedPerfumes,
      catalog: selectedPerfumes,
      notes: {},
      config: discoveryDecantsConfig,
    });

    expect(summary.points.total).toBe(2.5);
    expect(summary.money).toEqual({ pointValue: 100, total: 250, currency: "MXN" });
  });

  it("preserves Curator Bonus slots and two-part unlock requirement", () => {
    expect(discoveryDecantsConfig.curatorBonus).toMatchObject({
      enabled: true,
      targetPoints: 12,
    });
    expect(discoveryDecantsConfig.box.bonusSlotCount).toBe(2);
    expect(
      isCuratorBonusUnlocked({ totalPoints: 12, totalSlots: 5, targetPoints: 12, minSlots: 6 })
    ).toBe(false);
    expect(
      isCuratorBonusUnlocked({ totalPoints: 11.5, totalSlots: 6, targetPoints: 12, minSlots: 6 })
    ).toBe(false);
    expect(
      isCuratorBonusUnlocked({ totalPoints: 12, totalSlots: 6, targetPoints: 12, minSlots: 6 })
    ).toBe(true);
  });

  it("builds the current finalization payload without browser side effects", () => {
    const browserCalls = {
      open: vi.fn(),
      clipboardWrite: vi.fn(),
      storageWrite: vi.fn(),
    };
    const selectedPerfumes = [
      { id: 7, name: "Azure Office", brand: "Maison Test", points: 1 },
      { id: 3, name: "Amber Date", brand: "Atelier Warm", points: 1.5 },
    ];

    const result = buildFinalizationModel({
      selectedPerfumes,
      totalPoints: 2.5,
      estimatedValue: 250,
      isCollectionReady: false,
      customerInfo: { name: "Alex", city: "Monterrey", notes: "" },
      curatorBonus: {
        isUnlocked: false,
        preferenceLabel: "Complement My Collection",
        rewardLabel: "Bonus Fragrance",
      },
      config: discoveryDecantsConfig,
    });

    expect(result).toMatchObject({
      customer: { name: "Alex", city: "Monterrey", notes: "" },
      order: {
        items: selectedPerfumes,
        totalSlots: 2,
        totalPoints: 2.5,
        monetaryTotal: 250,
        currency: "MXN",
        curatorBonus: {
          isUnlocked: false,
          preferenceLabel: "Complement My Collection",
          rewardLabel: "Bonus Fragrance",
        },
      },
      readiness: {
        hasCustomerName: true,
        hasCustomerCity: true,
        isCollectionReady: false,
        isReady: false,
        blockers: ["collection-not-ready"],
      },
    });
    expect(result.message).toContain("Order total: $250");
    expect(result.message).toContain("Curator Bonus: Not unlocked");
    expect(Object.values(browserCalls).every((call) => call.mock.calls.length === 0)).toBe(true);
  });

  it("rejects analytics events containing customer PII", () => {
    const provider = { track: vi.fn() };
    const analytics = createAnalytics({ provider });
    const safePayload = {
      slotCount: 6,
      totalPoints: 12,
      orderTotal: 1200,
      curatorBonusUnlocked: true,
      channel: "whatsapp",
      copiedToClipboard: false,
      source: "manual",
    };

    [
      ["customerName", "Alex"],
      ["city", "Monterrey"],
      ["notes", "Private request"],
      ["phone", "5551234567"],
    ].forEach(([key, value]) => {
      expect(
        analytics.track(ANALYTICS_EVENTS.ORDER_FINALIZATION_SUCCEEDED, {
          ...safePayload,
          [key]: value,
        })
      ).toBe(false);
    });
    expect(provider.track).not.toHaveBeenCalled();
  });
});
