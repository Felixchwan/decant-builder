import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { ANALYTICS_EVENT_NAMES, EVENT_PAYLOAD_KEYS } from "./events.js";

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

describe("analytics architecture guards", () => {
  it("keeps event names centralized with explicit payload contracts", () => {
    expect(Object.keys(EVENT_PAYLOAD_KEYS).sort()).toEqual([...ANALYTICS_EVENT_NAMES].sort());
  });

  it("keeps analytics out of Composer Core and scoring modules", () => {
    const internalSources = readSourceFiles("src/builder/internal");
    const analyticsImports = internalSources.filter(({ source }) =>
      source.includes("/analytics/") || source.includes("../analytics/")
    );

    expect(analyticsImports).toEqual([]);
  });

  it("keeps analytics core decoupled from merchant implementations and providers", () => {
    const analyticsSources = readSourceFiles("src/analytics");
    const combinedSource = analyticsSources.map(({ source }) => source).join("\n");

    expect(combinedSource).not.toMatch(/merchants\//);
    expect(combinedSource).not.toMatch(/gtag|segment|amplitude|mixpanel|posthog/i);
    expect(combinedSource).not.toMatch(/fetch\(|XMLHttpRequest|sendBeacon/);
  });

  it("keeps finalization success contracts free from prohibited customer fields", () => {
    const successKeys = EVENT_PAYLOAD_KEYS.order_finalization_succeeded;

    expect(successKeys).not.toEqual(
      expect.arrayContaining(["customerName", "city", "notes", "phone", "message"])
    );
  });
});
