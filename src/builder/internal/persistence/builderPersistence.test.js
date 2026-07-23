import { describe, expect, it } from "vitest";

import {
  clearPersistedBuilderState,
  createBuilderPersistencePayload,
  hasMeaningfulBuilderPersistence,
  hydrateBuilderPersistence,
  loadPersistedBuilderState,
  parseBuilderPersistence,
  savePersistedBuilderState,
  sanitizePersistedBuilderState,
  serializeBuilderPersistence,
} from "./builderPersistence.js";

const config = {
  box: {
    maxSelectableSlots: 4,
  },
  curatorBonus: {
    defaultPreference: "complement",
    preferences: {
      complement: { label: "Complement My Collection" },
      similar: { label: "Similar To My Picks" },
    },
  },
  persistence: {
    storageKey: "tenant-builder-state",
    schemaVersion: 1,
  },
};

const defaultCustomerInfo = {
  name: "",
  city: "",
  notes: "",
};

const defaultBuilderState = {
  selectedPerfumeIds: [],
  curatorBonusPreference: "complement",
  customerInfo: defaultCustomerInfo,
};

const catalog = [
  { id: 7, name: "Seven", points: 1 },
  { id: 3, name: "Three", points: 1.5 },
  { id: 9, name: "Nine", points: 2 },
  { id: "7", name: "String Seven", points: 1 },
  { id: 12, name: "Twelve", points: 2.5 },
  { id: 5, name: "Five", points: 1 },
  { id: 14, name: "Fourteen", points: 3 },
  { id: 21, name: "Twenty One", points: 4 },
];

function payload(overrides = {}) {
  return {
    version: 1,
    selectedPerfumeIds: [9, 3],
    curatorBonusPreference: "similar",
    customerInfo: {
      name: "Alex",
      city: "Monterrey",
      notes: "Prefer fresh picks",
    },
    ...overrides,
  };
}

function raw(overrides = {}) {
  return JSON.stringify(payload(overrides));
}

function hydrate(overrides = {}) {
  return hydrateBuilderPersistence({
    rawValue: raw(),
    catalog,
    config,
    defaultBuilderState,
    ...overrides,
  });
}

function ids(state) {
  return state.selectedPerfumes.map((perfume) => perfume.id);
}

function deepFreeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    Object.values(value).forEach(deepFreeze);
  }

  return value;
}

function createMemoryStorage(initialValues = {}) {
  const values = new Map(Object.entries(initialValues));

  return {
    getItem(key) {
      return values.has(key) ? values.get(key) : null;
    },
    setItem(key, value) {
      values.set(key, String(value));
    },
    removeItem(key) {
      values.delete(key);
    },
    dump() {
      return Object.fromEntries(values);
    },
  };
}

function createThrowingStorage(methods = ["getItem", "setItem", "removeItem"]) {
  return {
    getItem() {
      if (methods.includes("getItem")) {
        throw new Error("storage unavailable");
      }

      return null;
    },
    setItem() {
      if (methods.includes("setItem")) {
        throw new Error("write failed");
      }
    },
    removeItem() {
      if (methods.includes("removeItem")) {
        throw new Error("clear failed");
      }
    },
  };
}

