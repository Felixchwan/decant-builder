"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { aurelianCatalog } from "../merchant/catalog.js";
import { filterCatalog } from "../lib/filterCatalog.js";
import { parseFragranceIntent } from "../lib/parseFragranceIntent.js";
import { createEncounterWithObservation } from "../perceptualLearning/createEncounterWithObservation.js";
import { recordObservation } from "../perceptualLearning/recordObservation.js";
import { loadPerceptualLearningState } from "../perceptualLearning/perceptualLearningPersistence.js";
import { buildLearnerRecord } from "../perceptualLearning/learnerRecord.js";
import { buildEvidenceRevisit } from "../perceptualLearning/evidenceRevisit.js";
import {
  OBSERVATION_MOMENT_COPY,
  OBSERVATION_MOMENT_VALUES,
} from "../perceptualLearning/momentVocabulary.js";
import { EvidenceRevisitView } from "./EvidenceRevisitView.jsx";

const SUBMIT_ERROR_COPY = "No pudimos guardar tu observación. Intenta de nuevo.";

// Pure helpers, exported so they're directly testable without needing to
// simulate a click or a re-render (this repo's test suite renders static
// markup for given inputs -- see BuilderExperience.test.jsx / BuilderPanel.test.jsx
// -- it does not simulate interactive DOM events anywhere).

export function resolveInitialFragrance() {
  if (typeof window === "undefined") {
    return null;
  }

  const fragranceId = parseFragranceIntent(window.location.search);
  if (fragranceId === null) {
    return null;
  }

  return aurelianCatalog.find((item) => item.id === fragranceId) ?? null;
}

export function canSubmitObservation({ moment, freeText }) {
  return OBSERVATION_MOMENT_VALUES.includes(moment) && typeof freeText === "string" && freeText.trim().length > 0;
}

