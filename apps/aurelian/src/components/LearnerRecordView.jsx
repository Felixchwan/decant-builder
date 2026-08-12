"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  loadPerceptualLearningState,
  resetLearningData,
} from "../perceptualLearning/perceptualLearningPersistence.js";
import { buildLearnerRecord } from "../perceptualLearning/learnerRecord.js";
import { buildEvidenceRevisit } from "../perceptualLearning/evidenceRevisit.js";
import { OBSERVATION_MOMENT_COPY } from "../perceptualLearning/momentVocabulary.js";
import { EvidenceRevisitComparisonCard, EvidenceRevisitObservationCard } from "./EvidenceRevisitView.jsx";
import { aurelianCatalog } from "../merchant/catalog.js";
import { parseFragranceIntent } from "../lib/parseFragranceIntent.js";

const RESET_ERROR_COPY = "No pudimos eliminar tus datos. Intenta de nuevo.";

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

// Phase 5.0: resolves an optional catalog fragrance from a ?fragrance=<id>
// search string. Deliberately a PURE function of its argument -- it must
// never read window.location itself. The only correct caller is
// LearnerRecordContainer, passing useSearchParams()'s own current value;
// that hook is what Next.js's client router actually updates during a
// same-pathname, different-query navigation, and it is the only reliable
// signal that the URL genuinely changed. Reading window.location.search
// independently (the original browser-acceptance defect) created a second,
// racy source of truth: during a client-router transition, window.location
// is not guaranteed to already reflect the new URL at the moment this
// component re-renders, even though useSearchParams()'s reactive value
// already has -- a full page load doesn't have that race, which is why the
// original bug only reproduced on client-side navigation, never on F5.
// Uses the same deep-link contract (parseFragranceIntent, FRAGRANCE_QUERY_PARAM)
// and catalog lookup as ObservationCaptureFlow's resolveInitialFragrance /
// ComparisonCaptureFlow's resolveInitialFirstFragrance; kept as its own
// local copy rather than a cross-import, per this codebase's established
// precedent of not sharing these tiny per-file resolvers.
export function resolveScopedFragrance(search) {
  const fragranceId = parseFragranceIntent(search ?? "");
  if (fragranceId === null) {
    return null;
  }

  return aurelianCatalog.find((item) => item.id === fragranceId) ?? null;
}

// Delegates entirely to the existing resetLearningData capability -- never
// reimplements storage removal. On success, returns a fresh, safely-derived
// empty LearnerRecord built from an empty persisted-state shape rather than
// re-reading storage, since resetLearningData's own contract already
// guarantees the key is gone. Never writes a replacement state and never
// resolves/creates a new learner id -- per existing semantics, that only
// ever happens on the next successful Observation/Comparison submission
// (see learnerIdentity.js/resolveLearnerId, used by the existing use cases).
export function requestLearnerRecordReset({ storage }) {
  const succeeded = resetLearningData({ storage });

  if (!succeeded) {
    return { succeeded: false };
  }

  return {
    succeeded: true,
    learnerRecord: buildLearnerRecord({
      learnerId: null,
      learnerCreatedAt: null,
      encounterInstances: [],
      observations: [],
      comparisons: [],
    }),
  };
}

// Small, prop-driven presentational pieces. Each renders from explicit props
// only -- no internal state, no storage access -- mirroring the convention
// already established by ObservationCaptureFlow.jsx/ComparisonCaptureFlow.jsx.

