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
  const summaryRowSource = stickySummarySource.slice(
    stickySummarySource.indexOf('<div className="builder-panel-summary-row">'),
    stickySummarySource.indexOf("<BoxSlotTray")
  );

  it("never renders the collapse toggle or compact Review action when not docked", () => {
    const markup = renderBuilderPanel();
    expect(markup).not.toContain("summary-collapse-toggle");
    expect(markup).not.toContain("box-summary-action");
    expect(markup).not.toContain("builder-panel-docked-collapsed");
  });

  it("keeps Review as the fourth segment of the same box-summary-card strip, not a fourth .box-summary-metric", () => {
    // Regression guard for both density issues browser acceptance found in
    // turn: Review must live inside the strip (not float outside it as a
    // separate overlay cluster), but it must never be styled/counted as a
    // fourth .box-summary-metric -- that selector's equal-width treatment
    // is reserved for the three real stats.
    const metricCount = (summaryRowSource.match(/className="box-summary-metric/g) || []).length;
    expect(metricCount).toBe(3);
    expect(summaryRowSource).toContain("box-summary-action");
    expect(summaryRowSource).toContain("reviewCompact");
    // Review is gated by isSummaryDocked inside the row, and is the last
    // child of .box-summary-card before the row's tray-scale sibling opens.
    const boxSummaryCardSource = summaryRowSource.slice(
      summaryRowSource.indexOf('<div className="box-summary-card"'),
      summaryRowSource.indexOf('<div className="builder-panel-tray-scale">')
    );
    expect(boxSummaryCardSource).toMatch(/\{isSummaryDocked && \([\s\S]*box-summary-action/);
  });

  it("reuses the exact same eligibility gate and open-review handler for every Review action -- never a second implementation", () => {
    const reviewActionPairs = builderPanelSource.match(/disabled=\{!isBoxReady\}[\s\S]{0,80}onClick=\{handleOpenReview\}/g) || [];
    // The original full-width review-action button, the in-strip compact
    // action, and the collapsed control surface's Review button: three
    // call sites, one shared prop pair, no local recomputation of
    // readiness anywhere in this file.
    expect(reviewActionPairs).toHaveLength(3);
    expect(builderPanelSource).not.toMatch(/const isBoxReady\s*=/);
  });

  it("keeps the collapse toggle a separate, absolutely-positioned control that never displaces the strip's metric/action layout", () => {
    // Collapse toggle is its own isSummaryDocked-gated block, after (not
    // inside) .builder-panel-summary-row -- CSS positions it out of flow
    // (summary-collapse-toggle--docked), so it can never compete with the
    // strip's metrics/Review for space.
    const afterRowSource = stickySummarySource.slice(stickySummarySource.indexOf("<BoxSlotTray"));
    expect(afterRowSource).toMatch(/\{isSummaryDocked && \([\s\S]{0,500}summary-collapse-toggle--docked/);
    expect(appCss).toMatch(/:where\(\.builder-scope\) \.summary-collapse-toggle--docked \{[^}]*position:\s*absolute;/);
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

    const stateDeclarationIndex = normalizedPanelSource.indexOf("const [isSummaryCollapsed");
    const nearbySource = normalizedPanelSource.slice(stateDeclarationIndex, stateDeclarationIndex + 500);
    expect(nearbySource).not.toMatch(/localStorage|sessionStorage/);
  });

  it("respects prefers-reduced-motion for the docked card and collapse toggle transitions", () => {
    expect(appCss).toMatch(
      /@media \(prefers-reduced-motion: no-preference\) \{[\s\S]*?:where\(\.builder-scope\) \.summary-collapse-toggle \{[^}]*transition:/
    );
    expect(appCss).not.toMatch(/^:where\(\.builder-scope\) \.summary-collapse-toggle \{[^}]*transition:/m);
  });

  it("keeps a docked ceiling, and gives collapsed its own smaller cap instead of growing the header slot", () => {
    // 198px/60px (was 166px/52px): both ceilings were found to actually
    // clip real content -- confirmed via scrollHeight vs clientHeight on
    // the rendered card, not just tight spacing -- so both grew by the
    // measured minimum needed for zero clipping plus a small margin.
    // Collapsed stays meaningfully smaller than expanded either way.
    expect(appCss).toMatch(/:where\(\.builder-scope\) \.builder-panel-sticky-summary-card\.is-docked \{[^}]*max-height:\s*198px;/);
    expect(appCss).toMatch(/:where\(\.builder-scope\) \.builder-panel-sticky-summary-card\.is-docked\.is-collapsed \{[^}]*max-height:\s*60px;/);
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

// Regression coverage for the second real defect found in browser
// acceptance: the docked strip (Espacios | Puntos | Total | Revisar) was
// cramped at the original 360px slot width, and separately, the collapse
// chevron (26px, absolutely positioned at left:4px) needs a left gutter
// wider than plain padding would give it, or it visually overlaps the
// first metric's content -- confirmed via getBoundingClientRect() against
// real DOM before the fix (a true overlap, not just visual closeness).
// aurelian's globals.css and the shared package's styles.css each hold
// half of this width math and have no build-time link to each other, so
// these tests assert the arithmetic relationship directly rather than just
// the individual literals, to catch future drift between the two files.
describe("Docked-strip width and collapse-chevron clearance", () => {
  const dockedCardPaddingMatch = appCss.match(
    /:where\(\.builder-scope\) \.builder-panel-sticky-summary-card\.is-docked \{[^}]*\}/
  );
  const chevronDockedMatch = appCss.match(
    /:where\(\.builder-scope\) \.summary-collapse-toggle--docked \{[^}]*\}/
  );
  const trayScaleDockedMatch = appCss.match(
    /:where\(\.builder-scope\) \.builder-panel-sticky-summary-card\.is-docked \.builder-panel-tray-scale \{[^}]*\}/
  );
  const slotWidthMatch = aurelianGlobalsCss.match(/\.site-header__builder-slot\s*\{[^}]*width:\s*(\d+)px;/);
  const navMarginMatch = aurelianGlobalsCss.match(/\.desktop-nav\s*\{\s*margin-right:\s*(\d+)px;\s*\}/);

  it("keeps the Aurelian header slot and the shared docked-card content width in lockstep", () => {
    const paddingLeft = Number(dockedCardPaddingMatch[0].match(/padding-left:\s*(\d+)px;/)[1]);
    const paddingRight = Number(dockedCardPaddingMatch[0].match(/padding-right:\s*(\d+)px;/)[1]);
    const slotWidth = Number(slotWidthMatch[1]);
    const trayScaleWidth = Number(trayScaleDockedMatch[0].match(/width:\s*(\d+)px;/)[1]);

    // The card's content width (slot minus its own horizontal padding) must
    // equal the width the tray/metrics-strip is actually built for -- if
    // one file changes without the other, this is exactly the kind of
    // cramped-strip regression this whole test exists to catch.
    expect(slotWidth - paddingLeft - paddingRight).toBe(trayScaleWidth);
  });

  it("reserves the nav's margin-right as exactly the slot width plus a fixed 16px breathing gap", () => {
    const slotWidth = Number(slotWidthMatch[1]);
    const navMargin = Number(navMarginMatch[1]);
    expect(navMargin - slotWidth).toBe(16);
  });

  it("gives the docked collapse chevron a left gutter wider than the chevron itself, with real clearance on both sides", () => {
    const paddingLeft = Number(dockedCardPaddingMatch[0].match(/padding-left:\s*(\d+)px;/)[1]);
    const chevronLeft = Number(chevronDockedMatch[0].match(/left:\s*(\d+)px;/)[1]);
    const chevronWidthMatch = appCss.match(/:where\(\.builder-scope\) \.summary-collapse-toggle \{[^}]*width:\s*(\d+)px;/);
    const chevronWidth = Number(chevronWidthMatch[1]);

    // This is the exact inequality that was violated before the fix:
    // chevronLeft(8) + chevronWidth(26) = 34 > the old 22px gutter, a real
    // ~12px overlap with the first metric's content, not just tight
    // spacing. Both sides now keep a positive margin.
    expect(chevronLeft).toBeGreaterThan(0);
    expect(paddingLeft - (chevronLeft + chevronWidth)).toBeGreaterThan(0);
  });
});

// Regression coverage for the vertical defect found after the horizontal
// fixes: the docked strip's real rendered height was never actually 36px
// (its declared height) at all -- a less-specific, shared
// ".builder-panel-summary-row .box-summary-card { flex: 1; ... }" rule
// earlier in the same media block set flex-basis:0%, which overrides the
// height property entirely for a column-direction flex item. Confirmed
// live: even an inline height set via !important had zero effect on the
// rendered size. The strip's true height was purely content-driven, and
// when Review's padding grew in the horizontal-fix round, that
// content-driven height grew enough to clip against the (also
// content-blind) 166px ceiling -- real clipping, confirmed via
// scrollHeight vs clientHeight, not just tight spacing.
describe("Docked strip vertical sizing", () => {
  const boxSummaryCardDockedMatch = appCss.match(
    /:where\(\.builder-scope\) \.builder-panel-sticky-summary-card\.is-docked \.builder-panel-summary-row \.box-summary-card \{[^}]*\}/
  );

  it("fixes the strip's height with an explicit flex-basis, not just the height property alone", () => {
    // A bare height:44px here would silently repeat the exact bug this
    // guards against -- the earlier, less-specific flex:1 rule in this
    // same file sets flex-basis:0%, which wins over height for a
    // column-direction flex item regardless of what height says.
    expect(boxSummaryCardDockedMatch[0]).toMatch(/flex:\s*0 0 44px;/);
  });

  it("keeps the expanded and collapsed ceilings tall enough for their real content, not just their old (silently wrong) numbers", () => {
    const dockedCardMatch = appCss.match(
      /:where\(\.builder-scope\) \.builder-panel-sticky-summary-card\.is-docked \{[^}]*\}/
    );
    const collapsedMatch = appCss.match(
      /:where\(\.builder-scope\) \.builder-panel-sticky-summary-card\.is-docked\.is-collapsed \{[^}]*\}/
    );
    const paddingTop = Number(dockedCardMatch[0].match(/padding-top:\s*(\d+)px;/)[1]);
    const paddingBottom = Number(dockedCardMatch[0].match(/padding-bottom:\s*(\d+)px;/)[1]);
    const maxHeight = Number(dockedCardMatch[0].match(/max-height:\s*(\d+)px;/)[1]);
    const trayHeight = Number(
      appCss
        .match(/:where\(\.builder-scope\) \.builder-panel-sticky-summary-card\.is-docked \.builder-panel-tray-scale \{[^}]*\}/)[0]
        .match(/height:\s*(\d+)px;/)[1]
    );
    const rowGap = Number(
      appCss
        .match(/:where\(\.builder-scope\) \.builder-panel-sticky-summary-card\.is-docked \.builder-panel-summary-row \{[^}]*\}/)[0]
        .match(/gap:\s*(\d+)px;/)[1]
    );
    const stripHeight = Number(boxSummaryCardDockedMatch[0].match(/flex:\s*0 0 (\d+)px;/)[1]);
    // Loose (not pixel-exact) lower bound: the declared budget must at
    // least fit the real stack, with a border-top on the strip and some
    // slack for the ceiling to still count as "not zero-overflow math".
    const minimumRequired = paddingTop + trayHeight + rowGap + stripHeight + paddingBottom;
    expect(maxHeight).toBeGreaterThanOrEqual(minimumRequired);

    const collapsedMaxHeight = Number(collapsedMatch[0].match(/max-height:\s*(\d+)px;/)[1]);
    expect(collapsedMaxHeight).toBeLessThan(maxHeight);
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
