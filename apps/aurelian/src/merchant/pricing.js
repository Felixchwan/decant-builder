import { createCustomerPricing } from "@discovery-box/builder/config";
import { aurelianConfig } from "./config.js";

// How Aurelian words money to customers outside the Builder (the catalog, the landing, "Cómo funciona").
// It is the Builder's own customer-pricing formatter built from this merchant's config, so a point amount reads
// here exactly as it does in the Builder (1.5 -> "$150", and "$150 MXN" for assistive technology and thresholds).
// Points stay the internal measure for selection, Composer and Curator Bonus; nothing here changes a calculation.
export const aurelianPricing = createCustomerPricing(aurelianConfig);

// A fragrance's value as the short chip amount: "$150".
export const formatFragrancePrice = (points) => aurelianPricing.formatPoints(points);

// The same value spelled out with its currency, for filter options and spoken labels: "$150 MXN".
export const formatFragrancePriceWithCurrency = (points) => aurelianPricing.formatPointsForAssistiveTech(points);

// A box threshold expressed in points (box.minPoints, curatorBonus.targetPoints) as an amount: "$1,200 MXN".
export const formatThresholdAmount = (points) => aurelianPricing.formatAmountWithCurrency(aurelianPricing.pointsToAmount(points));
