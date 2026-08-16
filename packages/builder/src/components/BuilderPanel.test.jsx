import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it } from "vitest";

import { discoveryDecantsConfig } from "../../../../src/merchants/discoveryDecants/config.js";
import { buildCollectionSummary } from "../builder/internal/intelligence/buildCollectionSummary.js";
import { buildComposerRecommendations } from "../builder/internal/recommendations/buildComposerRecommendations.js";
import { aurelianConfig } from "../../../../apps/aurelian/src/merchant/config.js";
import { fragrances as perfumes, notes } from "@discovery-box/catalog";
import { createTranslator } from "../i18n/createTranslator.js";
import { esMX } from "../i18n/locales/es-MX.js";
import { buildScentDna } from "../utils/buildScentDna.js";
import BuilderPanel, { ScentLibraryContent } from "./BuilderPanel.jsx";

const originalWindow = globalThis.window;
const appCss = readFileSync(new URL("../../styles.css", import.meta.url), "utf8");
const aurelianGlobalsCss = readFileSync(
  new URL("../../../../apps/aurelian/src/app/globals.css", import.meta.url),
  "utf8"
);
const builderPanelSource = readFileSync(new URL("./BuilderPanel.jsx", import.meta.url), "utf8");
const normalizedPanelSource = builderPanelSource.replace(/\r\n/g, "\n");

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

// Regression guard for the removed "Vista previa" / Preview Card action:
// BuilderPanel no longer accepts an isDevelopment prop at all (it had
// exactly one consumer, this dev-only preview button, and both are gone
// together), and the Collection Card action row now has exactly the two
// real actions.
describe("Collection Card actions (Vista previa removed)", () => {
  it("never renders a development-only preview action, and drops the prop that only ever fed it", () => {
    const markup = renderBuilderPanel();
    expect(markup).not.toContain("Preview Card");
    expect(builderPanelSource).not.toMatch(/isDevelopment/);
    expect(builderPanelSource).not.toContain("isCollectionCardPreviewOpen");
    expect(builderPanelSource).not.toContain("CollectionCardPreviewModal");
    expect(builderPanelSource).not.toContain("previewLabel");
    expect(appCss).not.toMatch(/\.collection-card-preview/);
    expect(discoveryDecantsConfig.collectionCard.previewLabel).toBeUndefined();
    expect(esMX["collectionCard.preview"]).toBeUndefined();
  });

  it("keeps exactly the download and (when available) native-share actions in the share-box-buttons row", () => {
    const shareButtonsSource = builderPanelSource.slice(
      builderPanelSource.indexOf('<div className="share-box-buttons"'),
      builderPanelSource.indexOf('{shareStatus &&'),
    );
    expect(shareButtonsSource).toContain("handleDownloadShareImage");
    expect(shareButtonsSource).toContain("handleNativeShareCard");
    expect(shareButtonsSource.match(/<button/g)).toHaveLength(2);
  });
});

