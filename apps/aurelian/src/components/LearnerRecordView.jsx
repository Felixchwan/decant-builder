"use client";

import { useState } from "react";
import Link from "next/link";
import { loadPerceptualLearningState } from "../perceptualLearning/perceptualLearningPersistence.js";
import { buildLearnerRecord } from "../perceptualLearning/learnerRecord.js";
import { OBSERVATION_MOMENT_COPY } from "../perceptualLearning/momentVocabulary.js";

// Local to this page only -- deliberately not extracted alongside
// ObservationCaptureFlow.jsx's formatObservationTimestamp, which formats
// only hour:minute for an evidence-just-submitted confirmation screen. This
// page shows evidence that may be days or weeks old, so it needs a calendar
// date instead; forcing one generic helper to cover both shapes would add a
// mode parameter for no real reuse benefit -- see the Phase 3.1 report.
function formatEvidenceDate(isoString) {
  try {
    return new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "short", year: "numeric" }).format(
      new Date(isoString)
    );
  } catch {
    return "";
  }
}

// Snapshot-only by construction -- never consults the live catalog. A null
// snapshot (or a missing referenced encounter, for a Comparison side) falls
// back to a graceful, honest label rather than a broken/blank name.
function resolveFragranceDisplay(snapshot) {
  if (!snapshot) {
    return { name: "Una fragancia", brand: null };
  }

  return { name: snapshot.name, brand: snapshot.brand };
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
// only -- no internal state, no storage access -- mirroring the convention
// already established by ObservationCaptureFlow.jsx/ComparisonCaptureFlow.jsx.

export function LearnerRecordActions({ showCatalogLink = false }) {
  return (
    <div className="learner-record-actions">
      <Link className="button button--compact" href="/mis-descubrimientos/observar">
        Registrar una observación
      </Link>
      <Link className="button button--compact" href="/mis-descubrimientos/comparar">
        Comparar dos fragancias
      </Link>
      {showCatalogLink ? (
        <Link className="text-link" href="/catalogo">
          Volver al catálogo
        </Link>
      ) : null}
    </div>
  );
}

export function LearnerRecordEmptyState() {
  return (
    <div className="empty-state learner-record-empty" data-testid="learner-record-empty">
      <p>Todavía no has registrado observaciones o comparaciones.</p>
      <LearnerRecordActions showCatalogLink />
    </div>
  );
}

export function EncounterEvidenceCard({ encounter }) {
  const { name, brand } = resolveFragranceDisplay(encounter.fragranceDisplaySnapshot);
  const hasScopedActions = Number.isInteger(encounter.fragranceId);

  return (
    <article className="encounter-evidence-card" data-testid="encounter-evidence-card">
      <p className="encounter-evidence-card__fragrance">
        {name}
        {brand ? <span className="encounter-evidence-card__brand"> · {brand}</span> : null}
      </p>
      <p className="encounter-evidence-card__date">{formatEvidenceDate(encounter.createdAt)}</p>
      {encounter.observations.length > 0 ? (
        <ul className="encounter-evidence-card__observations">
          {encounter.observations.map((observation) => (
            <li key={observation.observationId} className="encounter-evidence-card__observation">
              <span className="encounter-evidence-card__moment">
                {OBSERVATION_MOMENT_COPY[observation.moment]}
              </span>
              <blockquote className="encounter-evidence-card__quote">{observation.freeText}</blockquote>
            </li>
          ))}
        </ul>
      ) : null}
      {hasScopedActions ? (
        <div className="encounter-evidence-card__actions">
          <Link
            className="quiet-link"
            href={`/mis-descubrimientos/observar?fragrance=${encodeURIComponent(encounter.fragranceId)}`}
          >
            Registrar otra observación
          </Link>
          <Link
            className="quiet-link"
            href={`/mis-descubrimientos/comparar?fragrance=${encodeURIComponent(encounter.fragranceId)}`}
          >
            Comparar con otra
          </Link>
        </div>
      ) : null}
    </article>
  );
}

export function ComparisonEvidenceCard({ comparison }) {
  const first = resolveFragranceDisplay(comparison.firstEncounter?.fragranceDisplaySnapshot ?? null);
  const second = resolveFragranceDisplay(comparison.secondEncounter?.fragranceDisplaySnapshot ?? null);

  return (
    <article className="comparison-evidence-card" data-testid="comparison-evidence-card">
      <p className="comparison-evidence-card__pair">
        <span>{first.name}</span>
        {" ↔ "}
        <span>{second.name}</span>
      </p>
      <blockquote className="comparison-evidence-card__quote">{comparison.freeText}</blockquote>
      <p className="comparison-evidence-card__date">{formatEvidenceDate(comparison.createdAt)}</p>
    </article>
  );
}

// Pure aggregate -- takes an already-derived LearnerRecord and decides only
// how to lay it out. No storage access, no derivation logic of its own.
//
// "Encuentros" is presentation-filtered to encounters that actually carry an
// Observation. EncounterInstances created solely as Comparison infrastructure
// (zero Observations) are real, unmodified LearnerRecord entries -- nothing
// here mutates or filters learnerRecord.encounters itself, this filtering is
// local to what gets rendered in this one section. Those encounters are
// still fully represented via the Comparisons section, which resolves
// against every encounter regardless of Observation count.
export function LearnerRecordView({ learnerRecord }) {
  const observedEncounters = learnerRecord.encounters.filter(
    (encounter) => encounter.observations.length > 0
  );

  return (
    <div className="learner-record-view" data-testid="learner-record-view">
      <p className="eyebrow">Mis descubrimientos</p>
      <h1>Lo que has estado notando</h1>
      <p className="lede">Aquí puedes volver a tus propias observaciones y comparaciones.</p>
      {learnerRecord.hasEvidence ? (
        <>
          <LearnerRecordActions showCatalogLink />
          {observedEncounters.length > 0 ? (
            <section className="learner-record-section" data-testid="learner-record-encounters">
              <h2>Encuentros</h2>
              <div className="learner-record-list">
                {observedEncounters.map((encounter) => (
                  <EncounterEvidenceCard key={encounter.encounterInstanceId} encounter={encounter} />
                ))}
              </div>
            </section>
          ) : null}
          {learnerRecord.comparisons.length > 0 ? (
            <section className="learner-record-section" data-testid="learner-record-comparisons">
              <h2>Comparaciones</h2>
              <div className="learner-record-list">
                {learnerRecord.comparisons.map((comparison) => (
                  <ComparisonEvidenceCard key={comparison.comparisonId} comparison={comparison} />
                ))}
              </div>
            </section>
          ) : null}
        </>
      ) : (
        <LearnerRecordEmptyState />
      )}
    </div>
  );
}

// Stateful container. Reads storage exactly once, on mount, via a lazy
// useState initializer -- safe only because this component is always
// dynamically imported with {ssr:false} (see LearnerRecordMount.jsx), so it
// never executes during server rendering. No writes, no reset, no catalog
// lookup; loadPerceptualLearningState already performs the v1->v2 migration
// entirely in memory, so this single read never triggers a storage write.
export function LearnerRecordContainer() {
  const [learnerRecord] = useState(() =>
    buildLearnerRecord(loadPerceptualLearningState({ storage: getStorage() }))
  );

  return <LearnerRecordView learnerRecord={learnerRecord} />;
}
