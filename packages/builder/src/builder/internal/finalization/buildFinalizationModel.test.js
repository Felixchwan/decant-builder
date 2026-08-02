import { describe, expect, it } from "vitest";

import {
  buildFinalizationModel,
  normalizeCustomerInfo,
} from "./buildFinalizationModel.js";
import { aurelianConfig } from "../../../../../../apps/aurelian/src/merchant/config.js";

const config = {
  brand: {
    businessName: "Discovery Decants Test",
  },
  commerce: {
    currency: "MXN",
    pointValue: 100,
  },
  finalization: {
    visibleCustomerFields: ["name", "city", "notes"],
    whatsapp: {
      greeting:
        "Hello {businessName}, I would like to finalize my Discovery Box order.",
      closing: "Please confirm availability and next steps. Thank you.",
    },
  },
};

const selectedPerfumes = [
  {
    id: 7,
    name: "Azure Office",
    brand: "Maison Test",
    points: 1,
  },
  {
    id: 3,
    name: "Amber Date",
    brand: "Atelier Warm",
    points: 1.5,
  },
  {
    id: 9,
    name: "Nocturne Leather",
    brand: "Maison Test",
    points: 2,
  },
];

function model(overrides = {}) {
  return buildFinalizationModel({
    selectedPerfumes,
    totalPoints: 4.5,
    estimatedValue: 450,
    isCollectionReady: true,
    customerInfo: {
      name: "Alex",
      city: "Monterrey",
      notes: "Prefer fresh bonus picks",
    },
    curatorBonus: {
      isUnlocked: true,
      preferenceLabel: "Complement My Collection",
      rewardLabel: "Bonus Fragrance",
    },
    config,
    ...overrides,
  });
}

function deepFreeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    Object.values(value).forEach(deepFreeze);
  }

  return value;
}

