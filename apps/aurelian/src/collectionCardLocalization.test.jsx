import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { COLLECTION_CARD_TRAIT_CODES, buildCollectionCardViewModel } from "../../../packages/builder/src/builder/internal/collectionCard/buildCollectionCardViewModel.js";
import { localizeCollectionCardEditorial } from "../../../packages/builder/src/builder/internal/collectionCard/localizeCollectionCardEditorial.js";
import CollectionCard from "../../../packages/builder/src/components/CollectionCard.jsx";
import { createTranslator } from "../../../packages/builder/src/i18n/createTranslator.js";
import { esMX } from "../../../packages/builder/src/i18n/locales/es-MX.js";
import { buildBoxSummary } from "../../../packages/builder/src/utils/buildBoxSummary.js";
import { buildCoverageSummary } from "../../../packages/builder/src/utils/buildCoverageSummary.js";
import { buildScentDna } from "../../../packages/builder/src/utils/buildScentDna.js";
import { getCollectionIdentityProfile, listCollectionIdentityProfiles } from "../../../packages/builder/src/utils/collectionIdentityEngine.js";
import { discoveryDecantsConfig } from "../../../src/merchants/discoveryDecants/config.js";
import { aurelianCollectionCardEditorial as editorial } from "./merchant/collectionCardEditorial.js";
import { aurelianConfig } from "./merchant/config.js";
import { aurelianCatalog } from "./merchant/catalog.js";

const APP_ROOT = fileURLToPath(new URL("..", import.meta.url));
const REPOSITORY_ROOT = fileURLToPath(new URL("../../..", import.meta.url));
const read = (...segments) => readFileSync(join(...segments), "utf8").replace(/\r\n/g, "\n");

const translator = createTranslator(aurelianConfig.locale, aurelianConfig.taxonomyLabels);
const identities = listCollectionIdentityProfiles();

// Real boxes: deterministic pseudo-random selections of the live Aurelian catalog, 1 to 14 fragrances each.
function boxes(count) {
  let seed = 20260710;
  const next = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };

  return Array.from({ length: count }, () => {
    const size = 1 + Math.floor(next() * 14);
    const pool = [...aurelianCatalog];
    const picked = [];

    while (picked.length < size && pool.length > 0) picked.push(pool.splice(Math.floor(next() * pool.length), 1)[0]);

    return picked;
  });
}

function modelFor(selectedPerfumes, config = aurelianConfig) {
  const boxSummary = buildBoxSummary(selectedPerfumes, []);

  return buildCollectionCardViewModel({
    selectedPerfumes,
    totalPoints: selectedPerfumes.reduce((sum, item) => sum + item.points, 0),
    estimatedValue: selectedPerfumes.reduce((sum, item) => sum + item.points, 0) * 100,
    boxSummary,
    coverageSummary: buildCoverageSummary(boxSummary, selectedPerfumes),
    scentDna: buildScentDna(selectedPerfumes, boxSummary),
    collectionIdentity: getCollectionIdentityProfile(boxSummary),
    curatorBonus: { isUnlocked: selectedPerfumes.length >= 6 },
    config,
    maxSlots: 16,
    maxSelectableSlots: 14,
  });
}

const markupOf = (cardProps) => renderToStaticMarkup(<CollectionCard {...cardProps} />);
const textOf = (markup) => markup.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ");

// The engines' own English: every identity's prose, every profile chip, and the card's original labels.
const ENGLISH_IDENTITY_COPY = identities.flatMap(({ title, subtitle, mood }) => [title, subtitle, ...mood]);
const ENGLISH_TRAITS = [
  "Balanced Rotation", "Highly Versatile", "Spring/Summer Specialist", "Fall/Winter Specialist", "Office Friendly", "Evening Focused",
  "Fresh-Leaning", "Warm-Leaning", "Date Night Strong", "Collector Friendly", "Coherent Signature", "Taking Shape", "Casual Heavy",
];
const ENGLISH_LABELS = [
  "Collection Card", "Collection Profile", "Collection DNA", "Collection Points", "Collection mood", "Collection summary", "Curator Bonus slot",
  "Empty collection slot", "Profile develops", "Scent identity develops", "Rendered Discovery Box", "Fragrances", "Fragrance<",
];

