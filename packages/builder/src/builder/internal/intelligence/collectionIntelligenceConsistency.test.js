import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { fragrances, notes } from "@discovery-box/catalog";

import { buildBoxSummary } from "../../../utils/buildBoxSummary.js";
import { buildCoverageSummary } from "../../../utils/buildCoverageSummary.js";
import { buildScentDna } from "../../../utils/buildScentDna.js";
import { buildSeasonProfileViewModel } from "../../presentation/seasonProfileViewModel.js";
import { buildCollectionCardProfileTraits, buildCollectionCardViewModel } from "../collectionCard/buildCollectionCardViewModel.js";
import { computePerfumeSimilarity } from "../recommendations/buildAffinityRecommendations.js";
import { buildCollectionIntelligenceViewModel } from "./buildCollectionIntelligenceViewModel.js";
import { buildCollectionMetrics } from "./collectionMetrics.js";

// ---- real boxes -----------------------------------------------------------------------------------------

const SEASONS = ["spring", "summer", "fall", "winter"];
const FRESH_SIGNALS = (perfume) =>
  perfume.vibes.filter((vibe) => ["fresh", "clean"].includes(vibe)).length +
  perfume.accords.filter((accord) => ["fresh", "citrus", "marine", "aquatic", "green"].includes(accord)).length;
const WARM_SIGNALS = (perfume) =>
  perfume.vibes.filter((vibe) => ["warm", "cozy", "seductive", "dark"].includes(vibe)).length +
  perfume.accords.filter((accord) => ["amber", "warm spicy", "smoky", "leather", "tobacco", "vanilla"].includes(accord)).length;

function nearest(seed, count, exclude = []) {
  return fragrances
    .filter((perfume) => perfume.id !== seed.id && !exclude.includes(perfume.id))
    .map((perfume) => ({ perfume, similarity: computePerfumeSimilarity(perfume, seed).similarity }))
    .sort((a, b) => b.similarity - a.similarity || a.perfume.id - b.perfume.id)
    .slice(0, count)
    .map(({ perfume }) => perfume);
}

const byScore = (score) => (a, b) => score(b) - score(a) || a.id - b.id;
const freshSeed = [...fragrances].sort(byScore((p) => FRESH_SIGNALS(p) + p.seasonWeights.summer * 0.3))[0];
const darkSeed = [...fragrances].sort(byScore((p) => WARM_SIGNALS(p) + p.seasonWeights.winter * 0.3))[0];

function peakOf(season, count, used) {
  return fragrances
    .filter(
      (perfume) =>
        !used.has(perfume.id) &&
        SEASONS.every((other) => other === season || perfume.seasonWeights[other] <= perfume.seasonWeights[season] - 1)
    )
    .sort(byScore((p) => p.seasonWeights[season]))
    .slice(0, count);
}

function balancedBox() {
  const used = new Set();

  return SEASONS.flatMap((season) => {
    const picked = peakOf(season, 2, used);
    picked.forEach((perfume) => used.add(perfume.id));

    return picked;
  });
}

const adg = fragrances.find((perfume) => perfume.id === 1);
const archetypes = {
  A: { name: "fresh Spring/Summer specialist", box: [freshSeed, ...nearest(freshSeed, 7)] },
  B: { name: "dark Fall/Winter specialist", box: [darkSeed, ...nearest(darkSeed, 7)] },
  C: { name: "balanced four-season box", box: balancedBox() },
  D: { name: "mostly fresh + one dark outlier", box: [freshSeed, ...nearest(freshSeed, 6), darkSeed] },
  E: { name: "small 6-fragrance specialist", box: [freshSeed, ...nearest(freshSeed, 5)] },
  F: { name: "large 12-fragrance box, same profile", box: [freshSeed, ...nearest(freshSeed, 11)] },
  G: {
    name: "mixed everyday / formal",
    box: [
      ...fragrances.filter((p) => p.occasions.includes("office") && p.vibes.includes("fresh")).slice(0, 3),
      ...fragrances.filter((p) => p.occasions.includes("formal")).slice(0, 3),
      ...fragrances.filter((p) => p.occasions.includes("date") && p.occasions.includes("night")).slice(0, 2),
    ].filter((perfume, index, all) => all.findIndex((other) => other.id === perfume.id) === index),
  },
  H: { name: "highly repetitive box", box: [adg, ...nearest(adg, 7)] },
};

