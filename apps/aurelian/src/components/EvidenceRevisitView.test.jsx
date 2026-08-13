import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  EvidenceRevisitComparisonCard,
  EvidenceRevisitObservationCard,
  EvidenceRevisitView,
} from "./EvidenceRevisitView.jsx";

function snapshotFor(fragranceId, name = `Fragrance ${fragranceId}`, brand = "Aurelian") {
  return { fragranceId, name, brand };
}

function encounter(overrides = {}) {
  return {
    encounterInstanceId: "enc-1",
    fragranceId: 1,
    fragranceDisplaySnapshot: snapshotFor(1, "Fico di Amalfi"),
    createdAt: "2026-08-01T00:00:00.000Z",
    observations: [
      { observationId: "obs-1", moment: "initial", freeText: "Very bright.", createdAt: "2026-08-01T00:00:00.000Z" },
    ],
    ...overrides,
  };
}

function comparison(overrides = {}) {
  return {
    comparisonId: "cmp-1",
    freeText: "x",
    createdAt: "2026-08-01T00:00:00.000Z",
    firstEncounter: {
      encounterInstanceId: "enc-1",
      fragranceId: 1,
      fragranceDisplaySnapshot: snapshotFor(1, "Fico di Amalfi"),
    },
    secondEncounter: {
      encounterInstanceId: "enc-2",
      fragranceId: 2,
      fragranceDisplaySnapshot: snapshotFor(2, "Acqua di Gio EDT", "Giorgio Armani"),
    },
    ...overrides,
  };
}

function evidenceRevisit(overrides = {}) {
  return {
    fragranceId: 1,
    hasPriorEvidence: true,
    encounters: [],
    comparisons: [],
    ...overrides,
  };
}

describe("EvidenceRevisitObservationCard", () => {
  it("renders fragrance name/brand, date, moment label, and freeText verbatim", () => {
    const markup = renderToStaticMarkup(<EvidenceRevisitObservationCard encounter={encounter()} />);

    expect(markup).toContain("Fico di Amalfi");
    expect(markup).toContain("Aurelian");
    expect(markup).toContain("Al aplicarlo");
    expect(markup).toContain("Very bright.");
  });

  it("falls back to a neutral label when fragranceDisplaySnapshot is null, without crashing", () => {
    expect(() =>
      renderToStaticMarkup(
        <EvidenceRevisitObservationCard encounter={encounter({ fragranceDisplaySnapshot: null })} />
      )
    ).not.toThrow();
    const markup = renderToStaticMarkup(
      <EvidenceRevisitObservationCard encounter={encounter({ fragranceDisplaySnapshot: null })} />
    );

    expect(markup).toContain("Una fragancia");
  });

  it("renders repeated identical Observation text without deduplication", () => {
    const markup = renderToStaticMarkup(
      <EvidenceRevisitObservationCard
        encounter={encounter({
          observations: [
            { observationId: "obs-1", moment: "initial", freeText: "Bright.", createdAt: "2026-08-01T00:00:00.000Z" },
            { observationId: "obs-2", moment: "later", freeText: "Bright.", createdAt: "2026-08-02T00:00:00.000Z" },
          ],
        })}
      />
    );

    expect(markup.match(/Bright\./g)?.length).toBe(2);
  });
});