describe("Aurelian writes every Collection Card identity", () => {
  it("covers every identity the engine can produce, with a title, a sentence and exactly three mood words", () => {
    expect(identities.length).toBe(11); // the 10 library identities + the empty box
    for (const { id, title, subtitle, mood } of identities) {
      const copy = editorial.identities[id];

      expect(copy, id).toBeDefined();
      expect(copy.title, id).toMatch(/\S/);
      expect(copy.subtitle, id).toMatch(/\S/);
      expect(copy.mood, id).toHaveLength(3);
      copy.mood.forEach((word) => expect(word, id).toMatch(/\S/));
      // genuinely worded for Aurelian, not the engine's English left in place
      expect(copy.title, id).not.toBe(title);
      expect(copy.subtitle, id).not.toBe(subtitle);
      copy.mood.forEach((word, index) => expect(word, id).not.toBe(mood[index]));
    }
  });

  it("has no identity the engine does not produce (no stale copy)", () => {
    expect(Object.keys(editorial.identities).sort()).toEqual(identities.map(({ id }) => id).sort());
  });

  it("covers every profile chip code, and nothing else", () => {
    const written = Object.keys(editorial.traits).sort();

    expect(written).toEqual(COLLECTION_CARD_TRAIT_CODES.filter((code) => code !== "coverage").sort());
    Object.values(editorial.traits).forEach((label) => expect(label).toMatch(/\S/));
    expect(editorial.coverage.strong).toContain("{target}");
    expect(editorial.coverage.covered).toContain("{target}");
  });

  it("words every coverage chip a box can earn, in Spanish, from the host's own taxonomy names", () => {
    const targets = {
      occasions: ["daily", "office", "casual", "date", "night", "formal"],
      seasons: ["spring", "summer", "fall", "winter"],
      vibes: ["fresh", "clean", "versatile", "elegant", "bold", "seductive"],
    };

    for (const [category, list] of Object.entries(targets)) {
      for (const target of list) {
        for (const level of ["strong", "covered"]) {
          const traitEntries = [{ code: "coverage", category, target, level, label: "English" }];
          const [chip] = aurelianLocalize(traitEntries).profileTraits;

          expect(chip, `${category}/${target}/${level}`).toMatch(/^Cobertura (sólida )?de \S/);
        }
      }
    }
  });

  it("has Spanish for every accord in the live catalog (the DNA row)", () => {
    for (const accord of new Set(aurelianCatalog.flatMap(({ accords }) => accords))) {
      expect(translator.label("accords", accord, ""), accord).toMatch(/\S/);
    }
  });
});

function aurelianLocalize(traitEntries) {
  return localizeCollectionCardEditorial({ editorial, identity: { id: "balanced" }, traitEntries, translator });
}

