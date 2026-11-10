import {
  buildCollectionMetrics,
  isEveningFocused,
} from "../intelligence/collectionMetrics.js";
import { SEASON_IDS, buildSeasonalEvidence } from "../intelligence/seasonalEvidence.js";
import { createCustomerPricing } from "../../../utils/customerPricing.js";
import { createTranslator } from "../../../i18n/createTranslator.js";
import { localizeCollectionCardEditorial } from "./localizeCollectionCardEditorial.js";

// Every semantic code a profile chip can carry. "coverage" is the chip a box earns from its coverage when no other applies; it is
// worded from its category / target / level. A host that words the card itself has to cover all of these.
export const COLLECTION_CARD_TRAIT_CODES = Object.freeze([
  "balancedRotation",
  "highlyVersatile",
  "springSummerSpecialist",
  "fallWinterSpecialist",
  "officeFriendly",
  "eveningFocused",
  "freshLeaning",
  "warmLeaning",
  "dateNightStrong",
  "collectorFriendly",
  "coherentSignature",
  "takingShape",
  "casualHeavy",
  "coverage",
]);

export function buildCollectionCardViewModel({
  selectedPerfumes,
  totalPoints,
  estimatedValue,
  boxSummary,
  coverageSummary,
  scentDna,
  collectionIdentity,
  curatorBonus,
  config,
  maxSlots,
  maxSelectableSlots,
}) {
  const items = buildCollectionCardItems(selectedPerfumes);
  const seasonRows = buildCollectionCardSeasonRows(
    boxSummary.seasonStrengths || boxSummary.seasonCounts || {},
    items.length
  );
  const traitEntries = buildCollectionCardProfileTraitEntries({
    selectedPerfumes,
    boxSummary,
    coverageSummary,
  });
  const dnaItems = buildCollectionCardDnaItems({ boxSummary, scentDna }).slice(0, 3);
  // A host that words the card itself (config.collectionCard.editorial) has the engines' semantic results -- identity id, chip
  // codes, accord keys -- mapped to its own copy; a host without one keeps the engines' English exactly as before.
  const editorial = config.collectionCard.editorial;
  const translator = editorial ? createTranslator(config.locale, config.taxonomyLabels) : null;
  const localized = editorial
    ? localizeCollectionCardEditorial({ editorial, identity: collectionIdentity, traitEntries, dnaKeys: dnaItems.map((item) => item.label), translator })
    : null;
  const profileTraits = localized ? localized.profileTraits : uniqueStrings(traitEntries.map((entry) => entry.label)).slice(0, 5);
  const dnaDescriptors = localized ? localized.dnaDescriptors : dnaItems.map((item) => formatLabel(item.label));
  const primaryDna = dnaDescriptors[0] || "";
  const title = localized ? localized.title : collectionIdentity?.title;
  const subtitle = localized ? localized.subtitle : collectionIdentity?.subtitle;
  const mood = localized ? localized.mood : collectionIdentity?.mood || [];
  // A host that speaks money to customers (commerce.priceDisplay: "price") has the card's summary read the
  // box's total amount instead of its points. This one view model feeds Preview, Download and Share alike.
  const pricing = createCustomerPricing(config);

  return {
    header: {
      businessName: config.brand?.businessName || "",
      heading: config.collectionCard.brandHeading,
      title,
      subtitle,
      mood,
      palette: collectionIdentity?.palette,
    },
    collection: {
      items,
      totalSlots: items.length,
      totalPoints,
      collectionPoints: totalPoints,
      monetaryTotal: estimatedValue,
      currency: config.commerce?.currency,
    },
    identity: {
      title,
      subtitle,
      mood,
      palette: collectionIdentity?.palette,
      archetype: collectionIdentity?.archetype,
    },
    dna: {
      descriptors: dnaDescriptors,
      primary: primaryDna,
    },
    coverage: {
      seasons: translator
        ? seasonRows.map((row) => ({ ...row, label: translator.label("seasons", row.id, row.label) }))
        : seasonRows,
      profileTraits: profileTraits.slice(0, 3),
    },
    curatorBonus: {
      isUnlocked: Boolean(curatorBonus?.isUnlocked),
      includedLabel: config.collectionCard.curatorBonusIncludedLabel,
      availableLabel: config.collectionCard.curatorBonusAvailableLabel,
      unlockedCopy: config.collectionCard.curatorBonusUnlockedCopy,
      lockedCopy: config.collectionCard.curatorBonusLockedCopy,
    },
    export: {
      filename: buildCollectionCardFilename(title, config),
      defaultFilename: buildCollectionCardFilename("collection", config),
      shareTitle: config.collectionCard.shareTitle,
      shareText: config.collectionCard.shareText,
    },
    cardProps: {
      heading: config.collectionCard.brandHeading,
      ariaLabel: config.collectionCard.ariaLabel,
      boxAriaLabel: config.collectionCard.boxAriaLabel,
      footer: config.collectionCard.footer,
      curatorBonusIncludedLabel: config.collectionCard.curatorBonusIncludedLabel,
      curatorBonusAvailableLabel: config.collectionCard.curatorBonusAvailableLabel,
      curatorBonusUnlockedCopy: config.collectionCard.curatorBonusUnlockedCopy,
      curatorBonusLockedCopy: config.collectionCard.curatorBonusLockedCopy,
      perfumes: items,
      title,
      subtitle,
      mood,
      palette: collectionIdentity?.palette,
      fragranceCount: items.length,
      collectionPoints: totalPoints,
      ...(pricing.isPriceDisplay
        ? { collectionTotal: pricing.formatAmountWithCurrency(estimatedValue), collectionTotalLabel: config.collectionCard.totalLabel ?? "Total" }
        : {}),
      // The card's own words (section titles, summary labels, empty states, accessible names), all from the host's config.
      ...cardLabels(config.collectionCard),
      profileTraits: profileTraits.slice(0, 3),
      dnaDescriptors,
      primaryDna,
      isCuratorBonusUnlocked: Boolean(curatorBonus?.isUnlocked),
      maxSlots,
      maxSelectableSlots,
      themeAccent: config.theme?.colors?.accent,
      themeAccentStrong: config.theme?.colors?.accentStrong,
    },
  };
}

