import { describe, expect, it } from "vitest";

import { createBuilderConfig } from "../../config/createBuilderConfig.js";
import { aurelianConfig } from "../../../merchants/aurelian/config.js";
import { discoveryDecantsConfig } from "../../../merchants/discoveryDecants/config.js";
import { composeCollection } from "./composeCollection.js";
import { normalizeComposerRequest } from "./normalizeComposerRequest.js";

const catalog = Object.freeze(
  Array.from({ length: 8 }, (_, index) =>
    Object.freeze({
      id: index + 1,
      name: `Fragrance ${index + 1}`,
      brand: "Test",
      points: index + 1,
      accords: [index % 2 ? "woody" : "fresh"],
      seasons: [index % 2 ? "winter" : "summer"],
      occasions: ["daily"],
      vibes: [index % 2 ? "warm" : "clean"],
      topNotes: [],
      middleNotes: [],
      baseNotes: [],
    }),
  ),
);

function divergentConfig(overrides = {}) {
  return createBuilderConfig({
    ...discoveryDecantsConfig,
    commerce: {
      ...discoveryDecantsConfig.commerce,
      pointValue: overrides.pointValue ?? 25,
      currency: "TST",
    },
    box: {
      ...discoveryDecantsConfig.box,
      minSelectableSlots: overrides.minSelectableSlots ?? 2,
      maxSelectableSlots: overrides.maxSelectableSlots ?? 5,
      defaultTargetSlots: overrides.defaultTargetSlots ?? 4,
      minPoints: overrides.minPoints ?? 7,
      totalPhysicalSlots: overrides.totalPhysicalSlots ?? 9,
      bonusSlotCount: overrides.bonusSlotCount ?? 4,
    },
    curatorBonus: {
      ...discoveryDecantsConfig.curatorBonus,
      enabled: overrides.bonusEnabled ?? true,
      targetPoints: overrides.bonusTargetPoints ?? 9,
    },
  });
}

function compose(config) {
  return composeCollection({
    request: { strategy: "balanced", collectionStyle: "more_variety" },
    catalog,
    config,
    mode: "fast",
  });
}

describe("Composer active Builder config", () => {
  it("uses supplied minimum, maximum, target, currency, and point-value rules", () => {
    const first = divergentConfig({
      minSelectableSlots: 2,
      maxSelectableSlots: 3,
      defaultTargetSlots: 3,
      pointValue: 25,
    });
    const second = divergentConfig({
      minSelectableSlots: 4,
      maxSelectableSlots: 6,
      defaultTargetSlots: 6,
      pointValue: 40,
    });

    const firstRequest = normalizeComposerRequest({ budget: 200 }, { config: first });
    const secondRequest = normalizeComposerRequest({ budget: 200 }, { config: second });

    expect(firstRequest).toMatchObject({
      minSlots: 2,
      maxSlots: 3,
      targetSlots: 3,
      pointValue: 25,
      currency: "TST",
      maxPoints: 8,
    });
    expect(secondRequest).toMatchObject({
      minSlots: 4,
      maxSlots: 6,
      targetSlots: 6,
      pointValue: 40,
      currency: "TST",
      maxPoints: 5,
    });
    expect(compose(first).normalizedRequest).toMatchObject({ minSlots: 2, maxSlots: 3 });
    expect(compose(second).normalizedRequest).toMatchObject({ minSlots: 4, maxSlots: 6 });
  });

  it("does not treat order-readiness, physical-capacity, or bonus rules as Composer constraints", () => {
    const first = divergentConfig({
      minPoints: 2,
      totalPhysicalSlots: 7,
      bonusSlotCount: 2,
      bonusEnabled: true,
      bonusTargetPoints: 3,
    });
    const second = divergentConfig({
      minPoints: 20,
      totalPhysicalSlots: 12,
      bonusSlotCount: 5,
      bonusEnabled: false,
      bonusTargetPoints: 30,
    });

    expect(first.box).toMatchObject({ minPoints: 2, totalPhysicalSlots: 7, bonusSlotCount: 2 });
    expect(second.box).toMatchObject({ minPoints: 20, totalPhysicalSlots: 12, bonusSlotCount: 5 });
    expect(first.curatorBonus).toMatchObject({ enabled: true, targetPoints: 3 });
    expect(second.curatorBonus).toMatchObject({ enabled: false, targetPoints: 30 });
    expect(compose(first).collectionIds).toEqual(compose(second).collectionIds);
  });

  it("routes both merchants through the same generic path and isolates sequential calls", () => {
    const discoveryResult = compose(discoveryDecantsConfig);
    const divergentResult = compose(divergentConfig({ minSelectableSlots: 2, maxSelectableSlots: 3 }));
    const aurelianResult = compose(aurelianConfig);

    expect(discoveryResult.normalizedRequest).toMatchObject({ minSlots: 6, maxSlots: 14 });
    expect(divergentResult.normalizedRequest).toMatchObject({ minSlots: 2, maxSlots: 3 });
    expect(aurelianResult.normalizedRequest).toMatchObject({ minSlots: 6, maxSlots: 14 });
  });

  it("does not mutate frozen active config or canonical catalog records", () => {
    const config = deepFreeze(divergentConfig());
    const before = JSON.stringify(config);

    expect(() => compose(config)).not.toThrow();
    expect(JSON.stringify(config)).toBe(before);
    expect(catalog.every(Object.isFrozen)).toBe(true);
  });

  it("fails clearly when active Composer rules are missing", () => {
    expect(() => composeCollection({ catalog })).toThrow(
      "Composer requires the active normalized Builder config.",
    );
    expect(() => normalizeComposerRequest({}, { config: { box: {} } })).toThrow(
      "Composer requires active Builder config field box.minSelectableSlots.",
    );
  });
});

function deepFreeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    Object.values(value).forEach(deepFreeze);
  }

  return value;
}
