import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const builderCalls = vi.hoisted(() => []);

vi.mock("@discovery-box/builder", () => ({
  DiscoveryBoxBuilder(props) {
    builderCalls.push(props);
    return <div data-testid="merchant-builder" />;
  },
}));

import { BuilderExperience } from "../../apps/aurelian/src/components/BuilderExperience.jsx";
import DiscoveryDecantsApp from "./DiscoveryDecantsApp.jsx";
import { createMerchantCatalog, fragrances as perfumes } from "@discovery-box/catalog";
import { CATALOG_IDENTITY_BASELINE } from "../../packages/catalog/tests/catalogIdentityBaseline.fixture.js";
import { aurelianAvailableIds } from "../../apps/aurelian/src/merchant/catalog.js";
import { aurelianConfig } from "../../apps/aurelian/src/merchant/config.js";
import { discoveryDecantsAvailableIds } from "../merchants/discoveryDecants/catalog.js";

const originalWindow = globalThis.window;

function simulateReturningAurelianVisitor() {
  // BuilderExperience shows the Discovery Intent entry screen for genuine
  // first-time visitors only. This test is about catalog/prop composition,
  // not the entry screen, so it simulates a returning visitor (a persisted
  // box already present) to reach DiscoveryBoxBuilder directly, matching
  // how this suite already avoided real filesystem/browser dependencies.
  globalThis.window = {
    localStorage: {
      getItem: (key) => (key === aurelianConfig.persistence.storageKey ? "{}" : null),
    },
    location: { href: "https://aurelianperfumes.com/build-your-box", search: "" },
    history: { replaceState: () => {} },
  };
}

function expectedIds() {
  return CATALOG_IDENTITY_BASELINE.map(([id]) => id);
}

function assertCurrentCatalog(catalog) {
  expect(catalog).toHaveLength(87);
  expect(catalog.map(({ id }) => id)).toEqual(expectedIds());
  expect(catalog.map(({ id, points }) => [id, points])).toEqual(
    CATALOG_IDENTITY_BASELINE.map(([id, , points]) => [id, points])
  );
  catalog.forEach((record, index) => expect(record).toBe(perfumes[index]));
}

describe("merchant catalog composition", () => {
  beforeEach(() => {
    builderCalls.length = 0;
  });

  it("gives each merchant an explicit independent 87-ID manifest", () => {
    expect(discoveryDecantsAvailableIds).toHaveLength(87);
    expect(aurelianAvailableIds).toHaveLength(87);
    expect(discoveryDecantsAvailableIds).toEqual(expectedIds());
    expect(aurelianAvailableIds).toEqual(expectedIds());
    expect(discoveryDecantsAvailableIds).not.toBe(aurelianAvailableIds);
  });

  it("keeps merchant availability modules independent", () => {
    const discoverySource = readFileSync(
      fileURLToPath(new URL("../merchants/discoveryDecants/catalog.js", import.meta.url)),
      "utf8"
    );
    const aurelianSource = readFileSync(
      fileURLToPath(new URL("../../apps/aurelian/src/merchant/catalog.js", import.meta.url)),
      "utf8"
    );

    expect(discoverySource).not.toMatch(/aurelian/i);
    expect(aurelianSource).not.toMatch(/discoveryDecants|discovery-decants/i);
  });

  it("creates independent projections without changing canonical records", () => {
    const before = JSON.stringify(perfumes);
    const discoveryCatalog = createMerchantCatalog({
      source: perfumes,
      availableIds: discoveryDecantsAvailableIds,
    });
    const aurelianCatalog = createMerchantCatalog({
      source: perfumes,
      availableIds: aurelianAvailableIds,
    });

    assertCurrentCatalog(discoveryCatalog);
    assertCurrentCatalog(aurelianCatalog);
    expect(discoveryCatalog).not.toBe(perfumes);
    expect(aurelianCatalog).not.toBe(perfumes);
    expect(discoveryCatalog).not.toBe(aurelianCatalog);
    expect(JSON.stringify(perfumes)).toBe(before);
  });

  it("passes each merchant projection to Builder instead of the canonical array", () => {
    simulateReturningAurelianVisitor();
    try {
      renderToStaticMarkup(<DiscoveryDecantsApp />);
      renderToStaticMarkup(<BuilderExperience isDevelopment={import.meta.env.DEV} />);
    } finally {
      globalThis.window = originalWindow;
    }

    expect(builderCalls).toHaveLength(2);
    const [discoveryProps, aurelianProps] = builderCalls;
    assertCurrentCatalog(discoveryProps.catalog);
    assertCurrentCatalog(aurelianProps.catalog);
    expect(discoveryProps.catalog).not.toBe(perfumes);
    expect(aurelianProps.catalog).not.toBe(perfumes);
    expect(discoveryProps.catalog).not.toBe(aurelianProps.catalog);
    expect(discoveryProps.finalizationAdapter).toBeTruthy();
    expect(aurelianProps.finalizationAdapter).toBeTruthy();
    expect(discoveryProps.assetResolver("brands/example.png")).toBe("/catalog-assets/brands/example.png");
    expect(aurelianProps.assetResolver("brands/example.png")).toBe("/catalog-assets/brands/example.png");
    expect(discoveryProps.isDevelopment).toBe(import.meta.env.DEV);
    expect(aurelianProps.isDevelopment).toBe(import.meta.env.DEV);
  });

  it("keeps public catalog roots at merchant host composition only", () => {
    const discoverySource = readFileSync(
      fileURLToPath(new URL("./DiscoveryDecantsApp.jsx", import.meta.url)),
      "utf8",
    );
    const aurelianSource = readFileSync(
      fileURLToPath(new URL("../../apps/aurelian/src/components/BuilderExperience.jsx", import.meta.url)),
      "utf8",
    );
    const sharedSources = [
      "../../packages/builder/src/builder/DiscoveryBoxBuilder.jsx",
      "../../packages/builder/src/components/BuilderPanel.jsx",
      "../../packages/builder/src/components/PerfumeCard.jsx",
      "../../packages/builder/src/components/CollectionCard.jsx",
    ].map((relativePath) => readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), "utf8"));

    expect(discoverySource).toContain('basePath: "/catalog-assets"');
    expect(aurelianSource).toContain('basePath: "/catalog-assets"');
    sharedSources.forEach((source) => expect(source).not.toMatch(/\/(?:catalog-assets|images)\b/));
  });
});
