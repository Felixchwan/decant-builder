// Aurelian's promotional (special) pricing, by stable fragrance ID. This is the ONLY place a promotion is switched on, and it is
// merchant data: the shared catalog never carries a sale, and no fragrance's regular price (points x pointValue) is ever changed.
//
//   [fragranceId]: { active: true, price: 400, label: "Oferta especial" }
//
//   active   true to run the promotion, false (or removing the entry) to stop it; nothing else needs to change
//   price    the special price in MXN. It is honoured only when it is a number greater than 0 and strictly lower than the regular
//            price (the Builder's pricing resolver decides, see customerPricing.js); anything else is ignored and the regular price
//            is charged and shown
//   label    optional name of the promotion; absent, the default "Oferta especial" is used
//
// No promotion is running: this is empty on purpose. To run one, add an entry here, for example `502: { active: true, price: 400 }`.
export const aurelianPromotions = Object.freeze({});

// The catalog with each promotion attached to its fragrance as `sale`. A fragrance without a promotion is returned as the very same
// record, so an empty table changes nothing at all.
export function applyPromotions(catalog, promotions = aurelianPromotions) {
  return catalog.map((perfume) => (Object.hasOwn(promotions, perfume.id) ? { ...perfume, sale: promotions[perfume.id] } : perfume));
}
