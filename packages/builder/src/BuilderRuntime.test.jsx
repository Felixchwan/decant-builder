import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// BuilderRuntime's App component is never rendered directly in this
// package's own tests (see DiscoveryBoxBuilder.test.jsx, which mocks it
// away specifically to avoid needing a full, real catalog/config fixture)
// -- source-contract checks are the established pattern here instead (see
// stylesOwnership.test.js, which reads this same file for an unrelated
// boundary). showBuilderHero itself is a plain, always-available prop (no
// scroll/effect-driven state involved, unlike isSummaryDocked), so the
// prop-forwarding half of this contract is exercised directly, with real
// rendering, in DiscoveryBoxBuilder.test.jsx's
// "defaults the shared hero section to visible..." test.
const runtimeSource = readFileSync(new URL("./BuilderRuntime.jsx", import.meta.url), "utf8");

describe("BuilderRuntime shared hero-section capability boundary", () => {
  it("defaults showBuilderHero to true, preserving today's hero rendering for every host that doesn't opt out", () => {
    expect(runtimeSource).toMatch(/showBuilderHero\s*=\s*true,/);
  });

  it("gates the shared hero section behind showBuilderHero, rendering it for any host that doesn't pass false", () => {
    const heroIndex = runtimeSource.indexOf('<section className="hero">');
    expect(heroIndex).toBeGreaterThan(-1);
    const beforeHero = runtimeSource.slice(Math.max(0, heroIndex - 40), heroIndex);
    expect(beforeHero).toMatch(/\{showBuilderHero && \(\s*$/);
  });

  it("holds no leftover isIntroCollapsed plumbing -- that represented a host's own persisted intro preference, which this generic render capability does not couple to", () => {
    expect(runtimeSource).not.toMatch(/isIntroCollapsed/);
  });
});

// onCatalogInfoRequest itself is a plain, always-available prop, same as
// showBuilderHero above -- the prop-forwarding half of this contract is
// exercised directly, with real rendering, in DiscoveryBoxBuilder.test.jsx's
// "renders a compact info button..." test.
describe("BuilderRuntime catalog-header info affordance boundary", () => {
  it("has no default value -- absent by default, rendering the catalog heading row exactly as it always has", () => {
    expect(runtimeSource).toMatch(/onCatalogInfoRequest,\s*\n\}\) \{/);
  });

  it("gates the info button behind onCatalogInfoRequest, inside the catalog panel-header row, never a second copy of the heading", () => {
    const panelHeaderIndex = runtimeSource.indexOf('<div className="catalog-title-group">');
    expect(panelHeaderIndex).toBeGreaterThan(-1);
    const panelHeaderSource = runtimeSource.slice(panelHeaderIndex, panelHeaderIndex + 700);
    expect(panelHeaderSource).toContain("{onCatalogInfoRequest && (");
    expect(panelHeaderSource).toContain('className="panel-header-actions"');
    expect(panelHeaderSource).toContain('className="catalog-info-button"');
    expect(panelHeaderSource).toContain('aria-label={t("general.catalogInfoAria")}');
    expect(panelHeaderSource).toContain("onClick={onCatalogInfoRequest}");
  });
});

// Same source-contract pattern as above, for the collapsible right-panel
// rail. Live behavior (natural-scroll-then-bottom-lock via a JS-computed
// negative top-sticky offset, the header-offset clamp for a short panel,
// rail top-stick while collapsed, 3->4+ catalog reflow, inert blocking
// focus/pointer interaction on the hidden panel, focus staying on the rail
// across a real click, state surviving a collapse/expand cycle,
// mobile/Discovery-Decants non-regression) was browser-verified directly
// -- see the session's verification notes -- rather than re-asserted here
// as markup strings, since none of it is expressible as a static
// source-contract check the way the hero-collapse boundary above is.
describe("BuilderRuntime collapsible right-panel boundary", () => {
  it("defaults enablePanelCollapse to false, so a host that never opts in renders no rail and no extra wrapper DOM", () => {
    expect(runtimeSource).toMatch(/enablePanelCollapse\s*=\s*false,/);
  });

  it("gates the entire rail + wrapper behind enablePanelCollapse, falling back to the bare boxPanel element otherwise", () => {
    expect(runtimeSource).toContain("{enablePanelCollapse ? (");
    expect(runtimeSource).toContain('className="builder-panel-collapsible-row"');
    expect(runtimeSource).toContain("builder-panel-collapse-rail");
    expect(runtimeSource).toMatch(/\) : \(\s*boxPanel\s*\)\}/);
  });

  it("marks the wrapped panel inert while collapsed -- the single mechanism blocking focus, pointer interaction, and AT exposure at once, while the component stays mounted", () => {
    expect(runtimeSource).toContain('<div className="builder-panel-column" inert={isPanelCollapsed}>');
  });

  it("does not add pending-focus-ref/useLayoutEffect machinery -- the rail is the only trigger, so focus already sits on it when collapse fires (confirmed via real-click browser testing, not just assumed)", () => {
    expect(runtimeSource).not.toMatch(/pendingRailFocusRef|collapseRailRef/);
  });

  it("keeps isPanelCollapsed local and non-persisted, matching BuilderPanel's own isSummaryCollapsed precedent", () => {
    expect(runtimeSource).toMatch(/const \[isPanelCollapsed, setIsPanelCollapsed\] = useState\(false\);/);
    expect(runtimeSource).not.toMatch(/isPanelCollapsed.*localStorage|localStorage.*[Pp]anelCollapse/);
  });
});

