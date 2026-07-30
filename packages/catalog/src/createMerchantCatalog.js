// Pure merchant projection boundary for canonical fragrance records.
export function createMerchantCatalog({ source, availableIds } = {}) {
  if (!Array.isArray(source)) {
    throw new TypeError("createMerchantCatalog source must be an array.");
  }

  if (!Array.isArray(availableIds)) {
    throw new TypeError("createMerchantCatalog availableIds must be an array.");
  }

  const sourceById = new Map();

  for (const record of source) {
    const id = record?.id;
    assertFiniteId(id, "source");

    if (sourceById.has(id)) {
      throw new Error(`createMerchantCatalog source contains duplicate ID ${id}.`);
    }

    sourceById.set(id, record);
  }

  const seenAvailableIds = new Set();

  return availableIds.map((id) => {
    assertFiniteId(id, "availableIds");

    if (seenAvailableIds.has(id)) {
      throw new Error(`createMerchantCatalog availableIds contains duplicate ID ${id}.`);
    }
    seenAvailableIds.add(id);

    if (!sourceById.has(id)) {
      throw new Error(`createMerchantCatalog availableIds contains unknown ID ${id}.`);
    }

    return sourceById.get(id);
  });
}

function assertFiniteId(id, owner) {
  if (typeof id !== "number" || !Number.isFinite(id)) {
    throw new TypeError(
      `createMerchantCatalog ${owner} contains invalid ID ${String(id)}; IDs must be finite numbers.`
    );
  }
}