describe("builderPersistence", () => {
  describe("parseBuilderPersistence", () => {
    it("parses valid JSON objects, arrays, null literals, and primitive JSON", () => {
      expect(parseBuilderPersistence(raw())).toEqual(payload());
      expect(parseBuilderPersistence("[]")).toEqual([]);
      expect(parseBuilderPersistence("null")).toBeNull();
      expect(parseBuilderPersistence('"text"')).toBe("text");
      expect(parseBuilderPersistence("7")).toBe(7);
    });

    it("returns null for missing, empty, and malformed values without throwing", () => {
      expect(parseBuilderPersistence(null)).toBeNull();
      expect(parseBuilderPersistence(undefined)).toBeNull();
      expect(parseBuilderPersistence("")).toBeNull();
      expect(parseBuilderPersistence("not json")).toBeNull();
      expect(parseBuilderPersistence('{"version":1')).toBeNull();
    });
  });

  describe("createBuilderPersistencePayload", () => {
    it("creates the exact current payload shape with ordered selected IDs", () => {
      const selectedPerfumes = [catalog[2], catalog[0], catalog[1]];
      const customerInfo = { name: "Ana", city: "San Pedro", notes: "" };

      expect(
        createBuilderPersistencePayload({
          selectedPerfumes,
          curatorBonusPreference: "similar",
          customerInfo,
        })
      ).toEqual({
        version: 1,
        selectedPerfumeIds: [9, 7, 3],
        curatorBonusPreference: "similar",
        customerInfo,
      });
    });

    it("characterizes invalid selected input and incomplete perfume records", () => {
      expect(
        createBuilderPersistencePayload({
          selectedPerfumes: null,
          curatorBonusPreference: undefined,
          customerInfo: undefined,
        })
      ).toEqual({
        version: 1,
        selectedPerfumeIds: [],
        curatorBonusPreference: undefined,
        customerInfo: undefined,
      });
      expect(
        createBuilderPersistencePayload({
          selectedPerfumes: [{ name: "Missing ID" }, catalog[0], { id: "7" }, { id: 7 }],
          curatorBonusPreference: "complement",
          customerInfo: null,
        })
      ).toEqual({
        version: 1,
        selectedPerfumeIds: [undefined, 7, "7", 7],
        curatorBonusPreference: "complement",
        customerInfo: null,
      });
    });

    it("does not mutate frozen selected arrays or customer info", () => {
      const selectedPerfumes = deepFreeze([catalog[1], catalog[0]]);
      const customerInfo = deepFreeze({ name: "Ana", city: "Monterrey", notes: "No oud" });

      const result = createBuilderPersistencePayload({
        selectedPerfumes,
        curatorBonusPreference: "similar",
        customerInfo,
      });

      expect(result.selectedPerfumeIds).toEqual([3, 7]);
      expect(Object.isFrozen(selectedPerfumes)).toBe(true);
      expect(customerInfo).toEqual({ name: "Ana", city: "Monterrey", notes: "No oud" });
    });
  });

  describe("serializeBuilderPersistence", () => {
    it("serializes the exact payload shape and preserves selected order", () => {
      expect(
        serializeBuilderPersistence({
          selectedPerfumes: [catalog[4], catalog[1], catalog[0]],
          curatorBonusPreference: "similar",
          customerInfo: { name: "Ana", city: "Monterrey", notes: "Fresh" },
        })
      ).toBe(
        '{"version":1,"selectedPerfumeIds":[12,3,7],"curatorBonusPreference":"similar","customerInfo":{"name":"Ana","city":"Monterrey","notes":"Fresh"}}'
      );
    });

    it("characterizes duplicate IDs, string IDs, missing IDs, and empty selection serialization", () => {
      expect(
        serializeBuilderPersistence({
          selectedPerfumes: [],
          curatorBonusPreference: "complement",
          customerInfo: defaultCustomerInfo,
        })
      ).toBe(
        '{"version":1,"selectedPerfumeIds":[],"curatorBonusPreference":"complement","customerInfo":{"name":"","city":"","notes":""}}'
      );
      expect(
        serializeBuilderPersistence({
          selectedPerfumes: [catalog[0], catalog[0], catalog[3], { name: "No ID" }],
          curatorBonusPreference: undefined,
          customerInfo: undefined,
        })
      ).toBe('{"version":1,"selectedPerfumeIds":[7,7,"7",null]}');
    });
  });

  describe("hydrateBuilderPersistence", () => {
    it("hydrates valid payloads to catalog object references in saved order", () => {
      const state = hydrate();

      expect(state).toEqual({
        selectedPerfumeIds: [9, 3],
        curatorBonusPreference: "similar",
        customerInfo: {
          name: "Alex",
          city: "Monterrey",
          notes: "Prefer fresh picks",
        },
        selectedPerfumes: [catalog[2], catalog[1]],
        wasRestored: true,
      });
      expect(state.selectedPerfumes[0]).toBe(catalog[2]);
      expect(ids(state)).toEqual([9, 3]);
    });

    it("returns default hydrated state for missing, malformed, empty, and wrong-shaped stored values", () => {
      [null, undefined, "", "plain text", "{}", "[]", "null", JSON.stringify({ version: 1 })].forEach((rawValue) => {
        expect(
          hydrateBuilderPersistence({
            rawValue,
            catalog,
            config,
            defaultBuilderState,
          })
        ).toEqual({
          ...defaultBuilderState,
          selectedPerfumes: [],
          wasRestored: false,
        });
      });
    });

    it("requires the configured schema version and rejects missing, old, future, and non-numeric versions", () => {
      [undefined, 0, 2, "1"].forEach((version) => {
        const state = hydrate({
          rawValue: raw({ version }),
        });

        expect(state).toEqual({
          ...defaultBuilderState,
          selectedPerfumes: [],
          wasRestored: false,
        });
      });
    });

    it("validates curator preference and customer info with exact fallbacks", () => {
      expect(
        hydrate({
          rawValue: raw({
            curatorBonusPreference: "unknown",
            customerInfo: {
              name: 123,
              city: "Guadalajara",
              notes: null,
              extra: "ignored",
            },
          }),
        })
      ).toMatchObject({
        curatorBonusPreference: "complement",
        customerInfo: {
          name: "",
          city: "Guadalajara",
          notes: "",
        },
      });
      expect(
        hydrate({
          rawValue: raw({ customerInfo: null }),
        }).customerInfo
      ).toBe(defaultCustomerInfo);
    });

    it("drops unknown IDs and deduplicates stored IDs while preserving first occurrence order", () => {
      const state = hydrate({
        rawValue: raw({ selectedPerfumeIds: [9, 99, 3, 9, 12, 3] }),
      });

      expect(state.selectedPerfumeIds).toEqual([9, 3, 12]);
      expect(ids(state)).toEqual([9, 3, 12]);
      expect(state.wasRestored).toBe(true);
    });

    it("uses integer-only ID semantics during hydration", () => {
      const state = hydrate({
        rawValue: raw({ selectedPerfumeIds: ["7", 7, "3", 3] }),
      });

      expect(state.selectedPerfumeIds).toEqual([7, 3]);
      expect(ids(state)).toEqual([7, 3]);
    });

    it("caps restored IDs using config.box.maxSelectableSlots before unknown removal", () => {
      const state = hydrate({
        rawValue: raw({ selectedPerfumeIds: [99, 21, 14, 12, 9, 3] }),
      });

      expect(state.selectedPerfumeIds).toEqual([21, 14, 12, 9]);
      expect(ids(state)).toEqual([21, 14, 12, 9]);
    });

    it("uses the first matching catalog object when the catalog contains duplicate IDs", () => {
      const duplicateFirst = { id: 7, name: "First Seven" };
      const duplicateSecond = { id: 7, name: "Second Seven" };
      const state = hydrate({
        catalog: [duplicateFirst, duplicateSecond, catalog[1]],
        rawValue: raw({ selectedPerfumeIds: [7, 3] }),
      });

      expect(state.selectedPerfumes).toEqual([duplicateFirst, catalog[1]]);
      expect(state.selectedPerfumes[0]).toBe(duplicateFirst);
    });

    it("marks restored false when a valid payload has no recoverable selected IDs", () => {
      expect(
        hydrate({
          rawValue: raw({ selectedPerfumeIds: [] }),
        })
      ).toMatchObject({
        selectedPerfumeIds: [],
        selectedPerfumes: [],
        wasRestored: false,
      });
      expect(
        hydrate({
          rawValue: raw({ selectedPerfumeIds: [99] }),
        })
      ).toMatchObject({
        selectedPerfumeIds: [],
        selectedPerfumes: [],
        wasRestored: false,
      });
    });

    it("throws when required config/default state inputs are absent", () => {
      expect(() =>
        hydrateBuilderPersistence({
          rawValue: raw(),
          catalog,
          config,
        })
      ).toThrow();
      expect(() =>
        hydrateBuilderPersistence({
          rawValue: raw(),
          catalog,
          defaultBuilderState,
        })
      ).toThrow();
    });
  });

  describe("sanitizePersistedBuilderState", () => {
    it("returns null for invalid JSON parse results and wrong top-level types", () => {
      [null, [], "text", 7, { version: 2 }].forEach((value) => {
        expect(
          sanitizePersistedBuilderState({
            value,
            catalog,
            config,
            defaultCustomerInfo,
          })
        ).toBeNull();
      });
    });

    it("uses defaults for valid versioned objects with missing optional fields", () => {
      expect(
        sanitizePersistedBuilderState({
          value: { version: 1 },
          catalog,
          config,
          defaultCustomerInfo,
        })
      ).toEqual({
        selectedPerfumeIds: [],
        curatorBonusPreference: "complement",
        customerInfo: defaultCustomerInfo,
      });
    });

    it("normalizes valid persisted state without mutating canonical constraints", () => {
      const sanitized = sanitizePersistedBuilderState({
        value: payload({
          selectedPerfumeIds: [9, 99, 3, 9, 12, 21, 14],
          curatorBonusPreference: "unknown",
          customerInfo: { name: 5, city: "Monterrey", notes: null },
        }),
        catalog,
        config,
        defaultCustomerInfo,
      });

      expect(sanitized).toEqual({
        selectedPerfumeIds: [9, 3, 12],
        curatorBonusPreference: "complement",
        customerInfo: {
          name: "",
          city: "Monterrey",
          notes: "",
        },
      });
    });
  });

  describe("storage adapter helpers", () => {
    it("removes invalid JSON and opens with a clean active box", () => {
      const storage = createMemoryStorage({
        [config.persistence.storageKey]: "{broken",
        unrelated: "keep",
      });

      const state = loadPersistedBuilderState({
        storage,
        storageKey: config.persistence.storageKey,
        catalog,
        config,
        defaultBuilderState,
      });

      expect(state).toMatchObject({
        selectedPerfumes: [],
        selectedPerfumeIds: [],
        wasRestored: false,
        recovery: {
          storageAvailable: true,
          invalidStoredStateCleared: true,
        },
      });
      expect(storage.dump()).toEqual({ unrelated: "keep" });
    });

    it("discards unknown and duplicate IDs while preserving first valid occurrence order", () => {
      const storage = createMemoryStorage({
        [config.persistence.storageKey]: raw({
          selectedPerfumeIds: [99, 9, 3, 9, 21, 3],
        }),
      });

      const state = loadPersistedBuilderState({
        storage,
        storageKey: config.persistence.storageKey,
        catalog,
        config,
        defaultBuilderState,
      });

      expect(ids(state)).toEqual([9, 3, 21]);
      expect(state.selectedPerfumeIds).toEqual([9, 3, 21]);
      expect(state.wasRestored).toBe(true);
    });

    it("trims over-limit selections to the canonical maximum after validity checks", () => {
      const storage = createMemoryStorage({
        [config.persistence.storageKey]: raw({
          selectedPerfumeIds: [7, 3, 9, 12, 5, 14, 21],
        }),
      });

      const state = loadPersistedBuilderState({
        storage,
        storageKey: config.persistence.storageKey,
        catalog,
        config,
        defaultBuilderState,
      });

      expect(ids(state)).toEqual([7, 3, 9, 12]);
      expect(state.selectedPerfumes).toHaveLength(config.box.maxSelectableSlots);
    });

    it("uses canonical defaults for missing or malformed optional state", () => {
      const storage = createMemoryStorage({
        [config.persistence.storageKey]: JSON.stringify({
          version: 1,
          selectedPerfumeIds: [7],
          curatorBonusPreference: "missing",
          customerInfo: { name: [], city: "San Pedro" },
        }),
      });

      const state = loadPersistedBuilderState({
        storage,
        storageKey: config.persistence.storageKey,
        catalog,
        config,
        defaultBuilderState,
      });

      expect(state.curatorBonusPreference).toBe("complement");
      expect(state.customerInfo).toEqual({
        name: "",
        city: "San Pedro",
        notes: "",
      });
    });

    it("keeps the builder usable in memory when localStorage is unavailable", () => {
      expect(
        loadPersistedBuilderState({
          storage: null,
          storageKey: config.persistence.storageKey,
          catalog,
          config,
          defaultBuilderState,
        })
      ).toMatchObject({
        selectedPerfumes: [],
        wasRestored: false,
        recovery: { storageAvailable: false },
      });
      expect(
        loadPersistedBuilderState({
          storage: createThrowingStorage(["getItem"]),
          storageKey: config.persistence.storageKey,
          catalog,
          config,
          defaultBuilderState,
        })
      ).toMatchObject({
        selectedPerfumes: [],
        wasRestored: false,
        recovery: { storageAvailable: false },
      });
    });

    it("reports write and clear failures without throwing", () => {
      expect(
        savePersistedBuilderState({
          storage: createThrowingStorage(["setItem"]),
          storageKey: config.persistence.storageKey,
          value: {
            selectedPerfumes: [catalog[0]],
            curatorBonusPreference: "similar",
            customerInfo: defaultCustomerInfo,
          },
        })
      ).toEqual({ saved: false, reason: "write-failed" });
      expect(
        clearPersistedBuilderState({
          storage: createThrowingStorage(["removeItem"]),
          storageKey: config.persistence.storageKey,
        })
      ).toEqual({ cleared: false, reason: "clear-failed" });
    });

    it("saves and clears only the configured storage key during normal operation", () => {
      const storage = createMemoryStorage({ unrelated: "keep" });

      expect(
        savePersistedBuilderState({
          storage,
          storageKey: config.persistence.storageKey,
          value: {
            selectedPerfumes: [catalog[1], catalog[0]],
            curatorBonusPreference: "similar",
            customerInfo: { name: "Ana", city: "Monterrey", notes: "" },
          },
        })
      ).toEqual({ saved: true, reason: null });
      expect(JSON.parse(storage.dump()[config.persistence.storageKey])).toMatchObject({
        selectedPerfumeIds: [3, 7],
      });

      expect(
        clearPersistedBuilderState({
          storage,
          storageKey: config.persistence.storageKey,
        })
      ).toEqual({ cleared: true, reason: null });
      expect(storage.dump()).toEqual({ unrelated: "keep" });
    });
  });

  describe("hasMeaningfulBuilderPersistence", () => {
    it("detects meaningful selected IDs, curator preference, and trimmed customer fields", () => {
      expect(
        hasMeaningfulBuilderPersistence(
          { selectedPerfumeIds: [99], curatorBonusPreference: "complement", customerInfo: defaultCustomerInfo },
          defaultBuilderState,
          defaultCustomerInfo
        )
      ).toBe(true);
      expect(
        hasMeaningfulBuilderPersistence(
          { selectedPerfumeIds: [], curatorBonusPreference: "similar", customerInfo: defaultCustomerInfo },
          defaultBuilderState,
          defaultCustomerInfo
        )
      ).toBe(true);
      expect(
        hasMeaningfulBuilderPersistence(
          { selectedPerfumeIds: [], curatorBonusPreference: "complement", customerInfo: { name: "  Ana  ", city: " ", notes: "" } },
          defaultBuilderState,
          defaultCustomerInfo
        )
      ).toBe(true);
    });

    it("returns false for default state and non-array selected ID values", () => {
      expect(
        hasMeaningfulBuilderPersistence(
          { selectedPerfumeIds: [], curatorBonusPreference: "complement", customerInfo: defaultCustomerInfo },
          defaultBuilderState,
          defaultCustomerInfo
        )
      ).toBe(false);
      expect(
        hasMeaningfulBuilderPersistence(
          { selectedPerfumeIds: "7", curatorBonusPreference: "complement", customerInfo: null },
          defaultBuilderState,
          defaultCustomerInfo
        )
      ).toBe(false);
    });

    it("characterizes invalid top-level value behavior", () => {
      expect(() =>
        hasMeaningfulBuilderPersistence(null, defaultBuilderState, defaultCustomerInfo)
      ).toThrow();
      expect(() =>
        hasMeaningfulBuilderPersistence(undefined, defaultBuilderState, defaultCustomerInfo)
      ).toThrow();
    });
  });

  it("round-trips normal, empty, duplicate, and string-ID selections through serialized payloads", () => {
    const normalSerialized = serializeBuilderPersistence({
      selectedPerfumes: [catalog[4], catalog[1], catalog[0]],
      curatorBonusPreference: "similar",
      customerInfo: { name: "Ana", city: "Monterrey", notes: "Fresh" },
    });
    const emptySerialized = serializeBuilderPersistence({
      selectedPerfumes: [],
      curatorBonusPreference: "complement",
      customerInfo: defaultCustomerInfo,
    });
    const duplicateSerialized = serializeBuilderPersistence({
      selectedPerfumes: [catalog[0], catalog[0], catalog[3]],
      curatorBonusPreference: "similar",
      customerInfo: defaultCustomerInfo,
    });

    expect(ids(hydrate({ rawValue: normalSerialized }))).toEqual([12, 3, 7]);
    expect(hydrate({ rawValue: emptySerialized })).toMatchObject({
      selectedPerfumeIds: [],
      selectedPerfumes: [],
      wasRestored: false,
    });
    expect(ids(hydrate({ rawValue: duplicateSerialized }))).toEqual([7]);
  });

  it("preserves order through catalog evolution while dropping unavailable IDs", () => {
    const persisted = serializeBuilderPersistence({
      selectedPerfumes: [catalog[6], catalog[1], catalog[4], catalog[0]],
      curatorBonusPreference: "similar",
      customerInfo: { name: "Ana", city: "Monterrey", notes: "" },
    });
    const evolvedCatalog = [
      { id: 44, name: "New Arrival" },
      catalog[4],
      catalog[0],
      catalog[6],
    ];

    const state = hydrate({
      rawValue: persisted,
      catalog: evolvedCatalog,
    });

    expect(state.selectedPerfumeIds).toEqual([14, 12, 7]);
    expect(ids(state)).toEqual([14, 12, 7]);
    expect(state.selectedPerfumes).toEqual([catalog[6], catalog[4], catalog[0]]);
  });

  it("does not mutate frozen catalog, default state, config, or selected inputs", () => {
    const frozenCatalog = deepFreeze(catalog.map((perfume) => ({ ...perfume })));
    const frozenConfig = deepFreeze({
      ...config,
      box: { ...config.box },
      curatorBonus: {
        ...config.curatorBonus,
        preferences: { ...config.curatorBonus.preferences },
      },
      persistence: { ...config.persistence },
    });
    const frozenDefaultState = deepFreeze({
      selectedPerfumeIds: [],
      curatorBonusPreference: "complement",
      customerInfo: { ...defaultCustomerInfo },
    });
    const frozenSelected = deepFreeze([catalog[2], catalog[0]]);

    const serialized = serializeBuilderPersistence({
      selectedPerfumes: frozenSelected,
      curatorBonusPreference: "similar",
      customerInfo: frozenDefaultState.customerInfo,
    });
    const hydrated = hydrateBuilderPersistence({
      rawValue: serialized,
      catalog: frozenCatalog,
      config: frozenConfig,
      defaultBuilderState: frozenDefaultState,
    });

    expect(ids(hydrated)).toEqual([9, 7]);
    expect(Object.isFrozen(frozenCatalog[0])).toBe(true);
    expect(Object.isFrozen(frozenConfig.persistence)).toBe(true);
    expect(Object.isFrozen(frozenDefaultState.customerInfo)).toBe(true);
    expect(Object.isFrozen(frozenSelected)).toBe(true);
  });

  it("is deterministic for repeated parse, serialize, and hydrate scenarios", () => {
    const input = {
      selectedPerfumes: [catalog[2], catalog[4], catalog[0]],
      curatorBonusPreference: "similar",
      customerInfo: { name: "Ana", city: "Monterrey", notes: "Fresh" },
    };
    const firstSerialized = serializeBuilderPersistence(input);
    const secondSerialized = serializeBuilderPersistence(input);
    const firstHydrated = hydrate({ rawValue: firstSerialized });
    const secondHydrated = hydrate({ rawValue: secondSerialized });

    expect(secondSerialized).toBe(firstSerialized);
    expect(parseBuilderPersistence(secondSerialized)).toEqual(parseBuilderPersistence(firstSerialized));
    expect(secondHydrated).toEqual(firstHydrated);
  });

  it("covers a golden persistence workflow with changed catalog compatibility", () => {
    const selectedPerfumes = [catalog[7], catalog[4], catalog[1], catalog[0]];
    const storedString = serializeBuilderPersistence({
      selectedPerfumes,
      curatorBonusPreference: "similar",
      customerInfo: {
        name: "Carla",
        city: "San Pedro",
        notes: "Avoid heavy smoke",
      },
    });
    const nextSessionCatalog = [
      { id: 100, name: "Replacement" },
      catalog[0],
      catalog[7],
      catalog[4],
    ];

    const restored = hydrate({
      rawValue: storedString,
      catalog: nextSessionCatalog,
    });

    expect(storedString).toBe(
      '{"version":1,"selectedPerfumeIds":[21,12,3,7],"curatorBonusPreference":"similar","customerInfo":{"name":"Carla","city":"San Pedro","notes":"Avoid heavy smoke"}}'
    );
    expect(restored).toEqual({
      selectedPerfumeIds: [21, 12, 7],
      curatorBonusPreference: "similar",
      customerInfo: {
        name: "Carla",
        city: "San Pedro",
        notes: "Avoid heavy smoke",
      },
      selectedPerfumes: [catalog[7], catalog[4], catalog[0]],
      wasRestored: true,
    });
  });
});
