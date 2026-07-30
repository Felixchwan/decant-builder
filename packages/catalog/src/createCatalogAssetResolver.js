function validateAssetKey(assetKey) {
  if (
    typeof assetKey !== "string" ||
    assetKey.trim().length === 0 ||
    assetKey !== assetKey.trim()
  ) {
    throw new TypeError("Catalog asset keys must be non-empty strings.");
  }

  if (
    assetKey.startsWith("/") ||
    assetKey.includes("\\") ||
    assetKey.includes("?") ||
    assetKey.includes("#") ||
    /^[a-z][a-z\d+.-]*:/i.test(assetKey)
  ) {
    throw new TypeError(`Invalid catalog asset key: ${assetKey}`);
  }

  const segments = assetKey.split("/");
  if (segments.some((segment) => segment === "" || segment === "." || segment === "..")) {
    throw new TypeError(`Invalid catalog asset key: ${assetKey}`);
  }
}

export function createCatalogAssetResolver({ basePath } = {}) {
  if (typeof basePath !== "string" || basePath.trim().length === 0) {
    throw new TypeError("Catalog asset resolver requires a non-empty basePath.");
  }

  const normalizedBasePath = basePath.trim().replace(/\/+$/, "");

  return function resolveCatalogAsset(assetKey) {
    validateAssetKey(assetKey);
    return `${normalizedBasePath}/${assetKey}`;
  };
}