describe("buildFinalizationModel", () => {
  describe("normalizeCustomerInfo", () => {
    it("trims valid string fields", () => {
      expect(
        normalizeCustomerInfo({
          name: "  Ana  ",
          city: "  San Pedro ",
          notes: "  No heavy smoke  ",
        })
      ).toEqual({
        name: "Ana",
        city: "San Pedro",
        notes: "No heavy smoke",
      });
    });

    it("normalizes missing and non-string field values to empty strings", () => {
      expect(normalizeCustomerInfo()).toEqual({ name: "", city: "", notes: "" });
      expect(
        normalizeCustomerInfo({
          name: 123,
          city: true,
          notes: null,
        })
      ).toEqual({ name: "", city: "", notes: "" });
      expect(
        normalizeCustomerInfo({
          name: "",
          city: "   ",
          notes: undefined,
        })
      ).toEqual({ name: "", city: "", notes: "" });
    });

    it("characterizes null customer input as invalid", () => {
      expect(() => normalizeCustomerInfo(null)).toThrow();
    });

    it("applies conservative field length limits after trimming", () => {
      expect(normalizeCustomerInfo(
        { name: ` ${"A".repeat(8)} `, city: "Monterrey", notes: "" },
        ["name", "city"],
        { name: 5, city: 120, notes: 500 }
      ).name).toBe("AAAAA");
    });
  });

  it("builds an empty finalization model with locked bonus messaging", () => {
    const result = model({
      selectedPerfumes: [],
      totalPoints: 0,
      estimatedValue: 0,
      isCollectionReady: false,
      customerInfo: undefined,
      curatorBonus: undefined,
    });

    expect(result).toEqual({
      customer: { name: "", city: "", notes: "" },
      order: {
        items: [],
        totalSlots: 0,
        totalPoints: 0,
        monetaryTotal: 0,
        currency: "MXN",
        curatorBonus: {
          isUnlocked: false,
          preferenceLabel: "",
          rewardLabel: "",
        },
      },
      readiness: {
        hasCustomerName: false,
        hasCustomerCity: false,
        isCollectionReady: false,
        isReady: false,
        blockers: [
          "collection-not-ready",
          "customer-name-required",
          "customer-city-required",
        ],
      },
      message: [
        "Hello Discovery Decants Test, I would like to finalize my Discovery Box order.",

        "Customer: ",
        "City: ",

        "Selected fragrances:",

        "Total slots: 0",
        "Total points: 0.0",
        "Order total: $0",
        "Curator Bonus: Not unlocked",

        "Please confirm availability and next steps. Thank you.",
      ].join("\n"),
    });
  });

  it("builds a ready minimum order with exact item ordering and unlocked bonus wording", () => {
    const result = model();

    expect(result.order.items).toEqual([
      { id: 7, name: "Azure Office", brand: "Maison Test", points: 1 },
      { id: 3, name: "Amber Date", brand: "Atelier Warm", points: 1.5 },
      { id: 9, name: "Nocturne Leather", brand: "Maison Test", points: 2 },
    ]);
    expect(result.order).toMatchObject({
      totalSlots: 3,
      totalPoints: 4.5,
      monetaryTotal: 450,
      currency: "MXN",
      curatorBonus: {
        isUnlocked: true,
        preferenceLabel: "Complement My Collection",
        rewardLabel: "Bonus Fragrance",
      },
    });
    expect(result.readiness).toEqual({
      hasCustomerName: true,
      hasCustomerCity: true,
      isCollectionReady: true,
      isReady: true,
      blockers: [],
    });
    expect(result.message).toBe(
      [
        "Hello Discovery Decants Test, I would like to finalize my Discovery Box order.",

        "Customer: Alex",
        "City: Monterrey",
        "Notes: Prefer fresh bonus picks",

        "Selected fragrances:",
        "1. Azure Office - Maison Test (1 pt)",
        "2. Amber Date - Atelier Warm (1.5 pt)",
        "3. Nocturne Leather - Maison Test (2 pt)",

        "Total slots: 3",
        "Total points: 4.5",
        "Order total: $450",
        "Curator Bonus: Unlocked",
        "Curator Style: Complement My Collection",

        "Please confirm availability and next steps. Thank you.",
      ].join("\n")
    );
  });

  it("builds a maximum-style order without reordering or deduplicating items", () => {
    const duplicate = selectedPerfumes[1];
    const maxItems = [
      selectedPerfumes[2],
      duplicate,
      selectedPerfumes[0],
      duplicate,
      { id: 12, name: "Iris Ledger", brand: "Archive House", points: 2.5 },
    ];

    const result = model({
      selectedPerfumes: maxItems,
      totalPoints: 9,
      estimatedValue: 900,
    });

    expect(result.order.items.map((item) => item.id)).toEqual([9, 3, 7, 3, 12]);
    expect(result.order.totalSlots).toBe(5);
    expect(result.message).toContain("2. Amber Date - Atelier Warm (1.5 pt)");
    expect(result.message).toContain("4. Amber Date - Atelier Warm (1.5 pt)");
  });

  it("formats pricing from supplied totals rather than computing from point value", () => {
    expect(
      model({
        totalPoints: 12,
        estimatedValue: 960,
        config: {
          ...config,
          commerce: { currency: "USD", pointValue: 80 },
        },
      }).message
    ).toContain("Order total: $960");
    expect(
      model({
        totalPoints: 0.25,
        estimatedValue: 0,
      }).message
    ).toContain("Order total: $0");
    expect(
      model({
        totalPoints: 12.25,
        estimatedValue: 1224.5,
      }).message
    ).toContain("Order total: $1225");
    expect(
      model({
        totalPoints: 9999.95,
        estimatedValue: 1234567.89,
      }).message
    ).toContain("Order total: $1234568");
  });

  it("formats total points with one decimal place", () => {
    expect(model({ totalPoints: 12 }).message).toContain("Total points: 12.0");
    expect(model({ totalPoints: 12.24 }).message).toContain("Total points: 12.2");
    expect(model({ totalPoints: 12.25 }).message).toContain("Total points: 12.3");
  });

  it("handles locked, unknown, and partial curator bonus fields with exact wording", () => {
    expect(
      model({
        curatorBonus: {
          isUnlocked: false,
          preferenceLabel: "Complement My Collection",
          rewardLabel: "Bonus Fragrance",
        },
      }).message
    ).toContain("Curator Bonus: Not unlocked");
    expect(
      model({
        curatorBonus: {
          isUnlocked: true,
          preferenceLabel: "Unknown Strategy",
          rewardLabel: "Unexpected Reward",
        },
      }).message
    ).toContain("Curator Style: Unknown Strategy");
    expect(
      model({
        curatorBonus: {
          isUnlocked: true,
        },
      }).message
    ).toContain("Curator Style: ");
  });

  it("omits optional notes when absent, empty, or whitespace-only", () => {
    [
      {},
      { notes: "" },
      { notes: "   " },
      { notes: null },
      { notes: 123 },
    ].forEach((customerInfo) => {
      expect(
        model({
          customerInfo: {
            name: "Ana",
            city: "Monterrey",
            ...customerInfo,
          },
        }).message
      ).not.toContain("Notes:");
    });
  });

  it("omits notes when the host hides the notes field", () => {
    const result = model({
      config: {
        ...config,
        finalization: {
          ...config.finalization,
          visibleCustomerFields: ["name", "city"],
        },
      },
    });

    expect(result.customer.notes).toBe("");
    expect(result.message).not.toContain("Notes:");
  });

  it("preserves multiline notes and special characters after outer trimming", () => {
    const result = model({
      customerInfo: {
        name: "  Carla ",
        city: " San Pedro ",
        notes: "  Line one\nLine two & citrus > smoke  ",
      },
    });

    expect(result.customer).toEqual({
      name: "Carla",
      city: "San Pedro",
      notes: "Line one\nLine two & citrus > smoke",
    });
    expect(result.message).toContain(
      "Notes: Line one\nLine two & citrus > smoke"
    );
  });

  it("captures readiness blockers independently for customer and collection state", () => {
    expect(
      model({
        isCollectionReady: false,
        customerInfo: { name: "Ana", city: "Monterrey", notes: "" },
      }).readiness
    ).toEqual({
      hasCustomerName: true,
      hasCustomerCity: true,
      isCollectionReady: false,
      isReady: false,
      blockers: ["collection-not-ready"],
    });
    expect(
      model({
        isCollectionReady: true,
        customerInfo: { name: "", city: " ", notes: "" },
      }).readiness
    ).toEqual({
      hasCustomerName: false,
      hasCustomerCity: false,
      isCollectionReady: true,
      isReady: false,
      blockers: ["customer-name-required", "customer-city-required"],
    });
  });

  it("characterizes malformed perfume records in the message", () => {
    const result = model({
      selectedPerfumes: [
        { id: 1 },
        { id: 2, name: "Missing Brand", points: 1 },
      ],
    });

    expect(result.order.items).toEqual([
      { id: 1, name: undefined, brand: undefined, points: undefined },
      { id: 2, name: "Missing Brand", brand: undefined, points: 1 },
    ]);
    expect(result.message).toContain("1. undefined - undefined (undefined pt)");
    expect(result.message).toContain("2. Missing Brand - undefined (1 pt)");
    expect(() => model({ selectedPerfumes: [null] })).toThrow();
  });

  it("uses localized order labels from merchant config without changing item structure", () => {
    const result = model({
      curatorBonus: {
        isUnlocked: true,
        preferenceLabel: aurelianConfig.curatorBonus.preferences.complement.label,
        rewardLabel: aurelianConfig.curatorBonus.rewardLabel,
      },
      config: aurelianConfig,
    });

    expect(result.order.items).toEqual([
      { id: 7, name: "Azure Office", brand: "Maison Test", points: 1 },
      { id: 3, name: "Amber Date", brand: "Atelier Warm", points: 1.5 },
      { id: 9, name: "Nocturne Leather", brand: "Maison Test", points: 2 },
    ]);
    expect(result.message).toContain("Solicitud de disponibilidad");
    expect(result.message).toContain("Nombre: Alex");
    expect(result.message).toContain("Municipio: Monterrey");
    expect(result.message).toContain("Fragancias seleccionadas:");
    expect(result.message).toContain("Total de fragancias: 3");
    expect(result.message).toContain("Puntos totales: 4.5");
    expect(result.message).toContain("Total estimado de la Discovery Box: $450");
    expect(result.message).toContain("Curator Bonus: Desbloqueado");
    expect(result.message).toContain("Preferencia Curator Bonus: Complementar mi colección");
    expect(result.message).toContain("confirmará disponibilidad antes de enviarme las instrucciones de pago");
    expect(result.message).not.toContain("Notes:");
    expect(result.message).not.toMatch(/pedido confirmado|pago completado|inventario garantizado/i);
    expect(result.message).not.toContain("Discovery Decants");
  });

  it("treats non-array selected perfume input as an empty order", () => {
    const result = model({ selectedPerfumes: null });

    expect(result.order.items).toEqual([]);
    expect(result.order.totalSlots).toBe(0);
    expect(result.message).toContain("Selected fragrances:\nTotal slots: 0");
  });

  it("characterizes invalid numeric and config inputs as throwing during message formatting", () => {
    expect(() => model({ totalPoints: undefined })).toThrow();
    expect(() => model({ estimatedValue: undefined })).toThrow();
    expect(() => model({ config: {} })).toThrow();
    expect(() => model({ customerInfo: null })).toThrow();
  });

  it("does not mutate frozen customer, perfume, curator bonus, or config inputs", () => {
    const frozenPerfumes = deepFreeze([
      { id: 11, name: "Frozen One", brand: "Frozen Brand", points: 1 },
      { id: 12, name: "Frozen Two", brand: "Frozen Brand", points: 2 },
    ]);
    const frozenCustomer = deepFreeze({
      name: "  Ana  ",
      city: "  Monterrey  ",
      notes: "  Fresh  ",
    });
    const frozenBonus = deepFreeze({
      isUnlocked: true,
      preferenceLabel: "Similar To My Picks",
      rewardLabel: "Bonus Fragrance",
    });
    const frozenConfig = deepFreeze({
      brand: { ...config.brand },
      commerce: { ...config.commerce },
      finalization: {
        whatsapp: { ...config.finalization.whatsapp },
      },
    });

    const result = buildFinalizationModel({
      selectedPerfumes: frozenPerfumes,
      totalPoints: 3,
      estimatedValue: 300,
      isCollectionReady: true,
      customerInfo: frozenCustomer,
      curatorBonus: frozenBonus,
      config: frozenConfig,
    });

    expect(result.customer).toEqual({
      name: "Ana",
      city: "Monterrey",
      notes: "Fresh",
    });
    expect(frozenCustomer.name).toBe("  Ana  ");
    expect(frozenPerfumes[0].name).toBe("Frozen One");
    expect(Object.isFrozen(frozenConfig.finalization.whatsapp)).toBe(true);
  });

  it("is deterministic for identical inputs including byte-for-byte message output", () => {
    const first = model();
    const second = model();

    expect(second).toEqual(first);
    expect(second.message).toBe(first.message);
  });

  it("covers a realistic golden finalization workflow", () => {
    const result = buildFinalizationModel({
      selectedPerfumes: [
        { id: 21, name: "Citrus Reserve", brand: "Bright Lab", points: 2 },
        { id: 14, name: "Iris Ledger", brand: "Archive House", points: 2.5 },
        { id: 7, name: "Amber Date", brand: "Atelier Warm", points: 1.5 },
      ],
      totalPoints: 6,
      estimatedValue: 570,
      isCollectionReady: true,
      customerInfo: {
        name: "  Mariana  ",
        city: "  Guadalajara ",
        notes: "  Gift order\nPrefer clean presentation  ",
      },
      curatorBonus: {
        isUnlocked: true,
        preferenceLabel: "Similar To My Picks",
        rewardLabel: "Bonus Fragrance",
      },
      config: {
        ...config,
        brand: { businessName: "Discovery Decants" },
      },
    });

    expect(result).toEqual({
      customer: {
        name: "Mariana",
        city: "Guadalajara",
        notes: "Gift order\nPrefer clean presentation",
      },
      order: {
        items: [
          { id: 21, name: "Citrus Reserve", brand: "Bright Lab", points: 2 },
          { id: 14, name: "Iris Ledger", brand: "Archive House", points: 2.5 },
          { id: 7, name: "Amber Date", brand: "Atelier Warm", points: 1.5 },
        ],
        totalSlots: 3,
        totalPoints: 6,
        monetaryTotal: 570,
        currency: "MXN",
        curatorBonus: {
          isUnlocked: true,
          preferenceLabel: "Similar To My Picks",
          rewardLabel: "Bonus Fragrance",
        },
      },
      readiness: {
        hasCustomerName: true,
        hasCustomerCity: true,
        isCollectionReady: true,
        isReady: true,
        blockers: [],
      },
      message: [
        "Hello Discovery Decants, I would like to finalize my Discovery Box order.",

        "Customer: Mariana",
        "City: Guadalajara",
        "Notes: Gift order\nPrefer clean presentation",

        "Selected fragrances:",
        "1. Citrus Reserve - Bright Lab (2 pt)",
        "2. Iris Ledger - Archive House (2.5 pt)",
        "3. Amber Date - Atelier Warm (1.5 pt)",

        "Total slots: 3",
        "Total points: 6.0",
        "Order total: $570",
        "Curator Bonus: Unlocked",
        "Curator Style: Similar To My Picks",

        "Please confirm availability and next steps. Thank you.",
      ].join("\n"),
    });
  });
});
