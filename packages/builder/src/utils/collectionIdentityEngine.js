const EMPTY_PROFILE = {
  id: "in-progress",
  title: "Collection In Progress",
  subtitle: "A curated fragrance story begins with the first selection.",
  mood: ["First impression", "Open canvas", "Curator's table"],
  palette: "balanced",
  archetype: "in-progress",
};

const IDENTITY_LIBRARY = [
  {
    id: "fresh-daily",
    archetype: "fresh",
    title: "Fresh Daily Rotation",
    palette: "fresh",
    targetProfile: {
      freshness: 90,
      warmth: 18,
      evening: 20,
      office: 72,
      versatility: 70,
      signature: 38,
      luxury: 35,
      seasonSpread: 68,
      occasionSpread: 60,
    },
    subtitle:
      "Built around sparkling citrus, clean texture, and effortless daily wear.",
    mood: ["Coastal breeze", "White linen", "Golden afternoon"],
  },
  {
    id: "mediterranean",
    archetype: "fresh",
    title: "Mediterranean Rotation",
    palette: "fresh",
    targetProfile: {
      freshness: 92,
      warmth: 28,
      evening: 18,
      office: 45,
      versatility: 58,
      signature: 30,
      luxury: 42,
      seasonSpread: 62,
      occasionSpread: 48,
    },
    subtitle:
      "Shaped by sunlit citrus, aromatic lift, and a relaxed coastal character.",
    mood: ["Sea air", "Citrus grove", "Linen terrace"],
  },
  {
    id: "balanced",
    archetype: "balanced",
    title: "Balanced Rotation",
    palette: "balanced",
    targetProfile: {
      freshness: 58,
      warmth: 54,
      evening: 48,
      office: 52,
      versatility: 82,
      signature: 48,
      luxury: 46,
      seasonSpread: 88,
      occasionSpread: 82,
    },
    subtitle:
      "Composed for range, easy transitions, and confident year-round wear.",
    mood: ["Clean wardrobe", "Open calendar", "Soft polish"],
  },
  {
    id: "everyday-luxury",
    archetype: "balanced",
    title: "Everyday Luxury",
    palette: "balanced",
    targetProfile: {
      freshness: 48,
      warmth: 42,
      evening: 36,
      office: 82,
      versatility: 76,
      signature: 62,
      luxury: 78,
      seasonSpread: 72,
      occasionSpread: 68,
    },
    subtitle:
      "Curated for polished daily presence, refined comfort, and effortless confidence.",
    mood: ["Soft tailoring", "Morning espresso", "Quiet confidence"],
  },
  {
    id: "executive",
    archetype: "office",
    title: "Executive Rotation",
    palette: "office",
    targetProfile: {
      freshness: 54,
      warmth: 30,
      evening: 28,
      office: 92,
      versatility: 76,
      signature: 56,
      luxury: 58,
      seasonSpread: 62,
      occasionSpread: 72,
    },
    subtitle:
      "Tailored for polished workdays, crisp presence, and controlled elegance.",
    mood: ["Tailored suit", "Clear agenda", "Quiet command"],
  },
  {
    id: "refined",
    archetype: "office",
    title: "Refined Collection",
    palette: "office",
    targetProfile: {
      freshness: 45,
      warmth: 42,
      evening: 38,
      office: 78,
      versatility: 68,
      signature: 70,
      luxury: 68,
      seasonSpread: 58,
      occasionSpread: 66,
    },
    subtitle:
      "Built for composed sophistication, smooth detail, and restrained presence.",
    mood: ["Pressed collar", "Walnut desk", "Calm precision"],
  },
  {
    id: "evening",
    archetype: "evening",
    title: "Evening Rotation",
    palette: "warm",
    targetProfile: {
      freshness: 22,
      warmth: 86,
      evening: 88,
      office: 28,
      versatility: 48,
      signature: 58,
      luxury: 56,
      seasonSpread: 52,
      occasionSpread: 55,
    },
    subtitle:
      "Crafted for amber warmth, rich textures, and memorable nights.",
    mood: ["Velvet", "City lights", "Late-night cocktails"],
  },
  {
    id: "golden-hour",
    archetype: "evening",
    title: "Golden Hour Collection",
    palette: "warm",
    targetProfile: {
      freshness: 42,
      warmth: 82,
      evening: 68,
      office: 36,
      versatility: 55,
      signature: 50,
      luxury: 62,
      seasonSpread: 58,
      occasionSpread: 54,
    },
    subtitle:
      "Composed around amber warmth, soft glow, and relaxed after-hours depth.",
    mood: ["Amber light", "Suede jacket", "Terrace sunset"],
  },
  {
    id: "signature",
    archetype: "signature",
    title: "Signature Collection",
    palette: "signature",
    targetProfile: {
      freshness: 28,
      warmth: 64,
      evening: 70,
      office: 34,
      versatility: 46,
      signature: 92,
      luxury: 76,
      seasonSpread: 48,
      occasionSpread: 50,
    },
    subtitle:
      "Designed around distinctive presence, deep texture, and lasting character.",
    mood: ["Old library", "Leather chair", "Midnight elegance"],
  },
  {
    id: "collector",
    archetype: "signature",
    title: "Collector's Selection",
    palette: "signature",
    targetProfile: {
      freshness: 42,
      warmth: 66,
      evening: 62,
      office: 42,
      versatility: 62,
      signature: 80,
      luxury: 90,
      seasonSpread: 72,
      occasionSpread: 72,
    },
    subtitle:
      "Curated for range, rarity, and a more expressive fragrance wardrobe.",
    mood: ["Private cabinet", "Rare textures", "Collector's eye"],
  },
];

