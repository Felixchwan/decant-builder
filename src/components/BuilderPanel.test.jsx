import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it } from "vitest";

import { discoveryDecantsConfig } from "../builder/config/discoveryDecantsConfig.js";
import { buildCollectionSummary } from "../builder/internal/intelligence/buildCollectionSummary.js";
import { buildComposerRecommendations } from "../builder/internal/recommendations/buildComposerRecommendations.js";
import { aurelianConfig } from "../merchants/aurelian/config.js";
import { perfumes } from "../data/perfumes.js";
import { notes } from "../data/notes.js";
import { buildScentDna } from "../utils/buildScentDna.js";
import BuilderPanel from "./BuilderPanel.jsx";

const originalWindow = globalThis.window;

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
      totalSlots={collectionSummary.counts.selected}
      maxSlots={builderConfig.box.totalPhysicalSlots}
      maxSelectableSlots={builderConfig.box.maxSelectableSlots}
      totalPoints={collectionSummary.points.total}
      estimatedValue={collectionSummary.money.total}
      selectedPerfumes={selectedPerfumes}
      catalogPerfumes={perfumes}
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
