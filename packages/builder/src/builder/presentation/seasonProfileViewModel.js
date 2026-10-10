import { SEASON_IDS, describeSeasonalLevels } from "../internal/intelligence/seasonalEvidence.js";

export const SEASON_AXIS_ORDER = [...SEASON_IDS];
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

// The conclusion under the radar. It is the shared seasonal shape (seasonalEvidence.js) that the "Season
// Balance" stars and the season gaps also read, computed from the very levels the radar plots: "Balanced across
// seasons" is exactly the 4-5 star band, and a box that is not balanced is described by the season(s) it leans on.
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

  const { shape } = describeSeasonalLevels(
    Object.fromEntries(axes.map((axis) => [axis.id, axis.score]))
  );
  const labelOf = (seasonId) => axes.find((axis) => axis.id === seasonId)?.label || seasonId;

  if (shape.kind === "balanced") {
    return {
      label:
        translator?.t?.("collectionIntelligence.seasonProfileBalanced") ||
        "Balanced across seasons",
      accessibleLabel:
        translator?.t?.("collectionIntelligence.seasonProfileBalancedA11y") ||
        "Season profile is balanced across spring, summer, fall, and winter.",
    };
  }

  if (shape.kind === "pair") {
    const [first, second] = shape.seasons.map(labelOf);

    return {
      label:
        translator?.t?.("collectionIntelligence.seasonProfilePair", {
          seasonOne: first,
          seasonTwo: second,
        }) || `Leans ${first} and ${second}`,
      accessibleLabel:
        translator?.t?.("collectionIntelligence.seasonProfilePairA11y", {
          seasonOne: first,
          seasonTwo: second,
        }) || `Season profile leans toward ${first} and ${second}.`,
    };
  }

  const season = labelOf(shape.seasons[0]);

  return {
    label:
      translator?.t?.("collectionIntelligence.seasonProfileSingle", {
        season,
      }) || `Leans ${season}`,
    accessibleLabel:
      translator?.t?.("collectionIntelligence.seasonProfileSingleA11y", {
        season,
      }) || `Season profile leans toward ${season}.`,
  };
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