describe("BuilderPanel finalization guard", () => {
  it("uses a synchronous in-flight lock around adapter finalization", () => {
    expect(builderPanelSource).toContain("if (finalizationInFlightRef.current)");
    expect(builderPanelSource).toContain("finalizationInFlightRef.current = true");
    expect(builderPanelSource).toContain("finalizationInFlightRef.current = false");
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

  it("localizes the review-requirement conjunction instead of hardcoding English 'and'", () => {
    const enMarkup = renderBuilderPanel({ missingSlots: 6, missingPoints: 12 });
    expect(enMarkup).toContain("6 more fragrances and 12.0 more points");

    const esMarkup = renderBuilderPanel({
      builderConfig: aurelianConfig,
      missingSlots: 6,
      missingPoints: 12,
    });
    expect(esMarkup).toContain("6 fragancias y 12.0 puntos");
    expect(esMarkup).not.toMatch(/fragancias and|puntos and/);
  });

  it("does not introduce a conjunction when only one requirement is outstanding", () => {
    const slotsOnlyMarkup = renderBuilderPanel({ missingSlots: 2, missingPoints: 0 });
    expect(slotsOnlyMarkup).toContain("<p>Need 2 more fragrances to review.</p>");

    const pointsOnlyMarkup = renderBuilderPanel({
      builderConfig: aurelianConfig,
      missingSlots: 0,
      missingPoints: 3,
    });
    expect(pointsOnlyMarkup).toContain("<p>Falta 3.0 puntos para revisar.</p>");
  });

  it("keeps only the operational summary sticky, leaving Collection Card onward in normal flow", () => {
    const markup = renderBuilderPanel();
    const stickyOpenIndex = markup.indexOf('class="builder-panel-sticky-summary"');
    const stickyCloseIndex = markup.indexOf("</div>", markup.indexOf("box-slot-tray"));
    const collectionCardIndex = markup.indexOf("Collection Card");

    expect(stickyOpenIndex).toBeGreaterThan(-1);
    expect(markup.indexOf("panel-header")).toBeGreaterThan(stickyOpenIndex);
    expect(markup.indexOf("box-summary-card")).toBeGreaterThan(stickyOpenIndex);
    expect(markup.indexOf("box-slot-tray")).toBeGreaterThan(stickyOpenIndex);
    expect(collectionCardIndex).toBeGreaterThan(stickyCloseIndex);

    expect(appCss).toMatch(/:where\(\.builder-scope\) \.builder-panel-sticky-summary \{[^}]*position:\s*sticky;/s);
    expect(appCss).not.toMatch(/:where\(\.builder-scope\) \.builder-panel \{[^}]*position:\s*sticky;/s);
    expect(appCss).toMatch(
      /@media \(max-width: 980px\) \{[\s\S]*?:where\(\.builder-scope\) \.builder-panel-sticky-summary \{[^}]*position:\s*static;/
    );
    expect(appCss).not.toMatch(/\.review-action\.is-incomplete\s*\{\s*display:\s*none;/);
  });

  it("keeps Collection Card share actions and responsive tooltip feedback available", () => {
    const markup = renderBuilderPanel();

    expect(markup).toContain("Download PNG");
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

    expect(markup).toContain("<span>Total</span>");
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
    // Checks the exact rendered attribute, not a bare substring -- the
    // still-legitimate, unrelated .share-info-button (Collection Card
    // tooltip) would otherwise false-positive this check.
    expect(markup).not.toMatch(/class="info-button"/);
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

  it("renders the Aurelian mobile close label through localization when the coachmark is shown", () => {
    simulateFirstVisit();

    const aurelianWithDiscoveryCoachmark = {
      ...aurelianConfig,
      features: {
        ...aurelianConfig.features,
        discoveryCoachmark: true,
      },
    };
    const markup = renderBuilderPanel({ builderConfig: aurelianWithDiscoveryCoachmark });

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

  it("shows the empty-box discovery intro coachmark by default on first visit", () => {
    simulateFirstVisit();

    const markup = renderBuilderPanel({ builderConfig: discoveryDecantsConfig });

    expect(markup).toContain("Explore the catalog yourself");
  });

  it("suppresses the discovery intro coachmark entirely when the merchant disables it", () => {
    simulateFirstVisit();

    const configWithoutDiscoveryCoachmark = {
      ...discoveryDecantsConfig,
      features: {
        ...discoveryDecantsConfig.features,
        discoveryCoachmark: false,
      },
    };
    const markup = renderBuilderPanel({ builderConfig: configWithoutDiscoveryCoachmark });

    expect(markup).not.toContain("Explore the catalog yourself");
    expect(markup).not.toContain("Use Composer");
  });

  it("keeps the coachmark suppressed for a merchant with an empty box even after a dismissal signal", () => {
    simulateFirstVisit();

    const configWithoutDiscoveryCoachmark = {
      ...discoveryDecantsConfig,
      features: {
        ...discoveryDecantsConfig.features,
        discoveryCoachmark: false,
      },
    };
    const markup = renderBuilderPanel({
      builderConfig: configWithoutDiscoveryCoachmark,
      selectedPerfumes: [],
    });

    expect(markup).not.toContain('aria-label="Discovery Box introduction"');
  });
});

// isSummaryDocked/isSummaryCollapsed are internal component state driven by
// a scroll/resize-driven effect (see computeSummaryDockState.js for the
// actual boundary decision) that never runs under
// renderToStaticMarkup/SSR (same limitation already accepted elsewhere in
// this app for usePathname/useSearchParams) -- there is no prop seam to
// force the docked/collapsed branches into the rendered markup. Coverage
// here is therefore: (a) the default (non-docked) render never grows any
// collapse/Clear/Review footprint at all, and (b) source-contract checks
// proving the docked/collapsed JSX reuses the exact same onClearBox/
// isBoxReady/handleOpenReview identifiers as the pre-existing controls,
// never a second implementation, and never mounts BoxSlotTray or any
// per-vial callback (the one domain-mutating action collapsed keeps is the
// same shared Vaciar caja, by design -- see the collapsed-surface test
// below). The actual interactive collapse<->expand behavior is verified by
// browser acceptance.
describe("BuilderPanel docked-summary collapse/expand", () => {
  const stickySummarySource = normalizedPanelSource.slice(
    normalizedPanelSource.indexOf("const stickySummaryContent"),
    normalizedPanelSource.indexOf('<aside className="builder-panel"')
  );
  const collapsedBranchSource = stickySummarySource.slice(
    stickySummarySource.indexOf("isDockedAndCollapsed ? ("),
    stickySummarySource.indexOf("        </div>\n      ) : (")
  );
  const expandedBranchSource = stickySummarySource.slice(
    stickySummarySource.indexOf("        </div>\n      ) : (")
  );
  const summaryRowSource = stickySummarySource.slice(
    stickySummarySource.indexOf('<div className="builder-panel-summary-row">'),
    stickySummarySource.indexOf("<BoxSlotTray")
  );
  const panelHeaderSource = expandedBranchSource.slice(
    expandedBranchSource.indexOf('<div className="panel-header">'),
    expandedBranchSource.indexOf("{shouldShowDiscoveryIntro")
  );
  const boxSummaryCardSource = summaryRowSource.slice(
    summaryRowSource.indexOf('<div className="box-summary-card"')
  );

  it("never renders the collapse toggle or docked-collapsed surface when not docked", () => {
    const markup = renderBuilderPanel();
    expect(markup).not.toContain("summary-collapse-toggle");
    expect(markup).not.toContain("builder-panel-docked-collapsed");
  });

  it("gives every Review action -- the header, the collapsed surface, and the panel's own review-action button -- the exact same eligibility gate and handler, never a second implementation", () => {
    // Three call sites, one shared prop pair: the compact header Revisar,
    // the collapsed control surface's Revisar, and the original full-width
    // review-action button below the panel. No local recomputation of
    // readiness anywhere in this file.
    const reviewActionPairs = builderPanelSource.match(/disabled=\{!isBoxReady\}[\s\S]{0,80}onClick=\{handleOpenReview\}/g) || [];
    expect(reviewActionPairs).toHaveLength(3);
    expect(builderPanelSource).not.toMatch(/const isBoxReady\s*=/);
  });

  it("keeps Revisar out of the stats strip -- it lives in the header/collapsed control rows only, never as a fourth .box-summary-metric", () => {
    expect(summaryRowSource).not.toContain("review-box-button");
    expect(summaryRowSource.match(/className="box-summary-metric/g) || []).toHaveLength(3);
  });

  it("places the collapse toggle as the stats strip's own first segment, gated to the expanded+docked state only, and never in the header anymore", () => {
    expect(boxSummaryCardSource).toMatch(
      /\{isSummaryDocked && \([\s\S]{0,700}summary-collapse-toggle summary-collapse-toggle--strip/
    );
    expect(panelHeaderSource).not.toContain("summary-collapse-toggle");
    expect(appCss).not.toMatch(/\.summary-collapse-toggle--docked/);
  });

  it("sizes the strip arrow's own lane to shrink the three metrics' combined flex:1 share by roughly 15%, without any separate width/padding override on the metrics themselves", () => {
    // The three .box-summary-metric children stay flex:1 (unmodified,
    // canonical) in both states -- inserting a fixed-width sibling ahead
    // of them is what naturally shrinks their combined share of the row,
    // with no docked-only override needed on the metrics. Measured live
    // (packages/builder styles.css): docked baseline without the arrow is
    // ~314px across the three metrics; chevron(26px) + this margin(22px)
    // = 48px, a ~15% reduction, confirmed via getBoundingClientRect
    // against the real rendered strip.
    const chevronWidthMatch = appCss.match(/:where\(\.builder-scope\) \.summary-collapse-toggle \{[^}]*width:\s*(\d+)px;/);
    const marginMatch = appCss.match(/:where\(\.builder-scope\) \.summary-collapse-toggle--strip \{[^}]*margin-right:\s*(\d+)px;/);
    const chevronWidth = Number(chevronWidthMatch[1]);
    const marginRight = Number(marginMatch[1]);
    expect(chevronWidth + marginRight).toBe(48);
  });

  it("gives the expanded panel-header's Vaciar caja and Revisar the exact same gate/handler as every other Clear/Review control", () => {
    expect(panelHeaderSource).toMatch(/\{totalSlots > 0 && \([\s\S]{0,150}onClick=\{onClearBox\}/);
    expect(panelHeaderSource).toMatch(/disabled=\{!isBoxReady\}[\s\S]{0,80}onClick=\{handleOpenReview\}/);
  });

  it("preserves Expand, Vaciar caja, and Revisar in the collapsed control surface, but keeps BoxSlotTray and every per-vial callback unmounted", () => {
    // Checks for the JSX tag itself, not the bare word -- this file's own
    // explanatory comments legitimately mention "BoxSlotTray" in prose.
    expect(collapsedBranchSource).not.toContain("<BoxSlotTray");
    expect(collapsedBranchSource).not.toContain("box-summary-card");
    expect(collapsedBranchSource).not.toContain("onRemovePerfume");
    expect(collapsedBranchSource).not.toContain("onReorderPerfumes");
    expect(collapsedBranchSource).not.toContain("onAddPerfume");

    expect(collapsedBranchSource).toMatch(/t\("builder\.expandSummary"\)/);
    // Vaciar caja and Revisar reuse the exact same gate/handler as the
    // expanded header -- collapsing never introduces a second Clear or
    // Review implementation, and never touches box contents or Review
    // eligibility on its own.
    expect(collapsedBranchSource).toMatch(/\{totalSlots > 0 && \([\s\S]{0,150}onClick=\{onClearBox\}/);
    expect(collapsedBranchSource).toMatch(/disabled=\{!isBoxReady\}[\s\S]{0,80}onClick=\{handleOpenReview\}/);
  });

  it("keeps Expand as the collapsed row's own left-anchored child, with Vaciar caja and Revisar grouped together in their own right-aligned action group", () => {
    // Two flex children only at the outer row: the Expand chevron, then
    // the whole action group -- this is what lets a plain
    // justify-content:space-between (no hard-coded positioning) anchor
    // Expand left and the paired Clear+Review group flush right, with
    // Revisar terminating near the same right edge the expanded 360px
    // panel uses, and no leftover space past it.
    const expandIndex = collapsedBranchSource.indexOf('className="summary-collapse-toggle"');
    const actionsGroupIndex = collapsedBranchSource.indexOf('className="builder-panel-docked-collapsed-actions"');
    expect(expandIndex).toBeGreaterThan(-1);
    expect(actionsGroupIndex).toBeGreaterThan(expandIndex);

    const actionsGroupSource = collapsedBranchSource.slice(actionsGroupIndex);
    expect(actionsGroupSource).toMatch(/\{totalSlots > 0 && \([\s\S]{0,150}onClick=\{onClearBox\}/);
    expect(actionsGroupSource).toMatch(/disabled=\{!isBoxReady\}[\s\S]{0,80}onClick=\{handleOpenReview\}/);

    expect(appCss).toMatch(
      /:where\(\.builder-scope\) \.builder-panel-docked-collapsed \{[^}]*justify-content:\s*space-between;/
    );
    expect(appCss).toMatch(/:where\(\.builder-scope\) \.builder-panel-docked-collapsed-actions \{[^}]*display:\s*flex;/);
  });

  it("gives the collapse and expand controls distinct, localized accessible names, and never persists the preference", () => {
    expect(builderPanelSource).toContain('t("builder.collapseSummary")');
    expect(builderPanelSource).toContain('t("builder.expandSummary")');
    expect(esMX["builder.collapseSummary"]).toBeTruthy();
    expect(esMX["builder.expandSummary"]).toBeTruthy();
    expect(esMX["builder.collapseSummary"]).not.toBe(esMX["builder.expandSummary"]);
    expect(esMX["builder.reviewCompact"]).toBeTruthy();

    const stateDeclarationIndex = normalizedPanelSource.indexOf("const [isSummaryCollapsed");
    const nearbySource = normalizedPanelSource.slice(stateDeclarationIndex, stateDeclarationIndex + 500);
    expect(nearbySource).not.toMatch(/localStorage|sessionStorage/);
  });

  it("respects prefers-reduced-motion for the collapse toggle's transition", () => {
    expect(appCss).toMatch(
      /@media \(prefers-reduced-motion: no-preference\) \{[\s\S]*?:where\(\.builder-scope\) \.summary-collapse-toggle \{[^}]*transition:/
    );
    expect(appCss).not.toMatch(/^:where\(\.builder-scope\) \.summary-collapse-toggle \{[^}]*transition:/m);
    // The docked card itself no longer has its own transition -- expanded
    // docked carries no max-height at all, so there is nothing to animate.
    expect(appCss).not.toMatch(/\.builder-panel-sticky-summary-card\.is-docked \{[^}]*transition:/);
  });

  it("gives expanded-docked no height ceiling of its own, and collapsed a small ceiling sized only for its own compact surface", () => {
    // Expanded docked reuses the canonical panel composition verbatim, so
    // it carries no width/height/padding/font-size overrides at all --
    // no max-height to clip against. Collapsed has no canonical
    // equivalent to match, so it keeps its own small measured cap.
    const dockedRuleMatch = appCss.match(/:where\(\.builder-scope\) \.builder-panel-sticky-summary-card\.is-docked \{[^}]*\}/);
    expect(dockedRuleMatch[0]).not.toMatch(/max-height:/);
    expect(dockedRuleMatch[0]).not.toMatch(/width:|padding-left:|padding-right:|font-size:/);
    expect(appCss).toMatch(/:where\(\.builder-scope\) \.builder-panel-sticky-summary-card\.is-docked\.is-collapsed \{[^}]*max-height:/);
  });
});

// Regression guard for the dead "i" info-button next to Mi caja: real-
// browser acceptance found clicking it provided no useful behavior once a
// box has items (isDiscoveryIntroOpen could never surface the coachmark
// again, since shouldShowDiscoveryIntro also always requires an empty
// box) -- removed entirely rather than left as a decorative no-op control.
// The coachmark itself is untouched: first-time visitors with an empty box
// still see it automatically, driven purely by hasSeenDiscoveryIntro.
describe("Dead Mi caja info-control removal", () => {
  it("never renders the info icon, and drops every bit of state/copy that existed only for it", () => {
    // Checks the exact className value, not a bare substring -- the
    // still-legitimate, unrelated .share-info-button (Collection Card
    // tooltip) would otherwise false-positive this check.
    expect(builderPanelSource).not.toMatch(/className="info-button"/);
    expect(builderPanelSource).not.toContain("isDiscoveryIntroOpen");
    expect(builderPanelSource).not.toContain("introButtonAriaLabel");
    expect(appCss).not.toMatch(/\.info-button/);
    expect(esMX["builder.introButtonAria"]).toBeUndefined();
  });

  it("keeps the first-time coachmark working, driven purely by hasSeenDiscoveryIntro", () => {
    const shouldShowIndex = normalizedPanelSource.indexOf("const shouldShowDiscoveryIntro");
    const nearbySource = normalizedPanelSource.slice(shouldShowIndex, shouldShowIndex + 300);
    expect(nearbySource).toContain("hasSeenDiscoveryIntro");
    expect(nearbySource).not.toContain("isDiscoveryIntroOpen");
  });
});

// Regression coverage for the "always docked on desktop from first render"
// simplification: the box no longer moves from sidebar to header partway
// through a scroll -- on desktop it starts in the header slot, full stop.
// That eliminates the entire reason the old scroll/rAF/sentinel machinery
// existed (see git history for buildComposerBoxProposal-era
// computeSummaryDockState.js, now deleted along with its test -- its whole
// job was answering "has the user scrolled past the boundary yet", a
// question that no longer has anything to compute). The only transition
// that can still happen at all is a live window resize crossing the
// desktop/mobile boundary, which is what's left to guard here. These tests
// can't drive a real resize/matchMedia-change event under
// renderToStaticMarkup (no DOM, no compositor -- same limitation as the
// collapse/expand describe block above), so initial-mount correctness and
// the absence of the old machinery are source contracts; the live
// resize-triggered transition is verified by browser acceptance.
describe("Docked-on-desktop-from-mount (post-scroll-docking simplification)", () => {
  const dockingEffectSource = normalizedPanelSource.slice(
    normalizedPanelSource.indexOf('useEffect(() => {\n      if (!stickySummaryPortalTarget'),
    normalizedPanelSource.indexOf("useLayoutEffect(() => {\n      const fingerprint = pendingSummaryFocusRef")
  );
  const initialDockStateSource = normalizedPanelSource.slice(
    normalizedPanelSource.indexOf("function isDesktopSummaryViewport"),
    normalizedPanelSource.indexOf("const [isSummaryCollapsed")
  );

  it("determines the initial docked state synchronously from the viewport alone, with no scroll position involved", () => {
    expect(initialDockStateSource).toContain(
      "useState(\n      () => Boolean(stickySummaryPortalTarget) && isDesktopSummaryViewport()"
    );
    expect(initialDockStateSource).not.toMatch(/sentinelTop|getBoundingClientRect/);
  });

  it("removes every trace of the old scroll/rAF docking loop -- sentinel ref, spacer height, computeSummaryDockState, and the scroll/resize listeners", () => {
    expect(builderPanelSource).not.toMatch(/summarySentinelRef|summarySpacerHeight|isSummaryDockedRef|computeSummaryDockState/);
    expect(builderPanelSource).not.toMatch(/addEventListener\("scroll"/);
    // Scoped to the docking effect itself, not the whole file -- an
    // unrelated requestAnimationFrame loop exists elsewhere (share-image
    // generation) and legitimately has nothing to do with docking.
    expect(dockingEffectSource).not.toMatch(/requestAnimationFrame|cancelAnimationFrame/);
    expect(builderPanelSource).not.toMatch(/\.builder-panel-summary-sentinel/);
    expect(appCss).not.toMatch(/\.builder-panel-summary-sentinel/);
  });

  it("still reacts to a live desktop/mobile viewport crossing via matchMedia's own change event -- the one transition that still exists", () => {
    expect(dockingEffectSource).toContain('window.matchMedia("(min-width: 981px)")');
    expect(dockingEffectSource).toContain('desktopQuery.addEventListener("change", handleViewportChange)');
    expect(dockingEffectSource).toContain("setIsSummaryDocked(desktopQuery.matches)");
    const cleanupSource = dockingEffectSource.slice(dockingEffectSource.indexOf("return () =>"));
    expect(cleanupSource).toContain('desktopQuery.removeEventListener("change", handleViewportChange)');
  });

  it("still captures a focus fingerprint before that transition, so a viewport-crossing resize can't silently drop focus", () => {
    expect(dockingEffectSource).toContain("getFocusFingerprint(");
    expect(normalizedPanelSource).toContain("focusElementFromFingerprint(summaryCardRef.current, fingerprint)");
  });
});

// Regression coverage for the docked-summary/panel-overlap fix: because the
// docked card portals into the host header's absolutely-positioned slot, it
// never contributes to that header's own layout height, so nothing in
// .builder-panel's normal flow naturally accounts for it. Expanded needs
// extra clearance; collapsed must not carry that same clearance forward or
// it just trades an overlap bug for a dead-space bug.
// Replaces a prior fixed-padding clearance (.builder-panel--docked-expanded,
// a one-time-measured 186px hardcode that drifted stale as soon as the
// summary card's real height changed) with a fully dynamic mechanism: the
// card's own real rendered height is measured live and exposed as a plain
// CSS custom property, and the host derives how much clearance its own
// layout actually needs from that -- see --builder-docked-summary-height
// below and --builder-docked-summary-overflow in aurelian's globals.css.
describe("Docked-summary panel clearance (dynamic, measured)", () => {
  it("holds no leftover fixed-padding clearance class or rule", () => {
    expect(normalizedPanelSource).not.toMatch(/builder-panel--docked-expanded/);
    expect(appCss).not.toMatch(/builder-panel--docked-expanded/);
  });

  it("renders .builder-panel with a plain, unconditional class name", () => {
    expect(normalizedPanelSource).toContain('<aside className="builder-panel" ref={ref}>');
  });

  it("measures the docked summary card's own real height via ResizeObserver only while docked, resetting to 0px whenever nothing is being measured", () => {
    const effectStart = normalizedPanelSource.indexOf(
      "const element = isSummaryDocked ? summaryCardRef.current : null;"
    );
    const effectEndMarker = "}, [isSummaryDocked, isSummaryCollapsed]);";
    const effectEnd = normalizedPanelSource.indexOf(effectEndMarker, effectStart);
    const effectSource = normalizedPanelSource.slice(effectStart, effectEnd + effectEndMarker.length);
    expect(effectSource).toContain('document.documentElement.style.setProperty("--builder-docked-summary-height", "0px");');
    expect(effectSource).toContain("new ResizeObserver(recomputeHeight)");
    expect(effectSource).toContain("element.getBoundingClientRect().height");
    expect(effectSource).toContain("observer.disconnect()");
  });

  it("re-runs on the collapse/expand transition itself, not only on the initial dock, so the synchronous recompute on setup catches a real state change even if a later resize event never fires", () => {
    expect(normalizedPanelSource).toContain("}, [isSummaryDocked, isSummaryCollapsed]);");
  });

  it("derives the actual clearance from the measured height, not a guessed constant, in the host stylesheet that owns its own header geometry", () => {
    expect(aurelianGlobalsCss).toMatch(
      /--builder-docked-summary-overflow:max\(0px, calc\(var\(--builder-docked-summary-height, 0px\) - var\(--builder-panel-header-offset\)\)\);/
    );
  });

  it("applies the derived overflow as an additive push on the same shared row the intro-header offset already pulls up, so both compose without a second wrapper", () => {
    expect(appCss).toContain(
      "margin-top: calc(var(--builder-docked-summary-overflow, 0px) - var(--builder-intro-header-offset, 0px));"
    );
  });
});

// Regression guard for a distinct overlap: the collapsed-rail's sticky
// threshold is a separate CSS declaration from the expanded row's
// margin-top above -- both need to grow with the docked summary's real
// overflow, or an expanded Mi caja can still cover whichever one was
// missed. Asserted as a relationship to the same generic token (not a
// snapshot of any particular measured height), so this stays valid
// regardless of how tall a real card ever renders.
describe("Collapsed-rail sticky threshold clears an expanded docked summary", () => {
  const collapsedRailRuleMatch = appCss.match(
    /:where\(\.builder-scope\) \.layout--panel-collapsible\.layout--panel-collapsed \.builder-panel-collapsible-row \{[^}]*\}/
  );

  it("finds exactly one collapsed-row sticky-position rule to check", () => {
    expect(collapsedRailRuleMatch).not.toBeNull();
  });

  it("adds --builder-docked-summary-overflow on top of the static header-offset baseline, not in place of it", () => {
    const rule = collapsedRailRuleMatch[0];
    expect(rule).toContain("position: sticky;");
    expect(rule).toContain(
      "top: calc(var(--builder-panel-header-offset, 12px) + var(--builder-docked-summary-overflow, 0px));"
    );
  });

  it("never hardcodes a measured pixel value for this threshold", () => {
    const rule = collapsedRailRuleMatch[0];
    expect(rule).not.toMatch(/top:\s*\d/);
  });

  it("leaves the approved collapsed handle height and chevron centering untouched", () => {
    expect(appCss).toContain("height: 84px;");
    const railRuleMatch = appCss.match(
      /:where\(\.builder-scope\) \.builder-panel-collapse-rail \{[^}]*flex: 0 0 20px;[^}]*\}/
    );
    expect(railRuleMatch).not.toBeNull();
    expect(railRuleMatch[0]).toContain("display: grid;");
    expect(railRuleMatch[0]).toContain("place-items: center;");
  });
});

// Cross-file lockstep coverage: aurelian's globals.css and the shared
// package's styles.css each own half of the docked slot's width and have
// no build-time link to each other. The docked-summary simplification
// made the invariant simpler than it used to be -- the slot no longer
// needs to match a docked-only tray-scale width, it just needs to match
// the same 360px column the panel already renders at in its non-docked
// state (.layout's own grid-template-columns), since the docked summary
// now reuses that exact composition unmodified.
describe("Docked slot width lockstep", () => {
  const slotWidthMatch = aurelianGlobalsCss.match(/\.site-header__builder-slot\s*\{[^}]*width:\s*(\d+)px;/);
  const navMarginMatch = aurelianGlobalsCss.match(/\.desktop-nav\s*\{\s*margin-right:\s*(\d+)px;\s*\}/);
  // Scoped to the 981px two-column breakpoint specifically (via its
  // distinguishing 16px gap, not shared by the smaller-viewport base rule's
  // own 400px/20px-gap layout) -- that's the same breakpoint the docked
  // header slot only ever applies at.
  const layoutColumnsMatch = appCss.match(
    /:where\(\.builder-scope\) \.layout \{\s*grid-template-columns:\s*minmax\(0, 1fr\) (\d+)px;\s*gap:\s*16px;/
  );

  it("keeps the Aurelian header slot the same width as the panel's own right column", () => {
    const slotWidth = Number(slotWidthMatch[1]);
    const panelColumnWidth = Number(layoutColumnsMatch[1]);
    expect(slotWidth).toBe(panelColumnWidth);
  });

  it("reserves the nav's margin-right as exactly the slot width plus a fixed 16px breathing gap", () => {
    const slotWidth = Number(slotWidthMatch[1]);
    const navMargin = Number(navMarginMatch[1]);
    expect(navMargin - slotWidth).toBe(16);
  });
});

// Regression guard for the docked-summary simplification itself: a prior
// round gave the docked state a dedicated, narrower geometry (tray-scale
// width, vial/cap/body/label sizing, a flex-basis'd stats strip, an
// absolutely-positioned collapse chevron, a compact Review button) to make
// room for an in-strip Review action. That action has since been removed
// entirely, and with it the pressure that geometry existed for -- the
// docked summary now reuses the exact same non-docked composition
// unmodified. These assertions confirm none of that old geometry has been
// reintroduced.
describe("No docked-only geometry overrides remain", () => {
  it("keeps the docked/collapsed selectors free of tray, vial, and strip-sizing overrides", () => {
    expect(appCss).not.toMatch(/\.is-docked \.builder-panel-tray-scale/);
    expect(appCss).not.toMatch(/\.is-docked \.box-slot-tray/);
    expect(appCss).not.toMatch(/\.is-docked \.box-column/);
    expect(appCss).not.toMatch(/\.is-docked \.box-vial/);
    expect(appCss).not.toMatch(/\.is-docked \.vial-cap/);
    expect(appCss).not.toMatch(/\.is-docked \.vial-body/);
    expect(appCss).not.toMatch(/\.is-docked \.vial-label/);
    expect(appCss).not.toMatch(/\.is-docked \.bonus-slot-icon/);
    expect(appCss).not.toMatch(/\.is-docked \.empty-slot-add/);
    expect(appCss).not.toMatch(/\.is-docked \.builder-panel-summary-row \.box-summary-card/);
    expect(appCss).not.toMatch(/\.is-docked \.builder-panel-summary-row \.box-summary-metric/);
  });

  it("keeps .box-summary-action retired -- Review never becomes a fourth .box-summary-metric inside the strip", () => {
    // review-box-button--compact and builder.reviewCompact are back, but
    // as the header/collapsed-row Revisar buttons this round adds
    // deliberately (see "BuilderPanel docked-summary collapse/expand"),
    // never as an in-strip segment sitting alongside the three stats.
    expect(appCss).not.toMatch(/\.box-summary-action\b/);
  });

  it("removes the collapse chevron's old absolutely-positioned docked gutter", () => {
    expect(appCss).not.toMatch(/\.summary-collapse-toggle--docked/);
  });
});

describe("Fractional-tier perfume card action row", () => {
  it("lets the Add-to-box column shrink instead of enforcing a hard floor that could force it wider than the card", () => {
    expect(appCss).toMatch(/:where\(\.builder-scope\) \.perfume-card-compact-actions \{[^}]*grid-template-columns:\s*auto minmax\(0, 1fr\);/);
    expect(appCss).not.toMatch(/grid-template-columns:\s*auto minmax\(130px/);
    expect(appCss).not.toMatch(/grid-template-columns:\s*auto minmax\(64px/);
  });

  it("keeps the points badge at its full natural width at both breakpoints, so fractional labels are never clipped", () => {
    const baseRuleMatch = appCss.match(/:where\(\.builder-scope\) \.perfume-card-points \{[^}]*\}/);
    expect(baseRuleMatch[0]).toMatch(/min-width:\s*max-content;/);

    const mobileBlock = appCss.slice(appCss.indexOf("@media (max-width: 520px)"));
    const mobileRuleMatch = mobileBlock.match(/:where\(\.builder-scope\) \.perfume-card-points \{[^}]*\}/);
    expect(mobileRuleMatch[0]).toMatch(/min-width:\s*max-content;/);
  });

  it("fixes the layout generically, without special-casing any individual tier", () => {
    expect(appCss).not.toMatch(/silver|platinum/i);
  });
});

// ComposePreferenceGroup is never exported (same source-contract precedent
// as the docking/collapse boundaries above) -- isComposerSetupOpen is
// internal state with no prop seam to force the modal open under
// renderToStaticMarkup, so real rendering isn't available here either.
describe("Composer season pills: canonical order, icons, semantic color", () => {
  it("imports the canonical season order from the existing season radar mechanism, rather than defining a second one", () => {
    expect(normalizedPanelSource).toMatch(
      /import\s*\{\s*\n?\s*buildSeasonProfileViewModel,\s*\n?\s*SEASON_AXIS_ORDER,?\s*\n?\s*\}\s*from\s*"..\/builder\/presentation\/seasonProfileViewModel\.js";/
    );
    expect(normalizedPanelSource).not.toMatch(/const SEASON_AXIS_ORDER\s*=/);
  });

  it("sorts only the seasons field by that canonical order, leaving occasions/vibes on the alphabetical options array unchanged", () => {
    const sortStart = normalizedPanelSource.indexOf('field === "seasons"\n      ? [...rawOptions].sort');
    expect(sortStart).toBeGreaterThan(-1);
    const sortSnippet = normalizedPanelSource.slice(sortStart, sortStart + 200);
    expect(sortSnippet).toContain("SEASON_AXIS_ORDER.indexOf(a) - SEASON_AXIS_ORDER.indexOf(b)");
    expect(sortSnippet).toContain(": rawOptions;");
  });

  it("renders a season's icon only for the seasons field, via the same metadataAssets + assetResolver mechanism MetadataSummaryChip already uses elsewhere -- never a new asset system", () => {
    const groupStart = normalizedPanelSource.indexOf("function ComposePreferenceGroup(");
    const groupEnd = normalizedPanelSource.indexOf("function ComposerProposalModal(");
    const groupSource = normalizedPanelSource.slice(groupStart, groupEnd);

    expect(groupSource).toContain('const isSeason = field === "seasons";');
    expect(groupSource).toContain("metadataAssets.seasons?.[option]");
    expect(groupSource).toContain("assetResolver(iconAssetKey)");
    expect(groupSource).toContain('<img src={iconSrc} alt="" aria-hidden="true" />');
    expect(groupSource).toContain('data-season-id={isSeason ? option : undefined}');
  });

  it("only the seasons ComposePreferenceGroup call is given assetResolver -- occasions and vibes stay icon-less and untouched", () => {
    const seasonsCallStart = normalizedPanelSource.indexOf('field="seasons"');
    const occasionsCallStart = normalizedPanelSource.indexOf('field="occasions"');
    const vibesCallStart = normalizedPanelSource.indexOf('field="vibes"');
    const seasonsCall = normalizedPanelSource.slice(seasonsCallStart - 200, seasonsCallStart + 300);
    const occasionsCall = normalizedPanelSource.slice(occasionsCallStart - 200, occasionsCallStart + 300);
    const vibesCall = normalizedPanelSource.slice(vibesCallStart - 200, vibesCallStart + 300);

    expect(seasonsCall).toContain("assetResolver={assetResolver}");
    expect(occasionsCall).not.toContain("assetResolver={assetResolver}");
    expect(vibesCall).not.toContain("assetResolver={assetResolver}");
  });

  it("threads assetResolver from BuilderPanel's own prop through ComposerSetupModal, not a new host dependency", () => {
    expect(normalizedPanelSource).toContain("<ComposerSetupModal");
    const modalCallStart = normalizedPanelSource.indexOf("<ComposerSetupModal");
    const modalCallSource = normalizedPanelSource.slice(modalCallStart, modalCallStart + 400);
    expect(modalCallSource).toContain("assetResolver={assetResolver}");
  });

  it("defines exactly one semantic color per season, keyed by data-season-id, matching the palette brief (green/gold/pumpkin/ice)", () => {
    const seasonColors = { spring: "#86efac", summer: "#facc15", fall: "#ea580c", winter: "#93c5fd" };
    for (const [season, hex] of Object.entries(seasonColors)) {
      const unselectedMatch = appCss.match(
        new RegExp(`:where\\(\\.builder-scope\\) \\.compose-preference-chip--season\\[data-season-id="${season}"\\] \\{[^}]*${hex}[^}]*\\}`)
      );
      expect(unselectedMatch, `${season} unselected rule`).not.toBeNull();
    }
  });

  it("gives the selected state higher specificity than the pre-existing Aurelian accent-gold override, so a selected season pill keeps its own color instead of reverting to generic gold", () => {
    const auralianOverrideIndex = appCss.indexOf(
      ":where(.builder-scope).builder-theme-root--custom .compose-preference-chips button.is-selected"
    );
    expect(auralianOverrideIndex).toBeGreaterThan(-1);

    for (const season of ["spring", "summer", "fall", "winter"]) {
      expect(appCss).toContain(
        `:where(.builder-scope) .compose-preference-chips button.compose-preference-chip--season[data-season-id="${season}"].is-selected`
      );
    }
  });

  it("never colors occasion or vibe chips by category -- the season selector family is the only per-option color mechanism in this modal", () => {
    expect(appCss).not.toMatch(/compose-preference-chip--occasion/);
    expect(appCss).not.toMatch(/compose-preference-chip--vibe/);
    expect(appCss).not.toMatch(/data-occasion-id/);
    expect(appCss).not.toMatch(/data-vibe-id/);
  });

  it("never keys season styling to a translated label string -- selectors and lookups use the canonical option ID only", () => {
    expect(appCss).not.toMatch(/Primavera|Verano|Otoño|Invierno/);
    const groupStart = normalizedPanelSource.indexOf("function ComposePreferenceGroup(");
    const groupEnd = normalizedPanelSource.indexOf("function ComposerProposalModal(");
    expect(normalizedPanelSource.slice(groupStart, groupEnd)).not.toMatch(/Primavera|Verano|Otoño|Invierno/);
  });
});

// Regression for a real chevron-semantics bug: the docked summary's two
// .summary-collapse-toggle buttons had their glyphs backwards (collapsed
// showed a right-pointing triangle, expanded showed down), so the icon
// never actually pointed toward what the click would do. Direction is now
// tied directly to the action: collapsed -> down (expand reveals content
// below/toward the pointer), expanded -> up (collapse folds it away). Both
// reuse the same small-triangle glyph family already used elsewhere in this
// file (▸/▾), just the vertical members of it -- no icon library added.
// aria-label/aria-expanded semantics and click handlers are untouched by
// this fix, so they're intentionally not re-asserted here (already covered
// by the "BuilderPanel docked-summary collapse/expand" describe block
// above); this block covers only the glyph-direction regression itself.
describe("Docked summary collapse toggle: chevron points toward its own action", () => {
  it("points down on the collapsed (Expand) control and up on the expanded (Collapse) control -- never a left/right chevron", () => {
    const collapsedToggleLabelIndex = normalizedPanelSource.indexOf('aria-label={t("builder.expandSummary")}');
    const collapsedToggleSource = normalizedPanelSource.slice(collapsedToggleLabelIndex, collapsedToggleLabelIndex + 800);
    expect(collapsedToggleSource).toContain('<span aria-hidden="true">▾</span>');

    const expandedToggleLabelIndex = normalizedPanelSource.indexOf('aria-label={t("builder.collapseSummary")}');
    const expandedToggleSource = normalizedPanelSource.slice(expandedToggleLabelIndex, expandedToggleLabelIndex + 800);
    expect(expandedToggleSource).toContain('<span aria-hidden="true">▴</span>');

    expect(normalizedPanelSource).not.toMatch(/summary-collapse-toggle[\s\S]{0,400}<span aria-hidden="true">[◂▸◀▶‹›]<\/span>/);
  });

  it("leaves the separate right-panel collapse rail on its own legitimate horizontal glyphs, unchanged", () => {
    const runtimeSource = readFileSync(new URL("../BuilderRuntime.jsx", import.meta.url), "utf8");
    expect(runtimeSource).toContain('className="builder-panel-collapse-rail"');
    expect(runtimeSource).toContain('{isPanelCollapsed ? "◂" : "▸"}');
  });
});

// Regression for the empty "+" vial slot's recommendation shortcut going
// dead. The mechanism itself (onNextSlotRecommendation, wired all the way
// through to handleNextSlotRecommendation's scroll+focus of the existing
// "To Balance Your Box" recommendation lane below) was never removed -- see
// balanceLaneRef and handleNextSlotRecommendation above, both untouched by
// this fix. What broke it: BoxVialSlot's own
// `isNextAvailable && !isCompact` gate, which silently disabled the
// click/keyboard handlers whenever the tray rendered in its compact form.
// That compact form used to be a transient scroll-triggered state, but a
// later change made docking (and therefore isCompact) permanent on desktop
// -- so the interactive affordance was permanently off on desktop even
// though the vial's "next available" glow still rendered, promising an
// action it no longer performed. The fix removes the `!isCompact` half of
// that condition; nothing else about isCompact's other, legitimate uses
// (disabling drag-reorder in the compact strip) changed.
describe("Restored empty next-available vial slot recommendation action", () => {
  const boxVialSlotSource = normalizedPanelSource.slice(
    normalizedPanelSource.indexOf("function BoxVialSlot("),
    normalizedPanelSource.indexOf("function getShortPerfumeName(")
  );

  it("renders the next-available empty slot as a real, keyboard-reachable button with the existing localized recommendation label -- not a passive div", () => {
    const markup = renderBuilderPanel({ selectedPerfumes: [] });
    const vialMatch = markup.match(/<(button|div)[^>]*data-slot-index="0"[^>]*>/);

    expect(vialMatch).not.toBeNull();
    expect(vialMatch[1]).toBe("button");
    expect(vialMatch[0]).toContain("next-available");
    expect(vialMatch[0]).toContain('type="button"');
    expect(vialMatch[0]).toContain('aria-label="View recommendations for the next box slot"');
  });

  it("no longer gates the next-available action on isCompact -- the same interactive mechanism now applies whether the tray is docked/compact or full-size", () => {
    expect(boxVialSlotSource).toContain("const isInteractiveNextAvailable = isNextAvailable;");
    expect(boxVialSlotSource).not.toMatch(/isInteractiveNextAvailable\s*=\s*isNextAvailable\s*&&\s*!isCompact/);
  });

  it("keeps isCompact governing only the drag/reorder machinery it always governed, not this action", () => {
    expect(boxVialSlotSource).toContain("onDragOver={isCompact ? undefined : onDragOver}");
    expect(boxVialSlotSource).toContain("onDrop={isCompact ? undefined : (event) => onDrop(event, index)}");
  });

  it("triggers the exact same onNextSlotRecommendation callback on Enter/Space as on click -- no second recommendation implementation", () => {
    expect(boxVialSlotSource).toContain(
      'if (!isInteractiveNextAvailable || (event.key !== "Enter" && event.key !== " ")) {'
    );
    expect(boxVialSlotSource).toContain("onNextSlotRecommendation?.();");
    expect(boxVialSlotSource).toContain("onClick={isInteractiveNextAvailable ? onNextSlotRecommendation : undefined}");
  });

  it("threads the one BuilderPanel-level handler through unconditionally, and that handler still scrolls to and focuses the existing recommendation lane", () => {
    expect(normalizedPanelSource).toContain("onNextSlotRecommendation={handleNextSlotRecommendation}");
    expect((normalizedPanelSource.match(/const handleNextSlotRecommendation = /g) || [])).toHaveLength(1);

    const handlerIndex = normalizedPanelSource.indexOf("const handleNextSlotRecommendation = ");
    const handlerSource = normalizedPanelSource.slice(handlerIndex, handlerIndex + 400);
    expect(handlerSource).toContain("balanceLaneRef.current.scrollIntoView({");
    expect(handlerSource).toContain("showBalanceLaneEmphasis();");
    expect(handlerSource).toContain("focusBalanceLane");
  });

  it("adds no click/keyboard action to reserved (Curator Bonus) slots -- they never had one, and still don't", () => {
    const reservedBranchSource = boxVialSlotSource.slice(
      boxVialSlotSource.indexOf("if (isReserved) {"),
      boxVialSlotSource.indexOf("if (!perfume) {")
    );
    expect(reservedBranchSource).not.toMatch(/onClick=/);
    expect(reservedBranchSource).not.toMatch(/onKeyDown=/);
  });
});
