import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import PerfumeCard from "./PerfumeCard.jsx";

const tierData = {
  color: "#facc15",
  background: "rgba(250, 204, 21, 0.12)",
  emoji: "◆",
  name: "Bronze",
};

function renderPerfumeCard(perfumeOverrides = {}, propOverrides = {}) {
  return renderToStaticMarkup(
    <PerfumeCard
      perfume={{
        id: 1,
        name: "Givenchy Pour Homme Blue Label",
        brand: "Givenchy",
        points: 1,
        image: "/images/perfumes/bronze/givenchy-pour-homme-blue-label.png",
        imageFallback: "/images/perfumes/placeholders/perfume-placeholder.svg",
        accords: ["fresh", "citrus"],
        ...perfumeOverrides,
      }}
      tierData={tierData}
      assetResolver={(assetKey) => `/images/${assetKey}`}
      onAddToBox={() => {}}
      onOpenDetails={() => {}}
      isDisabled={false}
      {...propOverrides}
    />
  );
}

describe("PerfumeCard", () => {
  it("renders the brand logo as a badge inside the image area (not the brand-name row) and uses a compact points action row", () => {
    const markup = renderPerfumeCard();
    const imageStart = markup.indexOf('class="perfume-card-image"');
    const badgeStart = markup.indexOf('class="perfume-card-brand-badge"');
    const brandNameStart = markup.indexOf('class="perfume-brand-name"');
    const actionsStart = markup.indexOf('class="perfume-card-compact-actions"');
    const pointsStart = markup.indexOf('class="perfume-card-points"');

    expect(imageStart).toBeGreaterThan(-1);
    expect(badgeStart).toBeGreaterThan(imageStart);
    expect(badgeStart).toBeLessThan(brandNameStart);
    expect(pointsStart).toBeGreaterThan(actionsStart);
    expect(markup).toContain('class="perfume-brand-name"');
    expect(markup).not.toContain('class="perfume-brand-row"');
    expect(markup).not.toContain("perfume-card-brand-logo");
    expect(markup).toContain('src="/images/brands/givenchy.png"');
    expect(markup).toContain("◆");
    expect(markup).toContain("1 pt");
    expect(markup).not.toContain("Bronze - 1 pt");
    expect(markup).not.toContain('class="perfume-card-tier-row"');
    expect(markup).toContain("Add to box");
  });

  it("does not render accord pills in the standard card while preserving perfume accord data", () => {
    const perfume = { accords: ["fresh", "citrus"] };
    const markup = renderPerfumeCard(perfume);

    expect(perfume.accords).toEqual(["fresh", "citrus"]);
    expect(markup).not.toContain('class="tag-row"');
    expect(markup).not.toContain(">fresh<");
    expect(markup).not.toContain(">citrus<");
  });

  it("does not reserve a logo slot when a brand asset is missing", () => {
    const markup = renderPerfumeCard({ brand: "Unknown Atelier" });

    expect(markup).toContain("Unknown Atelier");
    expect(markup).not.toContain("perfume-card-brand-badge");
    expect(markup).toContain("◆");
    expect(markup).toContain("1 pt");
    expect(markup).not.toContain("Bronze");
    expect(markup).toContain("Add to box");
  });

  it("renders an optional reason line, clamped to two lines, only when supplied", () => {
    const withoutReason = renderPerfumeCard();
    expect(withoutReason).not.toContain("perfume-card-reason");

    const withReason = renderPerfumeCard({}, { reason: "Fresco y limpio." });
    expect(withReason).toContain('class="perfume-card-reason"');
    expect(withReason).toContain("Fresco y limpio.");
  });

  it("omits the reason line for a null/undefined reason (the default for the main catalog grid)", () => {
    const markup = renderPerfumeCard({}, { reason: null });
    expect(markup).not.toContain("perfume-card-reason");
  });

  it("keeps localized full and compact add labels available without changing disabled behavior", () => {
    const markup = renderPerfumeCard({}, {
      isDisabled: true,
      labels: {
        add: "Agregar",
        addToBox: "Agregar a mi Discovery Box",
        viewDetails: "Ver detalles",
      },
    });

    expect(markup).toContain("Agregar a mi Discovery Box");
    expect(markup).toContain("Agregar");
    expect(markup).toContain("disabled");
  });

  describe("opt-in added state (isInBox)", () => {
    const labels = { add: "Agregar", addToBox: "Agregar a la caja", added: "Agregado", viewDetails: "Ver detalles" };
    const addButton = (markup) => markup.slice(markup.indexOf('<div class="perfume-card-compact-actions">'));

    it("renders the card's add button exactly as it always did by default: same label, no class, no extra markup", () => {
      const byDefault = renderPerfumeCard({}, { labels });
      const explicitlyOff = renderPerfumeCard({}, { labels, isInBox: false });

      expect(explicitlyOff).toBe(byDefault);
      expect(addButton(byDefault)).toContain("Agregar a la caja");
      expect(addButton(byDefault)).not.toContain("Agregado");
      expect(addButton(byDefault)).not.toContain("is-added");
      expect(addButton(byDefault)).toContain("<button>");
    });

    it("marks the button added and swaps both its labels when the fragrance is in the box", () => {
      const markup = addButton(renderPerfumeCard({}, { labels, isInBox: true }));

      expect(markup).toContain('class="perfume-card-add-button is-added"');
      expect(markup).toContain('<span class="perfume-card-add-label-full">Agregado</span>');
      expect(markup).toContain('<span class="perfume-card-add-label-short">Agregado</span>');
      expect(markup).not.toContain("Agregar a la caja");
    });

    it("falls back to an English 'Added' when a host supplies no added label", () => {
      const markup = addButton(renderPerfumeCard({}, { isInBox: true }));

      expect(markup).toContain(">Added<");
    });

    it("keeps the add handler and the full-box disabling in the added state, so nothing about adding changes", () => {
      const disabled = addButton(renderPerfumeCard({}, { labels, isInBox: true, isDisabled: true }));
      const enabled = addButton(renderPerfumeCard({}, { labels, isInBox: true, isDisabled: false }));

      expect(disabled).toContain("disabled");
      expect(enabled).not.toContain("disabled");
    });

    it("leaves the details trigger and the info icon untouched in the added state", () => {
      const byDefault = renderPerfumeCard({}, { labels });
      const added = renderPerfumeCard({}, { labels, isInBox: true });
      const details = (markup) => markup.slice(0, markup.indexOf('<div class="perfume-card-compact-actions">'));

      expect(details(added)).toBe(details(byDefault));
    });
  });
});