export function buildCollectionCardItems(selectedPerfumes) {
  return Array.isArray(selectedPerfumes)
    ? selectedPerfumes.map((perfume) => ({
        id: perfume.id,
        name: perfume.name,
        shortName: perfume.shortName,
        brand: perfume.brand,
        points: perfume.points,
        tier: perfume.tier,
        image: perfume.image,
        accords: [...(perfume.accords || [])],
        vibes: [...(perfume.vibes || [])],
        occasions: [...(perfume.occasions || [])],
        seasons: [...(perfume.seasons || [])],
      }))
    : [];
}

// The profile chips. Every lean here is read from the shared metrics (collectionMetrics.js), as numbers per
// fragrance, so the chips, the stars, the radar and Box Intelligence describe the same box the same way.
export function buildCollectionCardProfileTraits(input = {}) {
  return uniqueStrings(buildCollectionCardProfileTraitEntries(input).map((entry) => entry.label)).slice(0, 5);
}

// The same chips as semantic entries: a stable `code` (or, for a chip derived from coverage, the category / target / level it
// came from) beside the English label. A host that words the card itself maps the code; the label is what everyone else shows.
export function buildCollectionCardProfileTraitEntries({ selectedPerfumes = [], boxSummary = {}, coverageSummary = { strengths: [] } } = {}) {
  const selectedCount = Array.isArray(selectedPerfumes) ? selectedPerfumes.length : 0;

  if (selectedCount === 0) {
    return [];
  }

  const metrics = buildCollectionMetrics({ selectedPerfumes, boxSummary });
  const { seasonal, profile, stars } = metrics;
  // A specialist chip is the radar's own sentence ("leans Spring and Summer") as a chip: the same shape, so the
  // two cannot disagree. A box that is balanced across the seasons is never a specialist.
  const leaning = seasonal.isBalanced ? [] : seasonal.shape.seasons;
  const leansCool = leaning.length > 0 && leaning.every((season) => season === "spring" || season === "summer");
  const leansWarm = leaning.length > 0 && leaning.every((season) => season === "fall" || season === "winter");
  const traits = [];
  const add = (code, label) => traits.push({ code, label });

  if (profile.isBalancedRotation) {
    add("balancedRotation", "Balanced Rotation");
  } else if (stars.versatility >= 4) {
    add("highlyVersatile", "Highly Versatile");
  }

  // Seasonal character comes right after the balance chip: it is the part of the story the radar also tells, and
  // the chips are capped (the card shows the first three), so it must not be the first thing cut.
  if (leansCool) {
    add("springSummerSpecialist", "Spring/Summer Specialist");
  }

  if (leansWarm) {
    add("fallWinterSpecialist", "Fall/Winter Specialist");
  }

  if (profile.everydayShare >= 0.5) {
    add("officeFriendly", "Office Friendly");
  }

  if (isEveningFocused(profile)) {
    add("eveningFocused", "Evening Focused");
  }

  if (profile.lean === "fresh") {
    add("freshLeaning", "Fresh-Leaning");
  }

  if (profile.lean === "warm") {
    add("warmLeaning", "Warm-Leaning");
  }

  if (profile.dateNightCount >= 2 && profile.dateNightShare >= 0.35) {
    add("dateNightStrong", "Date Night Strong");
  }

  if (stars.breadth >= 4 && selectedCount >= 5) {
    add("collectorFriendly", "Collector Friendly");
  }

  if (stars.signature >= 4 && selectedCount >= 4) {
    add("coherentSignature", "Coherent Signature");
  }

  if (traits.length === 0 && coverageSummary.strengths.length > 0) {
    traits.push(
      ...coverageSummary.strengths
        .slice(0, 2)
        .map((item) => ({ code: "coverage", label: item.label, category: item.category, target: item.target, level: item.level }))
    );
  }

  if (traits.length === 0) {
    if (selectedCount < 3) add("takingShape", "Taking Shape");
    else add("casualHeavy", "Casual Heavy");
  }

  return traits.filter((entry, index) => entry.label && traits.findIndex((other) => other.label === entry.label) === index).slice(0, 5);
}

