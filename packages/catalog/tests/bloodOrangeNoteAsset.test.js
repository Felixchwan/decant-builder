import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { fragrances as perfumes, notes } from "@discovery-box/catalog";

// bloodOrange used to borrow the generic orange photo, whose flesh is plain
// orange. It now has its own dedicated asset (the same studio photograph with
// the cut flesh recoloured to blood-orange ruby). This is an asset change
// only: the note's identity, label, family and every fragrance that carries it
// are unchanged, and the shared orange.jpg is not modified.

const NOTES_ASSETS = join(import.meta.dirname, "..", "assets", "notes");
const read = (file) => readFileSync(join(NOTES_ASSETS, file));

describe("bloodOrange note asset", () => {
  it("keeps its canonical identity and points at its own dedicated asset", () => {
    expect(notes.bloodOrange).toEqual({
      name: "Blood Orange",
      family: "citrus",
      noteImageAssetKey: "notes/bloodOrange.jpg",
    });
  });

  it("is a real JPEG on disk, the same size class as its neighbours, and not the generic orange photo", () => {
    expect(existsSync(join(NOTES_ASSETS, "bloodOrange.jpg"))).toBe(true);
    const bytes = read("bloodOrange.jpg");

    expect(bytes.subarray(0, 3).toString("hex")).toBe("ffd8ff");
    expect(bytes.length).toBeGreaterThan(5 * 1024);
    expect(bytes.length).toBeLessThan(120 * 1024);
    expect(bytes.equals(read("orange.jpg"))).toBe(false);
  });

  it("is used by no other note, while orange and its other sharers keep the generic photo", () => {
    const users = Object.entries(notes)
      .filter(([, note]) => note.noteImageAssetKey === "notes/bloodOrange.jpg")
      .map(([key]) => key);

    expect(users).toEqual(["bloodOrange"]);
    for (const key of ["orange", "bitterOrange", "citrus", "citruses"]) {
      expect(notes[key].noteImageAssetKey, key).toBe("notes/orange.jpg");
    }
    expect(notes.mandarinOrange.noteImageAssetKey).toBe("notes/mandarinOrange.jpg");
    expect(notes.grapefruit.noteImageAssetKey).toBe("notes/grapefruit.jpg");
  });

  it("leaves every fragrance that carries bloodOrange referencing the same canonical key", () => {
    const carriers = perfumes
      .filter((perfume) => [...(perfume.topNotes ?? []), ...(perfume.middleNotes ?? []), ...(perfume.baseNotes ?? []), ...(perfume.generalNotes ?? [])].includes("bloodOrange"))
      .map((perfume) => perfume.id);

    expect(carriers).toEqual([24, 103, 109]);
  });
});
