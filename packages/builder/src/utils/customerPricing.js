// Customer-facing price presentation, opt-in per host via `commerce.priceDisplay`.
//
// "points" (the default) renders exactly what the Builder always has: "1.5 pt".
// "price" renders the same fragrance as its direct amount, points x
// `commerce.pointValue` ("$150"), so a host can speak money to customers while
// selection, totals, Curator Bonus and Composer keep working in points under
// the hood. Nothing here changes any calculation -- it is only how a number is
// worded for the person looking at the screen.
//
// PROMOTIONAL (SPECIAL) PRICING lives here too, as the one place that decides what a fragrance costs the customer. A fragrance may
// carry an optional `sale: { active, price, label }` overlay (the host attaches it; the shared catalog never does). Its REGULAR price
// is always points x pointValue and is never replaced. `getFragrancePrice` resolves the EFFECTIVE price: the sale price when the sale
// is valid, the regular price otherwise. A sale is valid only when it is a price-display host's, `active === true`, and `price` is a
// finite amount that is greater than 0 and strictly lower than the regular price. Anything else resolves to the regular price and
// shows no promotion, so an invalid sale can never be charged or displayed. Every consumer (cards, details, totals, Review, the
// order message, filters, sorting) asks this one resolver; none compares prices itself.

export const PRICE_DISPLAY_MODES = Object.freeze(["points", "price"]);

function toLocale(commerce) {
  return typeof commerce.locale === "string" && commerce.locale ? commerce.locale : "en-US";
}

export function createCustomerPricing(config) {
  const commerce = config?.commerce || {};
  const isPriceDisplay = commerce.priceDisplay === "price";
  const pointValue =
    typeof commerce.pointValue === "number" && Number.isFinite(commerce.pointValue) && commerce.pointValue > 0
      ? commerce.pointValue
      : 100;
  const symbol = commerce.currencySymbol || "$";
  const currency = commerce.currency || "";
  const locale = toLocale(commerce);

  // A plain whole-number amount with the currency symbol: "$100", "$1,200".
  function formatAmount(amount) {
    const rounded = Math.round(Number.isFinite(amount) ? amount : 0);
    return `${symbol}${rounded.toLocaleString(locale)}`;
  }

  // The same amount spelled out for assistive technology: "$100 MXN".
  function formatAmountWithCurrency(amount) {
    return currency ? `${formatAmount(amount)} ${currency}` : formatAmount(amount);
  }

  const saleLabelDefault = typeof commerce.saleLabel === "string" ? commerce.saleLabel : "";
  const regularPriceLabel = typeof commerce.regularPriceLabel === "string" ? commerce.regularPriceLabel : "";
  const salePriceLabel = typeof commerce.salePriceLabel === "string" ? commerce.salePriceLabel : "";

  // The regular and effective price of one fragrance, and the sale that explains the difference (null when there is none).
  function getFragrancePrice(perfume) {
    const regularAmount = (Number.isFinite(perfume?.points) ? perfume.points : 0) * pointValue;
    const sale = isPriceDisplay ? perfume?.sale : null;
    const price = sale?.price;
    const isValidSale = sale?.active === true && typeof price === "number" && Number.isFinite(price) && price > 0 && price < regularAmount;

    if (!isValidSale) {
      return Object.freeze({ regularAmount, effectiveAmount: regularAmount, isOnSale: false, savings: 0, saleLabel: "" });
    }

    const label = typeof sale.label === "string" && sale.label.trim() ? sale.label.trim() : saleLabelDefault;

    return Object.freeze({ regularAmount, effectiveAmount: price, isOnSale: true, savings: regularAmount - price, saleLabel: label });
  }

  // The fragrance's effective price expressed in points (price / pointValue): the unit catalog filters and price sorting already
  // use. Without a valid sale it is exactly `perfume.points`.
  function getEffectivePoints(perfume) {
    const price = getFragrancePrice(perfume);

    return price.isOnSale ? price.effectiveAmount / pointValue : perfume.points;
  }

  // Spoken for assistive technology: the promotion, the price charged and the regular price, in words ("Oferta especial: $400 MXN.
  // Precio regular: $500 MXN."), so the sale never rests on a strikethrough alone. Empty when there is no valid sale.
  function formatSaleForAssistiveTech(perfume) {
    const price = getFragrancePrice(perfume);

    if (!price.isOnSale) return "";

    return [
      `${price.saleLabel ? `${price.saleLabel}: ` : ""}${formatAmountWithCurrency(price.effectiveAmount)}.`,
      `${regularPriceLabel ? `${regularPriceLabel}: ` : ""}${formatAmountWithCurrency(price.regularAmount)}.`,
    ].join(" ");
  }

  // What one fragrance's tier chip / inline point mention shows.
  function formatPoints(points) {
    return isPriceDisplay ? formatAmount(points * pointValue) : `${points} pt`;
  }

  function formatPointsForAssistiveTech(points) {
    return isPriceDisplay ? formatAmountWithCurrency(points * pointValue) : `${points} pt`;
  }

  return Object.freeze({
    isPriceDisplay,
    pointValue,
    currency,
    locale,
    formatAmount,
    formatAmountWithCurrency,
    formatPoints,
    formatPointsForAssistiveTech,
    // points -> customer amount, for hosts that word progress as money
    pointsToAmount: (points) => points * pointValue,
    saleLabelDefault,
    regularPriceLabel,
    salePriceLabel,
    getFragrancePrice,
    getEffectivePoints,
    formatSaleForAssistiveTech,
  });
}

// The unchanged points presentation. Components that are rendered or called outside a
// provider (standalone tests, other hosts that never opt in) fall back to this.
export const DEFAULT_CUSTOMER_PRICING = createCustomerPricing(null);
