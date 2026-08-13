"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { aurelianCatalog } from "../merchant/catalog.js";
import { filterCatalog } from "../lib/filterCatalog.js";
import { parseFragranceIntent } from "../lib/parseFragranceIntent.js";
import { createComparisonWithEncounters } from "../perceptualLearning/createComparisonWithEncounters.js";
import { loadPerceptualLearningState } from "../perceptualLearning/perceptualLearningPersistence.js";
import { buildLearnerRecord } from "../perceptualLearning/learnerRecord.js";
import { buildEvidenceRevisit } from "../perceptualLearning/evidenceRevisit.js";
import {
  COMPARISON_DONE_COPY,
  COMPARISON_PICKER_FIRST_LABEL,
  COMPARISON_PICKER_QUERY_PLACEHOLDER,
  COMPARISON_PICKER_SECOND_LABEL,
  COMPARISON_PROMPT_LABEL,
  COMPARISON_REGISTER_ANOTHER_LABEL,
  COMPARISON_SUBMIT_ERROR_COPY,
  COMPARISON_SUBMIT_LABEL,
  COMPARISON_DONE_LABEL,
} from "../perceptualLearning/comparisonPromptCopy.js";
import { EvidenceRevisitView } from "./EvidenceRevisitView.jsx";

// Pure helpers, exported so they're directly testable without needing to
// simulate a click or a re-render (this repo's test suite renders static
// markup for given inputs -- see ObservationCaptureFlow.jsx/.test.jsx --
// it does not simulate interactive DOM events anywhere).

// Only the first fragrance supports deep-linking in this phase -- see the
// approved Phase 2.1 plan. Mirrors ObservationCaptureFlow's own
// resolveInitialFragrance, kept as its own copy here rather than shared,
// per the explicit instruction not to refactor Phase 1 for DRYness --
// including this pure-function-of-its-argument fix (see
// resolveInitialFragrance's own comment for the underlying defect: a
// mount-only lazy useState reading window.location.search independently
// cannot detect a same-pathname query change on an already-mounted
// instance). Callers must feed this useSearchParams()'s own reactive
// value, never window.location.
export function resolveInitialFirstFragrance(search) {
  const fragranceId = parseFragranceIntent(search ?? "");
  if (fragranceId === null) {
    return null;
  }

  return aurelianCatalog.find((item) => item.id === fragranceId) ?? null;
}

// Serves both picker steps: the first picker calls this with no exclusion,
// the second picker excludes whichever fragrance was already picked first.
// This is a presentation-only rule -- the domain/use-case layer remains
// capable of a same-fragrance pair (see comparison.js, ADR-0022); nothing
// here touches createComparisonWithEncounters or Comparison's invariants.
export function getComparisonCandidates({ query, excludedFragranceId = null }) {
  const candidates =
    excludedFragranceId === null
      ? aurelianCatalog
      : aurelianCatalog.filter((item) => item.id !== excludedFragranceId);

  return filterCatalog(candidates, query, "all");
}

export function canSubmitComparison({ freeText }) {
  return typeof freeText === "string" && freeText.trim().length > 0;
}

