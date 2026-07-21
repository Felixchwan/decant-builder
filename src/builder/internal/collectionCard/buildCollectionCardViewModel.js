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
    boxSummary,
    coverageSummary,
    scentDna,
    selectedCount: items.length,
    seasonRows,
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

export function buildCollectionCardProfileTraits({
  boxSummary,
  coverageSummary,
  scentDna,
  selectedCount,
  seasonRows,
}) {
  if (selectedCount === 0) {
    return [];
  }

  const traits = [];
  const occasionCounts = boxSummary.occasionCounts || {};
  const vibeCounts = boxSummary.vibeCounts || {};
  const accordCounts = getAccordCounts(boxSummary);
  const profileSignals = getBoxProfileSignals({
    occasionCounts,
    vibeCounts,
    accordCounts,
  });
  const versatilityScore = scentDna?.scores?.versatility || 0;
  const depthScore = scentDna?.scores?.depth || 0;
  const seasonBalanceScore = scentDna?.scores?.seasonBalance || 0;
  const springScore = seasonRows.find((season) => season.id === "spring")?.count || 0;
  const summerScore = seasonRows.find((season) => season.id === "summer")?.count || 0;
  const fallScore = seasonRows.find((season) => season.id === "fall")?.count || 0;
  const winterScore = seasonRows.find((season) => season.id === "winter")?.count || 0;
  const dailySignals = (occasionCounts.daily || 0) + (occasionCounts.office || 0);
  const eveningSignals =
    (occasionCounts.date || 0) +
    (occasionCounts.night || 0) +
    (occasionCounts.evening || 0);

  if (versatilityScore >= 78 && seasonBalanceScore >= 62) {
    traits.push("Balanced Rotation");
  } else if (versatilityScore >= 72) {
    traits.push("Highly Versatile");
  }

  if (dailySignals >= 3 || (occasionCounts.office || 0) >= 2) {
    traits.push("Office Friendly");
  }

  if (eveningSignals >= 3 || profileSignals.warmEvening >= profileSignals.fresh + 2) {
    traits.push("Evening Focused");
  }

  if (profileSignals.fresh >= profileSignals.warmEvening + 2) {
    traits.push("Fresh-Leaning");
  }

  if (profileSignals.warmEvening >= profileSignals.fresh + 2) {
    traits.push("Warm-Leaning");
  }

  if ((occasionCounts.date || 0) + (occasionCounts.night || 0) >= 2) {
    traits.push("Date Night Strong");
  }

  if (springScore + summerScore >= fallScore + winterScore + 24) {
    traits.push("Spring/Summer Specialist");
  }

  if (fallScore >= 55 && winterScore >= 45) {
    traits.push("Autumn Specialist");
  }

  if (depthScore >= 70 && selectedCount >= 5) {
    traits.push("Collector Friendly");
  }

  if (versatilityScore >= 70 && depthScore >= 58 && selectedCount >= 4) {
    traits.push("Signature Ready");
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

export function buildCollectionCardSeasonRows(seasonCounts, selectedCount = 0) {
  const seasons = ["spring", "summer", "fall", "winter"];
  const maxSeasonStrength = Math.max(1, selectedCount * 10);

  return seasons.map((season) => {
    const strength = seasonCounts[season] || 0;
    const score = Math.round((strength / maxSeasonStrength) * 100);

    return {
      id: season,
      label: formatLabel(season),
      count: score,
      strength,
      percent: score,
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

function getBoxProfileSignals({ occasionCounts, vibeCounts, accordCounts }) {
  const fresh =
    (vibeCounts.fresh || 0) +
    (vibeCounts.clean || 0) +
    (accordCounts.citrus || 0) +
    (accordCounts.fresh || 0) +
    (accordCounts.green || 0) +
    (accordCounts.aquatic || 0) +
    (accordCounts.marine || 0);
  const warmEvening =
    (vibeCounts.warm || 0) +
    (vibeCounts.sweet || 0) +
    (accordCounts.amber || 0) +
    (accordCounts.vanilla || 0) +
    (accordCounts.spicy || 0) +
    (accordCounts.tobacco || 0) +
    (accordCounts.leather || 0) +
    (occasionCounts.date || 0) +
    (occasionCounts.night || 0) +
    (occasionCounts.evening || 0);

  return {
    fresh,
    warmEvening,
  };
}

function getAccordCounts(boxSummary) {
  return boxSummary.accordCounts || boxSummary.accordMap || {};
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
