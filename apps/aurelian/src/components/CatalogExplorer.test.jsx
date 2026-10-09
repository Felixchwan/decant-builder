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

describe("CatalogExplorer bottle and name: explore details, never add", () => {
  // One render for the whole file: the catalog is 92 cards, so rendering it per card would be quadratic.
  const markup = renderToStaticMarkup(<CatalogExplorer />);
  const cardMarkup = (item) => {
    const start = markup.indexOf(`data-fragrance-id="${item.id}"`);
    const end = markup.indexOf("</article>", start);
    return markup.slice(start, end);
  };
  const links = (html) => [...html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/g)].map(([, attrs, inner]) => ({ attrs, inner }));
  const attr = (attrs, name) => attrs.match(new RegExp(String.raw`(?:^|\s)${name}="([^"]*)"`))?.[1];

  it("links both the bottle and the name to the Builder details, for every card, with ?details= and never ?fragrance=", () => {
    aurelianCatalog.forEach((item) => {
      const href = `/build-your-box?details=${encodeURIComponent(item.id)}`;
      const card = cardMarkup(item);
      const detailsLinks = links(card).filter(({ attrs }) => attr(attrs, "href") === href);

      expect(detailsLinks, item.name).toHaveLength(2);
      expect(card).toContain(`<h2><a `);
      expect(card).toContain(`>${renderToStaticMarkup(<>{item.name}</>)}</a></h2>`);
    });
  });

  it("keeps the Add button on the add contract: ?fragrance=, and nothing else carries it", () => {
    const item = aurelianCatalog[0];
    const card = cardMarkup(item);
    const add = links(card).filter(({ attrs }) => attr(attrs, "href") === `/build-your-box?fragrance=${item.id}`);

    expect(add).toHaveLength(1);
    expect(add[0].attrs).toContain("product-card__action");
    expect(add[0].inner).toBe("Agregar a mi Discovery Box");
    expect(attr(add[0].attrs, "aria-label")).toBe(`Agregar ${item.name} a mi Discovery Box`);
    // The details links never add, and the add link never merely explores.
    expect(links(card).filter(({ attrs }) => /details=/.test(attr(attrs, "href") ?? "")).every(({ attrs }) => !/fragrance=/.test(attr(attrs, "href")))).toBe(true);
  });

  it("gives the name link one clear accessible name that contains its visible text, and the bottle link no second tab stop", () => {
    const item = aurelianCatalog[0];
    const [bottle, name] = links(cardMarkup(item)).filter(({ attrs }) => /details=/.test(attr(attrs, "href") ?? ""));

    expect(attr(name.attrs, "aria-label")).toBe(`Ver notas y detalles de ${item.name} en el Builder`);
    expect(attr(name.attrs, "aria-label")).toContain(item.name);
    expect(name.attrs).not.toMatch(/tabindex/);
    expect(name.attrs).not.toMatch(/aria-hidden/);

    // The bottle repeats the name link for pointer/touch only: out of the tab order and the a11y tree.
    expect(attr(bottle.attrs, "aria-hidden")).toBe("true");
    expect(attr(bottle.attrs, "tabindex")).toBe("-1");
    expect(bottle.inner).toContain(`alt="Frasco de ${item.name}"`);
  });

  it("does not make the whole card clickable: the article holds links only on the bottle, name, add action and learning disclosure", () => {
    const item = aurelianCatalog[0];
    const card = cardMarkup(item);

    expect(card).not.toMatch(/<article[^>]*(?:onclick|role="link")/i);
    expect(links(card).map(({ attrs }) => attr(attrs, "href"))).toEqual([
      `/build-your-box?details=${item.id}`,
      `/build-your-box?details=${item.id}`,
      `/build-your-box?fragrance=${item.id}`,
      `/mis-descubrimientos/observar?fragrance=${item.id}`,
      `/mis-descubrimientos/comparar?fragrance=${item.id}`,
      "/mis-descubrimientos",
    ]);
  });

  it("preserves the 'Explorar esta fragancia' learning disclosure exactly (native <details>, its own purpose)", () => {
    const card = cardMarkup(aurelianCatalog[0]);

    expect(card).toContain('<details class="product-card__learning">');
    expect(card).toContain("Explorar esta fragancia");
    expect(card).toContain("Registrar lo que percibo");
    expect(card).toContain("Comparar con otra");
    expect(card).not.toMatch(/<details[^>]*>[\s\S]*details=/);
  });
});