export function buildCollectionCardDnaItems({ boxSummary, scentDna }) {
  const topAccords = scentDna?.topAccords || [];

  if (topAccords.length > 0) {
    return topAccords.slice(0, 6);
  }

  return Object.entries(getAccordCounts(boxSummary))
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
    .slice(0, 6);
}

// The radar's rows: the shared seasonal levels, one row per season.
export function buildCollectionCardSeasonRows(seasonCounts, selectedCount = 0) {
  const { levels } = buildSeasonalEvidence({ seasonStrengths: seasonCounts, selectedCount });

  return SEASON_IDS.map((season) => {
    const strength = seasonCounts?.[season] || 0;

    return {
      id: season,
      label: formatLabel(season),
      count: levels[season],
      strength,
      percent: levels[season],
    };
  });
}

export function buildCollectionCardFilename(title, config) {
  const slug = String(title || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/['']/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");

  return `${config.collectionCard.filenamePrefix}-${slug || "collection"}.png`;
}

// Accord -> number of fragrances. The box summary stores the fragrance NAMES per accord, so count those.
function getAccordCounts(boxSummary) {
  if (boxSummary.accordCounts) {
    return boxSummary.accordCounts;
  }

  return Object.fromEntries(
    Object.entries(boxSummary.accordMap || {}).map(([accord, perfumes]) => [
      accord,
      Array.isArray(perfumes) ? perfumes.length : Number(perfumes) || 0,
    ])
  );
}

function uniqueStrings(values) {
  return [...new Set(values.filter(Boolean))];
}

function formatLabel(value) {
  return String(value || "")
    .split(/(?=[A-Z])|[-_\s]/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

// The card's own words from the host's config, only those the config defines (a config built by createBuilderConfig defines them all,
// so the card never falls back to a default it was not given); none defined, no `labels` prop at all.
function cardLabels(card) {
  const labels = Object.fromEntries(
    Object.entries({
      mood: card.moodLabel,
      moodAria: card.moodAriaLabel,
      summaryAria: card.summaryAriaLabel,
      fragrance: card.fragranceLabel,
      fragrances: card.fragrancesLabel,
      points: card.pointsLabel,
      profileTitle: card.profileTitle,
      profileEmpty: card.profileEmptyCopy,
      dnaTitle: card.dnaTitle,
      dnaEmpty: card.dnaEmptyCopy,
      curatorSlotAria: card.curatorSlotAriaLabel,
      emptySlotAria: card.emptySlotAriaLabel,
    }).filter(([, value]) => typeof value === "string")
  );

  return Object.keys(labels).length > 0 ? { labels } : {};
}
