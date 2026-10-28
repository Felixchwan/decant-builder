import { createContext, useContext } from "react";

import { DEFAULT_CUSTOMER_PRICING } from "./customerPricing.js";

// React context for the pure customer-pricing presentation (see customerPricing.js). Kept apart from
// the provider component so each file exports either components or helpers, never both.
export const CustomerPricingContext = createContext(DEFAULT_CUSTOMER_PRICING);

// Components rendered outside a provider (standalone tests, other hosts that never opt in) get the
// default points presentation -- unchanged behavior.
export function useCustomerPricing() {
  return useContext(CustomerPricingContext);
}
