export const SEASONAL_SLOTS = Object.freeze([
  Object.freeze({ key: "spring", label: "Primavera" }),
  Object.freeze({ key: "summer", label: "Verano" }),
  Object.freeze({ key: "fall", label: "Otoño" }),
  Object.freeze({ key: "winter", label: "Invierno" }),
]);

function candidatesFor(catalog, season) {
  return catalog.filter((fragrance) => fragrance.seasons?.includes(season));
}

// The landing page opens on one canonical fragrance per season. Named by brand and display name -- not by catalog
// position -- so the catalog's presentation order (tier, brand, name) can never silently change which fragrances the
// landing page features first. A season whose canonical pick is missing or unavailable falls back to its first
// eligible fragrance, as before.
const CANONICAL_INITIAL_PICKS = Object.freeze({
  spring: Object.freeze({ brand: "Giorgio Armani", name: "Acqua di Gio EDT" }),
  summer: Object.freeze({ brand: "Dolce & Gabbana", name: "Light Blue Pour Homme EDT" }),
  fall: Object.freeze({ brand: "Montblanc", name: "Legend EDT" }),
  winter: Object.freeze({ brand: "Jean Paul Gaultier", name: "Le Male" }),
});

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
    const candidates = candidatesFor(catalog, key).filter((candidate) => !usedIds.has(candidate.id));
    const pick = CANONICAL_INITIAL_PICKS[key];
    const fragrance =
      candidates.find((candidate) => pick && candidate.brand === pick.brand && candidate.name === pick.name) ?? candidates[0];
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
