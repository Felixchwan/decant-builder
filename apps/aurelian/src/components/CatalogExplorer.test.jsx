import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it } from "vitest";
import { CatalogExplorer, CatalogLearningEvidenceLink } from "./CatalogExplorer.jsx";
import { aurelianCatalog } from "../merchant/catalog.js";

const originalWindow = globalThis.window;

afterEach(() => {
  globalThis.window = originalWindow;
});

describe("CatalogExplorer", () => {
  const representative = aurelianCatalog[0];

  it("renders a representative card with fragrance identity, points, the commercial action, and the learning disclosure", () => {
    const markup = renderToStaticMarkup(<CatalogExplorer />);

    expect(markup).toContain(representative.brand);
    expect(markup).toContain(representative.name);
    expect(markup).toMatch(/product-card__points/);
    expect(markup).toContain("Agregar a mi Discovery Box");
    expect(markup).toContain("Explorar esta fragancia");
    expect(markup).toContain("Registrar lo que percibo");
    expect(markup).toContain("Comparar con otra");
    expect(markup).toContain("Ver lo que he notado");
  });

  it("keeps the existing commercial href exactly as before", () => {
    const markup = renderToStaticMarkup(<CatalogExplorer />);

    expect(markup).toContain(
      `href="/build-your-box?fragrance=${encodeURIComponent(representative.id)}"`
    );
  });

  it("points the Observation learning link at exactly /mis-descubrimientos/observar?fragrance=<id>", () => {
    const markup = renderToStaticMarkup(<CatalogExplorer />);

    expect(markup).toContain(
      `href="/mis-descubrimientos/observar?fragrance=${encodeURIComponent(representative.id)}"`
    );
  });

  it("points the Comparison learning link at exactly /mis-descubrimientos/comparar?fragrance=<id>", () => {
    const markup = renderToStaticMarkup(<CatalogExplorer />);

    expect(markup).toContain(
      `href="/mis-descubrimientos/comparar?fragrance=${encodeURIComponent(representative.id)}"`
    );
  });

  it("gives every learning affordance a fragrance-specific accessible name", () => {
    const markup = renderToStaticMarkup(<CatalogExplorer />);

    expect(markup).toContain(
      `aria-label="Explorar opciones de aprendizaje para ${representative.name}"`
    );
    expect(markup).toContain(
      `aria-label="Registrar lo que percibo de ${representative.name}"`
    );
    expect(markup).toContain(
      `aria-label="Comparar ${representative.name} con otra fragancia"`
    );
  });

  it("does the same for every fragrance in the catalog, not just the representative one", () => {
    const markup = renderToStaticMarkup(<CatalogExplorer />);

    for (const item of aurelianCatalog) {
      expect(markup).toContain(
        `href="/mis-descubrimientos/observar?fragrance=${encodeURIComponent(item.id)}"`
      );
      expect(markup).toContain(
        `href="/mis-descubrimientos/comparar?fragrance=${encodeURIComponent(item.id)}"`
      );
    }
  });

  it("points the new learner-record disclosure link at exactly /mis-descubrimientos, with no fragrance param, once per card", () => {
    const markup = renderToStaticMarkup(<CatalogExplorer />);

    const matches = markup.match(/href="\/mis-descubrimientos"/g);
    expect(matches?.length).toBe(aurelianCatalog.length);
  });

  it("uses native details/summary semantics, not a custom dropdown", () => {
    const markup = renderToStaticMarkup(<CatalogExplorer />);

    expect(markup).toMatch(/<details class="product-card__learning">/);
    expect(markup).toMatch(/<summary/);
    // No custom ARIA disclosure state duplicating native <details> semantics.
    expect(markup).not.toMatch(/aria-expanded/);
  });

  it("carries data-fragrance-id per card, the same identity resolveCatalogFragranceIntent's own dedicated tests already exercise for highlighting", () => {
    // The highlight-on-deep-link behavior itself is effect-driven
    // (CatalogExplorer's useEffect calls resolveCatalogFragranceIntent on
    // window.location.search) and cannot fire under renderToStaticMarkup,
    // which never runs effects -- that logic already has its own dedicated
    // regression coverage in resolveCatalogFragranceIntent.test.js and
    // parseFragranceIntent.test.js. What's verified here, cleanly, is that
    // every card still carries the identity attribute that behavior depends
    // on, unaffected by this change.
    const markup = renderToStaticMarkup(<CatalogExplorer />);

    for (const item of aurelianCatalog) {
      expect(markup).toContain(`data-fragrance-id="${item.id}"`);
    }
  });

  it("causes no Perceptual Learning (or any) storage access merely by rendering", () => {
    let getItemCalls = 0;
    let setItemCalls = 0;
    let removeItemCalls = 0;
    globalThis.window = {
      location: { href: "https://aurelianperfumes.com/catalogo", search: "" },
      localStorage: {
        getItem: () => {
          getItemCalls += 1;
          return null;
        },
        setItem: () => {
          setItemCalls += 1;
        },
        removeItem: () => {
          removeItemCalls += 1;
        },
      },
    };

    renderToStaticMarkup(<CatalogExplorer />);

    expect(getItemCalls).toBe(0);
    expect(setItemCalls).toBe(0);
    expect(removeItemCalls).toBe(0);
  });

  it("never renders the evidence-revisit link on a plain render (Phase 5.0) -- learnerRecord resolves post-mount, the same effect-gated timing already established for the highlight-on-deep-link behavior above, and renderToStaticMarkup never runs effects", () => {
    const markup = renderToStaticMarkup(<CatalogExplorer />);

    expect(markup).not.toContain("Ver lo que noté sobre esta fragancia");
  });
});

