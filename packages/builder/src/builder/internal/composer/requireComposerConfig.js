const REQUIRED_COMPOSER_CONFIG_PATHS = Object.freeze([
  ["box", "minSelectableSlots"],
  ["box", "maxSelectableSlots"],
  ["box", "defaultTargetSlots"],
  ["commerce", "pointValue"],
  ["commerce", "currency"],
]);

export function requireComposerConfig(config) {
  if (!config || typeof config !== "object" || Array.isArray(config)) {
    throw new Error("Composer requires the active normalized Builder config.");
  }

  const missingPath = REQUIRED_COMPOSER_CONFIG_PATHS.find(
    ([section, field]) => config[section]?.[field] === undefined,
  );

  if (missingPath) {
    throw new Error(
      `Composer requires active Builder config field ${missingPath.join(".")}.`,
    );
  }

  return config;
}
