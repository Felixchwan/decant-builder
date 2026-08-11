"use client";

import { useState } from "react";
import { aurelianCatalog } from "../merchant/catalog.js";
import { filterCatalog } from "../lib/filterCatalog.js";
import { parseFragranceIntent } from "../lib/parseFragranceIntent.js";
import { createEncounterWithObservation } from "../perceptualLearning/createEncounterWithObservation.js";
import { recordObservation } from "../perceptualLearning/recordObservation.js";
import {
  OBSERVATION_MOMENT_COPY,
  OBSERVATION_MOMENT_VALUES,
} from "../perceptualLearning/momentVocabulary.js";

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
    </div>
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
// created, never a history query) -> "Registrar otro momento" (loops back to
// the form, same fragrance, same EncounterInstance) or "Listo" (static
// terminal state -- there is no /mis-descubrimientos to send anyone to yet).
export function ObservationCaptureFlow() {
  const [pickedFragrance, setPickedFragrance] = useState(() => resolveInitialFragrance());
  const [pickerQuery, setPickerQuery] = useState("");
  const [moment, setMoment] = useState(null);
  const [freeText, setFreeText] = useState("");
  const [encounterInstanceId, setEncounterInstanceId] = useState(null);
  const [learnerId, setLearnerId] = useState(null);
  const [phase, setPhase] = useState("capture");
  const [lastObservation, setLastObservation] = useState(null);
  const [submitError, setSubmitError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function handleSubmit() {
    if (!canSubmitObservation({ moment, freeText }) || isSubmitting || !pickedFragrance) {
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      if (!encounterInstanceId) {
        const result = createEncounterWithObservation({
          storage: getStorage(),
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
      <ObservationConfirmation
        fragranceName={pickedFragrance.name}
        observation={lastObservation}
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