describe("CatalogLearningEvidenceLink (Phase 5.0)", () => {
  function learnerRecordWithEvidenceFor(fragranceId) {
    return {
      learnerId: "learner-1",
      hasEvidence: true,
      encounters: [
        {
          encounterInstanceId: "enc-1",
          fragranceId,
          fragranceDisplaySnapshot: { fragranceId, name: "X", brand: "Y" },
          createdAt: "2026-08-01T00:00:00.000Z",
          observations: [
            { observationId: "obs-1", moment: "initial", freeText: "Muy fresco.", createdAt: "2026-08-01T00:00:00.000Z" },
          ],
        },
      ],
      comparisons: [],
    };
  }

  it("renders nothing when learnerRecord has not resolved yet (null, the pre-effect/pre-hydration state)", () => {
    const markup = renderToStaticMarkup(
      <CatalogLearningEvidenceLink fragranceId={1} fragranceName="Acqua di Gio EDT" learnerRecord={null} />
    );

    expect(markup).toBe("");
  });

  it("renders nothing when the fragrance genuinely has no prior evidence", () => {
    const emptyRecord = { learnerId: null, hasEvidence: false, encounters: [], comparisons: [] };

    const markup = renderToStaticMarkup(
      <CatalogLearningEvidenceLink fragranceId={1} fragranceName="Acqua di Gio EDT" learnerRecord={emptyRecord} />
    );

    expect(markup).toBe("");
  });

  it("renders nothing for this fragrance when a DIFFERENT fragrance has evidence", () => {
    const markup = renderToStaticMarkup(
      <CatalogLearningEvidenceLink
        fragranceId={2}
        fragranceName="Light Blue Pour Homme EDT"
        learnerRecord={learnerRecordWithEvidenceFor(1)}
      />
    );

    expect(markup).toBe("");
  });

  it("renders a fragrance-specific link, with a fragrance-specific accessible name, when prior evidence exists", () => {
    const markup = renderToStaticMarkup(
      <CatalogLearningEvidenceLink
        fragranceId={1}
        fragranceName="Acqua di Gio EDT"
        learnerRecord={learnerRecordWithEvidenceFor(1)}
      />
    );

    expect(markup).toContain('href="/mis-descubrimientos?fragrance=1"');
    expect(markup).toContain('aria-label="Ver lo que noté sobre Acqua di Gio EDT"');
    expect(markup).toContain("Ver lo que noté sobre esta fragancia");
  });
});
