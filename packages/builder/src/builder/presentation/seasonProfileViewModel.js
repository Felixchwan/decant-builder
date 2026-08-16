export const SEASON_AXIS_ORDER = ["spring", "summer", "fall", "winter"];
const SEASON_AXIS_POINTS = {
  spring: { x: 50, y: 10 },
  summer: { x: 90, y: 50 },
  fall: { x: 50, y: 90 },
  winter: { x: 10, y: 50 },
};
const SEASON_CENTER = { x: 50, y: 50 };
const SEASON_MAX_RADIUS = 34;

export function buildSeasonProfileViewModel({ seasonRows = [], translator } = {}) {
  const rowsById = new Map(
    seasonRows.map((season) => [
      season.id,
      {
        id: season.id,
        label: translator?.label?.("seasons", season.id) || season.label || season.id,
        score: clampSeasonScore(season.count ?? season.percent ?? 0),
      },
    ])
  );
  const axes = SEASON_AXIS_ORDER.map((seasonId) => {
    const row = rowsById.get(seasonId) || {
      id: seasonId,
      label: translator?.label?.("seasons", seasonId) || seasonId,
      score: 0,
    };
    return {
      ...row,
      axis: SEASON_AXIS_POINTS[seasonId],
      point: getSeasonPolygonPoint(SEASON_AXIS_POINTS[seasonId], row.score),
    };
  });
  const activeAxes = axes.filter((axis) => axis.score > 0);
  const polygonPoints = axes.map((axis) => `${axis.point.x},${axis.point.y}`).join(" ");
  const summary = buildSeasonProfileSummary({ axes, activeAxes, translator });

  return {
    axes,
    polygonPoints,
    isEmpty: activeAxes.length === 0,
    summary,
    accessibleSummary: summary.accessibleLabel,
  };
}

function buildSeasonProfileSummary({ axes, activeAxes, translator }) {
  if (activeAxes.length === 0) {
    return {
      label:
        translator?.t?.("collectionIntelligence.seasonProfileEmpty") ||
        "Add fragrances to reveal seasonal shape.",
      accessibleLabel:
        translator?.t?.("collectionIntelligence.seasonProfileEmptyA11y") ||
        "No seasonal profile is available yet.",
    };
  }

  const sorted = [...axes].sort((a, b) => {
    const scoreDelta = b.score - a.score;
    if (scoreDelta !== 0) {
      return scoreDelta;
    }
    return SEASON_AXIS_ORDER.indexOf(a.id) - SEASON_AXIS_ORDER.indexOf(b.id);
  });
  const scores = axes.map((axis) => axis.score);
  const maxScore = Math.max(...scores);
  const minActiveScore = Math.min(...activeAxes.map((axis) => axis.score));
  const top = sorted[0];
  const second = sorted[1];
  const isBalanced = activeAxes.length === axes.length && maxScore - minActiveScore <= 14 && maxScore >= 35;
  const isPair = second && top.score - second.score <= 10 && areAdjacentSeasons(top.id, second.id);

  if (isBalanced) {
    return {
      label:
        translator?.t?.("collectionIntelligence.seasonProfileBalanced") ||
        "Balanced across seasons",
      accessibleLabel:
        translator?.t?.("collectionIntelligence.seasonProfileBalancedA11y") ||
        "Season profile is balanced across spring, summer, fall, and winter.",
    };
  }

  if (isPair) {
    return {
      label:
        translator?.t?.("collectionIntelligence.seasonProfilePair", {
          seasonOne: top.label,
          seasonTwo: second.label,
        }) || `Leans ${top.label} and ${second.label}`,
      accessibleLabel:
        translator?.t?.("collectionIntelligence.seasonProfilePairA11y", {
          seasonOne: top.label,
          seasonTwo: second.label,
        }) || `Season profile leans toward ${top.label} and ${second.label}.`,
    };
  }

  return {
    label:
      translator?.t?.("collectionIntelligence.seasonProfileSingle", {
        season: top.label,
      }) || `Leans ${top.label}`,
    accessibleLabel:
      translator?.t?.("collectionIntelligence.seasonProfileSingleA11y", {
        season: top.label,
      }) || `Season profile leans toward ${top.label}.`,
  };
}

function areAdjacentSeasons(firstSeason, secondSeason) {
  const firstIndex = SEASON_AXIS_ORDER.indexOf(firstSeason);
  const secondIndex = SEASON_AXIS_ORDER.indexOf(secondSeason);

  if (firstIndex === -1 || secondIndex === -1) {
    return false;
  }

  return Math.abs(firstIndex - secondIndex) === 1 || Math.abs(firstIndex - secondIndex) === 3;
}

function getSeasonPolygonPoint(axisPoint, score) {
  const scale = clampSeasonScore(score) / 100;
  const vectorX = axisPoint.x - SEASON_CENTER.x;
  const vectorY = axisPoint.y - SEASON_CENTER.y;
  const vectorLength = Math.hypot(vectorX, vectorY) || 1;

  return {
    x: roundSvgCoordinate(SEASON_CENTER.x + (vectorX / vectorLength) * SEASON_MAX_RADIUS * scale),
    y: roundSvgCoordinate(SEASON_CENTER.y + (vectorY / vectorLength) * SEASON_MAX_RADIUS * scale),
  };
}

function clampSeasonScore(score) {
  return Math.max(0, Math.min(100, Number.isFinite(Number(score)) ? Number(score) : 0));
}

function roundSvgCoordinate(value) {
  return Math.round(value * 100) / 100;
}
