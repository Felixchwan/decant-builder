import {
  buildLocalizedConfigOverrides,
  createBuilderConfig,
} from "@discovery-box/builder/config";
import { aurelianTaxonomyLabels } from "./taxonomyLabels.js";

const locale = "es-MX";
const localized = buildLocalizedConfigOverrides(locale);

export const aurelianConfig = createBuilderConfig({
  ...localized,
  taxonomyLabels: aurelianTaxonomyLabels,
  software: { name: "Decant Builder" },
  brand: {
    businessName: "Aurelian",
    displayName: "Aurelian",
    shortName: "Aurelian",
    heading: "Aurelian",
  },
  analytics: { merchantId: "aurelian" },
  commerce: { ...localized.commerce, locale },
  // minPoints is a shared-config field with a default (see
  // defaultBuilderConfig.js) that used to be purely informational for
  // Aurelian. It now also drives Composer's completion-floor behavior (see
  // BuilderExperience.jsx's composerMinimumPoints wiring), so Aurelian
  // declares its own value explicitly here rather than inheriting it
  // silently -- this is Aurelian's one intentional source of truth for it.
  box: { minSelectableSlots: 6, maxSelectableSlots: 14, minPoints: 12 },
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
    mode: "whatsapp",
    whatsappNumber: "528129800010",
    whatsappDisplayNumber: "+52 81 29 80 0010",
    orderCodePrefix: "AUR",
    visibleCustomerFields: ["name", "city"],
    actionLabel: "Solicitar disponibilidad por WhatsApp",
    requiredCustomerCopy: "Ingresa tu nombre y municipio para continuar.",
    customerFieldLabels: {
      ...localized.finalization.customerFieldLabels,
      name: "Nombre",
      city: "Municipio",
    },
    whatsapp: {
      ...localized.finalization.whatsapp,
      greeting: "Hola, Aurelian. Esta es una Solicitud de disponibilidad para una Discovery Box.",
      closing: "Entiendo que Aurelian confirmará disponibilidad antes de enviarme las instrucciones de pago.",
      blockedCopied: "WhatsApp no se abrió. La solicitud se copió; usa el enlace para continuar y enviarla manualmente.",
      blockedManual: "WhatsApp no se abrió. Usa el enlace para continuar y enviar la solicitud manualmente.",
      openingCopied: "WhatsApp se abrió. Revisa y envía la solicitud para que {businessName} pueda confirmar disponibilidad. También quedó copiada.",
      opening: "WhatsApp se abrió. Revisa y envía la solicitud para que {businessName} pueda confirmar disponibilidad.",
      manualOpenLabel: "Continuar en WhatsApp",
    },
    messageLabels: {
      ...localized.finalization.messageLabels,
      customer: "Nombre",
      city: "Municipio",
      selectedFragrances: "Fragancias seleccionadas:",
      totalSlots: "Total de fragancias",
      totalPoints: "Puntos totales",
      orderTotal: "Total estimado de la Discovery Box",
      curatorBonus: "Curator Bonus",
      curatorStyle: "Preferencia Curator Bonus",
      unlocked: "Desbloqueado",
      notUnlocked: "No desbloqueado",
    },
  },
  persistence: { storageKey: "aurelian-builder-v1" },
  features: { whatsappFinalization: true, discoveryCoachmark: false },
});