const IDENTITY_WEIGHTS = {
  freshness: 1.25,
  warmth: 1,
  evening: 1.15,
  office: 1.1,
  versatility: 0.9,
  signature: 1.1,
  luxury: 0.85,
  seasonSpread: 0.7,
  occasionSpread: 0.75,
};

export function getCollectionIdentityProfile(boxSummary = {}) {
  const analysis = analyzeCollection(boxSummary);

  if (analysis.collectionSize === 0) {
    return EMPTY_PROFILE;
  }

  const identity = chooseIdentity(analysis);

  return {
    id: identity.id,
    title: identity.title,
    subtitle: identity.subtitle,
    mood: identity.mood,
    palette: identity.palette,
    archetype: identity.archetype,
  };
}

export function getCollectionIdentityCandidates(boxSummary = {}) {
  const analysis = analyzeCollection(boxSummary);

  if (analysis.collectionSize === 0) {
    return [];
  }

  return scoreIdentityCandidates(analysis).slice(0, 5).map(({ identity, distance }) => ({
    id: identity.id,
    title: identity.title,
    archetype: identity.archetype,
    palette: identity.palette,
    score: Math.max(0, Math.round(10000 - distance)),
  }));
}

export function getCollectionIdentityAnalysis(boxSummary = {}) {
  return analyzeCollection(boxSummary);
}

function analyzeCollection(boxSummary = {}) {
  const occasionCounts = boxSummary.occasionCounts || {};
  const vibeCounts = boxSummary.vibeCounts || {};
  const seasonCounts = boxSummary.seasonCounts || {};
  const accordCounts = getAccordCounts(boxSummary);
  const collectionSize = inferCollectionSize({
    occasionCounts,
    vibeCounts,
    seasonCounts,
    accordCounts,
  });
  const seasons = boxSummary.seasons || [];
  const occasions = boxSummary.occasions || [];
  const seasonStrengths = boxSummary.seasonStrengths || seasonCounts;

  return {
    collectionSize,
    scores: {
      freshness: normalizeSignal(
        sumCounts(vibeCounts, ["fresh", "clean", "bright", "green"]) +
          sumCounts(occasionCounts, ["office", "daily", "casual"]) +
          sumCounts(accordCounts, [
            "citrus",
            "aromatic",
            "fresh spicy",
            "fresh",
            "green",
            "aquatic",
            "marine",
          ]),
        collectionSize,
        4.2
      ),
      warmth: normalizeSignal(
        sumCounts(vibeCounts, ["cozy", "warm", "bold"]) +
          sumCounts(accordCounts, [
            "amber",
            "warm spicy",
            "vanilla",
            "sweet",
            "tobacco",
            "smoky",
          ]),
        collectionSize,
        3.4
      ),
      evening: normalizeSignal(
        sumCounts(occasionCounts, ["date", "night", "evening"]) +
          sumCounts(vibeCounts, ["seductive", "bold", "cozy", "dark"]) +
          sumCounts(accordCounts, ["amber", "warm spicy", "vanilla", "tobacco"]),
        collectionSize,
        3.4
      ),
      office: normalizeSignal(
        sumCounts(occasionCounts, ["office", "daily"]) +
          sumCounts(vibeCounts, ["clean", "fresh", "elegant"]) +
          sumCounts(accordCounts, ["aromatic", "iris", "powdery"]),
        collectionSize,
        3.2
      ),
      versatility: normalizeSpread({
        seasonCount: seasons.length,
        occasionCount: occasions.length,
        vibeCount: (boxSummary.vibes || []).length,
      }),
      signature: normalizeSignal(
        sumCounts(occasionCounts, ["formal", "date", "night"]) +
          sumCounts(vibeCounts, ["elegant", "dark", "bold", "seductive"]) +
          sumCounts(accordCounts, ["leather", "smoky", "oud", "iris", "woody"]),
        collectionSize,
        3.6
      ),
      luxury: normalizeSignal(
        sumCounts(vibeCounts, ["elegant", "luxury", "rich", "bold"]) +
          sumCounts(accordCounts, [
            "iris",
            "leather",
            "oud",
            "amber",
            "tobacco",
            "woody",
            "powdery",
          ]),
        collectionSize,
        3.8
      ),
      seasonSpread: normalizeSeasonSpread(seasonStrengths),
      occasionSpread: normalizeOccasionSpread(occasions.length),
    },
  };
}

