import { SUPPORTED_LOCALES } from "../../i18n/createTranslator.js";
import { BUILDER_THEME_COLOR_KEYS } from "../theme/builderTheme.js";

function assertPath(condition, path, message) {
  if (!condition) {
    throw new Error(`Invalid builder config at ${path}: ${message}`);
  }
}

function isPositiveNumber(value) {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function isNonNegativeNumber(value) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function validateBuilderConfig(config) {
  assertPath(SUPPORTED_LOCALES.includes(config.locale), "locale", "must be a supported locale");
  assertPath(isNonEmptyString(config.software.name), "software.name", "must be a non-empty string");
  assertPath(isNonEmptyString(config.brand.businessName), "brand.businessName", "must be a non-empty string");
  assertPath(isPositiveNumber(config.commerce.pointValue), "commerce.pointValue", "must be a positive number");
  assertPath(isNonEmptyString(config.commerce.currency), "commerce.currency", "must be a non-empty string");
  assertPath(SUPPORTED_LOCALES.includes(config.commerce.locale), "commerce.locale", "must be a supported locale");
  assertPath(isNonEmptyString(config.commerce.currencySymbol), "commerce.currencySymbol", "must be a non-empty string");

  assertPath(isPositiveNumber(config.box.minSelectableSlots), "box.minSelectableSlots", "must be a positive number");
  assertPath(isPositiveNumber(config.box.maxSelectableSlots), "box.maxSelectableSlots", "must be a positive number");
  assertPath(
    config.box.minSelectableSlots <= config.box.maxSelectableSlots,
    "box.minSelectableSlots",
    "must be less than or equal to box.maxSelectableSlots"
  );
  assertPath(isPositiveNumber(config.box.totalPhysicalSlots), "box.totalPhysicalSlots", "must be a positive number");
  assertPath(isNonNegativeNumber(config.box.bonusSlotCount), "box.bonusSlotCount", "must be a non-negative number");
  assertPath(
    config.box.maxSelectableSlots <= config.box.totalPhysicalSlots,
    "box.maxSelectableSlots",
    "must not exceed box.totalPhysicalSlots"
  );
  assertPath(isPositiveNumber(config.box.minPoints), "box.minPoints", "must be a positive number");

  if (config.curatorBonus.enabled) {
    assertPath(isPositiveNumber(config.curatorBonus.targetPoints), "curatorBonus.targetPoints", "must be a positive number");
    assertPath(
      config.curatorBonus.preferences[config.curatorBonus.defaultPreference],
      "curatorBonus.defaultPreference",
      "must reference a configured preference"
    );
  }

  if (config.collectionCard.enabled) {
    assertPath(isPositiveNumber(config.collectionCard.exportWidth), "collectionCard.exportWidth", "must be a positive number");
    assertPath(isPositiveNumber(config.collectionCard.exportHeight), "collectionCard.exportHeight", "must be a positive number");
    assertPath(isNonEmptyString(config.collectionCard.filenamePrefix), "collectionCard.filenamePrefix", "must be a non-empty string");
  }

  if (config.features.whatsappFinalization) {
    assertPath(isNonEmptyString(config.finalization.whatsappNumber), "finalization.whatsappNumber", "is required when WhatsApp finalization is enabled");
  }

  const supportedCustomerFields = new Set(["name", "city", "notes"]);
  assertPath(
    Array.isArray(config.finalization.visibleCustomerFields)
      && config.finalization.visibleCustomerFields.every((field) => supportedCustomerFields.has(field)),
    "finalization.visibleCustomerFields",
    "must contain only name, city, and notes"
  );
  config.finalization.requiredFields.forEach((field) => {
    assertPath(
      config.finalization.visibleCustomerFields.includes(field),
      "finalization.visibleCustomerFields",
      `must include required field ${field}`
    );
  });
  ["name", "city", "notes"].forEach((field) => {
    assertPath(
      isPositiveNumber(config.finalization.customerFieldMaxLengths[field]),
      `finalization.customerFieldMaxLengths.${field}`,
      "must be a positive number"
    );
  });

  assertPath(isNonEmptyString(config.persistence.storageKey), "persistence.storageKey", "must be a non-empty string");
  assertPath(isPositiveNumber(config.persistence.schemaVersion), "persistence.schemaVersion", "must be a positive number");

  assertPath(isPlainObject(config.theme), "theme", "must be an object");
  const unknownThemeKeys = Object.keys(config.theme).filter((key) => key !== "colors");
  assertPath(
    unknownThemeKeys.length === 0,
    "theme",
    `contains unsupported keys: ${unknownThemeKeys.join(", ")}`
  );
  assertPath(isPlainObject(config.theme.colors), "theme.colors", "must be an object");
  const unknownThemeColors = Object.keys(config.theme.colors).filter(
    (key) => !BUILDER_THEME_COLOR_KEYS.includes(key)
  );
  assertPath(
    unknownThemeColors.length === 0,
    "theme.colors",
    `contains unsupported keys: ${unknownThemeColors.join(", ")}`
  );
  BUILDER_THEME_COLOR_KEYS.forEach((key) => {
    assertPath(
      isNonEmptyString(config.theme.colors[key]),
      `theme.colors.${key}`,
      "must be a non-empty CSS color string"
    );
  });

  return config;
}
