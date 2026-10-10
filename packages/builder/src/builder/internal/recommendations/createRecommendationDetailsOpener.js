// What a recommendation lane's perfume summary calls: opens that perfume's details, scoped to the lane's
// own recommendations in carousel order (so Previous / Next in the details walks the picks the user is
// looking at, never the whole catalog). Without a host handler there is no opener at all, and the card
// renders exactly as it always has.
export function createRecommendationDetailsOpener(onOpenPerfumeDetails, recommendations) {
  if (typeof onOpenPerfumeDetails !== "function") {
    return undefined;
  }

  const orderedPerfumeIds = (Array.isArray(recommendations) ? recommendations : []).map(
    (recommendation) => recommendation.perfume.id
  );

  return (perfume) => onOpenPerfumeDetails(perfume.id, orderedPerfumeIds);
}
