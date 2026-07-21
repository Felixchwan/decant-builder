import {
  getSelectedPerfumeIds,
  hydrateSelectedPerfumes,
} from "../selection/selectionState.js";

const PERSISTENCE_SCHEMA_VERSION = 1;

export function parseBuilderPersistence(rawValue) {
  if (!rawValue) {
    return null;
  }

  try {
    return JSON.parse(rawValue);
  } catch {
    return null;
  }
}

export function hydrateBuilderPersistence({
  rawValue,
  catalog,
  config,
  defaultBuilderState,
}) {
  const parsedValue = parseBuilderPersistence(rawValue);
  const validatedState = validatePersistedBuilderState(parsedValue, {
    config,
    catalog,
    maxSelectableSlots: config.box.maxSelectableSlots,
    defaultCustomerInfo: defaultBuilderState.customerInfo,
  });

  if (!validatedState) {
    return {
      ...defaultBuilderState,
      selectedPerfumes: [],
      wasRestored: false,
    };
  }

  return {
    ...validatedState,
    selectedPerfumes: hydrateSelectedPerfumes({
      selectedPerfumeIds: validatedState.selectedPerfumeIds,
      catalog,
      maxSelectableSlots: config.box.maxSelectableSlots,
    }),
    wasRestored: validatedState.selectedPerfumeIds.length > 0,
  };
}

export function createBuilderPersistencePayload({
  selectedPerfumes,
  curatorBonusPreference,
  customerInfo,
}) {
  return {
    version: PERSISTENCE_SCHEMA_VERSION,
    selectedPerfumeIds: getSelectedPerfumeIds(selectedPerfumes),
    curatorBonusPreference,
    customerInfo,
  };
}

export function serializeBuilderPersistence({
  selectedPerfumes,
  curatorBonusPreference,
  customerInfo,
}) {
  return JSON.stringify(
    createBuilderPersistencePayload({
      selectedPerfumes,
      curatorBonusPreference,
      customerInfo,
    })
  );
}

export function hasMeaningfulBuilderPersistence(
  value,
  defaultBuilderState,
  defaultCustomerInfo
) {
  const customerInfo = validatePersistedCustomerInfo(
    value.customerInfo,
    defaultCustomerInfo
  );
  const selectedPerfumeIds = Array.isArray(value.selectedPerfumeIds)
    ? value.selectedPerfumeIds
    : [];

  return (
    selectedPerfumeIds.length > 0 ||
    value.curatorBonusPreference !== defaultBuilderState.curatorBonusPreference ||
    Boolean(customerInfo.name.trim()) ||
    Boolean(customerInfo.city.trim()) ||
    Boolean(customerInfo.notes.trim())
  );
}

function validatePersistedBuilderState(
  value,
  { config, catalog, maxSelectableSlots, defaultCustomerInfo }
) {
  if (
    !value ||
    typeof value !== "object" ||
    value.version !== config.persistence.schemaVersion
  ) {
    return null;
  }

  const selectedPerfumeIds = getSelectedPerfumeIds(
    hydrateSelectedPerfumes({
      selectedPerfumeIds: value.selectedPerfumeIds,
      catalog,
      maxSelectableSlots,
    })
  );
  const curatorBonusPreference = getValidatedCuratorPreference(value, config);
  const customerInfo = validatePersistedCustomerInfo(
    value.customerInfo,
    defaultCustomerInfo
  );

  return {
    selectedPerfumeIds: [...new Set(selectedPerfumeIds)],
    curatorBonusPreference,
    customerInfo,
  };
}

function getValidatedCuratorPreference(value, config) {
  const preferences = config.curatorBonus.preferences || {};

  return preferences[value.curatorBonusPreference]
    ? value.curatorBonusPreference
    : config.curatorBonus.defaultPreference;
}

function validatePersistedCustomerInfo(value, defaultCustomerInfo) {
  if (!value || typeof value !== "object") {
    return defaultCustomerInfo;
  }

  return {
    name: typeof value.name === "string" ? value.name : "",
    city: typeof value.city === "string" ? value.city : "",
    notes: typeof value.notes === "string" ? value.notes : "",
  };
}
