import { describe, expect, it } from "vitest";

import { fragrances, notes } from "@discovery-box/catalog";
import { aurelianTaxonomyLabels } from "./taxonomyLabels.js";

// Completeness guard for Aurelian's own es-MX taxonomy data (moved out of
// the shared Builder package -- see ADR-0004/0007 merchant-boundary
// discipline). This checks Aurelian's data directly against the live shared
// catalog; it does not exercise createTranslator's generic override
// mechanism itself (that lookup/fallback behavior is shared, merchant-
// agnostic, and covered by packages/builder's own createTranslator.test.js).
//
// A newly-added perfume/accord/note in the shared catalog that Aurelian
// hasn't translated yet will fail here, not silently show raw English on an
// otherwise-Spanish page.

describe("Aurelian fragrance-taxonomy label completeness (accords)", () => {
  const catalogAccords = [...new Set(fragrances.flatMap((perfume) => perfume.accords || []))];

  it("covers every accord referenced anywhere in the shared catalog", () => {
    expect(catalogAccords.length).toBeGreaterThan(0);

    const missing = catalogAccords.filter((accord) => !aurelianTaxonomyLabels[`taxonomy.${accord}`]);
    expect(missing, `missing Aurelian taxonomy labels for accords: ${missing.join(", ")}`).toEqual([]);
  });
});

describe("Aurelian fragrance-taxonomy label completeness (notes)", () => {
  const catalogNoteIds = Object.keys(notes);

  it("covers every note the shared catalog defines", () => {
    expect(catalogNoteIds.length).toBeGreaterThan(0);

    const missing = catalogNoteIds.filter((noteId) => !aurelianTaxonomyLabels[`taxonomy.${noteId}`]);
    expect(missing, `missing Aurelian taxonomy labels for notes: ${missing.join(", ")}`).toEqual([]);
  });
});
