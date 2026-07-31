import {
  buildLocalizedConfigOverrides,
  createBuilderConfig,
} from "@discovery-box/builder/config";

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
  analytics: {
    merchantId: "aurelian",
  },
  commerce: {
    ...localized.commerce,
    locale,
  },
  box: {
    minSelectableSlots: 6,
    maxSelectableSlots: 14,
  },
  theme: {
    colors: {
      background: "#090A09",
      surface: "rgba(17, 17, 15, 0.94)",
      surfaceElevated: "rgba(27, 25, 21, 0.96)",
      text: "#F2EBDD",
      textSecondary: "#C8BEAD",
      textMuted: "#938B7D",
      border: "rgba(200, 166, 101, 0.22)",
      accent: "#C8A665",
      accentStrong: "#9F7D43",
      accentContrast: "#171108",
      disabled: "rgba(147, 139, 125, 0.16)",
    },
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
