import { readFileSync } from "node:fs";

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { DiscoveryBoxBuilder } from "@discovery-box/builder";
import { aurelianConfig } from "../../apps/aurelian/src/merchant/config.js";
import { discoveryDecantsConfig } from "../merchants/discoveryDecants/config.js";
import { createCatalogAssetResolver, fragrances as perfumes, notes } from "@discovery-box/catalog";

const assetResolver = createCatalogAssetResolver({ basePath: "/catalog-assets" });

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
    expect(markup).toContain("Points");
    expect(markup).not.toContain("Aurelian");
  });

  it("renders the explicit Aurelian implementation in Mexican Spanish", () => {
    const markup = renderBuilder(aurelianConfig);

    expect(markup).toContain("Catálogo");
    expect(markup).toContain("Mi caja");
    expect(markup).toContain("Armar mi caja");
    expect(markup).toContain("Puntos");
    expect(markup).not.toContain("Discovery Decants");
  });

  it("leaves canonical catalog filter values unchanged while translating labels", () => {
    const markup = renderBuilder(aurelianConfig);

    expect(markup).toContain('value="winter"');
    // Every option now carries its own capitalized "Category: Value" prefix
    // (see FilterBar.jsx) so the closed select is self-describing once a
    // value is chosen, not just "Invierno" bare.
    expect(markup).toContain(">Temporadas: Invierno</option>");
    expect(markup).not.toContain('value="Invierno"');
  });

  it("keeps components from importing merchant implementations directly", () => {
    const componentSource = readFileSync("packages/builder/src/components/BuilderPanel.jsx", "utf8");

    expect(componentSource).not.toMatch(/merchants\/(aurelian|discoveryDecants)/);
  });

  it("flows the host finalization adapter to BuilderPanel without browser delivery side effects", () => {
    const publicBuilderSource = readFileSync("packages/builder/src/builder/DiscoveryBoxBuilder.jsx", "utf8");
    const appSource = readFileSync("packages/builder/src/BuilderRuntime.jsx", "utf8");
    const panelSource = readFileSync("packages/builder/src/components/BuilderPanel.jsx", "utf8");

    expect(publicBuilderSource).toContain("finalizationAdapter={finalizationAdapter}");
    expect(appSource).toContain("finalizationAdapter={finalizationAdapter}");
    expect(panelSource).toContain("finalizationAdapter.finalize(finalizationModel)");
    expect(panelSource).not.toMatch(/window\.open|navigator\.clipboard|wa\.me/);
  });

  it("flows the host asset resolver through the public Builder boundary", () => {
    const publicBuilderSource = readFileSync("packages/builder/src/builder/DiscoveryBoxBuilder.jsx", "utf8");
    const appSource = readFileSync("packages/builder/src/BuilderRuntime.jsx", "utf8");

    expect(publicBuilderSource).toContain("assetResolver={assetResolver}");
    expect(appSource).toContain("assetResolver={assetResolver}");
  });

  it("never shows the intent-recommendation surface for Discovery Decants, which never supplies a hint", () => {
    const markup = renderBuilder(discoveryDecantsConfig);

    expect(markup).not.toContain("intent-recommendations");
    expect(markup).not.toContain("Recommended for you");

    const discoverySource = readFileSync("src/app/DiscoveryDecantsApp.jsx", "utf8");
    expect(discoverySource).not.toContain("initialRecommendationHint");
  });

  it("keeps generic WhatsApp adapter construction in each merchant host", () => {
    const discoverySource = readFileSync("src/app/DiscoveryDecantsApp.jsx", "utf8");
    const aurelianSource = readFileSync("apps/aurelian/src/components/BuilderExperience.jsx", "utf8");

    expect(discoverySource).toContain("createWhatsAppFinalizationAdapter");
    expect(discoverySource).toContain("finalizationAdapter={finalizationAdapter}");
    expect(aurelianSource).toContain("createWhatsAppFinalizationAdapter");
    expect(aurelianSource).toContain("finalizationAdapter={finalizationAdapter}");
    expect(aurelianConfig.finalization.mode).toBe("whatsapp");
    expect(aurelianConfig.finalization.whatsappNumber).toBe("528129800010");
    expect(aurelianConfig.features.whatsappFinalization).toBe(true);
  });
});
