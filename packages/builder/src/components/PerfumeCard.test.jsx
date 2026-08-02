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
  it("renders the brand logo inside the brand row and uses a compact points action row", () => {
    const markup = renderPerfumeCard();
    const brandRowStart = markup.indexOf('class="perfume-brand-row"');
    const logoStart = markup.indexOf('class="perfume-card-brand-logo"');
    const actionsStart = markup.indexOf('class="perfume-card-compact-actions"');
    const pointsStart = markup.indexOf('class="perfume-card-points"');

    expect(brandRowStart).toBeGreaterThan(-1);
    expect(logoStart).toBeGreaterThan(brandRowStart);
    expect(logoStart).toBeLessThan(actionsStart);
    expect(pointsStart).toBeGreaterThan(actionsStart);
    expect(markup).toContain('class="perfume-brand-name"');
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
    expect(markup).not.toContain("perfume-card-brand-logo");
    expect(markup).toContain("◆");
    expect(markup).toContain("1 pt");
    expect(markup).not.toContain("Bronze");
    expect(markup).toContain("Add to box");
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
});