function getStorage() {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

// Resolves prior evidence for BOTH fragrances in a Comparison from whatever
// is currently in storage, through the same LearnerRecord -> EvidenceRevisit
// path every other read surface uses -- one storage read, one LearnerRecord,
// two independent buildEvidenceRevisit calls (never a new read-model shape,
// never a merged/paired projection). Exported for direct testability,
// mirroring ObservationCaptureFlow's own resolvePriorEvidence -- kept as its
// own local copy here rather than a cross-import, per this file's own
// established precedent (resolveInitialFirstFragrance).
//
// Temporal correctness comes entirely from *when* this is called, not from
// any exclusion logic: handleSubmit calls this strictly before the write
// that creates the new EncounterInstances/Comparison, so neither returned
// projection can ever include evidence this same call is about to create.
export function resolvePriorEvidenceForComparison({ storage, firstFragranceId, secondFragranceId }) {
  const learnerRecord = buildLearnerRecord(loadPerceptualLearningState({ storage }));

  return {
    first: buildEvidenceRevisit({ learnerRecord, fragranceId: firstFragranceId }),
    second: buildEvidenceRevisit({ learnerRecord, fragranceId: secondFragranceId }),
  };
}

// Small, prop-driven presentational pieces. Each renders from explicit props
// only -- no internal state, no storage access -- so each is independently
// verifiable by rendering it directly with representative props, without
// needing to drive the full stateful journey through simulated clicks.

export function ComparisonFragrancePicker({
  label,
  contextFragranceName = null,
  query,
  onQueryChange,
  results,
  onSelect,
}) {
  return (
    <div
      className="learning-capture learning-capture--picker comparison-capture comparison-capture--picker"
      data-testid="comparison-picker"
    >
      {contextFragranceName ? (
        <p className="learning-capture__context comparison-capture__context">
          Primera: {contextFragranceName}
        </p>
      ) : null}
      <label className="learning-capture__heading" htmlFor="comparison-picker-query">
        {label}
      </label>
      <input
        id="comparison-picker-query"
        className="learning-capture__search-input"
        type="text"
        value={query}
        onChange={(event) => onQueryChange(event.target.value)}
        placeholder={COMPARISON_PICKER_QUERY_PLACEHOLDER}
      />
      <ul className="learning-capture__results comparison-capture__picker-results">
        {results.map((item) => (
          <li key={item.id}>
            <button type="button" className="learning-capture__result" onClick={() => onSelect(item)}>
              {item.brand} — {item.name}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ComparisonPromptForm({
  firstFragranceName,
  secondFragranceName,
  freeText,
  onFreeTextChange,
  submitError,
  canSubmit,
  isSubmitting,
  onSubmit,
}) {
  return (
    <div
      className="learning-capture learning-capture--form comparison-capture comparison-capture--form"
      data-testid="comparison-form"
    >
      <p className="learning-capture__pair comparison-capture__pair">
        <span className="comparison-capture__first">{firstFragranceName}</span>
        {" · "}
        <span className="comparison-capture__second">{secondFragranceName}</span>
      </p>
      <label className="learning-capture__label" htmlFor="comparison-free-text">
        {COMPARISON_PROMPT_LABEL}
      </label>
      <textarea
        id="comparison-free-text"
        className="learning-capture__textarea"
        value={freeText}
        onChange={(event) => onFreeTextChange(event.target.value)}
      />
      {submitError ? <p className="learning-capture__error comparison-capture__error">{submitError}</p> : null}
      <button
        type="button"
        className="button learning-capture__submit"
        onClick={onSubmit}
        disabled={!canSubmit || isSubmitting}
      >
        {COMPARISON_SUBMIT_LABEL}
      </button>
    </div>
  );
}

export function ComparisonConfirmation({
  firstFragranceName,
  secondFragranceName,
  comparison,
  onCompareAnother,
  onDone,
}) {
  return (
    <div
      className="learning-capture learning-capture--confirmed comparison-capture comparison-capture--confirmed"
      data-testid="comparison-confirmation"
    >
      <p className="learning-capture__pair comparison-capture__pair">
        <span className="comparison-capture__first">{firstFragranceName}</span>
        {" · "}
        <span className="comparison-capture__second">{secondFragranceName}</span>
      </p>
      <blockquote className="learning-capture__quote comparison-capture__quote">
        {comparison.freeText}
      </blockquote>
      <div className="learning-capture__actions comparison-capture__actions">
        <button type="button" className="learning-capture__secondary" onClick={onCompareAnother}>
          {COMPARISON_REGISTER_ANOTHER_LABEL}
        </button>
        <button type="button" className="learning-capture__quiet" onClick={onDone}>
          {COMPARISON_DONE_LABEL}
        </button>
      </div>
      <Link className="quiet-link comparison-capture__learner-record-link" href="/mis-descubrimientos">
        Ver lo que he notado
      </Link>
    </div>
  );
}

// The full successful-submit phase: the existing confirmation, unchanged,
// plus -- only for whichever side(s) genuinely have prior evidence -- a
// collapsed disclosure the learner can choose to open. Kept as its own
// exported component (rather than inline JSX in the orchestrator's
// "confirmed" branch) specifically so it's directly testable via
// renderToStaticMarkup with explicit props, mirroring
// ObservationConfirmedPhase exactly. The two sides are always rendered as
// independent evidence -- never merged, never compared against each other,
// never summarized.
export function ComparisonConfirmedPhase({
  firstFragranceName,
  secondFragranceName,
  comparison,
  priorEvidence,
  onCompareAnother,
  onDone,
}) {
  return (
    <>
      <ComparisonConfirmation
        firstFragranceName={firstFragranceName}
        secondFragranceName={secondFragranceName}
        comparison={comparison}
        onCompareAnother={onCompareAnother}
        onDone={onDone}
      />
      {priorEvidence?.first?.hasPriorEvidence ? (
        <div className="comparison-capture__evidence-revisit">
          <p className="learning-capture__context comparison-capture__context">
            Primera: {firstFragranceName}
          </p>
          <EvidenceRevisitView evidenceRevisit={priorEvidence.first} />
        </div>
      ) : null}
      {priorEvidence?.second?.hasPriorEvidence ? (
        <div className="comparison-capture__evidence-revisit">
          <p className="learning-capture__context comparison-capture__context">
            Segunda: {secondFragranceName}
          </p>
          <EvidenceRevisitView evidenceRevisit={priorEvidence.second} />
        </div>
      ) : null}
    </>
  );
}

export function ComparisonDoneState() {
  return (
    <div
      className="empty-state learning-capture learning-capture--done comparison-capture comparison-capture--done"
      data-testid="comparison-done"
    >
      <p>{COMPARISON_DONE_COPY}</p>
    </div>
  );
}

// Stateful orchestrator. Nothing here writes to storage before a submit --
// mounting, picking A, picking B, typing the contrast, and abandoning
// without submitting are all silent with respect to persistence, by
// construction: the only call that touches storage is inside handleSubmit,
// and it is the single atomic createComparisonWithEncounters transaction --
// this component never constructs an EncounterInstance or Comparison itself.
//
// Journey: first-fragrance picker (skipped when a valid ?fragrance= deep
// link resolves fragrance A) -> second-fragrance picker (candidates exclude
// A) -> one contrast prompt -> immediate confirmation (quoting only the
// Comparison just created, never a history query), now optionally followed
// by up to two collapsed prior-evidence disclosures (Phase 4.2, see
// ComparisonConfirmedPhase) when genuine evidence existed for either side
// before this submission -> "Comparar otras dos" (resets into a genuinely
// fresh session -- the next submit creates two new EncounterInstances and a
// new Comparison, never reusing the prior pair) or "Listo" (static terminal
// state -- there is no /mis-descubrimientos to send anyone to yet).
export function ComparisonCaptureFlow() {
  const searchParams = useSearchParams();
  const searchParamsValue = searchParams?.toString() ?? "";
  const [firstFragrance, setFirstFragrance] = useState(() => resolveInitialFirstFragrance(searchParamsValue));
  const [secondFragrance, setSecondFragrance] = useState(null);
  const [firstPickerQuery, setFirstPickerQuery] = useState("");
  const [secondPickerQuery, setSecondPickerQuery] = useState("");
  const [freeText, setFreeText] = useState("");
  const [phase, setPhase] = useState("capture");
  const [lastComparison, setLastComparison] = useState(null);
  const [priorEvidence, setPriorEvidence] = useState(null);
  const [submitError, setSubmitError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Synchronous re-entrancy guard, checked in addition to (not instead of)
  // the isSubmitting state above. isSubmitting only becomes visible to a new
  // handleSubmit call once React commits the re-render -- a ref is read/set
  // immediately, so it closes any window where a second invocation could
  // still see a stale "not submitting" snapshot and re-derive priorEvidence
  // from storage a second time, after the first invocation's write has
  // already landed. Ported from ObservationCaptureFlow's Phase 4.1 guard --
  // now that this flow also reads storage before writing, the same race
  // window applies here too.
  const isSubmittingRef = useRef(false);
  // Tracks the search string this component has already reacted to, so a
  // render can tell a genuine URL change apart from a re-render triggered
  // by something else entirely (typing in the textarea, "Comparar otras
  // dos"). React's own recommended pattern for adjusting state in response
  // to a changed prop/value is to compare against a previous-value tracker
  // DURING RENDER and call setState there -- never inside a useEffect,
  // which would run one commit late and risks a visible flash of stale
  // content (see https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes).
  const [resolvedSearchParamsValue, setResolvedSearchParamsValue] = useState(searchParamsValue);

  // Reactively resolves a deep link that arrives AFTER this component was
  // already mounted (see resolveInitialFirstFragrance's own comment for the
  // underlying defect). Fires only when searchParamsValue itself has
  // changed since the last render this component reacted to -- never
  // merely because firstFragrance changed for some other reason, which
  // matters specifically because "Comparar otras dos" resets firstFragrance
  // to null while the URL still contains the original deep link, and that
  // reset must stay reset rather than immediately re-resolving back to the
  // same fragrance. The `!firstFragrance` guard means this can only ever
  // fill in a still-empty first-fragrance picker -- it can never silently
  // switch or discard an already-active session.
  if (searchParamsValue !== resolvedSearchParamsValue) {
    setResolvedSearchParamsValue(searchParamsValue);
    const resolved = resolveInitialFirstFragrance(searchParamsValue);
    if (resolved && !firstFragrance) {
      setFirstFragrance(resolved);
    }
  }

  function handleSubmit() {
    if (
      !canSubmitComparison({ freeText }) ||
      isSubmittingRef.current ||
      !firstFragrance ||
      !secondFragrance
    ) {
      return;
    }

    isSubmittingRef.current = true;
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const storage = getStorage();
      // Captured strictly before the write below, so neither returned
      // projection can ever include the EncounterInstances/Comparison that
      // write is about to create -- see resolvePriorEvidenceForComparison's
      // own comment for why this ordering, not an exclusion filter, is what
      // makes the temporal boundary correct.
      const capturedPriorEvidence = resolvePriorEvidenceForComparison({
        storage,
        firstFragranceId: firstFragrance.id,
        secondFragranceId: secondFragrance.id,
      });

      const result = createComparisonWithEncounters({
        storage,
        firstFragranceId: firstFragrance.id,
        firstFragranceDisplaySnapshot: {
          fragranceId: firstFragrance.id,
          name: firstFragrance.name,
          brand: firstFragrance.brand,
        },
        secondFragranceId: secondFragrance.id,
        secondFragranceDisplaySnapshot: {
          fragranceId: secondFragrance.id,
          name: secondFragrance.name,
          brand: secondFragrance.brand,
        },
        freeText,
      });

      if (!result.persisted) {
        setSubmitError(COMPARISON_SUBMIT_ERROR_COPY);
        return;
      }

      setLastComparison(result.comparison);
      setPriorEvidence(capturedPriorEvidence);
      setPhase("confirmed");
    } finally {
      isSubmittingRef.current = false;
      setIsSubmitting(false);
    }
  }

  function handleCompareAnother() {
    setFirstFragrance(null);
    setSecondFragrance(null);
    setFirstPickerQuery("");
    setSecondPickerQuery("");
    setFreeText("");
    setPriorEvidence(null);
    setSubmitError(null);
    setPhase("capture");
  }

  function handleDone() {
    setPhase("done");
  }

  if (phase === "done") {
    return <ComparisonDoneState />;
  }

  if (phase === "confirmed" && lastComparison) {
    return (
      <ComparisonConfirmedPhase
        firstFragranceName={firstFragrance.name}
        secondFragranceName={secondFragrance.name}
        comparison={lastComparison}
        priorEvidence={priorEvidence}
        onCompareAnother={handleCompareAnother}
        onDone={handleDone}
      />
    );
  }

  if (!firstFragrance) {
    return (
      <ComparisonFragrancePicker
        label={COMPARISON_PICKER_FIRST_LABEL}
        query={firstPickerQuery}
        onQueryChange={setFirstPickerQuery}
        results={getComparisonCandidates({ query: firstPickerQuery })}
        onSelect={setFirstFragrance}
      />
    );
  }

  if (!secondFragrance) {
    return (
      <ComparisonFragrancePicker
        label={COMPARISON_PICKER_SECOND_LABEL}
        contextFragranceName={firstFragrance.name}
        query={secondPickerQuery}
        onQueryChange={setSecondPickerQuery}
        results={getComparisonCandidates({
          query: secondPickerQuery,
          excludedFragranceId: firstFragrance.id,
        })}
        onSelect={setSecondFragrance}
      />
    );
  }

  return (
    <ComparisonPromptForm
      firstFragranceName={firstFragrance.name}
      secondFragranceName={secondFragrance.name}
      freeText={freeText}
      onFreeTextChange={setFreeText}
      submitError={submitError}
      canSubmit={canSubmitComparison({ freeText })}
      isSubmitting={isSubmitting}
      onSubmit={handleSubmit}
    />
  );
}
