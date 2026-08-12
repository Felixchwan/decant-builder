import { OBSERVATION_MOMENT_COPY } from "../perceptualLearning/momentVocabulary.js";

// Presentation for prior learner-authored evidence, revealed only after a
// new Observation has been successfully persisted (Phase 4.1). Consumes
// exactly the projection buildEvidenceRevisit already produced -- never
// re-derives relevance/filtering itself, and never resolves fragrance
// identity through the live catalog (fragranceDisplaySnapshot only, the same
// null-safe fallback already established by LearnerRecordView.jsx).
//
// The one presentation-only filter here (omitting zero-Observation
// encounters from the Observation section) mirrors the same Phase 3.1
// correction LearnerRecordView.jsx already applies -- it is a "don't render
// an empty card" display rule, not a reimplementation of
// buildEvidenceRevisit's own fragranceId relevance logic.
//
// No hooks, no state, no effects -- pure presentation, so this file does not
// need its own "use client" directive; it is only ever reached transitively
// through ObservationCaptureFlow.jsx's existing client boundary.

function resolveFragranceDisplay(snapshot) {
  if (!snapshot) {
    return { name: "Una fragancia", brand: null };
  }

  return { name: snapshot.name, brand: snapshot.brand };
}

function formatRevisitDate(isoString) {
  try {
    return new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "short", year: "numeric" }).format(
      new Date(isoString)
    );
  } catch {
    return "";
  }
}

export function EvidenceRevisitObservationCard({ encounter }) {
  const { name, brand } = resolveFragranceDisplay(encounter.fragranceDisplaySnapshot);

  return (
    <article className="encounter-evidence-card" data-testid="evidence-revisit-observation-card">
      <p className="encounter-evidence-card__fragrance">
        {name}
        {brand ? <span className="encounter-evidence-card__brand"> · {brand}</span> : null}
      </p>
      <p className="encounter-evidence-card__date">{formatRevisitDate(encounter.createdAt)}</p>
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
    </article>
  );
}

export function EvidenceRevisitComparisonCard({ comparison }) {
  const first = resolveFragranceDisplay(comparison.firstEncounter?.fragranceDisplaySnapshot ?? null);
  const second = resolveFragranceDisplay(comparison.secondEncounter?.fragranceDisplaySnapshot ?? null);

  return (
    <article className="comparison-evidence-card" data-testid="evidence-revisit-comparison-card">
      <p className="comparison-evidence-card__pair">
        <span>{first.name}</span>
        {" ↔ "}
        <span>{second.name}</span>
      </p>
      <blockquote className="comparison-evidence-card__quote">{comparison.freeText}</blockquote>
      <p className="comparison-evidence-card__date">{formatRevisitDate(comparison.createdAt)}</p>
    </article>
  );
}

// Native <details>/<summary> disclosure -- the same established, already-shipped
// pattern as CatalogExplorer.jsx's learning disclosure and SiteHeader.jsx's
// mobile menu: keyboard-operable by default, no custom ARIA state duplicating
// native semantics, closed (collapsed) unless the learner opens it. Per this
// repo's own testing precedent, its content is present in server-rendered
// markup regardless of open/closed state -- that's what makes it directly
// verifiable under renderToStaticMarkup without needing to simulate a click.
//
// Caller contract: only rendered when evidenceRevisit.hasPriorEvidence is
// true, so at least one of the two sections below is guaranteed non-empty.
export function EvidenceRevisitView({ evidenceRevisit }) {
  const observedEncounters = evidenceRevisit.encounters.filter(
    (encounter) => encounter.observations.length > 0
  );

  return (
    <details className="evidence-revisit" data-testid="evidence-revisit">
      <summary>Revisar lo que había percibido antes</summary>
      <div className="evidence-revisit__content">
        {observedEncounters.length > 0 ? (
          <section className="evidence-revisit__section">
            <h3>Lo que habías registrado</h3>
            <div className="learner-record-list">
              {observedEncounters.map((encounter) => (
                <EvidenceRevisitObservationCard key={encounter.encounterInstanceId} encounter={encounter} />
              ))}
            </div>
          </section>
        ) : null}
        {evidenceRevisit.comparisons.length > 0 ? (
          <section className="evidence-revisit__section">
            <h3>Comparaciones anteriores</h3>
            <div className="learner-record-list">
              {evidenceRevisit.comparisons.map((comparison) => (
                <EvidenceRevisitComparisonCard key={comparison.comparisonId} comparison={comparison} />
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </details>
  );
}
