import {
  ANALYTICS_EVENT_NAMES,
  COMMON_CONTEXT_KEYS,
  EVENT_PAYLOAD_KEYS,
  PROHIBITED_ANALYTICS_KEYS,
} from "./events.js";
import { noopAnalytics } from "./noopAnalytics.js";

const EVENT_NAME_SET = new Set(ANALYTICS_EVENT_NAMES);
const PROHIBITED_KEY_SET = new Set(
  PROHIBITED_ANALYTICS_KEYS.map((key) => key.toLowerCase())
);

export function createAnalytics({
  provider = noopAnalytics,
  commonContext = {},
  flowId = createAnalyticsFlowId(),
} = {}) {
  const safeCommonContext = sanitizeCommonContext(commonContext, flowId);

  return Object.freeze({
    track(eventName, payload = {}) {
      if (!isValidAnalyticsEvent(eventName, payload)) {
        return false;
      }

      try {
        provider?.track?.(eventName, {
          ...safeCommonContext,
          ...payload,
        });
        return true;
      } catch {
        return false;
      }
    },
  });
}

export function buildAnalyticsContext(config = {}) {
  return {
    merchantId: config.analytics?.merchantId || "",
    locale: config.locale || "",
    softwareName: config.software?.name || "",
  };
}

export function isValidAnalyticsEvent(eventName, payload = {}) {
  if (!EVENT_NAME_SET.has(eventName) || !isPlainObject(payload)) {
    return false;
  }

  if (containsProhibitedAnalyticsKey(payload)) {
    return false;
  }

  const allowedKeys = new Set(EVENT_PAYLOAD_KEYS[eventName] || []);
  return Object.keys(payload).every((key) => allowedKeys.has(key));
}

export function containsProhibitedAnalyticsKey(value) {
  if (Array.isArray(value)) {
    return value.some((item) => containsProhibitedAnalyticsKey(item));
  }

  if (!isPlainObject(value)) {
    return false;
  }

  return Object.entries(value).some(
    ([key, child]) =>
      PROHIBITED_KEY_SET.has(key.toLowerCase()) ||
      containsProhibitedAnalyticsKey(child)
  );
}

export function createAnalyticsFlowId() {
  const randomValue =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2);

  return `flow_${randomValue}`;
}

function sanitizeCommonContext(commonContext, flowId) {
  const safeContext = {};
  const allowedContextKeys = new Set(COMMON_CONTEXT_KEYS);

  Object.entries({ ...commonContext, flowId }).forEach(([key, value]) => {
    if (allowedContextKeys.has(key) && !containsProhibitedAnalyticsKey({ [key]: value })) {
      safeContext[key] = value;
    }
  });

  return safeContext;
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
