import { describe, expect, it } from "vitest";

import { fragrances as perfumes, notes } from "@discovery-box/catalog";
import { buildScentLibraryViewModel } from "./buildScentLibraryViewModel.js";

const noteRegistry = Object.freeze({
  amber: Object.freeze({ name: "Amber", noteImage: "/images/notes/amber.jpg" }),
  cedar: Object.freeze({ name: "Cedar", noteImage: "/images/notes/cedar.jpg" }),
  cedarwood: Object.freeze({ name: "Cedarwood", noteImage: "/images/notes/cedar.jpg" }),
  iris: Object.freeze({ name: "Iris", noteImage: "" }),
  lavender: Object.freeze({ name: "Lavender", noteImage: "/images/notes/lavender.jpg" }),
  vanilla: Object.freeze({ name: "Vanilla", noteImage: "/images/notes/vanilla.jpg" }),
});

const structuredPerfume = Object.freeze({
  id: 10,
  name: "Structured Cedar",
  shortName: "Structured",
  brand: "Test House",
  image: "/images/perfumes/test/structured.png",
  topNotes: Object.freeze(["lavender", "cedar"]),
  middleNotes: Object.freeze(["iris", "cedar"]),
  baseNotes: Object.freeze(["amber", "cedar"]),
});

const generalPerfume = Object.freeze({
  id: 2,
  name: "General Cedar",
  shortName: "General",
  brand: "Test House",
  image: "/images/perfumes/test/general.png",
  generalNotes: Object.freeze(["cedar", "vanilla", "missingNote"]),
});

const distinctPerfume = Object.freeze({
  id: 3,
  name: "Cedarwood Study",
  shortName: "Cedarwood",
  brand: "Second House",
  image: "",
  baseNotes: Object.freeze(["cedarwood"]),
});

describe("buildScentLibraryViewModel", () => {
  it("counts unique perfumes for one canonical note across structured and general notes", () => {
    const result = buildScentLibraryViewModel({
      selectedPerfumes: [structuredPerfume, generalPerfume],
      notes: noteRegistry,
    });
    const cedar = result.find((entry) => entry.noteId === "cedar");

    expect(cedar).toMatchObject({
      noteId: "cedar",
      name: "Cedar",
      image: "/images/notes/cedar.jpg",
      perfumeCount: 2,
    });
    expect(cedar.perfumes.map((perfume) => perfume.perfumeId)).toEqual([2, 10]);
  });

  it("does not count the same perfume twice when a note repeats in the pyramid", () => {
    const result = buildScentLibraryViewModel({
      selectedPerfumes: [structuredPerfume],
      notes: noteRegistry,
    });
    const cedar = result.find((entry) => entry.noteId === "cedar");

    expect(cedar.perfumeCount).toBe(1);
    expect(cedar.perfumes).toHaveLength(1);
  });

  it("resolves top, middle, base, and general notes while ignoring invalid references", () => {
    const result = buildScentLibraryViewModel({
      selectedPerfumes: [structuredPerfume, generalPerfume],
      notes: noteRegistry,
    });

    expect(result.map((entry) => entry.noteId)).toEqual([
      "amber",
      "cedar",
      "iris",
      "lavender",
      "vanilla",
    ]);
    expect(result.some((entry) => entry.noteId === "missingNote")).toBe(false);
  });

  it("uses safe empty image metadata when a note has no note image", () => {
    const result = buildScentLibraryViewModel({
      selectedPerfumes: [structuredPerfume],
      notes: noteRegistry,
    });
    const iris = result.find((entry) => entry.noteId === "iris");

    expect(iris.image).toBe("");
  });

  it("keeps matching perfume fields compact and deterministic", () => {
    const result = buildScentLibraryViewModel({
      selectedPerfumes: [structuredPerfume, generalPerfume],
      notes: noteRegistry,
    });
    const cedar = result.find((entry) => entry.noteId === "cedar");

    expect(cedar.perfumes).toEqual([
      {
        perfumeId: 2,
        name: "General Cedar",
        shortName: "General",
        brand: "Test House",
        image: "/images/perfumes/test/general.png",
      },
      {
        perfumeId: 10,
        name: "Structured Cedar",
        shortName: "Structured",
        brand: "Test House",
        image: "/images/perfumes/test/structured.png",
      },
    ]);
  });

  it("does not merge distinct canonical notes with similar names", () => {
    const result = buildScentLibraryViewModel({
      selectedPerfumes: [structuredPerfume, distinctPerfume],
      notes: noteRegistry,
    });

    expect(result.some((entry) => entry.noteId === "cedar")).toBe(true);
    expect(result.some((entry) => entry.noteId === "cedarwood")).toBe(true);
  });

  it("does not mutate selected perfumes or note registry", () => {
    const selectedPerfumes = [structuredPerfume, generalPerfume];
    const beforePerfumes = JSON.stringify(selectedPerfumes);
    const beforeNotes = JSON.stringify(noteRegistry);

    buildScentLibraryViewModel({ selectedPerfumes, notes: noteRegistry });

    expect(JSON.stringify(selectedPerfumes)).toBe(beforePerfumes);
    expect(JSON.stringify(noteRegistry)).toBe(beforeNotes);
  });

  it("handles non-array selected perfume input defensively", () => {
    expect(buildScentLibraryViewModel({ selectedPerfumes: null, notes: noteRegistry })).toEqual([]);
  });

  it("derives real-catalog selected-box note relationships", () => {
    const selectedPerfumes = perfumes.slice(0, 14);
    const result = buildScentLibraryViewModel({ selectedPerfumes, notes });
    const cedar = result.find((entry) => entry.noteId === "cedar");

    expect(result.length).toBeGreaterThan(40);
    expect(cedar.perfumeCount).toBe(
      selectedPerfumes.filter((perfume) =>
        [
          ...(perfume.topNotes || []),
          ...(perfume.middleNotes || []),
          ...(perfume.baseNotes || []),
          ...(perfume.generalNotes || []),
        ].includes("cedar")
      ).length
    );
    expect(cedar.perfumes.every((perfume) => perfume.name && perfume.brand)).toBe(true);
  });
});