const cardConfig = {
  brand: { businessName: "Test" },
  commerce: { currency: "MXN" },
  collectionCard: {
    brandHeading: "TEST",
    filenamePrefix: "test",
    ariaLabel: "card",
    boxAriaLabel: "box",
    footer: "footer",
    curatorBonusIncludedLabel: "included",
    curatorBonusAvailableLabel: "available",
    curatorBonusUnlockedCopy: "unlocked",
    curatorBonusLockedCopy: "locked",
    shareTitle: "share",
    shareText: "share",
  },
};

// everything the surfaces say about one box
function analyze(box) {
  const boxSummary = buildBoxSummary(box, notes);
  const coverageSummary = buildCoverageSummary(boxSummary, fragrances);
  const scentDna = buildScentDna(box, boxSummary);
  const intelligence = buildCollectionIntelligenceViewModel({
    selectedPerfumes: box,
    catalog: fragrances,
    collectionSummary: boxSummary,
    coverageSummary,
    scentDna,
    recommendations: {},
    curatorBonus: {},
    config: {},
  });
  const card = buildCollectionCardViewModel({
    selectedPerfumes: box,
    totalPoints: 0,
    estimatedValue: 0,
    boxSummary,
    coverageSummary,
    scentDna,
    collectionIdentity: { title: "t" },
    curatorBonus: {},
    config: cardConfig,
    maxSlots: 16,
    maxSelectableSlots: 14,
  });
  const metrics = buildCollectionMetrics({ selectedPerfumes: box, boxSummary });
  const radar = buildSeasonProfileViewModel({ seasonRows: intelligence.seasons.rows });

  return { box, boxSummary, coverageSummary, scentDna, intelligence, card, metrics, radar };
}

const rowFor = (analysis, label) => analysis.intelligence.balance.rows.find((row) => row.label === label);
const traitsOf = (analysis) => analysis.intelligence.profile.traits;
const seasonLabels = (analysis) =>
  Object.fromEntries(
    analysis.coverageSummary.strengths.filter(({ category }) => category === "seasons").map(({ target, level }) => [target, level])
  );

// ---- the archetype matrix -------------------------------------------------------------------------------

