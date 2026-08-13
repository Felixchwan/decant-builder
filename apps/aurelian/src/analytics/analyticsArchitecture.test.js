import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  ANALYTICS_EVENT_NAMES,
  EVENT_PAYLOAD_KEYS,
} from "@discovery-box/builder/analytics";

function listFiles(directory) {
  return readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);
    return statSync(path).isDirectory() ? listFiles(path) : [path];
  });
}

function readSourceFiles(directory) {
  return listFiles(directory)
    .filter((file) => /\.(js|jsx)$/.test(file))
    .filter((file) => !file.endsWith(".test.js") && !file.endsWith(".test.jsx"))
    .map((file) => ({
      file,
      source: readFileSync(file, "utf8"),
    }));
}

describe("Aurelian analytics architecture guards", () => {
  it("keeps event names centralized with explicit payload contracts", () => {
    expect(Object.keys(EVENT_PAYLOAD_KEYS).sort()).toEqual([...ANALYTICS_EVENT_NAMES].sort());
  });

  it("keeps the entire analytics foundation vendor-neutral -- no provider SDK is wired in yet", () => {
    // Analytics is currently a dormant, provider-neutral boundary (see
    // README.md): a real vendor integration is a deferred future slice, not
    // implemented today. This guard keeps that true at the source level --
    // if a vendor name ever appears here, it should arrive alongside a
    // dedicated adapter file and README/ADR update, not silently.
    const analyticsSources = readSourceFiles("apps/aurelian/src/analytics");
    const combinedSource = analyticsSources.map(({ source }) => source).join("\n");

    expect(combinedSource).not.toMatch(/gtag|segment|amplitude|mixpanel|posthog|plausible/i);
    expect(combinedSource).not.toMatch(/fetch\(|XMLHttpRequest|sendBeacon/);
  });

  it("never lets Perceptual Learning source files import analytics", () => {
    const perceptualLearningSources = readSourceFiles("apps/aurelian/src/perceptualLearning");

    expect(perceptualLearningSources.length).toBeGreaterThan(0);

    const analyticsImports = perceptualLearningSources.filter(({ source }) =>
      /["'](\.\.\/)*analytics\//.test(source) || /from ["']next-plausible["']/.test(source)
    );

    expect(analyticsImports).toEqual([]);
  });

  it("never lets Perceptual Learning capture/view components import analytics", () => {
    const captureComponentFiles = [
      "apps/aurelian/src/components/ObservationCaptureFlow.jsx",
      "apps/aurelian/src/components/ComparisonCaptureFlow.jsx",
      "apps/aurelian/src/components/EvidenceRevisitView.jsx",
      "apps/aurelian/src/components/LearnerRecordView.jsx",
    ];

    for (const file of captureComponentFiles) {
      const source = readFileSync(file, "utf8");
      expect(source).not.toMatch(/["'](\.\.\/)*analytics\//);
      expect(source).not.toMatch(/from ["']next-plausible["']/);
    }
  });

  it("keeps finalization success contracts free from prohibited customer fields", () => {
    const successKeys = EVENT_PAYLOAD_KEYS.order_finalization_succeeded;

    expect(successKeys).not.toEqual(
      expect.arrayContaining(["customerName", "city", "notes", "phone", "message"])
    );
  });

  it("keeps every order/finalization event payload free of prohibited customer fields", () => {
    const orderEventNames = ANALYTICS_EVENT_NAMES.filter((name) => name.startsWith("order_"));

    expect(orderEventNames.length).toBeGreaterThan(0);

    for (const eventName of orderEventNames) {
      expect(EVENT_PAYLOAD_KEYS[eventName]).not.toEqual(
        expect.arrayContaining([
          "customerName",
          "name",
          "city",
          "notes",
          "phone",
          "phoneNumber",
          "whatsappNumber",
          "message",
          "messageBody",
          "whatsappMessage",
          "url",
        ])
      );
    }
  });
});
