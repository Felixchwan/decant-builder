import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it } from "vitest";

import { discoveryDecantsConfig } from "../../../../src/merchants/discoveryDecants/config.js";
import { buildCollectionSummary } from "../builder/internal/intelligence/buildCollectionSummary.js";
import { buildComposerRecommendations } from "../builder/internal/recommendations/buildComposerRecommendations.js";
import { aurelianConfig } from "../../../../src/merchants/aurelian/config.js";
import { fragrances as perfumes, notes } from "@discovery-box/catalog";
import { createTranslator } from "../i18n/createTranslator.js";
import { buildScentDna } from "../utils/buildScentDna.js";
import BuilderPanel, { ScentLibraryContent } from "./BuilderPanel.jsx";

const originalWindow = globalThis.window;
const appCss = readFileSync(new URL("../../styles.css", import.meta.url), "utf8");
const builderPanelSource = readFileSync(new URL("./BuilderPanel.jsx", import.meta.url), "utf8");

function simulateFirstVisit() {
  globalThis.window = {
    localStorage: {
      getItem: () => null,
      setItem: () => {},
    },
  };
}

function renderBuilderPanel(overrides = {}) {
  const selectedPerfumes = overrides.selectedPerfumes || [];
  const builderConfig = overrides.builderConfig || discoveryDecantsConfig;
  const collectionSummary = buildCollectionSummary({
    selectedPerfumes,
    catalog: perfumes,
    notes,
    config: builderConfig,
  });
  const recommendations = buildComposerRecommendations({
    perfumes,
    selectedPerfumes,
    notes,
    config: builderConfig,
  });

  return renderToStaticMarkup(
    <BuilderPanel
      builderConfig={builderConfig}
      assetResolver={(assetKey) => `/images/${assetKey}`}
      totalSlots={collectionSummary.counts.selected}
      maxSlots={builderConfig.box.totalPhysicalSlots}
      maxSelectableSlots={builderConfig.box.maxSelectableSlots}
      totalPoints={collectionSummary.points.total}
      estimatedValue={collectionSummary.money.total}
      selectedPerfumes={selectedPerfumes}
      catalogPerfumes={perfumes}
      notes={notes}
      boxSummary={collectionSummary.boxSummary}
      onClearBox={() => {}}
      onRemovePerfume={() => {}}
      onReorderPerfumes={() => {}}
      minSlots={builderConfig.box.minSelectableSlots}
      missingSlots={collectionSummary.counts.minimumRemaining}
      missingPoints={collectionSummary.points.remaining}
      coverageSummary={collectionSummary.coverageSummary}
      recommendations={recommendations}
      scentDna={buildScentDna(selectedPerfumes, collectionSummary.boxSummary)}
      isBoxReady={collectionSummary.readiness.isReady}
      onAddPerfume={() => {}}
      composerSettings={{
        strategy: "balanced",
        collectionStyle: "balanced_mix",
        budget: "600",
        seasons: [],
        occasions: [],
        vibes: [],
      }}
      composerOptions={{
        seasons: ["spring", "summer"],
        occasions: ["office", "date"],
        vibes: ["fresh", "elegant"],
      }}
      minimumComposerBudget={600}
      composerProposal={null}
      isComposerProposalStale={false}
      composerStatusMessage=""
      onComposerSettingChange={() => {}}
      onComposerPreferenceToggle={() => {}}
      onComposerPreferenceClear={() => {}}
      onComposeMyBox={() => {}}
      onApplyComposerProposal={() => {}}
      onMoveComposerProposalAlternative={() => {}}
      onCancelComposerProposal={() => {}}
      curatorBonusPreference={builderConfig.curatorBonus.defaultPreference}
      onCuratorBonusPreferenceChange={() => {}}
      reviewCustomerInfo={builderConfig.finalization.customerDefaults}
      onReviewCustomerInfoChange={() => {}}
      onMobileTabChange={() => {}}
      {...overrides}
    />
  );
}

afterEach(() => {
  globalThis.window = originalWindow;
});

describe("BuilderPanel development capability", () => {
  it("keeps development-only UI hidden when omitted", () => {
    expect(renderBuilderPanel()).not.toContain(discoveryDecantsConfig.collectionCard.previewLabel);
  });

  it("keeps development-only UI hidden when explicitly false", () => {
    expect(renderBuilderPanel({ isDevelopment: false })).not.toContain(
      discoveryDecantsConfig.collectionCard.previewLabel,
    );
  });

  it("shows the existing development preview action when enabled", () => {
    expect(renderBuilderPanel({ isDevelopment: true })).toContain(
      discoveryDecantsConfig.collectionCard.previewLabel,
    );
  });
});

