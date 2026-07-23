import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { discoveryDecantsConfig } from "../builder/config/discoveryDecantsConfig.js";
import { buildCollectionSummary } from "../builder/internal/intelligence/buildCollectionSummary.js";
import { buildComposerRecommendations } from "../builder/internal/recommendations/buildComposerRecommendations.js";
import { perfumes } from "../data/perfumes.js";
import { notes } from "../data/notes.js";
import { buildScentDna } from "../utils/buildScentDna.js";
import BuilderPanel from "./BuilderPanel.jsx";

function renderBuilderPanel(overrides = {}) {
  const selectedPerfumes = overrides.selectedPerfumes || [];
  const collectionSummary = buildCollectionSummary({
    selectedPerfumes,
    catalog: perfumes,
    notes,
    config: discoveryDecantsConfig,
  });
  const recommendations = buildComposerRecommendations({
    perfumes,
    selectedPerfumes,
    notes,
    config: discoveryDecantsConfig,
  });

  return renderToStaticMarkup(
    <BuilderPanel
      builderConfig={discoveryDecantsConfig}
      totalSlots={collectionSummary.counts.selected}
      maxSlots={discoveryDecantsConfig.box.totalPhysicalSlots}
      maxSelectableSlots={discoveryDecantsConfig.box.maxSelectableSlots}
      totalPoints={collectionSummary.points.total}
      estimatedValue={collectionSummary.money.total}
      selectedPerfumes={selectedPerfumes}
      catalogPerfumes={perfumes}
      boxSummary={collectionSummary.boxSummary}
      onClearBox={() => {}}
      onRemovePerfume={() => {}}
      onReorderPerfumes={() => {}}
      minSlots={discoveryDecantsConfig.box.minSelectableSlots}
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
      onComposerSettingChange={() => {}}
      onComposerPreferenceToggle={() => {}}
      onComposerPreferenceClear={() => {}}
      onComposeMyBox={() => {}}
      onApplyComposerProposal={() => {}}
      onMoveComposerProposalAlternative={() => {}}
      onCancelComposerProposal={() => {}}
      curatorBonusPreference={discoveryDecantsConfig.curatorBonus.defaultPreference}
      onCuratorBonusPreferenceChange={() => {}}
      reviewCustomerInfo={discoveryDecantsConfig.finalization.customerDefaults}
      onReviewCustomerInfoChange={() => {}}
      {...overrides}
    />
  );
}

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
});
