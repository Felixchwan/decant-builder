import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// Every control that can open the rare-selection confirmation hands its exact DOM element to addPerfume (the
// click's currentTarget), so closing the confirmation can give focus back to precisely that control and never
// depends on document.activeElement or a browser's habit of focusing a clicked button. These tests walk the
// shared source for every add call site, so an entry point added later cannot quietly skip it. There is no DOM in
// this package's unit tests; real focus behaviour is exercised in a browser (see the focus-management notes in
// BuilderRuntime.test.jsx), and the pure decisions are in modalFocus.test.js.
const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const panelSource = read("./BuilderPanel.jsx");
const runtimeSource = read("../BuilderRuntime.jsx");
const cardSource = read("./PerfumeCard.jsx");

const OPENER_CALL = 'onAddPerfume(perfume, "manual", event?.currentTarget)';

describe("Rare-selection entry points: every add control forwards its exact opener", () => {
  it("BuilderPanel: every call to onAddPerfume forwards the clicked control, and there are exactly the four add controls", () => {
    // calls only (a parameter or a prop pass-through is not followed by an opening parenthesis)
    const calls = [...panelSource.matchAll(/onAddPerfume\(/g)];

    expect(calls).toHaveLength(4);
    expect(panelSource.split(OPENER_CALL).length - 1).toBe(4);
  });

  it("the four controls are the Composer proposal row, the Note Explorer row, the Collection DNA row and the recommendation card", () => {
    const owner = (marker) => panelSource.indexOf(marker);
    const callIndexes = [...panelSource.matchAll(/onAddPerfume\(perfume, "manual", event\?\.currentTarget\)/g)].map((match) => match.index);
    const owningFunction = (index) => {
      const before = panelSource.slice(0, index);
      return [...before.matchAll(/\n(?:export )?function ([A-Z]\w*)\(/g)].at(-1)[1];
    };

    expect(callIndexes.map(owningFunction)).toEqual([
      "ComposerProposalModal",
      "NoteExplorerResultRow",
      "CollectionDnaPanel",
      "RecommendationCard",
    ]);
    expect(owner("function ComposerProposalModal(")).toBeGreaterThan(-1);
  });

  it("each handler receives the click event: a button's onClick, or the DNA row's onAction (which is the button's onClick)", () => {
    // Composer proposal row, recommendation card: the button's own onClick
    expect(panelSource.match(/onClick=\{\(event\) => onAddPerfume\(perfume, "manual", event\?\.currentTarget\)\}/g)).toHaveLength(2);
    // Note Explorer row: the row is itself clickable (it opens details), so the button stops propagation first
    expect(panelSource).toContain('event.stopPropagation();\n          onAddPerfume(perfume, "manual", event?.currentTarget);');
    // Collection DNA row: onAction is wired straight to the row button's onClick
    expect(panelSource).toContain('onAction={(event) => onAddPerfume(perfume, "manual", event?.currentTarget)}');
    expect(panelSource).toMatch(/<button type="button" onClick=\{onAction\} disabled=\{isActionDisabled\}>/);
  });

  it("the runtime's own add controls forward it too: the catalog card, the intent-recommendation card and Product Info", () => {
    // PerfumeCard hands the click event to its caller; both card lists in the runtime turn it into the opener
    expect(cardSource).toContain("onClick={(event) => onAddToBox(perfume, event)}");
    expect(runtimeSource).toContain('onAddToBox={(perfume, event) => addPerfume(perfume, "manual", event?.currentTarget)}');
    expect(runtimeSource).toContain(
      'onAddToBox={(addedPerfume, event) => addPerfume(addedPerfume, "intent_recommendation", event?.currentTarget)}'
    );
    expect(runtimeSource).toContain('onAddToBox(perfume, "manual", event?.currentTarget);');
    // and no add in the runtime drops it: every addPerfume call from a control names the opener
    const controlCalls = [...runtimeSource.matchAll(/addPerfume\((?!perfume, source)[^)]*\)/g)].map((match) => match[0]);

    expect(controlCalls.length).toBeGreaterThanOrEqual(2);
    controlCalls.forEach((call) => expect(call).toContain("event?.currentTarget"));
  });

  it("the runtime hands BuilderPanel the one add path, and nothing else in the Builder adds a fragrance outside it", () => {
    expect(runtimeSource).toContain("onAddPerfume={addPerfume}");
    expect(runtimeSource.match(/onAddPerfume=\{/g)).toHaveLength(1);
    // applying a Composer proposal replaces the box directly and is not an add, so it opens no confirmation
    expect(runtimeSource).toContain("setSelectedPerfumes(nextSelectedPerfumes);\n    setComposerProposal(null);");
  });
});

describe("Rare-selection confirmation above the panel's dialogs: one Escape closes one layer", () => {
  it("BuilderPanel treats the confirmation as a layer above, next to fragrance details", () => {
    expect(runtimeSource).toContain("isPerfumeDetailsOpen={Boolean(detailPerfume)}");
    expect(runtimeSource).toContain("isRareSelectionOpen={Boolean(pendingPerfume)}");
    expect(panelSource).toContain("isRareSelectionOpen = false,");
    expect(panelSource).toContain("const isLayerAboveOpen = isPerfumeDetailsOpen || isRareSelectionOpen;");
  });

  it("hands that flag to the three dialogs that host an Add control, through the pattern they already use for details", () => {
    expect(panelSource.match(/isDetailOpen=\{isLayerAboveOpen\}/g)).toHaveLength(2); // Composer proposal, Note Explorer
    expect(panelSource.match(/isLayerAboveOpen=\{isLayerAboveOpen\}/g)).toHaveLength(2); // panel -> snapshot -> DNA dialog
    expect(panelSource).not.toContain("isDetailOpen={isPerfumeDetailsOpen}");
  });

  it("the Collection DNA dialog ignores Escape while the confirmation is above it, and listens again when it closes", () => {
    const start = panelSource.indexOf("function CollectionDnaPanel(");
    const dnaSource = panelSource.slice(start, panelSource.indexOf("\nfunction ", start + 10));

    expect(dnaSource).toContain("isLayerAboveOpen = false,");
    expect(dnaSource).toContain('if (event.key === "Escape" && !isLayerAboveOpen) {');
    expect(dnaSource).toContain("}, [onClose, visibleQuickDetailId, isLayerAboveOpen]);");
  });

  it("the Composer proposal and Note Explorer keep their existing Escape guard and Tab stand-down on that flag", () => {
    expect(panelSource.match(/if \(event\.key === "Escape" && !isDetailOpen\) \{/g)).toHaveLength(2);
    expect(panelSource).toContain("suspended: isDetailOpen,");
    expect(panelSource).toContain('if (event.key !== "Tab" || isDetailOpen || !dialog) {');
  });
});
