"use client";

import { useState } from "react";
import Link from "next/link";
import { aurelianCatalog } from "../merchant/catalog.js";
import { filterCatalog } from "../lib/filterCatalog.js";
import { parseFragranceIntent } from "../lib/parseFragranceIntent.js";
import { createComparisonWithEncounters } from "../perceptualLearning/createComparisonWithEncounters.js";
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

// Pure helpers, exported so they're directly testable without needing to
// simulate a click or a re-render (this repo's test suite renders static
// markup for given inputs -- see ObservationCaptureFlow.jsx/.test.jsx --
// it does not simulate interactive DOM events anywhere).

// Only the first fragrance supports deep-linking in this phase -- see the
// approved Phase 2.1 plan. Mirrors ObservationCaptureFlow's own
// resolveInitialFragrance, kept as its own copy here rather than shared,
// per the explicit instruction not to refactor Phase 1 for DRYness.
export function resolveInitialFirstFragrance() {
  if (typeof window === "undefined") {
    return null;
  }

  const fragranceId = parseFragranceIntent(window.location.search);
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
    <div className="comparison-capture comparison-capture--picker" data-testid="comparison-picker">
      {contextFragranceName ? (
        <p className="comparison-capture__context">Primera: {contextFragranceName}</p>
      ) : null}
      <label htmlFor="comparison-picker-query">{label}</label>
      <input
        id="comparison-picker-query"
        type="text"
        value={query}
        onChange={(event) => onQueryChange(event.target.value)}
        placeholder={COMPARISON_PICKER_QUERY_PLACEHOLDER}
      />
      <ul className="comparison-capture__picker-results">
        {results.map((item) => (
          <li key={item.id}>
            <button type="button" onClick={() => onSelect(item)}>
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
    <div className="comparison-capture comparison-capture--form" data-testid="comparison-form">
      <p className="comparison-capture__pair">
        <span className="comparison-capture__first">{firstFragranceName}</span>
        {" · "}
        <span className="comparison-capture__second">{secondFragranceName}</span>
      </p>
      <label htmlFor="comparison-free-text">{COMPARISON_PROMPT_LABEL}</label>
      <textarea
        id="comparison-free-text"
        value={freeText}
        onChange={(event) => onFreeTextChange(event.target.value)}
      />
      {submitError ? <p className="comparison-capture__error">{submitError}</p> : null}
      <button type="button" onClick={onSubmit} disabled={!canSubmit || isSubmitting}>
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
      className="comparison-capture comparison-capture--confirmed"
      data-testid="comparison-confirmation"
    >
      <p className="comparison-capture__pair">
        <span className="comparison-capture__first">{firstFragranceName}</span>
        {" · "}
        <span className="comparison-capture__second">{secondFragranceName}</span>
      </p>
      <blockquote className="comparison-capture__quote">{comparison.freeText}</blockquote>
      <div className="comparison-capture__actions">
        <button type="button" onClick={onCompareAnother}>
          {COMPARISON_REGISTER_ANOTHER_LABEL}
        </button>
        <button type="button" onClick={onDone}>
          {COMPARISON_DONE_LABEL}
        </button>
      </div>
      <Link className="quiet-link comparison-capture__learner-record-link" href="/mis-descubrimientos">
        Ver lo que he notado
      </Link>
    </div>
  );
}

export function ComparisonDoneState() {
  return (
    <div className="comparison-capture comparison-capture--done" data-testid="comparison-done">
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
// Comparison just created, never a history query) -> "Comparar otras dos"
// (resets into a genuinely fresh session -- the next submit creates two new
// EncounterInstances and a new Comparison, never reusing the prior pair) or
// "Listo" (static terminal state -- there is no /mis-descubrimientos to send
// anyone to yet).
export function ComparisonCaptureFlow() {
  const [firstFragrance, setFirstFragrance] = useState(() => resolveInitialFirstFragrance());
  const [secondFragrance, setSecondFragrance] = useState(null);
  const [firstPickerQuery, setFirstPickerQuery] = useState("");
  const [secondPickerQuery, setSecondPickerQuery] = useState("");
  const [freeText, setFreeText] = useState("");
  const [phase, setPhase] = useState("capture");
  const [lastComparison, setLastComparison] = useState(null);
  const [submitError, setSubmitError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function handleSubmit() {
    if (
      !canSubmitComparison({ freeText }) ||
      isSubmitting ||
      !firstFragrance ||
      !secondFragrance
    ) {
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const result = createComparisonWithEncounters({
        storage: getStorage(),
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
      setPhase("confirmed");
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleCompareAnother() {
    setFirstFragrance(null);
    setSecondFragrance(null);
    setFirstPickerQuery("");
    setSecondPickerQuery("");
    setFreeText("");
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
      <ComparisonConfirmation
        firstFragranceName={firstFragrance.name}
        secondFragranceName={secondFragrance.name}
        comparison={lastComparison}
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
