import { enUS } from "./locales/en-US.js";
import { esMX } from "./locales/es-MX.js";

export const FALLBACK_LOCALE = "en-US";
export const SUPPORTED_LOCALES = Object.freeze(["en-US", "es-MX"]);

const LOCALES = {
  "en-US": enUS,
  "es-MX": esMX,
};

export function normalizeLocale(locale) {
  return SUPPORTED_LOCALES.includes(locale) ? locale : FALLBACK_LOCALE;
}

export function createTranslator(locale = FALLBACK_LOCALE) {
  const resolvedLocale = normalizeLocale(locale);
  const activeDictionary = LOCALES[resolvedLocale] || enUS;

  function t(key, values = {}) {
    const template = activeDictionary[key] ?? enUS[key] ?? key;
    return interpolate(template, values);
  }

  function label(type, value) {
    if (!value) {
      return "";
    }

    const key = `taxonomy.${value}`;
    const template = activeDictionary[key] ?? enUS[key] ?? value;
    return interpolate(template, {});
  }

  return Object.freeze({
    locale: resolvedLocale,
    t,
    label,
  });
}

export function interpolate(template, values = {}) {
  return Object.entries(values).reduce(
    (copy, [key, value]) => copy.replaceAll(`{${key}}`, String(value)),
    String(template)
  );
}
