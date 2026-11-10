import { describe, expect, it } from "vitest";
import { createTranslator } from "../../../i18n/createTranslator.js";
import { buildCollectionCardProfileTraitEntries, buildCollectionCardProfileTraits, buildCollectionCardViewModel } from "./buildCollectionCardViewModel.js";
import { localizeCollectionCardEditorial } from "./localizeCollectionCardEditorial.js";
import { createBuilderConfig } from "../../config/createBuilderConfig.js";

// A made-up language, so nothing here depends on any real host's wording.
const EDITORIAL = {
  identities: {
    balanced: { title: "T-balanced", subtitle: "S-balanced", mood: ["m1", "m2", "m3"] },
    "in-progress": { title: "T-progress", subtitle: "S-progress", mood: ["p1", "p2", "p3"] },
  },
  fallbackIdentity: { title: "T-fallback", subtitle: "S-fallback", mood: [] },
  traits: { balancedRotation: "L-balanced", eveningFocused: "L-evening" },
  coverage: { strong: "strong {target}", covered: "covered {target}" },
};
const translator = createTranslator("es-MX", { "taxonomy.citrus": "Zitrus", "taxonomy.woody": "Holz" });

describe("localizeCollectionCardEditorial: the engines' semantic results, in a host's own words", () => {
  const run = (overrides = {}) => localizeCollectionCardEditorial({ editorial: EDITORIAL, identity: { id: "balanced" }, translator, ...overrides });

  it("words the identity from its id, never from the engine's English prose", () => {
    const result = run({ identity: { id: "balanced", title: "Balanced Rotation", subtitle: "English", mood: ["x", "y", "z"] } });

    expect(result).toMatchObject({ title: "T-balanced", subtitle: "S-balanced", mood: ["m1", "m2", "m3"] });
  });

  it("an identity nobody has written falls back to the host's neutral identity, with no mood (the card needs all three words)", () => {
    expect(run({ identity: { id: "brand-new-identity" } })).toMatchObject({ title: "T-fallback", subtitle: "S-fallback", mood: [] });
    expect(run({ identity: undefined })).toMatchObject({ title: "T-fallback", mood: [] });
  });

  it("words each profile chip from its code, in order, and leaves out a chip nobody has written (never raw)", () => {
    const traitEntries = [
      { code: "balancedRotation", label: "Balanced Rotation" },
      { code: "someFutureChip", label: "Some Future Chip" },
      { code: "eveningFocused", label: "Evening Focused" },
    ];

    expect(run({ traitEntries }).profileTraits).toEqual(["L-balanced", "L-evening"]);
    expect(run({ traitEntries: [{ code: "someFutureChip", label: "Some Future Chip" }] }).profileTraits).toEqual([]);
  });

  it("words the coverage chips from category, target and level, through the host's own taxonomy names", () => {
    const t = createTranslator("es-MX", { "taxonomy.summer": "Sommer", "taxonomy.night": "Nacht" });
    const entries = [
      { code: "coverage", category: "seasons", target: "summer", level: "strong", label: "Strong Summer Coverage" },
      { code: "coverage", category: "occasions", target: "night", level: "covered", label: "Night Covered" },
      { code: "coverage", category: "vibes", target: "no-such-vibe", level: "covered", label: "No-such-vibe Covered" },
    ];

    expect(run({ traitEntries: entries, translator: t }).profileTraits).toEqual(["strong sommer", "covered nacht"]);
  });

  it("words the DNA from the host's accord names and leaves out an accord with no name", () => {
    expect(run({ dnaKeys: ["citrus", "woody", "not-an-accord"] }).dnaDescriptors).toEqual(["Zitrus", "Holz"]);
  });

  it("is deterministic, and never throws for a host that wrote very little", () => {
    expect(run()).toEqual(run());
    expect(localizeCollectionCardEditorial({ editorial: {}, identity: { id: "balanced" }, traitEntries: [{ code: "balancedRotation" }], dnaKeys: ["citrus"] })).toEqual({
      title: "",
      subtitle: "",
      mood: [],
      profileTraits: [],
      dnaDescriptors: [],
    });
  });
});

