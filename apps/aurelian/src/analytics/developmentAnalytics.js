// Mirrors Discovery Decants' own developmentAnalytics.js exactly. A
// console-only provider for local development: never a network call,
// disabled unless explicitly turned on, so local development never sends
// anything anywhere by default and never silently pollutes anything.
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
