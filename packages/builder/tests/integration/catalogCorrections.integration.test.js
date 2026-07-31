import { describe, expect, it } from "vitest";

import { fragrances, notes } from "@discovery-box/catalog";
import { buildCatalogView } from "../../src/builder/internal/catalog/buildCatalogView.js";
import { buildScentLibraryViewModel } from "../../src/builder/internal/intelligence/buildScentLibraryViewModel.js";

const ARMANI_CODE_EDT_ID = 104;

describe("catalog correction Builder integration", () => {
  it("uses corrected Armani Code EDT notes in search and Scent Library relationships", () => {
    const codeEdt = fragrances.find(({ id }) => id === ARMANI_CODE_EDT_ID);
    const scentLibrary = buildScentLibraryViewModel({ selectedPerfumes: [codeEdt], notes });

    for (const noteId of ["greenMandarin", "lavender", "tonkaBean", "cedar"]) {
      const entry = scentLibrary.find((note) => note.noteId === noteId);
      expect(entry.perfumeCount).toBe(1);
      expect(entry.perfumes.map((perfume) => perfume.perfumeId)).toEqual([ARMANI_CODE_EDT_ID]);
    }
    expect(scentLibrary.some((entry) => entry.noteId === "tobacco")).toBe(false);

    const idsForSearch = (searchQuery) => buildCatalogView({
      catalog: fragrances,
      notes,
      searchQuery,
    }).visiblePerfumes.map(({ id }) => id);
    for (const query of ["green mandarin", "lavender", "tonka bean", "cedar"]) {
      expect(idsForSearch(query)).toContain(ARMANI_CODE_EDT_ID);
    }
    expect(idsForSearch("tobacco")).not.toContain(ARMANI_CODE_EDT_ID);
  });
});