describe("Collection Intelligence archetypes (real catalog)", () => {
  const results = Object.fromEntries(Object.entries(archetypes).map(([key, { box }]) => [key, analyze(box)]));

  it("builds every archetype box from the catalog", () => {
    Object.entries(archetypes).forEach(([key, { box }]) => expect(box.length, key).toBeGreaterThanOrEqual(6));
  });

  it("A. a fresh Spring/Summer specialist is not balanced: 1 star, a winter gap, and every surface says specialist", () => {
    const a = results.A;

    expect(rowFor(a, "Season Balance").level).toBe(1);
    expect(rowFor(a, "Freshness").level).toBeGreaterThanOrEqual(4);
    expect(traitsOf(a)).toEqual(expect.arrayContaining(["Spring/Summer Specialist", "Fresh-Leaning"]));
    expect(traitsOf(a)).not.toContain("Balanced Rotation");
    expect(a.radar.summary.label).toMatch(/^Leans /);
    expect(a.coverageSummary.gaps.map(({ target }) => target)).toContain("winter");
    expect(a.intelligence.boxIntelligence.mainGap).toEqual({ type: "winter", label: "Limited winter depth" });
    expect(a.intelligence.boxIntelligence.dominantProfile).toBe("Fresh-heavy");
  });

  it("B. a dark Fall/Winter specialist mirrors it: 1 star, a summer gap, warm lean", () => {
    const b = results.B;

    expect(rowFor(b, "Season Balance").level).toBe(1);
    expect(rowFor(b, "Freshness").level).toBe(1);
    expect(traitsOf(b)).toEqual(expect.arrayContaining(["Fall/Winter Specialist", "Warm-Leaning"]));
    expect(traitsOf(b)).not.toContain("Spring/Summer Specialist");
    expect(b.coverageSummary.gaps.map(({ target }) => target)).toContain("summer");
    expect(b.intelligence.boxIntelligence.mainGap.type).toBe("summer");
    expect(b.intelligence.boxIntelligence.dominantProfile).toBe("Warm and evening-oriented");
  });

  it("C. a balanced four-season box is called balanced everywhere, with no season gaps and no specialist chip", () => {
    const c = results.C;

    expect(rowFor(c, "Season Balance").level).toBeGreaterThanOrEqual(4);
    expect(traitsOf(c)[0]).toBe("Balanced Rotation");
    expect(traitsOf(c).filter((trait) => /Specialist/.test(trait))).toEqual([]);
    expect(c.radar.summary.label).toMatch(/alanced|Equilibr|temporadas/i);
    expect(c.coverageSummary.gaps).toEqual([]);
    expect(c.intelligence.boxIntelligence.dominantProfile).toBe("Balanced and versatile");
    expect(rowFor(c, "Versatility").level).toBeGreaterThanOrEqual(4);
  });

  it("D. one dark outlier in a fresh box helps a little, but the box is still a Spring/Summer specialist", () => {
    const [a, d] = [results.A, results.D];

    expect(rowFor(d, "Season Balance").score).toBeGreaterThan(rowFor(a, "Season Balance").score);
    expect(rowFor(d, "Season Balance").score - rowFor(a, "Season Balance").score).toBeLessThanOrEqual(25);
    expect(rowFor(d, "Season Balance").level).toBeLessThanOrEqual(2);
    expect(traitsOf(d)).toContain("Spring/Summer Specialist");
    expect(traitsOf(d)).not.toContain("Balanced Rotation");
  });

  it("E/F. the same profile in 6 and in 12 fragrances reads the same: seasonal evidence, gaps, season labels and chips", () => {
    const [e, f] = [results.E, results.F];

    SEASONS.forEach((season) =>
      expect(Math.abs(e.metrics.seasonal.levels[season] - f.metrics.seasonal.levels[season]), season).toBeLessThanOrEqual(6)
    );
    expect(Math.abs(rowFor(e, "Season Balance").level - rowFor(f, "Season Balance").level)).toBeLessThanOrEqual(1);
    expect(e.coverageSummary.gaps.map(({ target }) => target)).toEqual(f.coverageSummary.gaps.map(({ target }) => target));
    expect(seasonLabels(e)).toEqual(seasonLabels(f));
    ["Spring/Summer Specialist", "Fresh-Leaning", "Balanced Rotation"].forEach((trait) =>
      expect(traitsOf(e).includes(trait), trait).toBe(traitsOf(f).includes(trait))
    );
    // box size must not inflate the coherence of a signature
    expect(Math.abs(rowFor(e, "Signature Coherence").score - rowFor(f, "Signature Coherence").score)).toBeLessThanOrEqual(15);
  });

  it("G. a mixed everyday / formal box with seasons spread across the year is balanced", () => {
    expect(rowFor(results.G, "Season Balance").level).toBeGreaterThanOrEqual(4);
    expect(traitsOf(results.G)).toContain("Balanced Rotation");
  });

  it("H. a highly repetitive box has a strong signature but little versatility; the balanced box is the reverse", () => {
    const [c, h] = [results.C, results.H];

    expect(rowFor(h, "Signature Coherence").level).toBeGreaterThanOrEqual(4);
    expect(traitsOf(h)).toContain("Coherent Signature");
    expect(rowFor(h, "Versatility").level).toBeLessThanOrEqual(2);
    expect(rowFor(c, "Signature Coherence").level).toBeLessThanOrEqual(2);
    expect(rowFor(c, "Versatility").level).toBeGreaterThan(rowFor(h, "Versatility").level);
  });
});

// ---- the profile-trait type bug --------------------------------------------------------------------------

