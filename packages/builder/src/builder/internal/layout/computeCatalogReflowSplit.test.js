import { describe, expect, it } from "vitest";
import { computeCatalogReflowSplit } from "./computeCatalogReflowSplit.js";

describe("computeCatalogReflowSplit", () => {
  it("splits at the row boundary that covers the panel's measured height", () => {
    // rowHeight = 200 (180 card + 20 gap); panel is 850px tall -> ceil(850/200) = 5 rows
    const split = computeCatalogReflowSplit({
      panelHeight: 850,
      cardHeight: 180,
      columnCount: 3,
      rowGap: 20,
      totalCount: 30,
    });
    expect(split).toBe(15); // 5 rows * 3 columns
  });

  it("rounds up a partial row so the split never lands mid-row", () => {
    const split = computeCatalogReflowSplit({
      panelHeight: 201, // just over 1 row (200px) -> needs 2 rows
      cardHeight: 180,
      columnCount: 4,
      rowGap: 20,
      totalCount: 40,
    });
    expect(split).toBe(8); // 2 rows * 4 columns
  });

  it("clamps to totalCount when the panel is taller than the whole catalog", () => {
    const split = computeCatalogReflowSplit({
      panelHeight: 100000,
      cardHeight: 180,
      columnCount: 3,
      rowGap: 20,
      totalCount: 12,
    });
    expect(split).toBe(12);
  });

  it("returns totalCount (no split) when measurements are missing or invalid", () => {
    expect(
      computeCatalogReflowSplit({ panelHeight: 0, cardHeight: 180, columnCount: 3, rowGap: 20, totalCount: 10 }),
    ).toBe(10);
    expect(
      computeCatalogReflowSplit({ panelHeight: 800, cardHeight: 0, columnCount: 3, rowGap: 20, totalCount: 10 }),
    ).toBe(10);
    expect(
      computeCatalogReflowSplit({ panelHeight: 800, cardHeight: 180, columnCount: 0, rowGap: 20, totalCount: 10 }),
    ).toBe(10);
    expect(
      computeCatalogReflowSplit({ panelHeight: 800, cardHeight: 180, columnCount: 3, rowGap: 20, totalCount: 0 }),
    ).toBe(0);
  });

  it("treats a missing rowGap as zero rather than throwing", () => {
    const split = computeCatalogReflowSplit({
      panelHeight: 400,
      cardHeight: 200,
      columnCount: 2,
      rowGap: undefined,
      totalCount: 20,
    });
    expect(split).toBe(4); // 2 rows * 2 columns
  });
});
