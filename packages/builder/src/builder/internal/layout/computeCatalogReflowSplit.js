// Determines how many catalog cards should stay in the narrow, panel-constrained
// grid column before the catalog reclaims the full row width. Row-based (not
// pixel-based) so the split always lands on a row boundary — never mid-row.
export function computeCatalogReflowSplit({
  panelHeight,
  cardHeight,
  columnCount,
  rowGap,
  totalCount,
}) {
  if (!Number.isFinite(totalCount) || totalCount <= 0) return 0;
  if (
    !Number.isFinite(panelHeight) ||
    panelHeight <= 0 ||
    !Number.isFinite(cardHeight) ||
    cardHeight <= 0 ||
    !Number.isFinite(columnCount) ||
    columnCount <= 0
  ) {
    return totalCount;
  }

  const rowHeight = cardHeight + (Number.isFinite(rowGap) ? rowGap : 0);
  const rowsInPanel = Math.ceil(panelHeight / rowHeight);
  const splitIndex = rowsInPanel * columnCount;

  return Math.min(Math.max(splitIndex, 0), totalCount);
}
