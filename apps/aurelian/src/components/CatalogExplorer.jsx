"use client";

import { startTransition, useEffect, useMemo, useOptimistic, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createCatalogAssetResolver } from "@discovery-box/catalog";
import { aurelianCatalog } from "../merchant/catalog.js";
import { filterCatalog } from "../lib/filterCatalog.js";
import { buildCatalogSeasonHref, filterCatalogBySeason, getCatalogSeasonLabel, parseCatalogSeason } from "../lib/catalogSeason.js";
import { SEASONAL_SLOTS } from "../lib/seasonalSelection.js";
import { resolveCatalogFragranceIntent } from "../lib/resolveCatalogFragranceIntent.js";
import { DETAILS_QUERY_PARAM } from "../lib/parseDetailsIntent.js";
import { loadPerceptualLearningState } from "../perceptualLearning/perceptualLearningPersistence.js";
import { buildLearnerRecord } from "../perceptualLearning/learnerRecord.js";
import { buildEvidenceRevisit } from "../perceptualLearning/evidenceRevisit.js";

const resolveAsset = createCatalogAssetResolver({ basePath: "/catalog-assets" });
const pointOptions = [...new Set(aurelianCatalog.map((item) => item.points))].sort((a, b) => a - b);
const tierPresentation = [
  { maxId: 100, emoji: "🟤", color: "#b87333", background: "rgba(184,115,51,0.12)" },
  { maxId: 200, emoji: "⚪", color: "#cbd5e1", background: "rgba(203,213,225,0.12)" },
  { maxId: 300, emoji: "🟡", color: "#d4af37", background: "rgba(212,175,55,0.12)" },
  { maxId: 400, emoji: "⬢", color: "#bae6fd", background: "rgba(186,230,253,0.12)" },
  { maxId: 500, emoji: "💎", color: "#38bdf8", background: "rgba(56,189,248,0.12)" },
];

function getCatalogTierPresentation(id) {
  return tierPresentation.find((tier) => id < tier.maxId) ?? {
    emoji: "👑",
    color: "#a78bfa",
    background: "rgba(124,58,237,0.16)",
  };
}

