import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { fragrances as perfumes, notes } from "@discovery-box/catalog";
import { NOTE_PROMINENCE_BY_ID } from "../src/fragrances.js";

// K by Dolce & Gabbana EDP Intense (id 109): note-pyramid correction.
//
// Source of truth:
//   top    -- Blood Orange, Sicilian Lemon
//   middle -- Fig, Saffron
//   base   -- Leather, Woody Notes
//
// Each is its own canonical identity (bloodOrange is not orange, sicilianLemon
// is not lemon, woodyNotes is not cedar/sandalwood/a concrete wood). The one
// identity that did not exist, sicilianLemon, follows the dictionary's
// established geographic-origin-qualified-variant pattern (sicilianMandarin,
// calabrianBergamot): its own key, reusing the parent's photo.

const ASSETS_ROOT = join(import.meta.dirname, "..", "assets");
const perfume = perfumes.find((entry) => entry.id === 109);

describe("K EDP Intense note pyramid", () => {
  it("is exactly Blood Orange / Sicilian Lemon, Fig / Saffron, Leather / Woody Notes", () => {
    expect(perfume.name).toBe("K EDP Intense");
    expect(perfume.brand).toBe("Dolce & Gabbana");
    expect(perfume.topNotes).toEqual(["bloodOrange", "sicilianLemon"]);
    expect(perfume.middleNotes).toEqual(["fig", "saffron"]);
    expect(perfume.baseNotes).toEqual(["leather", "woodyNotes"]);
    expect(perfume.generalNotes).toEqual([]);
  });

  it("resolves every note to its own canonical identity, none collapsed into a look-alike", () => {
    expect(notes.bloodOrange.name).toBe("Blood Orange");
    expect(notes.sicilianLemon.name).toBe("Sicilian Lemon");
    expect(notes.fig.name).toBe("Fig");
    expect(notes.saffron.name).toBe("Saffron");
    expect(notes.leather.name).toBe("Leather");
    expect(notes.woodyNotes.name).toBe("Woody Notes");
    // the plain notes they resemble stay separate identities
    expect(notes.sicilianLemon).not.toBe(notes.lemon);
    expect(notes.bloodOrange).not.toBe(notes.orange);
    expect(notes.lemon.name).toBe("Lemon");
    expect(notes.orange.name).toBe("Orange");
  });

  it("adds Sicilian Lemon as a citrus variant that reuses the Lemon photo, and every one of the six notes has an asset on disk", () => {
    expect(notes.sicilianLemon.family).toBe("citrus");
    expect(notes.sicilianLemon.noteImageAssetKey).toBe(notes.lemon.noteImageAssetKey);

    for (const key of [...perfume.topNotes, ...perfume.middleNotes, ...perfume.baseNotes]) {
      expect(notes[key], `${key} is a defined canonical note`).toBeDefined();
      expect(existsSync(join(ASSETS_ROOT, notes[key].noteImageAssetKey)), `${key} asset exists`).toBe(true);
    }
  });

  it("is the only fragrance that carries Sicilian Lemon, and no other fragrance's pyramid was touched for it", () => {
    const carriers = perfumes.filter((entry) => [...(entry.topNotes ?? []), ...(entry.middleNotes ?? []), ...(entry.baseNotes ?? []), ...(entry.generalNotes ?? [])].includes("sicilianLemon"));

    expect(carriers.map((entry) => entry.id)).toEqual([109]);
  });

  it("keeps every unrelated field of the entry as it was", () => {
    expect(perfume.id).toBe(109);
    expect(perfume.shortName).toBe("K Intense");
    expect(perfume.points).toBe(1.5);
    expect(perfume.imageAssetKey).toBe("perfumes/silver/k-edp-intense.png");
    expect(perfume.accords).toEqual(["woody", "leather", "aromatic", "spicy", "amber"]);
    expect(perfume.seasons).toEqual(["spring", "fall", "winter"]);
    expect(perfume.occasions).toEqual(["daily", "office", "date", "night"]);
    expect(perfume.vibes).toEqual(["masculine", "confident", "modern", "warm"]);
  });

  it("scores only notes it still carries: leather 6 and fig 4 stay, the retired patchouli score is gone", () => {
    expect(NOTE_PROMINENCE_BY_ID[109]).toEqual({ leather: 6, fig: 4 });

    const carried = new Set([...perfume.topNotes, ...perfume.middleNotes, ...perfume.baseNotes, ...perfume.generalNotes]);
    for (const key of Object.keys(NOTE_PROMINENCE_BY_ID[109])) {
      expect(carried.has(key), `${key} is scored but not a note of this fragrance`).toBe(true);
    }
  });
});