describe("a real Aurelian card never carries English editorial copy", () => {
  const sample = boxes(160);

  it("renders the identity, mood, chips, DNA and every label in Spanish, for 160 real boxes", () => {
    const seenIdentities = new Set();

    for (const selected of sample) {
      const { cardProps, identity } = modelFor(selected);
      const markup = markupOf(cardProps);
      const text = textOf(markup);

      seenIdentities.add(getCollectionIdentityProfile(buildBoxSummary(selected, [])).id);
      expect(identity.title).toBe(editorial.identities[getCollectionIdentityProfile(buildBoxSummary(selected, [])).id].title);
      [...ENGLISH_IDENTITY_COPY, ...ENGLISH_TRAITS].forEach((english) => expect(text, english).not.toContain(english));
      ENGLISH_LABELS.forEach((english) => expect(markup, english).not.toContain(english));
      expect(markup).not.toContain(">MOOD<");
      expect(cardProps.profileTraits.length).toBeGreaterThan(0);
      cardProps.profileTraits.forEach((chip) => expect(Object.values(editorial.traits).includes(chip) || /^Cobertura /.test(chip), chip).toBe(true));
      cardProps.dnaDescriptors.forEach((label) => expect(label).toMatch(/\S/));
    }

    // the sample reaches a real spread of identities, so the check above is not vacuous
    expect(seenIdentities.size).toBeGreaterThanOrEqual(3);
  });

  it("every rendered DNA descriptor is the host's Spanish name for an accord the box carries", () => {
    for (const selected of sample.slice(0, 40)) {
      const { cardProps } = modelFor(selected);
      const names = new Set(selected.flatMap(({ accords }) => accords).map((accord) => translator.label("accords", accord, "")));

      cardProps.dnaDescriptors.forEach((label) => expect(names.has(label), label).toBe(true));
    }
  });

  it("the empty box reads Spanish too, with the card's own empty-state sentences", () => {
    const { cardProps } = modelFor([]);
    const markup = markupOf(cardProps);

    expect(cardProps.title).toBe("Colección en construcción");
    expect(markup).toContain("El perfil se define a medida que armas la caja.");
    expect(markup).toContain("La identidad olfativa se define a medida que armas la caja.");
    [...ENGLISH_IDENTITY_COPY, ...ENGLISH_LABELS].forEach((english) => expect(markup, english).not.toContain(english));
  });

  it("keeps the Aurelian brand mark, the MXN total, the fragrance count and the perfume names", () => {
    const selected = sample.find((box) => box.length >= 6);
    const { cardProps } = modelFor(selected);
    const markup = markupOf(cardProps);

    expect(cardProps.heading).toBe("Aurelian");
    expect(markup).toContain('<div class="collection-card-topline">Aurelian</div>');
    expect(cardProps.collectionTotal).toMatch(/^\$[\d,]+ MXN$/);
    expect(textOf(markup)).toContain(`${selected.length} Fragancias`);
    expect(cardProps.perfumes.map(({ name }) => name)).toEqual(selected.map(({ name }) => name));
  });
});

describe("missing copy fails safely, in Spanish, never in raw English", () => {
  const unknown = (selected, identity, overrides = {}) => {
    const boxSummary = buildBoxSummary(selected, []);

    return buildCollectionCardViewModel({
      selectedPerfumes: selected,
      totalPoints: 4,
      estimatedValue: 400,
      boxSummary,
      coverageSummary: { strengths: [], gaps: [] },
      scentDna: { topAccords: [{ label: "citrus" }, { label: "an-accord-nobody-named" }] },
      collectionIdentity: identity,
      curatorBonus: { isUnlocked: false },
      config: aurelianConfig,
      maxSlots: 16,
      maxSelectableSlots: 14,
      ...overrides,
    });
  };

  it("an identity the engine adds later reads as Aurelian's neutral Spanish identity, with no mood block", () => {
    const { cardProps } = unknown(aurelianCatalog.slice(0, 4), { id: "future-identity", title: "Future Rotation", subtitle: "Some English.", mood: ["a", "b", "c"], palette: "balanced" });
    const markup = markupOf(cardProps);

    expect(cardProps.title).toBe("Tu colección");
    expect(cardProps.mood).toEqual([]);
    expect(markup).not.toContain("Future Rotation");
    expect(markup).not.toContain("Some English.");
    expect(markup).not.toContain('class="collection-card-mood"'); // the mood block needs all three words
  });

  it("an accord with no Spanish name is left out of the DNA row, not shown raw", () => {
    const { cardProps } = unknown(aurelianCatalog.slice(0, 4), { id: "balanced", palette: "balanced" });

    expect(cardProps.dnaDescriptors).toEqual(["Cítrico"]);
    expect(markupOf(cardProps)).not.toContain("an-accord-nobody-named");
    expect(markupOf(cardProps)).not.toContain("An Accord Nobody Named");
  });

  it("a box with no writable profile chip shows the Spanish empty-state sentence", () => {
    const { cardProps } = unknown(aurelianCatalog.slice(0, 4), { id: "balanced", palette: "balanced" }, {
      config: { ...aurelianConfig, collectionCard: { ...aurelianConfig.collectionCard, editorial: { ...editorial, traits: {} } } },
    });
    const markup = markupOf(cardProps);

    expect(cardProps.profileTraits).toEqual([]);
    expect(markup).toContain("El perfil se define a medida que armas la caja.");
    expect(textOf(markup)).not.toMatch(/Balanced|Office Friendly|Taking Shape|Casual Heavy/);
  });
});