describe("BuilderPanel Composer setup launcher", () => {
  it("renders a compact Composer card without inline setup controls", () => {
    const markup = renderBuilderPanel();

    expect(markup).toContain("Build a box from your preferences.");
    expect(markup).not.toContain("Build a personalized discovery box.");
    expect(markup).toContain("Compose My Box");
    expect(markup).not.toContain("compose-box-controls");
    expect(markup).not.toContain("<select");
    expect(markup).not.toContain("Strategy");
    expect(markup).not.toContain("Budget");
  });

  it("keeps Collection Card attached to slots before Composer and Curator Bonus", () => {
    const markup = renderBuilderPanel();
    const collectionCardIndex = markup.indexOf("Collection Card");
    const composerIndex = markup.indexOf("Build a box from your preferences.");
    const curatorIndex = markup.indexOf("discovery-bonus-panel");

    expect(collectionCardIndex).toBeGreaterThan(-1);
    expect(curatorIndex).toBeGreaterThan(-1);
    expect(composerIndex).toBeGreaterThan(collectionCardIndex);
    expect(curatorIndex).toBeGreaterThan(composerIndex);
  });

  it("keeps Collection Card share actions and responsive tooltip feedback available", () => {
    const markup = renderBuilderPanel({ isDevelopment: true });

    expect(markup).toContain("Download PNG");
    expect(markup).toContain("Preview Card");
    expect(markup).toContain('aria-describedby="share-box-tooltip"');
    expect(markup).toContain('role="tooltip"');
    expect(markup).toContain("Export an editorial card for your finished Discovery Box.");
  });

  it("localizes Collection Card tooltip feedback for Aurelian", () => {
    const markup = renderBuilderPanel({ builderConfig: aurelianConfig });

    expect(markup).toContain("Exporta una tarjeta editorial de tu Discovery Box terminada.");
    expect(markup).not.toContain("collectionCard.tooltip");
  });

  it("anchors the mobile Collection Card tooltip locally without global overflow suppression", () => {
    expect(appCss).toMatch(/\.share-box-actions\s*\{[^}]*position:\s*relative;/s);
    expect(appCss).toMatch(/@media\s*\(max-width:\s*520px\)\s*\{[\s\S]*?\.share-info-wrap\s*\{[^}]*position:\s*static;/);
    expect(appCss).toMatch(/@media\s*\(max-width:\s*520px\)\s*\{[\s\S]*?\.share-box-tooltip\s*\{[^}]*right:\s*0;/);
    expect(appCss).toMatch(/@media\s*\(max-width:\s*520px\)\s*\{[\s\S]*?\.share-box-tooltip\s*\{[^}]*width:\s*min\(250px,\s*100%\);/);
    expect(appCss).toMatch(/\.share-box-status\s*\{[^}]*overflow-wrap:\s*anywhere;/s);
    expect(appCss).not.toMatch(/(?:html|body|#root)\s*,?[\s\S]{0,80}overflow-x:\s*hidden/);
  });

  it("allows expanded Collection Intelligence analysis to grow without clipping taxonomy content", () => {
    expect(appCss).toMatch(
      /\.collection-snapshot\.is-expanded \.collection-snapshot-details\s*\{[^}]*max-height:\s*none;[^}]*overflow:\s*visible;/s
    );
    expect(appCss).not.toMatch(
      /\.collection-snapshot\.is-expanded \.collection-snapshot-details\s*\{[^}]*max-height:\s*\d/s
    );
    expect(appCss).not.toContain("Show More");
  });

  it("keeps mobile Composer proposal layout scoped to Composer classes", () => {
    expect(appCss).toMatch(
      /@media\s*\(max-width:\s*520px\)\s*\{[\s\S]*?\.composer-proposal-item\s*\{[^}]*display:\s*grid;[^}]*grid-template-columns:\s*30px minmax\(0,\s*1fr\) 30px;/s
    );
    expect(appCss).toMatch(
      /@media\s*\(max-width:\s*520px\)\s*\{[\s\S]*?\.composer-proposal-item\.no-alternatives\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\);/s
    );
    expect(appCss).not.toMatch(/\.composer-proposal-modal[\s\S]{0,600}\.summary-metadata-chip/);
    expect(appCss).not.toMatch(/\.composer-proposal-modal[\s\S]{0,600}\.detail-asset-chip/);
  });

  it("shows a busy Composer state while a proposal is being generated", () => {
    const markup = renderBuilderPanel({ isComposerGenerating: true });

    expect(markup).toContain('aria-busy="true"');
    expect(markup).toContain("Composing...");
    expect(markup).toContain("Building your Discovery Box proposal.");
  });

  it("uses customer-facing order terminology in the box summary", () => {
    const markup = renderBuilderPanel();

    expect(markup).toContain("Order Total");
    expect(markup).not.toContain("Estimated Total");
  });

  it("keeps compact Collection Intelligence focused on profile, DNA, and balance", () => {
    const markup = renderBuilderPanel({ selectedPerfumes: [perfumes[0], perfumes[1], perfumes[2]] });

    expect(markup).toContain("Collection Intelligence");
    expect(markup).toContain("Collection Profile");
    expect(markup).toContain("Collection DNA");
    expect(markup).toContain("Collection Balance");
    expect(markup).not.toContain("Season Coverage");
  });

  it("moves seasonal analysis into Full Analysis with a season profile view", () => {
    const markup = renderBuilderPanel({ selectedPerfumes: [perfumes[0], perfumes[1], perfumes[2]] });

    expect(markup).toContain("Season Profile");
    expect(markup).toContain("season-profile-chart");
    expect(markup).toContain("season-profile-shape");
    expect(markup).toContain("Leans");
  });

  it("renders Full Analysis taxonomy tags with metadata assets when mappings exist", () => {
    const markup = renderBuilderPanel({ selectedPerfumes: [perfumes[0], perfumes[1], perfumes[2]] });

    expect(markup).toContain("summary-metadata-chip");
    expect(markup).toContain("/images/metadata/seasons/");
    expect(markup).toContain("/images/metadata/occasions/");
    expect(markup).toContain("/images/metadata/vibes/");
    expect(markup).toContain("/images/metadata/accords/");
  });

  it("removes redundant rank and score badges from recommendation cards", () => {
    const markup = renderBuilderPanel({ selectedPerfumes: [perfumes[0], perfumes[1], perfumes[2]] });

    expect(markup).toContain("recommendation-carousel-controls");
    expect(markup).not.toContain("recommendation-rank");
    expect(markup).not.toContain("recommendation-score");
  });

  it("keeps Composer proposal item structure separate from Full Analysis metadata chips", () => {
    expect(builderPanelSource).toContain("composer-proposal-item ${");
    expect(builderPanelSource).toContain('hasAlternatives ? "has-alternatives" : "no-alternatives"');
    expect(builderPanelSource).toContain('className="composer-proposal-item-reasons"');
    expect(builderPanelSource).toContain('className="composer-proposal-alt-button"');
    expect(builderPanelSource).toContain('className="composer-proposal-alt-position"');
    expect(builderPanelSource).not.toMatch(/composer-proposal-item-reasons[\s\S]{0,500}MetadataSummaryChip/);
    expect(builderPanelSource).not.toMatch(/composer-proposal-item-reasons[\s\S]{0,500}detail-asset-chip/);
    expect(builderPanelSource).not.toMatch(/composer-proposal-alt-button[\s\S]{0,300}summary-metadata-chip/);
  });

  it("keeps the empty My Box header compact and leaves slot count in the summary card", () => {
    const markup = renderBuilderPanel();

    expect(markup).not.toContain("0/14 selected slots used");
    expect(markup).not.toContain("Clear Box");
    expect(markup).not.toContain("Clear Builder");
    expect(markup).toContain("0 / 14");
    expect(markup).toContain('aria-label="Show Discovery Box introduction"');
  });

  it("shows localized Clear Box only when the box is populated", () => {
    const markup = renderBuilderPanel({ selectedPerfumes: [perfumes[0]] });

    expect(markup).toContain("Clear Box");
    expect(markup).not.toContain("Clear Builder");
    expect(markup).not.toContain("1/14 selected slots used");
    expect(markup).toContain("1 / 14");
  });

  it("uses Aurelian localized clear copy for populated boxes", () => {
    const markup = renderBuilderPanel({
      builderConfig: aurelianConfig,
      selectedPerfumes: [perfumes[0]],
    });

    expect(markup).toContain("Vaciar caja");
    expect(markup).not.toContain("builder.clearBuilder");
  });

  it("shows recoverable Composer failures without technical wording", () => {
    const markup = renderBuilderPanel({
      composerStatusMessage: "We couldn't complete that action. Please try again.",
    });

    expect(markup).toContain("We couldn&#x27;t complete that action. Please try again.");
    expect(markup).not.toContain("Composer engine failed");
    expect(markup).not.toContain("undefined");
  });

  it("renders first-visit onboarding path choices from localized config", () => {
    simulateFirstVisit();

    const markup = renderBuilderPanel();

    expect(markup).toContain("Explore the catalog yourself");
    expect(markup).toContain("Explore Catalog");
    expect(markup).toContain("Let Composer build a proposal");
    expect(markup).toContain("Use Composer");
    expect(markup).toContain("Try Composer");
    expect(markup).toContain('aria-label="Close onboarding"');
    expect(markup).toContain("You can switch between both methods at any time.");
    expect(markup).not.toContain("builder.onboarding");
  });

  it("renders the Aurelian mobile close label through localization", () => {
    simulateFirstVisit();

    const markup = renderBuilderPanel({ builderConfig: aurelianConfig });

    expect(markup).toContain('aria-label="Cerrar introducción"');
    expect(markup).not.toContain("builder.onboardingCloseLabel");
  });

  it("renders enriched Scent Library note buttons with images, names, and unique perfume counts", () => {
    const entries = [
      {
        noteId: "cedar",
        name: "Cedar",
        image: "/images/notes/cedar.jpg",
        perfumeCount: 4,
        perfumes: [
          { perfumeId: 1, name: "One", shortName: "One", brand: "A", image: "/one.png" },
        ],
      },
      {
        noteId: "mineralNotes",
        name: "Mineral Notes",
        image: "",
        perfumeCount: 1,
        perfumes: [
          { perfumeId: 2, name: "Two", shortName: "", brand: "B", image: "" },
        ],
      },
    ];

    const markup = renderToStaticMarkup(
      <ScentLibraryContent
        entries={entries}
        translator={createTranslator("en-US")}
        selectedNoteId={null}
        onClose={() => {}}
        onSelectNote={() => {}}
        onCloseDetail={() => {}}
      />
    );

    expect(markup).toContain("scent-library-note-button");
    expect(markup).toContain("/images/notes/cedar.jpg");
    expect(markup).toContain("Cedar");
    expect(markup).toContain("×4");
    expect(markup).toContain("Mineral Notes");
    expect(markup).toContain("scent-library-note-fallback");
    expect(markup).toContain("Cedar, found in 4 fragrances");
    expect(markup).toContain("Mineral Notes, found in 1 fragrance");
  });

  it("does not render transient Scent Library preview markup or preview wiring", () => {
    const entries = [
      {
        noteId: "cedar",
        name: "Cedar",
        image: "/images/notes/cedar.jpg",
        perfumeCount: 1,
        perfumes: [
          { perfumeId: 1, name: "One", shortName: "One", brand: "A", image: "" },
        ],
      },
    ];

    const markup = renderToStaticMarkup(
      <ScentLibraryContent
        entries={entries}
        translator={createTranslator("en-US")}
        selectedNoteId={null}
        onClose={() => {}}
        onSelectNote={() => {}}
        onCloseDetail={() => {}}
      />
    );

    expect(markup).not.toContain('role="tooltip"');
    expect(markup).not.toContain("scent-library-preview");
    expect(builderPanelSource).not.toContain("ScentLibraryPreview");
    expect(builderPanelSource).not.toContain("previewNoteId");
    expect(builderPanelSource).not.toContain("onPreviewNote");
  });

  it("keeps Scent Library activation deliberate and free of hover/focus/long-press handlers", () => {
    const noteItemSource = builderPanelSource.slice(
      builderPanelSource.indexOf("function ScentLibraryNoteItem"),
      builderPanelSource.indexOf("function ScentLibraryDetail")
    );

    expect(noteItemSource).toContain("onClick={onSelect}");
    expect(noteItemSource).not.toContain("onMouseEnter");
    expect(noteItemSource).not.toContain("onMouseLeave");
    expect(noteItemSource).not.toContain("onFocus");
    expect(noteItemSource).not.toContain("onBlur");
    expect(noteItemSource).not.toContain("onTouchStart");
    expect(noteItemSource).not.toContain("onTouchMove");
    expect(noteItemSource).not.toContain("onTouchEnd");
    expect(noteItemSource).not.toContain("onTouchCancel");
    expect(noteItemSource).not.toContain("setTimeout");
    expect(noteItemSource).not.toContain("longPress");
  });

  it("renders persistent Scent Library note detail without catalog card or Add controls", () => {
    const entry = {
      noteId: "cedar",
      name: "Cedar",
      image: "/images/notes/cedar.jpg",
      perfumeCount: 2,
      perfumes: [
        {
          perfumeId: 1,
          name: "Acqua di Gio EDT",
          shortName: "ADG EDT",
          brand: "Giorgio Armani",
          image: "/images/perfumes/bronze/batch-01/acqua-di-gio-edt.png",
        },
        {
          perfumeId: 2,
          name: "Bois Impérial",
          shortName: "Bois Impérial",
          brand: "Essential Parfums",
          image: "",
        },
      ],
    };

    const markup = renderToStaticMarkup(
      <ScentLibraryContent
        entries={[entry]}
        translator={createTranslator("en-US")}
        selectedNoteId="cedar"
        onClose={() => {}}
        onSelectNote={() => {}}
        onCloseDetail={() => {}}
      />
    );

    expect(markup).toContain('aria-expanded="true"');
    expect(markup).toContain("Fragrances with Cedar");
    expect(markup).toContain("Acqua di Gio EDT");
    expect(markup).toContain("Giorgio Armani");
    expect(markup).toContain("Bois Impérial");
    expect(markup).toContain("Close note details");
    expect(markup).not.toContain("perfume-card");
    expect(markup).not.toContain("Add to Box");
  });

  it("updates the persistent Scent Library detail when another note is selected", () => {
    const entries = [
      {
        noteId: "cedar",
        name: "Cedar",
        image: "/images/notes/cedar.jpg",
        perfumeCount: 1,
        perfumes: [
          { perfumeId: 1, name: "Cedary One", shortName: "", brand: "A", image: "" },
        ],
      },
      {
        noteId: "jasmine",
        name: "Jasmine",
        image: "/images/notes/jasmine.jpg",
        perfumeCount: 1,
        perfumes: [
          { perfumeId: 2, name: "Floral Two", shortName: "", brand: "B", image: "" },
        ],
      },
    ];

    const markup = renderToStaticMarkup(
      <ScentLibraryContent
        entries={entries}
        translator={createTranslator("en-US")}
        selectedNoteId="jasmine"
        onClose={() => {}}
        onSelectNote={() => {}}
        onCloseDetail={() => {}}
      />
    );

    expect(markup).toContain('aria-expanded="true"');
    expect(markup).toContain("Fragrances with Jasmine");
    expect(markup).toContain("Floral Two");
    expect(markup).not.toContain("Fragrances with Cedar");
    expect(markup).not.toContain("Cedary One");
  });

  it("localizes Scent Library count and detail copy for Aurelian", () => {
    const entry = {
      noteId: "cedar",
      name: "Cedar",
      image: "/images/notes/cedar.jpg",
      perfumeCount: 2,
      perfumes: [
        { perfumeId: 1, name: "Uno", shortName: "", brand: "Casa", image: "" },
        { perfumeId: 2, name: "Dos", shortName: "", brand: "Casa", image: "" },
      ],
    };

    const markup = renderToStaticMarkup(
      <ScentLibraryContent
        entries={[entry]}
        translator={createTranslator(aurelianConfig.locale)}
        selectedNoteId="cedar"
        onClose={() => {}}
        onSelectNote={() => {}}
        onCloseDetail={() => {}}
      />
    );

    expect(markup).toContain("Biblioteca olfativa");
    expect(markup).toContain("Presente en 2 fragancias");
    expect(markup).toContain("Fragancias con Cedar");
    expect(markup).not.toContain("scentLibrary.");
  });

  it("does not render dead Composer onboarding actions when Composer is disabled", () => {
    simulateFirstVisit();

    const configWithoutComposer = {
      ...discoveryDecantsConfig,
      features: {
        ...discoveryDecantsConfig.features,
        composer: false,
      },
    };
    const markup = renderBuilderPanel({ builderConfig: configWithoutComposer });

    expect(markup).toContain("Explore the catalog yourself");
    expect(markup).toContain("Explore Catalog");
    expect(markup).not.toContain("Use Composer");
    expect(markup).not.toContain("Try Composer");
  });
});