function chooseIdentity(analysis) {
  return scoreIdentityCandidates(analysis)[0].identity;
}

function scoreIdentityCandidates(analysis) {
  return IDENTITY_LIBRARY.filter((identity) =>
    identity.eligibility ? identity.eligibility(analysis.scores) : true
  ).map((identity) => ({
    identity,
    distance:
      getWeightedDistance(analysis.scores, identity.targetProfile) +
      getIdentityFitAdjustment(identity, analysis.scores),
  })).sort((first, second) => first.distance - second.distance);
}

function getIdentityFitAdjustment(identity, scores) {
  const primaryScores = [
    scores.freshness,
    scores.warmth,
    scores.evening,
    scores.office,
    scores.signature,
  ];
  const signalSpread = Math.max(...primaryScores) - Math.min(...primaryScores);
  const hasBroadCoverage =
    scores.versatility >= 60 &&
    scores.seasonSpread >= 50 &&
    scores.occasionSpread >= 45;

  if (identity.id === "balanced" && hasBroadCoverage && signalSpread <= 62) {
    return -900;
  }

  if (
    identity.id === "executive" &&
    scores.office >= 75 &&
    scores.signature >= 45 &&
    scores.luxury < 70 &&
    signalSpread >= 70
  ) {
    return -1200;
  }

  if (
    identity.id === "everyday-luxury" &&
    (scores.office < 70 || scores.luxury < 66)
  ) {
    return 900;
  }

  return 0;
}

function getWeightedDistance(scores, target) {
  return Object.entries(IDENTITY_WEIGHTS).reduce((distance, [key, weight]) => {
    const delta = (scores[key] || 0) - (target[key] || 0);
    return distance + Math.pow(delta, 2) * weight;
  }, 0);
}

function getAccordCounts(boxSummary = {}) {
  return Object.fromEntries(
    Object.entries(boxSummary.accordMap || {}).map(([accord, perfumes]) => [
      accord,
      perfumes.length,
    ])
  );
}

function inferCollectionSize({ occasionCounts, vibeCounts, seasonCounts, accordCounts }) {
  return Math.max(
    0,
    ...Object.values(occasionCounts),
    ...Object.values(vibeCounts),
    ...Object.values(seasonCounts),
    ...Object.values(accordCounts)
  );
}

function normalizeSignal(signal, collectionSize, expectedPerFragrance) {
  if (collectionSize <= 0) {
    return 0;
  }

  return clampScore((signal / (collectionSize * expectedPerFragrance)) * 100);
}

function normalizeSpread({ seasonCount, occasionCount, vibeCount }) {
  return clampScore(
    (Math.min(seasonCount / 4, 1) * 34 +
      Math.min(occasionCount / 8, 1) * 38 +
      Math.min(vibeCount / 14, 1) * 28)
  );
}

function normalizeSeasonSpread(seasonStrengths = {}) {
  const values = ["spring", "summer", "fall", "winter"].map(
    (season) => seasonStrengths[season] || 0
  );
  const total = values.reduce((sum, value) => sum + value, 0);

  if (total <= 0) {
    return 0;
  }

  const activeSeasonRatio = values.filter((value) => value > 0).length / 4;
  const ideal = total / 4;
  const imbalance =
    values.reduce((sum, value) => sum + Math.abs(value - ideal), 0) / total;

  return clampScore(activeSeasonRatio * 45 + (1 - imbalance) * 55);
}

function normalizeOccasionSpread(occasionCount) {
  return clampScore((Math.min(occasionCount, 8) / 8) * 100);
}

function sumCounts(counts, keys) {
  return keys.reduce((sum, key) => sum + (counts[key] || 0), 0);
}

function clampScore(value) {
  return Math.max(0, Math.min(100, Math.round(value)));
}
