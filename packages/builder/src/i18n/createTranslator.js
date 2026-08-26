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

// `taxonomyLabels` is a generic, caller-supplied override map (plain
// `{ "taxonomy.<value>": "Display label" }` object) checked before the
// shared built-in dictionaries. It carries no assumptions about who supplies
// it or what vocabulary it covers -- a host/merchant can inject its own
// display labels (e.g. its own editorial translations for catalog vocabulary
// the shared dictionaries don't cover) without this package ever knowing
// that vocabulary exists. See createBuilderConfig's `taxonomyLabels` field
// for the sanctioned composition point hosts use to supply this.
export function createTranslator(locale = FALLBACK_LOCALE, taxonomyLabels = {}) {
  const resolvedLocale = normalizeLocale(locale);
  const activeDictionary = LOCALES[resolvedLocale] || enUS;

  function t(key, values = {}) {
    const template = activeDictionary[key] ?? enUS[key] ?? key;
    return interpolate(template, values);
  }

  // `fallback` lets a caller supply a better default than the raw catalog
  // value when neither a host override nor a built-in translation exists
  // (e.g. a note's own display name, already properly formatted, instead of
  // its raw camelCase id). Every existing caller omits it and keeps today's
  // exact behavior: falling back to `value` itself.
  function label(type, value, fallback = value) {
    if (!value) {
      return "";
    }

    const key = `taxonomy.${value}`;
    const template = taxonomyLabels[key] ?? activeDictionary[key] ?? enUS[key] ?? fallback;
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