describe("the view model: a host without editorial copy keeps the engines' own English", () => {
  const selectedPerfumes = [
    { id: 1, name: "Acqua di Gio EDT", shortName: "ADG", brand: "Armani", points: 1, tier: "Bronze", image: "/a.png", accords: ["citrus"], vibes: ["fresh"], occasions: ["daily"], seasons: ["summer"] },
  ];
  const input = (config) => ({
    selectedPerfumes,
    totalPoints: 1,
    estimatedValue: 100,
    boxSummary: { seasonStrengths: {}, seasonCounts: {}, accordCounts: { "fresh spicy": 2, citrus: 1 }, accordMap: {}, occasionCounts: {}, vibeCounts: {} },
    coverageSummary: { strengths: [{ category: "seasons", target: "summer", level: "strong", label: "Strong Summer Coverage" }], gaps: [] },
    scentDna: { topAccords: [{ label: "fresh spicy" }, { label: "citrus" }] },
    collectionIdentity: { id: "balanced", title: "Balanced Rotation", subtitle: "Composed for range.", mood: ["Clean wardrobe", "Open calendar", "Soft polish"], palette: "balanced", archetype: "balanced" },
    curatorBonus: { isUnlocked: false },
    config,
    maxSlots: 16,
    maxSelectableSlots: 14,
  });
  const base = { brand: { businessName: "Test" }, finalization: { whatsappNumber: "5210000000000" } };

  it("no editorial: engine English for title, subtitle, mood and accords", () => {
    const { cardProps } = buildCollectionCardViewModel(input(createBuilderConfig(base)));

    expect(cardProps).toMatchObject({ title: "Balanced Rotation", subtitle: "Composed for range.", mood: ["Clean wardrobe", "Open calendar", "Soft polish"] });
    expect(cardProps.dnaDescriptors).toEqual(["Fresh Spicy", "Citrus"]);
    expect(cardProps.labels).toMatchObject({ mood: "MOOD", profileTitle: "Collection Profile", fragrances: "Fragrances", points: "Collection Points" });
  });

  it("with editorial: the same box, worded by the host, in Preview, Download and Share alike (one set of props)", () => {
    const config = createBuilderConfig({ ...base, locale: "es-MX", taxonomyLabels: { "taxonomy.citrus": "Zitrus", "taxonomy.fresh spicy": "Frisch" }, collectionCard: { editorial: EDITORIAL } });
    const model = buildCollectionCardViewModel(input(config));

    expect(model.cardProps).toMatchObject({ title: "T-balanced", subtitle: "S-balanced", mood: ["m1", "m2", "m3"], dnaDescriptors: ["Frisch", "Zitrus"] });
    expect(model.header).toMatchObject({ title: "T-balanced", subtitle: "S-balanced" });
    expect(model.identity).toMatchObject({ title: "T-balanced", mood: ["m1", "m2", "m3"] });
    expect(model.dna.descriptors).toEqual(["Frisch", "Zitrus"]);
    expect(model.export.filename).toBe(`${config.collectionCard.filenamePrefix}-t-balanced.png`);
    expect(buildCollectionCardViewModel(input(config)).cardProps).toEqual(model.cardProps);
  });
});

describe("profile chips: semantic entries beside the unchanged English labels", () => {
  it("the English chips are exactly the entries' labels", () => {
    const perfumes = [
      { id: 1, accords: ["citrus"], vibes: ["fresh"], occasions: ["daily"], seasons: ["summer", "spring"], seasonWeights: { spring: 8, summer: 9, fall: 2, winter: 1 } },
      { id: 2, accords: ["marine"], vibes: ["clean"], occasions: ["office"], seasons: ["summer"], seasonWeights: { spring: 7, summer: 10, fall: 2, winter: 0 } },
    ];
    const args = { selectedPerfumes: perfumes, boxSummary: { seasonCounts: {}, occasionCounts: { daily: 1, office: 1 }, vibeCounts: {}, accordMap: {}, seasons: ["summer"], occasions: ["daily", "office"], vibes: ["fresh", "clean"], notes: [] }, coverageSummary: { strengths: [] } };

    expect(buildCollectionCardProfileTraits(args)).toEqual(buildCollectionCardProfileTraitEntries(args).map(({ label }) => label));
    expect(buildCollectionCardProfileTraitEntries(args).every(({ code, label }) => typeof code === "string" && typeof label === "string")).toBe(true);
  });
});
