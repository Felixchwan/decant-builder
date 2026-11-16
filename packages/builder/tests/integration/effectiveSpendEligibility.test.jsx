import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { aurelianConfig } from "../../../../apps/aurelian/src/merchant/config.js";
import { discoveryDecantsConfig } from "../../../../src/merchants/discoveryDecants/config.js";
import { buildCollectionCardViewModel } from "../../src/builder/internal/collectionCard/buildCollectionCardViewModel.js";
import { getComposerCostPoints, withComposerCost } from "../../src/builder/internal/composer/composerCost.js";
import { buildComposerBoxProposal, COMPOSER_BOX_PROPOSAL_STATUSES } from "../../src/builder/internal/composition/buildComposerBoxProposal.js";
import { isCuratorBonusUnlocked } from "../../src/builder/internal/curatorBonus/isCuratorBonusUnlocked.js";
import { buildFinalizationModel } from "../../src/builder/internal/finalization/buildFinalizationModel.js";
import { buildCollectionSummary } from "../../src/builder/internal/intelligence/buildCollectionSummary.js";
import { createCustomerPricing } from "../../src/utils/customerPricing.js";

// Aurelian's commercial thresholds are measured on what the customer actually pays: the minimum box spend ($1,200 MXN and six
// fragrances), the Curator Bonus, and the Composer's budget all read the EFFECTIVE price. The regular value (points, tiers) stays
// canonical and is never altered. Test-only data: no real fragrance is on sale.

const read = (...segments) => readFileSync(fileURLToPath(new URL(segments.join("/"), import.meta.url)), "utf8").replace(/\r\n/g, "\n");

const perfume = (id, points, extra = {}) => ({
  id,
  name: `Fragancia ${id}`,
  shortName: `F${id}`,
  brand: `Casa ${id}`,
  points,
  tier: "bronze",
  image: `/images/${id}.png`,
  seasons: ["fall"],
  occasions: ["date"],
  vibes: ["warm"],
  accords: ["amber", "woody"],
  topNotes: ["bergamot"],
  middleNotes: ["rose"],
  baseNotes: ["cedar"],
  seasonWeights: { spring: 2, summer: 0, fall: 8, winter: 8 },
  ...extra,
});
const onSale = (item, price) => ({ ...item, sale: { active: true, price } });

const MINIMUM_SPEND = aurelianConfig.box.minPoints * aurelianConfig.commerce.pointValue; // $1,200
const TARGET = aurelianConfig.curatorBonus.targetPoints;
const MIN_SLOTS = aurelianConfig.box.minSelectableSlots;

const summaryOf = (selectedPerfumes, config = aurelianConfig) => buildCollectionSummary({ selectedPerfumes, catalog: selectedPerfumes, notes: {}, config });
const bonusOf = (summary, config = aurelianConfig) =>
  isCuratorBonusUnlocked({
    totalPoints: summary.points.spend,
    totalSlots: summary.counts.selected,
    targetPoints: config.curatorBonus.targetPoints,
    minSlots: config.box.minSelectableSlots,
  });

// Six fragrances at $200 each: exactly the $1,200 minimum at regular prices.
const sixAt200 = () => [1, 2, 3, 4, 5, 6].map((id) => perfume(id, 2));

describe("the configuration this correction rests on", () => {
  it("Aurelian's minimum is $1,200 MXN over six fragrances, and the Curator Bonus uses the same threshold", () => {
    expect(MINIMUM_SPEND).toBe(1200);
    expect(MIN_SLOTS).toBe(6);
    expect(TARGET * aurelianConfig.commerce.pointValue).toBe(1200);
  });
});

