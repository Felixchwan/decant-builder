import { createBuilderConfig } from "../../builder/config/createBuilderConfig.js";
import { buildLocalizedConfigOverrides } from "../../i18n/buildLocalizedConfig.js";

const locale = "en-US";
const localized = buildLocalizedConfigOverrides(locale);

export const discoveryDecantsConfig = createBuilderConfig({
  ...localized,
  software: {
    name: "Decant Builder",
  },
  brand: {
    businessName: "Discovery Decants",
    displayName: "Discovery Decants",
    shortName: "Discovery",
    heading: "Discovery Decants",
  },
  commerce: {
    ...localized.commerce,
    currency: "MXN",
    locale,
    currencySymbol: "$",
    pointValue: 100,
    totalLabel: "Order Total",
  },
  box: {
    minSelectableSlots: 6,
    maxSelectableSlots: 14,
    defaultTargetSlots: 14,
    totalPhysicalSlots: 16,
    bonusSlotCount: 2,
    minPoints: 12,
  },
  collectionCard: {
    ...localized.collectionCard,
    brandHeading: "Discovery Decants",
    ariaLabel: "Discovery Decants collection card",
    filenamePrefix: "discovery-decants",
    shareTitle: "My Discovery Decants Collection",
    shareText: "A curated Discovery Decants collection.",
  },
  finalization: {
    ...localized.finalization,
    mode: "whatsapp",
    whatsappNumber: "528129800010",
    orderCodePrefix: "DB",
  },
  persistence: {
    storageKey: "decant-builder-v1",
    schemaVersion: 1,
    fragranceDetailsHintKey: "fragranceDetailsHintSeen",
    discoveryIntroSeenKey: "discoveryBoxIntroSeen",
  },
});