export function formatObservationTimestamp(isoString) {
  try {
    return new Intl.DateTimeFormat("es-MX", { hour: "2-digit", minute: "2-digit" }).format(
      new Date(isoString)
    );
  } catch {
    return "";
  }
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

// Resolves prior evidence for a fragrance by reading whatever is currently
// in storage, through the same LearnerRecord -> EvidenceRevisit path every
// other read surface uses -- never duplicates buildEvidenceRevisit's own
// filtering/relevance logic here. Exported for direct testability, matching
// this file's own convention (resolveInitialFragrance, canSubmitObservation).
//
// Temporal correctness (Phase 4.1's locked rule) comes entirely from *when*
// this is called, not from any exclusion logic: handleSubmit calls this
// strictly before the write that creates the new EncounterInstance/
// Observation, so the returned projection can never include evidence this
// same call is about to create. It is captured once per capture session (the
// first successful write) and then held in React state for the rest of that
// session -- a later "Registrar otro momento" resubmission within the same
// session never recomputes it, so it keeps excluding everything written
// during this session, not just the very first Observation.
export function resolvePriorEvidence({ storage, fragranceId }) {
  const learnerRecord = buildLearnerRecord(loadPerceptualLearningState({ storage }));
  return buildEvidenceRevisit({ learnerRecord, fragranceId });
}

// Small, prop-driven presentational pieces. Each renders from explicit props
// only -- no internal state, no storage access -- so each is independently
// verifiable by rendering it directly with representative props, without
// needing to drive the full stateful journey through simulated clicks.

export function ObservationDoneState() {
  return (
    <div className="observation-capture observation-capture--done" data-testid="observation-done">
      <p>Gracias por registrar lo que notaste.</p>
    </div>
  );
}

export function ObservationConfirmation({
  fragranceName,
  observation,
  onRegisterAnotherMoment,
  onDone,
}) {
  return (
    <div
      className="observation-capture observation-capture--confirmed"
      data-testid="observation-confirmation"
    >
      <p className="observation-capture__fragrance">{fragranceName}</p>
      <p className="observation-capture__moment">{OBSERVATION_MOMENT_COPY[observation.moment]}</p>
      <blockquote className="observation-capture__quote">{observation.freeText}</blockquote>
      <p className="observation-capture__timestamp">
        {formatObservationTimestamp(observation.createdAt)}
      </p>
      <div className="observation-capture__actions">
        <button type="button" onClick={onRegisterAnotherMoment}>
          Registrar otro momento
        </button>
        <button type="button" onClick={onDone}>
          Listo
        </button>
      </div>
      <Link className="quiet-link observation-capture__learner-record-link" href="/mis-descubrimientos">
        Ver lo que he notado
      </Link>
    </div>
  );
}

// The full successful-submit phase: the existing confirmation, unchanged,
// plus -- only when genuine prior evidence exists -- a collapsed disclosure
// the learner can choose to open. Kept as its own exported component (rather
// than inline JSX in the orchestrator's "confirmed" branch) specifically so
// it's directly testable via renderToStaticMarkup with explicit props, the
// same way every other phase-specific piece in this file already is; the
// orchestrator itself can only be rendered at its initial state under this
// repo's testing conventions (see the file-level comment on
// ObservationCaptureFlow below).
export function ObservationConfirmedPhase({
  fragranceName,
  observation,
  priorEvidence,
  onRegisterAnotherMoment,
  onDone,
}) {
  return (
    <>
      <ObservationConfirmation
        fragranceName={fragranceName}
        observation={observation}
        onRegisterAnotherMoment={onRegisterAnotherMoment}
        onDone={onDone}
      />
      {priorEvidence?.hasPriorEvidence ? <EvidenceRevisitView evidenceRevisit={priorEvidence} /> : null}
    </>
  );
}

export function ObservationPicker({ query, onQueryChange, results, onSelect }) {
  return (
    <div className="observation-capture observation-capture--picker" data-testid="observation-picker">
      <label htmlFor="observation-picker-query">¿Sobre qué fragancia quieres registrar algo?</label>
      <input
        id="observation-picker-query"
        type="text"
        value={query}
        onChange={(event) => onQueryChange(event.target.value)}
        placeholder="Buscar por marca o nombre"
      />
      <ul className="observation-capture__picker-results">
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

export function ObservationForm({
  fragranceName,
  moment,
  onMomentChange,
  freeText,
  onFreeTextChange,
  submitError,
  canSubmit,
  isSubmitting,
  onSubmit,
}) {
  return (
    <div className="observation-capture observation-capture--form" data-testid="observation-form">
      <p className="observation-capture__fragrance">{fragranceName}</p>
      <fieldset>
        <legend>¿Cuándo lo notaste?</legend>
        {OBSERVATION_MOMENT_VALUES.map((value) => (
          <label key={value}>
            <input
              type="radio"
              name="moment"
              value={value}
              checked={moment === value}
              onChange={() => onMomentChange(value)}
            />
            {OBSERVATION_MOMENT_COPY[value]}
          </label>
        ))}
      </fieldset>
      <label htmlFor="observation-free-text">¿Qué notas?</label>
      <textarea
        id="observation-free-text"
        value={freeText}
        onChange={(event) => onFreeTextChange(event.target.value)}
      />
      {submitError ? <p className="observation-capture__error">{submitError}</p> : null}
      <button type="button" onClick={onSubmit} disabled={!canSubmit || isSubmitting}>
        Guardar
      </button>
    </div>
  );
}

// Stateful orchestrator. Nothing here writes to storage before a submit --
// mounting, resolving a fragrance, typing into the form, and unmounting
// without submitting are all silent with respect to persistence, by
// construction: the only calls that touch storage are inside handleSubmit.
//
// Journey: picker (only when no valid ?fragrance= deep link resolved) ->
// capture form -> immediate confirmation (quoting only the Observation just
// created, never a history query), now optionally followed by a collapsed
// prior-evidence disclosure (Phase 4.1, see ObservationConfirmedPhase) when
// genuine evidence existed before this submission -> "Registrar otro
// momento" (loops back to the form, same fragrance, same EncounterInstance)
// or "Listo" (static terminal state).
export function ObservationCaptureFlow() {
  const [pickedFragrance, setPickedFragrance] = useState(() => resolveInitialFragrance());
  const [pickerQuery, setPickerQuery] = useState("");
  const [moment, setMoment] = useState(null);
  const [freeText, setFreeText] = useState("");
  const [encounterInstanceId, setEncounterInstanceId] = useState(null);
  const [learnerId, setLearnerId] = useState(null);
  const [phase, setPhase] = useState("capture");
  const [lastObservation, setLastObservation] = useState(null);
  const [priorEvidence, setPriorEvidence] = useState(null);
  const [submitError, setSubmitError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Synchronous re-entrancy guard, checked in addition to (not instead of)
  // the isSubmitting state above. isSubmitting only becomes visible to a new
  // handleSubmit call once React commits the re-render -- a ref is read/set
  // immediately, so it closes any window where a second invocation could
  // still see a stale "not submitting" snapshot and re-derive priorEvidence
  // from storage a second time, after the first invocation's write has
  // already landed. See the Phase 4.1 browser-acceptance defect report.
  const isSubmittingRef = useRef(false);

  function handleSubmit() {
    if (!canSubmitObservation({ moment, freeText }) || isSubmittingRef.current || !pickedFragrance) {
      return;
    }

    isSubmittingRef.current = true;
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      if (!encounterInstanceId) {
        const storage = getStorage();
        // Captured strictly before the write below, so it can never include
        // the Observation that write is about to create -- see
        // resolvePriorEvidence's own comment for why this ordering, not an
        // exclusion filter, is what makes the temporal boundary correct.
        const capturedPriorEvidence = resolvePriorEvidence({ storage, fragranceId: pickedFragrance.id });

        const result = createEncounterWithObservation({
          storage,
          fragranceId: pickedFragrance.id,
          fragranceDisplaySnapshot: {
            fragranceId: pickedFragrance.id,
            name: pickedFragrance.name,
            brand: pickedFragrance.brand,
          },
          moment,
          freeText,
        });

        if (!result.persisted) {
          setSubmitError(SUBMIT_ERROR_COPY);
          return;
        }

        setEncounterInstanceId(result.encounterInstance.encounterInstanceId);
        setLearnerId(result.learnerId);
        setLastObservation(result.observation);
        setPriorEvidence(capturedPriorEvidence);
        setPhase("confirmed");
        return;
      }

      const result = recordObservation({
        storage: getStorage(),
        encounterInstanceId,
        learnerId,
        moment,
        freeText,
      });

      if (!result.persisted) {
        setSubmitError(SUBMIT_ERROR_COPY);
        return;
      }

      setLastObservation(result.observation);
      setPhase("confirmed");
    } finally {
      isSubmittingRef.current = false;
      setIsSubmitting(false);
    }
  }

  function handleRegisterAnotherMoment() {
    setMoment(null);
    setFreeText("");
    setSubmitError(null);
    setPhase("capture");
  }

  function handleDone() {
    setPhase("done");
  }

  if (phase === "done") {
    return <ObservationDoneState />;
  }

  if (phase === "confirmed" && lastObservation) {
    return (
      <ObservationConfirmedPhase
        fragranceName={pickedFragrance.name}
        observation={lastObservation}
        priorEvidence={priorEvidence}
        onRegisterAnotherMoment={handleRegisterAnotherMoment}
        onDone={handleDone}
      />
    );
  }

  if (!pickedFragrance) {
    return (
      <ObservationPicker
        query={pickerQuery}
        onQueryChange={setPickerQuery}
        results={filterCatalog(aurelianCatalog, pickerQuery, "all")}
        onSelect={setPickedFragrance}
      />
    );
  }

  return (
    <ObservationForm
      fragranceName={pickedFragrance.name}
      moment={moment}
      onMomentChange={setMoment}
      freeText={freeText}
      onFreeTextChange={setFreeText}
      submitError={submitError}
      canSubmit={canSubmitObservation({ moment, freeText })}
      isSubmitting={isSubmitting}
      onSubmit={handleSubmit}
    />
  );
}
