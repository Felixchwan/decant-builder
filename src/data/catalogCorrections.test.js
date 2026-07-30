import { existsSync, readFileSync } from "node:fs";
import { Buffer } from "node:buffer";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { buildCatalogView } from "../builder/internal/catalog/buildCatalogView.js";
import { buildScentLibraryViewModel } from "../builder/internal/intelligence/buildScentLibraryViewModel.js";
import { fragrances as perfumes, notes } from "@discovery-box/catalog";

const ARMANI_CODE_EDT_ID = 104;
const SILVER_MOUNTAIN_WATER_ID = 401;

function sourceAssetPath(assetKey) {
  return fileURLToPath(new URL(`../../packages/catalog/assets/${assetKey}`, import.meta.url));
}

function perfumeById(id) {
  return perfumes.find((perfume) => perfume.id === id);
}

function idsForSearch(searchQuery) {
  return buildCatalogView({
    catalog: perfumes,
    notes,
    searchQuery,
  }).visiblePerfumes.map((perfume) => perfume.id);
}

describe("catalog data corrections", () => {
  it("keeps Armani Code EDT identity while using the corrected note pyramid", () => {
    const codeEdt = perfumeById(ARMANI_CODE_EDT_ID);

    expect(codeEdt).toMatchObject({
      id: ARMANI_CODE_EDT_ID,
      name: "Armani Code EDT",
      shortName: "Code EDT",
      brand: "Giorgio Armani",
      points: 1.5,
    });
    expect(codeEdt.topNotes).toEqual(["greenMandarin"]);
    expect(codeEdt.middleNotes).toEqual(["lavender"]);
    expect(codeEdt.baseNotes).toEqual(["tonkaBean", "cedar"]);
    expect(codeEdt.generalNotes).toEqual([]);
    expect([
      ...codeEdt.topNotes,
      ...codeEdt.middleNotes,
      ...codeEdt.baseNotes,
      ...codeEdt.generalNotes,
    ]).not.toContain("tobacco");
  });

  it("resolves Armani Code EDT corrected notes without duplicate canonical entries", () => {
    const codeEdt = perfumeById(ARMANI_CODE_EDT_ID);
    const correctedNoteIds = [
      ...codeEdt.topNotes,
      ...codeEdt.middleNotes,
      ...codeEdt.baseNotes,
    ];

    expect(correctedNoteIds.every((noteId) => notes[noteId])).toBe(true);
    expect(notes.greenMandarin.name).toBe("Green Mandarin");
    expect(notes.lavender.name).toBe("Lavender");
    expect(notes.tonkaBean.name).toBe("Tonka Bean");
    expect(notes.cedar.name).toBe("Cedar");

    const greenMandarinEntries = Object.entries(notes).filter(
      ([, note]) => note.name === "Green Mandarin"
    );
    expect(greenMandarinEntries.map(([noteId]) => noteId)).toEqual(["greenMandarin"]);
  });

  it("updates Armani Code EDT search and Scent Library relationships from corrected notes", () => {
    const codeEdt = perfumeById(ARMANI_CODE_EDT_ID);
    const scentLibrary = buildScentLibraryViewModel({
      selectedPerfumes: [codeEdt],
      notes,
    });

    for (const noteId of ["greenMandarin", "lavender", "tonkaBean", "cedar"]) {
      const entry = scentLibrary.find((note) => note.noteId === noteId);
      expect(entry.perfumeCount).toBe(1);
      expect(entry.perfumes.map((perfume) => perfume.perfumeId)).toEqual([
        ARMANI_CODE_EDT_ID,
      ]);
    }

    expect(scentLibrary.some((entry) => entry.noteId === "tobacco")).toBe(false);
    expect(idsForSearch("green mandarin")).toContain(ARMANI_CODE_EDT_ID);
    expect(idsForSearch("lavender")).toContain(ARMANI_CODE_EDT_ID);
    expect(idsForSearch("tonka bean")).toContain(ARMANI_CODE_EDT_ID);
    expect(idsForSearch("cedar")).toContain(ARMANI_CODE_EDT_ID);
    expect(idsForSearch("tobacco")).not.toContain(ARMANI_CODE_EDT_ID);
  });

  it("keeps Silver Mountain Water identity and production image contract", () => {
    const smw = perfumeById(SILVER_MOUNTAIN_WATER_ID);

    expect(smw).toMatchObject({
      id: SILVER_MOUNTAIN_WATER_ID,
      name: "Silver Mountain Water",
      shortName: "SMW",
      brand: "Creed",
      points: 4,
      imageAssetKey: "perfumes/diamond/silver-mountain-water.png",
    });

    const assetPath = sourceAssetPath(smw.imageAssetKey);
    expect(existsSync(assetPath)).toBe(true);

    const png = readFileSync(assetPath);
    expect(png.subarray(0, 8)).toEqual(
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    );
    expect(png.readUInt32BE(16)).toBe(512);
    expect(png.readUInt32BE(20)).toBe(512);
    expect(png[25]).toBe(6);
  });
});