describe("profile traits are computed from numbers (regression: accord arrays were added as counts)", () => {
  const fresh = analyze(archetypes.A.box);
  const warm = analyze(archetypes.B.box);
  const mixed = analyze(archetypes.G.box);

  it("reads fresh/warm evidence as finite numbers, never as concatenated strings", () => {
    [fresh, warm, mixed].forEach(({ metrics }) => {
      expect(typeof metrics.profile.freshness).toBe("number");
      expect(Number.isFinite(metrics.profile.freshness)).toBe(true);
      expect(Number.isFinite(metrics.profile.warmth)).toBe(true);
      expect(["fresh", "warm", "mixed"]).toContain(metrics.profile.lean);
    });
  });

  it("a strongly fresh box leans fresh, a strongly warm box leans warm, a mixed box neither", () => {
    expect(traitsOf(fresh)).toContain("Fresh-Leaning");
    expect(traitsOf(fresh)).not.toContain("Warm-Leaning");
    expect(traitsOf(warm)).toContain("Warm-Leaning");
    expect(traitsOf(warm)).not.toContain("Fresh-Leaning");
    expect(traitsOf(mixed)).not.toContain("Fresh-Leaning");
    expect(traitsOf(mixed)).not.toContain("Warm-Leaning");
  });

  it("does not depend on how the accord map is stored (names per accord, or counts)", () => {
    const withNames = buildCollectionCardProfileTraits({
      selectedPerfumes: archetypes.A.box,
      boxSummary: fresh.boxSummary,
      coverageSummary: fresh.coverageSummary,
    });
    const withCounts = buildCollectionCardProfileTraits({
      selectedPerfumes: archetypes.A.box,
      boxSummary: {
        ...fresh.boxSummary,
        accordCounts: Object.fromEntries(Object.entries(fresh.boxSummary.accordMap).map(([accord, names]) => [accord, names.length])),
      },
      coverageSummary: fresh.coverageSummary,
    });

    expect(withNames).toEqual(withCounts);
    expect(withNames).toContain("Fresh-Leaning");
  });
});

// ---- the stars use their range ---------------------------------------------------------------------------

function seededBoxes(seed, count) {
  let state = seed;
  const random = () => (state = (state * 1664525 + 1013904223) % 4294967296) / 4294967296;
  const boxes = [];

  for (let index = 0; index < count; index += 1) {
    const size = 4 + Math.floor(random() * 9);
    const cohesive = index % 2 === 1;
    const first = fragrances[Math.floor(random() * fragrances.length)];
    const picked = cohesive ? [first, ...nearest(first, size - 1 - Math.floor(random() * 3))] : [first];

    while (picked.length < size) {
      const next = fragrances[Math.floor(random() * fragrances.length)];
      if (!picked.some((perfume) => perfume.id === next.id)) picked.push(next);
    }

    boxes.push(picked);
  }

  return boxes;
}

