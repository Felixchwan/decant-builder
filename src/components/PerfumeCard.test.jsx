import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import PerfumeCard from "./PerfumeCard.jsx";

const tierData = {
  color: "#facc15",
  background: "rgba(250, 204, 21, 0.12)",
  emoji: "◆",
  name: "Bronze",
};

function renderPerfumeCard(perfumeOverrides = {}) {
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
    />
  );
}

describe("PerfumeCard", () => {
  it("renders the brand logo inside the brand row and keeps the tier row separate", () => {
    const markup = renderPerfumeCard();
    const brandRowStart = markup.indexOf('class="perfume-brand-row"');
    const tierRowStart = markup.indexOf('class="perfume-card-tier-row"');
    const logoStart = markup.indexOf('class="perfume-card-brand-logo"');

    expect(brandRowStart).toBeGreaterThan(-1);
    expect(logoStart).toBeGreaterThan(brandRowStart);
    expect(logoStart).toBeLessThan(tierRowStart);
    expect(markup).toContain('class="perfume-brand-name"');
    expect(markup).toContain('src="/images/brands/givenchy.png"');
    expect(markup).toContain("Bronze - 1 pt");
    expect(markup).toContain("Add to box");
  });

  it("does not reserve a logo slot when a brand asset is missing", () => {
    const markup = renderPerfumeCard({ brand: "Unknown Atelier" });

    expect(markup).toContain("Unknown Atelier");
    expect(markup).not.toContain("perfume-card-brand-logo");
    expect(markup).toContain("Bronze - 1 pt");
    expect(markup).toContain("Add to box");
  });
});
