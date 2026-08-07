import { describe, expect, it } from "vitest";
import {
  addSelectedPerfume,
  applyInitialFragranceIntent,
  canAddPerfume,
  getSelectedPerfumeIds,
  hydrateSelectedPerfumes,
  removeSelectedPerfumeAtIndex,
  resolveInitialFragranceIntent,
  reorderSelectedPerfumes,
} from "./selectionState.js";

const perfume = (id, overrides = {}) => ({
  id,
  name: `Perfume ${id}`,
  points: 1,
  ...overrides,
});

const ids = (selectedPerfumes) => selectedPerfumes.map((item) => item.id);

function freezeSelection(selectedPerfumes) {
  selectedPerfumes.forEach((item) => Object.freeze(item));
  return Object.freeze(selectedPerfumes);
}

describe("selectionState", () => {
  describe("hydrateSelectedPerfumes", () => {
    it("returns a canonical empty selection for empty inputs", () => {
      expect(
        hydrateSelectedPerfumes({
          selectedPerfumeIds: [],
          catalog: [],
          maxSelectableSlots: 14,
        })
      ).toEqual([]);
      expect(hydrateSelectedPerfumes({ selectedPerfumeIds: null, catalog: [], maxSelectableSlots: 14 })).toEqual([]);
      expect(hydrateSelectedPerfumes({ selectedPerfumeIds: [], catalog: null, maxSelectableSlots: 14 })).toEqual([]);
    });

    it("hydrates numeric ids in persisted order and removes duplicates after capacity is applied", () => {
      const catalog = [perfume(1), perfume(2), perfume(3)];

      expect(
        ids(
          hydrateSelectedPerfumes({
            selectedPerfumeIds: [2, 1, 2, 3],
            catalog,
            maxSelectableSlots: 3,
          })
        )
      ).toEqual([2, 1]);
    });

    it("ignores string ids, unknown ids, and values without catalog matches", () => {
      const catalog = [perfume(1), perfume("2"), perfume(3), { name: "Missing id" }];

      expect(
        ids(
          hydrateSelectedPerfumes({
            selectedPerfumeIds: ["2", 3, 99, null, undefined],
            catalog,
            maxSelectableSlots: 14,
          })
        )
      ).toEqual([3]);
    });

    it("characterizes boundary maxSelectableSlots values", () => {
      const catalog = [perfume(1), perfume(2), perfume(3)];

      expect(
        hydrateSelectedPerfumes({
          selectedPerfumeIds: [1, 2],
          catalog,
          maxSelectableSlots: 0,
        })
      ).toEqual([]);
      expect(
        ids(
          hydrateSelectedPerfumes({
            selectedPerfumeIds: [1, 2],
            catalog,
            maxSelectableSlots: 1,
          })
        )
      ).toEqual([1]);
      expect(
        ids(
          hydrateSelectedPerfumes({
            selectedPerfumeIds: [1, 2, 3],
            catalog,
            maxSelectableSlots: -1,
          })
        )
      ).toEqual([1, 2]);
      expect(
        ids(
          hydrateSelectedPerfumes({
            selectedPerfumeIds: [1, 2],
            catalog,
            maxSelectableSlots: undefined,
          })
        )
      ).toEqual([1, 2]);
    });

    it("does not mutate catalog or id inputs", () => {
      const catalog = freezeSelection([perfume(1), perfume(2)]);
      const selectedPerfumeIds = Object.freeze([2, 1]);

      hydrateSelectedPerfumes({ selectedPerfumeIds, catalog, maxSelectableSlots: 2 });

      expect(selectedPerfumeIds).toEqual([2, 1]);
      expect(ids(catalog)).toEqual([1, 2]);
    });
  });

  describe("getSelectedPerfumeIds", () => {
    it("returns ids in selected order and treats non-arrays as empty", () => {
      expect(getSelectedPerfumeIds([perfume(3), perfume(1)])).toEqual([3, 1]);
      expect(getSelectedPerfumeIds(null)).toEqual([]);
      expect(getSelectedPerfumeIds("not-array")).toEqual([]);
    });

    it("characterizes objects with missing ids", () => {
      expect(getSelectedPerfumeIds([perfume(1), { name: "No id" }])).toEqual([1, undefined]);
    });
  });

  describe("canAddPerfume", () => {
    it("allows a valid item below capacity", () => {
      expect(
        canAddPerfume({
          selectedPerfumes: [perfume(1)],
          perfume: perfume(2),
          maxSelectableSlots: 2,
        })
      ).toEqual({ allowed: true, reason: null });
    });

    it("rejects capacity, invalid perfume, and duplicate cases with exact reason codes", () => {
      const first = perfume(1);

      expect(
        canAddPerfume({
          selectedPerfumes: [first],
          perfume: perfume(2),
          maxSelectableSlots: 1,
        })
      ).toEqual({ allowed: false, reason: "capacity" });
      expect(
        canAddPerfume({
          selectedPerfumes: [],
          perfume: null,
          maxSelectableSlots: 1,
        })
      ).toEqual({ allowed: false, reason: "invalid-perfume" });
      expect(
        canAddPerfume({
          selectedPerfumes: [first],
          perfume: perfume(1),
          maxSelectableSlots: 2,
        })
      ).toEqual({ allowed: false, reason: "duplicate" });
    });

    it("characterizes id equality and missing ids", () => {
      expect(
        canAddPerfume({
          selectedPerfumes: [perfume(1)],
          perfume: perfume("1"),
          maxSelectableSlots: 2,
        })
      ).toEqual({ allowed: true, reason: null });
      expect(
        canAddPerfume({
          selectedPerfumes: [{ name: "No id" }],
          perfume: { name: "Also no id" },
          maxSelectableSlots: 2,
        })
      ).toEqual({ allowed: false, reason: "duplicate" });
    });

    it("characterizes undefined and negative capacity values", () => {
      expect(
        canAddPerfume({
          selectedPerfumes: [],
          perfume: perfume(1),
          maxSelectableSlots: undefined,
        })
      ).toEqual({ allowed: true, reason: null });
      expect(
        canAddPerfume({
          selectedPerfumes: [],
          perfume: perfume(1),
          maxSelectableSlots: -1,
        })
      ).toEqual({ allowed: false, reason: "capacity" });
    });
  });

  describe("addSelectedPerfume", () => {
    it("adds to empty and appends to existing selections without mutating inputs", () => {
      const first = perfume(1);
      const second = perfume(2);
      const selectedPerfumes = freezeSelection([first]);
      Object.freeze(second);

      const appended = addSelectedPerfume({
        selectedPerfumes,
        perfume: second,
        maxSelectableSlots: 2,
      });

      expect(ids(addSelectedPerfume({ selectedPerfumes: [], perfume: first, maxSelectableSlots: 2 }))).toEqual([1]);
      expect(ids(appended)).toEqual([1, 2]);
      expect(appended).not.toBe(selectedPerfumes);
      expect(ids(selectedPerfumes)).toEqual([1]);
      expect(second).toEqual(perfume(2));
    });

    it("returns the original selection reference when duplicate, invalid, or full", () => {
      const first = perfume(1);
      const selectedPerfumes = freezeSelection([first]);

      expect(
        addSelectedPerfume({
          selectedPerfumes,
          perfume: perfume(1),
          maxSelectableSlots: 2,
        })
      ).toBe(selectedPerfumes);
      expect(
        addSelectedPerfume({
          selectedPerfumes,
          perfume: null,
          maxSelectableSlots: 2,
        })
      ).toBe(selectedPerfumes);
      expect(
        addSelectedPerfume({
          selectedPerfumes,
          perfume: perfume(2),
          maxSelectableSlots: 1,
        })
      ).toBe(selectedPerfumes);
    });

    it("characterizes non-array selection fallback", () => {
      const added = addSelectedPerfume({
        selectedPerfumes: null,
        perfume: perfume(1),
        maxSelectableSlots: 1,
      });

      expect(ids(added)).toEqual([1]);
    });
  });

  describe("resolveInitialFragranceIntent", () => {
    it("resolves a canonical catalog record that can augment an empty or persisted selection", () => {
      const catalog = freezeSelection([perfume(1), perfume(2), perfume(3)]);
      const persisted = freezeSelection([catalog[0]]);
      const emptyIntent = resolveInitialFragranceIntent({ initialFragranceId: 2, catalog, selectedPerfumes: [], maxSelectableSlots: 3 });
      const persistedIntent = resolveInitialFragranceIntent({ initialFragranceId: 2, catalog, selectedPerfumes: persisted, maxSelectableSlots: 3 });

      expect(emptyIntent).toEqual({ status: "ready", perfume: catalog[1] });
      expect(persistedIntent).toEqual({ status: "ready", perfume: catalog[1] });
      expect(ids(addSelectedPerfume({ selectedPerfumes: [], perfume: emptyIntent.perfume, maxSelectableSlots: 3 }))).toEqual([2]);
      expect(ids(addSelectedPerfume({ selectedPerfumes: persisted, perfume: persistedIntent.perfume, maxSelectableSlots: 3 }))).toEqual([1, 2]);
      expect(ids(catalog)).toEqual([1, 2, 3]);
    });

    it("reports duplicate, capacity, and unavailable intents without changing selection", () => {
      const catalog = [perfume(1), perfume(2)];
      const selected = freezeSelection([catalog[0]]);

      expect(resolveInitialFragranceIntent({ initialFragranceId: 1, catalog, selectedPerfumes: selected, maxSelectableSlots: 2 }).status).toBe("duplicate");
      expect(resolveInitialFragranceIntent({ initialFragranceId: 2, catalog, selectedPerfumes: selected, maxSelectableSlots: 1 }).status).toBe("capacity");
      expect(resolveInitialFragranceIntent({ initialFragranceId: 99, catalog, selectedPerfumes: selected, maxSelectableSlots: 2 })).toEqual({ status: "unavailable", perfume: null });
      expect(resolveInitialFragranceIntent({ initialFragranceId: "1", catalog, selectedPerfumes: selected, maxSelectableSlots: 2 })).toEqual({ status: "unavailable", perfume: null });
      expect(ids(selected)).toEqual([1]);
    });
  });

  describe("applyInitialFragranceIntent", () => {
    it("augments restored selection once without replacing, mutating, or persisting the intent itself", () => {
      const catalog = freezeSelection([perfume(1), perfume(2), perfume(3)]);
      const restored = freezeSelection([catalog[0]]);
      const result = applyInitialFragranceIntent({ initialFragranceId: 2, catalog, selectedPerfumes: restored, maxSelectableSlots: 3 });

      expect(result.intent).toEqual({ status: "ready", perfume: catalog[1] });
      expect(ids(result.selectedPerfumes)).toEqual([1, 2]);
      expect(Object.keys(result)).toEqual(["intent", "selectedPerfumes"]);
      expect(ids(restored)).toEqual([1]);
      expect(ids(catalog)).toEqual([1, 2, 3]);
    });

    it("preserves the exact selection reference for duplicate, capacity, unknown, and absent intents", () => {
      const catalog = [perfume(1), perfume(2)];
      const selected = freezeSelection([catalog[0]]);
      for (const [initialFragranceId, maxSelectableSlots] of [[1, 2], [2, 1], [99, 2], [null, 2]]) {
        expect(applyInitialFragranceIntent({ initialFragranceId, catalog, selectedPerfumes: selected, maxSelectableSlots }).selectedPerfumes).toBe(selected);
      }
    });

    it("defers warning-protected fragrances to the ordinary confirmation path", () => {
      const warned = perfume(2, { warningMessage: "Confirm this selection" });
      const selected = freezeSelection([perfume(1)]);
      const result = applyInitialFragranceIntent({ initialFragranceId: 2, catalog: [selected[0], warned], selectedPerfumes: selected, maxSelectableSlots: 3 });

      expect(result.intent).toEqual({ status: "ready", perfume: warned });
      expect(result.selectedPerfumes).toBe(selected);
    });

    describe("restored-selection and deep-link coexistence", () => {
      const catalog = freezeSelection([perfume(1), perfume(2), perfume(3)]);

      it("adds the deep-linked fragrance to an already-restored selection", () => {
        const restored = freezeSelection([catalog[0]]);
        const result = applyInitialFragranceIntent({
          initialFragranceId: 2,
          catalog,
          selectedPerfumes: restored,
          maxSelectableSlots: 3,
        });

        expect(result.intent.status).toBe("ready");
        expect(ids(result.selectedPerfumes)).toEqual([1, 2]);
      });

      it("acknowledges a deep-linked fragrance already present in the restored selection without duplicating it", () => {
        const restored = freezeSelection([catalog[0], catalog[1]]);
        const result = applyInitialFragranceIntent({
          initialFragranceId: 1,
          catalog,
          selectedPerfumes: restored,
          maxSelectableSlots: 3,
        });

        expect(result.intent.status).toBe("duplicate");
        expect(result.selectedPerfumes).toBe(restored);
        expect(ids(result.selectedPerfumes)).toEqual([1, 2]);
      });

      it("surfaces a capacity conflict instead of exceeding the restored selection's limit", () => {
        const restored = freezeSelection([catalog[0], catalog[1]]);
        const result = applyInitialFragranceIntent({
          initialFragranceId: 3,
          catalog,
          selectedPerfumes: restored,
          maxSelectableSlots: 2,
        });

        expect(result.intent.status).toBe("capacity");
        expect(result.selectedPerfumes).toBe(restored);
        expect(ids(result.selectedPerfumes)).toEqual([1, 2]);
      });
    });
  });

  describe("removeSelectedPerfumeAtIndex", () => {
    it("removes first, middle, and last items while preserving remaining order", () => {
      const selectedPerfumes = [perfume(1), perfume(2), perfume(3), perfume(4)];

      expect(ids(removeSelectedPerfumeAtIndex({ selectedPerfumes, index: 0 }))).toEqual([2, 3, 4]);
      expect(ids(removeSelectedPerfumeAtIndex({ selectedPerfumes, index: 2 }))).toEqual([1, 2, 4]);
      expect(ids(removeSelectedPerfumeAtIndex({ selectedPerfumes, index: 3 }))).toEqual([1, 2, 3]);
      expect(ids(selectedPerfumes)).toEqual([1, 2, 3, 4]);
    });

    it("returns the original reference for unknown/invalid indexes and empty selections", () => {
      const selectedPerfumes = freezeSelection([perfume(1), perfume(2)]);
      const emptySelection = Object.freeze([]);

      expect(removeSelectedPerfumeAtIndex({ selectedPerfumes, index: 99 })).toBe(selectedPerfumes);
      expect(removeSelectedPerfumeAtIndex({ selectedPerfumes, index: -1 })).toBe(selectedPerfumes);
      expect(removeSelectedPerfumeAtIndex({ selectedPerfumes, index: 1.5 })).toBe(selectedPerfumes);
      expect(removeSelectedPerfumeAtIndex({ selectedPerfumes: emptySelection, index: 0 })).toBe(emptySelection);
      expect(removeSelectedPerfumeAtIndex({ selectedPerfumes: null, index: 0 })).toBe(null);
    });
  });

  describe("reorderSelectedPerfumes", () => {
    it("moves first to last, last to first, middle forward, and middle backward", () => {
      const selectedPerfumes = [perfume(1), perfume(2), perfume(3), perfume(4)];

      expect(ids(reorderSelectedPerfumes({ selectedPerfumes, fromIndex: 0, toIndex: 3 }))).toEqual([2, 3, 4, 1]);
      expect(ids(reorderSelectedPerfumes({ selectedPerfumes, fromIndex: 3, toIndex: 0 }))).toEqual([4, 1, 2, 3]);
      expect(ids(reorderSelectedPerfumes({ selectedPerfumes, fromIndex: 1, toIndex: 3 }))).toEqual([1, 3, 4, 2]);
      expect(ids(reorderSelectedPerfumes({ selectedPerfumes, fromIndex: 2, toIndex: 1 }))).toEqual([1, 3, 2, 4]);
      expect(ids(selectedPerfumes)).toEqual([1, 2, 3, 4]);
    });

    it("returns the original reference for no-op, invalid, empty, and single-item reorders", () => {
      const selectedPerfumes = freezeSelection([perfume(1), perfume(2), perfume(3)]);
      const emptySelection = Object.freeze([]);
      const singleSelection = freezeSelection([perfume(1)]);

      expect(reorderSelectedPerfumes({ selectedPerfumes, fromIndex: 1, toIndex: 1 })).toBe(selectedPerfumes);
      expect(reorderSelectedPerfumes({ selectedPerfumes, fromIndex: -1, toIndex: 1 })).toBe(selectedPerfumes);
      expect(reorderSelectedPerfumes({ selectedPerfumes, fromIndex: 0, toIndex: 3 })).toBe(selectedPerfumes);
      expect(reorderSelectedPerfumes({ selectedPerfumes: emptySelection, fromIndex: 0, toIndex: 1 })).toBe(emptySelection);
      expect(reorderSelectedPerfumes({ selectedPerfumes: singleSelection, fromIndex: 0, toIndex: 0 })).toBe(singleSelection);
      expect(reorderSelectedPerfumes({ selectedPerfumes: null, fromIndex: 0, toIndex: 1 })).toBe(null);
    });
  });

  it("supports a golden selection workflow with exact order and rejection behavior", () => {
    const catalog = [perfume(1), perfume(2), perfume(3), perfume(4), perfume(5)];
    let selected = [];

    selected = addSelectedPerfume({ selectedPerfumes: selected, perfume: catalog[0], maxSelectableSlots: 4 });
    selected = addSelectedPerfume({ selectedPerfumes: selected, perfume: catalog[1], maxSelectableSlots: 4 });
    selected = addSelectedPerfume({ selectedPerfumes: selected, perfume: catalog[2], maxSelectableSlots: 4 });
    const beforeDuplicateAttempt = selected;
    const duplicateAttempt = addSelectedPerfume({ selectedPerfumes: selected, perfume: catalog[1], maxSelectableSlots: 4 });
    selected = reorderSelectedPerfumes({ selectedPerfumes: duplicateAttempt, fromIndex: 0, toIndex: 2 });
    selected = removeSelectedPerfumeAtIndex({ selectedPerfumes: selected, index: 1 });
    selected = addSelectedPerfume({ selectedPerfumes: selected, perfume: catalog[3], maxSelectableSlots: 4 });
    selected = addSelectedPerfume({ selectedPerfumes: selected, perfume: catalog[4], maxSelectableSlots: 4 });
    const fullSelection = selected;
    const overflowAttempt = addSelectedPerfume({
      selectedPerfumes: selected,
      perfume: perfume(6),
      maxSelectableSlots: 4,
    });

    expect(duplicateAttempt).toBe(beforeDuplicateAttempt);
    expect(overflowAttempt).toBe(fullSelection);
    expect(ids(overflowAttempt)).toEqual([2, 1, 4, 5]);
    expect(getSelectedPerfumeIds(overflowAttempt)).toEqual([2, 1, 4, 5]);
  });
});