describe("EvidenceRevisitComparisonCard", () => {
  it("renders first ↔ second in order, freeText verbatim, without reorientation", () => {
    const markup = renderToStaticMarkup(<EvidenceRevisitComparisonCard comparison={comparison()} />);

    expect(markup.indexOf("Fico di Amalfi")).toBeLessThan(markup.indexOf("Acqua di Gio EDT"));
    expect(markup).toContain("x");
  });

  it("preserves order even when the queried fragrance is the second side", () => {
    // The card itself has no notion of "which fragrance was queried" -- it
    // only ever renders first/second exactly as given, proving no
    // reorientation logic exists in this presentation layer.
    const markup = renderToStaticMarkup(
      <EvidenceRevisitComparisonCard
        comparison={comparison({
          firstEncounter: {
            encounterInstanceId: "enc-2",
            fragranceId: 2,
            fragranceDisplaySnapshot: snapshotFor(2, "Acqua di Gio EDT", "Giorgio Armani"),
          },
          secondEncounter: {
            encounterInstanceId: "enc-1",
            fragranceId: 1,
            fragranceDisplaySnapshot: snapshotFor(1, "Fico di Amalfi"),
          },
        })}
      />
    );

    expect(markup.indexOf("Acqua di Gio EDT")).toBeLessThan(markup.indexOf("Fico di Amalfi"));
  });

  it("falls back to a neutral label when a referenced encounter is null, without crashing", () => {
    expect(() =>
      renderToStaticMarkup(
        <EvidenceRevisitComparisonCard comparison={comparison({ firstEncounter: null, secondEncounter: null })} />
      )
    ).not.toThrow();
    const markup = renderToStaticMarkup(
      <EvidenceRevisitComparisonCard comparison={comparison({ firstEncounter: null, secondEncounter: null })} />
    );

    expect(markup.match(/Una fragancia/g)?.length).toBe(2);
  });

  describe("same-fragrance (temporal) date disambiguation (Phase 6.0)", () => {
    function sameFragranceComparison(overrides = {}) {
      return comparison({
        firstEncounter: {
          encounterInstanceId: "enc-a",
          fragranceId: 1,
          fragranceDisplaySnapshot: snapshotFor(1, "Acqua di Gio EDT", "Giorgio Armani"),
          createdAt: "2026-08-12T00:00:00.000Z",
        },
        secondEncounter: {
          encounterInstanceId: "enc-b",
          fragranceId: 1,
          fragranceDisplaySnapshot: snapshotFor(1, "Acqua di Gio EDT", "Giorgio Armani"),
          createdAt: "2026-05-03T00:00:00.000Z",
        },
        ...overrides,
      });
    }

    it("appends each side's own encounter date when both sides share the same fragranceId", () => {
      const markup = renderToStaticMarkup(
        <EvidenceRevisitComparisonCard comparison={sameFragranceComparison()} />
      );

      expect(markup).toContain('<time dateTime="2026-08-12T00:00:00.000Z"');
      expect(markup).toContain('<time dateTime="2026-05-03T00:00:00.000Z"');
      expect(markup.match(/Acqua di Gio EDT/g)?.length).toBe(2);
    });

    it("distinguishes two same-fragrance sides that fall on the same calendar day, different times (same-day disambiguation regression)", () => {
      const morning = "2026-08-13T10:15:00.000Z";
      const evening = "2026-08-13T18:40:00.000Z";
      const markup = renderToStaticMarkup(
        <EvidenceRevisitComparisonCard
          comparison={sameFragranceComparison({
            firstEncounter: {
              encounterInstanceId: "enc-morning",
              fragranceId: 1,
              fragranceDisplaySnapshot: snapshotFor(1, "Acqua di Gio EDT", "Giorgio Armani"),
              createdAt: morning,
            },
            secondEncounter: {
              encounterInstanceId: "enc-evening",
              fragranceId: 1,
              fragranceDisplaySnapshot: snapshotFor(1, "Acqua di Gio EDT", "Giorgio Armani"),
              createdAt: evening,
            },
          })}
        />
      );

      expect(markup).toContain(`<time dateTime="${morning}"`);
      expect(markup).toContain(`<time dateTime="${evening}"`);

      const sideTexts = Array.from(markup.matchAll(/<span>(Acqua di Gio EDT[^<]*<time[^>]*>[^<]*<\/time>\))<\/span>/g)).map(
        (match) => match[1].replace(/<[^>]+>/g, "")
      );
      expect(sideTexts).toHaveLength(2);
      expect(sideTexts[0]).not.toBe(sideTexts[1]);
      expect(sideTexts[0]).toMatch(/\d{1,2}:\d{2}/);
      expect(sideTexts[1]).toMatch(/\d{1,2}:\d{2}/);
      expect(sideTexts.join(" ")).not.toContain("enc-morning");
      expect(sideTexts.join(" ")).not.toContain("enc-evening");
    });

    it("does NOT append a date when the two sides are different fragrances", () => {
      const markup = renderToStaticMarkup(<EvidenceRevisitComparisonCard comparison={comparison()} />);

      expect(markup).not.toMatch(/<time/);
    });
  });
});

