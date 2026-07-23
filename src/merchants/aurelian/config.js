import { createBuilderConfig } from "../../builder/config/createBuilderConfig.js";
import { buildLocalizedConfigOverrides } from "../../i18n/buildLocalizedConfig.js";

const locale = "es-MX";
const localized = buildLocalizedConfigOverrides(locale);

export const aurelianConfig = createBuilderConfig({
  ...localized,
  software: {
    name: "Decant Builder",
  },
  brand: {
    businessName: "Aurelian",
    displayName: "Aurelian",
    shortName: "Aurelian",
    heading: "Aurelian",
  },
  commerce: {
    ...localized.commerce,
    locale,
  },
  collectionCard: {
    ...localized.collectionCard,
    brandHeading: "Aurelian",
    ariaLabel: "tarjeta de colección Aurelian",
    filenamePrefix: "aurelian",
    shareTitle: "Mi colección Aurelian",
    shareText: "Una colección Aurelian curada.",
  },
  finalization: {
    ...localized.finalization,
    mode: "unavailable",
    whatsappNumber: "",
    orderCodePrefix: "AUR",
  },
  persistence: {
    storageKey: "aurelian-builder-v1",
  },
  features: {
    whatsappFinalization: false,
  },
});
