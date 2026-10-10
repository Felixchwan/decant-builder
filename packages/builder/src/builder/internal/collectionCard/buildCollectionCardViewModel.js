import {
  buildCollectionMetrics,
  isEveningFocused,
} from "../intelligence/collectionMetrics.js";
import { SEASON_IDS, buildSeasonalEvidence } from "../intelligence/seasonalEvidence.js";

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
  const profileTraits = buildCollectionCardProfileTraits({
    selectedPerfumes,
    boxSummary,
    coverageSummary,
  });
  const dnaDescriptors = buildCollectionCardDnaItems({ boxSummary, scentDna })
    .slice(0, 3)
    .map((item) => formatLabel(item.label));
  const primaryDna = dnaDescriptors[0] || "";
  const title = collectionIdentity?.title;

  return {
    header: {
      businessName: config.brand?.businessName || "",
      heading: config.collectionCard.brandHeading,
      title,
      subtitle: collectionIdentity?.subtitle,
      mood: collectionIdentity?.mood || [],
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
      subtitle: collectionIdentity?.subtitle,
      mood: collectionIdentity?.mood || [],
      palette: collectionIdentity?.palette,
      archetype: collectionIdentity?.archetype,
    },
    dna: {
      descriptors: dnaDescriptors,
      primary: primaryDna,
    },
    coverage: {
      seasons: seasonRows,
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
      subtitle: collectionIdentity?.subtitle,
      mood: collectionIdentity?.mood || [],
      palette: collectionIdentity?.palette,
      fragranceCount: items.length,
      collectionPoints: totalPoints,
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
export function buildCollectionCardProfileTraits({ selectedPerfumes = [], boxSummary = {}, coverageSummary = { strengths: [] } } = {}) {
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

  if (profile.isBalancedRotation) {
    traits.push("Balanced Rotation");
  } else if (stars.versatility >= 4) {
    traits.push("Highly Versatile");
  }

  // Seasonal character comes right after the balance chip: it is the part of the story the radar also tells, and
  // the chips are capped (the card shows the first three), so it must not be the first thing cut.
  if (leansCool) {
    traits.push("Spring/Summer Specialist");
  }

  if (leansWarm) {
    traits.push("Fall/Winter Specialist");
  }

  if (profile.everydayShare >= 0.5) {
    traits.push("Office Friendly");
  }

  if (isEveningFocused(profile)) {
    traits.push("Evening Focused");
  }

  if (profile.lean === "fresh") {
    traits.push("Fresh-Leaning");
  }

  if (profile.lean === "warm") {
    traits.push("Warm-Leaning");
  }

  if (profile.dateNightCount >= 2 && profile.dateNightShare >= 0.35) {
    traits.push("Date Night Strong");
  }

  if (stars.breadth >= 4 && selectedCount >= 5) {
    traits.push("Collector Friendly");
  }

  if (stars.signature >= 4 && selectedCount >= 4) {
    traits.push("Coherent Signature");
  }

  if (traits.length === 0 && coverageSummary.strengths.length > 0) {
    traits.push(...coverageSummary.strengths.slice(0, 2).map((item) => item.label));
  }

  if (traits.length === 0) {
    traits.push(selectedCount < 3 ? "Taking Shape" : "Casual Heavy");
  }

  return uniqueStrings(traits).slice(0, 5);
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
