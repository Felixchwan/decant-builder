import { readFileSync } from "node:fs";

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { DiscoveryBoxBuilder } from "../builder/index.js";
import { aurelianConfig } from "../merchants/aurelian/config.js";
import { discoveryDecantsConfig } from "../merchants/discoveryDecants/config.js";
import { perfumes } from "../data/perfumes.js";
import { notes } from "../data/notes.js";

function renderBuilder(config) {
  return renderToStaticMarkup(
    <DiscoveryBoxBuilder catalog={perfumes} notes={notes} config={config} />
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
});
