import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { aurelianConfig } from "../../../../../../apps/aurelian/src/merchant/config.js";
import { discoveryDecantsConfig } from "../../../../../../src/merchants/discoveryDecants/config.js";
import CollectionCard from "../../../components/CollectionCard.jsx";
import { buildCollectionCardViewModel } from "./buildCollectionCardViewModel.js";

// The one Collection Card view model feeds Preview, Download PNG and Share Card, so the money-first
// wording is decided here once: a host that opts in (commerce.priceDisplay: "price") gets the box total
// in MXN where the card used to read "Collection Points"; every other host keeps its points summary.

const selectedPerfumes = [
  { id: 1, name: "Acqua di Gio EDT", shortName: "ADG EDT", brand: "Armani", points: 1, tier: "Bronze", image: "/a.png", accords: ["marine"], vibes: ["fresh"], occasions: ["daily"], seasons: ["summer"] },
  { id: 403, name: "Carlisle", shortName: "Carlisle", brand: "PdM", points: 4.5, tier: "Diamond", image: "/b.png", accords: ["sweet"], vibes: ["warm"], occasions: ["night"], seasons: ["winter"] },
];

function viewModel(config, estimatedValue = 550) {
  return buildCollectionCardViewModel({
    selectedPerfumes,
    totalPoints: 5.5,
    estimatedValue,
    boxSummary: { seasonStrengths: {}, seasonCounts: {}, accordCounts: {}, accordMap: {}, occasionCounts: {}, vibeCounts: {} },
    coverageSummary: { strengths: [], gaps: [] },
    scentDna: {},
    collectionIdentity: { title: "Test Rotation", subtitle: "Built for tests.", mood: ["Fresh", "Clean", "Daily"], palette: "fresh", archetype: "rotation" },
    curatorBonus: { isUnlocked: false },
    config,
    maxSlots: 16,
    maxSelectableSlots: 14,
  });
}

function summaryText(cardProps) {
  const markup = renderToStaticMarkup(<CollectionCard {...cardProps} />);
  return markup.match(/<div class="collection-card-summary"[\s\S]*?<\/div><\/div>/)[0].replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

describe("Collection Card price display", () => {
  it("gives a price-display host the box total in MXN, with the amount formatted like the rest of the Builder", () => {
    const { cardProps } = viewModel(aurelianConfig, 1900);

    expect(cardProps.collectionTotal).toBe("$1,900 MXN");
    expect(cardProps.collectionTotalLabel).toBe("Total");
    // the underlying figure is still carried for any consumer that needs the points
    expect(cardProps.collectionPoints).toBe(5.5);
  });

  it("renders the summary as Fragrances + Total with no points wording at all", () => {
    const text = summaryText(viewModel(aurelianConfig, 1900).cardProps);

    expect(text).toBe("2 Fragrances $1,900 MXN Total");
    expect(text).not.toMatch(/point|\bpts?\b|punto/i);
  });

  it("keeps the points summary for hosts that did not opt in (Discovery Decants)", () => {
    const { cardProps } = viewModel(discoveryDecantsConfig, 550);

    expect(cardProps).not.toHaveProperty("collectionTotal");
    expect(cardProps).not.toHaveProperty("collectionTotalLabel");
    expect(summaryText(cardProps)).toBe("2 Fragrances 5.5 Collection Points");
  });

  it("keeps the points summary when the card is rendered with no total supplied", () => {
    expect(summaryText({ perfumes: selectedPerfumes, collectionPoints: 12 })).toBe("2 Fragrances 12.0 Collection Points");
  });

  it("gives preview, download and share one set of props, so the three can never disagree", () => {
    const first = viewModel(aurelianConfig, 1900).cardProps;
    const second = viewModel(aurelianConfig, 1900).cardProps;

    expect(second).toEqual(first);
  });
});