describe("Preview, Download and Share are one rendering", () => {
  const panel = read(REPOSITORY_ROOT, "packages", "builder", "src", "components", "BuilderPanel.jsx");

  it("all three read the same view model's cardProps, so what is previewed is what is exported", () => {
    expect(panel).toContain("const collectionCardExportProps = collectionCardViewModel.cardProps;");
    expect(panel).toContain("renderCollectionCardPng(collectionCardExportProps, portalRoot)");
    expect(panel).toContain("cardProps={collectionCardViewModel.cardProps}");
    expect(panel).toContain("<CollectionCard {...cardProps} />"); // the preview modal
    expect(panel).toMatch(/<CollectionCard\s+\{\.\.\.collectionCardProps\}\s+exportMode/); // the exported image
  });

  it("the preview heading, the status lines and the failure lines are Spanish, with no English product name left", () => {
    expect(esMX["collectionCard.label"]).toBe("Tarjeta de colección");
    expect(esMX["collectionCard.preview"]).toBe("Vista previa");
    for (const key of ["downloaded", "shared", "renderFailure", "createFailure"]) expect(esMX[`collectionCard.${key}`], key).not.toMatch(/Collection Card/);
    expect(aurelianConfig.collectionCard.downloadedStatus).toBe("Tarjeta de colección descargada.");
    expect(aurelianConfig.collectionCard.sharedStatus).toBe("Tarjeta de colección compartida.");
    expect(aurelianConfig.collectionCard.ariaLabel).toBe("tarjeta de colección Aurelian");
  });

  it("the same box gives the same card twice (one localized source, no per-surface wording)", () => {
    const selected = aurelianCatalog.slice(0, 8);

    expect(markupOf(modelFor(selected).cardProps)).toBe(markupOf(modelFor(selected).cardProps));
  });
});

describe("Discovery Decants keeps its own card exactly", () => {
  const selected = aurelianCatalog.slice(0, 8);

  it("supplies no editorial copy, so its identity, mood, chips and accords are the engines' English", () => {
    const { cardProps, export: exported } = modelFor(selected, discoveryDecantsConfig);
    const identity = getCollectionIdentityProfile(buildBoxSummary(selected, []));

    expect(discoveryDecantsConfig.collectionCard.editorial).toBeNull();
    expect(cardProps.title).toBe(identity.title);
    expect(cardProps.subtitle).toBe(identity.subtitle);
    expect(cardProps.mood).toEqual(identity.mood);
    expect(exported.filename).toMatch(/^[a-z0-9-]+-[a-z0-9-]+\.png$/);
    expect(cardProps.profileTraits.every((chip) => ENGLISH_TRAITS.includes(chip) || /Coverage|Covered/.test(chip))).toBe(true);
    cardProps.dnaDescriptors.forEach((label) => expect(label).toMatch(/^[A-Z][A-Za-z]*( [A-Z][A-Za-z]*)*$/));
  });

  it("renders the card's original English labels", () => {
    const text = textOf(markupOf(modelFor(selected, discoveryDecantsConfig).cardProps));

    for (const english of ["MOOD", "Collection Profile", "Collection DNA", "Fragrances", "Collection Points"]) expect(text).toContain(english);
    expect(text).not.toMatch(/CARÁCTER|Perfil de la colección|ADN de la colección|Fragancias/);
  });

  it("its card labels equal the card's own English defaults, and its dictionary keys equal them too", () => {
    const labels = modelFor(selected, discoveryDecantsConfig).cardProps.labels;
    const bare = renderToStaticMarkup(<CollectionCard perfumes={selected.slice(0, 2)} />);
    const withLabels = renderToStaticMarkup(<CollectionCard perfumes={selected.slice(0, 2)} labels={labels} />);

    expect(withLabels).toBe(bare);
  });
});

