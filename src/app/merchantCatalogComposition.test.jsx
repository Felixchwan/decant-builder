import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const builderCalls = vi.hoisted(() => []);

vi.mock("../builder/index.js", () => ({
  DiscoveryBoxBuilder(props) {
    builderCalls.push(props);
    return <div data-testid="merchant-builder" />;
  },
}));

import AurelianApp from "./AurelianApp.jsx";
import DiscoveryDecantsApp from "./DiscoveryDecantsApp.jsx";
import { createMerchantCatalog } from "../catalog/createMerchantCatalog.js";
import { CATALOG_IDENTITY_BASELINE } from "../data/catalogIdentityBaseline.fixture.js";
import { perfumes } from "../data/perfumes.js";
import { aurelianAvailableIds } from "../merchants/aurelian/catalog.js";
import { discoveryDecantsAvailableIds } from "../merchants/discoveryDecants/catalog.js";
import { getTierData } from "../utils/tierUtils.js";

function expectedIds() {
  return CATALOG_IDENTITY_BASELINE.map(([id]) => id);
}

function assertCurrentCatalog(catalog) {
  expect(catalog).toHaveLength(84);
  expect(catalog.map(({ id }) => id)).toEqual(expectedIds());
  expect(catalog.map(({ id, points }) => [id, getTierData(id).name, points])).toEqual(
    CATALOG_IDENTITY_BASELINE
  );
  catalog.forEach((record, index) => expect(record).toBe(perfumes[index]));
}

describe("merchant catalog composition", () => {
  beforeEach(() => {
    builderCalls.length = 0;
  });

  it("gives each merchant an explicit independent 84-ID manifest", () => {
    expect(discoveryDecantsAvailableIds).toHaveLength(84);
    expect(aurelianAvailableIds).toHaveLength(84);
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
      fileURLToPath(new URL("../merchants/aurelian/catalog.js", import.meta.url)),
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
    renderToStaticMarkup(<DiscoveryDecantsApp />);
    renderToStaticMarkup(<AurelianApp />);

    expect(builderCalls).toHaveLength(2);
    const [discoveryProps, aurelianProps] = builderCalls;
    assertCurrentCatalog(discoveryProps.catalog);
    assertCurrentCatalog(aurelianProps.catalog);
    expect(discoveryProps.catalog).not.toBe(perfumes);
    expect(aurelianProps.catalog).not.toBe(perfumes);
    expect(discoveryProps.catalog).not.toBe(aurelianProps.catalog);
    expect(discoveryProps.finalizationAdapter).toBeTruthy();
    expect(aurelianProps.finalizationAdapter).toBeUndefined();
  });
});