describe("box minimum: six fragrances and at least $1,200 MXN actually charged", () => {
  it("(1) a regular box of exactly $1,200 is eligible", () => {
    const summary = summaryOf(sixAt200());

    expect(summary.money.total).toBe(1200);
    expect(summary.readiness).toMatchObject({ hasMinimumSlots: true, hasMinimumPoints: true, isReady: true, blockers: [] });
    expect(summary.points.remaining).toBe(0);
  });

  it("(2) a box worth $1,200 at regular prices that is charged $1,100 is NOT eligible, and the Curator Bonus stays locked", () => {
    const box = [...sixAt200().slice(0, 5), onSale(perfume(6, 2), 100)]; // regular $1,200; charged $1,100

    const summary = summaryOf(box);

    expect(summary.points.total).toBe(12); // the regular value is untouched
    expect(summary.money.regularTotal).toBe(1200);
    expect(summary.money.total).toBe(1100);
    expect(summary.points.spend).toBe(11);
    expect(summary.readiness).toMatchObject({ hasMinimumSlots: true, hasMinimumPoints: false, isReady: false, blockers: ["minimum-points"] });
    expect(summary.points.remaining).toBe(1); // $100 still to spend
    expect(bonusOf(summary)).toBe(false);
  });

  it("(3) a box whose promotional price brings the charge to exactly $1,200 is eligible, and the bonus follows the count rule", () => {
    const box = [...[1, 2, 3, 4, 5].map((id) => perfume(id, 2)), onSale(perfume(6, 3), 200)]; // regular $1,300; charged $1,200

    const summary = summaryOf(box);

    expect(summary.money.total).toBe(1200);
    expect(summary.readiness.isReady).toBe(true);
    expect(bonusOf(summary)).toBe(true);

    // the same $1,200 charged with only five fragrances: the amount is met but the count is not
    const five = [perfume(1, 3), perfume(2, 3), perfume(3, 2), perfume(4, 2), onSale(perfume(5, 3), 200)]; // regular $1,300; charged $1,200
    const fiveSummary = summaryOf(five);

    expect(fiveSummary.money.total).toBe(1200);
    expect(fiveSummary.readiness).toMatchObject({ hasMinimumSlots: false, hasMinimumPoints: true });
    expect(bonusOf(fiveSummary)).toBe(false);
  });

  it("(4) a mixed box is judged on its effective total: regular and promotional fragrances combine", () => {
    // two $300 regular + two $300 fragrances on sale + two $100 regular: $250 each on sale -> $1,300; $150 each -> $1,100
    const above = summaryOf([perfume(1, 3), perfume(2, 3), onSale(perfume(3, 3), 250), onSale(perfume(4, 3), 250), perfume(5, 1), perfume(6, 1)]);
    const below = summaryOf([perfume(1, 3), perfume(2, 3), onSale(perfume(3, 3), 150), onSale(perfume(4, 3), 150), perfume(5, 1), perfume(6, 1)]);

    expect(above.money.regularTotal).toBe(1400);
    expect(above.money.total).toBe(1300);
    expect(above.readiness.hasMinimumPoints).toBe(true);
    expect(below.money.total).toBe(1100);
    expect(below.readiness.hasMinimumPoints).toBe(false);
    expect(below.points.remaining).toBe(1);
    expect(bonusOf(above)).toBe(true);
    expect(bonusOf(below)).toBe(false);
  });

  it("(5) removing the promotion restores eligibility with no migration: the stored box is the same canonical fragrances", () => {
    const withPromotion = [...sixAt200().slice(0, 5), onSale(perfume(6, 2), 100)];
    const afterPromotionEnds = sixAt200(); // the same ids and points: only the sale is gone

    expect(summaryOf(withPromotion).readiness.isReady).toBe(false);
    expect(summaryOf(afterPromotionEnds).readiness.isReady).toBe(true);
    expect(bonusOf(summaryOf(afterPromotionEnds))).toBe(true);
    // an inactive or invalid sale never lowers the charge, so it never withholds eligibility either
    expect(summaryOf([...sixAt200().slice(0, 5), { ...perfume(6, 2), sale: { active: false, price: 100 } }]).readiness.isReady).toBe(true);
    expect(summaryOf([...sixAt200().slice(0, 5), { ...perfume(6, 2), sale: { active: true, price: 250 } }]).readiness.isReady).toBe(true);
  });

  it("with no promotion nothing changes: spend equals the regular value exactly, remaining is the old expression", () => {
    const summary = summaryOf([perfume(1, 2), perfume(2, 2.5)]);

    expect(summary.points.spend).toBe(summary.points.total);
    expect(summary.points.remaining).toBe(Math.max(0, 12 - 4.5));
    expect(summary.money.total).toBe(450);
  });
});