describe("layout: Spanish wraps naturally, the card's type and geometry are the shared card's own", () => {
  const css = read(APP_ROOT, "src", "app", "builder-collection-card.css");

  it("balances only the card's title and sentence, in Preview and in the export, and changes no size", () => {
    const rule = css.match(/:is\(\.builder-page, \.builder-portal-root\) \.collection-card \.collection-card-header :is\(h2, p\) \{([^}]*)\}/);

    expect(rule).not.toBeNull();
    expect(rule[1].replace(/\s+/g, " ").trim()).toBe("text-wrap: balance;");
  });
});

describe("the Review modal's identity names (Box Intelligence) are the Collection Card's names, exactly", () => {
  const enTranslator = createTranslator(discoveryDecantsConfig.locale);
  const ids = identities.map(({ id }) => id);

  it("11 of 11 identity titles match the card's editorial titles exactly, in sentence case", () => {
    expect(ids).toHaveLength(11);
    for (const id of ids) {
      expect(translator.t(`identity.${id}.title`), id).toBe(editorial.identities[id].title);
      // sentence case: only the first letter is capitalised (no Title Case left over)
      expect(editorial.identities[id].title, id).toMatch(/^\S+( [a-zñáéíóúü]\S*)*$/);
    }
  });

  it("each identity's prose form is its title with the right article, so the Review summary sentence reads correctly", () => {
    const article = { "in-progress": "una", "fresh-daily": "una", mediterranean: "una", balanced: "una", "everyday-luxury": "un", executive: "una", refined: "una", evening: "una", "golden-hour": "una", signature: "una", collector: "una" };

    for (const id of ids) expect(translator.t(`identity.${id}.articledLower`), id).toBe(`${article[id]} ${editorial.identities[id].title.toLowerCase()}`);
    expect(translator.t("identity.golden-hour.title")).toBe("Colección hora dorada");
    expect(translator.t("identity.golden-hour.articledLower")).toBe("una colección hora dorada");
    expect(translator.t("identity.balanced.articledLower")).toBe("una rotación equilibrada");
  });

  it("no identity name in Spanish still says Golden Hour, Balanceada or Title Case", () => {
    for (const id of ids) {
      for (const key of ["title", "articledLower"]) {
        const text = translator.t(`identity.${id}.${key}`);

        expect(text, `${id}.${key}`).not.toMatch(/Golden Hour|[Bb]alanceada/);
        expect(text, `${id}.${key}`).not.toMatch(/ [A-ZÁÉÍÓÚÑ]/);
      }
    }
  });

  it("the card and the Review modal agree on a real balanced box", () => {
    const { cardProps } = modelFor(aurelianCatalog.slice(0, 8));
    const id = getCollectionIdentityProfile(buildBoxSummary(aurelianCatalog.slice(0, 8), [])).id;

    expect(cardProps.title).toBe(translator.t(`identity.${id}.title`));
  });

  it("leaves Discovery Decants' English identity names alone", () => {
    expect(enTranslator.t("identity.balanced.title")).toBe("Balanced Rotation");
    expect(enTranslator.t("identity.balanced.articledLower")).toBe("a balanced rotation");
    expect(enTranslator.t("identity.golden-hour.title")).toBe("Golden Hour Collection");
    expect(enTranslator.t("identity.fresh-daily.title")).toBe("Fresh Daily Rotation");
  });

  it("leaves the descriptive wording (profile descriptors, recommendation prose, strengths) as it was", () => {
    expect(esMX["collectionIntelligence.profile.balancedVersatile"]).toBe("Balanceada y versátil");
    expect(esMX["collectionIntelligence.profilePhrase.balancedAlready"]).toBe("Tu caja ya se siente balanceada, con {coverage}.");
    expect(esMX["review.strength.warmCoolBalance"]).toBe("Selección balanceada entre clima cálido y fresco");
  });
});
