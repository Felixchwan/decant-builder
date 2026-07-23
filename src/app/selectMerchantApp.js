import AurelianApp from "./AurelianApp.jsx";
import DiscoveryDecantsApp from "./DiscoveryDecantsApp.jsx";

export function selectMerchantApp(merchantId = "") {
  if (merchantId === "aurelian") {
    return AurelianApp;
  }

  return DiscoveryDecantsApp;
}
