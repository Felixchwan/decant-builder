"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { createCatalogAssetResolver } from "@discovery-box/catalog";
import { aurelianCatalog } from "../merchant/catalog.js";
import { filterCatalog } from "../lib/filterCatalog.js";
import { resolveCatalogFragranceIntent } from "../lib/resolveCatalogFragranceIntent.js";

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

export function CatalogExplorer() {
  const [query, setQuery] = useState("");
  const [points, setPoints] = useState("all");
  const [requestedFragrance, setRequestedFragrance] = useState(null);
  const requestedCardRef = useRef(null);
  const visible = useMemo(() => {
    return filterCatalog(aurelianCatalog, query, points);
  }, [points, query]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setRequestedFragrance(resolveCatalogFragranceIntent(window.location.search, aurelianCatalog));
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
      </div>
      <div className="catalog-status"><p className="catalog-count" aria-live="polite">{visible.length} de {aurelianCatalog.length} fragancias</p><p>Los puntos ayudan a equilibrar tu Discovery Box; no representan el precio de una botella.</p></div>
      {visible.length ? (
        <div className="catalog-explorer-grid">
          {visible.map((item) => {
            const tier = getCatalogTierPresentation(item.id);
            return (
              <article className={`product-card${requestedFragrance?.id === item.id ? " product-card--highlighted" : ""}`} data-fragrance-id={item.id} key={item.id} ref={requestedFragrance?.id === item.id ? requestedCardRef : undefined} tabIndex={requestedFragrance?.id === item.id ? -1 : undefined}>
                <div className="product-card__image"><img alt={`Frasco de ${item.name}`} loading="lazy" src={resolveAsset(item.imageAssetKey)} /></div>
                <p className="eyebrow">{item.brand}</p><h2>{item.name}</h2>
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
