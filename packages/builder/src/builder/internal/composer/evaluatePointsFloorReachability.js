const CANDIDATE_MULTIPLIERS = Object.freeze([1, 2, 4, 5, 10, 20, 25, 50, 100, 1000]);
const MULTIPLIER_EPSILON = 1e-6;
// Sized against this domain's real bounds (~84 catalog items, remaining
// slots bounded by totalPhysicalSlots, coarse point tiers): a realistic
// worst case lands around 10-15k grid cells. 250,000 leaves ~20x headroom
// for catalog growth while still catching a genuinely pathological input
// (e.g. an unreasonably large budget paired with fine-grained pricing)
// before it costs real time.
const MAX_STATE_SPACE_CELLS = 250000;

/**
 * Determines whether an optional, caller-supplied lower aggregate-points
 * floor is already satisfied, still exactly reachable, or unreachable, given
 * the current collection and the legal remaining candidate universe.
 *
 * This is a feasibility test, never an approximation: floorReachable is
 * either provably true (a real legal subset exists) or provably false (none
 * does). If the exact computation would require a state space beyond what
 * this helper is designed to handle, it throws rather than degrading to an
 * optimistic guess — callers must not interpret a thrown error as
 * floorReachable: true.
 */
export function evaluatePointsFloorReachability({
  currentPoints,
  legalCandidates = [],
  remainingSlots,
  remainingBudget,
  pointsFloor,
}) {
  if (pointsFloor === null || pointsFloor === undefined) {
    return { applicable: false, floorMet: null, floorReachable: null };
  }

  if (!Number.isFinite(currentPoints) || currentPoints >= pointsFloor) {
    return { applicable: true, floorMet: true, floorReachable: true };
  }

  const safeCandidatePoints = (Array.isArray(legalCandidates) ? legalCandidates : [])
    .map((perfume) => perfume?.points)
    .filter((points) => typeof points === "number" && Number.isFinite(points) && points >= 0);
  const safeRemainingSlots = Number.isFinite(remainingSlots)
    ? Math.max(0, Math.trunc(remainingSlots))
    : 0;
  const needed = pointsFloor - currentPoints;

  if (safeRemainingSlots === 0 || safeCandidatePoints.length === 0) {
    return { applicable: true, floorMet: false, floorReachable: false };
  }

  const totalCandidatePoints = safeCandidatePoints.reduce((sum, points) => sum + points, 0);
  const effectiveCeiling = Number.isFinite(remainingBudget)
    ? Math.max(0, Math.min(remainingBudget, totalCandidatePoints))
    : totalCandidatePoints;

  if (needed > effectiveCeiling + MULTIPLIER_EPSILON) {
    return { applicable: true, floorMet: false, floorReachable: false };
  }

  const multiplier = findExactIntegerMultiplier([
    ...safeCandidatePoints,
    effectiveCeiling,
    needed,
  ]);

  if (multiplier === null) {
    throw new Error(
      "Composer points-floor reachability could not be evaluated exactly: no supported " +
        "integer precision scale represents the current candidate points, budget, and floor " +
        "values. This is a defensive guard, not expected in production data — see " +
        "evaluatePointsFloorReachability.js."
    );
  }

  const scaledCeiling = Math.round(effectiveCeiling * multiplier);
  const scaledNeeded = Math.round(needed * multiplier);
  const scaledCandidates = safeCandidatePoints
    .map((points) => Math.round(points * multiplier))
    .filter((points) => points <= scaledCeiling);
  const usableSlots = Math.min(safeRemainingSlots, scaledCandidates.length);
  const stateSpaceCells = (usableSlots + 1) * (scaledCeiling + 1);

  if (stateSpaceCells > MAX_STATE_SPACE_CELLS) {
    throw new Error(
      `Composer points-floor reachability exceeded the supported exact state-space size ` +
        `(${stateSpaceCells} cells, limit ${MAX_STATE_SPACE_CELLS}). This is a defensive ` +
        `guard against pathological inputs, not expected in production data — see ` +
        `evaluatePointsFloorReachability.js.`
    );
  }

  const floorReachable = exactSubsetReachable({
    scaledCandidates,
    maxCount: usableSlots,
    maxSum: scaledCeiling,
    targetSum: scaledNeeded,
  });

  return { applicable: true, floorMet: false, floorReachable };
}

function findExactIntegerMultiplier(values) {
  return (
    CANDIDATE_MULTIPLIERS.find((multiplier) =>
      values.every((value) => {
        const scaled = value * multiplier;
        return Math.abs(scaled - Math.round(scaled)) < MULTIPLIER_EPSILON;
      })
    ) ?? null
  );
}

// Bounded 0/1 subset-sum reachability, exact: does some subset of at most
// maxCount scaledCandidates sum to a value in [targetSum, maxSum]? Only the
// boolean "is this sum achievable with at most k items" grid is needed, not
// the achieving subsets themselves, and the search stops the moment a
// passing sum is found.
function exactSubsetReachable({ scaledCandidates, maxCount, maxSum, targetSum }) {
  if (targetSum <= 0) {
    return true;
  }

  if (maxSum < 0 || maxCount <= 0) {
    return false;
  }

  const reachable = Array.from({ length: maxCount + 1 }, () => new Uint8Array(maxSum + 1));
  reachable.forEach((row) => {
    row[0] = 1;
  });

  for (const points of scaledCandidates) {
    if (points < 0 || points > maxSum) {
      continue;
    }

    for (let k = maxCount; k >= 1; k -= 1) {
      const previousRow = reachable[k - 1];
      const currentRow = reachable[k];

      for (let sum = maxSum - points; sum >= 0; sum -= 1) {
        if (previousRow[sum] && !currentRow[sum + points]) {
          currentRow[sum + points] = 1;
        }
      }
    }

    for (let k = 0; k <= maxCount; k += 1) {
      const row = reachable[k];

      for (let sum = targetSum; sum <= maxSum; sum += 1) {
        if (row[sum]) {
          return true;
        }
      }
    }
  }

  for (let k = 0; k <= maxCount; k += 1) {
    const row = reachable[k];

    for (let sum = targetSum; sum <= maxSum; sum += 1) {
      if (row[sum]) {
        return true;
      }
    }
  }

  return false;
}