describe("Curator Bonus: reads the effective amount, keeps its two reserved slots", () => {
  it("unlocks at six fragrances and $1,200 charged; locked below either; the reserved slots are untouched", () => {
    expect(aurelianConfig.box.maxSelectableSlots).toBe(14);
    expect(bonusOf(summaryOf(sixAt200()))).toBe(true);
    expect(bonusOf(summaryOf([...sixAt200().slice(0, 5), onSale(perfume(6, 2), 100)]))).toBe(false);
    expect(bonusOf(summaryOf(sixAt200().slice(0, 5)))).toBe(false);
  });

  it("the Panel and the module read the effective spend, and the regular value still feeds display and analytics", () => {
    const panel = read("../../src/components/BuilderPanel.jsx");
    const runtime = read("../../src/BuilderRuntime.jsx");

    expect(panel).toMatch(/deriveCuratorBonusUnlocked\(\{\s*totalPoints: spendPoints,/);
    expect(panel).toContain("spendPoints={spendPoints}");
    expect(panel).toContain("Math.min(spendPoints, DISCOVERY_BONUS_TARGET_POINTS)");
    expect(panel).toContain("const hasRequiredPoints = spendPoints >= DISCOVERY_BONUS_TARGET_POINTS;");
    expect(runtime).toContain("const spendPoints = collectionSummary.points.spend;");
    expect(runtime).toMatch(/isCuratorBonusUnlocked\(\{\s*totalPoints: spendPoints,/);
  });
});

describe("Composer budget: selection feasibility uses effective prices", () => {
  const A = perfume(1, 5); // $500 regular
  const B = perfume(2, 3); // $300
  const C = perfume(3, 3); // $300
  const catalogOf = (...items) => items;
  const propose = (catalog, budget, selected = [B], config = aurelianConfig) =>
    buildComposerBoxProposal({
      selectedPerfumes: selected,
      excludedPerfumeIds: [3],
      strategy: "balanced",
      budget,
      targetSlots: 2,
      minSlots: 2,
      maxSlots: 2,
      seasons: [],
      occasions: [],
      vibes: [],
      catalog,
      notes: {},
      config,
    });

  it("(6) a $500 fragrance on a $400 promotion is affordable with $400 remaining; the same fragrance without it is costed at $500", () => {
    // B ($300) is already chosen; with a $700 budget exactly $400 remains for the second fragrance.
    const promoted = propose(catalogOf(onSale(A, 400), B, C), 700);
    const regular = propose(catalogOf(A, B, C), 700);

    expect(promoted.status).toBe(COMPOSER_BOX_PROPOSAL_STATUSES.COMPLETED);
    expect(promoted.collection.map((item) => item.id).sort()).toEqual([1, 2]);
    expect(promoted.orderTotal).toBe(700); // the amount the customer pays, not $800
    expect(promoted.totalPoints).toBe(7);

    expect(regular.status).not.toBe(COMPOSER_BOX_PROPOSAL_STATUSES.COMPLETED); // $300 + $500 = $800 > $700
  });

  it("a promotion that does not apply (inactive, or priced at or above regular) is costed at the regular price", () => {
    expect(propose(catalogOf({ ...A, sale: { active: false, price: 400 } }, B, C), 700).status).not.toBe(COMPOSER_BOX_PROPOSAL_STATUSES.COMPLETED);
    expect(propose(catalogOf({ ...A, sale: { active: true, price: 500 } }, B, C), 700).status).not.toBe(COMPOSER_BOX_PROPOSAL_STATUSES.COMPLETED);
  });

  it("the proposal applies to the canonical fragrances: the cost projection is transient and never leaks into the catalog", () => {
    const source = onSale(A, 400);
    const proposal = propose(catalogOf(source, B, C), 700);

    expect("composerCostPoints" in source).toBe(false);
    expect(source.points).toBe(5);
    expect(proposal.apply.collectionIds.sort()).toEqual([1, 2]);
  });

  it("the cost accessor: effective points on a valid sale, the regular points otherwise, the very same object when nothing applies", () => {
    const pricing = createCustomerPricing(aurelianConfig);
    const sale = onSale(A, 400);

    expect(getComposerCostPoints(withComposerCost(sale, pricing))).toBe(4);
    expect(withComposerCost(sale, pricing).points).toBe(5); // the regular value is untouched
    expect(withComposerCost(A, pricing)).toBe(A);
    expect(getComposerCostPoints(A)).toBe(5);
  });

  it("the Composer's default and minimum budgets are measured at effective prices too", () => {
    const runtime = read("../../src/BuilderRuntime.jsx");

    expect(runtime).toContain("const composerCatalog = useMemo(");
    expect(runtime).toContain("withComposerCost(perfume, customerPricing)");
    expect(runtime.match(/catalog: composerCatalog,/g)).toHaveLength(3);
    expect(runtime).toContain("getEffectivePoints(perfume)"); // the initial default budget
  });
});

describe("Discovery Decants stays points-based and unchanged", () => {
  it("(7) a sale is ignored: spend equals points, the minimum is on points, the Composer budget on regular points", () => {
    const box = [perfume(1, 2), onSale(perfume(2, 5), 100)];
    const summary = summaryOf(box, discoveryDecantsConfig);

    expect(summary.points.spend).toBe(summary.points.total);
    expect(summary.points.spend).toBe(7);
    expect(summary.money).toMatchObject({ total: 700, savings: 0 });
    expect(createCustomerPricing(discoveryDecantsConfig).getEffectivePoints(onSale(perfume(2, 5), 100))).toBe(5);

    const pricing = createCustomerPricing(discoveryDecantsConfig);
    const sale = onSale(perfume(2, 5), 100);

    expect(withComposerCost(sale, pricing)).toBe(sale); // no projection at all
    expect(getComposerCostPoints(sale)).toBe(5);
  });

  it("the Composer on a points host budgets on regular points even when a record carries a sale", () => {
    const decantsA = onSale(perfume(1, 5), 100);
    const proposal = buildComposerBoxProposal({
      selectedPerfumes: [perfume(2, 3)],
      excludedPerfumeIds: [3],
      strategy: "balanced",
      budget: 700,
      targetSlots: 2,
      minSlots: 2,
      maxSlots: 2,
      catalog: [decantsA, perfume(2, 3), perfume(3, 3)],
      notes: {},
      config: discoveryDecantsConfig,
    });

    expect(proposal.status).not.toBe(COMPOSER_BOX_PROPOSAL_STATUSES.COMPLETED); // 3 + 5 points = $800 > $700
  });
});

describe("(8) Review, WhatsApp and the Collection Card carry the same effective total", () => {
  it("every surface shows the amount the customer pays, never the struck-through regular total", () => {
    const box = [...sixAt200().slice(0, 4), onSale(perfume(5, 3), 250), onSale(perfume(6, 3), 250)]; // regular $1,400; charged $1,300
    const summary = summaryOf(box);

    expect(summary.money.total).toBe(1300);

    const finalization = buildFinalizationModel({
      selectedPerfumes: box,
      totalPoints: summary.points.total,
      estimatedValue: summary.money.total,
      isCollectionReady: summary.readiness.isReady,
      customerInfo: { name: "Ana", city: "Monterrey" },
      curatorBonus: { isUnlocked: bonusOf(summary) },
      config: aurelianConfig,
    });

    expect(finalization.order.monetaryTotal).toBe(1300);
    expect(finalization.message).toContain("Total estimado de la Discovery Box: $1,300 MXN");
    expect(finalization.message).not.toContain("$1,400");

    const card = buildCollectionCardViewModel({
      selectedPerfumes: box,
      totalPoints: summary.points.total,
      estimatedValue: summary.money.total,
      boxSummary: summary.boxSummary,
      coverageSummary: summary.coverageSummary,
      scentDna: {},
      collectionIdentity: {},
      curatorBonus: { isUnlocked: bonusOf(summary) },
      config: aurelianConfig,
      maxSlots: 14,
      maxSelectableSlots: 14,
    });

    expect(JSON.stringify(card)).toContain("$1,300");
    expect(JSON.stringify(card)).not.toContain("$1,400");
  });

  it("a box that no longer meets the minimum under promotion is not ready, so it cannot be ordered", () => {
    const box = [...sixAt200().slice(0, 5), onSale(perfume(6, 2), 100)];
    const summary = summaryOf(box);

    expect(summary.readiness.isReady).toBe(false);
    expect(summary.money.total).toBe(1100);
  });
});