// Regression guard for a real Aurelian defect: the Accords section of the
// fragrance details modal rendered `t("details.accords")` twice -- once as
// the section's own <h4>, and again as DetailTagGroup's inner label span
// (unlike the Profile section right above it, where each DetailTagGroup gets
// its own distinct sub-label, e.g. "Seasons"/"Occasions"/"Vibes", none of
// which repeat the section's own "Profile" heading). Fixed by making
// DetailTagGroup's label optional and simply not passing one for Accords,
// since the section heading alone already says everything the label would.
describe("PerfumeDetailsModal accords section -- no duplicated heading", () => {
  const accordsSectionIndex = runtimeSource.indexOf('<h4>{t("details.accords")}</h4>');
  const accordsSectionSource = runtimeSource.slice(accordsSectionIndex, accordsSectionIndex + 220);

  it("renders the Accords heading exactly once per section, not also as DetailTagGroup's label", () => {
    expect(accordsSectionIndex).toBeGreaterThan(-1);
    expect(accordsSectionSource).not.toMatch(/label=\{t\("details\.accords"\)\}/);
    expect(accordsSectionSource).toMatch(/<DetailTagGroup assetResolver=\{assetResolver\} translator=\{translator\} values=\{perfume\.accords \|\| \[\]\} assetType="accords" \/>/);
  });

  it("keeps DetailTagGroup's label optional, rendering no label span at all when omitted", () => {
    const componentIndex = runtimeSource.indexOf("function DetailTagGroup(");
    const componentSource = runtimeSource.slice(componentIndex, componentIndex + 400);
    expect(componentSource).toContain("{label && <span>{label}</span>}");
  });

  it("still gives the Profile section's three tag groups their own distinct sub-labels -- this fix narrows only the Accords duplication, not the established Profile pattern", () => {
    const profileSectionIndex = runtimeSource.indexOf('<h4>{t("details.profile")}</h4>');
    const profileSectionSource = runtimeSource.slice(profileSectionIndex, profileSectionIndex + 500);
    expect(profileSectionSource).toContain('label={t("details.seasons")}');
    expect(profileSectionSource).toContain('label={t("details.occasions")}');
    expect(profileSectionSource).toContain('label={t("details.vibes")}');
  });
});