describe("star distribution over realistic boxes (random and cohesive, seeded)", () => {
  const boxes = seededBoxes(20260711, 240);
  const analyses = boxes.map(analyze);
  const keys = {
    Versatility: "versatility",
    Breadth: "breadth",
    Freshness: "freshness",
    "Season Balance": "seasonBalance",
    "Signature Coherence": "signature",
  };
  const distribution = (label) => {
    const counts = [0, 0, 0, 0, 0, 0];
    analyses.forEach((analysis) => counts[rowFor(analysis, label).level] += 1);

    return counts.map((count) => count / analyses.length);
  };

  Object.keys(keys).forEach((label) => {
    it(`${label}: spreads over the range instead of saturating (old: 90-99% of boxes at 4-5 stars)`, () => {
      const shares = distribution(label);
      const top = shares[4] + shares[5];

      expect(top, "share at 4-5 stars").toBeLessThanOrEqual(0.6);
      expect(Math.max(...shares), "no single rating holds the majority").toBeLessThan(0.5);
      expect(shares.slice(1).filter((share) => share >= 0.05).length, "distinct ratings in use").toBeGreaterThanOrEqual(4);
    });
  });

  it("no non-empty box ever shows 0 stars (Signature needs 3 fragrances, and every box here has 4 or more)", () => {
    analyses.forEach((analysis) =>
      analysis.intelligence.balance.rows.forEach((row) => expect(row.level, row.label).toBeGreaterThanOrEqual(1))
    );
  });

  it("scores are whole numbers from 0 to 100", () => {
    analyses.forEach(({ metrics }) =>
      Object.values(metrics.scores).forEach((score) => {
        expect(Number.isInteger(score)).toBe(true);
        expect(score).toBeGreaterThanOrEqual(0);
        expect(score).toBeLessThanOrEqual(100);
      })
    );
  });

  it("Versatility barely moves when one fragrance carries two extra stray tags (an occasion and a vibe)", () => {
    const sample = boxes.slice(0, 40);
    const jumps = sample.map((box) => {
      const stray = { ...box[0], occasions: [...box[0].occasions, "vacation"], vibes: [...box[0].vibes, "tropical"] };
      const change = [stray, ...box.slice(1)];

      return Math.abs(
        buildCollectionMetrics({ selectedPerfumes: change, boxSummary: buildBoxSummary(change, notes) }).scores.versatility -
          buildCollectionMetrics({ selectedPerfumes: box, boxSummary: buildBoxSummary(box, notes) }).scores.versatility
      );
    });

    // The old formula paid a fixed 3.5-4.5 points for EACH new tag but sat at 4-5 stars regardless. Now the same two
    // new categories shift the score by about 6 points (about a third of a star) and by 15 at the very most, in a
    // 4-fragrance box where one fragrance is a quarter of the box.
    const sorted = [...jumps].sort((a, b) => a - b);

    expect(sorted[Math.floor(sorted.length / 2)]).toBeLessThanOrEqual(8);
    expect(Math.max(...jumps)).toBeLessThanOrEqual(15);
  });
});

// ---- every surface agrees --------------------------------------------------------------------------------

