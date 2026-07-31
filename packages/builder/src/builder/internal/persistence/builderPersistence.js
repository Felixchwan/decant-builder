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
  const validatedState = sanitizePersistedBuilderState({
    value: parseBuilderPersistence(rawValue),
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

export function sanitizePersistedBuilderState({
  value,
  config,
  catalog,
  maxSelectableSlots = config?.box?.maxSelectableSlots,
  defaultCustomerInfo,
}) {
  return validatePersistedBuilderState(value, {
    config,
    catalog,
    maxSelectableSlots,
    defaultCustomerInfo,
  });
}

export function loadPersistedBuilderState({
  storage,
  storageKey,
  catalog,
  config,
  defaultBuilderState,
}) {
  const defaultHydratedState = createDefaultHydratedState(defaultBuilderState);
  const resolvedStorage = getAvailableStorage(storage);

  if (!resolvedStorage || !storageKey) {
    return {
      ...defaultHydratedState,
      recovery: {
        storageAvailable: false,
        invalidStoredStateCleared: false,
      },
    };
  }

  let rawValue;

  try {
    rawValue = resolvedStorage.getItem(storageKey);
  } catch {
    return {
      ...defaultHydratedState,
      recovery: {
        storageAvailable: false,
        invalidStoredStateCleared: false,
      },
    };
  }

  const parsedValue = parseBuilderPersistence(rawValue);
  const validatedState = sanitizePersistedBuilderState({
    value: parsedValue,
    config,
    catalog,
    maxSelectableSlots: config.box.maxSelectableSlots,
    defaultCustomerInfo: defaultBuilderState.customerInfo,
  });
  const shouldClearInvalidStoredState = Boolean(rawValue) && !validatedState;

  if (shouldClearInvalidStoredState) {
    try {
      resolvedStorage.removeItem(storageKey);
    } catch {
      // Invalid state should not poison rendering even when removal is blocked.
    }
  }

  if (!validatedState) {
    return {
      ...defaultHydratedState,
      recovery: {
        storageAvailable: true,
        invalidStoredStateCleared: shouldClearInvalidStoredState,
      },
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
    recovery: {
      storageAvailable: true,
      invalidStoredStateCleared: false,
    },
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

export function savePersistedBuilderState({ storage, storageKey, value }) {
  const resolvedStorage = getAvailableStorage(storage);

  if (!resolvedStorage || !storageKey) {
    return { saved: false, reason: "storage-unavailable" };
  }

  try {
    resolvedStorage.setItem(storageKey, serializeBuilderPersistence(value));
    return { saved: true, reason: null };
  } catch {
    return { saved: false, reason: "write-failed" };
  }
}

export function clearPersistedBuilderState({ storage, storageKey }) {
  const resolvedStorage = getAvailableStorage(storage);

  if (!resolvedStorage || !storageKey) {
    return { cleared: false, reason: "storage-unavailable" };
  }

  try {
    resolvedStorage.removeItem(storageKey);
    return { cleared: true, reason: null };
  } catch {
    return { cleared: false, reason: "clear-failed" };
  }
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

function createDefaultHydratedState(defaultBuilderState) {
  return {
    ...defaultBuilderState,
    selectedPerfumes: [],
    wasRestored: false,
  };
}

function getAvailableStorage(storage) {
  if (!storage) {
    return null;
  }

  if (
    typeof storage.getItem !== "function" ||
    typeof storage.setItem !== "function" ||
    typeof storage.removeItem !== "function"
  ) {
    return null;
  }

  return storage;
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
