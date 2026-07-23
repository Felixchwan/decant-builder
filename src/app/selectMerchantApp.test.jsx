import { describe, expect, it } from "vitest";

import AurelianApp from "./AurelianApp.jsx";
import DiscoveryDecantsApp from "./DiscoveryDecantsApp.jsx";
import { selectMerchantApp } from "./selectMerchantApp.js";

describe("selectMerchantApp", () => {
  it("defaults production to Discovery Decants", () => {
    expect(selectMerchantApp()).toBe(DiscoveryDecantsApp);
    expect(selectMerchantApp("")).toBe(DiscoveryDecantsApp);
  });

  it("resolves the explicit Aurelian development merchant", () => {
    expect(selectMerchantApp("aurelian")).toBe(AurelianApp);
  });

  it("falls malformed selections back to Discovery Decants", () => {
    expect(selectMerchantApp("unknown")).toBe(DiscoveryDecantsApp);
  });
});