describe("cross-surface consistency (same box, same story)", () => {
  const analyses = [...seededBoxes(777, 160), ...Object.values(archetypes).map(({ box }) => box)].map(analyze);

  it("the radar says 'balanced' exactly when Season Balance is 4-5 stars", () => {
    analyses.forEach((analysis) => {
      const balancedText = analysis.metrics.seasonal.shape.kind === "balanced";

      expect(balancedText).toBe(rowFor(analysis, "Season Balance").level >= 4);
      expect(analysis.radar.summary.label === buildSeasonProfileViewModel({ seasonRows: analysis.intelligence.seasons.rows }).summary.label).toBe(true);
    });
  });

  it("a box balanced across the seasons is never also a seasonal specialist, and never has a season gap", () => {
    analyses
      .filter((analysis) => analysis.metrics.seasonal.isBalanced)
      .forEach((analysis) => {
        expect(traitsOf(analysis).filter((trait) => /Specialist/.test(trait))).toEqual([]);
        expect(analysis.coverageSummary.gaps).toEqual([]);
      });
  });

  it("a seasonal specialist chip is the radar's own sentence: it appears exactly when the radar leans only on those seasons", () => {
    analyses.forEach((analysis) => {
      const label = analysis.radar.summary.label;
      const coolOnly = /^Leans (Spring|Summer)( and (Spring|Summer))?$/.test(label);
      const warmOnly = /^Leans (Fall|Winter)( and (Fall|Winter))?$/.test(label);

      expect(traitsOf(analysis).includes("Spring/Summer Specialist"), label).toBe(coolOnly);
      expect(traitsOf(analysis).includes("Fall/Winter Specialist"), label).toBe(warmOnly);
    });
    // and both kinds really occur in the sample, so the check is not vacuous
    expect(analyses.some((analysis) => traitsOf(analysis).includes("Spring/Summer Specialist"))).toBe(true);
    expect(analyses.some((analysis) => traitsOf(analysis).includes("Fall/Winter Specialist"))).toBe(true);
  });

  it("the season gaps, the season strengths and the stars all come from the same levels", () => {
    analyses.forEach((analysis) => {
      const { levels, bands, gaps } = analysis.metrics.seasonal;

      expect(analysis.coverageSummary.gaps.map(({ target }) => target).sort()).toEqual([...gaps].sort());
      expect(analysis.intelligence.seasons.rows.map(({ percent }) => percent)).toEqual(SEASONS.map((season) => levels[season]));
      SEASONS.forEach((season) => {
        const label = seasonLabels(analysis)[season];
        expect(label ?? "gap", season).toBe(bands[season]);
      });
    });
  });

  it("Box Intelligence names a season gap whenever the coverage list has one", () => {
    analyses
      .filter((analysis) => analysis.coverageSummary.gaps.length > 0 && analysis.box.length >= 3)
      .forEach((analysis) => {
        const weakest = analysis.metrics.seasonal.gaps[0];
        const { mainGap } = analysis.intelligence.boxIntelligence;

        expect(mainGap.type, `weakest season ${weakest}`).toBe(weakest === "fall" || weakest === "winter" ? "winter" : "summer");
      });
  });

  it("the chip 'Balanced Rotation' and the Box Intelligence 'Balanced and versatile' are the same statement", () => {
    analyses
      .filter((analysis) => analysis.box.length >= 4)
      .forEach((analysis) => {
        expect(traitsOf(analysis).includes("Balanced Rotation")).toBe(
          analysis.intelligence.boxIntelligence.dominantProfile === "Balanced and versatile"
        );
      });
  });

  it("the Fresh-Leaning / Warm-Leaning chips and the Box Intelligence profile agree (unless the box is balanced)", () => {
    analyses
      .filter((analysis) => !analysis.metrics.profile.isBalancedRotation)
      .forEach((analysis) => {
        const { dominantProfile } = analysis.intelligence.boxIntelligence;

        expect(traitsOf(analysis).includes("Fresh-Leaning")).toBe(dominantProfile === "Fresh-heavy");
        expect(traitsOf(analysis).includes("Warm-Leaning")).toBe(dominantProfile === "Warm and evening-oriented");
      });
  });

  it("'Balanced and versatile' is only said of a box that really is balanced", () => {
    analyses.forEach((analysis) => {
      if (analysis.intelligence.boxIntelligence.dominantProfile === "Balanced and versatile") {
        expect(analysis.metrics.profile.isBalancedRotation).toBe(true);
      }
    });
  });

  it("the exported Collection Card carries the same profile traits as Collection Intelligence", () => {
    analyses.forEach((analysis) => {
      expect(analysis.card.cardProps.profileTraits).toEqual(traitsOf(analysis).slice(0, 3));
      expect(analysis.card.coverage.seasons).toEqual(analysis.intelligence.seasons.rows);
    });
  });

  it("an empty box reads as empty everywhere", () => {
    const empty = analyze([]);

    expect(empty.metrics.seasonal.isEmpty).toBe(true);
    expect(empty.intelligence.balance.rows.map(({ level }) => level)).toEqual([0, 0, 0, 0, 0]);
    expect(empty.intelligence.profile.traits).toEqual([]);
    expect(empty.radar.isEmpty).toBe(true);
  });
});

// ---- boundaries ------------------------------------------------------------------------------------------

describe("boundaries", () => {
  const here = fileURLToPath(new URL(".", import.meta.url));
  const read = (...segments) => readFileSync(join(here, ...segments), "utf8");

  it("the Composer's inputs are untouched: it reads scentDna, never the presentation metrics", () => {
    const composerDirectory = join(here, "..", "composer");
    const sources = readdirSync(composerDirectory)
      .filter((file) => file.endsWith(".js") && !file.endsWith(".test.js"))
      .map((file) => readFileSync(join(composerDirectory, file), "utf8"));

    sources.forEach((source) => expect(source).not.toMatch(/collectionMetrics|seasonalEvidence/));
    expect(readFileSync(join(here, "..", "..", "..", "utils", "buildScentDna.js"), "utf8")).not.toMatch(/collectionMetrics|seasonalEvidence/);
  });

  it("the shared metrics carry no merchant vocabulary", () => {
    ["collectionMetrics.js", "seasonalEvidence.js"].forEach((file) =>
      expect(read(file), file).not.toMatch(/aurelian|discovery decants|discovery-decants|merchant/i)
    );
  });
});
