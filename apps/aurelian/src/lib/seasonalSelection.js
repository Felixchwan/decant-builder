export const SEASONAL_SLOTS = Object.freeze([
  Object.freeze({ key: "spring", label: "Primavera" }),
  Object.freeze({ key: "summer", label: "Verano" }),
  Object.freeze({ key: "fall", label: "Otoño" }),
  Object.freeze({ key: "winter", label: "Invierno" }),
]);

function candidatesFor(catalog, season) {
  return catalog.filter((fragrance) => fragrance.seasons?.includes(season));
}

function shuffle(items, random) {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}

export function createInitialSeasonalSelection(catalog) {
  const usedIds = new Set();
  return SEASONAL_SLOTS.map(({ key }) => {
    const fragrance = candidatesFor(catalog, key).find((candidate) => !usedIds.has(candidate.id));
    if (!fragrance) throw new Error(`No unique Aurelian fragrance is available for season: ${key}`);
    usedIds.add(fragrance.id);
    return fragrance;
  });
}

export function createSeasonalRotationState(catalog) {
  return {
    selection: createInitialSeasonalSelection(catalog),
    bags: Object.fromEntries(SEASONAL_SLOTS.map(({ key }) => [key, []])),
    nextSlot: 0,
  };
}

export function rotateSeasonalSelection(state, catalog, random = Math.random) {
  const slotIndex = state.nextSlot;
  const season = SEASONAL_SLOTS[slotIndex].key;
  const current = state.selection[slotIndex];
  const otherVisibleIds = new Set(state.selection.filter((_, index) => index !== slotIndex).map(({ id }) => id));
  const eligible = candidatesFor(catalog, season).filter(({ id }) => id !== current.id && !otherVisibleIds.has(id));
  let bag = state.bags[season].filter((id) => eligible.some((candidate) => candidate.id === id));
  if (!bag.length) bag = shuffle(eligible.map(({ id }) => id), random);
  if (!bag.length) return { ...state, nextSlot: (slotIndex + 1) % SEASONAL_SLOTS.length };
  const [nextId, ...remaining] = bag;
  const next = catalog.find(({ id }) => id === nextId);
  const selection = state.selection.map((fragrance, index) => index === slotIndex ? next : fragrance);
  return { selection, bags: { ...state.bags, [season]: remaining }, nextSlot: (slotIndex + 1) % SEASONAL_SLOTS.length };
}

export function shouldRotateSeasonalSelection({ reducedMotion, hovered, focusWithin, hidden }) {
  return !reducedMotion && !hovered && !focusWithin && !hidden;
}
