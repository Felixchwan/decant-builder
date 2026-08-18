import { describe, expect, it } from "vitest";

import { buildCollectionSummary } from "./buildCollectionSummary.js";
import { buildScentDna } from "../../../utils/buildScentDna.js";
import {
  getCollectionIdentityCandidates,
  getCollectionIdentityProfile,
} from "../../../utils/collectionIdentityEngine.js";

const notes = {
  bergamot: { name: "Bergamot" },
  cedar: { name: "Cedar" },
  iris: { name: "Iris" },
  amber: { name: "Amber" },
  vetiver: { name: "Vetiver" },
  vanilla: { name: "Vanilla" },
  mint: { name: "Mint" },
  lemon: { name: "Lemon" },
  leather: { name: "Leather" },
  basil: { name: "Basil" },
  marine: { name: "Marine Accord" },
};

const baseConfig = {
  box: {
    minSelectableSlots: 3,
    maxSelectableSlots: 5,
    minPoints: 6,
  },
  commerce: {
    pointValue: 100,
    currency: "MXN",
  },
};

const goldenConfig = {
  box: {
    minSelectableSlots: 3,
    maxSelectableSlots: 14,
    minPoints: 6,
  },
  commerce: {
    pointValue: 95,
    currency: "MXN",
  },
};

const fixtures = {
  fresh: {
    id: "fresh-anchor",
    name: "Fresh Anchor",
    points: 2.5,
    occasions: ["daily", "office", "casual"],
    seasons: ["spring", "summer"],
    vibes: ["fresh", "clean", "versatile"],
    accords: ["citrus", "aromatic"],
    topNotes: ["bergamot", "mint"],
    baseNotes: ["cedar"],
    seasonWeights: { spring: 10, summer: 8, fall: 0, winter: 0 },
  },
  woody: {
    id: "woody-office",
    name: "Woody Office",
    points: 2,
    occasions: ["office", "formal", "daily"],
    seasons: ["spring", "fall"],
    vibes: ["elegant", "clean"],
    accords: ["woody", "iris"],
    middleNotes: ["iris"],
    baseNotes: ["vetiver", "cedar"],
    seasonWeights: { spring: 6, summer: 0, fall: 8, winter: 2 },
  },
  warm: {
    id: "amber-night",
    name: "Amber Night",
    points: 1.75,
    occasions: ["date", "night"],
    seasons: ["fall", "winter"],
    vibes: ["warm", "seductive", "bold"],
    accords: ["amber", "vanilla", "warm spicy"],
    baseNotes: ["amber", "vanilla"],
    seasonWeights: { spring: 0, summer: 0, fall: 8, winter: 10 },
  },
  citrus: {
    id: "summer-spark",
    name: "Summer Spark",
    points: 1.25,
    occasions: ["casual", "daily"],
    seasons: ["summer"],
    vibes: ["fresh", "clean"],
    accords: ["citrus", "fresh"],
    topNotes: ["lemon", "bergamot"],
    seasonWeights: { spring: 3, summer: 10, fall: 0, winter: 0 },
  },
  formal: {
    id: "executive-woods",
    name: "Executive Woods",
    points: 3,
    occasions: ["office", "formal"],
    seasons: ["fall", "winter"],
    vibes: ["elegant", "classic"],
    accords: ["woody", "powdery"],
    middleNotes: ["iris"],
    baseNotes: ["cedar"],
    seasonWeights: { spring: 2, summer: 0, fall: 8, winter: 8 },
  },
  green: {
    id: "green-terrace",
    name: "Green Terrace",
    points: 1.5,
    occasions: ["daily", "casual"],
    seasons: ["spring", "summer"],
    vibes: ["fresh", "green"],
    accords: ["green", "aromatic"],
    topNotes: ["basil", "lemon"],
    seasonWeights: { spring: 9, summer: 7, fall: 1, winter: 0 },
  },
  marine: {
    id: "marine-shirt",
    name: "Marine Shirt",
    points: 1,
    occasions: ["office", "casual"],
    seasons: ["summer"],
    vibes: ["fresh", "clean"],
    accords: ["aquatic", "marine", "citrus"],
    topNotes: ["marine", "bergamot"],
    seasonWeights: { spring: 2, summer: 10, fall: 0, winter: 0 },
  },
  leather: {
    id: "leather-afterdark",
    name: "Leather Afterdark",
    points: 2.25,
    occasions: ["date", "night", "formal"],
    seasons: ["fall", "winter"],
    vibes: ["dark", "bold", "seductive"],
    accords: ["leather", "smoky", "amber"],
    baseNotes: ["leather", "amber"],
    seasonWeights: { spring: 0, summer: 0, fall: 9, winter: 9 },
  },
};