// Regression guard for a real Aurelian defect: note pills in the fragrance
// details modal (DetailNotePill) rendered the catalog's raw English
// `note.name` directly, with no locale lookup at all -- unlike accord chips
// (DetailMetadataChip), which already resolved through
// `translator.label(assetType, value)`. Notes now go through the exact same
// shared taxonomy label mechanism, keyed by the note's canonical id. This
// package carries no note/accord vocabulary itself -- a host supplies its
// own display labels via createBuilderConfig's `taxonomyLabels` (see
// createTranslator's own tests for that generic override mechanism); absent
// one, `label()`'s explicit fallback argument (the note's own catalog name,
// not the generic raw-id fallback) preserves today's English display.
// Composer Phase 1 follow-up: individually consuming one of a proposal's own
// suggestions must not disable the whole-proposal Apply action. The fix
// scopes the staleness comparison key to exclude the current proposal's own
// addedPerfumes ids from the live box before comparing, rather than
// suppressing staleness detection outright -- a genuinely invalidating
// change (an unrelated selection edit, or a changed Composer input) must
// still be caught. See composerIndividualSelection.test.js for behavioral
// coverage of the underlying primitives; this is a source-contract check
// since BuilderRuntime's App component is never rendered directly in this
// package's own tests (see the file-level comment above).
describe("Composer proposal staleness: individual consumption vs. genuine invalidation", () => {
  const composerInputKeyIndex = runtimeSource.indexOf("const composerProposalAddedIds = useMemo(");
  const composerInputKeySource = runtimeSource.slice(composerInputKeyIndex, composerInputKeyIndex + 1300);

  it("derives the excluded-id set from the current proposal's own addedPerfumes, not from preservedPerfumes or the full collection", () => {
    expect(composerInputKeySource).toContain(
      "new Set((composerProposal?.addedPerfumes || []).map((perfume) => perfume.id)),"
    );
  });

  it("filters the live selectedPerfumes by that excluded-id set before building the comparison key", () => {
    expect(composerInputKeySource).toContain(
      "selectedPerfumes.filter((perfume) => !composerProposalAddedIds.has(perfume.id)),"
    );
    expect(composerInputKeySource).toContain("selectedPerfumes: selectedPerfumesForComposerStaleCheck,");
  });

  it("keeps handleComposeMyBox generating new proposals from the raw, unfiltered selectedPerfumes -- proposal generation/scoring itself is untouched", () => {
    const composeStart = runtimeSource.indexOf("function handleComposeMyBox()");
    const composeSource = runtimeSource.slice(composeStart, composeStart + 4000);
    expect(composeSource).toContain("buildComposerBoxProposal({\n          selectedPerfumes,");
    expect(composeSource).not.toContain("selectedPerfumesForComposerStaleCheck");
  });

  it("leaves handleApplyComposerProposal's own full-collection-replace body untouched -- it still maps proposal.apply.collectionIds through the live catalog rather than merging/appending", () => {
    const applyStart = runtimeSource.indexOf("function handleApplyComposerProposal()");
    const applySource = runtimeSource.slice(applyStart, applyStart + 700);
    expect(applySource).toContain("composerProposal.apply.collectionIds\n      .map((perfumeId) => catalogById.get(perfumeId))");
    expect(applySource).toContain("setSelectedPerfumes(nextSelectedPerfumes);");
  });
});

describe("PerfumeDetailsModal note pills -- localized through the shared taxonomy label, not raw catalog English", () => {
  it("resolves note display names via translator.label(\"notes\", noteId, fallback), passing the catalog name as the fallback", () => {
    const pillIndex = runtimeSource.indexOf("function DetailNotePill(");
    const pillSource = runtimeSource.slice(pillIndex, pillIndex + 900);
    expect(pillSource).toContain("const noteFallback = note?.name || formatLabel(noteId);");
    expect(pillSource).toContain('translator?.label?.("notes", noteId, noteFallback) || noteFallback');
  });

  it("threads translator into every DetailNoteGroup call site (general notes and all three pyramid tiers)", () => {
    const notesSectionIndex = runtimeSource.indexOf('<h4>{t("details.notes")}</h4>');
    const notesSectionSource = runtimeSource.slice(notesSectionIndex, notesSectionIndex + 1300);
    expect((notesSectionSource.match(/translator=\{translator\}/g) || [])).toHaveLength(4);
  });
});

describe("Fragrance details: result-scoped navigation wiring", () => {
  it("resolves navigation from the scoped id snapshot, falling back to the catalog's visible list", () => {
    const memoStart = runtimeSource.indexOf("const detailNavigationPerfumes = useMemo(");
    const memo = runtimeSource.slice(memoStart, memoStart + 400);
    expect(memo).toContain("resolveDetailNavigationPerfumes(");
    expect(memo).toContain("scopedPerfumeIds: detailScopedPerfumeIds");
    expect(memo).toContain("fallbackPerfumes: visiblePerfumes");
  });

  it("navigates with the modal's existing helpers over that one collection, never recomputing an order", () => {
    expect(runtimeSource).toContain("getAdjacentPerfume(currentPerfume, detailNavigationPerfumes, direction)");
    expect(runtimeSource).toContain("getDetailNavigation(detailPerfume, detailNavigationPerfumes)");
  });

  it("stores a copy of the ordered ids at open time (a snapshot), and clears the scope with the details", () => {
    expect(runtimeSource).toContain("setDetailScopedPerfumeIds(Array.isArray(scopedPerfumeIds) ? [...scopedPerfumeIds] : null);");
    const closeStart = runtimeSource.indexOf("const closePerfumeDetails = useCallback(");
    const close = runtimeSource.slice(closeStart, closeStart + 200);
    expect(close).toContain("setDetailPerfume(null);");
    expect(close).toContain("setDetailScopedPerfumeIds(null);");
  });

  it("opens Note Explorer details through the same openPerfumeDetails, tagged with its own analytics source", () => {
    expect(runtimeSource).toContain('openPerfumeDetails(perfume, "note_explorer", orderedPerfumeIds);');
    expect(runtimeSource).toContain("onOpenPerfumeDetails={openNoteExplorerPerfumeDetails}");
  });

  it("renders the details in the owned portal root so they stack above the Note Explorer modal", () => {
    const modalStart = runtimeSource.indexOf("function PerfumeDetailsModal(");
    expect(modalStart).toBeGreaterThan(-1);
    expect(runtimeSource.slice(modalStart)).toContain("return renderOwnedPortal(");
  });
});

