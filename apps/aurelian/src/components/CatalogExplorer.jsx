"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { createCatalogAssetResolver } from "@discovery-box/catalog";
import { aurelianCatalog } from "../merchant/catalog.js";
import { filterCatalog } from "../lib/filterCatalog.js";

const resolveAsset = createCatalogAssetResolver({ basePath: "/catalog-assets" });
const pointOptions = [...new Set(aurelianCatalog.map((item) => item.points))].sort((a, b) => a - b);

export function CatalogExplorer() {
  const [query, setQuery] = useState("");
  const [points, setPoints] = useState("all");
  const visible = useMemo(() => {
    return filterCatalog(aurelianCatalog, query, points);
  }, [points, query]);

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
        <div className="catalog-grid">
          {visible.map((item) => (
            <article className="product-card" key={item.id}>
              <div className="product-card__image"><img alt={`Frasco de ${item.name}`} loading="lazy" src={resolveAsset(item.imageAssetKey)} /></div>
              <p className="eyebrow">{item.brand}</p><h2>{item.name}</h2>
              <p className="product-card__accords">{item.accords.slice(0, 3).join(" · ")}</p>
              <p className="points">{item.points} {item.points === 1 ? "punto" : "puntos"}</p>
            </article>
          ))}
        </div>
      ) : <div className="empty-state"><h2>No encontramos coincidencias</h2><p>Prueba otra fragancia o casa, o selecciona “Todos” en puntos.</p></div>}
      <div className="centered-cta"><Link className="button" href="/build-your-box">Construye tu Discovery Box</Link></div>
    </>
  );
}
