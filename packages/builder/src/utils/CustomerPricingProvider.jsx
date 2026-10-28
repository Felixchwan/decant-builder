import { useMemo } from "react";

import { createCustomerPricing } from "./customerPricing.js";
import { CustomerPricingContext } from "./customerPricingContext.js";

// One provider at the Builder root, so components that have no `builderConfig` of their own can word a
// fragrance's value the way the host chose (commerce.priceDisplay).
export function CustomerPricingProvider({ config, children }) {
  const pricing = useMemo(() => createCustomerPricing(config), [config]);
  return <CustomerPricingContext.Provider value={pricing}>{children}</CustomerPricingContext.Provider>;
}