// Explore a perfume's details in the Builder. Deliberately NOT ?fragrance=, which
// means "add to my box" and stays on the "Agregar a mi Discovery Box" button only.
function buildBuilderDetailsHref(fragranceId) {
  return `/build-your-box?${DETAILS_QUERY_PARAM}=${encodeURIComponent(fragranceId)}`;
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

// Phase 5.0 -- the catalog's entry point into revisiting prior evidence for
// one fragrance, without requiring a new Observation/Comparison submission.
// Pure, prop-driven (learnerRecord is passed in, never read here) so it's
// directly testable with representative props, matching this codebase's
// established convention. Renders nothing until learnerRecord is resolved
// (null pre-effect/pre-hydration) and nothing when that fragrance genuinely
// has no prior evidence -- this is a doorway to evidence the learner already
// has, never an empty/dead-end affordance. buildEvidenceRevisit is reused
// exactly as-is; nothing here re-derives or reinterprets its output.
export function CatalogLearningEvidenceLink({ fragranceId, fragranceName, learnerRecord }) {
  if (!learnerRecord) {
    return null;
  }

  const { hasPriorEvidence } = buildEvidenceRevisit({ learnerRecord, fragranceId });
  if (!hasPriorEvidence) {
    return null;
  }

  return (
    <Link
      className="product-card__learning-link"
      href={`/mis-descubrimientos?fragrance=${encodeURIComponent(fragranceId)}`}
      aria-label={`Ver lo que noté sobre ${fragranceName}`}
    >
      Ver lo que noté sobre esta fragancia
    </Link>
  );
}

// The app router exists inside the running app. A bare static render of this
// component (the unit tests) has none, and then the season control falls back to
// a plain navigation instead of failing.
function useOptionalRouter() {
  try {
    return useRouter();
  } catch {
    return null;
  }
}

// `season` is the validated public season key from /catalogo?season=..., or
// null/undefined for the full catalog (the default, unchanged behavior). The URL
// is the source of truth: the page reads it on the server and passes it down, the
// manual "Temporada" control writes it back, and the select always shows what the
// URL says. While a change is in flight the control and the list already show the
// chosen season (optimistic), then settle on whatever the new URL resolves to.
export function CatalogExplorer({ season: urlSeason = null }) {
  const router = useOptionalRouter();
  const [season, setOptimisticSeason] = useOptimistic(urlSeason);
  const [query, setQuery] = useState("");
  const [points, setPoints] = useState("all");
  const [requestedFragrance, setRequestedFragrance] = useState(null);
  // Starts null (this component is server-rendered, unlike
  // LearnerRecordContainer/ObservationCaptureFlow/ComparisonCaptureFlow,
  // which are all {ssr:false}-mounted) and is populated post-mount, same
  // deferred-to-next-paint discipline as requestedFragrance below -- one
  // storage read total, regardless of catalog size. Per-card evidence
  // availability is then derived cheaply, in memory, from this single
  // LearnerRecord via CatalogLearningEvidenceLink/buildEvidenceRevisit --
  // never a storage read per card.
  const [learnerRecord, setLearnerRecord] = useState(null);
  const requestedCardRef = useRef(null);
  const visible = useMemo(() => {
    return filterCatalog(aurelianCatalog, query, points, season);
  }, [points, query, season]);
  const seasonTotal = useMemo(() => filterCatalogBySeason(aurelianCatalog, season).length, [season]);
  const seasonLabel = season ? getCatalogSeasonLabel(season) : null;

  // "Todas" removes only `season`; every other param (fragrance=, ...) is kept.
  function changeSeason(value) {
    const next = parseCatalogSeason(value);
    const href = buildCatalogSeasonHref(window.location.search, next);
    startTransition(() => {
      setOptimisticSeason(next);
      if (router) router.push(href, { scroll: false });
      else window.location.assign(href);
    });
  }

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setRequestedFragrance(resolveCatalogFragranceIntent(window.location.search, aurelianCatalog));
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setLearnerRecord(buildLearnerRecord(loadPerceptualLearningState({ storage: getStorage() })));
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (!requestedFragrance || !requestedCardRef.current) return undefined;
    const frame = window.requestAnimationFrame(() => {
      requestedCardRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      requestedCardRef.current?.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [requestedFragrance]);

  return (
    <>
      <div className="catalog-controls" role="search">
        <label>Buscar fragancia o casa
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Ej. bergamota, Armani…" type="search" />
        </label>
        <label>Puntos por fragancia
          <select value={points} onChange={(event) => setPoints(event.target.value)}>
            <option value="all">Todos</option>
            {pointOptions.map((value) => <option key={value} value={value}>{value} {value === 1 ? "punto" : "puntos"}</option>)}
          </select>
        </label>
        <label>Temporada
          <select value={season ?? "all"} onChange={(event) => changeSeason(event.target.value)}>
            <option value="all">Todas</option>
            {SEASONAL_SLOTS.map(({ key, label }) => <option key={key} value={key}>{label}</option>)}
          </select>
        </label>
      </div>
      <div className="catalog-status"><p className="catalog-count" aria-live="polite">{seasonLabel
          ? `${visible.length === seasonTotal ? seasonTotal : `${visible.length} de ${seasonTotal}`} ${seasonTotal === 1 ? "fragancia" : "fragancias"} de ${seasonLabel.lower}`
          : `${visible.length} de ${aurelianCatalog.length} fragancias`}</p><p>Los puntos ayudan a equilibrar tu Discovery Box; no representan el precio de una botella.</p></div>
      {visible.length ? (
        <div className="catalog-explorer-grid">
          {visible.map((item) => {
            const tier = getCatalogTierPresentation(item.id);
            return (
              <article className={`product-card${requestedFragrance?.id === item.id ? " product-card--highlighted" : ""}`} data-fragrance-id={item.id} key={item.id} ref={requestedFragrance?.id === item.id ? requestedCardRef : undefined} tabIndex={requestedFragrance?.id === item.id ? -1 : undefined}>
                {/* The bottle and the name both lead to the same place: this perfume's details in the Builder
                    (?details=, which never adds it to the box). The name link is the one keyboard stop and the
                    one announced link; the bottle link repeats it for pointer and touch users only, so it is
                    taken out of the tab order and the accessibility tree rather than read twice. */}
                <div className="product-card__image">
                  <Link aria-hidden="true" className="product-card__image-link" href={buildBuilderDetailsHref(item.id)} tabIndex={-1}>
                    <img alt={`Frasco de ${item.name}`} loading="lazy" src={resolveAsset(item.imageAssetKey)} />
                  </Link>
                </div>
                <p className="eyebrow">{item.brand}</p>
                <h2>
                  <Link aria-label={`Ver notas y detalles de ${item.name} en el Builder`} className="product-card__name-link" href={buildBuilderDetailsHref(item.id)}>{item.name}</Link>
                </h2>
                <div className="product-card__actions">
                  <p
                    className="product-card__points"
                    style={{
                      borderColor: tier.color,
                      backgroundColor: tier.background,
                      color: tier.color,
                    }}
                    aria-label={`${item.points} ${item.points === 1 ? "punto" : "puntos"}`}
                  >
                    <span aria-hidden="true">{tier.emoji}</span>
                    <span>{item.points} {item.points === 1 ? "punto" : "puntos"}</span>
                  </p>
                  <Link className="button product-card__action" href={`/build-your-box?fragrance=${encodeURIComponent(item.id)}`} aria-label={`Agregar ${item.name} a mi Discovery Box`}>Agregar a mi Discovery Box</Link>
                </div>
                <details className="product-card__learning">
                  <summary aria-label={`Explorar opciones de aprendizaje para ${item.name}`}>Explorar esta fragancia</summary>
                  <div className="product-card__learning-links">
                    <Link
                      className="product-card__learning-link"
                      href={`/mis-descubrimientos/observar?fragrance=${encodeURIComponent(item.id)}`}
                      aria-label={`Registrar lo que percibo de ${item.name}`}
                    >
                      Registrar lo que percibo
                    </Link>
                    <Link
                      className="product-card__learning-link"
                      href={`/mis-descubrimientos/comparar?fragrance=${encodeURIComponent(item.id)}`}
                      aria-label={`Comparar ${item.name} con otra fragancia`}
                    >
                      Comparar con otra
                    </Link>
                    <CatalogLearningEvidenceLink
                      fragranceId={item.id}
                      fragranceName={item.name}
                      learnerRecord={learnerRecord}
                    />
                    <Link className="product-card__learning-link" href="/mis-descubrimientos">
                      Ver lo que he notado
                    </Link>
                  </div>
                </details>
              </article>
            );
          })}
        </div>
      ) : <div className="empty-state"><h2>No encontramos coincidencias</h2><p>Prueba otra fragancia o casa, o selecciona “Todos” en puntos.</p></div>}
      <div className="centered-cta"><Link className="button" href="/build-your-box">Construye tu Discovery Box</Link></div>
    </>
  );
}