// fragranceId is optional and purely additive: omitting it (the default)
// reproduces the exact original hrefs, so every existing caller/test is
// unaffected. When present, both capture links carry the same ?fragrance=
// deep link the catalog/EncounterEvidenceCard already use, so this page's
// actions point at the same fragrance the learner is currently looking at
// rather than a generic picker.
export function LearnerRecordActions({ showCatalogLink = false, fragranceId = null }) {
  const scope = fragranceId === null ? "" : `?fragrance=${encodeURIComponent(fragranceId)}`;

  return (
    <div className="learner-record-actions">
      <Link className="button button--compact" href={`/mis-descubrimientos/observar${scope}`}>
        Registrar una observación
      </Link>
      <Link className="button button--compact" href={`/mis-descubrimientos/comparar${scope}`}>
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

// Pure, prop-driven -- renders the delete-all control in whichever phase the
// caller specifies. No internal state, no storage access, mirroring every
// other piece in this file. `phase` is the local confirmation state chosen
// over a native <details> disclosure (see the Phase 3.2 report): the
// idle/confirming/deleting/error sequence has more independent states than
// simple open/closed disclosure, and this codebase's own testing convention
// (prop-driven pure pieces, no interactive-DOM simulation) fits an explicit
// status prop more directly than mixing native disclosure state with
// separate execution/error state.
export function LearnerRecordDeleteControl({ phase, onActivate, onCancel, onConfirm }) {
  if (phase === "idle") {
    return (
      <div className="learner-record-delete">
        <button
          type="button"
          className="quiet-link learner-record-delete__trigger"
          onClick={onActivate}
        >
          Eliminar mis datos de aprendizaje
        </button>
      </div>
    );
  }

  const isDeleting = phase === "deleting";

  return (
    <div
      className="learner-record-delete learner-record-delete--confirming"
      data-testid="learner-record-delete-confirm"
    >
      <p>Esto eliminará todas tus observaciones y comparaciones guardadas en este navegador.</p>
      {phase === "error" ? <p className="learner-record-delete__error">{RESET_ERROR_COPY}</p> : null}
      <div className="learner-record-delete__actions">
        <button type="button" onClick={onCancel} disabled={isDeleting}>
          Cancelar
        </button>
        <button type="button" onClick={onConfirm} disabled={isDeleting}>
          Eliminar definitivamente
        </button>
      </div>
    </div>
  );
}

// Phase 5.0 -- the fragrance-scoped counterpart to LearnerRecordView. Reuses
// EvidenceRevisitObservationCard/EvidenceRevisitComparisonCard verbatim (the
// same pieces ObservationConfirmedPhase/ComparisonConfirmedPhase already
// render) rather than EvidenceRevisitView's own collapsed <details> wrapper:
// on this dedicated page the evidence IS what the learner came to see, so it
// renders open/primary, not as a secondary disclosure behind a fresh
// submission the way it is in the two capture flows. buildEvidenceRevisit
// itself is untouched -- this is presentation-only reuse of its output.
//
// Deliberately does not expose the delete-all control: that action clears
// every fragrance's evidence at once and belongs only on the unscoped page
// it already lives on ("Ver todo lo que he notado" below links there), not
// on a page framed around one fragrance.
export function FragranceEvidenceView({ fragranceId, fragranceName, fragranceBrand, evidenceRevisit }) {
  const observedEncounters = evidenceRevisit.encounters.filter(
    (encounter) => encounter.observations.length > 0
  );

  return (
    <div className="learner-record-view" data-testid="fragrance-evidence-view">
      <p className="eyebrow">Mis descubrimientos</p>
      <h1>Lo que has notado sobre {fragranceName}</h1>
      {fragranceBrand ? <p className="lede">{fragranceBrand}</p> : null}
      {evidenceRevisit.hasPriorEvidence ? (
        <>
          {observedEncounters.length > 0 ? (
            <section className="learner-record-section" data-testid="fragrance-evidence-observations">
              <h2>Lo que habías registrado</h2>
              <div className="learner-record-list">
                {observedEncounters.map((encounter) => (
                  <EvidenceRevisitObservationCard key={encounter.encounterInstanceId} encounter={encounter} />
                ))}
              </div>
            </section>
          ) : null}
          {evidenceRevisit.comparisons.length > 0 ? (
            <section className="learner-record-section" data-testid="fragrance-evidence-comparisons">
              <h2>Comparaciones anteriores</h2>
              <div className="learner-record-list">
                {evidenceRevisit.comparisons.map((comparison) => (
                  <EvidenceRevisitComparisonCard key={comparison.comparisonId} comparison={comparison} />
                ))}
              </div>
            </section>
          ) : null}
        </>
      ) : (
        <p className="lede">Todavía no has registrado nada sobre esta fragancia.</p>
      )}
      <LearnerRecordActions showCatalogLink fragranceId={fragranceId} />
      <p>
        <Link className="quiet-link" href="/mis-descubrimientos">
          Ver todo lo que he notado
        </Link>
      </p>
    </div>
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
export function LearnerRecordView({
  learnerRecord,
  resetPhase = "idle",
  onActivateReset = () => {},
  onCancelReset = () => {},
  onConfirmReset = () => {},
}) {
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
          <LearnerRecordDeleteControl
            phase={resetPhase}
            onActivate={onActivateReset}
            onCancel={onCancelReset}
            onConfirm={onConfirmReset}
          />
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
// never executes during server rendering. The only other storage access is
// the reset request itself, triggered exclusively by the confirmed delete
// action -- loadPerceptualLearningState already performs the v1->v2
// migration entirely in memory, so the initial read never triggers a write,
// and requestLearnerRecordReset never writes a replacement state either.
export function LearnerRecordContainer() {
  const [learnerRecord, setLearnerRecord] = useState(() =>
    buildLearnerRecord(loadPerceptualLearningState({ storage: getStorage() }))
  );
  const [resetPhase, setResetPhase] = useState("idle");
  // Two Phase 5.0 browser-acceptance defects, both fixed here together:
  //
  // 1. Deliberately NOT a useState lazy initializer. A lazy initializer
  //    runs exactly once, at this component's true first mount, but
  //    neither page.jsx nor LearnerRecordMount.jsx key or react to the
  //    URL's search string -- nothing tells React this instance must
  //    remount when only the query changes. Next.js's client router can
  //    and does reuse an already-mounted LearnerRecordContainer across a
  //    same-pathname, different-query navigation (e.g. a learner visits
  //    the unscoped page once, then later clicks a catalog card's scoped
  //    evidence link), so a value captured once at mount would silently
  //    freeze at whatever URL was current on that first mount.
  //
  // 2. useSearchParams()'s own returned value -- not an independent read of
  //    window.location.search -- is the ONLY input fed to
  //    resolveScopedFragrance. Calling useSearchParams() merely to force a
  //    re-render, while still separately reading window.location.search,
  //    reintroduces the exact same class of bug one level down: during a
  //    client-router transition, window.location is not guaranteed to
  //    already reflect the new URL at the moment this component re-renders,
  //    even though useSearchParams()'s reactive value already does (this is
  //    why a full page load/F5 always worked -- no transition, no race).
  //    searchParams?.toString() also correctly degrades to "" when there is
  //    no App Router context at all (this repo's own renderToStaticMarkup
  //    test harness), which resolveScopedFragrance treats as "no id".
  //
  // Recomputing scopedFragrance directly in the render body (never cached
  // in state) is what lets a useSearchParams()-triggered re-render actually
  // pick up the new value. Does not add a second storage read: this reads
  // the URL, not localStorage -- learnerRecord above is untouched and still
  // read exactly once.
  const searchParams = useSearchParams();
  const scopedFragrance = resolveScopedFragrance(searchParams?.toString());

  function handleActivateReset() {
    setResetPhase("confirming");
  }

  function handleCancelReset() {
    setResetPhase("idle");
  }

  function handleConfirmReset() {
    setResetPhase("deleting");

    const result = requestLearnerRecordReset({ storage: getStorage() });

    if (!result.succeeded) {
      setResetPhase("error");
      return;
    }

    setLearnerRecord(result.learnerRecord);
    setResetPhase("idle");
  }

  if (scopedFragrance) {
    return (
      <FragranceEvidenceView
        fragranceId={scopedFragrance.id}
        fragranceName={scopedFragrance.name}
        fragranceBrand={scopedFragrance.brand}
        evidenceRevisit={buildEvidenceRevisit({ learnerRecord, fragranceId: scopedFragrance.id })}
      />
    );
  }

  return (
    <LearnerRecordView
      learnerRecord={learnerRecord}
      resetPhase={resetPhase}
      onActivateReset={handleActivateReset}
      onCancelReset={handleCancelReset}
      onConfirmReset={handleConfirmReset}
    />
  );
}
