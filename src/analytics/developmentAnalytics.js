export function createDevelopmentAnalytics({
  enabled = false,
  logger = console.debug,
} = {}) {
  return {
    track(eventName, payload) {
      if (!enabled) {
        return false;
      }

      logger("[analytics]", eventName, payload);
      return true;
    },
  };
}
