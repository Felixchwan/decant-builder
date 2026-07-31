import { describe, expect, it } from "vitest";

import {
  buildAnalyticsContext,
  containsProhibitedAnalyticsKey,
  createAnalytics,
  isValidAnalyticsEvent,
} from "./createAnalytics.js";
import { createDevelopmentAnalytics } from "./developmentAnalytics.js";
import {
  ANALYTICS_EVENTS,
  noopAnalytics,
} from "@discovery-box/builder/analytics";

describe("analytics foundation", () => {
  it("keeps no-op tracking safe", () => {
    expect(() => noopAnalytics.track("anything", { unsafe: true })).not.toThrow();
    expect(noopAnalytics.track("anything", { unsafe: true })).toBe(false);
  });

  it("keeps development logging disabled by default", () => {
    const events = [];
    const analytics = createDevelopmentAnalytics({
      logger: (...event) => events.push(event),
    });

    expect(analytics.track(ANALYTICS_EVENTS.APP_LOADED, { source: "system" })).toBe(false);
    expect(events).toEqual([]);
  });

  it("prints compact events only when development analytics is enabled", () => {
    const events = [];
    const analytics = createDevelopmentAnalytics({
      enabled: true,
      logger: (...event) => events.push(event),
    });

    expect(analytics.track(ANALYTICS_EVENTS.APP_LOADED, { source: "system" })).toBe(true);
    expect(events).toEqual([
      ["[analytics]", ANALYTICS_EVENTS.APP_LOADED, { source: "system" }],
    ]);
  });

  it("fails invalid event names and malformed payloads safely", () => {
    const received = [];
    const analytics = createAnalytics({
      provider: {
        track(eventName, payload) {
          received.push({ eventName, payload });
        },
      },
    });

    expect(analytics.track("unknown_event", {})).toBe(false);
    expect(analytics.track(ANALYTICS_EVENTS.PERFUME_ADDED, null)).toBe(false);
    expect(analytics.track(ANALYTICS_EVENTS.PERFUME_ADDED, { unexpected: true })).toBe(false);
    expect(received).toEqual([]);
  });

  it("swallows provider exceptions without affecting callers", () => {
    const analytics = createAnalytics({
      provider: {
        track() {
          throw new Error("provider failed");
        },
      },
    });

    expect(() =>
      analytics.track(ANALYTICS_EVENTS.APP_LOADED, { source: "system" })
    ).not.toThrow();
    expect(analytics.track(ANALYTICS_EVENTS.APP_LOADED, { source: "system" })).toBe(false);
  });

  it("attaches configuration-driven common context and a per-page flow id", () => {
    const received = [];
    const analytics = createAnalytics({
      flowId: "flow_test",
      commonContext: {
        merchantId: "discovery-decants",
        locale: "en-US",
        softwareName: "Decant Builder",
      },
      provider: {
        track(eventName, payload) {
          received.push({ eventName, payload });
        },
      },
    });

    expect(analytics.track(ANALYTICS_EVENTS.APP_LOADED, { source: "system" })).toBe(true);
    expect(received).toEqual([
      {
        eventName: ANALYTICS_EVENTS.APP_LOADED,
        payload: {
          merchantId: "discovery-decants",
          locale: "en-US",
          softwareName: "Decant Builder",
          flowId: "flow_test",
          source: "system",
        },
      },
    ]);
  });

  it("rejects personal data and raw search text before provider delivery", () => {
    const received = [];
    const analytics = createAnalytics({
      provider: {
        track(eventName, payload) {
          received.push({ eventName, payload });
        },
      },
    });

    expect(
      analytics.track(ANALYTICS_EVENTS.ORDER_FINALIZATION_SUCCEEDED, {
        slotCount: 6,
        totalPoints: 12,
        orderTotal: 1200,
        curatorBonusUnlocked: true,
        channel: "whatsapp",
        copiedToClipboard: true,
        customerName: "Hidden Customer",
        source: "manual",
      })
    ).toBe(false);
    expect(
      analytics.track(ANALYTICS_EVENTS.SEARCH_PERFORMED, {
        query: "bergamot",
        queryLength: 8,
        resultsCount: 4,
        activeFilterCount: 0,
        sortOption: "bestMatch",
        source: "manual",
      })
    ).toBe(false);
    expect(received).toEqual([]);
  });

  it("accepts safe derived search metadata without raw query text", () => {
    const received = [];
    const analytics = createAnalytics({
      provider: {
        track(eventName, payload) {
          received.push({ eventName, payload });
        },
      },
    });

    expect(
      analytics.track(ANALYTICS_EVENTS.SEARCH_PERFORMED, {
        queryLength: 8,
        resultsCount: 4,
        activeFilterCount: 0,
        sortOption: "bestMatch",
        source: "manual",
      })
    ).toBe(true);
    expect(received[0].payload).not.toHaveProperty("query");
    expect(received[0].payload).not.toHaveProperty("searchQuery");
  });

  it("accepts onboarding path selection without personal data", () => {
    const received = [];
    const analytics = createAnalytics({
      provider: {
        track(eventName, payload) {
          received.push({ eventName, payload });
        },
      },
    });

    expect(
      analytics.track(ANALYTICS_EVENTS.ONBOARDING_PATH_SELECTED, {
        path: "composer",
        presentation: "mobile",
      })
    ).toBe(true);
    expect(
      analytics.track(ANALYTICS_EVENTS.ONBOARDING_PATH_SELECTED, {
        path: "manual",
        presentation: "desktop",
        notes: "private",
      })
    ).toBe(false);
    expect(received).toHaveLength(1);
  });

  it("accepts mobile onboarding dismissal without path attribution", () => {
    const received = [];
    const analytics = createAnalytics({
      provider: {
        track(eventName, payload) {
          received.push({ eventName, payload });
        },
      },
    });

    expect(
      analytics.track(ANALYTICS_EVENTS.ONBOARDING_DISMISSED, {
        presentation: "mobile",
      })
    ).toBe(true);
    expect(
      analytics.track(ANALYTICS_EVENTS.ONBOARDING_DISMISSED, {
        presentation: "mobile",
        path: "manual",
      })
    ).toBe(false);
    expect(received).toHaveLength(1);
    expect(received[0]).toMatchObject({
      eventName: ANALYTICS_EVENTS.ONBOARDING_DISMISSED,
      payload: {
        presentation: "mobile",
      },
    });
    expect(received[0].payload).not.toHaveProperty("path");
  });

  it("builds merchant context without contact data", () => {
    expect(
      buildAnalyticsContext({
        analytics: { merchantId: "aurelian" },
        locale: "es-MX",
        software: { name: "Decant Builder" },
        finalization: { whatsappNumber: "000" },
      })
    ).toEqual({
      merchantId: "aurelian",
      locale: "es-MX",
      softwareName: "Decant Builder",
    });
  });

  it("keeps payload validation explicit and finite", () => {
    expect(
      isValidAnalyticsEvent(ANALYTICS_EVENTS.PERFUME_ADDED, {
        perfumeId: 1,
        points: 1,
        source: "manual",
        slotCountAfter: 1,
        totalPointsAfter: 1,
      })
    ).toBe(true);
    expect(containsProhibitedAnalyticsKey({ nested: { stack: "raw trace" } })).toBe(true);
  });
});
