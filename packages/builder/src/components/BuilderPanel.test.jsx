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
// collapse/compact-review footprint at all, and (b) source-contract checks
// proving the docked/collapsed JSX reuses the exact same isBoxReady/
// handleOpenReview identifiers as the pre-existing button, never a second
// implementation, and never touches domain-mutating callbacks. The actual
// interactive collapse<->expand behavior is verified by browser acceptance.
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

  it("never renders the collapse toggle or docked-collapsed surface when not docked", () => {
    const markup = renderBuilderPanel();
    expect(markup).not.toContain("summary-collapse-toggle");
    expect(markup).not.toContain("builder-panel-docked-collapsed");
  });

  it("never gives the docked summary its own Review action -- the panel's existing review-action button stays the only entry point", () => {
    // Simplification regression guard: a prior round added a compact
    // in-strip Review action to the docked summary, then removed it again
    // to restore the canonical (non-docked) panel composition. Nothing in
    // BuilderPanel.jsx may reintroduce a second Review call site.
    expect(stickySummarySource).not.toContain("box-summary-action");
    expect(stickySummarySource).not.toContain("reviewCompact");
    expect(summaryRowSource.match(/className="box-summary-metric/g) || []).toHaveLength(3);

    const reviewActionPairs = builderPanelSource.match(/disabled=\{!isBoxReady\}[\s\S]{0,80}onClick=\{handleOpenReview\}/g) || [];
    expect(reviewActionPairs).toHaveLength(1);
    expect(builderPanelSource).not.toMatch(/const isBoxReady\s*=/);
  });

  it("places the collapse toggle inside the existing panel-header row, not a separately-positioned control", () => {
    // The docked summary is meant to reuse the panel's own existing
    // header layout rather than introduce new absolute-positioning
    // geometry -- the toggle is just a third, isSummaryDocked-gated child
    // of the same flex row as the title and Clear button.
    const panelHeaderSource = expandedBranchSource.slice(
      expandedBranchSource.indexOf('<div className="panel-header">'),
      expandedBranchSource.indexOf("{shouldShowDiscoveryIntro")
    );
    expect(panelHeaderSource).toMatch(/\{isSummaryDocked && \([\s\S]{0,600}summary-collapse-toggle/);
    expect(panelHeaderSource).not.toContain("summary-collapse-toggle--docked");
    expect(appCss).not.toMatch(/\.summary-collapse-toggle--docked/);
  });

  it("unmounts BoxSlotTray and every domain-mutating callback in the collapsed branch, so collapsing cannot touch box state", () => {
    // Checks for the JSX tag itself, not the bare word -- this file's own
    // explanatory comments legitimately mention "BoxSlotTray" in prose.
    expect(collapsedBranchSource).not.toContain("<BoxSlotTray");
    expect(collapsedBranchSource).not.toContain("onRemovePerfume");
    expect(collapsedBranchSource).not.toContain("onReorderPerfumes");
    expect(collapsedBranchSource).not.toContain("onClearBox");
    expect(collapsedBranchSource).not.toContain("onAddPerfume");
  });

  it("gives the collapse and expand controls distinct, localized accessible names, and never persists the preference", () => {
    expect(builderPanelSource).toContain('t("builder.collapseSummary")');
    expect(builderPanelSource).toContain('t("builder.expandSummary")');
    expect(esMX["builder.collapseSummary"]).toBeTruthy();
    expect(esMX["builder.expandSummary"]).toBeTruthy();
    expect(esMX["builder.collapseSummary"]).not.toBe(esMX["builder.expandSummary"]);
    expect(esMX["builder.reviewCompact"]).toBeUndefined();

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
    expect(appCss).toMatch(/:where\(\.builder-scope\) \.builder-panel-sticky-summary-card\.is-docked\.is-collapsed \{[^}]*max-height:\s*42px;/);
  });
});

// Regression coverage for a real runtime defect: docking used to be driven
// by IntersectionObserver, whose callback is only required by spec to fire
// "eventually" -- batched on the browser's own schedule, not synchronously
// with scroll. That produced exactly what was reported: docking sometimes
// lagged arbitrarily behind the true scroll position, only catching up once
// some unrelated layout/paint event forced the browser to recompute. These
// tests can't drive a real scroll/rAF loop under renderToStaticMarkup (no
// DOM, no compositor -- same limitation as the collapse/expand describe
// block above), so they guard the two things that actually matter here as
// source contracts: (a) the mechanism is provably no longer
// IntersectionObserver, and (b) the pure boundary decision it now delegates
// to is exercised directly, with real numbers, in
// utils/computeSummaryDockState.test.js -- which is the part of this fix
// that a source-contract test alone could never have caught the original
// bug with.
describe("Docking boundary trigger", () => {
  const dockingEffectSource = normalizedPanelSource.slice(
    normalizedPanelSource.indexOf("useEffect(() => {\n      if (!stickySummaryPortalTarget)"),
    normalizedPanelSource.indexOf("useLayoutEffect(() => {\n      const fingerprint = pendingSummaryFocusRef")
  );

  it("no longer uses IntersectionObserver for the docking decision", () => {
    // Checks the actual construction/config syntax, not the bare words --
    // the explanatory comment above the effect legitimately discusses why
    // IntersectionObserver and rootMargin were rejected, in prose.
    expect(dockingEffectSource).not.toMatch(/new IntersectionObserver\(/);
    expect(dockingEffectSource).not.toMatch(/rootMargin:/);
  });

  it("measures the sentinel's real-time position directly and delegates the boundary decision to the pure, independently-tested computeSummaryDockState", () => {
    expect(dockingEffectSource).toContain("summarySentinelRef.current.getBoundingClientRect()");
    expect(dockingEffectSource).toContain("computeSummaryDockState({");
    expect(builderPanelSource).toMatch(
      /import\s*\{\s*computeSummaryDockState\s*\}\s*from\s*"\.\.\/utils\/computeSummaryDockState\.js";/
    );
  });

  it("re-evaluates on every scroll and resize, throttled to at most once per animation frame", () => {
    expect(dockingEffectSource).toContain('window.addEventListener("scroll", scheduleEvaluate, { passive: true });');
    expect(dockingEffectSource).toContain('window.addEventListener("resize", scheduleEvaluate);');
    expect(dockingEffectSource).toContain("window.requestAnimationFrame(evaluateDockState)");
    expect(dockingEffectSource).toContain("window.cancelAnimationFrame(rafId)");
  });

  it("establishes the correct docked state immediately when the effect runs, instead of waiting for the first scroll/resize event", () => {
    const evaluateCallIndex = dockingEffectSource.indexOf("evaluateDockState();");
    const scrollListenerIndex = dockingEffectSource.indexOf('addEventListener("scroll"');
    expect(evaluateCallIndex).toBeGreaterThan(-1);
    expect(scrollListenerIndex).toBeGreaterThan(-1);
    expect(evaluateCallIndex).toBeLessThan(scrollListenerIndex);
  });

  it("removes every listener and cancels any pending frame on cleanup, so no stale docking loop survives an unmount", () => {
    const cleanupSource = dockingEffectSource.slice(dockingEffectSource.indexOf("return () => {"));
    expect(cleanupSource).toContain('removeEventListener("scroll", scheduleEvaluate)');
    expect(cleanupSource).toContain('removeEventListener("resize", scheduleEvaluate)');
    expect(cleanupSource).toContain("desktopQuery.removeEventListener(\"change\", scheduleEvaluate)");
    expect(cleanupSource).toContain("cancelAnimationFrame(rafId)");
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

  it("removes the compact in-strip Review action and its dedicated styling entirely", () => {
    expect(appCss).not.toMatch(/\.box-summary-action/);
    expect(appCss).not.toMatch(/\.review-box-button--compact/);
    expect(esMX["builder.reviewCompact"]).toBeUndefined();
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
