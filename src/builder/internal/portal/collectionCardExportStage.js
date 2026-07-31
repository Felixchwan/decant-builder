export function createCollectionCardExportStage(portalRoot) {
  if (!portalRoot?.isConnected || typeof portalRoot.ownerDocument?.createElement !== "function") {
    throw new Error("Collection Card export requires an active Builder portal root.");
  }

  const exportStage = portalRoot.ownerDocument.createElement("div");
  exportStage.className = "collection-card-export-stage";
  exportStage.setAttribute("aria-hidden", "true");
  portalRoot.appendChild(exportStage);
  return exportStage;
}

export function removeCollectionCardExportStage(exportStage) {
  if (exportStage?.parentNode) {
    exportStage.parentNode.removeChild(exportStage);
  }
}
