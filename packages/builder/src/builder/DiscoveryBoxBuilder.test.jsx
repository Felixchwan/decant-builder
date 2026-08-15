import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createCatalogAssetResolver } from "@discovery-box/catalog";
import { discoveryDecantsConfig } from "../../../../src/merchants/discoveryDecants/config.js";

const appCalls = vi.hoisted(() => []);

vi.mock("../BuilderRuntime.jsx", () => ({
  default: (props) => {
    appCalls.push(props);
    return <div data-testid="builder-app" />;
  },
}));

import DiscoveryBoxBuilder from "./DiscoveryBoxBuilder.jsx";

describe("DiscoveryBoxBuilder asset resolver boundary", () => {
  beforeEach(() => {
    appCalls.length = 0;
  });

  it("resolves catalog and note keys before passing view data to App", () => {
    const catalog = [{
      id: 1,
      name: "Example",
      imageAssetKey: "perfumes/example.png",
    }];
    const notes = {
      cedar: { name: "Cedar", noteImageAssetKey: "notes/cedar.jpg" },
    };
    const assetResolver = createCatalogAssetResolver({ basePath: "/merchant-assets" });

    renderToStaticMarkup(
      <DiscoveryBoxBuilder
        catalog={catalog}
        notes={notes}
        config={discoveryDecantsConfig}
        assetResolver={assetResolver}
      />,
    );

    expect(appCalls).toHaveLength(1);
    expect(appCalls[0].assetResolver).toBe(assetResolver);
    expect(appCalls[0].catalog[0]).toMatchObject({
      imageAssetKey: "perfumes/example.png",
      image: "/merchant-assets/perfumes/example.png",
      imageFallback: "/merchant-assets/perfumes/placeholders/perfume-placeholder.svg",
    });
    expect(appCalls[0].notes.cedar).toMatchObject({
      noteImageAssetKey: "notes/cedar.jpg",
      noteImage: "/merchant-assets/notes/cedar.jpg",
    });
    expect(catalog[0]).not.toHaveProperty("image");
    expect(notes.cedar).not.toHaveProperty("noteImage");
  });

  it("requires an explicit host resolver", () => {
    expect(() =>
      renderToStaticMarkup(
        <DiscoveryBoxBuilder catalog={[]} notes={{}} config={discoveryDecantsConfig} />,
      ),
    ).toThrow(/assetResolver/);
  });

  it("defaults development capability to false and forwards explicit per-instance values", () => {
    const assetResolver = createCatalogAssetResolver({ basePath: "/merchant-assets" });

    renderToStaticMarkup(
      <>
        <DiscoveryBoxBuilder
          catalog={[]}
          config={discoveryDecantsConfig}
          assetResolver={assetResolver}
        />
        <DiscoveryBoxBuilder
          catalog={[]}
          config={discoveryDecantsConfig}
          assetResolver={assetResolver}
          isDevelopment
        />
        <DiscoveryBoxBuilder
          catalog={[]}
          config={discoveryDecantsConfig}
          assetResolver={assetResolver}
          isDevelopment={false}
        />
      </>,
    );

    expect(appCalls.map(({ isDevelopment }) => isDevelopment)).toEqual([false, true, false]);
  });

  it("forwards an optional stable initial fragrance intent without changing the default", () => {
    const assetResolver = createCatalogAssetResolver({ basePath: "/merchant-assets" });

    renderToStaticMarkup(
      <>
        <DiscoveryBoxBuilder catalog={[]} config={discoveryDecantsConfig} assetResolver={assetResolver} />
        <DiscoveryBoxBuilder catalog={[]} config={discoveryDecantsConfig} assetResolver={assetResolver} initialFragranceId={104} />
      </>,
    );

    expect(appCalls.map(({ initialFragranceId }) => initialFragranceId)).toEqual([null, 104]);
  });

  it("forwards an optional initial recommendation hint expressed only in Composer's own request vocabulary, without changing the default", () => {
    const assetResolver = createCatalogAssetResolver({ basePath: "/merchant-assets" });
    const hint = { strategy: "signature", preferredOccasions: ["daily"], preferredVibes: ["fresh"], excludedPerfumeIds: [] };

    renderToStaticMarkup(
      <>
        <DiscoveryBoxBuilder catalog={[]} config={discoveryDecantsConfig} assetResolver={assetResolver} />
        <DiscoveryBoxBuilder
          catalog={[]}
          config={discoveryDecantsConfig}
          assetResolver={assetResolver}
          initialRecommendationHint={hint}
        />
      </>,
    );

    expect(appCalls.map(({ initialRecommendationHint }) => initialRecommendationHint)).toEqual([
      null,
      hint,
    ]);
  });

  it("defaults hero-section suppression to false and forwards an explicit opt-in unchanged", () => {
    const assetResolver = createCatalogAssetResolver({ basePath: "/merchant-assets" });

    renderToStaticMarkup(
      <>
        <DiscoveryBoxBuilder catalog={[]} config={discoveryDecantsConfig} assetResolver={assetResolver} />
        <DiscoveryBoxBuilder
          catalog={[]}
          config={discoveryDecantsConfig}
          assetResolver={assetResolver}
          isIntroCollapsed
        />
      </>,
    );

    expect(appCalls.map(({ isIntroCollapsed }) => isIntroCollapsed)).toEqual([false, true]);
  });

  it("defaults the collapsible right-panel rail to false and forwards an explicit opt-in unchanged", () => {
    const assetResolver = createCatalogAssetResolver({ basePath: "/merchant-assets" });

    renderToStaticMarkup(
      <>
        <DiscoveryBoxBuilder catalog={[]} config={discoveryDecantsConfig} assetResolver={assetResolver} />
        <DiscoveryBoxBuilder
          catalog={[]}
          config={discoveryDecantsConfig}
          assetResolver={assetResolver}
          enablePanelCollapse
        />
      </>,
    );

    expect(appCalls.map(({ enablePanelCollapse }) => enablePanelCollapse)).toEqual([false, true]);
  });
});
