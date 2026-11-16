import { DEFAULT_CUSTOMER_PRICING } from "../utils/customerPricing.js";

// A fragrance's price as customers read it inline ("Brand - $500"), with promotional pricing when the fragrance has a valid sale (see
// utils/customerPricing.js, which alone decides what is valid).
//
// WITHOUT a valid sale this is exactly the text it has always been: `pricing.formatPoints(perfume.points)` as a plain string, no
// element, no class. WITH one it is the regular price, smaller and struck through, then the special price, with the promotion and
// both prices spoken in words for assistive technology (the visible pair is hidden from it), so the sale never depends on the
// strikethrough alone. The look is the host's: a host that never has a sale never reaches the second branch, and one that does
// styles `.fragrance-price*`.
export default function FragrancePrice({ perfume, pricing = DEFAULT_CUSTOMER_PRICING }) {
  const price = pricing.getFragrancePrice(perfume);

  if (!price.isOnSale) {
    return pricing.formatPoints(perfume.points);
  }

  return (
    <span className="fragrance-price fragrance-price--sale">
      <span className="fragrance-price__sr">{pricing.formatSaleForAssistiveTech(perfume)}</span>
      <s className="fragrance-price__regular" aria-hidden="true">
        {pricing.formatAmount(price.regularAmount)}
      </s>{" "}
      <span className="fragrance-price__special" aria-hidden="true">
        {pricing.formatAmount(price.effectiveAmount)}
      </span>
    </span>
  );
}