describe("EvidenceRevisitView", () => {
  it("uses a native <details>/<summary> disclosure with the exact toggle copy, closed by default", () => {
    const markup = renderToStaticMarkup(
      <EvidenceRevisitView evidenceRevisit={evidenceRevisit({ encounters: [encounter()] })} />
    );

    expect(markup).toMatch(/<details class="evidence-revisit"/);
    expect(markup).not.toMatch(/<details[^>]*\bopen\b/);
    expect(markup).toContain("Revisar lo que había percibido antes");
  });

  it("renders the Observation section only when at least one encounter has Observations, and omits an empty card for a zero-Observation encounter", () => {
    const markup = renderToStaticMarkup(
      <EvidenceRevisitView
        evidenceRevisit={evidenceRevisit({
          encounters: [
            encounter({ encounterInstanceId: "enc-observed" }),
            encounter({ encounterInstanceId: "enc-empty", observations: [] }),
          ],
        })}
      />
    );

    expect(markup).toContain("Lo que habías registrado");
    expect(markup.match(/<article class="encounter-evidence-card"/g)?.length).toBe(1);
  });

  it("omits the Observation section entirely when no matching encounter has Observations", () => {
    const markup = renderToStaticMarkup(
      <EvidenceRevisitView
        evidenceRevisit={evidenceRevisit({
          encounters: [encounter({ observations: [] })],
          comparisons: [comparison()],
        })}
      />
    );

    expect(markup).not.toContain("Lo que habías registrado");
    expect(markup).toContain("Comparaciones anteriores");
  });

  it("keeps repeated matching encounters separate, un-merged", () => {
    const markup = renderToStaticMarkup(
      <EvidenceRevisitView
        evidenceRevisit={evidenceRevisit({
          encounters: [
            encounter({ encounterInstanceId: "enc-a", observations: [{ observationId: "o1", moment: "initial", freeText: "First visit.", createdAt: "2026-08-01T00:00:00.000Z" }] }),
            encounter({ encounterInstanceId: "enc-b", observations: [{ observationId: "o2", moment: "initial", freeText: "Second visit.", createdAt: "2026-08-05T00:00:00.000Z" }] }),
          ],
        })}
      />
    );

    expect(markup.match(/<article class="encounter-evidence-card"/g)?.length).toBe(2);
    expect(markup).toContain("First visit.");
    expect(markup).toContain("Second visit.");
  });

  it("keeps repeated Comparisons separate, un-deduplicated", () => {
    const markup = renderToStaticMarkup(
      <EvidenceRevisitView
        evidenceRevisit={evidenceRevisit({
          comparisons: [
            comparison({ comparisonId: "cmp-1", freeText: "First comparison." }),
            comparison({ comparisonId: "cmp-2", freeText: "Second comparison, same pair." }),
          ],
        })}
      />
    );

    expect(markup.match(/<article class="comparison-evidence-card"/g)?.length).toBe(2);
    expect(markup).toContain("First comparison.");
    expect(markup).toContain("Second comparison, same pair.");
  });

  it("omits the Comparisons section entirely when there are none", () => {
    const markup = renderToStaticMarkup(
      <EvidenceRevisitView evidenceRevisit={evidenceRevisit({ encounters: [encounter()] })} />
    );

    expect(markup).not.toContain("Comparaciones anteriores");
  });

  describe("no live catalog dependency", () => {
    it("has no import of aurelianCatalog, filterCatalog, or any catalog module", () => {
      // Checked against import lines specifically, not the whole source --
      // explanatory comments legitimately discuss "the live catalog" in
      // prose; what matters structurally is that no import statement pulls
      // one in.
      const source = readFileSync(
        fileURLToPath(new URL("./EvidenceRevisitView.jsx", import.meta.url)),
        "utf8"
      );
      const importLines = source
        .split("\n")
        .filter((line) => line.trim().startsWith("import "))
        .join("\n");

      expect(importLines).not.toMatch(/catalog/i);
    });
  });
});
