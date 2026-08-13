"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { aurelianCatalog } from "../merchant/catalog.js";
import { filterCatalog } from "../lib/filterCatalog.js";
import { parseFragranceIntent } from "../lib/parseFragranceIntent.js";
import { parseEncounterIntent } from "../lib/parseEncounterIntent.js";
import { createComparisonWithEncounters } from "../perceptualLearning/createComparisonWithEncounters.js";
import { createComparisonForExistingEncounters } from "../perceptualLearning/createComparisonForExistingEncounters.js";
import { loadPerceptualLearningState } from "../perceptualLearning/perceptualLearningPersistence.js";
import { buildLearnerRecord } from "../perceptualLearning/learnerRecord.js";
import { buildEvidenceRevisit } from "../perceptualLearning/evidenceRevisit.js";
import { OBSERVATION_MOMENT_COPY } from "../perceptualLearning/momentVocabulary.js";
import {
  COMPARISON_DONE_COPY,
  COMPARISON_NO_ELIGIBLE_ENCOUNTERS_COPY,
  COMPARISON_PICKER_ENCOUNTER_LABEL,
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

// Phase 6.0. Resolves the FIXED first encounter for a temporal
// (same-fragrance) comparison from an ?encounter=<id> deep link (see
// EncounterEvidenceCard's "Comparar con otro encuentro" link, the only
// current source of this deep link). Re-checks the Phase 6.0 eligibility
// invariant here too -- not merely relying on createComparisonForExistingEncounters.js's
// own independent enforcement at the use-case boundary -- so an
// ineligible/missing/foreign encounterInstanceId in the URL degrades
// cleanly to "not resolved" (falls back to the ordinary picker) rather
// than entering temporal mode with nothing eligible to show.
//
// Unlike resolveInitialFirstFragrance's pure catalog lookup, this reads
// storage, because "which encounters exist and are eligible" can only be
// answered from persisted evidence. This is a deliberate, narrow exception
// to this file's own stated invariant that mounting is silent with
// respect to persistence: parseEncounterIntent returns null immediately
// for any URL without an ?encounter= id (the overwhelming majority of
// mounts, including every existing different-fragrance journey), in which
// case this returns before ever touching storage -- so the general journey
// remains exactly as storage-read-free before submit as before.
export function resolveTemporalFirstEncounter(search, { storage }) {
  const encounterInstanceId = parseEncounterIntent(search ?? "");
  if (encounterInstanceId === null) {
    return null;
  }

  const learnerRecord = buildLearnerRecord(loadPerceptualLearningState({ storage }));
  const encounter = learnerRecord.encounters.find(
    (candidate) => candidate.encounterInstanceId === encounterInstanceId
  );

  if (!encounter || encounter.observations.length === 0) {
    return null;
  }

  return encounter;
}

// The eligible OTHER encounters of the same fragrance as the fixed first
// encounter, excluding that encounter itself. Same eligibility rule as
// resolveTemporalFirstEncounter (>=1 Observation) -- a UI-level
// convenience filter only, never the sole enforcement point:
// createComparisonForExistingEncounters.js re-checks eligibility
// independently at the use-case boundary regardless of what this returns,
// per the explicit Phase 6.0 amendment.
export function getTemporalComparisonCandidates({ storage, fragranceId, excludedEncounterInstanceId }) {
  const learnerRecord = buildLearnerRecord(loadPerceptualLearningState({ storage }));

  return learnerRecord.encounters.filter(
    (encounter) =>
      encounter.fragranceId === fragranceId &&
      encounter.encounterInstanceId !== excludedEncounterInstanceId &&
      encounter.observations.length > 0
  );
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

// Phase 6.0. Encounter-identity date formatting -- day-level granularity
// alone is insufficient here: two eligible encounters of the same
// fragrance created on the same calendar day (plausible in real use, and
// reproduced live during browser acceptance) render byte-identical labels
// at day-level precision, giving their radio controls indistinguishable
// accessible names. Hour/minute is included specifically because a
// timestamp is the ONLY thing distinguishing two same-fragrance encounters
// here -- unlike formatEvidenceDate/formatRevisitDate (LearnerRecordView.jsx/
// EvidenceRevisitView.jsx), which stay day-level because they label a
// single card, never disambiguate one sibling from another. Deliberately
// its own local copy rather than a cross-import, per this file's own
// established precedent (resolveInitialFirstFragrance).
function formatEncounterDate(isoString) {
  try {
    return new Intl.DateTimeFormat("es-MX", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(isoString));
  } catch {
    return "";
  }
}

// Phase 6.0. Disambiguates a temporal (same-fragrance) encounter for the
// plain-string firstFragranceName/secondFragranceName props that
// ComparisonPromptForm/ComparisonConfirmation already accept -- appending
// the encounter's own date is what actually distinguishes two encounters
// of an identically-named fragrance (see EncounterComparisonPicker's own
// comment for why this can't just be the fragrance name alone). Kept as a
// plain string (not a <time> element) specifically so these two
// already-shipped, already-tested shared components need no prop-shape
// change for Phase 6.0 -- their own tests, and the general different-fragrance
// journey that also uses them, stay completely unaffected. <time dateTime>
// is used everywhere Phase 6.0 controls its own JSX instead (see
// EncounterComparisonPicker below and the read-model disambiguation in
// LearnerRecordView.jsx/EvidenceRevisitView.jsx).
function formatTemporalEncounterName(encounter) {
  const name = encounter.fragranceDisplaySnapshot?.name ?? "Una fragancia";
  return `${name} (${formatEncounterDate(encounter.createdAt)})`;
}

// Phase 6.0. The second step of a temporal (same-fragrance) comparison:
// choosing which OTHER already-experienced encounter of the same fragrance
// to compare against the fixed first one (contextFragranceName/contextDate/
// contextObservations). Deliberately never renders encounterInstanceId as
// visible text anywhere -- each candidate's accessible name is its
// fragrance name plus its own date (native <label> association carries
// this automatically; no aria-label needed), which is what actually
// distinguishes two encounters of an identically-named fragrance to the
// learner, not an opaque id. Native fieldset/legend/radio, mirroring
// ObservationCaptureFlow's own moment selector -- selecting a candidate
// advances the flow immediately (no separate "confirm selection" step),
// mirroring ComparisonFragrancePicker's own click-to-advance pattern.
// Renders each candidate's verbatim Observation(s) so the learner can
// distinguish encounters by what they actually wrote, not just by date.
export function EncounterComparisonPicker({
  contextFragranceName,
  contextDate,
  contextObservations,
  candidates,
  onSelect,
}) {
  return (
    <div
      className="learning-capture learning-capture--picker comparison-capture comparison-capture--encounter-picker"
      data-testid="comparison-encounter-picker"
    >
      <p className="learning-capture__context comparison-capture__context">
        Primera: {contextFragranceName} ·{" "}
        <time dateTime={contextDate}>{formatEncounterDate(contextDate)}</time>
      </p>
      {contextObservations.length > 0 ? (
        <ul className="comparison-capture__encounter-observations" data-testid="comparison-encounter-picker-context-observations">
          {contextObservations.map((observation) => (
            <li key={observation.observationId} className="comparison-capture__encounter-observation">
              <span className="encounter-evidence-card__moment">
                {OBSERVATION_MOMENT_COPY[observation.moment]}
              </span>
              <blockquote className="comparison-capture__encounter-quote">{observation.freeText}</blockquote>
            </li>
          ))}
        </ul>
      ) : null}
      {candidates.length === 0 ? (
        <p className="comparison-capture__empty" data-testid="comparison-encounter-picker-empty">
          {COMPARISON_NO_ELIGIBLE_ENCOUNTERS_COPY}
        </p>
      ) : (
        <fieldset className="learning-capture__fieldset">
          <legend className="learning-capture__legend">{COMPARISON_PICKER_ENCOUNTER_LABEL}</legend>
          <div className="learning-capture__options comparison-capture__encounter-options">
            {candidates.map((candidate) => (
              <div key={candidate.encounterInstanceId} className="comparison-capture__encounter-option">
                <label className="learning-capture__option">
                  <input type="radio" name="temporal-second-encounter" onChange={() => onSelect(candidate)} />
                  {candidate.fragranceDisplaySnapshot?.name ?? "Una fragancia"} ·{" "}
                  <time dateTime={candidate.createdAt}>{formatEncounterDate(candidate.createdAt)}</time>
                </label>
                <ul className="comparison-capture__encounter-observations">
                  {candidate.observations.map((observation) => (
                    <li key={observation.observationId} className="comparison-capture__encounter-observation">
                      <span className="encounter-evidence-card__moment">
                        {OBSERVATION_MOMENT_COPY[observation.moment]}
                      </span>
                      <blockquote className="comparison-capture__encounter-quote">
                        {observation.freeText}
                      </blockquote>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </fieldset>
      )}
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
//
// Phase 6.0 adds a second, parallel journey: an ?encounter= deep link
// (from EncounterEvidenceCard's "Comparar con otro encuentro") fixes A as
// that specific, already-eligible EncounterInstance instead of an empty
// picker -> EncounterComparisonPicker (choose eligible encounter B of the
// same fragrance) -> the same contrast prompt/confirmation, calling
// createComparisonForExistingEncounters instead of
// createComparisonWithEncounters. Still true here: nothing writes to
// storage before submit EXCEPT resolving this one deep link itself, which
// necessarily reads persisted evidence to know what's eligible -- see
// resolveTemporalFirstEncounter's own comment.
export function ComparisonCaptureFlow() {
  const searchParams = useSearchParams();
  const searchParamsValue = searchParams?.toString() ?? "";
  const [firstFragrance, setFirstFragrance] = useState(() => resolveInitialFirstFragrance(searchParamsValue));
  const [secondFragrance, setSecondFragrance] = useState(null);
  // Phase 6.0. When set, the flow is in temporal (same-fragrance) mode:
  // temporalFirstEncounter is FIXED by the entry deep link (never
  // learner-picked from a list, unlike firstFragrance), and
  // temporalSecondEncounter is chosen from EncounterComparisonPicker.
  // These are a genuinely different shape (full encounter projections,
  // not catalog items) from firstFragrance/secondFragrance, kept as
  // separate state rather than overloaded into the same variables so
  // neither mode's render/submit logic has to guess which shape it holds.
  const [temporalFirstEncounter, setTemporalFirstEncounter] = useState(() =>
    resolveTemporalFirstEncounter(searchParamsValue, { storage: getStorage() })
  );
  const [temporalSecondEncounter, setTemporalSecondEncounter] = useState(null);
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
  // merely because firstFragrance/temporalFirstEncounter changed for some
  // other reason, which matters specifically because "Comparar otras dos"
  // resets both to null while the URL still contains the original deep
  // link, and that reset must stay reset rather than immediately
  // re-resolving back to the same fragrance/encounter. The `!firstFragrance`/
  // `!temporalFirstEncounter` guards mean this can only ever fill in a
  // still-empty first-step picker -- it can never silently switch or
  // discard an already-active session.
  //
  // Temporal resolution is attempted first: an ?encounter= id, if present
  // and eligible, always wins over an ?fragrance= id also being present
  // (the two links this app itself generates never combine both, but
  // precedence must still be deterministic for a manually-crafted URL).
  // resolveTemporalFirstEncounter returns null immediately, before ever
  // touching storage, when no ?encounter= id is present -- so this branch
  // costs nothing extra for the ordinary fragrance-only journey.
  if (searchParamsValue !== resolvedSearchParamsValue) {
    setResolvedSearchParamsValue(searchParamsValue);

    if (!temporalFirstEncounter && !firstFragrance) {
      const resolvedTemporal = resolveTemporalFirstEncounter(searchParamsValue, { storage: getStorage() });
      if (resolvedTemporal) {
        setTemporalFirstEncounter(resolvedTemporal);
      } else {
        const resolvedFragrance = resolveInitialFirstFragrance(searchParamsValue);
        if (resolvedFragrance) {
          setFirstFragrance(resolvedFragrance);
        }
      }
    }
  }

  function handleSubmit() {
    const isTemporalMode = Boolean(temporalFirstEncounter);

    if (!canSubmitComparison({ freeText }) || isSubmittingRef.current) {
      return;
    }

    if (isTemporalMode) {
      if (!temporalSecondEncounter) {
        return;
      }
    } else if (!firstFragrance || !secondFragrance) {
      return;
    }

    isSubmittingRef.current = true;
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const storage = getStorage();

      // Phase 6.0 temporal mode: both encounters already exist, so this
      // calls the dedicated existing-encounters use case instead of
      // minting two fresh ones. Deliberately does not call
      // resolvePriorEvidenceForComparison here: since both sides share the
      // same fragranceId by construction, that call would return the
      // identical evidence bundle for "first" and "second," which would
      // render the same encounters' evidence a third time (already shown
      // once as context in EncounterComparisonPicker's first step, once as
      // the candidate itself in its second step) under two redundant
      // "Primera"/"Segunda" labels -- net-negative for clarity rather than
      // genuinely new information. priorEvidence stays null in this mode,
      // so ComparisonConfirmedPhase's two disclosure blocks simply don't
      // render (both guards are `priorEvidence?.first/second?.hasPriorEvidence`).
      if (isTemporalMode) {
        const result = createComparisonForExistingEncounters({
          storage,
          firstEncounterInstanceId: temporalFirstEncounter.encounterInstanceId,
          secondEncounterInstanceId: temporalSecondEncounter.encounterInstanceId,
          freeText,
        });

        if (!result.persisted) {
          setSubmitError(COMPARISON_SUBMIT_ERROR_COPY);
          return;
        }

        setLastComparison(result.comparison);
        setPhase("confirmed");
        return;
      }

      // General (different-fragrance) mode, unchanged from before Phase 6.0.
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
    setTemporalFirstEncounter(null);
    setTemporalSecondEncounter(null);
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
    if (temporalFirstEncounter && temporalSecondEncounter) {
      return (
        <ComparisonConfirmedPhase
          firstFragranceName={formatTemporalEncounterName(temporalFirstEncounter)}
          secondFragranceName={formatTemporalEncounterName(temporalSecondEncounter)}
          comparison={lastComparison}
          priorEvidence={null}
          onCompareAnother={handleCompareAnother}
          onDone={handleDone}
        />
      );
    }

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

  if (temporalFirstEncounter) {
    if (!temporalSecondEncounter) {
      return (
        <EncounterComparisonPicker
          contextFragranceName={temporalFirstEncounter.fragranceDisplaySnapshot?.name ?? "Una fragancia"}
          contextDate={temporalFirstEncounter.createdAt}
          contextObservations={temporalFirstEncounter.observations}
          candidates={getTemporalComparisonCandidates({
            storage: getStorage(),
            fragranceId: temporalFirstEncounter.fragranceId,
            excludedEncounterInstanceId: temporalFirstEncounter.encounterInstanceId,
          })}
          onSelect={setTemporalSecondEncounter}
        />
      );
    }

    return (
      <ComparisonPromptForm
        firstFragranceName={formatTemporalEncounterName(temporalFirstEncounter)}
        secondFragranceName={formatTemporalEncounterName(temporalSecondEncounter)}
        freeText={freeText}
        onFreeTextChange={setFreeText}
        submitError={submitError}
        canSubmit={canSubmitComparison({ freeText })}
        isSubmitting={isSubmitting}
        onSubmit={handleSubmit}
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