describe("Composer proposal generation lifecycle wiring", () => {
  const start = runtimeSource.indexOf("function handleComposeMyBox()");
  const end = runtimeSource.indexOf("function handleCancelComposerProposal()");
  const handlerSource = runtimeSource.slice(start, end);

  it("runs the synchronous generation through the one generation runner, not directly in the click handler", () => {
    expect(runtimeSource).toContain("composerGenerationRunnerRef.current = createGenerationRunner();");
    expect(handlerSource).toContain("composerGenerationRunnerRef.current.run({");
    const workIndex = handlerSource.indexOf("work: () =>");
    expect(handlerSource.slice(workIndex)).toContain("buildComposerBoxProposal({");
    expect(handlerSource.slice(0, workIndex)).not.toContain("buildComposerBoxProposal(");
  });

  it("enters the loading state in onStart (before the work) and leaves it only in onSettled", () => {
    const onStart = handlerSource.indexOf("onStart:");
    const work = handlerSource.indexOf("work:");
    expect(onStart).toBeGreaterThan(-1);
    expect(onStart).toBeLessThan(work);
    expect(handlerSource.slice(onStart, work)).toContain("setIsComposerGenerating(true);");
    expect(handlerSource.match(/setIsComposerGenerating\(/g)).toHaveLength(2);
    expect(handlerSource).toContain("onSettled: () => setIsComposerGenerating(false),");
  });

  it("uses no fixed timer to make the loading state appear", () => {
    expect(handlerSource).not.toMatch(/setTimeout|requestAnimationFrame/);
  });

  it("commits success and failure through the existing proposal state and recoverable-error path", () => {
    expect(handlerSource).toContain("onSuccess: (nextProposal) => {\n        setComposerProposal(nextProposal);");
    expect(handlerSource).toContain('setComposerStatusMessage(t("app.recoverableActionError"));');
  });

  it("does not touch the composer settings (preferences/budget/strategy) during a run", () => {
    expect(handlerSource).not.toContain("setComposerSettings");
  });

  it("cancels any in-flight generation on unmount and on box clear", () => {
    expect(runtimeSource.match(/composerGenerationRunnerRef\.current\.cancel\(\)|runner\.cancel\(\)/g).length).toBeGreaterThanOrEqual(2);
  });
});

describe("Composer proposal -> fragrance details wiring", () => {
  const start = runtimeSource.indexOf("function openComposerProposalPerfumeDetails(");
  const end = runtimeSource.indexOf("function handleComposerSettingChange(");
  const openerSource = runtimeSource.slice(start, end);

  it("opens details through the same openPerfumeDetails scoped-ids path as the Note Explorer, tagged composer_proposal", () => {
    expect(openerSource).toContain("perfumes.find((item) => item.id === perfumeId)");
    expect(openerSource).toContain('openPerfumeDetails(perfume, "composer_proposal", orderedPerfumeIds);');
    expect(runtimeSource).toContain(
      "onOpenComposerProposalPerfumeDetails={openComposerProposalPerfumeDetails}"
    );
  });

  it("only touches details state: the proposal, its selected alternatives and the form are never written when opening", () => {
    expect(openerSource).not.toMatch(/setComposerProposal|setComposerSettings|setIsComposerGenerating|clearBox/);
    const openStart = runtimeSource.indexOf("function openPerfumeDetails(");
    const openSource = runtimeSource.slice(openStart, openStart + 900);
    expect(openSource).not.toMatch(/setComposerProposal|setComposerSettings/);
  });

  it("closing details clears only details state, returning to the proposal untouched", () => {
    const closeStart = runtimeSource.indexOf("const closePerfumeDetails = useCallback(");
    const closeSource = runtimeSource.slice(closeStart, closeStart + 200);
    expect(closeSource).not.toMatch(/setComposerProposal|setComposerSettings/);
  });

  it("regeneration replaces the proposal but the next open always takes a fresh snapshot (openPerfumeDetails overwrites the scope every time)", () => {
    expect(runtimeSource).toContain("setDetailScopedPerfumeIds(Array.isArray(scopedPerfumeIds) ? [...scopedPerfumeIds] : null);");
    expect(runtimeSource).toContain("onSuccess: (nextProposal) => {\n        setComposerProposal(nextProposal);");
  });
});
