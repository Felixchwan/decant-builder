import { defaultBuilderConfig } from "./defaultBuilderConfig.js";
import { validateBuilderConfig } from "./validateBuilderConfig.js";

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function mergeConfig(base, override) {
  const result = { ...base };

  Object.entries(override || {}).forEach(([key, value]) => {
    if (isPlainObject(value) && isPlainObject(base[key])) {
      result[key] = mergeConfig(base[key], value);
      return;
    }

    result[key] = value;
  });

  return result;
}

function freezeConfig(value) {
  if (!isPlainObject(value) && !Array.isArray(value)) {
    return value;
  }

  Object.values(value).forEach((child) => {
    if (isPlainObject(child) || Array.isArray(child)) {
      freezeConfig(child);
    }
  });

  return Object.freeze(value);
}

export function createBuilderConfig(config = {}) {
  const mergedConfig = mergeConfig(defaultBuilderConfig, config);
  return freezeConfig(validateBuilderConfig(mergedConfig));
}
