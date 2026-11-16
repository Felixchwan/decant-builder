import { aurelianPricing, formatFragrancePrice } from "../merchant/pricing.js";

// A fragrance's price on the landing's seasonal cards. Without a valid promotion it is exactly the plain `<span>$NNN</span>` it has
// always been; with one, the regular price (smaller, struck through) and the special price, with both prices and the promotion
// spoken in words so the sale never depends on the strikethrough alone.
export function FragranceSalePrice({ item }) {
  const price = aurelianPricing.getFragrancePrice(item);

  if (!price.isOnSale) {
    return <span>{formatFragrancePrice(item.points)}</span>;
  }

  return (
    <span className="fragrance-price fragrance-price--sale">
      <span className="fragrance-price__sr">{aurelianPricing.formatSaleForAssistiveTech(item)}</span>
      <s aria-hidden="true" className="fragrance-price__regular">{aurelianPricing.formatAmount(price.regularAmount)}</s>{" "}
      <span aria-hidden="true" className="fragrance-price__special">{aurelianPricing.formatAmount(price.effectiveAmount)}</span>
    </span>
  );
}
