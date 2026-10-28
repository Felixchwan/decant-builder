// Customer-facing price presentation, opt-in per host via `commerce.priceDisplay`.
//
// "points" (the default) renders exactly what the Builder always has: "1.5 pt".
// "price" renders the same fragrance as its direct amount, points x
// `commerce.pointValue` ("$150"), so a host can speak money to customers while
// selection, totals, Curator Bonus and Composer keep working in points under
// the hood. Nothing here changes any calculation -- it is only how a number is
// worded for the person looking at the screen.

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
    formatAmount,
    formatAmountWithCurrency,
    formatPoints,
    formatPointsForAssistiveTech,
    // points -> customer amount, for hosts that word progress as money
    pointsToAmount: (points) => points * pointValue,
  });
}

// The unchanged points presentation. Components that are rendered or called outside a
// provider (standalone tests, other hosts that never opt in) fall back to this.
export const DEFAULT_CUSTOMER_PRICING = createCustomerPricing(null);
