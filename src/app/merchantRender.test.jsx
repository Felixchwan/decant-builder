import { readFileSync } from "node:fs";

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { DiscoveryBoxBuilder } from "../builder/index.js";
import { aurelianConfig } from "../merchants/aurelian/config.js";
import { discoveryDecantsConfig } from "../merchants/discoveryDecants/config.js";
import { createCatalogAssetResolver, fragrances as perfumes, notes } from "@discovery-box/catalog";

const assetResolver = createCatalogAssetResolver({ basePath: "/images" });

function renderBuilder(config) {
  return renderToStaticMarkup(
    <DiscoveryBoxBuilder catalog={perfumes} notes={notes} config={config} assetResolver={assetResolver} />
  );
}

describe("merchant-localized Builder render", () => {
  it("renders the default Discovery Decants implementation in English", () => {
    const markup = renderBuilder(discoveryDecantsConfig);

    expect(markup).toContain("Catalog");
    expect(markup).toContain("My Box");
    expect(markup).toContain("Compose My Box");
    expect(markup).toContain("Order Total");
    expect(markup).not.toContain("Aurelian");
  });

  it("renders the explicit Aurelian implementation in Mexican Spanish", () => {
    const markup = renderBuilder(aurelianConfig);

    expect(markup).toContain("Catálogo");
    expect(markup).toContain("Mi caja");
    expect(markup).toContain("Armar mi caja");
    expect(markup).toContain("Total del pedido");
    expect(markup).not.toContain("Discovery Decants");
  });

  it("leaves canonical catalog filter values unchanged while translating labels", () => {
    const markup = renderBuilder(aurelianConfig);

    expect(markup).toContain('value="winter"');
    expect(markup).toContain(">Invierno</option>");
    expect(markup).not.toContain('value="Invierno"');
  });

  it("keeps components from importing merchant implementations directly", () => {
    const componentSource = readFileSync("src/components/BuilderPanel.jsx", "utf8");

    expect(componentSource).not.toMatch(/merchants\/(aurelian|discoveryDecants)/);
  });

  it("flows the host finalization adapter to BuilderPanel without browser delivery side effects", () => {
    const publicBuilderSource = readFileSync("src/builder/DiscoveryBoxBuilder.jsx", "utf8");
    const appSource = readFileSync("src/App.jsx", "utf8");
    const panelSource = readFileSync("src/components/BuilderPanel.jsx", "utf8");

    expect(publicBuilderSource).toContain("finalizationAdapter={finalizationAdapter}");
    expect(appSource).toContain("finalizationAdapter={finalizationAdapter}");
    expect(panelSource).toContain("finalizationAdapter.finalize(finalizationModel)");
    expect(panelSource).not.toMatch(/window\.open|navigator\.clipboard|wa\.me/);
  });

  it("flows the host asset resolver through the public Builder boundary", () => {
    const publicBuilderSource = readFileSync("src/builder/DiscoveryBoxBuilder.jsx", "utf8");
    const appSource = readFileSync("src/App.jsx", "utf8");

    expect(publicBuilderSource).toContain("assetResolver={assetResolver}");
    expect(appSource).toContain("assetResolver={assetResolver}");
  });

  it("keeps WhatsApp adapter ownership with Discovery Decants and Aurelian disabled", () => {
    const discoverySource = readFileSync("src/app/DiscoveryDecantsApp.jsx", "utf8");
    const aurelianSource = readFileSync("src/app/AurelianApp.jsx", "utf8");

    expect(discoverySource).toContain("createWhatsAppFinalizationAdapter");
    expect(discoverySource).toContain("finalizationAdapter={finalizationAdapter}");
    expect(aurelianSource).not.toContain("createWhatsAppFinalizationAdapter");
    expect(aurelianSource).not.toContain("finalizationAdapter=");
    expect(aurelianConfig.finalization.mode).toBe("unavailable");
    expect(aurelianConfig.finalization.whatsappNumber).toBe("");
    expect(aurelianConfig.features.whatsappFinalization).toBe(false);
  });
});