const catalog = Object.values(fixtures);

function summarize(selectedPerfumes, overrides = {}) {
  return buildCollectionSummary({
    selectedPerfumes,
    catalog: overrides.catalog ?? catalog,
    notes: overrides.notes ?? notes,
    config: overrides.config ?? baseConfig,
  });
}

function identityFrom(summary) {
  return getCollectionIdentityProfile(summary.boxSummary);
}

function candidatesFrom(summary) {
  return getCollectionIdentityCandidates(summary.boxSummary).map(
    (candidate) => candidate.title
  );
}

function dnaFrom(summary) {
  return buildScentDna(summary.selectedPerfumes, summary.boxSummary);
}

function deepFreeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    Object.values(value).forEach(deepFreeze);
  }

  return value;
}

describe("buildCollectionSummary", () => {
  it("summarizes an empty collection with fallback coverage, DNA, and identity", () => {
    const selectedPerfumes = [];
    const summary = summarize(selectedPerfumes);

    expect(summary.selectedPerfumes).toBe(selectedPerfumes);
    expect(summary.selectedIds).toEqual([]);
    expect(summary.counts).toEqual({
      selected: 0,
      minimum: 3,
      maximum: 5,
      remaining: 5,
      minimumRemaining: 3,
    });
    expect(summary.points).toEqual({ total: 0, minimum: 6, remaining: 6 });
    expect(summary.money).toEqual({
      pointValue: 100,
      total: 0,
      currency: "MXN",
    });
    expect(summary.readiness).toEqual({
      hasMinimumSlots: false,
      hasMinimumPoints: false,
      isReady: false,
      blockers: ["minimum-slots", "minimum-points"],
    });
    expect(summary.boxSummary).toEqual({
      occasions: [],
      seasons: [],
      notes: [],
      vibes: [],
      accordMap: {},
      occasionCounts: {},
      seasonCounts: {},
      seasonStrengths: { spring: 0, summer: 0, fall: 0, winter: 0 },
      vibeCounts: {},
    });
    expect(summary.coverageSummary.gaps.map((gap) => gap.label)).toEqual([
      "Spring fragrance recommended",
      "Summer fragrance recommended",
      "Fall fragrance recommended",
      "Winter fragrance recommended",
    ]);
    expect(dnaFrom(summary)).toEqual({
      scores: { versatility: 0, depth: 0, seasonBalance: 0 },
      topAccords: [],
      topVibes: [],
      seasonCoverage: [
        { label: "spring", count: 0, percent: 0 },
        { label: "summer", count: 0, percent: 0 },
        { label: "fall", count: 0, percent: 0 },
        { label: "winter", count: 0, percent: 0 },
      ],
    });
    expect(identityFrom(summary)).toEqual({
      id: "in-progress",
      title: "Collection In Progress",
      subtitle: "A curated fragrance story begins with the first selection.",
      mood: ["First impression", "Open canvas", "Curator's table"],
      palette: "balanced",
      archetype: "in-progress",
    });
  });

  it("summarizes one perfume below both readiness minimums", () => {
    const summary = summarize([fixtures.fresh]);

    expect(summary.selectedIds).toEqual(["fresh-anchor"]);
    expect(summary.counts).toEqual({
      selected: 1,
      minimum: 3,
      maximum: 5,
      remaining: 4,
      minimumRemaining: 2,
    });
    expect(summary.points).toEqual({ total: 2.5, minimum: 6, remaining: 3.5 });
    expect(summary.money.total).toBe(250);
    expect(summary.readiness).toEqual({
      hasMinimumSlots: false,
      hasMinimumPoints: false,
      isReady: false,
      blockers: ["minimum-slots", "minimum-points"],
    });
    expect(summary.boxSummary).toMatchObject({
      occasions: ["daily", "office", "casual"],
      seasons: ["spring", "summer"],
      notes: ["Bergamot", "Mint", "Cedar"],
      vibes: ["fresh", "clean", "versatile"],
      accordMap: {
        citrus: ["Fresh Anchor"],
        aromatic: ["Fresh Anchor"],
      },
      seasonStrengths: { spring: 10, summer: 8, fall: 0, winter: 0 },
    });
    expect(summary.coverageSummary.strengths).toEqual([
      { category: "occasions", target: "daily", label: "Daily Covered", level: "covered", count: 1 },
      { category: "occasions", target: "office", label: "Office Covered", level: "covered", count: 1 },
      { category: "occasions", target: "casual", label: "Casual Covered", level: "covered", count: 1 },
      { category: "seasons", target: "spring", label: "Spring Covered", level: "covered", count: 10 },
      { category: "seasons", target: "summer", label: "Summer Covered", level: "covered", count: 8 },
      { category: "vibes", target: "fresh", label: "Fresh Covered", level: "covered", count: 1 },
      { category: "vibes", target: "clean", label: "Clean Covered", level: "covered", count: 1 },
      { category: "vibes", target: "versatile", label: "Versatile Covered", level: "covered", count: 1 },
    ]);
    expect(dnaFrom(summary)).toMatchObject({
      scores: { versatility: 40, depth: 25, seasonBalance: 23 },
      topAccords: [
        { label: "aromatic", count: 1, percent: 100 },
        { label: "citrus", count: 1, percent: 100 },
      ],
      topVibes: [
        { label: "clean", count: 1, percent: 100 },
        { label: "fresh", count: 1, percent: 100 },
        { label: "versatile", count: 1, percent: 100 },
      ],
    });
    expect(identityFrom(summary).title).toBe("Fresh Daily Rotation");
  });

  it("preserves selected perfume order and exposes the original references", () => {
    const selectedPerfumes = [fixtures.warm, fixtures.fresh, fixtures.woody];
    const summary = summarize(selectedPerfumes);

    expect(summary.selectedPerfumes).toBe(selectedPerfumes);
    expect(summary.selectedPerfumes).toEqual([
      fixtures.warm,
      fixtures.fresh,
      fixtures.woody,
    ]);
    expect(summary.selectedPerfumes[0]).toBe(fixtures.warm);
    expect(summary.selectedIds).toEqual([
      "amber-night",
      "fresh-anchor",
      "woody-office",
    ]);
  });

  it("combines integer and decimal points into exact totals and remaining slots", () => {
    const summary = summarize([
      fixtures.fresh,
      fixtures.woody,
      fixtures.warm,
      fixtures.citrus,
      fixtures.formal,
    ]);

    expect(summary.counts).toEqual({
      selected: 5,
      minimum: 3,
      maximum: 5,
      remaining: 0,
      minimumRemaining: 0,
    });
    expect(summary.points).toEqual({ total: 10.5, minimum: 6, remaining: 0 });
    expect(summary.money).toEqual({
      pointValue: 100,
      total: 1050,
      currency: "MXN",
    });
    expect(summary.selectedIds).toEqual([
      "fresh-anchor",
      "woody-office",
      "amber-night",
      "summer-spark",
      "executive-woods",
    ]);
  });

  it("characterizes every readiness boundary including above maximum", () => {
    const belowMinimum = summarize([fixtures.fresh, fixtures.woody]);
    const exactMinimum = summarize([fixtures.fresh, fixtures.woody, fixtures.warm]);
    const aboveMinimum = summarize([
      fixtures.fresh,
      fixtures.woody,
      fixtures.warm,
      fixtures.citrus,
    ]);
    const exactMaximum = summarize([
      fixtures.fresh,
      fixtures.woody,
      fixtures.warm,
      fixtures.citrus,
      fixtures.formal,
    ]);
    const aboveMaximum = summarize([
      fixtures.fresh,
      fixtures.woody,
      fixtures.warm,
      fixtures.citrus,
      fixtures.formal,
      fixtures.green,
    ]);

    expect(belowMinimum.readiness).toEqual({
      hasMinimumSlots: false,
      hasMinimumPoints: false,
      isReady: false,
      blockers: ["minimum-slots", "minimum-points"],
    });
    expect(belowMinimum.counts).toMatchObject({
      selected: 2,
      remaining: 3,
      minimumRemaining: 1,
    });
    expect(belowMinimum.points).toEqual({
      total: 4.5,
      minimum: 6,
      remaining: 1.5,
    });

    [exactMinimum, aboveMinimum, exactMaximum, aboveMaximum].forEach((summary) => {
      expect(summary.readiness).toEqual({
        hasMinimumSlots: true,
        hasMinimumPoints: true,
        isReady: true,
        blockers: [],
      });
    });
    expect(exactMinimum.counts).toMatchObject({ selected: 3, remaining: 2 });
    expect(aboveMinimum.counts).toMatchObject({ selected: 4, remaining: 1 });
    expect(exactMaximum.counts).toMatchObject({ selected: 5, remaining: 0 });
    expect(aboveMaximum.counts).toMatchObject({ selected: 6, remaining: 0 });
  });

  it("uses the configured point value and currency for order total", () => {
    const summary = summarize([fixtures.fresh, fixtures.warm], {
      config: {
        ...baseConfig,
        commerce: { pointValue: 80, currency: "USD" },
      },
    });

    expect(summary.points.total).toBe(4.25);
    expect(summary.money).toEqual({
      pointValue: 80,
      total: 340,
      currency: "USD",
    });
  });

  it("allows zero point value and preserves floating point arithmetic behavior", () => {
    const zeroValue = summarize([fixtures.fresh], {
      config: {
        ...baseConfig,
        commerce: { pointValue: 0, currency: "MXN" },
      },
    });
    const floatingPoint = summarize(
      [
        { id: "decimal-a", name: "Decimal A", points: 0.1 },
        { id: "decimal-b", name: "Decimal B", points: 0.2 },
      ],
      {
        config: {
          ...baseConfig,
          commerce: { pointValue: 10, currency: "MXN" },
        },
      }
    );

    expect(zeroValue.money.total).toBe(0);
    expect(floatingPoint.points.total).toBe(0.30000000000000004);
    expect(floatingPoint.money.total).toBe(3.0000000000000004);
  });

  it("composes coverage counts, ordering, labels, and seasonal recommendation fallbacks", () => {
    const summary = summarize([fixtures.fresh, fixtures.woody, fixtures.warm]);

    expect(summary.boxSummary.occasions).toEqual([
      "daily",
      "office",
      "casual",
      "formal",
      "date",
      "night",
    ]);
    expect(summary.boxSummary.seasons).toEqual([
      "spring",
      "summer",
      "fall",
      "winter",
    ]);
    expect(summary.boxSummary.vibes).toEqual([
      "fresh",
      "clean",
      "versatile",
      "elegant",
      "warm",
      "seductive",
      "bold",
    ]);
    expect(summary.boxSummary.occasionCounts).toEqual({
      daily: 2,
      office: 2,
      casual: 1,
      formal: 1,
      date: 1,
      night: 1,
    });
    expect(summary.boxSummary.seasonStrengths).toEqual({
      spring: 16,
      summer: 8,
      fall: 16,
      winter: 12,
    });
    expect(summary.coverageSummary.strengths).toEqual([
      { category: "occasions", target: "daily", label: "Daily Covered", level: "covered", count: 2 },
      { category: "occasions", target: "office", label: "Office Covered", level: "covered", count: 2 },
      { category: "occasions", target: "casual", label: "Casual Covered", level: "covered", count: 1 },
      { category: "occasions", target: "date", label: "Date Covered", level: "covered", count: 1 },
      { category: "occasions", target: "night", label: "Night Covered", level: "covered", count: 1 },
      { category: "occasions", target: "formal", label: "Formal Covered", level: "covered", count: 1 },
      { category: "seasons", target: "spring", label: "Strong Spring Coverage", level: "strong", count: 16 },
      { category: "seasons", target: "summer", label: "Summer Covered", level: "covered", count: 8 },
      { category: "seasons", target: "fall", label: "Strong Fall Coverage", level: "strong", count: 16 },
      { category: "seasons", target: "winter", label: "Winter Covered", level: "covered", count: 12 },
      { category: "vibes", target: "fresh", label: "Fresh Covered", level: "covered", count: 1 },
      { category: "vibes", target: "clean", label: "Clean Covered", level: "covered", count: 2 },
      { category: "vibes", target: "versatile", label: "Versatile Covered", level: "covered", count: 1 },
      { category: "vibes", target: "elegant", label: "Elegant Covered", level: "covered", count: 1 },
      { category: "vibes", target: "bold", label: "Bold Covered", level: "covered", count: 1 },
      { category: "vibes", target: "seductive", label: "Seductive Covered", level: "covered", count: 1 },
    ]);
    expect(summary.coverageSummary.gaps).toEqual([]);
    expect(summary.coverageSummary.seasonalRecommendations).toEqual([]);
  });

  it("reports fallback season gaps and catalog recommendations for missing coverage", () => {
    const summary = summarize([fixtures.fresh]);

    expect(summary.coverageSummary.gaps.map((gap) => gap.target)).toEqual([
      "fall",
      "winter",
    ]);
    expect(summary.coverageSummary.suggestions).toEqual([
      { category: "seasons", target: "fall", label: "Add Fall Coverage" },
      { category: "seasons", target: "winter", label: "Add Winter Coverage" },
    ]);
    expect(
      summary.coverageSummary.seasonalRecommendations.map(({ season, perfume }) => [
        season,
        perfume.id,
      ])
    ).toEqual([
      ["fall", "woody-office"],
      ["winter", "amber-night"],
    ]);
  });

  it("exposes box summary data that produces canonical fresh-heavy DNA", () => {
    const summary = summarize([
      fixtures.fresh,
      fixtures.citrus,
      fixtures.green,
      fixtures.marine,
    ]);

    expect(dnaFrom(summary)).toEqual({
      scores: { versatility: 42, depth: 40, seasonBalance: 36 },
      topAccords: [
        { label: "citrus", count: 3, percent: 75 },
        { label: "aromatic", count: 2, percent: 50 },
        { label: "aquatic", count: 1, percent: 25 },
        { label: "fresh", count: 1, percent: 25 },
        { label: "green", count: 1, percent: 25 },
      ],
      topVibes: [
        { label: "fresh", count: 4, percent: 100 },
        { label: "clean", count: 3, percent: 75 },
        { label: "green", count: 1, percent: 25 },
        { label: "versatile", count: 1, percent: 25 },
      ],
      seasonCoverage: [
        { label: "spring", count: 24, percent: 60 },
        { label: "summer", count: 35, percent: 88 },
        { label: "fall", count: 1, percent: 3 },
        { label: "winter", count: 0, percent: 0 },
      ],
    });
  });

  it("exposes box summary data that produces canonical woody-heavy DNA", () => {
    const summary = summarize([fixtures.woody, fixtures.formal, fixtures.leather]);

    expect(dnaFrom(summary)).toMatchObject({
      scores: { versatility: 61, depth: 39, seasonBalance: 51 },
      topAccords: [
        { label: "woody", count: 2, percent: 67 },
        { label: "amber", count: 1, percent: 33 },
        { label: "iris", count: 1, percent: 33 },
        { label: "leather", count: 1, percent: 33 },
        { label: "powdery", count: 1, percent: 33 },
      ],
      topVibes: [
        { label: "elegant", count: 2, percent: 67 },
        { label: "bold", count: 1, percent: 33 },
        { label: "classic", count: 1, percent: 33 },
        { label: "clean", count: 1, percent: 33 },
        { label: "dark", count: 1, percent: 33 },
      ],
    });
  });

  it("exposes box summary data that produces canonical balanced DNA", () => {
    const summary = summarize([fixtures.fresh, fixtures.woody, fixtures.warm]);

    expect(dnaFrom(summary)).toEqual({
      scores: { versatility: 75, depth: 44, seasonBalance: 87 },
      topAccords: [
        { label: "amber", count: 1, percent: 33 },
        { label: "aromatic", count: 1, percent: 33 },
        { label: "citrus", count: 1, percent: 33 },
        { label: "iris", count: 1, percent: 33 },
        { label: "vanilla", count: 1, percent: 33 },
      ],
      topVibes: [
        { label: "clean", count: 2, percent: 67 },
        { label: "bold", count: 1, percent: 33 },
        { label: "elegant", count: 1, percent: 33 },
        { label: "fresh", count: 1, percent: 33 },
        { label: "seductive", count: 1, percent: 33 },
      ],
      seasonCoverage: [
        { label: "spring", count: 16, percent: 53 },
        { label: "summer", count: 8, percent: 27 },
        { label: "fall", count: 16, percent: 53 },
        { label: "winter", count: 12, percent: 40 },
      ],
    });
  });

  it("exposes identity fallback, exact identities, and tie candidate ordering", () => {
    const empty = summarize([]);
    const fresh = summarize([
      fixtures.fresh,
      fixtures.citrus,
      fixtures.green,
      fixtures.marine,
    ]);
    const balanced = summarize([fixtures.fresh, fixtures.woody, fixtures.warm]);
    const maximum = summarize([
      fixtures.fresh,
      fixtures.woody,
      fixtures.warm,
      fixtures.citrus,
      fixtures.formal,
    ]);

    expect(identityFrom(empty).title).toBe("Collection In Progress");
    expect(identityFrom(fresh)).toMatchObject({
      title: "Fresh Daily Rotation",
      palette: "fresh",
      archetype: "fresh",
    });
    expect(identityFrom(balanced)).toMatchObject({
      title: "Balanced Rotation",
      palette: "balanced",
      archetype: "balanced",
    });
    expect(identityFrom(maximum)).toMatchObject({
      title: "Everyday Luxury",
      palette: "balanced",
      archetype: "balanced",
    });
    expect(candidatesFrom(balanced).slice(0, 3)).toEqual([
      "Balanced Rotation",
      "Collector's Selection",
      "Everyday Luxury",
    ]);
  });

  it("throws for invalid top-level inputs without normalizing them", () => {
    expect(() => buildCollectionSummary({})).toThrow(
      "buildCollectionSummary requires selectedPerfumes to be an array."
    );
    expect(() =>
      buildCollectionSummary({
        selectedPerfumes: null,
        catalog,
        notes,
        config: baseConfig,
      })
    ).toThrow("buildCollectionSummary requires selectedPerfumes to be an array.");
    expect(() =>
      buildCollectionSummary({
        selectedPerfumes: {},
        catalog,
        notes,
        config: baseConfig,
      })
    ).toThrow("buildCollectionSummary requires selectedPerfumes to be an array.");
    expect(() =>
      buildCollectionSummary({
        selectedPerfumes: [],
        catalog: null,
        notes,
        config: baseConfig,
      })
    ).toThrow("buildCollectionSummary requires catalog to be an array.");
    expect(() =>
      buildCollectionSummary({
        selectedPerfumes: [],
        catalog,
        notes,
      })
    ).toThrow("buildCollectionSummary requires a builder config.");
    expect(() =>
      buildCollectionSummary({
        selectedPerfumes: [],
        catalog,
        notes,
        config: { box: { ...baseConfig.box }, commerce: { currency: "MXN" } },
      })
    ).toThrow(
      "buildCollectionSummary requires numeric config value: commerce.pointValue"
    );
  });

  it("characterizes invalid point values and incomplete perfume objects", () => {
    const missingPoints = summarize([{ id: "missing", name: "Missing Points" }]);
    const stringPoints = summarize([
      { id: "string", name: "String Points", points: "2" },
    ]);
    const negativePoints = summarize([
      { id: "negative", name: "Negative Points", points: -1 },
    ]);
    const incomplete = summarize([{ id: "bare", name: "Bare", points: 1 }]);

    expect(Number.isNaN(missingPoints.points.total)).toBe(true);
    expect(Number.isNaN(missingPoints.points.remaining)).toBe(true);
    expect(Number.isNaN(missingPoints.money.total)).toBe(true);
    expect(missingPoints.readiness).toEqual({
      hasMinimumSlots: false,
      hasMinimumPoints: false,
      isReady: false,
      blockers: ["minimum-slots", "minimum-points"],
    });

    expect(stringPoints.points.total).toBe("02");
    expect(stringPoints.points.remaining).toBe(4);
    expect(stringPoints.money.total).toBe(200);

    expect(negativePoints.points).toEqual({
      total: -1,
      minimum: 6,
      remaining: 7,
    });
    expect(negativePoints.money.total).toBe(-100);

    expect(incomplete.boxSummary).toMatchObject({
      occasions: [],
      seasons: [],
      notes: [],
      vibes: [],
      accordMap: {},
      occasionCounts: {},
      seasonCounts: {},
      vibeCounts: {},
    });
  });

  it("does not mutate frozen selected perfumes, nested arrays, or config", () => {
    const selectedPerfumes = deepFreeze([
      {
        id: "immutable",
        name: "Immutable",
        points: 6,
        occasions: ["daily", "office"],
        seasons: ["spring"],
        vibes: ["fresh"],
        accords: ["citrus"],
        topNotes: ["bergamot"],
        seasonWeights: { spring: 10, summer: 0, fall: 0, winter: 0 },
      },
      {
        id: "immutable-two",
        name: "Immutable Two",
        points: 1,
        occasions: ["date"],
        seasons: ["winter"],
        vibes: ["warm"],
        accords: ["amber"],
        baseNotes: ["amber"],
        seasonWeights: { spring: 0, summer: 0, fall: 0, winter: 10 },
      },
    ]);
    const frozenConfig = deepFreeze({
      box: { minSelectableSlots: 2, maxSelectableSlots: 4, minPoints: 5 },
      commerce: { pointValue: 125, currency: "MXN" },
    });

    const summary = summarize(selectedPerfumes, { config: frozenConfig });

    expect(summary.selectedPerfumes).toBe(selectedPerfumes);
    expect(summary.selectedIds).toEqual(["immutable", "immutable-two"]);
    expect(summary.readiness.isReady).toBe(true);
    expect(Object.isFrozen(selectedPerfumes)).toBe(true);
    expect(Object.isFrozen(selectedPerfumes[0].occasions)).toBe(true);
    expect(Object.isFrozen(frozenConfig.box)).toBe(true);
  });

  it("is deterministic for identical inputs", () => {
    const selectedPerfumes = [
      fixtures.fresh,
      fixtures.woody,
      fixtures.warm,
      fixtures.citrus,
    ];

    expect(summarize(selectedPerfumes)).toEqual(summarize(selectedPerfumes));
  });

  it("summarizes a realistic golden fixture with exact collection outputs", () => {
    const selectedPerfumes = Object.values(fixtures);
    const summary = summarize(selectedPerfumes, { config: goldenConfig });

    expect(summary.counts).toEqual({
      selected: 8,
      minimum: 3,
      maximum: 14,
      remaining: 6,
      minimumRemaining: 0,
    });
    expect(summary.points).toEqual({ total: 15.25, minimum: 6, remaining: 0 });
    expect(summary.money).toEqual({
      pointValue: 95,
      total: 1448.75,
      currency: "MXN",
    });
    expect(summary.readiness).toEqual({
      hasMinimumSlots: true,
      hasMinimumPoints: true,
      isReady: true,
      blockers: [],
    });
    expect(summary.boxSummary).toMatchObject({
      occasions: ["daily", "office", "casual", "formal", "date", "night"],
      seasons: ["spring", "summer", "fall", "winter"],
      notes: [
        "Bergamot",
        "Mint",
        "Cedar",
        "Iris",
        "Vetiver",
        "Amber",
        "Vanilla",
        "Lemon",
        "Basil",
        "Marine Accord",
        "Leather",
      ],
      vibes: [
        "fresh",
        "clean",
        "versatile",
        "elegant",
        "warm",
        "seductive",
        "bold",
        "classic",
        "green",
        "dark",
      ],
      occasionCounts: {
        daily: 4,
        office: 4,
        casual: 4,
        formal: 3,
        date: 2,
        night: 2,
      },
      seasonStrengths: { spring: 32, summer: 35, fall: 34, winter: 29 },
      vibeCounts: {
        fresh: 4,
        clean: 4,
        versatile: 1,
        elegant: 2,
        warm: 1,
        seductive: 2,
        bold: 2,
        classic: 1,
        green: 1,
        dark: 1,
      },
    });
    expect(summary.coverageSummary.strengths).toEqual([
      { category: "occasions", target: "daily", label: "Strong Daily Coverage", level: "strong", count: 4 },
      { category: "occasions", target: "office", label: "Strong Office Coverage", level: "strong", count: 4 },
      { category: "occasions", target: "casual", label: "Strong Casual Coverage", level: "strong", count: 4 },
      { category: "occasions", target: "date", label: "Date Covered", level: "covered", count: 2 },
      { category: "occasions", target: "night", label: "Night Covered", level: "covered", count: 2 },
      { category: "occasions", target: "formal", label: "Strong Formal Coverage", level: "strong", count: 3 },
      { category: "seasons", target: "spring", label: "Strong Spring Coverage", level: "strong", count: 32 },
      { category: "seasons", target: "summer", label: "Strong Summer Coverage", level: "strong", count: 35 },
      { category: "seasons", target: "fall", label: "Strong Fall Coverage", level: "strong", count: 34 },
      { category: "seasons", target: "winter", label: "Strong Winter Coverage", level: "strong", count: 29 },
      { category: "vibes", target: "fresh", label: "Strong Fresh Coverage", level: "strong", count: 4 },
      { category: "vibes", target: "clean", label: "Strong Clean Coverage", level: "strong", count: 4 },
      { category: "vibes", target: "versatile", label: "Versatile Covered", level: "covered", count: 1 },
      { category: "vibes", target: "elegant", label: "Elegant Covered", level: "covered", count: 2 },
      { category: "vibes", target: "bold", label: "Bold Covered", level: "covered", count: 2 },
      { category: "vibes", target: "seductive", label: "Seductive Covered", level: "covered", count: 2 },
    ]);
    expect(summary.coverageSummary.gaps).toEqual([]);
    expect(dnaFrom(summary)).toEqual({
      scores: { versatility: 78, depth: 60, seasonBalance: 97 },
      topAccords: [
        { label: "citrus", count: 3, percent: 38 },
        { label: "amber", count: 2, percent: 25 },
        { label: "aromatic", count: 2, percent: 25 },
        { label: "woody", count: 2, percent: 25 },
        { label: "aquatic", count: 1, percent: 13 },
      ],
      topVibes: [
        { label: "clean", count: 4, percent: 50 },
        { label: "fresh", count: 4, percent: 50 },
        { label: "bold", count: 2, percent: 25 },
        { label: "elegant", count: 2, percent: 25 },
        { label: "seductive", count: 2, percent: 25 },
      ],
      seasonCoverage: [
        { label: "spring", count: 32, percent: 40 },
        { label: "summer", count: 35, percent: 44 },
        { label: "fall", count: 34, percent: 43 },
        { label: "winter", count: 29, percent: 36 },
      ],
    });
    expect(identityFrom(summary)).toEqual({
      id: "balanced",
      title: "Balanced Rotation",
      subtitle: "Composed for range, easy transitions, and confident year-round wear.",
      mood: ["Clean wardrobe", "Open calendar", "Soft polish"],
      palette: "balanced",
      archetype: "balanced",
    });
  });
});
